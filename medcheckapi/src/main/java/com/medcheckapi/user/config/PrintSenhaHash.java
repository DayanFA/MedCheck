package com.medcheckapi.user.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PrintSenhaHash {
    @Bean
    public CommandLineRunner printSenha123Hash(PasswordEncoder encoder){
        return args -> {
            String raw = "Senha123!";
            String hash = encoder.encode(raw);
            System.out.println("[DEBUG] BCrypt hash for 'Senha123!' => " + hash);
        };
    }
}
