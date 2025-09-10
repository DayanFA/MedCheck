package com.medcheckapi.user.security;

import com.medcheckapi.user.config.props.AppProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.User;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider buildProvider() {
        AppProperties props = new AppProperties();
        props.setJwtSecret("TestSecretKey-For-JWT-0123456789ABCDEFGHIJKLMNOPQRSTUV");
        props.setJwtExpirationInMs(3600000); // 1h
        JwtTokenProvider provider = new JwtTokenProvider();
        // injetar manualmente
        try {
            var f = JwtTokenProvider.class.getDeclaredField("appProperties");
            f.setAccessible(true);
            f.set(provider, props);
        } catch (Exception e) { throw new RuntimeException(e); }
        return provider;
    }

    @Test
    @DisplayName("Gera e valida token JWT")
    void generate_and_validate() {
        JwtTokenProvider provider = buildProvider();
        User principal = new User("12345678900", "pwd", java.util.List.of());
        var auth = new UsernamePasswordAuthenticationToken(principal, "pwd", principal.getAuthorities());
        String token = provider.generateToken(auth);
        assertThat(token).isNotBlank();
        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getCpfFromJWT(token)).isEqualTo("12345678900");
    }

    @Test
    @DisplayName("Token inválido retorna false")
    void invalid_token() {
        JwtTokenProvider provider = buildProvider();
        assertThat(provider.validateToken("abc.def.ghi")).isFalse();
    }
}