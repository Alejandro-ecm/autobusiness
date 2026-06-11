package com.autobusiness.domain.service;

import com.autobusiness.domain.model.InstagramAccount;
import com.autobusiness.domain.repository.InstagramAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Vendedor IA · Instagram — integración oficial "Instagram API with Instagram Login".
 * Cada negocio conecta su cuenta profesional de Instagram vía OAuth; los DMs llegan
 * por webhook y se responden con el motor local del ai-engine.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InstagramService {

    private final InstagramAccountRepository igRepo;
    private final WebClient.Builder webClientBuilder;

    @Value("${instagram.app-id:}")
    private String appId;

    @Value("${instagram.app-secret:}")
    private String appSecret;

    @Value("${instagram.redirect-uri:}")
    private String redirectUri;

    private static final String IG_AUTH_URL  = "https://www.instagram.com/oauth/authorize";
    private static final String IG_API_BASE  = "https://api.instagram.com";
    private static final String IG_GRAPH     = "https://graph.instagram.com";
    private static final String GRAPH_VERSION = "v23.0";
    private static final String SCOPES = "instagram_business_basic,instagram_business_manage_messages";

    public boolean oauthConfigured() {
        return !appId.isBlank() && !appSecret.isBlank();
    }

    public Map<String, Object> getStatus(UUID businessId) {
        Map<String, Object> result = new HashMap<>();
        result.put("oauthEnabled", oauthConfigured());
        igRepo.findByBusinessId(businessId).ifPresentOrElse(acc -> {
            result.put("connected", true);
            result.put("username", acc.getUsername());
            result.put("connectedAt", acc.getConnectedAt());
        }, () -> result.put("connected", false));
        return result;
    }

    public Map<String, Object> getConnectUrl(UUID businessId) {
        if (!oauthConfigured()) {
            throw new IllegalStateException("La conexión con Instagram aún no está configurada en este servidor.");
        }
        String url = IG_AUTH_URL
                + "?client_id=" + appId
                + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                + "&response_type=code"
                + "&scope=" + SCOPES
                + "&state=" + businessId;
        return Map.of("url", url);
    }

    @Transactional
    public void completeOAuth(String code, String state) {
        UUID businessId;
        try {
            businessId = UUID.fromString(state);
        } catch (Exception e) {
            throw new IllegalArgumentException("State inválido");
        }

        // 1. Código → token de corta duración
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("client_id",     appId);
        params.add("client_secret", appSecret);
        params.add("grant_type",    "authorization_code");
        params.add("redirect_uri",  redirectUri);
        params.add("code",          code);

        @SuppressWarnings("unchecked")
        Map<String, Object> shortToken = webClientBuilder.baseUrl(IG_API_BASE)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                .build()
                .post()
                .uri("/oauth/access_token")
                .body(BodyInserters.fromFormData(params))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (shortToken == null || !shortToken.containsKey("access_token")) {
            log.error("IG OAuth token exchange failed: {}", shortToken);
            throw new IllegalStateException("Instagram no entregó el token de acceso");
        }

        // 2. Token corto → token de larga duración (~60 días, renovable)
        @SuppressWarnings("unchecked")
        Map<String, Object> longToken = graphClient()
                .get()
                .uri(uri -> uri.path("/access_token")
                        .queryParam("grant_type", "ig_exchange_token")
                        .queryParam("client_secret", appSecret)
                        .queryParam("access_token", shortToken.get("access_token").toString())
                        .build())
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        String accessToken = longToken != null && longToken.containsKey("access_token")
                ? longToken.get("access_token").toString()
                : shortToken.get("access_token").toString();
        long expiresIn = longToken != null && longToken.containsKey("expires_in")
                ? ((Number) longToken.get("expires_in")).longValue()
                : 3600L;

        // 3. Perfil de la cuenta conectada
        @SuppressWarnings("unchecked")
        Map<String, Object> me = graphClient()
                .get()
                .uri(uri -> uri.path("/" + GRAPH_VERSION + "/me")
                        .queryParam("fields", "user_id,username")
                        .queryParam("access_token", accessToken)
                        .build())
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (me == null || (!me.containsKey("user_id") && !me.containsKey("id"))) {
            throw new IllegalStateException("No se pudo leer el perfil de Instagram");
        }
        String igUserId = me.getOrDefault("user_id", me.getOrDefault("id", "")).toString();
        String username = me.getOrDefault("username", "").toString();

        // Si esa cuenta IG estaba ligada a otro negocio, se reasigna al actual
        igRepo.findByIgUserId(igUserId).ifPresent(other -> {
            if (!other.getBusinessId().equals(businessId)) igRepo.delete(other);
        });

        InstagramAccount acc = igRepo.findByBusinessId(businessId)
                .orElseGet(() -> InstagramAccount.builder().businessId(businessId).build());
        acc.setIgUserId(igUserId);
        acc.setUsername(username);
        acc.setAccessToken(accessToken);
        acc.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
        igRepo.save(acc);
        log.info("Instagram conectado para business {} (@{})", businessId, username);
    }

    @Transactional
    public void disconnect(UUID businessId) {
        igRepo.findByBusinessId(businessId).ifPresent(igRepo::delete);
        log.info("Instagram desconectado para business {}", businessId);
    }

    /** Envía un DM de texto como la cuenta del negocio. */
    public void sendMessage(InstagramAccount account, String recipientIgsid, String text) {
        Map<String, Object> body = Map.of(
                "recipient", Map.of("id", recipientIgsid),
                "message", Map.of("text", text)
        );
        try {
            graphClient()
                    .post()
                    .uri("/" + GRAPH_VERSION + "/me/messages")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + account.getAccessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.error("Error enviando DM de Instagram (business {}): {}", account.getBusinessId(), e.getMessage());
        }
    }

    /** Renueva diario los tokens que vencen en menos de 15 días (duran ~60). */
    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void refreshExpiringTokens() {
        Instant limit = Instant.now().plus(15, ChronoUnit.DAYS);
        for (InstagramAccount acc : igRepo.findByTokenExpiresAtBefore(limit)) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> refreshed = graphClient()
                        .get()
                        .uri(uri -> uri.path("/refresh_access_token")
                                .queryParam("grant_type", "ig_refresh_token")
                                .queryParam("access_token", acc.getAccessToken())
                                .build())
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();
                if (refreshed != null && refreshed.containsKey("access_token")) {
                    acc.setAccessToken(refreshed.get("access_token").toString());
                    long expiresIn = ((Number) refreshed.getOrDefault("expires_in", 5184000L)).longValue();
                    acc.setTokenExpiresAt(Instant.now().plusSeconds(expiresIn));
                    igRepo.save(acc);
                    log.info("Token de Instagram renovado para business {}", acc.getBusinessId());
                }
            } catch (Exception e) {
                log.warn("No se pudo renovar token IG de business {}: {}", acc.getBusinessId(), e.getMessage());
            }
        }
    }

    private WebClient graphClient() {
        return webClientBuilder.baseUrl(IG_GRAPH).build();
    }
}
