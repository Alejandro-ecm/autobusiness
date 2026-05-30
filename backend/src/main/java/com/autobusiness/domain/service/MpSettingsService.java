package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.repository.BusinessRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MpSettingsService {

    private final BusinessRepository businessRepo;
    private final WebClient.Builder webClientBuilder;

    @Value("${mercadopago.client-id:}")
    private String clientId;

    @Value("${mercadopago.client-secret:}")
    private String clientSecret;

    @Value("${mercadopago.oauth-redirect-uri:}")
    private String oauthRedirectUri;

    private static final String MP_AUTH_URL = "https://auth.mercadopago.com.mx/authorization";
    private static final String MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
    private static final String MP_ME_URL    = "https://api.mercadopago.com/users/me";

    public Map<String, Object> getStatus(UUID businessId) {
        Business biz = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        boolean connected = biz.getMpAccessToken() != null && !biz.getMpAccessToken().isBlank();
        Map<String, Object> result = new HashMap<>();
        result.put("connected",    connected);
        result.put("mpUserId",     biz.getMpUserId());
        result.put("mpPublicKey",  biz.getMpPublicKey());
        result.put("connectedAt",  biz.getMpConnectedAt());
        result.put("oauthEnabled", !clientId.isBlank() && !clientSecret.isBlank());
        return result;
    }

    public Map<String, Object> getConnectUrl(UUID businessId) {
        if (clientId.isBlank()) {
            throw new IllegalStateException("OAuth no configurado en este servidor. Usa token manual.");
        }
        String state = businessId.toString();
        String url = MP_AUTH_URL
                + "?client_id=" + clientId
                + "&response_type=code"
                + "&platform_id=mp"
                + "&redirect_uri=" + oauthRedirectUri
                + "&state=" + state;
        return Map.of("url", url);
    }

    @Transactional
    public String completeOAuth(String code, String state) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            throw new IllegalStateException("OAuth no configurado");
        }
        UUID businessId;
        try {
            businessId = UUID.fromString(state);
        } catch (Exception e) {
            throw new IllegalArgumentException("State inválido");
        }

        // Intercambiar código por tokens
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type",    "authorization_code");
        params.add("client_id",     clientId);
        params.add("client_secret", clientSecret);
        params.add("code",          code);
        params.add("redirect_uri",  oauthRedirectUri);

        WebClient client = webClientBuilder.baseUrl("https://api.mercadopago.com")
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                .build();

        @SuppressWarnings("unchecked")
        Map<String, Object> tokens = client.post()
                .uri("/oauth/token")
                .body(BodyInserters.fromFormData(params))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (tokens == null || tokens.containsKey("error")) {
            String err = tokens != null ? tokens.getOrDefault("message", "Error MP OAuth").toString() : "Sin respuesta";
            log.error("MP OAuth token exchange failed: {}", err);
            throw new IllegalStateException("Error al conectar Mercado Pago: " + err);
        }

        storeTokens(businessId, tokens);
        log.info("MP OAuth connected for business {}", businessId);
        return businessId.toString();
    }

    @Transactional
    public Map<String, Object> connectManual(UUID businessId, String accessToken, String publicKey) {
        Business biz = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        boolean hasNewToken = accessToken != null && !accessToken.isBlank();

        // If no new token provided, require the business to already have one
        if (!hasNewToken) {
            if (biz.getMpAccessToken() == null || biz.getMpAccessToken().isBlank()) {
                throw new IllegalArgumentException("Access Token requerido para conectar Mercado Pago.");
            }
            // Only updating public key
            if (publicKey != null && !publicKey.isBlank()) {
                biz.setMpPublicKey(publicKey);
                businessRepo.save(biz);
                log.info("MP public key updated for business {}", businessId);
            } else {
                throw new IllegalArgumentException("Ingresa al menos el Access Token o el Public Key.");
            }
            return Map.of("connected", true, "mpUserId", biz.getMpUserId() != null ? biz.getMpUserId() : "");
        }

        // Validate new access token against MP API
        WebClient client = webClientBuilder.baseUrl("https://api.mercadopago.com")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .build();

        @SuppressWarnings("unchecked")
        Map<String, Object> me = client.get()
                .uri("/users/me")
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorReturn(Map.of("error", "invalid_token"))
                .block();

        if (me == null || me.containsKey("error")) {
            throw new IllegalArgumentException("Token de Mercado Pago inválido. Verifica que sea un Access Token de producción.");
        }

        biz.setMpAccessToken(accessToken);
        biz.setMpUserId(me.getOrDefault("id", "").toString());
        String resolvedKey = (publicKey != null && !publicKey.isBlank())
                ? publicKey
                : me.getOrDefault("public_key", "").toString();
        if (!resolvedKey.isBlank()) biz.setMpPublicKey(resolvedKey);
        biz.setMpConnectedAt(Instant.now());
        biz.setMpRefreshToken(null);
        businessRepo.save(biz);

        log.info("MP manual token connected for business {} user {}", businessId, biz.getMpUserId());
        return Map.of("connected", true, "mpUserId", biz.getMpUserId());
    }

    @Transactional
    public void disconnect(UUID businessId) {
        Business biz = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        biz.setMpAccessToken(null);
        biz.setMpRefreshToken(null);
        biz.setMpUserId(null);
        biz.setMpPublicKey(null);
        biz.setMpConnectedAt(null);
        businessRepo.save(biz);
        log.info("MP disconnected for business {}", businessId);
    }

    public String getBusinessToken(UUID businessId) {
        return businessRepo.findById(businessId)
                .map(Business::getMpAccessToken)
                .orElse(null);
    }

    private void storeTokens(UUID businessId, Map<String, Object> tokens) {
        Business biz = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        biz.setMpAccessToken(tokens.getOrDefault("access_token", "").toString());
        biz.setMpRefreshToken(tokens.containsKey("refresh_token")
                ? tokens.get("refresh_token").toString() : null);
        biz.setMpUserId(tokens.containsKey("user_id")
                ? tokens.get("user_id").toString() : null);
        biz.setMpPublicKey(tokens.containsKey("public_key")
                ? tokens.get("public_key").toString() : null);
        biz.setMpConnectedAt(Instant.now());
        businessRepo.save(biz);
    }
}
