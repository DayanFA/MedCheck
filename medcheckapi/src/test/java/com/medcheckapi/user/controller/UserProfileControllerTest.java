package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.Role;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setup() {
        user = new User();
        user.setId(1L);
        user.setName("Test User");
        user.setCpf("12345678900");
        user.setRole(Role.ALUNO);
        user.setPhone("11999999999");
        when(userRepository.findByCpf(anyString())).thenReturn(Optional.of(user));
    }

    @Test
    @WithMockUser(username = "12345678900")
    void getMe_returnsProfile() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Test User")))
                .andExpect(jsonPath("$.cpf", is("12345678900")))
                .andExpect(jsonPath("$.phone", is("11999999999")))
                .andExpect(jsonPath("$.hasAvatar", is(false)));
    }

    @Test
    @WithMockUser(username = "12345678900")
    void put_rejectsEmptyPhone() throws Exception {
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("Telefone")));
    }

    @Test
    @WithMockUser(username = "12345678900")
    void put_acceptsValidPhone() throws Exception {
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"11987654321\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok", is(true)));
    }

    @Test
    @WithMockUser(username = "12345678900")
    void getPhoto_notFoundWhenNoAvatar() throws Exception {
        user.setAvatar(null);
        mockMvc.perform(get("/api/users/me/photo"))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "12345678900")
    void postPhoto_thenGetPhotoReturnsImage() throws Exception {
    byte[] img = "fakeimage".getBytes(StandardCharsets.UTF_8);
    when(userRepository.save(Mockito.any(User.class))).thenAnswer(inv -> inv.getArgument(0));

    MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png", img);
    mockMvc.perform(multipart("/api/users/me/photo")
            .file(file)
            .contentType(MediaType.MULTIPART_FORM_DATA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok", is(true)));

        user.setAvatar(img);
        user.setAvatarContentType("image/png");

        mockMvc.perform(get("/api/users/me/photo"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(header().string("Content-Type", "image/png"));
    }

    @Test
    @WithMockUser(username = "12345678900")
    void deletePhoto_removesAvatar() throws Exception {
        user.setAvatar("x".getBytes(StandardCharsets.UTF_8));
        user.setAvatarContentType("image/jpeg");
        when(userRepository.save(Mockito.any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(delete("/api/users/me/photo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok", is(true)));
    }
}
