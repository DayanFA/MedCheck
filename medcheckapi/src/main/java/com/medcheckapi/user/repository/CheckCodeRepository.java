package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.CheckCode;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface CheckCodeRepository extends JpaRepository<CheckCode, Long> {
    Optional<CheckCode> findFirstByPreceptorAndExpiresAtGreaterThanOrderByGeneratedAtDesc(User preceptor, LocalDateTime now);

    Optional<CheckCode> findFirstByPreceptorAndCodeIgnoreCaseAndExpiresAtGreaterThanOrderByGeneratedAtDesc(User preceptor, String code, LocalDateTime now);

    @Modifying
    @Query("delete from CheckCode c where c.usageCount = 0 and c.generatedAt < :threshold and (c.lastAccessedAt is null or c.lastAccessedAt < :threshold)")
    int deleteAllUnusedOlderThan(@Param("threshold") LocalDateTime threshold);
}
