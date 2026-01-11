package com.medcheckapi.chat;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.TimeZone;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.medcheckapi")
@EnableScheduling
@EnableJpaRepositories(basePackages = "com.medcheckapi.user.repository")
@EntityScan(basePackages = "com.medcheckapi.user.model")
public class ChatApplication {
    public static void main(String[] args) {
        // Força timezone padrão da JVM em UTC para evitar deslocamentos (ex: -05:00) em cálculos de duração
    // Timezone padrão solicitado: UTC-5
    TimeZone.setDefault(TimeZone.getTimeZone("GMT-5"));
        SpringApplication.run(ChatApplication.class, args);
    }

    @Bean
    public CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            System.out.println("[INIT] Users count at startup: " + userRepository.count());
            userRepository.findAll().forEach(u -> System.out.println("[INIT] user cpf=" + u.getCpf() + " email=" + u.getInstitutionalEmail() + " role=" + u.getRole()));
            // Nenhuma padronização forçada agora; confiamos no seed do schema.sql
            boolean cpfMissing = userRepository.findByCpf("00000000000").isEmpty();
            boolean emailMissing = userRepository.findByInstitutionalEmailIgnoreCase("admin@medcheck.com").isEmpty();
            if (cpfMissing && emailMissing) {
                String adminPassword = System.getenv("ADMIN_DEFAULT_PASSWORD");
                if (adminPassword == null || adminPassword.isBlank()) {
                    adminPassword = "changeme";
                }
                User adminUser = new User();
                adminUser.setName("Admin");
                adminUser.setCpf("00000000000");
                adminUser.setPassword(passwordEncoder.encode(adminPassword));
                adminUser.setInstitutionalEmail("admin@medcheck.com");
                adminUser.setRole(com.medcheckapi.user.model.Role.ADMIN);
                userRepository.save(adminUser);
                System.out.println("Created extra admin user (CPF 00000000000) - change password after first login!");
            } else {
                System.out.println("Admin seed skipped (already exists)");
            }
        };
    }
}
