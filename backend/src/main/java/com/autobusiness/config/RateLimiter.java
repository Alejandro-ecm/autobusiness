package com.autobusiness.config;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Limitador en memoria por ventana deslizante. No se comparte entre
 * instancias — el backend corre como una sola instancia en Railway, así que
 * es suficiente hoy. Si algún día se escala horizontalmente, esto necesita
 * moverse a un store compartido (ej. Redis).
 */
@Component
public class RateLimiter {

    private final ConcurrentHashMap<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public boolean allow(String key, int maxRequests, Duration window) {
        Deque<Instant> timestamps = hits.computeIfAbsent(key, k -> new ConcurrentLinkedDeque<>());
        Instant now = Instant.now();
        Instant cutoff = now.minus(window);

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }
}
