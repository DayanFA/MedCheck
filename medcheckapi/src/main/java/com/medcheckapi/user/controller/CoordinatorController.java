package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/coord")
public class CoordinatorController {
    private final UserRepository userRepository;
    private final DisciplineRepository disciplineRepository;

    public CoordinatorController(UserRepository userRepository, DisciplineRepository disciplineRepository) {
        this.userRepository = userRepository;
        this.disciplineRepository = disciplineRepository;
    }

    private void ensureCoordinatorOrAdmin(org.springframework.security.core.userdetails.User principal) {
        User u = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        if (!(u.getRole() == Role.COORDENADOR || u.getRole() == Role.ADMIN)) {
            throw new org.springframework.security.access.AccessDeniedException("Forbidden");
        }
    }

    @GetMapping("/preceptores")
    public ResponseEntity<?> listPreceptors(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureCoordinatorOrAdmin(principal);
        List<Map<String, Object>> list = userRepository.findByRole(Role.PRECEPTOR).stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("cpf", p.getCpf());
            m.put("email", p.getInstitutionalEmail());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/disciplinas")
    public ResponseEntity<?> listDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureCoordinatorOrAdmin(principal);
        return ResponseEntity.ok(disciplineRepository.findAll());
    }

    @GetMapping("/disciplinas/{id}/preceptores")
    public ResponseEntity<?> listDisciplinePreceptors(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                      @PathVariable Long id) {
        ensureCoordinatorOrAdmin(principal);
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        List<Map<String, Object>> list = d.getPreceptors().stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            m.put("cpf", p.getCpf());
            m.put("email", p.getInstitutionalEmail());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    public static class LinkRequest { public Long preceptorId; }

    @PostMapping("/disciplinas/{id}/preceptores")
    public ResponseEntity<?> linkPreceptor(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                           @PathVariable Long id,
                                           @RequestBody LinkRequest req) {
        ensureCoordinatorOrAdmin(principal);
        if (req == null || req.preceptorId == null) return ResponseEntity.badRequest().body(Map.of("error", "preceptorId obrigatório"));
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        User p = userRepository.findById(req.preceptorId).orElseThrow();
        if (p.getRole() != Role.PRECEPTOR) return ResponseEntity.badRequest().body(Map.of("error", "Usuário não é PRECEPTOR"));
        d.getPreceptors().add(p);
        disciplineRepository.save(d);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/disciplinas/{id}/preceptores/{preceptorId}")
    public ResponseEntity<?> unlinkPreceptor(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                             @PathVariable Long id,
                                             @PathVariable Long preceptorId) {
        ensureCoordinatorOrAdmin(principal);
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        boolean removed = d.getPreceptors().removeIf(u -> Objects.equals(u.getId(), preceptorId));
        if (!removed) return ResponseEntity.notFound().build();
        disciplineRepository.save(d);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
