package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.CheckSessionRepository;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.DisciplineRepository;
import com.medcheckapi.user.repository.PreceptorEvaluationRepository;
import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.model.PreceptorEvaluation;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preceptor")
public class PreceptorController {

    private final UserRepository userRepository;
    private final CheckSessionRepository checkSessionRepository;
    private final DisciplineRepository disciplineRepository;
    private final PreceptorEvaluationRepository evaluationRepository;
    private final com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo;

    public PreceptorController(UserRepository userRepository, CheckSessionRepository checkSessionRepository, DisciplineRepository disciplineRepository, PreceptorEvaluationRepository evaluationRepository, com.medcheckapi.user.repository.CoordinatorEvaluationRepository coordEvalRepo) {
        this.userRepository = userRepository;
        this.checkSessionRepository = checkSessionRepository;
        this.disciplineRepository = disciplineRepository;
        this.evaluationRepository = evaluationRepository;
        this.coordEvalRepo = coordEvalRepo;
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
                                      @RequestParam(required = false, defaultValue = "true") boolean statusOut,
                                      @RequestParam(required = false) Long disciplineId) {
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

        if (disciplineId != null) {
            Discipline disc = disciplineRepository.findById(disciplineId).orElse(null);
            if (disc == null) {
                alunosPage = Page.empty(pageable);
            } else {
                // Se preceptor (não ADMIN) precisa estar vinculado à disciplina escolhida
                if (preceptor.getRole() == Role.PRECEPTOR) {
                    boolean linked = disciplineRepository.findByPreceptors_Id(preceptor.getId()).stream().anyMatch(d -> d.getId().equals(disc.getId()));
                    if (!linked) {
                        return ResponseEntity.status(403).body(Map.of("error", "Preceptor não vinculado à disciplina informada"));
                    }
                }
                alunosPage = checkSessionRepository.findDistinctAlunosByPreceptorAndDisciplineAndPeriodAdvanced(
                        preceptor, disc, start, end,
                        qNorm, qDigits,
                        selName, selEmail, selCpf, selPhone,
                        statusAll, statusIn, statusOut,
                        pageable);
            }
        } else {
            alunosPage = checkSessionRepository.findDistinctAlunosByPreceptorAndPeriodAdvanced(
                    preceptor, start, end,
                    qNorm, qDigits,
                    selName, selEmail, selCpf, selPhone,
                    statusAll, statusIn, statusOut,
                    pageable);
        }
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

    // List disciplines linked to this preceptor
    @GetMapping("/disciplines")
    public ResponseEntity<?> disciplines(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        User me = me(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        List<Discipline> discs = disciplineRepository.findByPreceptors_Id(me.getId());
        List<Map<String,Object>> items = discs.stream().map(d -> {
            Map<String,Object> m = new HashMap<>();
            m.put("id", d.getId());
            m.put("code", d.getCode());
            m.put("name", d.getName());
            m.put("hours", d.getHours());
            m.put("ciclo", d.getCiclo());
            return m;
        }).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Student info for evaluation (includes discipline context)
    @GetMapping("/student-info")
    public ResponseEntity<?> studentInfo(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                         @RequestParam("alunoId") Long alunoId,
                                         @RequestParam(value = "disciplineId", required = false) Long disciplineId) {
        User me = me(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        User aluno = userRepository.findById(alunoId).orElse(null);
        if (aluno == null) return ResponseEntity.notFound().build();
        Discipline discipline = null;
        if (disciplineId != null) {
            discipline = disciplineRepository.findById(disciplineId).orElse(null);
            if (discipline != null && me.getRole() == Role.PRECEPTOR) {
                final Long dId = discipline.getId();
                boolean belongs = disciplineRepository.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                if (!belongs) return ResponseEntity.status(403).body(Map.of("error","Preceptor não vinculado à disciplina"));
            }
        } else {
            // fallback para disciplina atual do aluno
            discipline = aluno.getCurrentDiscipline();
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
        // Preceptor (o avaliador) também pode ser mostrado
        resp.put("preceptor", Map.of("id", me.getId(), "name", me.getName()));
        return ResponseEntity.ok(resp);
    }

    // Create or update evaluation
    @org.springframework.web.bind.annotation.PostMapping("/evaluate")
    public ResponseEntity<?> evaluate(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                      @org.springframework.web.bind.annotation.RequestBody Map<String,Object> body) {
        User me = me(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error","Forbidden"));
        }
        try {
            Long alunoId = Long.valueOf(String.valueOf(body.get("alunoId")));
            Integer weekNumber = Integer.valueOf(String.valueOf(body.get("weekNumber")));
            if (weekNumber < 1 || weekNumber > 52) return ResponseEntity.badRequest().body(Map.of("error","weekNumber inválido"));
            Integer score = body.get("score") != null ? Integer.valueOf(String.valueOf(body.get("score"))) : null;
            if (score != null && (score < 0 || score > 10)) return ResponseEntity.badRequest().body(Map.of("error","score fora de faixa"));
            String comment = body.get("comment") != null ? String.valueOf(body.get("comment")) : null;
            String detailsJson = body.get("details") != null ? com.fasterxml.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(body.get("details")) : null;
            Discipline discipline = null;
            if (body.get("disciplineId") != null) {
                Long did = Long.valueOf(String.valueOf(body.get("disciplineId")));
                discipline = disciplineRepository.findById(did).orElse(null);
                if (discipline != null && me.getRole() == Role.PRECEPTOR) {
                    final Long dId = discipline.getId();
                    boolean belongs = disciplineRepository.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                    if (!belongs) return ResponseEntity.status(403).body(Map.of("error","Preceptor não vinculado à disciplina"));
                }
            }
            User aluno = userRepository.findById(alunoId).orElseThrow();
            PreceptorEvaluation eval;
            if (discipline != null) {
                eval = evaluationRepository.findFirstByAlunoAndPreceptorAndDisciplineAndWeekNumber(aluno, me, discipline, weekNumber).orElse(new PreceptorEvaluation());
            } else {
                eval = evaluationRepository.findFirstByAlunoAndPreceptorAndWeekNumberAndDisciplineIsNull(aluno, me, weekNumber).orElse(new PreceptorEvaluation());
            }
            eval.setAluno(aluno);
            eval.setPreceptor(me);
            eval.setDiscipline(discipline);
            eval.setWeekNumber(weekNumber);
            eval.setScore(score);
            eval.setComment(comment);
            eval.setDetailsJson(detailsJson);
            eval.setUpdatedAt(java.time.LocalDateTime.now());
            evaluationRepository.save(eval);
            Map<String,Object> resp = new HashMap<>();
            resp.put("id", eval.getId());
            resp.put("alunoId", aluno.getId());
            resp.put("preceptorId", me.getId());
            resp.put("disciplineId", discipline == null ? null : discipline.getId());
            resp.put("weekNumber", eval.getWeekNumber());
            resp.put("score", eval.getScore());
            resp.put("comment", eval.getComment());
            resp.put("details", eval.getDetailsJson() != null ? eval.getDetailsJson() : null);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Recupera avaliação existente (para preceptor ou aluno visualizar). Preceptor precisa vínculo; aluno só pode ver sua própria.
    @GetMapping("/evaluation")
    public ResponseEntity<?> getEvaluation(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                           @RequestParam("alunoId") Long alunoId,
                                           @RequestParam("weekNumber") Integer weekNumber,
                                           @RequestParam(value = "disciplineId", required = false) Long disciplineId) {
        User me = me(principal);
        if (weekNumber < 1 || weekNumber > 52) return ResponseEntity.badRequest().body(Map.of("error","weekNumber inválido"));
        User aluno = userRepository.findById(alunoId).orElse(null);
        if (aluno == null) return ResponseEntity.notFound().build();
        Discipline discipline = null;
        if (disciplineId != null) {
            discipline = disciplineRepository.findById(disciplineId).orElse(null);
        }
        boolean isAluno = me.getId().equals(aluno.getId());
        boolean isPreceptor = me.getRole() == Role.PRECEPTOR || me.getRole() == Role.ADMIN;
        boolean isCoordinator = me.getRole() == Role.COORDENADOR;
        if (!isAluno && !isPreceptor && !isCoordinator) {
            return ResponseEntity.status(403).body(Map.of("error","Forbidden"));
        }
        // Valida vínculo da disciplina conforme o papel
        if (discipline != null) {
            final Long dId = discipline.getId();
            if (isPreceptor && me.getRole() == Role.PRECEPTOR) {
                boolean belongs = disciplineRepository.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                if (!belongs) return ResponseEntity.status(403).body(Map.of("error","Preceptor não vinculado à disciplina"));
            }
            if (isCoordinator) {
                boolean coordLinked = disciplineRepository.findByCoordinators_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                if (!coordLinked) return ResponseEntity.status(403).body(Map.of("error","Coordenador não vinculado à disciplina"));
            }
        }
        List<PreceptorEvaluation> evals;
        if (discipline != null) {
            evals = evaluationRepository.findByAlunoAndDisciplineAndWeekNumber(aluno, discipline, weekNumber);
        } else {
            evals = evaluationRepository.findByAlunoAndWeekNumberAndDisciplineIsNull(aluno, weekNumber);
        }
        // Regra: Preceptor não pode ver avaliação de outro preceptor.
        if (me.getRole() == Role.PRECEPTOR) {
            final Long myId = me.getId();
            evals = evals.stream()
                    .filter(ev -> ev.getPreceptor() != null && myId.equals(ev.getPreceptor().getId()))
                    .collect(Collectors.toList());
        }
        List<Map<String,Object>> list = new ArrayList<>();
        for (PreceptorEvaluation ev : evals) {
            Map<String,Object> m = new HashMap<>();
            m.put("id", ev.getId());
            m.put("alunoId", aluno.getId());
            m.put("preceptorId", ev.getPreceptor().getId());
            m.put("preceptorName", ev.getPreceptor().getName());
            m.put("disciplineId", ev.getDiscipline() == null ? null : ev.getDiscipline().getId());
            m.put("weekNumber", ev.getWeekNumber());
            m.put("score", ev.getScore());
            m.put("comment", ev.getComment());
            m.put("details", ev.getDetailsJson());
            m.put("updatedAt", ev.getUpdatedAt());
            list.add(m);
        }
        return ResponseEntity.ok(Map.of("items", list));
    }

    // Delete evaluation (allow PRECEPTOR or ADMIN). Coordinator intentionally not allowed to delete.
    @org.springframework.web.bind.annotation.DeleteMapping("/evaluation")
    public ResponseEntity<?> deleteEvaluation(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                              @RequestParam("alunoId") Long alunoId,
                                              @RequestParam("weekNumber") Integer weekNumber,
                                              @RequestParam(value = "disciplineId", required = false) Long disciplineId) {
        User me = me(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error","Forbidden"));
        }
        if (weekNumber < 1 || weekNumber > 52) return ResponseEntity.badRequest().body(Map.of("error","weekNumber inválido"));
        User aluno = userRepository.findById(alunoId).orElse(null);
        if (aluno == null) return ResponseEntity.notFound().build();
        Discipline discipline = null;
        if (disciplineId != null) {
            discipline = disciplineRepository.findById(disciplineId).orElse(null);
            if (discipline != null && me.getRole() == Role.PRECEPTOR) {
                final Long dId = discipline.getId();
                boolean belongs = disciplineRepository.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(dId));
                if (!belongs) return ResponseEntity.status(403).body(Map.of("error","Preceptor não vinculado à disciplina"));
            }
        }
        PreceptorEvaluation eval;
        if (me.getRole() == Role.PRECEPTOR) {
            // Preceptor só pode excluir sua própria avaliação
            if (discipline != null) {
                eval = evaluationRepository.findFirstByAlunoAndPreceptorAndDisciplineAndWeekNumber(aluno, me, discipline, weekNumber).orElse(null);
            } else {
                eval = evaluationRepository.findFirstByAlunoAndPreceptorAndWeekNumberAndDisciplineIsNull(aluno, me, weekNumber).orElse(null);
            }
        } else {
            // ADMIN mantém comportamento anterior (primeira encontrada)
            if (discipline != null) {
                eval = evaluationRepository.findFirstByAlunoAndDisciplineAndWeekNumber(aluno, discipline, weekNumber).orElse(null);
            } else {
                eval = evaluationRepository.findFirstByAlunoAndWeekNumberAndDisciplineIsNull(aluno, weekNumber).orElse(null);
            }
        }
        if (eval == null) return ResponseEntity.ok(Map.of("deleted", false, "reason", "not-found"));
        // Only the original preceptor or an ADMIN can delete
        if (!eval.getPreceptor().getId().equals(me.getId()) && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error","Somente o avaliador original ou ADMIN pode excluir"));
        }
        evaluationRepository.delete(eval);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    // Final evaluation (coordinator) visibility for PRECEPTOR/ADMIN
    @GetMapping("/final-evaluation")
    public ResponseEntity<?> getCoordinatorFinalForStudent(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal,
                                                           @RequestParam("alunoId") Long alunoId,
                                                           @RequestParam("disciplineId") Long disciplineId) {
        User me = me(principal);
        if (me.getRole() != Role.PRECEPTOR && me.getRole() != Role.ADMIN) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
        }
        User aluno = userRepository.findById(alunoId).orElse(null);
        Discipline disc = disciplineRepository.findById(disciplineId).orElse(null);
        if (aluno == null || disc == null) return ResponseEntity.notFound().build();
        // Se PRECEPTOR, precisa estar vinculado à disciplina
        if (me.getRole() == Role.PRECEPTOR) {
            boolean linked = disciplineRepository.findByPreceptors_Id(me.getId()).stream().anyMatch(d -> d.getId().equals(disc.getId()));
            if (!linked) return ResponseEntity.status(403).body(Map.of("error", "Preceptor não vinculado à disciplina"));
        }
        var opt = coordEvalRepo.findFirstByAlunoAndDiscipline(aluno, disc);
        if (opt.isEmpty()) return ResponseEntity.ok(Map.of("found", false));
        var ev = opt.get();
        // Permitir valores nulos (comment)
        java.util.Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("found", true);
        resp.put("id", ev.getId());
        resp.put("alunoId", aluno.getId());
        resp.put("disciplineId", disc.getId());
        resp.put("coordinatorId", ev.getCoordinator() != null ? ev.getCoordinator().getId() : null);
        resp.put("score", ev.getScore());
        resp.put("comment", ev.getComment());
        return ResponseEntity.ok(resp);
    }
}
