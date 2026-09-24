package com.autobusiness.infrastructure.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/** Envío de correos transaccionales vía la API HTTP de Resend (sin SMTP). */
@Component
@Slf4j
public class ResendClient {

    private final WebClient webClient;
    private final String apiKey;
    private final String fromEmail;

    public ResendClient(@Value("${resend.api-key}") String apiKey,
                         @Value("${resend.from-email}") String fromEmail) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.webClient = WebClient.builder()
                .baseUrl("https://api.resend.com")
                .build();
    }

    public void sendHtml(String to, String subject, String html) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("RESEND_API_KEY no configurada — no se envió el correo a {} ({})", to, subject);
            return;
        }
        try {
            webClient.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .bodyValue(Map.of(
                            "from", fromEmail,
                            "to", java.util.List.of(to),
                            "subject", subject,
                            "html", html
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("No se pudo enviar el correo a {} vía Resend: {}", to, e.getMessage());
        }
    }
}
