package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.CheckSession;
import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CheckSessionRepository extends JpaRepository<CheckSession, Long> {
    Optional<CheckSession> findFirstByAlunoAndCheckOutTimeIsNullOrderByCheckInTimeDesc(User aluno);

    List<CheckSession> findByAlunoAndCheckInTimeBetweenOrderByCheckInTimeDesc(User aluno, LocalDateTime start, LocalDateTime end);
    List<CheckSession> findByAlunoAndDisciplineAndCheckInTimeBetweenOrderByCheckInTimeDesc(User aluno, Discipline discipline, LocalDateTime start, LocalDateTime end);

    // Sessions still open that started before a given threshold (used to auto-close long sessions)
    List<CheckSession> findByCheckOutTimeIsNullAndCheckInTimeBefore(LocalDateTime threshold);

    // Distinct students (alunos) who had any check session with given preceptor within a time window
    @Query("SELECT cs.aluno FROM CheckSession cs WHERE cs.preceptor = :preceptor AND cs.checkInTime BETWEEN :start AND :end GROUP BY cs.aluno")
    Page<User> findDistinctAlunosByPreceptorAndPeriod(@Param("preceptor") User preceptor,
                                                      @Param("start") LocalDateTime start,
                                                      @Param("end") LocalDateTime end,
                                                      Pageable pageable);

    @Query("SELECT cs.aluno FROM CheckSession cs WHERE cs.preceptor = :preceptor AND cs.checkInTime BETWEEN :start AND :end AND (LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%')) OR LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%')) OR cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) GROUP BY cs.aluno")
    Page<User> findDistinctAlunosByPreceptorAndPeriodFiltered(@Param("preceptor") User preceptor,
                                                              @Param("start") LocalDateTime start,
                                                              @Param("end") LocalDateTime end,
                                                              @Param("q") String q,
                                                              @Param("qDigits") String qDigits,
                                                              Pageable pageable);

    @Query("""
       SELECT cs.aluno FROM CheckSession cs
       WHERE cs.preceptor = :preceptor
        AND cs.checkInTime BETWEEN :start AND :end
        AND (
            :q IS NULL OR :q = '' OR (
                (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                (:phoneSel = true AND (
                    (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                    (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                ))
            )
        )
        AND (
            :statusAll = true OR
            (:statusIn  = true AND EXISTS (SELECT 1 FROM CheckSession s2 WHERE s2.aluno = cs.aluno AND s2.preceptor = :preceptor AND s2.checkOutTime IS NULL)) OR
            (:statusOut = true AND NOT EXISTS (SELECT 1 FROM CheckSession s3 WHERE s3.aluno = cs.aluno AND s3.preceptor = :preceptor AND s3.checkOutTime IS NULL))
        )
       GROUP BY cs.aluno
       """)
    Page<User> findDistinctAlunosByPreceptorAndPeriodAdvanced(@Param("preceptor") User preceptor,
                                                  @Param("start") LocalDateTime start,
                                                  @Param("end") LocalDateTime end,
                                                  @Param("q") String q,
                                                  @Param("qDigits") String qDigits,
                                                  @Param("nameSel") boolean nameSel,
                                                  @Param("emailSel") boolean emailSel,
                                                  @Param("cpfSel") boolean cpfSel,
                                                  @Param("phoneSel") boolean phoneSel,
                                                  @Param("statusAll") boolean statusAll,
                                                  @Param("statusIn") boolean statusIn,
                                                  @Param("statusOut") boolean statusOut,
                                                  Pageable pageable);

    // Same as above but constrained to a specific discipline for the preceptor
    @Query("""
       SELECT cs.aluno FROM CheckSession cs
       WHERE cs.preceptor = :preceptor
        AND cs.discipline = :discipline
        AND cs.checkInTime BETWEEN :start AND :end
        AND (
            :q IS NULL OR :q = '' OR (
                (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                (:phoneSel = true AND (
                    (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                    (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                ))
            )
        )
        AND (
            :statusAll = true OR
            (:statusIn  = true AND EXISTS (SELECT 1 FROM CheckSession s2 WHERE s2.aluno = cs.aluno AND s2.preceptor = :preceptor AND s2.discipline = :discipline AND s2.checkOutTime IS NULL)) OR
            (:statusOut = true AND NOT EXISTS (SELECT 1 FROM CheckSession s3 WHERE s3.aluno = cs.aluno AND s3.preceptor = :preceptor AND s3.discipline = :discipline AND s3.checkOutTime IS NULL))
        )
       GROUP BY cs.aluno
       """)
    Page<User> findDistinctAlunosByPreceptorAndDisciplineAndPeriodAdvanced(@Param("preceptor") User preceptor,
                                                                           @Param("discipline") Discipline discipline,
                                                                           @Param("start") LocalDateTime start,
                                                                           @Param("end") LocalDateTime end,
                                                                           @Param("q") String q,
                                                                           @Param("qDigits") String qDigits,
                                                                           @Param("nameSel") boolean nameSel,
                                                                           @Param("emailSel") boolean emailSel,
                                                                           @Param("cpfSel") boolean cpfSel,
                                                                           @Param("phoneSel") boolean phoneSel,
                                                                           @Param("statusAll") boolean statusAll,
                                                                           @Param("statusIn") boolean statusIn,
                                                                           @Param("statusOut") boolean statusOut,
                                                                           Pageable pageable);

        // ADMIN: todos os alunos com ao menos um check-in em qualquer disciplina/período (filtros semelhantes)
        @Query("""
                SELECT cs.aluno FROM CheckSession cs
                WHERE cs.checkInTime BETWEEN :start AND :end
                    AND (
                        :q IS NULL OR :q = '' OR (
                                (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                                (:phoneSel = true AND (
                                        (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                        (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                                ))
                        )
                    )
                    AND (
                        :statusAll = true OR
                        (:statusIn  = true AND EXISTS (SELECT 1 FROM CheckSession s2 WHERE s2.aluno = cs.aluno AND s2.checkOutTime IS NULL)) OR
                        (:statusOut = true AND NOT EXISTS (SELECT 1 FROM CheckSession s3 WHERE s3.aluno = cs.aluno AND s3.checkOutTime IS NULL))
                    )
                GROUP BY cs.aluno
                """)
        Page<User> findDistinctAlunosGlobalByPeriodAdvanced(@Param("start") LocalDateTime start,
                                                                                                                @Param("end") LocalDateTime end,
                                                                                                                @Param("q") String q,
                                                                                                                @Param("qDigits") String qDigits,
                                                                                                                @Param("nameSel") boolean nameSel,
                                                                                                                @Param("emailSel") boolean emailSel,
                                                                                                                @Param("cpfSel") boolean cpfSel,
                                                                                                                @Param("phoneSel") boolean phoneSel,
                                                                                                                @Param("statusAll") boolean statusAll,
                                                                                                                @Param("statusIn") boolean statusIn,
                                                                                                                @Param("statusOut") boolean statusOut,
                                                                                                                Pageable pageable);

        // ADMIN: alunos por disciplina específica independente do preceptor
        @Query("""
                SELECT cs.aluno FROM CheckSession cs
                WHERE cs.discipline = :discipline
                    AND cs.checkInTime BETWEEN :start AND :end
                    AND (
                        :q IS NULL OR :q = '' OR (
                                (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                                (:phoneSel = true AND (
                                        (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                        (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                                ))
                        )
                    )
                    AND (
                        :statusAll = true OR
                        (:statusIn  = true AND EXISTS (SELECT 1 FROM CheckSession s2 WHERE s2.aluno = cs.aluno AND s2.discipline = :discipline AND s2.checkOutTime IS NULL)) OR
                        (:statusOut = true AND NOT EXISTS (SELECT 1 FROM CheckSession s3 WHERE s3.aluno = cs.aluno AND s3.discipline = :discipline AND s3.checkOutTime IS NULL))
                    )
                GROUP BY cs.aluno
                """)
        Page<User> findDistinctAlunosByDisciplineAnyPreceptor(@Param("discipline") Discipline discipline,
                                                                                                                    @Param("start") LocalDateTime start,
                                                                                                                    @Param("end") LocalDateTime end,
                                                                                                                    @Param("q") String q,
                                                                                                                    @Param("qDigits") String qDigits,
                                                                                                                    @Param("nameSel") boolean nameSel,
                                                                                                                    @Param("emailSel") boolean emailSel,
                                                                                                                    @Param("cpfSel") boolean cpfSel,
                                                                                                                    @Param("phoneSel") boolean phoneSel,
                                                                                                                    @Param("statusAll") boolean statusAll,
                                                                                                                    @Param("statusIn") boolean statusIn,
                                                                                                                    @Param("statusOut") boolean statusOut,
                                                                                                                    Pageable pageable);

    boolean existsByAlunoAndPreceptorAndCheckOutTimeIsNull(User aluno, User preceptor);
    boolean existsByAlunoAndCheckOutTimeIsNull(User aluno);

    // Distinct students who had at least one check session in a given discipline within a period (for coordinator view)
     @Query("""
         SELECT cs.aluno FROM CheckSession cs
         WHERE cs.discipline = :discipline
            AND cs.checkInTime BETWEEN :start AND :end
            AND (
                :q IS NULL OR :q = '' OR (
                     (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                     (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                     (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                     (:phoneSel = true AND (
                          (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                          (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                     ))
                )
            )
            AND (
                :statusAll = true OR
                (:statusIn  = true AND EXISTS (SELECT 1 FROM CheckSession s2 WHERE s2.aluno = cs.aluno AND s2.discipline = :discipline AND s2.checkOutTime IS NULL)) OR
                (:statusOut = true AND NOT EXISTS (SELECT 1 FROM CheckSession s3 WHERE s3.aluno = cs.aluno AND s3.discipline = :discipline AND s3.checkOutTime IS NULL))
            )
         GROUP BY cs.aluno
         """)
     Page<User> findDistinctAlunosByDisciplineAndPeriodAdvanced(@Param("discipline") Discipline discipline,
                                                                  @Param("start") LocalDateTime start,
                                                                  @Param("end") LocalDateTime end,
                                                                  @Param("q") String q,
                                                                  @Param("qDigits") String qDigits,
                                                                  @Param("nameSel") boolean nameSel,
                                                                  @Param("emailSel") boolean emailSel,
                                                                  @Param("cpfSel") boolean cpfSel,
                                                                  @Param("phoneSel") boolean phoneSel,
                                                                  @Param("statusAll") boolean statusAll,
                                                                  @Param("statusIn") boolean statusIn,
                                                                  @Param("statusOut") boolean statusOut,
                                                                  Pageable pageable);

     boolean existsByAlunoAndDisciplineAndCheckOutTimeIsNull(User aluno, Discipline discipline);

        // Aggregated view for coordinator: returns raw Object[] with (aluno, totalSeconds, lastCheckIn, preceptorCount)
        @Query("""
                SELECT cs.aluno as aluno,
                             SUM(TIMESTAMPDIFF(SECOND, cs.checkInTime, COALESCE(cs.checkOutTime, CURRENT_TIMESTAMP))) as totalSeconds,
                             MAX(cs.checkInTime) as lastCheckIn,
                             COUNT(DISTINCT cs.preceptor) as preceptorCount
                FROM CheckSession cs
                WHERE cs.discipline = :discipline
                    AND cs.checkInTime BETWEEN :start AND :end
                    AND (:preceptorId IS NULL OR cs.preceptor.id = :preceptorId)
                    AND (
                        :q IS NULL OR :q = '' OR (
                                (:nameSel  = true AND LOWER(cs.aluno.name) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:emailSel = true AND LOWER(cs.aluno.institutionalEmail) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                (:cpfSel   = true AND :qDigits IS NOT NULL AND :qDigits <> '' AND cs.aluno.cpf LIKE CONCAT('%',:qDigits,'%')) OR
                                (:phoneSel = true AND (
                                        (:q IS NOT NULL AND :q <> '' AND LOWER(cs.aluno.phone) LIKE LOWER(CONCAT('%',:q,'%'))) OR
                                        (:qDigits IS NOT NULL AND :qDigits <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(cs.aluno.phone,'(',''),')',''),'-',''),' ','') LIKE CONCAT('%',:qDigits,'%'))
                                ))
                        )
                    )
                GROUP BY cs.aluno
                """)
        Page<Object[]> aggregateByDiscipline(@Param("discipline") Discipline discipline,
                                                                                 @Param("start") LocalDateTime start,
                                                                                 @Param("end") LocalDateTime end,
                                                                                 @Param("preceptorId") Long preceptorId,
                                                                                 @Param("q") String q,
                                                                                 @Param("qDigits") String qDigits,
                                                                                 @Param("nameSel") boolean nameSel,
                                                                                 @Param("emailSel") boolean emailSel,
                                                                                 @Param("cpfSel") boolean cpfSel,
                                                                                 @Param("phoneSel") boolean phoneSel,
                                                                                 Pageable pageable);

        @Query("""
                SELECT DISTINCT cs.preceptor FROM CheckSession cs
                WHERE cs.discipline = :discipline
                    AND cs.aluno = :aluno
                    AND cs.checkInTime BETWEEN :start AND :end
                """)
        List<User> findDistinctPreceptorsForAlunoInDisciplinePeriod(@Param("discipline") Discipline discipline,
                                                                                                                                 @Param("aluno") User aluno,
                                                                                                                                 @Param("start") LocalDateTime start,
                                                                                                                                 @Param("end") LocalDateTime end);
}
