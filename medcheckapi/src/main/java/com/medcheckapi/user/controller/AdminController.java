package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.repository.CheckSessionRepository;
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
    private final CheckSessionRepository checkSessionRepository;

    public AdminController(UserRepository userRepository, DisciplineRepository disciplineRepository, CheckSessionRepository checkSessionRepository) {
        this.userRepository = userRepository;
        this.disciplineRepository = disciplineRepository;
        this.checkSessionRepository = checkSessionRepository;
    }

    private void ensureAdmin(org.springframework.security.core.userdetails.User principal) {
        User u = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        if (u.getRole() != Role.ADMIN) {
            throw new org.springframework.security.access.AccessDeniedException("Forbidden");
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> listUsers(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                       @RequestParam(value = "disciplineId", required = false) Long disciplineId,
                                       @RequestParam(value = "q", required = false) String q,
                                       @RequestParam(value = "page", defaultValue = "0") int page,
                                       @RequestParam(value = "size", defaultValue = "50") int size,
                                       @RequestParam(value = "fName", required = false, defaultValue = "true") boolean fName,
                                       @RequestParam(value = "fPhone", required = false, defaultValue = "true") boolean fPhone,
                                       @RequestParam(value = "fEmail", required = false, defaultValue = "true") boolean fEmail,
                                       @RequestParam(value = "fCpf", required = false, defaultValue = "true") boolean fCpf) {
        ensureAdmin(principal);
        if (page < 0) page = 0; if (size < 1) size = 1; if (size > 200) size = 200;
        String qNorm = q != null ? q.trim().toLowerCase() : null;
        // Carrega todos (dataset geralmente pequeno). Se crescer muito, migrar para consulta paginada.
        List<User> base = userRepository.findAll();
        // Filtro por disciplina (considera currentDiscipline do aluno e coleções de vinculo para preceptor/coordenador)
        if (disciplineId != null) {
            final Long dId = disciplineId;
            // Carrega disciplina alvo (para evitar N+1 acesso, simples pois 1 disciplina)
            var discOpt = disciplineRepository.findById(dId);
            if (discOpt.isPresent()) {
                var disc = discOpt.get();
                var preceptorIds = disc.getPreceptors().stream().map(User::getId).collect(Collectors.toSet());
                var coordIds = disc.getCoordinators().stream().map(User::getId).collect(Collectors.toSet());
                base = base.stream().filter(u -> {
                    if (u.getCurrentDiscipline() != null && u.getCurrentDiscipline().getId().equals(dId)) return true; // aluno atual
                    if (preceptorIds.contains(u.getId())) return true;
                    if (coordIds.contains(u.getId())) return true;
                    return false;
                }).collect(Collectors.toList());
            } else {
                // disciplina inexistente => lista vazia
                base = java.util.Collections.emptyList();
            }
        }
        // Filtro de busca (campos selecionáveis: nome, email, cpf, phone)
        if (qNorm != null && !qNorm.isEmpty()) {
            String qDigits = qNorm.replaceAll("\\D", "");
            boolean anyField = fName || fPhone || fEmail || fCpf; // se cliente antigo não enviar flags, todos true
            boolean selName = anyField ? fName : true;
            boolean selPhone = anyField ? fPhone : true;
            boolean selEmail = anyField ? fEmail : true;
            boolean selCpf = anyField ? fCpf : true;
            base = base.stream().filter(u -> {
                boolean match = false;
                if (selName && u.getName() != null && u.getName().toLowerCase().contains(qNorm)) match = true;
                if (!match && selEmail && u.getInstitutionalEmail() != null && u.getInstitutionalEmail().toLowerCase().contains(qNorm)) match = true;
                if (!match && selCpf) {
                    String cpfDigits = u.getCpf() != null ? u.getCpf().replaceAll("\\D", "") : "";
                    if (!qDigits.isEmpty() && cpfDigits.contains(qDigits)) match = true;
                }
                if (!match && selPhone) {
                    String phoneDigits = u.getPhone() != null ? u.getPhone().replaceAll("\\D", "") : "";
                    if (!qDigits.isEmpty() && phoneDigits.contains(qDigits)) match = true;
                }
                return match;
            }).collect(Collectors.toList());
        }
        int total = base.size();
        int from = Math.min(page * size, total);
        int to = Math.min(from + size, total);
        List<Map<String, Object>> items = base.subList(from, to).stream().map(u -> {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", u.getId());
            m.put("name", u.getName());
            m.put("cpf", u.getCpf());
            m.put("email", u.getInstitutionalEmail());
            m.put("phone", u.getPhone());
            m.put("matricula", u.getMatricula());
            m.put("role", u.getRole().name());
            if (u.getCurrentDiscipline() != null) {
                m.put("currentDiscipline", Map.of(
                        "id", u.getCurrentDiscipline().getId(),
                        "code", u.getCurrentDiscipline().getCode(),
                        "name", u.getCurrentDiscipline().getName()
                ));
            }
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of(
                "items", items,
                "page", page,
                "size", size,
                "totalItems", total,
                "totalPages", (int) Math.ceil(total / (double) size)
        ));
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

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                        @PathVariable Long id,
                                        @RequestBody Map<String, Object> body) {
        ensureAdmin(principal);
        User u = userRepository.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        // Campos editáveis
        if (body.containsKey("name")) u.setName((String) body.get("name"));
        if (body.containsKey("cpf")) {
            String cpf = (String) body.get("cpf");
            if (cpf != null) u.setCpf(cpf);
        }
        if (body.containsKey("email")) u.setInstitutionalEmail((String) body.get("email"));
        if (body.containsKey("phone")) u.setPhone((String) body.get("phone"));
        if (body.containsKey("matricula")) u.setMatricula((String) body.get("matricula"));
        if (body.containsKey("naturalidade")) u.setNaturalidade((String) body.get("naturalidade"));
        if (body.containsKey("nacionalidade")) u.setNacionalidade((String) body.get("nacionalidade"));
        if (body.containsKey("birthDate")) {
            // birthDate esperado formato yyyy-MM-dd
            Object bd = body.get("birthDate");
            if (bd instanceof String s && !s.isBlank()) {
                try {
                    java.time.LocalDate ld = java.time.LocalDate.parse(s);
                    u.setBirthDate(java.sql.Date.valueOf(ld));
                } catch (Exception ignored) { }
            } else if (bd == null) {
                u.setBirthDate(null);
            }
        }
        if (body.containsKey("role")) {
            try { u.setRole(Role.valueOf(String.valueOf(body.get("role")))); } catch (Exception ignored) {}
        }
        if (body.containsKey("currentDisciplineId")) {
            Object val = body.get("currentDisciplineId");
            if (val == null) {
                u.setCurrentDiscipline(null);
            } else {
                try {
                    Long did = Long.valueOf(String.valueOf(val));
                    var disc = disciplineRepository.findById(did).orElse(null);
                    if (disc != null) u.setCurrentDiscipline(disc);
                } catch (Exception ignored) { }
            }
        }
        userRepository.save(u);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUser(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                     @PathVariable Long id) {
        ensureAdmin(principal);
        User u = userRepository.findById(id).orElse(null);
        if (u == null) return ResponseEntity.notFound().build();
        Map<String,Object> m = new java.util.LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("cpf", u.getCpf());
        m.put("email", u.getInstitutionalEmail());
        m.put("phone", u.getPhone());
        m.put("matricula", u.getMatricula());
        m.put("birthDate", u.getBirthDate() == null ? null : new java.text.SimpleDateFormat("yyyy-MM-dd").format(u.getBirthDate()));
        m.put("naturalidade", u.getNaturalidade());
        m.put("nacionalidade", u.getNacionalidade());
        m.put("role", u.getRole().name());
        return ResponseEntity.ok(m);
    }

    @GetMapping("/disciplines")
    public ResponseEntity<?> listDisciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureAdmin(principal);
        return ResponseEntity.ok(disciplineRepository.findAll());
    }

    // Lista alunos para a home unificada do ADMIN (sem limitar a um preceptor)
    @GetMapping("/students")
    public ResponseEntity<?> listStudents(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                          @RequestParam(required = false) Integer year,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "8") int size,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(required = false, defaultValue = "true") boolean fName,
                                          @RequestParam(required = false, defaultValue = "true") boolean fPhone,
                                          @RequestParam(required = false, defaultValue = "true") boolean fEmail,
                                          @RequestParam(required = false, defaultValue = "true") boolean fCpf,
                                          @RequestParam(required = false, defaultValue = "true") boolean statusIn,
                                          @RequestParam(required = false, defaultValue = "true") boolean statusOut,
                                          @RequestParam(required = false) Long disciplineId) {
        ensureAdmin(principal);
        int y = (year != null ? year : java.time.LocalDate.now().getYear());
        java.time.LocalDateTime start = java.time.LocalDateTime.of(java.time.LocalDate.of(y,1,1), java.time.LocalTime.MIN);
        java.time.LocalDateTime end = java.time.LocalDateTime.of(java.time.LocalDate.of(y,12,31), java.time.LocalTime.MAX);
        if (page < 0) page = 0; if (size < 1) size = 1; if (size > 50) size = 50;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        String qNorm = q != null && !q.isBlank() ? q.trim().toLowerCase() : null;
        String qDigits = qNorm != null ? qNorm.replaceAll("\\D", "") : null;
        boolean anyField = fName || fPhone || fEmail || fCpf;
        boolean selName = anyField ? fName : true;
        boolean selPhone = anyField ? fPhone : true;
        boolean selEmail = anyField ? fEmail : true;
        boolean selCpf = anyField ? fCpf : true;
        boolean statusAll = statusIn && statusOut;

        org.springframework.data.domain.Page<User> alunosPage;
        if (disciplineId != null) {
            var disc = disciplineRepository.findById(disciplineId).orElse(null);
            if (disc == null) {
                alunosPage = org.springframework.data.domain.Page.empty(pageable);
            } else {
                alunosPage = checkSessionRepository.findDistinctAlunosByDisciplineAnyPreceptor(
                        disc, start, end, qNorm, qDigits,
                        selName, selEmail, selCpf, selPhone,
                        statusAll, statusIn, statusOut,
                        pageable
                );
            }
        } else {
            alunosPage = checkSessionRepository.findDistinctAlunosGlobalByPeriodAdvanced(
                    start, end, qNorm, qDigits,
                    selName, selEmail, selCpf, selPhone,
                    statusAll, statusIn, statusOut,
                    pageable
            );
        }
        java.util.List<java.util.Map<String,Object>> items = alunosPage.getContent().stream().map(a -> {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("id", a.getId());
            m.put("name", a.getName());
            m.put("cpf", a.getCpf());
            m.put("phone", a.getPhone());
            m.put("email", a.getInstitutionalEmail());
            // Em serviço global: qualquer sessão aberta (sem limitar preceptor)
            boolean inService = checkSessionRepository.existsByAlunoAndCheckOutTimeIsNull(a);
            m.put("inService", inService);
            return m;
        }).toList();
        return ResponseEntity.ok(java.util.Map.of(
                "items", items,
                "page", alunosPage.getNumber(),
                "size", alunosPage.getSize(),
                "totalPages", alunosPage.getTotalPages(),
                "totalItems", alunosPage.getTotalElements()
        ));
    }
}
