package com.medcheckapi.user.config;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.model.Discipline;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.repository.DisciplineRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {
    
    @Bean
    public CommandLineRunner initializeData(UserRepository userRepository, PasswordEncoder passwordEncoder, DisciplineRepository disciplineRepository) {
        return args -> {
            // Create test users if they don't exist
            User aluno = null;
            User preceptor = null;
            
            if (userRepository.findByCpf("16450102012").isEmpty()) {
                aluno = createUser(userRepository, passwordEncoder, "Aluno Teste", "16450102012", "aluno@teste.com", "202300001", Role.ALUNO);
            } else {
                aluno = userRepository.findByCpf("16450102012").get();
            }
            
            if (userRepository.findByCpf("24327474029").isEmpty()) {
                preceptor = createUser(userRepository, passwordEncoder, "Preceptor Teste", "24327474029", "preceptor@teste.com", "P0001", Role.PRECEPTOR);
            } else {
                preceptor = userRepository.findByCpf("24327474029").get();
            }
            
            if (userRepository.findByCpf("08284001055").isEmpty()) {
                createUser(userRepository, passwordEncoder, "Administrador", "08284001055", "admin@teste.com", "ADM001", Role.ADMIN);
            }
            
            if (userRepository.findByCpf("32247668089").isEmpty()) {
                createUser(userRepository, passwordEncoder, "Coordenador Teste", "32247668089", "coordenador@teste.com", "COO001", Role.COORDENADOR);
            }
            
            // Create disciplines if they don't exist
            if (disciplineRepository.count() == 0) {
                createDisciplines(disciplineRepository, preceptor);
                System.out.println("[INIT] Created disciplines and linked preceptor");
            }
            
            System.out.println("[INIT] Data initialization completed. Total users: " + userRepository.count() + ", Total disciplines: " + disciplineRepository.count());
        };
    }
    
    private User createUser(UserRepository userRepository, PasswordEncoder passwordEncoder, 
                          String name, String cpf, String email, String matricula, Role role) {
        User user = new User();
        user.setName(name);
        user.setCpf(cpf);
        user.setInstitutionalEmail(email);
        user.setMatricula(matricula);
        user.setPassword(passwordEncoder.encode("Senha123!"));
        user.setRole(role);
        user.setNaturalidade("Rio Branco");
        user.setNacionalidade("Brasil");
        user.setPhone("68900000000");
        return userRepository.save(user);
    }
    
    private void createDisciplines(DisciplineRepository disciplineRepository, User preceptor) {
        Discipline d1 = new Discipline();
        d1.setCode("CCSD459");
        d1.setName("Internato em Medicina de Família e Comunidade");
        d1.setHours(420);
        d1.setCiclo(1);
        d1.getPreceptors().add(preceptor);
        disciplineRepository.save(d1);
        
        Discipline d2 = new Discipline();
        d2.setCode("CCSD463");
        d2.setName("Internato em Clínica Médica");
        d2.setHours(420);
        d2.setCiclo(1);
        d2.getPreceptors().add(preceptor);
        disciplineRepository.save(d2);
        
        Discipline d3 = new Discipline();
        d3.setCode("CCSD460");
        d3.setName("Internato em Cirurgia Geral");
        d3.setHours(420);
        d3.setCiclo(1);
        disciplineRepository.save(d3);
    }
}