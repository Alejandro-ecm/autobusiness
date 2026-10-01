package com.autobusiness.config;

import org.springframework.scheduling.annotation.Scheduled;
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
 *
 * Las claves vencidas (deque vacío) se purgan del mapa raíz periódicamente
 * (ver {@link #cleanup()}) y además de forma inmediata si el mapa crece más
 * de {@link #MAX_ENTRIES} — sin esto, cada IP/email distinto que alguna vez
 * llamó quedaría como entrada vacía para siempre.
 */
@Component
public class RateLimiter {

    // Mayor o igual a la ventana más larga usada por cualquier llamador —
    // si una entrada no tuvo actividad en este lapso, ya no aporta nada.
    private static final Duration RETENTION = Duration.ofMinutes(30);
    private static final int MAX_ENTRIES = 50_000;

    private final ConcurrentHashMap<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    public boolean allow(String key, int maxRequests, Duration window) {
        if (hits.size() > MAX_ENTRIES) {
            cleanup();
        }

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

    @Scheduled(fixedRate = 300_000)
    public void cleanup() {
        cleanup(RETENTION);
    }

    // Visible para que los tests fuercen una purga inmediata sin esperar
    // RETENTION real (pasando Duration.ZERO en vez del default de 30min).
    void cleanup(Duration retention) {
        Instant cutoff = Instant.now().minus(retention);
        hits.entrySet().removeIf(entry -> {
            Deque<Instant> timestamps = entry.getValue();
            synchronized (timestamps) {
                while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                    timestamps.pollFirst();
                }
                return timestamps.isEmpty();
            }
        });
    }

    // Visible para tests — tamaño real del mapa raíz (claves con al menos
    // un timestamp vigente, tras la última limpieza).
    int trackedKeyCount() {
        return hits.size();
    }
}
