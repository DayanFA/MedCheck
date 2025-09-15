package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.Discipline;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface DisciplineRepository extends JpaRepository<Discipline, Long> {
    Optional<Discipline> findByCode(String code);
    List<Discipline> findByPreceptors_Id(Long preceptorId);
}
