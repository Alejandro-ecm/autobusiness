package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.MercadoPagoService;
import com.autobusiness.domain.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/subscription")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final MercadoPagoService mpService;

    /** GET /api/subscription — estado actual de la suscripción */
    @GetMapping
    public ResponseEntity<?> status(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(subscriptionService.getStatus(p.businessId()));
    }

    /** GET /api/subscription/plans — todos los planes disponibles */
    @GetMapping("/plans")
    public ResponseEntity<?> plans() {
        return ResponseEntity.ok(SubscriptionService.getAllPlans());
    }

    /** POST /api/subscription/upgrade — generar link de pago para subir de plan */
    @PostMapping("/upgrade")
    @PreAuthorize("hasAnyRole('OWNER')")
    public ResponseEntity<?> upgrade(@AuthenticationPrincipal AuthPrincipal p,
                                      @RequestBody Map<String, String> body) {
        String plan = body.getOrDefault("plan", "BASIC").toUpperCase();
        try {
            Map<String, Object> paymentLink = mpService.createSubscriptionLink(p.businessId(), plan);
            return ResponseEntity.ok(Map.of(
                    "plan",       plan,
                    "initPoint",  paymentLink.get("initPoint"),
                    "sandboxPoint", paymentLink.get("sandboxPoint"),
                    "paymentId",  paymentLink.get("paymentId")
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** POST /api/subscription/cancel — cancelar suscripción */
    @PostMapping("/cancel")
    @PreAuthorize("hasAnyRole('OWNER')")
    public ResponseEntity<?> cancel(@AuthenticationPrincipal AuthPrincipal p,
                                     @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.getOrDefault("reason", "") : "";
        subscriptionService.cancelSubscription(p.businessId(), reason);
        return ResponseEntity.ok(Map.of("status", "CANCELED"));
    }

    /**
     * POST /api/subscription/activate — activa plan manualmente (callback de MP o admin)
     * Solo para desarrollo/testing — en prod el webhook activa automáticamente
     */
    @PostMapping("/activate")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> activate(@AuthenticationPrincipal AuthPrincipal p,
                                       @RequestBody Map<String, String> body) {
        String plan = body.getOrDefault("plan", "BASIC").toUpperCase();
        String mpId = body.getOrDefault("mpPreapprovalId", "");
        subscriptionService.upgradePlan(p.businessId(), plan, mpId);
        return ResponseEntity.ok(Map.of("plan", plan, "status", "ACTIVE"));
    }
}
