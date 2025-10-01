package com.medcheckapi.user.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "preceptor_evaluations", uniqueConstraints = {
        @UniqueConstraint(name = "uq_eval_aluno_disc_week", columnNames = {"aluno_id","discipline_id","week_number"})
})
public class PreceptorEvaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "aluno_id")
    private User aluno;

    @ManyToOne(optional = false)
    @JoinColumn(name = "preceptor_id")
    private User preceptor;

    @ManyToOne(optional = true)
    @JoinColumn(name = "discipline_id")
    private Discipline discipline;

    @Column(name = "week_number", nullable = false)
    private Integer weekNumber; // 1..10

    @Column(name = "score")
    private Integer score; // 0..10 (opcional)

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    // Armazena JSON com respostas detalhadas (dimensões/perguntas)
    @Column(name = "details_json", columnDefinition = "TEXT")
    private String detailsJson;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getAluno() { return aluno; }
    public void setAluno(User aluno) { this.aluno = aluno; }
    public User getPreceptor() { return preceptor; }
    public void setPreceptor(User preceptor) { this.preceptor = preceptor; }
    public Discipline getDiscipline() { return discipline; }
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }
    public Integer getWeekNumber() { return weekNumber; }
    public void setWeekNumber(Integer weekNumber) { this.weekNumber = weekNumber; }
    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getDetailsJson() { return detailsJson; }
    public void setDetailsJson(String detailsJson) { this.detailsJson = detailsJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
