package com.autobusiness.infrastructure.analytics;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Component
@Slf4j
public class AlejandriaClient {

    private static final String BASE_URL  = "http://localhost:4000/api/v1";
    private static final String APP_KEY   = "sky_efc3246cfa66ab52547a92813ac6ed742d597ae1";
    private static final String APP_ID    = "353484de-801b-4f93-ae7b-e3ff059cf94d";

    private final WebClient webClient;

    public AlejandriaClient() {
        this.webClient = WebClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("X-Sky-App-Key", APP_KEY)
                .build();
    }

    public void trackMetric(String name, Number value, String unit) {
        webClient.post()
                .uri("/sky-apps/{appId}/metrics", APP_ID)
                .bodyValue(Map.of("name", name, "value", value, "unit", unit))
                .retrieve()
                .bodyToMono(Void.class)
                .onErrorResume(e -> {
                    log.debug("AlejandrIA metric unreachable: {}", e.getMessage());
                    return Mono.empty();
                })
                .subscribe();
    }
}
