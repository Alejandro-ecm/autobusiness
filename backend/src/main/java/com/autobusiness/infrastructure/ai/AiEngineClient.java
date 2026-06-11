package com.autobusiness.infrastructure.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
public class AiEngineClient {

    private final WebClient webClient;

    public AiEngineClient(@Value("${ai.engine.url}") String aiEngineUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(aiEngineUrl)
                .build();
    }

    public void triggerAnalysis(UUID businessId) {
        webClient.post()
                .uri("/analyze/{businessId}", businessId)
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(e -> {
                    log.warn("AI Engine unreachable: {}", e.getMessage());
                    return Mono.empty();
                })
                .subscribe();
    }

    /** Pide al motor la respuesta del Vendedor IA para un mensaje de cliente. */
    public Map<?, ?> vendedorReply(UUID businessId, String text, boolean test) {
        return vendedorReply(businessId, text, test, "whatsapp");
    }

    public Map<?, ?> vendedorReply(UUID businessId, String text, boolean test, String channel) {
        try {
            return webClient.post()
                    .uri("/vendedor/{businessId}/reply", businessId)
                    .bodyValue(Map.of("text", text, "test", test, "channel", channel))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("Vendedor IA unreachable: {}", e.getMessage());
            throw new IllegalStateException("El motor de IA no está disponible en este momento");
        }
    }

    public Map<?, ?> getInsights(UUID businessId) {
        try {
            return webClient.get()
                    .uri("/insights/{businessId}", businessId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("Could not fetch AI insights: {}", e.getMessage());
            return Map.of();
        }
    }
}
