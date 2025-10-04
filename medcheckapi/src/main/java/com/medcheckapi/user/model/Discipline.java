package com.medcheckapi.user.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "disciplines")
public class Discipline {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private int hours;

    @Column(nullable = false)
    private int ciclo; // 1 ou 2

    // Vários preceptores podem ser vinculados a uma disciplina
    @ManyToMany
    @JoinTable(
        name = "discipline_preceptors",
        joinColumns = @JoinColumn(name = "discipline_id"),
        inverseJoinColumns = @JoinColumn(name = "preceptor_id")
    )
    @JsonIgnore // evita recursão e payloads grandes em listagens
    private Set<User> preceptors = new HashSet<>();

    // Coordenadores responsáveis pela disciplina (permite múltiplos coordenadores por disciplina)
    @ManyToMany
    @JoinTable(
        name = "discipline_coordinators",
        joinColumns = @JoinColumn(name = "discipline_id"),
        inverseJoinColumns = @JoinColumn(name = "coordinator_id")
    )
    @JsonIgnore
    private Set<User> coordinators = new HashSet<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getHours() { return hours; }
    public void setHours(int hours) { this.hours = hours; }
    public int getCiclo() { return ciclo; }
    public void setCiclo(int ciclo) { this.ciclo = ciclo; }

    public Set<User> getPreceptors() { return preceptors; }
    public void setPreceptors(Set<User> preceptors) { this.preceptors = preceptors; }

    public Set<User> getCoordinators() { return coordinators; }
    public void setCoordinators(Set<User> coordinators) { this.coordinators = coordinators; }
}
