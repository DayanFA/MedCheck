package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.CoordinatorEvaluation;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.model.Discipline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoordinatorEvaluationRepository extends JpaRepository<CoordinatorEvaluation, Long> {
    Optional<CoordinatorEvaluation> findFirstByAlunoAndDiscipline(User aluno, Discipline discipline);
}
