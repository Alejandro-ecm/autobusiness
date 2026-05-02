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
