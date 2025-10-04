package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.repository.CheckSessionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final CheckSessionRepository checkSessionRepository;

    public CoordinatorController(UserRepository userRepository, DisciplineRepository disciplineRepository, CheckSessionRepository checkSessionRepository) {
        this.userRepository = userRepository;
        this.disciplineRepository = disciplineRepository;
        this.checkSessionRepository = checkSessionRepository;
    }

    private void ensureCoordinatorOrAdmin(org.springframework.security.core.userdetails.User principal) {
        User u = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        if (!(u.getRole() == Role.COORDENADOR || u.getRole() == Role.ADMIN)) {
            throw new org.springframework.security.access.AccessDeniedException("Forbidden");
        }
    }

    // Lista alunos que tiveram ao menos um check-in (sessão) na disciplina em um ano
    @GetMapping("/disciplinas/{id}/alunos")
    public ResponseEntity<?> listDisciplineStudents(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                    @PathVariable Long id,
                                                    @RequestParam(required = false) String year,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "8") int size,
                                                    @RequestParam(required = false) String q,
                                                    @RequestParam(required = false, defaultValue = "true") boolean fName,
                                                    @RequestParam(required = false, defaultValue = "true") boolean fPhone,
                                                    @RequestParam(required = false, defaultValue = "true") boolean fEmail,
                                                    @RequestParam(required = false, defaultValue = "true") boolean fCpf,
                                                    @RequestParam(required = false) Long preceptorId,
                                                    @RequestParam(required = false, defaultValue = "lastCheckIn,desc") String sort,
                                                    @RequestParam(required = false, defaultValue = "true") boolean statusIn,
                                                    @RequestParam(required = false, defaultValue = "true") boolean statusOut) {
        ensureCoordinatorOrAdmin(principal);
        Discipline disc = disciplineRepository.findById(id).orElse(null);
        if (disc == null) return ResponseEntity.notFound().build();
        boolean allYears = year != null && ("all".equalsIgnoreCase(year) || "*".equals(year));
        Integer yearNum = null;
        if (!allYears && year != null) {
            try { yearNum = Integer.parseInt(year); } catch (NumberFormatException ignored) { allYears = true; }
        }
        if (allYears) {
            // Abrange todo o histórico (2000 até agora)
            // (Se necessário futuramente otimizar com subqueries adicionais)
        }
        int effectiveYear = (yearNum != null ? yearNum : LocalDate.now().getYear());
        LocalDateTime start = allYears ? LocalDateTime.of(2000,1,1,0,0) : LocalDateTime.of(LocalDate.of(effectiveYear,1,1), LocalTime.MIN);
        LocalDateTime end = allYears ? LocalDateTime.now().plusDays(1) : LocalDateTime.of(LocalDate.of(effectiveYear,12,31), LocalTime.MAX);
    // Interpreta ordenação (campos permitidos: lastCheckIn, name, totalHours)
    String[] sortParts = sort != null ? sort.split(",") : new String[]{"lastCheckIn","desc"};
    String sortField = sortParts.length > 0 ? sortParts[0].trim() : "lastCheckIn";
    String sortDir = sortParts.length > 1 ? sortParts[1].trim().toLowerCase() : "desc";
    if (!List.of("lastCheckIn","name","totalHours").contains(sortField)) sortField = "lastCheckIn";
    if (!List.of("asc","desc").contains(sortDir)) sortDir = "desc";
    Pageable pageable = PageRequest.of(Math.max(0,page), Math.max(1, Math.min(size,50)));
        String qNorm = q != null ? q.trim() : null;
        String qDigits = qNorm != null ? qNorm.replaceAll("\\D", "") : null;
        boolean anyField = fName || fPhone || fEmail || fCpf;
        boolean selName = anyField ? fName : true;
        boolean selPhone = anyField ? fPhone : true;
        boolean selEmail = anyField ? fEmail : true;
        boolean selCpf = anyField ? fCpf : true;
        boolean statusAll = statusIn && statusOut;
    // Primeiro obtemos agregados básicos para o ano solicitado (ou ano corrente se não veio). Se não vierem resultados
    // e o cliente NÃO especificou explicitamente um ano, fazemos fallback para "todos os anos" para mostrar histórico.
    boolean explicitYear = (year != null && !allYears);
    Page<Object[]> rawPage = checkSessionRepository.aggregateByDiscipline(
        disc, start, end, preceptorId,
        qNorm, qDigits, selName, selEmail, selCpf, selPhone, pageable);

    // Novo critério: se não veio nada e não estamos em modo allYears, fazemos fallback mesmo que um ano tenha sido enviado
    if (!allYears && rawPage.getTotalElements() == 0) {
        // Fallback abrangendo todo o histórico conhecido (desde 2000 até agora) para não retornar lista vazia ao coordenador.
        LocalDateTime fallbackStart = LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime fallbackEnd = LocalDateTime.now().plusDays(1); // inclui hoje
        rawPage = checkSessionRepository.aggregateByDiscipline(
            disc, fallbackStart, fallbackEnd, preceptorId,
            qNorm, qDigits, selName, selEmail, selCpf, selPhone, pageable);
    }

        // Transformar em lista de mapas enriquecida
        List<Map<String,Object>> items = new ArrayList<>();
        for (Object[] row : rawPage.getContent()) {
            User aluno = (User) row[0];
            Number totalSeconds = (Number) row[1];
            LocalDateTime lastCheckIn = (LocalDateTime) row[2];
            Number preceptorCount = (Number) row[3];
            Map<String,Object> m = new HashMap<>();
            m.put("id", aluno.getId());
            m.put("name", aluno.getName());
            m.put("cpf", aluno.getCpf());
            m.put("phone", aluno.getPhone());
            m.put("email", aluno.getInstitutionalEmail());
            long hours = totalSeconds != null ? Math.round(totalSeconds.longValue() / 3600.0) : 0L;
            m.put("totalHours", hours);
            m.put("lastCheckIn", lastCheckIn);
            m.put("preceptorCount", preceptorCount != null ? preceptorCount.intValue() : 0);
            boolean inService = checkSessionRepository.existsByAlunoAndDisciplineAndCheckOutTimeIsNull(aluno, disc);
            m.put("inService", inService);
            // Lista curta de nomes de preceptores (até 3) + "+n" se mais
            List<User> pres = checkSessionRepository.findDistinctPreceptorsForAlunoInDisciplinePeriod(disc, aluno, start, end);
            List<String> presNames = pres.stream().map(User::getName).sorted().toList();
            if (presNames.size() > 3) {
                List<String> head = presNames.subList(0,3);
                head = new ArrayList<>(head);
                head.add("+" + (presNames.size()-3));
                m.put("preceptores", head);
            } else {
                m.put("preceptores", presNames);
            }
            items.add(m);
        }

        // Ordenação em memória (pós paginação base) — para precisão ideal usar Sort na query agregada; mantemos simples.
        Comparator<Map<String,Object>> comparator;
        switch (sortField) {
            case "name" -> comparator = Comparator.comparing(m -> (String) m.get("name"), String.CASE_INSENSITIVE_ORDER);
            case "totalHours" -> comparator = Comparator.comparingLong(m -> ((Number) m.getOrDefault("totalHours",0)).longValue());
            default -> comparator = Comparator.comparing(m -> (LocalDateTime) m.get("lastCheckIn"), Comparator.nullsLast(LocalDateTime::compareTo));
        }
        if ("desc".equals(sortDir)) comparator = comparator.reversed();
        items.sort(comparator);

        Map<String,Object> resp = new HashMap<>();
        resp.put("items", items);
        resp.put("page", rawPage.getNumber());
        resp.put("size", rawPage.getSize());
        resp.put("totalPages", rawPage.getTotalPages());
        resp.put("totalItems", rawPage.getTotalElements());
        return ResponseEntity.ok(resp);
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
        User me = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        // ADMIN vê todas; COORDENADOR vê apenas as vinculadas a ele. Se não houver vínculo retorna lista vazia.
        if (me.getRole() == Role.ADMIN) {
            return ResponseEntity.ok(disciplineRepository.findAll());
        }
        return ResponseEntity.ok(disciplineRepository.findByCoordinators_Id(me.getId()));
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
