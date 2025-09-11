package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.CheckCode;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface CheckCodeRepository extends JpaRepository<CheckCode, Long> {
    Optional<CheckCode> findFirstByPreceptorAndExpiresAtGreaterThanOrderByGeneratedAtDesc(User preceptor, LocalDateTime now);

    Optional<CheckCode> findFirstByPreceptorAndCodeIgnoreCaseAndExpiresAtGreaterThanOrderByGeneratedAtDesc(User preceptor, String code, LocalDateTime now);
}
