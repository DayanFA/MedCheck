package com.medcheckapi.user.controller;

import com.medcheckapi.user.dto.LoginRequest;
import com.medcheckapi.user.dto.SignUpRequest;
import com.medcheckapi.user.model.User;
import com.medcheckapi.user.repository.UserRepository;
import com.medcheckapi.user.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import com.medcheckapi.user.dto.ApiMessage;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.medcheckapi.user.service.PasswordResetService;
import com.medcheckapi.user.repository.PasswordResetTokenRepository;
import com.medcheckapi.user.model.PasswordResetToken;
import org.springframework.core.env.Environment;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Autowired
    JwtTokenProvider tokenProvider;

    @Autowired
    PasswordResetService passwordResetService;

    @Autowired
    PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    Environment environment;

    @PostMapping("/signin")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
    String rawCpf = loginRequest.getCpf();
    String normalizedCpf = rawCpf != null ? rawCpf.replaceAll("\\D", "") : null;
    System.out.println("[AuthController] Attempt login raw='" + rawCpf + "' sanitized='" + normalizedCpf + "' passLen=" + (loginRequest.getPassword()==null?0:loginRequest.getPassword().length()));
    // Rebuild token with trimmed cpf to avoid trailing space auth failures
    Authentication authentication;
    try {
        authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                normalizedCpf,
                loginRequest.getPassword()
            )
        );
    } catch (AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiMessage("Credenciais inválidas"));
    }

        SecurityContextHolder.getContext().setAuthentication(authentication);

        String jwt = tokenProvider.generateToken(authentication);
        // enrich response with minimal user data for immediate UI use
        java.util.Map<String,Object> resp = new java.util.HashMap<>();
        resp.put("token", jwt);
        String cpf = authentication.getName();
        userRepository.findByCpf(cpf).ifPresent(u -> {
            // Incluímos o id para diferenciar de CPF no frontend (preceptorId real)
            resp.put("id", u.getId());
            resp.put("name", u.getName());
            resp.put("matricula", u.getMatricula());
            resp.put("cpf", u.getCpf());
            resp.put("email", u.getInstitutionalEmail());
            resp.put("role", u.getRole().name());
        });
        return ResponseEntity.ok(resp);
    }

    @PostMapping(value = "/signup", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> registerUser(@RequestBody SignUpRequest signUpRequest) {
        log.debug("[SIGNUP] Incoming payload name={} cpf={} email={} birthDate={} nat={} nac={} phone={}",
                signUpRequest.getName(), signUpRequest.getCpf(), signUpRequest.getInstitutionalEmail(),
                signUpRequest.getBirthDate(), signUpRequest.getNaturalidade(), signUpRequest.getNacionalidade(), signUpRequest.getPhone());
        try {
            if (signUpRequest.getCpf() == null || signUpRequest.getCpf().isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("CPF obrigatório"));
            }
            if (!isValidCpf(signUpRequest.getCpf())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("CPF inválido"));
            }
            if(userRepository.findByCpf(signUpRequest.getCpf()).isPresent()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("CPF já cadastrado"));
            }

            // Creating user's account
            User user = new User();
            user.setName(signUpRequest.getName());
            user.setBirthDate(signUpRequest.getBirthDate());
            user.setMatricula(signUpRequest.getMatricula());
            user.setCpf(signUpRequest.getCpf());
            user.setNaturalidade(signUpRequest.getNaturalidade());
            user.setNacionalidade(signUpRequest.getNacionalidade());
            user.setPhone(signUpRequest.getPhone());
            user.setInstitutionalEmail(signUpRequest.getInstitutionalEmail());
            user.setPassword(passwordEncoder.encode(signUpRequest.getPassword()));

            userRepository.save(user);
            log.info("[SIGNUP] User created cpf={}", user.getCpf());
            return ResponseEntity.ok(new ApiMessage("Usuário cadastrado com sucesso"));
        } catch (DataIntegrityViolationException dive) {
            log.warn("[SIGNUP] Data integrity violation: {}", dive.getMessage());
            String msg = "Violação de integridade";
            if (dive.getMessage() != null && dive.getMessage().toLowerCase().contains("institutional_email")) {
                msg = "E-mail já cadastrado";
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage(msg));
        } catch (Exception e) {
            log.error("[SIGNUP] Unexpected error", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("Erro ao processar cadastro"));
        }
    }

    @DeleteMapping(value = "/user/{cpf}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> deleteUserByCpf(@PathVariable String cpf){
        String digits = cpf != null ? cpf.replaceAll("\\D", "") : null;
        if (digits == null || digits.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("CPF inválido"));
        }
        return userRepository.findByCpf(digits)
            .map(u -> { userRepository.delete(u); log.info("[SIGNUP_DELETE] Deleted cpf={}", digits); return ResponseEntity.ok(new ApiMessage("Usuário removido")); })
            .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiMessage("Usuário não encontrado")));
    }

    // Endpoint de RESET para ambiente de teste: remove TODOS os usuários.
    @DeleteMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> deleteAllUsers(){
        userRepository.deleteAll();
        log.warn("[RESET] Todos os usuários foram removidos manualmente para novo teste");
        return ResponseEntity.ok(new ApiMessage("Todos os usuários removidos"));
    }

    @PostMapping(value = "/forgot-password", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> forgotPassword(@RequestBody java.util.Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiMessage("E-mail obrigatório"));
        }
        passwordResetService.createAndSendToken(email);
        return ResponseEntity.ok(new ApiMessage("Se o e-mail existir, enviaremos instruções"));
    }

    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> me(@AuthenticationPrincipal org.springframework.security.core.userdetails.User principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiMessage("Não autenticado"));
        }
        String cpf = principal.getUsername();
        java.util.Optional<User> opt = userRepository.findByCpf(cpf);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiMessage("Usuário não encontrado"));
        }
        User u = opt.get();
        java.util.Map<String,Object> resp = new java.util.HashMap<>();
    resp.put("id", u.getId());
    resp.put("name", u.getName());
    resp.put("cpf", u.getCpf());
    resp.put("matricula", u.getMatricula());
    resp.put("email", u.getInstitutionalEmail());
        resp.put("naturalidade", u.getNaturalidade());
        resp.put("nacionalidade", u.getNacionalidade());
        resp.put("phone", u.getPhone());
        resp.put("role", u.getRole().name());
        return ResponseEntity.ok(resp);
    }

    @PostMapping(value = "/reset-password", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> resetPassword(@RequestBody java.util.Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("password");
        if (token == null || token.isBlank()) return ResponseEntity.badRequest().body(new ApiMessage("Token obrigatório"));
        if (newPassword == null || newPassword.isBlank()) return ResponseEntity.badRequest().body(new ApiMessage("Senha obrigatória"));
        // força mínima (mesmo critério simplificado do front: >=6 + variedade) - pode ser expandido
        if (newPassword.length() < 6) return ResponseEntity.badRequest().body(new ApiMessage("Senha muito curta"));
        ApiMessage result = passwordResetService.resetPassword(token, newPassword);
        if (result.getMessage().startsWith("Senha redefinida")) return ResponseEntity.ok(result);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
    }

    // DEV ONLY: Recupera último token de reset por e-mail (facilita testes sem abrir DB). Remover em produção.
    @PostMapping(value = "/dev/last-reset-token", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getLastResetToken(@RequestBody java.util.Map<String,String> body){
        String email = body.get("email");
        if (email == null || email.isBlank()) return ResponseEntity.badRequest().body(new ApiMessage("E-mail obrigatório"));
        // busca usuário e tokens associados (varre tokens por simplicidade)
        PasswordResetToken token = passwordResetTokenRepository.findAll().stream()
            .filter(t -> t.getUser() != null && email.equalsIgnoreCase(t.getUser().getInstitutionalEmail()))
            .sorted((a,b) -> b.getId().compareTo(a.getId()))
            .findFirst().orElse(null);
        if (token == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiMessage("Nenhum token"));
        java.util.Map<String,Object> resp = new java.util.HashMap<>();
        resp.put("token", token.getToken());
        resp.put("expiresAt", token.getExpiresAt());
        resp.put("used", token.isUsed());
        return ResponseEntity.ok(resp);
    }

    // DEV ONLY: Exibe configuracao de mail carregada. REMOVER em produção.
    @GetMapping(value = "/dev/mail-config", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> mailConfig(){
        java.util.Map<String,Object> resp = new java.util.HashMap<>();
        String host = environment.getProperty("spring.mail.host");
        String port = environment.getProperty("spring.mail.port");
        String user = environment.getProperty("spring.mail.username");
        String from = environment.getProperty("app.mail.from", environment.getProperty("spring.mail.username"));
        String auth = environment.getProperty("spring.mail.properties.mail.smtp.auth","true");
        String starttls = environment.getProperty("spring.mail.properties.mail.smtp.starttls.enable","true");
        boolean canSend = (!"true".equalsIgnoreCase(auth)) || (user != null && !user.isBlank());
        resp.put("host", host);
        resp.put("port", port);
        resp.put("usernamePresent", user != null && !user.isBlank());
        resp.put("from", from);
        resp.put("auth", auth);
        resp.put("starttls", starttls);
        resp.put("canSendDerived", canSend);
        return ResponseEntity.ok(resp);
    }
    private boolean isValidCpf(String raw) {
        if (raw == null) return false;
        String cpf = raw.replaceAll("\\D", "");
        if (cpf.length() != 11 || cpf.matches("(\\d)\\1{10}")) return false;
        try {
            int d1 = calcDigit(cpf, 10);
            int d2 = calcDigit(cpf, 11);
            return d1 == Character.getNumericValue(cpf.charAt(9)) && d2 == Character.getNumericValue(cpf.charAt(10));
        } catch (Exception e) { return false; }
    }

    private int calcDigit(String cpf, int factor) {
        int total = 0;
        for (int i = 0; i < factor - 1; i++) {
            total += Character.getNumericValue(cpf.charAt(i)) * (factor - i);
        }
        int rest = (total * 10) % 11;
        return rest == 10 ? 0 : rest;
    }
}
