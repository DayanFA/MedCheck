package com.medcheckapi.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medcheckapi.testsupport.TestSecrets;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(AuthControllerTest.MockConfig.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired
    private com.medcheckapi.user.service.PasswordResetService passwordResetService;

    @BeforeEach
    void setup() {
        SecurityContextHolder.clearContext();
    }

    // @TestConfiguration already includes @Configuration; extra @Configuration not needed. IDE warning can be ignored.
    @TestConfiguration
    static class MockConfig {
        @Bean AuthenticationManager authenticationManager() { return Mockito.mock(AuthenticationManager.class); }
        @Bean UserRepository userRepository() { return Mockito.mock(UserRepository.class); }
        @Bean JwtTokenProvider jwtTokenProvider() { return Mockito.mock(JwtTokenProvider.class); }
        // Beans adicionais exigidos pelo controller para injeção (não usados neste teste específico)
        @Bean org.springframework.security.crypto.password.PasswordEncoder passwordEncoder() { return Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class); }
        @Bean com.medcheckapi.user.service.PasswordResetService passwordResetService() { return Mockito.mock(com.medcheckapi.user.service.PasswordResetService.class); }
        @Bean com.medcheckapi.user.repository.PasswordResetTokenRepository passwordResetTokenRepository() { return Mockito.mock(com.medcheckapi.user.repository.PasswordResetTokenRepository.class); }
    }

    @Test
    @DisplayName("/signin retorna token e dados do usuário")
    void signin_ok() throws Exception {
        Authentication auth = new UsernamePasswordAuthenticationToken("12345678901", "pass");
        Mockito.when(authenticationManager.authenticate(any())).thenReturn(auth);
        Mockito.when(jwtTokenProvider.generateToken(any())).thenReturn("FAKE.JWT.TOKEN");
        User u = new User();
        u.setCpf("12345678901");
        u.setName("Fulano Teste");
        u.setMatricula("MAT1");
        u.setInstitutionalEmail("fulano@test.com");
        Mockito.when(userRepository.findByCpf("12345678901")).thenReturn(Optional.of(u));

    var body = java.util.Map.of("cpf","12345678901","password", TestSecrets.PASSWORD);
        mockMvc.perform(post("/api/auth/signin")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("FAKE.JWT.TOKEN"))
                .andExpect(jsonPath("$.name").value("Fulano Teste"))
                .andExpect(jsonPath("$.cpf").value("12345678901"));
    }

      @Test
      @DisplayName("/signup cadastra usuário novo")
      void signup_ok() throws Exception {
          Mockito.when(userRepository.findByCpf("99988877766")).thenReturn(Optional.empty());
          Mockito.when(passwordEncoder.encode(any())).thenReturn("ENCODED");
          var payload = java.util.Map.of(
              "name","Novo User",
              "birthDate","2000-01-01",
              "matricula","M123",
              "cpf","99988877766",
              "naturalidade","SP",
              "nacionalidade","Brasil",
              "phone","11999999999",
              "institutionalEmail","novo@teste.com",
              "password", TestSecrets.PASSWORD
          );
          mockMvc.perform(post("/api/auth/signup")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("sucesso")));
          Mockito.verify(userRepository).save(Mockito.argThat(u -> "99988877766".equals(u.getCpf())));
      }

      @Test
      @DisplayName("/signup rejeita CPF duplicado")
      void signup_duplicateCpf() throws Exception {
          User existing = new User(); existing.setCpf("12312312399");
          Mockito.when(userRepository.findByCpf("12312312399")).thenReturn(Optional.of(existing));
          var payload = java.util.Map.of(
              "name","Dup User",
              "birthDate","1999-05-05",
              "matricula","M999",
              "cpf","12312312399",
              "naturalidade","RJ",
              "nacionalidade","Brasil",
              "phone","21999999999",
              "institutionalEmail","dup@teste.com",
              "password", TestSecrets.PASSWORD
          );
          mockMvc.perform(post("/api/auth/signup")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isBadRequest())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("CPF já cadastrado")));
      }

      @Test
      @DisplayName("/me retorna dados quando autenticado")
      void me_ok() throws Exception {
          String cpf = "55544433322";
          User u = new User();
          u.setCpf(cpf); u.setName("Pessoa Teste"); u.setMatricula("MAT9"); u.setInstitutionalEmail("pessoa@teste.com");
          Mockito.when(userRepository.findByCpf(cpf)).thenReturn(Optional.of(u));
          var principal = new org.springframework.security.core.userdetails.User(cpf, "pwd", java.util.List.of());
          SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, "pwd", java.util.List.of()));
          mockMvc.perform(post("/api/auth/me").contentType(MediaType.APPLICATION_JSON))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.cpf").value(cpf))
              .andExpect(jsonPath("$.name").value("Pessoa Teste"));
      }

      @Test
      @DisplayName("/me sem autenticação => 401")
      void me_unauthorized() throws Exception {
          SecurityContextHolder.clearContext();
          mockMvc.perform(post("/api/auth/me").contentType(MediaType.APPLICATION_JSON))
              .andExpect(status().isUnauthorized());
      }

      @Test
      @DisplayName("/reset-password sucesso")
      void resetPassword_ok() throws Exception {
          // Simula serviço retornando mensagem de sucesso
          Mockito.when(passwordResetService.resetPassword(eq("TOKEN123"), eq(TestSecrets.RESET_PASSWORD)))
              .thenReturn(new com.medcheckapi.user.dto.ApiMessage("Senha redefinida com sucesso"));
          var payload = java.util.Map.of("token","TOKEN123","password", TestSecrets.RESET_PASSWORD);
          mockMvc.perform(post("/api/auth/reset-password")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Senha redefinida")));
      }

      @Test
      @DisplayName("/reset-password token faltando => 400")
      void resetPassword_missingToken() throws Exception {
          var payload = java.util.Map.of("password", TestSecrets.RESET_PASSWORD);
          mockMvc.perform(post("/api/auth/reset-password")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isBadRequest());
      }

      @Test
      @DisplayName("/reset-password senha curta => 400")
      void resetPassword_shortPassword() throws Exception {
          var payload = java.util.Map.of("token","ABCD","password","123");
          mockMvc.perform(post("/api/auth/reset-password")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isBadRequest())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Senha muito curta")));
      }

      @Test
      @DisplayName("/forgot-password dispara serviço e sempre 200")
      void forgotPassword_ok() throws Exception {
          var payload = java.util.Map.of("email","teste@dominio.com");
          mockMvc.perform(post("/api/auth/forgot-password")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.message").exists());
          Mockito.verify(passwordResetService).createAndSendToken("teste@dominio.com");
      }

      @Test
      @DisplayName("/signup rejeita CPF inválido")
      void signup_invalidCpf() throws Exception {
          var payload = java.util.Map.of(
              "name","Bad CPF",
              "birthDate","2000-01-01",
              "matricula","X1",
              "cpf","11111111111",
              "naturalidade","SP",
              "nacionalidade","Brasil",
              "phone","11999999999",
              "institutionalEmail","badcpf@teste.com",
              "password", TestSecrets.PASSWORD
          );
          mockMvc.perform(post("/api/auth/signup")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(payload)))
              .andExpect(status().isBadRequest())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("CPF inválido")));
      }

      @Test
      @DisplayName("/signin credenciais inválidas => 401")
      void signin_invalidCredentials() throws Exception {
          Mockito.when(authenticationManager.authenticate(any())).thenThrow(new org.springframework.security.authentication.BadCredentialsException("Bad"));
          var body = java.util.Map.of("cpf","12345678901","password","xxx");
          mockMvc.perform(post("/api/auth/signin")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(body)))
              .andExpect(status().isUnauthorized())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Credenciais inválidas")));
      }

      @Test
      @DisplayName("/forgot-password email inexistente retorna OK e não salva token")
      void forgotPassword_userNotFound() throws Exception {
          // userRepository.findAll() vazio por default -> createAndSendToken deve retornar sem salvar
          mockMvc.perform(post("/api/auth/forgot-password")
              .contentType(MediaType.APPLICATION_JSON)
              .content(objectMapper.writeValueAsString(java.util.Map.of("email","naoexiste@dom.com"))))
              .andExpect(status().isOk());
          // passwordResetService mock não consegue verificar tokenRepo interno aqui, mas garante chamada createAndSendToken
          Mockito.verify(passwordResetService).createAndSendToken("naoexiste@dom.com");
      }

      @Test
      @DisplayName("/user/{cpf} delete existente")
      void deleteUser_ok() throws Exception {
          User u = new User(); u.setCpf("44433322211");
          Mockito.when(userRepository.findByCpf("44433322211")).thenReturn(java.util.Optional.of(u));
          mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/auth/user/444.333.222-11"))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("removido")));
          Mockito.verify(userRepository).delete(u);
      }

      @Test
      @DisplayName("/user/{cpf} delete não encontrado => 404")
      void deleteUser_notFound() throws Exception {
          Mockito.when(userRepository.findByCpf("00011122233")).thenReturn(java.util.Optional.empty());
          mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/auth/user/00011122233"))
              .andExpect(status().isNotFound());
      }

      @Test
      @DisplayName("/users delete todos")
      void deleteAllUsers_ok() throws Exception {
          mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/auth/users"))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.message").exists());
          Mockito.verify(userRepository).deleteAll();
      }
}
