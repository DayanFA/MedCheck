package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.InternshipPlan;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface InternshipPlanRepository extends JpaRepository<InternshipPlan, Long> {
    List<InternshipPlan> findByAlunoAndDateBetweenOrderByDateAsc(User aluno, LocalDate start, LocalDate end);
    List<InternshipPlan> findByAlunoAndDate(User aluno, LocalDate date);
    List<InternshipPlan> findByAlunoAndWeekNumberOrderByDateAsc(User aluno, Integer weekNumber);
}
