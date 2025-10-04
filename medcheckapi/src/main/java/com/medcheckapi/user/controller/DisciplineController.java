package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.DisciplineRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Generic discipline endpoints not tied to a specific role context.
 * Exposes a lightweight discipline detail so the frontend can display
 * code, name and preceptor list (for headers, presence sheet, etc.).
 */
@RestController
@RequestMapping("/api/disciplines")
public class DisciplineController {

    private final DisciplineRepository disciplineRepository;

    public DisciplineController(DisciplineRepository disciplineRepository) {
        this.disciplineRepository = disciplineRepository;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOne(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                    @PathVariable("id") Long id) {
        // Apenas autenticação já é suficiente aqui; não há dado sensível
        Discipline d = disciplineRepository.findById(id).orElse(null);
        if (d == null) return ResponseEntity.notFound().build();
        Map<String,Object> resp = new HashMap<>();
        resp.put("id", d.getId());
        resp.put("code", d.getCode());
        resp.put("name", d.getName());
        resp.put("hours", d.getHours());
        resp.put("ciclo", d.getCiclo());
        // Preceptors: expose only id & name to keep payload small
        List<Map<String,Object>> pres = d.getPreceptors().stream().map(p -> {
            Map<String,Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("name", p.getName());
            return m;
        }).toList();
        resp.put("preceptors", pres);
        return ResponseEntity.ok(resp);
    }
}
