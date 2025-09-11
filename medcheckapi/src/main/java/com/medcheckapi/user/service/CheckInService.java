package com.medcheckapi.user.service;

import com.medcheckapi.user.model.*;
import com.medcheckapi.user.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.*;
import java.util.*;

@Service
public class CheckInService {

    private final CheckCodeRepository codeRepo;
    private final CheckSessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final SecureRandom random = new SecureRandom();
    // Duração fixa de validade do código (em segundos). Requisito: apenas 1 minuto.
    private static final int CODE_VALIDITY_SECONDS = 60;

    public CheckInService(CheckCodeRepository codeRepo, CheckSessionRepository sessionRepo, UserRepository userRepo) {
        this.codeRepo = codeRepo;
        this.sessionRepo = sessionRepo;
        this.userRepo = userRepo;
    }

    private String generateCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no similar chars
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        return sb.toString();
    }

    @Transactional
    public Map<String,Object> getOrCreateCurrentCode(Long preceptorId) {
        User preceptor = userRepo.findById(preceptorId).orElseThrow();
        if (preceptor.getRole() != Role.PRECEPTOR && preceptor.getRole() != Role.ADMIN) throw new IllegalStateException("Usuário não é preceptor");
        LocalDateTime now = LocalDateTime.now();
    return codeRepo.findFirstByPreceptorAndExpiresAtGreaterThanOrderByGeneratedAtDesc(preceptor, now).map(c -> mapCode(c))
                .orElseGet(() -> {
                    // create new (valid 60s)
                    CheckCode c = new CheckCode();
                    c.setPreceptor(preceptor);
                    c.setCode(generateCode());
                    c.setGeneratedAt(now);
                    c.setExpiresAt(now.plusSeconds(CODE_VALIDITY_SECONDS));
                    codeRepo.save(c);
                    return mapCode(c);
                });
    }

    private Map<String,Object> mapCode(CheckCode c) {
        Map<String,Object> m = new HashMap<>();
        m.put("code", c.getCode());
        m.put("expiresAt", c.getExpiresAt().toString());
        m.put("secondsRemaining", c.getSecondsRemaining());
        return m;
    }

    @Transactional
    public Map<String,Object> performCheckIn(Long alunoId, Long preceptorId, String code) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
        User preceptor = userRepo.findById(preceptorId).orElseThrow();
        if (aluno.getRole() != Role.ALUNO) throw new IllegalStateException("Usuário não é aluno");
        LocalDateTime now = LocalDateTime.now();
        // code validation (case-insensitive)
    codeRepo.findFirstByPreceptorAndCodeIgnoreCaseAndExpiresAtGreaterThanOrderByGeneratedAtDesc(preceptor, code, now)
        .orElseThrow(() -> new IllegalStateException("Código inválido ou expirado"));
        // ensure no open session
    if (sessionRepo.findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(aluno).isPresent()) throw new IllegalStateException("Já em serviço");
        CheckSession cs = new CheckSession();
        cs.setAluno(aluno);
        cs.setPreceptor(preceptor);
        cs.setCheckInTime(now);
        cs.setValidated(true);
        sessionRepo.save(cs);
        return sessionToMap(cs);
    }

    @Transactional
    public Map<String,Object> performCheckOut(Long alunoId) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
    CheckSession open = sessionRepo.findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(aluno).orElseThrow(() -> new IllegalStateException("Nenhum check-in ativo"));
        open.setCheckOutTime(LocalDateTime.now());
        sessionRepo.save(open);
        return sessionToMap(open);
    }

    public List<Map<String,Object>> listSessionsForAluno(Long alunoId, LocalDate start, LocalDate end) {
        User aluno = userRepo.findById(alunoId).orElseThrow();
        LocalDateTime from = start.atStartOfDay();
        LocalDateTime to = end.atTime(23,59,59);
    List<CheckSession> list = sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, from, to);
        List<Map<String,Object>> out = new ArrayList<>();
        list.forEach(cs -> out.add(sessionToMap(cs)));
        return out;
    }

    private Map<String,Object> sessionToMap(CheckSession cs) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", cs.getId());
        m.put("alunoId", cs.getAluno().getId());
        m.put("preceptorId", cs.getPreceptor().getId());
        m.put("checkInTime", cs.getCheckInTime().toString());
        m.put("checkOutTime", cs.getCheckOutTime() == null ? null : cs.getCheckOutTime().toString());
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
        LocalDate today = LocalDate.now();
    List<CheckSession> todays = sessionRepo.findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(aluno, today.atStartOfDay(), today.atTime(23,59,59));
        long workedSecs = 0;
        Optional<CheckSession> open = Optional.empty();
        for (CheckSession cs : todays) {
            if (cs.getCheckOutTime() == null) open = Optional.of(cs);
            workedSecs += cs.getWorkedDuration().getSeconds();
        }
        Map<String,Object> resp = new HashMap<>();
        resp.put("inService", open.isPresent());
        resp.put("openSession", open.map(this::sessionToMap).orElse(null));
        resp.put("workedSeconds", workedSecs);
        return resp;
    }
}
