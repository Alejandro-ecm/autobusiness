package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.AuthService;
import com.autobusiness.domain.service.MercadoPagoService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final MercadoPagoService mpService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(authService.login(body.get("email"), body.get("password")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, HttpServletRequest request) {
        try {
            String ip = getClientIp(request);
            String ua = request.getHeader("User-Agent");
            return ResponseEntity.ok(authService.register(
                    body.get("businessName"),
                    body.get("ownerName"),
                    body.get("email"),
                    body.get("password"),
                    ip,
                    ua
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/onboarding")
    public ResponseEntity<?> completeOnboarding(@AuthenticationPrincipal AuthPrincipal p,
                                                 @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(authService.completeOnboarding(p.businessId(), body.get("profileType")));
    }

    @DeleteMapping("/account")
    public ResponseEntity<?> deleteAccount(@AuthenticationPrincipal AuthPrincipal p) {
        try {
            return ResponseEntity.ok(authService.deleteAccount(p.userId(), p.businessId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Error al eliminar cuenta"));
        }
    }

    /** POST /auth/pre-checkout — valida datos, guarda registro pendiente, crea preferencia MP */
    @PostMapping("/pre-checkout")
    public ResponseEntity<?> preCheckout(@RequestBody Map<String, String> body) {
        try {
            String plan  = body.getOrDefault("plan", "PRO").toUpperCase();
            String email = body.get("email");

            // 1. Guardar datos de registro (sin crear cuenta en DB)
            Map<String, Object> pending = authService.preCheckout(
                    body.get("businessName"), body.get("ownerName"),
                    email, body.get("password"), plan);

            String ref = pending.get("ref").toString();

            // 2. Crear preferencia de pago en Mercado Pago
            Map<String, Object> mp = mpService.createRegistrationPreference(ref, plan, email);

            // 3. Guardar preferenceId en el registro pendiente
            authService.updatePendingPreference(ref, mp.get("preferenceId").toString());

            return ResponseEntity.ok(Map.of(
                    "ref",         ref,
                    "initPoint",   mp.get("initPoint"),
                    "sandboxPoint",mp.get("sandboxPoint")
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Error al preparar el pago: " + e.getMessage()));
        }
    }

    /** GET /auth/activate-registration?ref=X — crea la cuenta después de pago confirmado */
    @GetMapping("/activate-registration")
    public ResponseEntity<?> activateRegistration(@RequestParam String ref) {
        try {
            return ResponseEntity.ok(authService.activateRegistration(ref));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(402).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "AutoBusiness AI"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return request.getRemoteAddr();
    }
}
