package com.medcheckapi.user.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Autowired;
import com.medcheckapi.user.config.props.AppProperties;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Date;

@Component
public class JwtTokenProvider {

    @Autowired
    private AppProperties appProperties;

    private javax.crypto.SecretKey key() {
        // Accept plain text or Base64; if length < 64 bytes, pad by hashing style repetition (dev convenience)
    String jwtSecret = appProperties.getJwtSecret();
    byte[] raw = jwtSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        // If it's Base64 try decode (without failing if not)
        if (jwtSecret.matches("^[A-Za-z0-9+/=]+$")) {
            try { raw = Decoders.BASE64.decode(jwtSecret); } catch (IllegalArgumentException ignored) {}
        }
        if (raw.length < 64) { // HS512 needs >= 64 bytes (512 bits)
            byte[] expanded = new byte[64];
            for (int i = 0; i < expanded.length; i++) {
                expanded[i] = raw[i % raw.length];
            }
            raw = expanded;
        }
        return Keys.hmacShaKeyFor(raw);
    }

    public String generateToken(Authentication authentication) {
        org.springframework.security.core.userdetails.User userPrincipal = (org.springframework.security.core.userdetails.User) authentication.getPrincipal();

        Date now = new Date();
    Date expiryDate = new Date(now.getTime() + appProperties.getJwtExpirationInMs());

    return Jwts.builder()
        .setSubject(userPrincipal.getUsername())
        .setIssuedAt(new Date())
        .setExpiration(expiryDate)
        .signWith(key(), SignatureAlgorithm.HS512)
        .compact();
    }

    public String getCpfFromJWT(String token) {
    Claims claims = Jwts.parserBuilder()
        .setSigningKey(key())
        .build()
        .parseClaimsJws(token)
        .getBody();

        return claims.getSubject();
    }


    public boolean validateToken(String authToken) {
        try {
            Jwts.parserBuilder().setSigningKey(key()).build().parseClaimsJws(authToken);
            return true;
        } catch (Exception ex) {
            // MalformedJwtException, ExpiredJwtException, UnsupportedJwtException, IllegalArgumentException
        }
        return false;
    }
}
