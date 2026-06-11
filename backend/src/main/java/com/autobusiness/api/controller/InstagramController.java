package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.InstagramAccount;
import com.autobusiness.domain.repository.InstagramAccountRepository;
import com.autobusiness.domain.service.InstagramService;
import com.autobusiness.infrastructure.ai.AiEngineClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class InstagramController {

    private final InstagramService instagramService;
    private final InstagramAccountRepository igRepo;
    private final AiEngineClient aiEngineClient;

    @Value("${app.base-url}")
    private String appBaseUrl;

    @Value("${instagram.verify-token}")
    private String verifyToken;

    // ── Panel (requiere JWT) ──────────────────────────────────────────────────

    @GetMapping("/settings/instagram")
    public ResponseEntity<?> status(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(instagramService.getStatus(p.businessId()));
    }

    @GetMapping("/settings/instagram/connect-url")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> connectUrl(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(instagramService.getConnectUrl(p.businessId()));
    }

    @DeleteMapping("/settings/instagram")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> disconnect(@AuthenticationPrincipal AuthPrincipal p) {
        instagramService.disconnect(p.businessId());
        return ResponseEntity.ok(Map.of("connected", false));
    }

    /** Público — Instagram redirige aquí tras autorizar. */
    @GetMapping("/settings/instagram/oauth-callback")
    public ResponseEntity<?> oauthCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        if (error != null || code == null) {
            log.warn("IG OAuth callback error: {}", error);
            return redirect("/empleados-ia?ig_error=true");
        }
        try {
            instagramService.completeOAuth(code, state);
            return redirect("/empleados-ia?ig_connected=true");
        } catch (Exception e) {
            log.error("IG OAuth callback failed: {}", e.getMessage());
            return redirect("/empleados-ia?ig_error=true");
        }
    }

    // ── Webhook de Meta (público) ─────────────────────────────────────────────

    /** Verificación inicial del webhook (Meta manda hub.challenge). */
    @GetMapping("/webhooks/instagram")
    public ResponseEntity<String> verifyWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String token,
            @RequestParam(name = "hub.challenge", required = false) String challenge) {
        if ("subscribe".equals(mode) && verifyToken.equals(token)) {
            return ResponseEntity.ok(challenge);
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("verify token inválido");
    }

    /** DMs entrantes: Meta envía {object:"instagram", entry:[{id, messaging:[...]}]}. */
    @PostMapping("/webhooks/instagram")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> receiveWebhook(@RequestBody Map<String, Object> payload) {
        try {
            if (!"instagram".equals(payload.get("object"))) return ResponseEntity.ok("ignored");
            List<Map<String, Object>> entries = (List<Map<String, Object>>) payload.getOrDefault("entry", List.of());
            for (Map<String, Object> entry : entries) {
                String igUserId = String.valueOf(entry.get("id"));
                List<Map<String, Object>> events = (List<Map<String, Object>>) entry.getOrDefault("messaging", List.of());
                for (Map<String, Object> event : events) {
                    handleMessagingEvent(igUserId, event);
                }
            }
        } catch (Exception e) {
            // Nunca devolver error a Meta — reintentaría y podría desactivar el webhook
            log.error("Error procesando webhook de Instagram: {}", e.getMessage());
        }
        return ResponseEntity.ok("ok");
    }

    @SuppressWarnings("unchecked")
    private void handleMessagingEvent(String igUserId, Map<String, Object> event) {
        Map<String, Object> message = (Map<String, Object>) event.get("message");
        if (message == null) return;
        if (Boolean.TRUE.equals(message.get("is_echo"))) return; // mensajes enviados por nosotros
        Object text = message.get("text");
        if (text == null || text.toString().isBlank()) return;

        Map<String, Object> sender = (Map<String, Object>) event.get("sender");
        if (sender == null || sender.get("id") == null) return;
        String senderId = sender.get("id").toString();
        if (senderId.equals(igUserId)) return; // por si acaso: no responderse a sí mismo

        InstagramAccount account = igRepo.findByIgUserId(igUserId).orElse(null);
        if (account == null) {
            log.warn("DM de Instagram para cuenta no registrada: {}", igUserId);
            return;
        }

        Map<?, ?> res = aiEngineClient.vendedorReply(
                account.getBusinessId(), text.toString(), false, "instagram");
        Object reply = res.get("reply");
        if (reply != null && !reply.toString().isBlank()) {
            instagramService.sendMessage(account, senderId, reply.toString());
            log.info("DM respondido para business {} (@{})", account.getBusinessId(), account.getUsername());
        }
    }

    private ResponseEntity<?> redirect(String path) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(appBaseUrl + path))
                .build();
    }
}
