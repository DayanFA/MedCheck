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

@SpringBootApplication(scanBasePackages = "com.medcheckapi")
@EnableJpaRepositories(basePackages = "com.medcheckapi.user.repository")
@EntityScan(basePackages = "com.medcheckapi.user.model")
public class ChatApplication {
    public static void main(String[] args) {
        SpringApplication.run(ChatApplication.class, args);
    }

    @Bean
    public CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByCpf("00000000000").isEmpty()) {
                User adminUser = new User();
                adminUser.setName("Admin");
                adminUser.setCpf("00000000000");
                adminUser.setPassword(passwordEncoder.encode("admin"));
                adminUser.setInstitutionalEmail("admin@medcheck.com");
                userRepository.save(adminUser);
                System.out.println("Created admin user with CPF 00000000000 and password admin");
            }
        };
    }
}
