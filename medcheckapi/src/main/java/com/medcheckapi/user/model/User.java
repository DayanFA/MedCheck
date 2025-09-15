package com.medcheckapi.user.model;

import jakarta.persistence.*;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * Core user entity. Added role support to distinguish ALUNO / PRECEPTOR / ADMIN / COORDENADOR
 * and enable authorization & UI branching. Existing rows without role will default (handled in
 * service / SQL seed). CPF kept unique and normalized (digits only).
 */

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    @Temporal(TemporalType.DATE)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date birthDate;
    private String matricula;
    @Column(unique = true)
    private String cpf;
    private String naturalidade;
    private String nacionalidade;
    private String phone;
    @Column(unique = true)
    private String institutionalEmail;
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Role role = Role.ALUNO; // default

    // Optional profile avatar stored in DB for simplicity
    @Lob
    @Basic(fetch = FetchType.LAZY)
    private byte[] avatar;
    private String avatarContentType;

    @ManyToOne(optional = true)
    @JoinColumn(name = "current_discipline_id")
    private Discipline currentDiscipline;

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Date getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(Date birthDate) {
        this.birthDate = birthDate;
    }

    public String getMatricula() {
        return matricula;
    }

    public void setMatricula(String matricula) {
        this.matricula = matricula;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        if (cpf != null) {
            String digits = cpf.replaceAll("\\D", "");
            this.cpf = digits;
        } else {
            this.cpf = null;
        }
    }

    public String getNaturalidade() {
        return naturalidade;
    }

    public void setNaturalidade(String naturalidade) {
        this.naturalidade = naturalidade;
    }

    public String getNacionalidade() {
        return nacionalidade;
    }

    public void setNacionalidade(String nacionalidade) {
        this.nacionalidade = nacionalidade;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getInstitutionalEmail() {
        return institutionalEmail;
    }

    public void setInstitutionalEmail(String institutionalEmail) {
        this.institutionalEmail = institutionalEmail;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public byte[] getAvatar() {
        return avatar;
    }

    public void setAvatar(byte[] avatar) {
        this.avatar = avatar;
    }

    public String getAvatarContentType() {
        return avatarContentType;
    }

    public void setAvatarContentType(String avatarContentType) {
        this.avatarContentType = avatarContentType;
    }

    public Discipline getCurrentDiscipline() { return currentDiscipline; }
    public void setCurrentDiscipline(Discipline currentDiscipline) { this.currentDiscipline = currentDiscipline; }
}
