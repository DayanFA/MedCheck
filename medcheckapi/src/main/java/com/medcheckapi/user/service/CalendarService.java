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

    public CalendarService(InternshipPlanRepository planRepo, InternshipJustificationRepository justRepo, CheckSessionRepository sessionRepo) {
        this.planRepo = planRepo; this.justRepo = justRepo; this.sessionRepo = sessionRepo;
    }

    public Map<String,Object> monthView(User aluno, int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<InternshipPlan> plans = planRepo.findByAlunoAndDateBetweenOrderByDateAsc(aluno, start, end);
        List<InternshipJustification> justs = justRepo.findByAlunoAndDateBetweenOrderByDateAsc(aluno, start, end);
        List<CheckSession> sessions = sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, start.atStartOfDay(), end.atTime(23,59,59));

        Map<LocalDate, Long> plannedByDay = plans.stream().collect(Collectors.groupingBy(InternshipPlan::getDate, Collectors.summingLong(InternshipPlan::getPlannedSeconds)));
        Map<LocalDate, Long> workedByDay = computeWorkedByDay(sessions, start, end);
        Map<LocalDate, List<InternshipJustification>> justByDay = justs.stream().collect(Collectors.groupingBy(InternshipJustification::getDate));

        List<Map<String,Object>> days = new ArrayList<>();
        LocalDate today = LocalDate.now(ZONE);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            long planned = plannedByDay.getOrDefault(d, 0L);
            long worked = workedByDay.getOrDefault(d, 0L);
            List<InternshipJustification> ds = justByDay.getOrDefault(d, Collections.emptyList());
            String status = computeStatus(d, today, planned, worked, ds);
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
        return out;
    }

    private String computeStatus(LocalDate day, LocalDate today, long planned, long worked, List<InternshipJustification> justs) {
        boolean hasPendingJust = justs.stream().anyMatch(j -> "PENDING".equalsIgnoreCase(j.getStatus()));
        if (hasPendingJust) return "ORANGE";
        if (planned <= 0) return "NONE";
        if (day.isAfter(today)) return "BLUE"; // futuro planejado
        if (worked <= 0 && day.isBefore(today)) return "RED"; // passou e não fez nada
        if (worked < planned) return "YELLOW"; // fez menos que o planejado (hoje ou passado)
        return "GREEN"; // cumpriu
    }

    private Map<String,Object> planToMap(InternshipPlan p) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("date", p.getDate().toString());
        m.put("startTime", p.getStartTime().toString());
        m.put("endTime", p.getEndTime().toString());
        m.put("location", p.getLocation());
        m.put("note", p.getNote());
        m.put("plannedSeconds", p.getPlannedSeconds());
        return m;
    }

    private Map<String,Object> justToMap(InternshipJustification j) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", j.getId());
        m.put("date", j.getDate().toString());
        m.put("type", j.getType());
        m.put("reason", j.getReason());
        m.put("status", j.getStatus());
        m.put("planId", j.getPlan() == null ? null : j.getPlan().getId());
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
            rounded.put(e.getKey(), roundedToMin);
        }
        return rounded;
    }
}
