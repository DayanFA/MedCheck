package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.CheckSessionRepository;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preceptor")
public class PreceptorController {

    private final UserRepository userRepository;
    private final CheckSessionRepository checkSessionRepository;

    public PreceptorController(UserRepository userRepository, CheckSessionRepository checkSessionRepository) {
        this.userRepository = userRepository;
        this.checkSessionRepository = checkSessionRepository;
    }

    private User me(org.springframework.security.core.userdetails.User principal) {
        return userRepository.findByCpf(principal.getUsername()).orElseThrow();
    }

    // List students (alunos) that had any check-in with this preceptor within a given year
    @GetMapping("/students")
    public ResponseEntity<?> students(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                      @RequestParam(required = false) Integer year,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "8") int size,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(required = false, defaultValue = "true") boolean fName,
                                      @RequestParam(required = false, defaultValue = "true") boolean fPhone,
                                      @RequestParam(required = false, defaultValue = "true") boolean fEmail,
                                      @RequestParam(required = false, defaultValue = "true") boolean fCpf,
                                      @RequestParam(required = false, defaultValue = "true") boolean statusIn,
                                      @RequestParam(required = false, defaultValue = "true") boolean statusOut) {
        User preceptor = me(principal);
        if (preceptor.getRole() != Role.PRECEPTOR && preceptor.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        int y = (year != null ? year : LocalDate.now().getYear());
        LocalDateTime start = LocalDateTime.of(LocalDate.of(y, 1, 1), LocalTime.MIN);
        LocalDateTime end = LocalDateTime.of(LocalDate.of(y, 12, 31), LocalTime.MAX);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 50)));

        Page<User> alunosPage;
        String qNorm = q != null ? q.trim() : null;
        String qDigits = qNorm != null ? qNorm.replaceAll("\\D", "") : null;
        boolean statusAll = statusIn && statusOut;
        // Se nenhum campo selecionado, assume todos
        boolean anyField = fName || fPhone || fEmail || fCpf;
        boolean selName = anyField ? fName : true;
        boolean selPhone = anyField ? fPhone : true;
        boolean selEmail = anyField ? fEmail : true;
        boolean selCpf = anyField ? fCpf : true;

        alunosPage = checkSessionRepository.findDistinctAlunosByPreceptorAndPeriodAdvanced(
                preceptor, start, end,
                qNorm, qDigits,
                selName, selEmail, selCpf, selPhone,
                statusAll, statusIn, statusOut,
                pageable);
        List<Map<String,Object>> items = alunosPage.getContent().stream().map(a -> {
            Map<String,Object> m = new HashMap<>();
            m.put("id", a.getId());
            m.put("name", a.getName());
            m.put("cpf", a.getCpf());
            m.put("phone", a.getPhone());
            m.put("email", a.getInstitutionalEmail());
            boolean inService = checkSessionRepository.existsByAlunoAndPreceptorAndCheckOutTimeIsNull(a, preceptor);
            m.put("inService", inService);
            return m;
        }).collect(Collectors.toList());

        Map<String,Object> resp = new HashMap<>();
        resp.put("items", items);
        resp.put("page", alunosPage.getNumber());
        resp.put("size", alunosPage.getSize());
        resp.put("totalPages", alunosPage.getTotalPages());
        resp.put("totalItems", alunosPage.getTotalElements());
        return ResponseEntity.ok(resp);
    }
}
