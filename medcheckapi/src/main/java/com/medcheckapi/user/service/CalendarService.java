package com.medcheckapi.user.service;

import com.medcheckapi.user.model.*;
import com.medcheckapi.user.repository.*;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CalendarService {
    private final InternshipPlanRepository planRepo;
    private final InternshipJustificationRepository justRepo;
    private final CheckSessionRepository sessionRepo;
    private static final ZoneId ZONE = ZoneId.of("GMT-5");
    // Minutos de tolerância após o horário inicial planejado antes de marcar FALTOU se não houve qualquer trabalho
    private static final int LATE_START_GRACE_MINUTES = 1;

    public CalendarService(InternshipPlanRepository planRepo, InternshipJustificationRepository justRepo, CheckSessionRepository sessionRepo) {
        this.planRepo = planRepo; this.justRepo = justRepo; this.sessionRepo = sessionRepo;
    }

    // Backward compatible adapter (deprecated use with forced discipline param)
    @Deprecated
    public Map<String,Object> monthView(User aluno, int year, int month) {
        return monthView(aluno, year, month, null);
    }

    public Map<String,Object> monthView(User aluno, int year, int month, Discipline forced) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        // Regra: se for forçado usa forçado; SENÃO
        //  - se o solicitante (aluno) está vendo seu próprio calendário -> herda current_discipline (comportamento antigo)
        //  - se for preceptor/admin consultando aluno e não passou disciplineId => visão geral (effective = null)
        Discipline effective;
        effective = forced; // null => visão geral (não usa current_discipline implicitamente)
        // Novo ajuste:
        //  - effective == null => visão geral: retorna todos os planos (todas as disciplinas + NULL)
        //  - effective != null (filtragem explícita) => retorna apenas planos daquela disciplina (SEM incluir NULL)
        List<InternshipPlan> plans = planRepo.findByAlunoAndDateBetweenOrderByDateAsc(aluno, start, end)
            .stream().filter(p -> effective == null || (p.getDiscipline() != null && p.getDiscipline().getId().equals(effective.getId())))
            .toList();
        List<InternshipJustification> justs = justRepo.findByAlunoAndDateBetweenOrderByDateAsc(aluno, start, end)
            .stream().filter(j -> effective == null || (j.getDiscipline() != null && j.getDiscipline().getId().equals(effective.getId())))
            .toList();
        List<CheckSession> sessions = (effective == null)
            ? sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, start.atStartOfDay(), end.atTime(23,59,59))
            : sessionRepo.findByAlunoAndDisciplineAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, effective, start.atStartOfDay(), end.atTime(23,59,59));

        Map<LocalDate, Long> plannedByDay = plans.stream().collect(Collectors.groupingBy(InternshipPlan::getDate, Collectors.summingLong(InternshipPlan::getPlannedSeconds)));
        // Mapear menor horário de início e maior horário de fim por dia (para distinguir "futuro" de "faltou" no próprio dia)
        Map<LocalDate, LocalTime> earliestStartByDay = new HashMap<>();
        Map<LocalDate, LocalTime> latestEndByDay = new HashMap<>();
        for (InternshipPlan p : plans) {
            LocalDate d = p.getDate();
            LocalTime s = p.getStartTime();
            LocalTime e = p.getEndTime();
            if (s != null) {
                earliestStartByDay.merge(d, s, (oldV, newV) -> newV.isBefore(oldV) ? newV : oldV);
            }
            if (e != null) {
                if (s != null && s.isAfter(e)) {
                    e = LocalTime.of(23,59); // overnight: usar 23:59 como limite do dia
                }
                LocalTime finalEnd = e;
                latestEndByDay.merge(d, finalEnd, (oldV, newV) -> newV.isAfter(oldV) ? newV : oldV);
            }
        }
        Map<LocalDate, Long> workedByDay = computeWorkedByDay(sessions, start, end);
        Map<LocalDate, List<InternshipJustification>> justByDay = justs.stream().collect(Collectors.groupingBy(InternshipJustification::getDate));

        List<Map<String,Object>> days = new ArrayList<>();
        LocalDate today = LocalDate.now(ZONE);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            long planned = plannedByDay.getOrDefault(d, 0L);
            long worked = workedByDay.getOrDefault(d, 0L);
            List<InternshipJustification> ds = justByDay.getOrDefault(d, Collections.emptyList());
            String status = computeStatus(d, today, planned, worked, ds, earliestStartByDay.get(d), latestEndByDay.get(d));
            Map<String,Object> item = new HashMap<>();
            item.put("date", d.toString());
            item.put("plannedSeconds", planned);
            item.put("workedSeconds", worked);
            item.put("status", status);
            if (!ds.isEmpty()) {
                item.put("justificationStatus", ds.get(0).getStatus());
            }
            days.add(item);
        }

        Map<String,Object> out = new HashMap<>();
        out.put("year", year); out.put("month", month);
        out.put("days", days);
        out.put("plans", plans.stream().map(this::planToMap).toList());
        out.put("justifications", justs.stream().map(this::justToMap).toList());
        if (effective != null) {
            out.put("forcedDiscipline", Map.of(
                "id", effective.getId(),
                "code", effective.getCode(),
                "name", effective.getName()
            ));
        }
        return out;
    }

    private String computeStatus(LocalDate day, LocalDate today, long planned, long worked, List<InternshipJustification> justs,
                                 LocalTime earliestStart, LocalTime latestEnd) {
        boolean hasAnyJust = !justs.isEmpty();
        if (hasAnyJust) return "ORANGE"; // justificativa domina
        if (planned <= 0) return "NONE";
        if (day.isAfter(today)) return "BLUE"; // qualquer coisa no futuro

        // Passado (ontem ou antes)
        if (day.isBefore(today)) {
            if (worked <= 0) return "RED"; // nada feito
            if (worked < planned) return "YELLOW"; // fez algo mas não completou
            return "GREEN"; // completou ou excedeu
        }

    // Dia atual: regra solicitada -> se houve qualquer check-in (worked>0):
    //   - se worked < planned => INCOMPLETO (YELLOW)
    //   - se worked >= planned => CUMPRIDO (GREEN)
    // Caso contrário (worked==0) aplica lógica temporal (BLUE futuro / RED após janela / BLUE dentro da janela antes de check-in com tolerância).
    // Mantemos contudo parte da granularidade para transição automática para RED quando passa a janela completa sem check-in.
        LocalTime now = LocalTime.now(ZONE);
        // Se não temos janelas, usar fallback agregado
        if (earliestStart == null || latestEnd == null) {
            if (worked <= 0) return "BLUE"; // sem info granular, considerar ainda futuro/andamento
            if (worked < planned) return "YELLOW"; // começou e não terminou
            return "GREEN";
        }
        // Antes de começar qualquer intervalo previsto
        if (now.isBefore(earliestStart)) {
            return "BLUE"; // ainda vai começar
        }
        // Após terminar todas as janelas previstas
        if (now.isAfter(latestEnd)) {
            if (worked <= 0) return "RED"; // perdeu tudo
            if (worked < planned) return "YELLOW"; // fez parcial
            return "GREEN"; // completou
        }
        // Se já existe qualquer worked > 0 ignoramos o estado futuro e passamos direto para YELLOW/GREEN
        if (worked > 0) {
            if (worked < planned) return "YELLOW";
            return "GREEN";
        }
        // Ainda nenhum check-in dentro da janela
        if (earliestStart != null) {
            LocalTime graceLimit = earliestStart.plusMinutes(LATE_START_GRACE_MINUTES);
            if (now.isAfter(graceLimit)) {
                return "RED"; // atraso após tolerância sem check-in
            }
        }
        return "BLUE"; // aguardando primeiro check-in
    }

    private Map<String,Object> planToMap(InternshipPlan p) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("date", p.getDate().toString());
        m.put("startTime", p.getStartTime().toString());
        m.put("endTime", p.getEndTime().toString());
        m.put("location", p.getLocation());
        m.put("note", p.getNote());
        long secs = p.getPlannedSeconds();
        if (secs < 0 && p.getStartTime() != null && p.getEndTime() != null) {
            // segurança extra: overnight não tratado por algum motivo => soma 24h
            secs += 24 * 3600;
        }
        m.put("plannedSeconds", secs);
        if (p.getWeekNumber() != null) m.put("weekNumber", p.getWeekNumber());
        if (p.getDiscipline() != null) {
            m.put("discipline", Map.of(
                "id", p.getDiscipline().getId(),
                "code", p.getDiscipline().getCode(),
                "name", p.getDiscipline().getName()
            ));
        }
        return m;
    }

    private Map<String,Object> justToMap(InternshipJustification j) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", j.getId());
        m.put("date", j.getDate().toString());
        m.put("type", j.getType());
        m.put("reason", j.getReason());
        m.put("status", j.getStatus());
        m.put("reviewNote", j.getReviewNote());
        m.put("planId", j.getPlan() == null ? null : j.getPlan().getId());
        if (j.getDiscipline() != null) {
            m.put("discipline", Map.of(
                "id", j.getDiscipline().getId(),
                "code", j.getDiscipline().getCode(),
                "name", j.getDiscipline().getName()
            ));
        }
        return m;
    }

    private Map<LocalDate, Long> computeWorkedByDay(List<CheckSession> sessions, LocalDate start, LocalDate end) {
        Map<LocalDate, Long> map = new HashMap<>();
        for (CheckSession cs : sessions) {
            LocalDateTime in = cs.getCheckInTime();
            LocalDateTime out = cs.getCheckOutTime() != null ? cs.getCheckOutTime() : cs.getCheckInTime();
            if (out.isBefore(in)) out = in;
            // clip to range [start..end]
            LocalDateTime rangeStart = start.atStartOfDay();
            LocalDateTime rangeEnd = end.atTime(23,59,59);
            LocalDateTime from = in.isBefore(rangeStart) ? rangeStart : in;
            LocalDateTime to = out.isAfter(rangeEnd) ? rangeEnd : out;
            if (to.isBefore(from)) continue;
            // distribute per day
            LocalDateTime cursor = from;
            while (!cursor.toLocalDate().isAfter(to.toLocalDate())) {
                LocalDate day = cursor.toLocalDate();
                LocalDateTime dayEnd = day.atTime(23,59,59);
                LocalDateTime segTo = to.isBefore(dayEnd) ? to : dayEnd;
                long secs = Duration.between(cursor, segTo).getSeconds();
                // accumulate then round to nearest minute when finalizing later; here we still add seconds
                map.merge(day, Math.max(0, secs), Long::sum);
                cursor = day.plusDays(1).atStartOfDay();
            }
        }
        // Round each day total to nearest minute to avoid fractional-hour artifacts in UI
        Map<LocalDate, Long> rounded = new HashMap<>();
        for (Map.Entry<LocalDate, Long> e : map.entrySet()) {
            long s = e.getValue();
            long roundedToMin = Math.round(s / 60.0) * 60L;
            // Regra de negócio: qualquer check-in (mesmo 1 segundo) deve contar para mudar estado.
            // Se houve algum segundo (>0) mas o arredondamento levou a 0, preservamos como 1 segundo.
            if (s > 0 && roundedToMin == 0) {
                roundedToMin = 1; // garante worked>0 na lógica de status
            }
            rounded.put(e.getKey(), roundedToMin);
        }
        return rounded;
    }
}
