package com.medcheckapi.user.controller;

import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserRepository userRepository;
    public UserController(UserRepository userRepository) { this.userRepository = userRepository; }

    @GetMapping("/{id}/photo")
    public ResponseEntity<?> getUserPhoto(@PathVariable Long id) {
        Optional<User> opt = userRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        User u = opt.get();
        if (u.getAvatar() == null || u.getAvatar().length == 0) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(u.getAvatarContentType() != null ? MediaType.parseMediaType(u.getAvatarContentType()) : MediaType.IMAGE_JPEG)
                .body(u.getAvatar());
    }
}
