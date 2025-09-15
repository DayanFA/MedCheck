package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.*;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.InternshipPlanRepository;
import com.medcheckapi.user.repository.InternshipJustificationRepository;
import com.medcheckapi.user.service.CalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {
    private final UserRepository userRepo;
    private final CalendarService calendarService;
    private final InternshipPlanRepository planRepo;
    private final InternshipJustificationRepository justRepo;

    public CalendarController(UserRepository userRepo, CalendarService calendarService, InternshipPlanRepository planRepo, InternshipJustificationRepository justRepo) {
        this.userRepo = userRepo; this.calendarService = calendarService; this.planRepo = planRepo; this.justRepo = justRepo;
    }

    private User currentUser(org.springframework.security.core.userdetails.User principal) {
        return userRepo.findByCpf(principal.getUsername()).orElseThrow();
    }

    @GetMapping("/month")
    public ResponseEntity<?> month(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                   @RequestParam int year, @RequestParam int month) {
        User me = currentUser(principal);
        return ResponseEntity.ok(calendarService.monthView(me, year, month));
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
        InternshipPlan p = id == null ? new InternshipPlan() : planRepo.findById(id).orElse(new InternshipPlan());
        p.setAluno(me); p.setDate(date); p.setStartTime(start); p.setEndTime(end); p.setLocation(location); p.setNote(note);
        p = planRepo.save(p);
        return ResponseEntity.ok(Map.of("plan", Map.of(
                "id", p.getId(),
                "date", p.getDate().toString(),
                "startTime", p.getStartTime().toString(),
                "endTime", p.getEndTime().toString(),
                "location", p.getLocation(),
                "note", p.getNote(),
                "plannedSeconds", p.getPlannedSeconds()
        )));
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

    @PostMapping("/justify")
    public ResponseEntity<?> upsertJustification(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                 @RequestBody Map<String, String> body) {
        User me = currentUser(principal);
        LocalDate date = LocalDate.parse(body.get("date"));
        // Business rule: justification only allowed if there is at least one plan on that date
        if (planRepo.findByAlunoAndDate(me, date).isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Crie um plano para o dia antes de justificar"));
        }
        InternshipJustification j = justRepo.findFirstByAlunoAndDate(me, date).orElseGet(() -> {
            InternshipJustification nj = new InternshipJustification();
            nj.setAluno(me);
            nj.setDate(date);
            return nj;
        });
        if (body.containsKey("planId")) {
            try { Long pid = Long.valueOf(body.get("planId")); planRepo.findById(pid).ifPresent(j::setPlan);} catch (Exception ignored) { j.setPlan(null); }
        }
        j.setType(body.getOrDefault("type", "GENERAL"));
        j.setReason(body.getOrDefault("reason", ""));
        // always reset to PENDING on edit by aluno
        j.setStatus("PENDING");
        j = justRepo.save(j);
        return ResponseEntity.ok(Map.of(
                "id", j.getId(),
                "date", j.getDate().toString(),
                "type", j.getType(),
                "reason", j.getReason(),
                "status", j.getStatus(),
                "planId", j.getPlan() == null ? null : j.getPlan().getId()
        ));
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
}
