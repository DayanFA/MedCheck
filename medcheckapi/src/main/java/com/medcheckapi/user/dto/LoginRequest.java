package com.medcheckapi.user.dto;

public class LoginRequest {
    private String cpf;
    private String password;

    // Getters and Setters
    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        if (cpf != null) {
            // Keep only digits (CPF) and strip unicode whitespace
            String digits = cpf.replaceAll("\\D", "");
            this.cpf = digits;
        } else {
            this.cpf = null;
        }
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
