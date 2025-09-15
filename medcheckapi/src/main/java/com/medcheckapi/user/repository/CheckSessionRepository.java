package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.CheckSession;
import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CheckSessionRepository extends JpaRepository<CheckSession, Long> {
    Optional<CheckSession> findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(User aluno);

    List<CheckSession> findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(User aluno, LocalDateTime start, LocalDateTime end);
    List<CheckSession> findByAlunoAndDisciplineAndCheckInTimeBetweenOrderByCheckInTimeDesc(User aluno, Discipline discipline, LocalDateTime start, LocalDateTime end);
}
