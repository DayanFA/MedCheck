package com.medcheckapi.user.model;

import jakarta.persistence.*;
import java.time.*;

/**
 * Represents a pair of check-in / check-out for an ALUNO validated by a PRECEPTOR.
 */
@Entity
@Table(name = "check_sessions")
public class CheckSession {
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

    @Column(name = "check_in_time", nullable = false)
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "validated", nullable = false)
    private boolean validated; // true when check-in validated

    // ===== Localização (opcional) =====
    @Column(name = "check_in_lat")
    private Double checkInLat;
    @Column(name = "check_in_lng")
    private Double checkInLng;
    @Column(name = "check_out_lat")
    private Double checkOutLat;
    @Column(name = "check_out_lng")
    private Double checkOutLng;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getAluno() { return aluno; }
    public void setAluno(User aluno) { this.aluno = aluno; }
    public User getPreceptor() { return preceptor; }
    public void setPreceptor(User preceptor) { this.preceptor = preceptor; }
    public Discipline getDiscipline() { return discipline; }
    public void setDiscipline(Discipline discipline) { this.discipline = discipline; }
    public LocalDateTime getCheckInTime() { return checkInTime; }
    public void setCheckInTime(LocalDateTime checkInTime) { this.checkInTime = checkInTime; }
    public LocalDateTime getCheckOutTime() { return checkOutTime; }
    public void setCheckOutTime(LocalDateTime checkOutTime) { this.checkOutTime = checkOutTime; }
    public boolean isValidated() { return validated; }
    public void setValidated(boolean validated) { this.validated = validated; }
    public Double getCheckInLat() { return checkInLat; }
    public void setCheckInLat(Double checkInLat) { this.checkInLat = checkInLat; }
    public Double getCheckInLng() { return checkInLng; }
    public void setCheckInLng(Double checkInLng) { this.checkInLng = checkInLng; }
    public Double getCheckOutLat() { return checkOutLat; }
    public void setCheckOutLat(Double checkOutLat) { this.checkOutLat = checkOutLat; }
    public Double getCheckOutLng() { return checkOutLng; }
    public void setCheckOutLng(Double checkOutLng) { this.checkOutLng = checkOutLng; }

    @Transient
    public Duration getWorkedDuration() {
        if (checkOutTime == null) return Duration.ZERO;
        return Duration.between(checkInTime, checkOutTime);
    }
}
