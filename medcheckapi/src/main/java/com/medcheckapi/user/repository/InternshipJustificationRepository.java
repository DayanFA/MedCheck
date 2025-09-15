package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.InternshipJustification;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InternshipJustificationRepository extends JpaRepository<InternshipJustification, Long> {
    List<InternshipJustification> findByAlunoAndDateBetweenOrderByDateAsc(User aluno, LocalDate start, LocalDate end);
    List<InternshipJustification> findByAlunoAndDate(User aluno, LocalDate date);
    Optional<InternshipJustification> findFirstByAlunoAndDate(User aluno, LocalDate date);
}
