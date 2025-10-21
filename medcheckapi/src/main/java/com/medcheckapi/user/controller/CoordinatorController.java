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
    private final com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo;

    public CoordinatorController(UserRepository userRepository, DisciplineRepository disciplineRepository, CheckSessionRepository checkSessionRepository, com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo) {
        this.userRepository = userRepository;
        this.disciplineRepository = disciplineRepository;
        this.checkSessionRepository = checkSessionRepository;
        this.coordEvalRepo = coordEvalRepo;
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

    // Lista todos os coordenadores disponíveis para vínculo
    @GetMapping("/coordenadores")
    public ResponseEntity<?> listCoordinators(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        ensureCoordinatorOrAdmin(principal);
        List<Map<String, Object>> list = userRepository.findByRole(Role.COORDENADOR).stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("cpf", c.getCpf());
            m.put("email", c.getInstitutionalEmail());
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

    @GetMapping("/disciplinas/{id}/coordenadores")
    public ResponseEntity<?> listDisciplineCoordinators(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                        @PathVariable Long id) {
        ensureCoordinatorOrAdmin(principal);
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        List<Map<String, Object>> list = d.getCoordinators().stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("cpf", c.getCpf());
            m.put("email", c.getInstitutionalEmail());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    // Student info for coordinator (used to fill 'Nome do(a) Interno(a)' on report)
    @GetMapping("/student-info")
    public ResponseEntity<?> studentInfo(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                         @RequestParam("alunoId") Long alunoId,
                                         @RequestParam(value = "disciplineId", required = false) Long disciplineId) {
        ensureCoordinatorOrAdmin(principal);
        User me = userRepository.findByCpf(principal.getUsername()).orElseThrow();
        User aluno = userRepository.findById(alunoId).orElse(null);
        if (aluno == null) return ResponseEntity.notFound().build();
        Discipline discipline = null;
        if (disciplineId != null) {
            discipline = disciplineRepository.findById(disciplineId).orElse(null);
            if (discipline != null && me.getRole() == Role.COORDENADOR) {
                final Long dId = discipline.getId();
                boolean linked = disciplineRepository.findByCoordinators_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                if (!linked) return ResponseEntity.status(403).body(Map.of("error","Coordenador não vinculado à disciplina"));
            }
        }
        Map<String,Object> resp = new HashMap<>();
        resp.put("alunoId", aluno.getId());
        resp.put("name", aluno.getName());
        resp.put("cpf", aluno.getCpf());
        if (discipline != null) {
            resp.put("discipline", Map.of(
                    "id", discipline.getId(),
                    "code", discipline.getCode(),
                    "name", discipline.getName()
            ));
        }
        return ResponseEntity.ok(resp);
    }

    public static class LinkRequest { public Long preceptorId; }

    public static class LinkCoordinatorRequest { public Long coordinatorId; }

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

    @PostMapping("/disciplinas/{id}/coordenadores")
    public ResponseEntity<?> linkCoordinator(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                             @PathVariable Long id,
                                             @RequestBody LinkCoordinatorRequest req) {
        ensureCoordinatorOrAdmin(principal);
        if (req == null || req.coordinatorId == null) return ResponseEntity.badRequest().body(Map.of("error", "coordinatorId obrigatório"));
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        User c = userRepository.findById(req.coordinatorId).orElseThrow();
        if (c.getRole() != Role.COORDENADOR) return ResponseEntity.badRequest().body(Map.of("error", "Usuário não é COORDENADOR"));
        d.getCoordinators().add(c);
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

    @DeleteMapping("/disciplinas/{id}/coordenadores/{coordinatorId}")
    public ResponseEntity<?> unlinkCoordinator(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                               @PathVariable Long id,
                                               @PathVariable Long coordinatorId) {
        ensureCoordinatorOrAdmin(principal);
        Discipline d = disciplineRepository.findById(id).orElseThrow();
        boolean removed = d.getCoordinators().removeIf(u -> Objects.equals(u.getId(), coordinatorId));
        if (!removed) return ResponseEntity.notFound().build();
        disciplineRepository.save(d);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Coordenador lança avaliação final da disciplina (nota e comentário)
    public static class FinalEvaluationRequest { public Long alunoId; public Long disciplineId; public Integer score; public String comment; }

    @PostMapping("/evaluate-final")
    public ResponseEntity<?> evaluateFinal(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                           @RequestBody FinalEvaluationRequest req) {
        ensureCoordinatorOrAdmin(principal);
        try {
            if (req == null || req.alunoId == null || req.disciplineId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "alunoId e disciplineId obrigatórios"));
            }
            if (req.score != null && (req.score < 0 || req.score > 10)) {
                return ResponseEntity.badRequest().body(Map.of("error", "score fora de faixa"));
            }
            User me = userRepository.findByCpf(principal.getUsername()).orElseThrow();
            User aluno = userRepository.findById(req.alunoId).orElseThrow();
            Discipline disc = disciplineRepository.findById(req.disciplineId).orElseThrow();
            // Coordenador deve estar vinculado à disciplina (a menos que seja ADMIN)
            if (me.getRole() == Role.COORDENADOR) {
                boolean linked = disciplineRepository.findByCoordinators_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(disc.getId()));
                if (!linked) return ResponseEntity.status(403).body(Map.of("error", "Coordenador não vinculado à disciplina"));
            }
            var ev = coordEvalRepo.findFirstByAlunoAndDiscipline(aluno, disc).orElse(new com.medcheckapi.user.model.CoordinatorEvaluation());
            ev.setAluno(aluno);
            ev.setDiscipline(disc);
            ev.setCoordinator(me);
            ev.setScore(req.score);
            ev.setComment(req.comment);
            ev.setUpdatedAt(java.time.LocalDateTime.now());
            coordEvalRepo.save(ev);
            return ResponseEntity.ok(Map.of(
                "id", ev.getId(),
                "alunoId", aluno.getId(),
                "disciplineId", disc.getId(),
                "coordinatorId", me.getId(),
                "score", ev.getScore(),
                "comment", ev.getComment()
            ));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // Recupera a avaliação final do coordenador (se existir) para um aluno+disciplina
    @GetMapping("/evaluate-final")
    public ResponseEntity<?> getFinalEvaluation(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                @RequestParam("alunoId") Long alunoId,
                                                @RequestParam("disciplineId") Long disciplineId) {
        ensureCoordinatorOrAdmin(principal);
        try {
            User me = userRepository.findByCpf(principal.getUsername()).orElseThrow();
            User aluno = userRepository.findById(alunoId).orElseThrow();
            Discipline disc = disciplineRepository.findById(disciplineId).orElseThrow();
            if (me.getRole() == Role.COORDENADOR) {
                boolean linked = disciplineRepository.findByCoordinators_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(disc.getId()));
                if (!linked) return ResponseEntity.status(403).body(Map.of("error", "Coordenador não vinculado à disciplina"));
            }
            var opt = coordEvalRepo.findFirstByAlunoAndDiscipline(aluno, disc);
            if (opt.isEmpty()) return ResponseEntity.ok(Map.of("found", false));
            var ev = opt.get();
            return ResponseEntity.ok(Map.of(
                "found", true,
                "id", ev.getId(),
                "alunoId", aluno.getId(),
                "disciplineId", disc.getId(),
                "coordinatorId", ev.getCoordinator() != null ? ev.getCoordinator().getId() : null,
                "score", ev.getScore(),
                "comment", ev.getComment()
            ));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    // Exclui a avaliação final do coordenador (reabre a edição do calendário por ausência de avaliação final)
    @DeleteMapping("/evaluate-final")
    public ResponseEntity<?> deleteFinalEvaluation(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                   @RequestParam("alunoId") Long alunoId,
                                                   @RequestParam("disciplineId") Long disciplineId) {
        ensureCoordinatorOrAdmin(principal);
        try {
            User me = userRepository.findByCpf(principal.getUsername()).orElseThrow();
            User aluno = userRepository.findById(alunoId).orElseThrow();
            Discipline disc = disciplineRepository.findById(disciplineId).orElseThrow();
            if (me.getRole() == Role.COORDENADOR) {
                boolean linked = disciplineRepository.findByCoordinators_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(disc.getId()));
                if (!linked) return ResponseEntity.status(403).body(Map.of("error", "Coordenador não vinculado à disciplina"));
            }
            var opt = coordEvalRepo.findFirstByAlunoAndDiscipline(aluno, disc);
            if (opt.isEmpty()) return ResponseEntity.notFound().build();
            coordEvalRepo.delete(opt.get());
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
