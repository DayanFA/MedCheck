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
                                     @RequestBody Map<String,String> body) {
        User me = currentUser(principal);
        Long preceptorId = Long.valueOf(body.getOrDefault("preceptorId", "0"));
        String code = body.getOrDefault("code", "");
        Long disciplineId = null;
        if (body.containsKey("disciplineId")) {
            try { disciplineId = Long.valueOf(body.get("disciplineId")); } catch (Exception ignored) { disciplineId = null; }
        }
        try {
            return ResponseEntity.ok(checkInService.performCheckIn(me.getId(), preceptorId, code, disciplineId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ALUNO: perform checkout of open session
    @PostMapping("/out")
    public ResponseEntity<?> checkOut(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        try {
            return ResponseEntity.ok(checkInService.performCheckOut(me.getId()));
        } catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); }
    }

    // ALUNO: list sessions for date range (filters: 3Dias, 3Semanas, Tudo handled client side)
    @GetMapping("/sessions")
    public ResponseEntity<?> sessions(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                      @RequestParam String start, @RequestParam String end,
                                      @RequestParam(required = false) Long alunoId,
                                      @RequestParam(required = false) Long disciplineId) {
        User me = currentUser(principal);
        LocalDate s = LocalDate.parse(start);
        LocalDate e = LocalDate.parse(end);
        Long targetId = me.getId();
        if (alunoId != null && (me.getRole() == com.medcheckapi.user.model.Role.PRECEPTOR || me.getRole() == com.medcheckapi.user.model.Role.ADMIN)) {
            targetId = alunoId;
        }
        return ResponseEntity.ok(checkInService.listSessionsForAluno(targetId, s, e, disciplineId));
    }

    // ALUNO: status (open or not + worked seconds today)
    @GetMapping("/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        return ResponseEntity.ok(checkInService.statusForAluno(me.getId()));
    }
}
