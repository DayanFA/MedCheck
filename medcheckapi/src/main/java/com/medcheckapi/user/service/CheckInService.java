package com.medcheckapi.user.service;

import com.medcheckapi.user.model.*;
import com.medcheckapi.user.repository.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.*;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CheckInService {

    private final CheckCodeRepository codeRepo;
    private final CheckSessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final SecureRandom random = new SecureRandom();
    private final DisciplineRepository disciplineRepo;
    // Duração fixa de validade do código (em segundos). Requisito: apenas 1 minuto.
    private static final int CODE_VALIDITY_SECONDS = 60;

    public CheckInService(CheckCodeRepository codeRepo, CheckSessionRepository sessionRepo, UserRepository userRepo, DisciplineRepository disciplineRepo) {
        this.codeRepo = codeRepo;
        this.sessionRepo = sessionRepo;
        this.userRepo = userRepo;
        this.disciplineRepo = disciplineRepo;
    }

    private String generateCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no similar chars
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        return sb.toString();
    }

    // Fuso oficial do Acre (sem horário de verão atualmente)
    private static final ZoneId ACRE_ZONE = ZoneId.of("America/Rio_Branco");
    private LocalDateTime fixedNow() { return LocalDateTime.now(ACRE_ZONE); }

    @Transactional
    public Map<String,Object> getOrCreateCurrentCode(Long preceptorId) {
        User preceptor = userRepo.findById(preceptorId).orElseThrow();
        if (preceptor.getRole() != Role.PRECEPTOR && preceptor.getRole() != Role.ADMIN) throw new IllegalStateException("Usuário não é preceptor");
    LocalDateTime now = fixedNow();
    return codeRepo.findFirstByPreceptorAndExpiresAtGreaterThanOrderByGeneratedAtDesc(preceptor, now).map(c -> mapCode(c))
                .orElseGet(() -> {
                    // create new (valid 60s)
                    CheckCode c = new CheckCode();
                    c.setPreceptor(preceptor);
                    c.setCode(generateCode());
                    c.setGeneratedAt(now);
                    c.setExpiresAt(now.plusSeconds(CODE_VALIDITY_SECONDS));
                    c.setUsageCount(0);
                    c.setLastAccessedAt(now);
                    codeRepo.save(c);
                    return mapCode(c);
                });
    }

    private Map<String,Object> mapCode(CheckCode c) {
        Map<String,Object> m = new HashMap<>();
        m.put("code", c.getCode());
    // Timestamp de expiração com offset -05:00 explícito
    m.put("expiresAt", c.getExpiresAt().atZone(ACRE_ZONE).toOffsetDateTime().toString());
        m.put("secondsRemaining", c.getSecondsRemaining());
        return m;
    }

    @Transactional
    public Map<String,Object> performCheckIn(Long alunoId, Long preceptorId, String code, Long disciplineId) {
    User aluno = userRepo.findById(alunoId).orElseThrow();
        User preceptor = userRepo.findById(preceptorId).orElseThrow();
        if (aluno.getRole() != Role.ALUNO) throw new IllegalStateException("Usuário não é aluno");
    // Nova regra: disciplineId é obrigatório e não há mais fallback em currentDiscipline legado
    if (disciplineId == null) {
        throw new IllegalStateException("Disciplina obrigatória para Check-In (não enviada)");
    }
    Discipline selected = disciplineRepo.findById(disciplineId).orElseThrow(() -> new IllegalStateException("Disciplina informada não encontrada"));
    // Validação de vínculo: ADMIN pode passar em qualquer disciplina; PRECEPTOR precisa estar vinculado
    if (preceptor.getRole() != Role.ADMIN) {
        boolean belongs = false;
        try {
            if (selected.getPreceptors() != null) {
                belongs = selected.getPreceptors().stream().anyMatch(p -> Objects.equals(p.getId(), preceptor.getId()));
            }
        } catch (Exception ignored) {
            // fallback seguro caso coleção seja lazy e não inicialize corretamente
            List<Discipline> discs = disciplineRepo.findByPreceptors_Id(preceptor.getId());
            belongs = discs.stream().anyMatch(d -> Objects.equals(d.getId(), selected.getId()));
        }
        if (!belongs) {
            throw new IllegalStateException("Preceptor não vinculado à disciplina selecionada");
        }
    }
    LocalDateTime now = fixedNow();
        // code validation (case-insensitive)
    CheckCode usedCode = codeRepo.findFirstByPreceptorAndCodeIgnoreCaseAndExpiresAtGreaterThanOrderByGeneratedAtDesc(preceptor, code, now)
        .orElseThrow(() -> new IllegalStateException("Código inválido ou expirado"));
        // incrementa contador de uso e marca lastAccessedAt
        usedCode.setUsageCount(usedCode.getUsageCount() + 1);
        usedCode.setLastAccessedAt(now);
        codeRepo.save(usedCode);
        // ensure no open session
    if (sessionRepo.findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(aluno).isPresent()) throw new IllegalStateException("Já em serviço");
        CheckSession cs = new CheckSession();
        cs.setAluno(aluno);
        cs.setPreceptor(preceptor);
        cs.setCheckInTime(now);
        cs.setDiscipline(selected);
        cs.setValidated(true);
        sessionRepo.save(cs);
        return sessionToMap(cs);
    }

    @Transactional
    public Map<String,Object> performCheckOut(Long alunoId) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
    CheckSession open = sessionRepo.findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(aluno).orElseThrow(() -> new IllegalStateException("Nenhum check-in ativo"));
    open.setCheckOutTime(fixedNow());
        sessionRepo.save(open);
        return sessionToMap(open);
    }

    public List<Map<String,Object>> listSessionsForAluno(Long alunoId, LocalDate start, LocalDate end, Long disciplineId) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
        LocalDateTime from = start.atStartOfDay();
        LocalDateTime to = end.atTime(23,59,59);
        Discipline selected = null;
        if (disciplineId != null) {
            selected = disciplineRepo.findById(disciplineId).orElse(null);
        } else {
            selected = aluno.getCurrentDiscipline();
        }
        List<CheckSession> list = (selected == null)
                ? sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, from, to)
                : sessionRepo.findByAlunoAndDisciplineAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, selected, from, to);
        List<Map<String,Object>> out = new ArrayList<>();
        list.forEach(cs -> out.add(sessionToMap(cs)));
        return out;
    }

    private Map<String,Object> sessionToMap(CheckSession cs) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", cs.getId());
        m.put("alunoId", cs.getAluno().getId());
        m.put("preceptorId", cs.getPreceptor().getId());
    if (cs.getDiscipline() != null) {
        m.put("discipline", Map.of(
            "id", cs.getDiscipline().getId(),
            "code", cs.getDiscipline().getCode(),
            "name", cs.getDiscipline().getName()
        ));
    }
    m.put("checkInTime", cs.getCheckInTime().atZone(ACRE_ZONE).toOffsetDateTime().toString());
    m.put("checkOutTime", cs.getCheckOutTime() == null ? null : cs.getCheckOutTime().atZone(ACRE_ZONE).toOffsetDateTime().toString());
        m.put("validated", cs.isValidated());
        if (cs.getCheckOutTime() != null) {
            Duration d = cs.getWorkedDuration();
            long secs = d.getSeconds();
            long h = secs / 3600; long mnt = (secs % 3600)/60; long s = secs % 60;
            m.put("worked", String.format("%02d:%02d:%02d", h,mnt,s));
        } else {
            m.put("worked", null);
        }
        return m;
    }

    public Map<String,Object> statusForAluno(Long alunoId) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
    LocalDate today = LocalDate.now(ACRE_ZONE);
    List<CheckSession> todays = sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, today.atStartOfDay(), today.atTime(23,59,59));
        long workedSecs = 0;
        Optional<CheckSession> open = Optional.empty();
    LocalDateTime now = fixedNow();
        for (CheckSession cs : todays) {
            if (cs.getCheckOutTime() == null) {
                open = Optional.of(cs);
                // adiciona tempo decorrido até agora (não esperar check-out para contar)
                workedSecs += Duration.between(cs.getCheckInTime(), now).getSeconds();
            } else {
                workedSecs += cs.getWorkedDuration().getSeconds();
            }
        }
        Map<String,Object> resp = new HashMap<>();
        resp.put("inService", open.isPresent());
        resp.put("openSession", open.map(this::sessionToMap).orElse(null));
        resp.put("workedSeconds", workedSecs);
        return resp;
    }

    // Limpeza periódica: a cada 5 minutos remove códigos não utilizados há mais de 20 minutos
    @Scheduled(fixedDelay = 300_000) // 5 minutos
    @Transactional
    public void cleanupUnusedCodes() {
    LocalDateTime threshold = fixedNow().minusMinutes(20);
        int removed = codeRepo.deleteAllUnusedOlderThan(threshold);
        if (removed > 0) {
            System.out.println("[CLEANUP] Removed " + removed + " unused check codes older than 20 minutes");
        }
    }
}
