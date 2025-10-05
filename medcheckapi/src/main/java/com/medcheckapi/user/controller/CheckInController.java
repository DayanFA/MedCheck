package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.service.CheckInService;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.model.Discipline;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/check")
public class CheckInController {

    private final CheckInService checkInService;
    private final UserRepository userRepository;
    private final DisciplineRepository disciplineRepository;

    public CheckInController(CheckInService checkInService, UserRepository userRepository, DisciplineRepository disciplineRepository) {
        this.checkInService = checkInService; this.userRepository = userRepository; this.disciplineRepository = disciplineRepository; }

    private User currentUser(org.springframework.security.core.userdetails.User principal) {
        return userRepository.findByCpf(principal.getUsername()).orElseThrow();
    }

    // PRECEPTOR: get current rotating code (creates new if expired)
    @GetMapping("/code")
    public ResponseEntity<?> currentCode(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        return ResponseEntity.ok(checkInService.getOrCreateCurrentCode(me.getId()));
    }

    // ADMIN: visualizar código ativo de um preceptor específico (read-only, não gera novo)
    @GetMapping("/admin/preceptor/{id}/code")
    public ResponseEntity<?> adminViewPreceptorCode(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                    @PathVariable Long id) {
        User me = currentUser(principal);
        if (me.getRole() != com.medcheckapi.user.model.Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso restrito ao ADMIN"));
        }
        try {
            return ResponseEntity.ok(checkInService.getActiveCodeReadOnly(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ADMIN: listar disciplinas vinculadas a um preceptor
    @GetMapping("/admin/preceptor/{id}/disciplines")
    public ResponseEntity<?> adminViewPreceptorDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                           @PathVariable Long id) {
        User me = currentUser(principal);
        if (me.getRole() != com.medcheckapi.user.model.Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso restrito ao ADMIN"));
        }
        List<Discipline> list = disciplineRepository.findByPreceptors_Id(id);
        List<Map<String,Object>> dto = new ArrayList<>();
        for (Discipline d : list) {
            Map<String,Object> m = new HashMap<>();
            m.put("id", d.getId());
            m.put("code", d.getCode());
            m.put("name", d.getName());
            m.put("hours", d.getHours());
            m.put("ciclo", d.getCiclo());
            dto.add(m);
        }
        return ResponseEntity.ok(dto);
    }

    // PRECEPTOR: list disciplines linked to authenticated preceptor (via discipline_preceptors)
    @GetMapping("/my-disciplines")
    public ResponseEntity<?> myDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        List<Discipline> list = disciplineRepository.findByPreceptors_Id(me.getId());
        // Return minimal fields to avoid exposing preceptors set
        List<Map<String,Object>> dto = new ArrayList<>();
        for (Discipline d : list) {
            Map<String,Object> m = new HashMap<>();
            m.put("id", d.getId());
            m.put("code", d.getCode());
            m.put("name", d.getName());
            m.put("hours", d.getHours());
            m.put("ciclo", d.getCiclo());
            dto.add(m);
        }
        return ResponseEntity.ok(dto);
    }

    // ALUNO: perform check-in using code and preceptor id
    @PostMapping("/in")
    public ResponseEntity<?> checkIn(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                     @RequestBody Map<String,Object> body) {
        User me = currentUser(principal);
        Long preceptorId = Long.valueOf(String.valueOf(body.getOrDefault("preceptorId", "0")));
        String code = String.valueOf(body.getOrDefault("code", ""));
        Long disciplineId = null;
        if (body.containsKey("disciplineId")) {
            try { disciplineId = Long.valueOf(String.valueOf(body.get("disciplineId"))); } catch (Exception ignored) { disciplineId = null; }
        }
        Double lat = null, lng = null;
        try { if (body.get("lat") != null) lat = Double.valueOf(String.valueOf(body.get("lat"))); } catch (Exception ignored) {}
        try { if (body.get("lng") != null) lng = Double.valueOf(String.valueOf(body.get("lng"))); } catch (Exception ignored) {}
        try {
            System.out.println("[DEBUG] CheckInController /in aluno="+me.getId()+" preceptor="+preceptorId+" lat="+lat+" lng="+lng);
            return ResponseEntity.ok(checkInService.performCheckIn(me.getId(), preceptorId, code, disciplineId, lat, lng));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ALUNO: perform checkout of open session
    @PostMapping("/out")
    public ResponseEntity<?> checkOut(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                      @RequestBody(required = false) Map<String,Object> body) {
        User me = currentUser(principal);
        Double lat = null, lng = null;
        if (body != null) {
            try { if (body.get("lat") != null) lat = Double.valueOf(String.valueOf(body.get("lat"))); } catch (Exception ignored) {}
            try { if (body.get("lng") != null) lng = Double.valueOf(String.valueOf(body.get("lng"))); } catch (Exception ignored) {}
        }
        try {
            System.out.println("[DEBUG] CheckInController /out aluno="+me.getId()+" lat="+lat+" lng="+lng);
            return ResponseEntity.ok(checkInService.performCheckOut(me.getId(), lat, lng));
        } catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    // ALUNO: list sessions for date range (filters: 3Dias, 3Semanas, Tudo handled client side)
    @GetMapping("/sessions")
    public ResponseEntity<?> sessions(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                      @RequestParam String start, @RequestParam String end,
                                      @RequestParam(required = false) Long alunoId,
                                      @RequestParam(required = false) Long disciplineId,
                                      @RequestParam(required = false) Long preceptorId) {
        User me = currentUser(principal);
        LocalDate s = LocalDate.parse(start);
        LocalDate e = LocalDate.parse(end);
        Long targetId = me.getId();
        if (alunoId != null && (me.getRole() == com.medcheckapi.user.model.Role.PRECEPTOR || me.getRole() == com.medcheckapi.user.model.Role.ADMIN || me.getRole() == com.medcheckapi.user.model.Role.COORDENADOR)) {
            targetId = alunoId;
        }
        return ResponseEntity.ok(checkInService.listSessionsForAluno(targetId, s, e, disciplineId, preceptorId, me));
    }

    // ALUNO: status (open or not + worked seconds today)
    @GetMapping("/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        return ResponseEntity.ok(checkInService.statusForAluno(me.getId()));
    }
}
