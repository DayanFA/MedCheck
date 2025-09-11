package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.service.CheckInService;
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

    public CheckInController(CheckInService checkInService, UserRepository userRepository) {
        this.checkInService = checkInService; this.userRepository = userRepository; }

    private User currentUser(org.springframework.security.core.userdetails.User principal) {
        return userRepository.findByCpf(principal.getUsername()).orElseThrow();
    }

    // PRECEPTOR: get current rotating code (creates new if expired)
    @GetMapping("/code")
    public ResponseEntity<?> currentCode(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        return ResponseEntity.ok(checkInService.getOrCreateCurrentCode(me.getId()));
    }

    // ALUNO: perform check-in using code and preceptor id
    @PostMapping("/in")
    public ResponseEntity<?> checkIn(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                     @RequestBody Map<String,String> body) {
        User me = currentUser(principal);
        Long preceptorId = Long.valueOf(body.getOrDefault("preceptorId", "0"));
        String code = body.getOrDefault("code", "");
        try {
            return ResponseEntity.ok(checkInService.performCheckIn(me.getId(), preceptorId, code));
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
                                      @RequestParam String start, @RequestParam String end) {
        User me = currentUser(principal);
        LocalDate s = LocalDate.parse(start);
        LocalDate e = LocalDate.parse(end);
        return ResponseEntity.ok(checkInService.listSessionsForAluno(me.getId(), s, e));
    }

    // ALUNO: status (open or not + worked seconds today)
    @GetMapping("/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = currentUser(principal);
        return ResponseEntity.ok(checkInService.statusForAluno(me.getId()));
    }
}
