package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.PreceptorEvaluation;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.model.Discipline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PreceptorEvaluationRepository extends JpaRepository<PreceptorEvaluation, Long> {
    Optional<PreceptorEvaluation> findFirstByAlunoAndPreceptorAndDisciplineAndWeekNumber(User aluno, User preceptor, Discipline discipline, Integer weekNumber);
    Optional<PreceptorEvaluation> findFirstByAlunoAndPreceptorAndWeekNumberAndDisciplineIsNull(User aluno, User preceptor, Integer weekNumber);
    Optional<PreceptorEvaluation> findFirstByAlunoAndDisciplineAndWeekNumber(User aluno, Discipline discipline, Integer weekNumber);
    Optional<PreceptorEvaluation> findFirstByAlunoAndWeekNumberAndDisciplineIsNull(User aluno, Integer weekNumber);
}
