package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.*;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.InternshipPlanRepository;
import com.medcheckapi.user.repository.InternshipJustificationRepository;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.service.CalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {
    private final UserRepository userRepo;
    private final CalendarService calendarService;
    private final InternshipPlanRepository planRepo;
    private final InternshipJustificationRepository justRepo;
    private final DisciplineRepository discRepo;

    public CalendarController(UserRepository userRepo, CalendarService calendarService, InternshipPlanRepository planRepo, InternshipJustificationRepository justRepo, DisciplineRepository discRepo) {
        this.userRepo = userRepo; this.calendarService = calendarService; this.planRepo = planRepo; this.justRepo = justRepo; this.discRepo = discRepo;
    }

    private Map<String,Object> planDto(InternshipPlan p) {
        Map<String,Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("date", p.getDate().toString());
        m.put("startTime", p.getStartTime() == null ? null : p.getStartTime().toString());
        m.put("endTime", p.getEndTime() == null ? null : p.getEndTime().toString());
        m.put("location", p.getLocation());
        if (p.getNote() != null) m.put("note", p.getNote());
        if (p.getWeekNumber() != null) m.put("weekNumber", p.getWeekNumber());
        // opcional: incluir plannedSeconds
        m.put("plannedSeconds", p.getPlannedSeconds());
        return m;
    }

    private User currentUser(org.springframework.security.core.userdetails.User principal) {
        return userRepo.findByCpf(principal.getUsername()).orElseThrow();
    }

    // Retorna o primeiro preceptor vinculado à disciplina atual do aluno logado (ou vazio)
    @GetMapping("/current/preceptor")
    public ResponseEntity<?> currentPreceptor(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        Discipline d = me.getCurrentDiscipline();
    if (d == null) return ResponseEntity.ok(new HashMap<>()); // empty
        // Lazy load preceptores (ManyToMany). Se não carregado, buscar via repository
        Discipline managed = discRepo.findById(d.getId()).orElse(null);
    if (managed == null || managed.getPreceptors().isEmpty()) return ResponseEntity.ok(new HashMap<>());
        User preceptor = managed.getPreceptors().stream().findFirst().orElse(null);
    if (preceptor == null) return ResponseEntity.ok(new HashMap<>());
    Map<String,Object> resp = new HashMap<>();
    resp.put("id", preceptor.getId());
    resp.put("name", preceptor.getName());
    return ResponseEntity.ok(resp);
    }

    @GetMapping("/month")
    public ResponseEntity<?> month(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                   @RequestParam int year, @RequestParam int month,
                                   @RequestParam(required = false) Long alunoId) {
        User me = currentUser(principal);
        User target = me;
        if (alunoId != null && (me.getRole() == Role.PRECEPTOR || me.getRole() == Role.ADMIN)) {
            target = userRepo.findById(alunoId).orElse(me);
        }
        return ResponseEntity.ok(calendarService.monthView(target, year, month));
    }

    // Planos do aluno logado filtrados por weekNumber (1..10)
    @GetMapping("/week")
    public ResponseEntity<?> week(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                  @RequestParam("weekNumber") Integer weekNumber,
                                  @RequestParam(value = "alunoId", required = false) Long alunoId) {
        if (weekNumber == null || weekNumber < 1 || weekNumber > 52) {
            return ResponseEntity.badRequest().body(Map.of("error", "weekNumber inválido"));
        }
        User me = currentUser(principal);
        User target = me;
        if (alunoId != null && (me.getRole() == Role.PRECEPTOR || me.getRole() == Role.ADMIN)) {
            target = userRepo.findById(alunoId).orElse(me);
        }
    Discipline current = target.getCurrentDiscipline();
    List<InternshipPlan> list = (current == null)
        ? planRepo.findByAlunoAndWeekNumberOrderByDateAsc(target, weekNumber)
        : planRepo.findByAlunoAndDisciplineAndWeekNumberOrderByDateAsc(target, current, weekNumber);
        List<Map<String,Object>> plans = list.stream().map(this::planDto).toList();
        Map<String,Object> out = new HashMap<>();
        out.put("weekNumber", weekNumber);
        out.put("count", plans.size());
        out.put("plans", plans);
        return ResponseEntity.ok(out);
    }

    @PostMapping("/plan")
    public ResponseEntity<?> upsertPlan(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                        @RequestBody Map<String, String> body) {
        User me = currentUser(principal);
        Long id = body.containsKey("id") ? Long.valueOf(body.get("id")) : null;
        LocalDate date = LocalDate.parse(body.get("date"));
        LocalTime start = LocalTime.parse(body.get("startTime"));
        LocalTime end = LocalTime.parse(body.get("endTime"));
        String location = body.getOrDefault("location", "");
        if (location == null || location.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Local é obrigatório"));
        }
        String note = body.getOrDefault("note", null);
        Integer weekNumber = null;
        if (body.containsKey("weekNumber")) {
            try {
                weekNumber = Integer.valueOf(body.get("weekNumber"));
                if (weekNumber < 1 || weekNumber > 52) weekNumber = null; // sanity
            } catch (Exception ignored) {}
        }
        InternshipPlan p = id == null ? new InternshipPlan() : planRepo.findById(id).orElse(new InternshipPlan());
        p.setAluno(me);
        p.setDate(date);
        p.setStartTime(start);
        p.setEndTime(end);
        p.setLocation(location);
        p.setNote(note);
        p.setWeekNumber(weekNumber);
        // Disciplina atual do aluno vincula o plano
        p.setDiscipline(me.getCurrentDiscipline());
        p = planRepo.save(p);
        Map<String,Object> resp = new HashMap<>();
        resp.put("plan", planDto(p));
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/plan/{id}")
    public ResponseEntity<?> deletePlan(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                        @PathVariable Long id) {
        User me = currentUser(principal);
        return planRepo.findById(id).map(p -> {
            if (!p.getAluno().getId().equals(me.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
            }
            planRepo.deleteById(id);
            return ResponseEntity.ok(Map.of("deleted", true));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Criar ou atualizar justificativa do aluno logado
    @PostMapping("/justify")
    public ResponseEntity<?> upsertJustification(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                 @RequestBody Map<String,String> body) {
        User me = currentUser(principal);
        Long id = body.containsKey("id") ? Long.valueOf(body.get("id")) : null;
        LocalDate date = LocalDate.parse(body.get("date"));
        InternshipJustification j = id == null ? new InternshipJustification() : justRepo.findById(id).orElse(new InternshipJustification());
        j.setAluno(me);
        j.setDate(date);
        if (body.containsKey("planId")) {
            try {
                Long pid = Long.valueOf(body.get("planId"));
                planRepo.findById(pid).ifPresent(j::setPlan);
            } catch (Exception ignored) { j.setPlan(null); }
        }
        j.setType(body.getOrDefault("type", "GENERAL"));
        j.setReason(body.getOrDefault("reason", ""));
        // Sempre reseta para PENDING quando o aluno cria/edita
        j.setStatus("PENDING");
        j.setDiscipline(me.getCurrentDiscipline());
        j = justRepo.save(j);
        Map<String,Object> resp = new HashMap<>();
        resp.put("id", j.getId());
        resp.put("date", j.getDate().toString());
        resp.put("type", j.getType());
        resp.put("reason", j.getReason());
        resp.put("status", j.getStatus());
        resp.put("planId", j.getPlan() == null ? null : j.getPlan().getId());
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/justify/{id}")
    public ResponseEntity<?> deleteJustification(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                 @PathVariable Long id) {
        User me = currentUser(principal);
        return justRepo.findById(id).map(j -> {
            if (!j.getAluno().getId().equals(me.getId())) {
                return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
            }
            // allow delete only if status is PENDING
            if (!"PENDING".equalsIgnoreCase(j.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Não é possível excluir justificativa já revisada"));
            }
            justRepo.deleteById(id);
            return ResponseEntity.ok(Map.of("deleted", true));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/justify")
    public ResponseEntity<?> deleteJustificationByDate(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                       @RequestParam("date") String dateStr) {
        User me = currentUser(principal);
        LocalDate date = LocalDate.parse(dateStr);
        return justRepo.findFirstByAlunoAndDate(me, date).map(j -> {
            if (!"PENDING".equalsIgnoreCase(j.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Não é possível excluir justificativa já revisada"));
            }
            justRepo.delete(j);
            return ResponseEntity.ok(Map.of("deleted", true));
        }).orElse(ResponseEntity.notFound().build());
    }

    // PRECEPTOR/ADMIN: revisar (aprovar/reprovar) justificativa PENDING de um aluno
    @PostMapping("/justify/review")
    public ResponseEntity<?> reviewJustification(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                 @RequestBody Map<String, String> body) {
        User me = currentUser(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Sem permissão"));
        }
        try {
            Long alunoId = Long.valueOf(body.getOrDefault("alunoId", "0"));
            String dateStr = body.get("date");
            String action = String.valueOf(body.get("action")).toUpperCase(); // APPROVED or REJECTED
            String note = body.getOrDefault("note", "");
            if (!"APPROVED".equals(action) && !"REJECTED".equals(action)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Ação inválida"));
            }
            User aluno = userRepo.findById(alunoId).orElseThrow();
            LocalDate date = LocalDate.parse(dateStr);
            InternshipJustification j = justRepo.findFirstByAlunoAndDate(aluno, date).orElse(null);
            if (j == null) return ResponseEntity.notFound().build();
            if (!"PENDING".equalsIgnoreCase(j.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Justificativa já revisada"));
            }
            // Verifica vínculo do preceptor com a disciplina da justificativa (ou disciplina atual do aluno como fallback)
            if (me.getRole() == Role.PRECEPTOR) {
                Discipline target = j.getDiscipline() != null ? j.getDiscipline() : aluno.getCurrentDiscipline();
                if (target != null) {
                    boolean belongs = discRepo.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(target.getId()));
                    if (!belongs) {
                        return ResponseEntity.status(403).body(Map.of("error", "Preceptor não vinculado à disciplina"));
                    }
                    if (j.getDiscipline() == null) j.setDiscipline(target);
                }
                // Se não há disciplina definida (nem na justificativa, nem no aluno), segue sem bloquear
            }
            j.setStatus(action);
            j.setReviewedBy(me);
            j.setReviewedAt(LocalDateTime.now());
            j.setReviewNote(note);
            justRepo.save(j);
            return ResponseEntity.ok(Map.of(
                    "id", j.getId(),
                    "date", j.getDate().toString(),
                    "status", j.getStatus(),
                    "reviewedBy", me.getId()
            ));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
