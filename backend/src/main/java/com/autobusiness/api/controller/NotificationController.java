package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.PushSubscription;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.PushSubscriptionRepository;
import com.autobusiness.domain.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final PushSubscriptionRepository pushRepo;
    private final BusinessRepository businessRepo;

    /**
     * GET /api/notifications/vapid-key — clave pública VAPID para el Service Worker
     * En producción: generar con web-push keygen y almacenar en env
     */
    @GetMapping("/vapid-key")
    public ResponseEntity<?> vapidKey() {
        // Placeholder — reemplazar con clave VAPID real en producción
        return ResponseEntity.ok(Map.of(
                "publicKey", "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJHm-J1IsZtdpgb2h_kf9d0_9oc"
        ));
    }

    /** POST /api/notifications/subscribe — registrar dispositivo para push */
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(@AuthenticationPrincipal AuthPrincipal p,
                                        @RequestBody Map<String, Object> body) {
        String endpoint = body.get("endpoint").toString();
        @SuppressWarnings("unchecked")
        Map<String, String> keys = (Map<String, String>) body.get("keys");
        String p256dh    = keys.get("p256dh");
        String auth      = keys.get("auth");
        String userAgent = body.getOrDefault("userAgent", "").toString();

        Business business = businessRepo.findById(p.businessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        PushSubscription sub = pushRepo.findByEndpoint(endpoint).orElseGet(() -> {
            var s = new PushSubscription();
            s.setBusiness(business);
            s.setUserId(p.userId());
            s.setEndpoint(endpoint);
            s.setP256dh(p256dh);
            s.setAuth(auth);
            s.setUserAgent(userAgent);
            return s;
        });
        sub.setBusiness(business);
        sub.setUserId(p.userId());
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        pushRepo.save(sub);

        return ResponseEntity.ok(Map.of("subscribed", true));
    }

    /** DELETE /api/notifications/subscribe — eliminar suscripción */
    @DeleteMapping("/subscribe")
    public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
        pushRepo.deleteByEndpoint(body.get("endpoint"));
        return ResponseEntity.ok(Map.of("unsubscribed", true));
    }

    /**
     * POST /api/notifications/test — enviar notificación de prueba (solo dev/admin)
     */
    @PostMapping("/test")
    public ResponseEntity<?> test(@AuthenticationPrincipal AuthPrincipal p,
                                   @RequestBody(required = false) Map<String, String> body) {
        String title = body != null ? body.getOrDefault("title", "AutoBusiness") : "AutoBusiness";
        String msg   = body != null ? body.getOrDefault("body", "Notificación de prueba") : "Notificación de prueba";
        notificationService.sendToAll(p.businessId(), title, msg, "/dashboard");
        return ResponseEntity.ok(Map.of("sent", true));
    }
}
