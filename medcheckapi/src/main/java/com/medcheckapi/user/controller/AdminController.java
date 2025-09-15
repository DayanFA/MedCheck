package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.DisciplineRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final UserRepository userRepository;
    private final DisciplineRepository disciplineRepository;

    public AdminController(UserRepository userRepository, DisciplineRepository disciplineRepository) {
        this.userRepository = userRepository;
        this.disciplineRepository = disciplineRepository;
    }

    private void ensureAdmin(org.springframework.security.core.userdetails.User principal) {
        User u = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        if (u.getRole() != Role.ADMIN) {
            throw new org.springframework.security.access.AccessDeniedException("Forbidden");
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureAdmin(principal);
    List<Map<String, Object>> list = userRepository.findAll().stream().map(u -> {
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("cpf", u.getCpf());
        m.put("email", u.getInstitutionalEmail());
        m.put("role", u.getRole().name());
        return m;
    }).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> updateRole(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                        @PathVariable Long id,
                                        @RequestBody Map<String, String> body) {
        ensureAdmin(principal);
        String roleStr = body.getOrDefault("role", "");
        Role newRole;
        try { newRole = Role.valueOf(roleStr); } catch (Exception ex) { return ResponseEntity.badRequest().body(Map.of("error", "Role inválida")); }
        User u = userRepository.findById(id).orElseThrow();
        u.setRole(newRole);
        userRepository.save(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                        @PathVariable Long id) {
        ensureAdmin(principal);
        if (!userRepository.existsById(id)) return ResponseEntity.notFound().build();
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/disciplines")
    public ResponseEntity<?> listDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureAdmin(principal);
        return ResponseEntity.ok(disciplineRepository.findAll());
    }
}
