package com.medcheckapi.user.service;

import com.medcheckapi.user.model.PasswordResetToken;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.PasswordResetTokenRepository;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mail.javamail.JavaMailSender;


import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetServiceTest {

    @Test
    @DisplayName("createAndSendToken gera token e persiste")
    void createAndSendToken_persiste() {
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        PasswordResetTokenRepository tokenRepo = Mockito.mock(PasswordResetTokenRepository.class);
        JavaMailSender mailSender = Mockito.mock(JavaMailSender.class);

        User u = new User();
        u.setCpf("11122233344");
        u.setInstitutionalEmail("a@b.com");
        u.setName("Test User");
    // Simula varredura no findAll() usado no serviço
    Mockito.when(userRepository.findAll()).thenReturn(java.util.List.of(u));
    PasswordEncoder encoder = Mockito.mock(PasswordEncoder.class);

    PasswordResetService svc = new PasswordResetService(userRepository, tokenRepo, mailSender, encoder);
        svc.createAndSendToken("a@b.com");

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        Mockito.verify(tokenRepo).save(captor.capture());
        PasswordResetToken saved = captor.getValue();
        assertThat(saved.getToken()).isNotBlank();
        assertThat(saved.getUser()).isEqualTo(u);
    // Deve ser ~agora + expirationMinutes; apenas garante futuro (>= agora + 1 min de margem negativa)
    java.time.Instant now = java.time.Instant.now().minusSeconds(5); // pequena margem
    assertThat(saved.getExpiresAt()).isAfter(now);
    }

      @Test
      @DisplayName("resetPassword falha com token expirado")
      void resetPassword_expired() {
          UserRepository userRepository = Mockito.mock(UserRepository.class);
          PasswordResetTokenRepository tokenRepo = Mockito.mock(PasswordResetTokenRepository.class);
          JavaMailSender mailSender = Mockito.mock(JavaMailSender.class);
          PasswordEncoder encoder = Mockito.mock(PasswordEncoder.class);
          PasswordResetService svc = new PasswordResetService(userRepository, tokenRepo, mailSender, encoder);
          PasswordResetToken t = new PasswordResetToken();
          t.setToken("T1");
          t.setExpiresAt(java.time.Instant.now().minusSeconds(60));
          t.setUsed(false);
          t.setUser(new User());
          Mockito.when(tokenRepo.findByToken("T1")).thenReturn(java.util.Optional.of(t));
          var msg = svc.resetPassword("T1", "NovaSenha1!");
          assertThat(msg.getMessage()).contains("expirado");
      }

      @Test
      @DisplayName("resetPassword falha com token já usado")
      void resetPassword_used() {
          UserRepository userRepository = Mockito.mock(UserRepository.class);
          PasswordResetTokenRepository tokenRepo = Mockito.mock(PasswordResetTokenRepository.class);
          JavaMailSender mailSender = Mockito.mock(JavaMailSender.class);
          PasswordEncoder encoder = Mockito.mock(PasswordEncoder.class);
          PasswordResetService svc = new PasswordResetService(userRepository, tokenRepo, mailSender, encoder);
          PasswordResetToken t = new PasswordResetToken();
          t.setToken("T2");
          t.setExpiresAt(java.time.Instant.now().plusSeconds(600));
          t.setUsed(true);
          t.setUser(new User());
          Mockito.when(tokenRepo.findByToken("T2")).thenReturn(java.util.Optional.of(t));
          var msg = svc.resetPassword("T2", "NovaSenha1!");
          assertThat(msg.getMessage()).contains("utilizado");
      }
}
