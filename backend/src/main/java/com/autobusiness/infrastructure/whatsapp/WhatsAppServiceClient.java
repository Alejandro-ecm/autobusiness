package com.autobusiness.infrastructure.whatsapp;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;
import java.util.UUID;

/**
 * Proxy al microservicio Node.js (Baileys) que mantiene las sesiones de WhatsApp.
 * El frontend nunca habla directo con ese servicio: todo pasa por aquí con el
 * businessId del token JWT, y se autentica con un token interno compartido.
 */
@Component
@Slf4j
public class WhatsAppServiceClient {

    private final WebClient webClient;

    public WhatsAppServiceClient(
            @Value("${whatsapp.service-url}") String serviceUrl,
            @Value("${whatsapp.internal-token}") String internalToken) {
        this.webClient = WebClient.builder()
                .baseUrl(serviceUrl)
                .defaultHeader("x-internal-token", internalToken)
                .build();
    }

    public Map<?, ?> connect(UUID businessId) {
        return call(() -> webClient.post()
                .uri("/sessions/{businessId}/connect", businessId)
                .retrieve()
                .bodyToMono(Map.class)
                .block());
    }

    public Map<?, ?> status(UUID businessId) {
        return call(() -> webClient.get()
                .uri("/sessions/{businessId}/status", businessId)
                .retrieve()
                .bodyToMono(Map.class)
                .block());
    }

    public Map<?, ?> logout(UUID businessId) {
        return call(() -> webClient.post()
                .uri("/sessions/{businessId}/logout", businessId)
                .retrieve()
                .bodyToMono(Map.class)
                .block());
    }

    private Map<?, ?> call(java.util.function.Supplier<Map> request) {
        try {
            Map<?, ?> res = request.get();
            return res != null ? res : Map.of();
        } catch (Exception e) {
            log.warn("WhatsApp service unreachable: {}", e.getMessage());
            throw new IllegalStateException("El servicio de WhatsApp no está disponible en este momento — intenta más tarde");
        }
    }
}
