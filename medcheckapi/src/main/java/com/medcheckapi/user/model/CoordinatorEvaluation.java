package com.medcheckapi.user.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "coordinator_evaluations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_coord_eval_aluno_disc", columnNames = {"aluno_id","discipline_id"})
})
public class CoordinatorEvaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "aluno_id")
    private User aluno;

    @ManyToOne(optional = false)
    @JoinColumn(name = "discipline_id")
    private Discipline discipline;

    @ManyToOne(optional = false)
    @JoinColumn(name = "coordinator_id")
    private User coordinator;

    @Column(name = "score")
    private Integer score; // 0..10

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getAluno() { return aluno; }
    public void setAluno(User aluno) { this.aluno = aluno; }
    public Discipline getDiscipline() { return discipline; }
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }
    public User getCoordinator() { return coordinator; }
    public void setCoordinator(User coordinator) { this.coordinator = coordinator; }
    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
