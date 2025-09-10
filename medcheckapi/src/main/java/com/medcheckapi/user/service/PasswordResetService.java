package com.medcheckapi.user.service;

import com.medcheckapi.user.dto.ApiMessage;
import com.medcheckapi.user.model.PasswordResetToken;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.PasswordResetTokenRepository;
import com.medcheckapi.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.reset.expiration.minutes:30}")
    private long expirationMinutes;

    @Value("${app.reset.base-url:http://localhost:4200/reset-password}")
    private String baseUrl;

    // Se nao definido app.mail.from, usa spring.mail.username; se tambem vazio, fica null
    @Value("${app.mail.from:${spring.mail.username:}}")
    private String mailFrom;

    @Value("${app.reset.log-link:true}")
    private boolean logLink;

    @Value("${spring.mail.username:}")
    private String smtpUser;

    @Value("${spring.mail.password:}")
    private String smtpPass;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                JavaMailSender mailSender,
                                PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.mailSender = mailSender;
        this.passwordEncoder = passwordEncoder;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Transactional
    public void createAndSendToken(String email) {
        Optional<User> opt = userRepository.findAll().stream()
                .filter(u -> email.equalsIgnoreCase(u.getInstitutionalEmail()))
                .findFirst();
        if (opt.isEmpty()) {
            // Não revela inexistência
            return;
        }
        User user = opt.get();
        PasswordResetToken token = new PasswordResetToken();
        token.setToken(generateToken());
        token.setUser(user);
        token.setExpiresAt(Instant.now().plus(expirationMinutes, ChronoUnit.MINUTES));
        tokenRepository.save(token);

        String link = baseUrl + "?token=" + token.getToken();
        if (logLink) {
            log.info("[RESET_LINK] link={} expiresAt={} userEmail={}", link, token.getExpiresAt(), user.getInstitutionalEmail());
        }
        // Se credenciais SMTP ausentes, apenas loga (já evitamos exception ruidosa em dev)
        if (smtpUser == null || smtpUser.isBlank() || smtpPass == null || smtpPass.isBlank()) {
            log.warn("[RESET_EMAIL] Credenciais SMTP ausentes (spring.mail.username/password). Email NAO enviado. Link acima pode ser usado para testes.");
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setTo(user.getInstitutionalEmail());
            if (mailFrom != null && !mailFrom.isBlank()) {
                msg.setFrom(mailFrom);
            }
            msg.setSubject("Redefinição de Senha");
            msg.setText("Olá,\n\nClique no link para redefinir sua senha: " + link + "\n\nSe não solicitou, ignore.");
            mailSender.send(msg);
            log.info("[RESET_EMAIL] Sent reset email to {}", user.getInstitutionalEmail());
        } catch (Exception e) {
            log.error("[RESET_EMAIL] Failed to send email", e);
        }
    }

    @Transactional
    public ApiMessage resetPassword(String tokenValue, String newPassword) {
        PasswordResetToken token = tokenRepository.findByToken(tokenValue)
                .orElse(null);
        if (token == null) return new ApiMessage("Token inválido");
        if (token.isUsed()) return new ApiMessage("Token já utilizado");
        if (token.getExpiresAt().isBefore(Instant.now())) return new ApiMessage("Token expirado");
        User user = token.getUser();
        if (user == null) return new ApiMessage("Token inválido");
        user.setPassword(passwordEncoder.encode(newPassword));
        token.setUsed(true);
        log.info("[RESET] Password updated for user id={}", user.getId());
        return new ApiMessage("Senha redefinida com sucesso");
    }
}
