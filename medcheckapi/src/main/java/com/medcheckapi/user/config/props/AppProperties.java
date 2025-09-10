package com.medcheckapi.user.config.props;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.Name;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    // Maps from property 'app.jwt-secret'
    @Name("jwt-secret")
    private String jwtSecret;
    // Maps from property 'app.jwt-expiration-in-ms'
    @Name("jwt-expiration-in-ms")
    private long jwtExpirationInMs;
    private Reset reset = new Reset();

    public static class Reset {
        @Name("expiration-minutes")
        private long expirationMinutes;
        private String baseUrl;
        private boolean logLink;
        public long getExpirationMinutes() { return expirationMinutes; }
        public void setExpirationMinutes(long expirationMinutes) { this.expirationMinutes = expirationMinutes; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public boolean isLogLink() { return logLink; }
        public void setLogLink(boolean logLink) { this.logLink = logLink; }
    }

    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
    public long getJwtExpirationInMs() { return jwtExpirationInMs; }
    public void setJwtExpirationInMs(long jwtExpirationInMs) { this.jwtExpirationInMs = jwtExpirationInMs; }
    public Reset getReset() { return reset; }
    public void setReset(Reset reset) { this.reset = reset; }
}
