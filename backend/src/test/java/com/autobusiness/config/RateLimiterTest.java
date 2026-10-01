package com.autobusiness.config;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimiterTest {

    private final RateLimiter rateLimiter = new RateLimiter();

    @Test
    void dosIpsDistintasTienenContadoresIndependientes() {
        Duration window = Duration.ofMinutes(15);

        assertTrue(rateLimiter.allow("forgot-password-ip:1.1.1.1", 2, window));
        assertTrue(rateLimiter.allow("forgot-password-ip:1.1.1.1", 2, window));
        assertFalse(rateLimiter.allow("forgot-password-ip:1.1.1.1", 2, window));

        // La IP distinta no se ve afectada por el agotamiento de la anterior.
        assertTrue(rateLimiter.allow("forgot-password-ip:2.2.2.2", 2, window));
        assertTrue(rateLimiter.allow("forgot-password-ip:2.2.2.2", 2, window));
    }

    @Test
    void mismoEmailDesdeMuchasIpsDistintasSeBloqueaPorElLimiteDeEmail() {
        Duration window = Duration.ofMinutes(15);
        String emailKey = "forgot-password-email:dueno@demo.com";

        // Simula 3 intentos desde 3 IPs distintas: el rate limit por IP no
        // los frena (cada IP tiene su propio contador independiente), pero
        // el agregado por email sí, porque todos comparten la misma key.
        assertTrue(rateLimiter.allow("forgot-password-ip:10.0.0.1", 5, window));
        assertTrue(rateLimiter.allow(emailKey, 3, window));

        assertTrue(rateLimiter.allow("forgot-password-ip:10.0.0.2", 5, window));
        assertTrue(rateLimiter.allow(emailKey, 3, window));

        assertTrue(rateLimiter.allow("forgot-password-ip:10.0.0.3", 5, window));
        assertTrue(rateLimiter.allow(emailKey, 3, window));

        // Cuarta IP distinta, pero mismo email -> bloqueado por el límite de email.
        assertTrue(rateLimiter.allow("forgot-password-ip:10.0.0.4", 5, window));
        assertFalse(rateLimiter.allow(emailKey, 3, window));
    }

    @Test
    void entradasExpiradasSePurganDelMapaRaiz() {
        rateLimiter.allow("forgot-password-ip:3.3.3.3", 5, Duration.ofMinutes(15));
        assertEquals(1, rateLimiter.trackedKeyCount());

        // Duration.ZERO fuerza el cutoff a "ahora", así el timestamp recién
        // insertado (estrictamente anterior) queda del lado vencido sin
        // tener que esperar los 30 minutos reales de retención.
        rateLimiter.cleanup(Duration.ZERO);

        assertEquals(0, rateLimiter.trackedKeyCount());
    }

    @Test
    void laLimpiezaNoBorraEntradasActivasDentroDeLaRetencion() {
        rateLimiter.allow("forgot-password-ip:4.4.4.4", 5, Duration.ofMinutes(15));

        rateLimiter.cleanup(Duration.ofMinutes(30));

        assertEquals(1, rateLimiter.trackedKeyCount());
    }
}
