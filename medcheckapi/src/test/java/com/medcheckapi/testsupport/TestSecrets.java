package com.medcheckapi.testsupport;

import java.io.IOException;
import java.io.InputStream;
import java.security.SecureRandom;
import java.util.Properties;

public final class TestSecrets {
    private static final SecureRandom RNG = new SecureRandom();

    public static final String PASSWORD;
    public static final String RESET_PASSWORD;

    static {
        Properties p = new Properties();
        try (InputStream in = TestSecrets.class.getClassLoader().getResourceAsStream("test-secrets.properties")) {
            if (in != null) {
                p.load(in);
            }
        } catch (IOException ignored) {
        }
        PASSWORD = p.getProperty("test.password", generateStrongPassword());
        RESET_PASSWORD = p.getProperty("test.reset.password", generateStrongPassword());
    }

    private TestSecrets() {}

    private static String generateStrongPassword() {
        // At least 12 chars, include upper, lower, digit, special
        String upp = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        String low = "abcdefghijkmnopqrstuvwxyz";
        String dig = "23456789";
        String spe = "!@#$%^&*";
        String all = upp + low + dig + spe;
        StringBuilder sb = new StringBuilder();
        sb.append(randomChar(upp));
        sb.append(randomChar(low));
        sb.append(randomChar(dig));
        sb.append(randomChar(spe));
        for (int i = 0; i < 8; i++) sb.append(randomChar(all));
        return sb.toString();
    }

    private static char randomChar(String s) {
        return s.charAt(RNG.nextInt(s.length()));
    }
}
