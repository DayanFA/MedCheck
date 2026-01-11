package com.medcheckapi.user.repository;

import com.medcheckapi.user.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.ANY)
class UserRepositoryDataJpaTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("Persiste e recupera usuário por CPF")
    void persist_and_find_by_cpf() {
        User u = new User();
        u.setName("Repo Test");
        u.setCpf("98765432100");
        u.setInstitutionalEmail("repo@test.com");
        u.setPassword("pwd");
        userRepository.save(u);
        Optional<User> found = userRepository.findByCpf("98765432100");
        assertThat(found).isPresent();
        assertThat(found.get().getInstitutionalEmail()).isEqualTo("repo@test.com");
    }
}
