package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.MpSettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/settings/mp")
@RequiredArgsConstructor
@Slf4j
public class MpSettingsController {

    private final MpSettingsService mpSettingsService;

    @Value("${app.base-url:http://localhost:3000}")
    private String appBaseUrl;

    /** GET /api/settings/mp — estado de conexión MP del negocio */
    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> status(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(mpSettingsService.getStatus(p.businessId()));
    }

    /** GET /api/settings/mp/connect-url — URL OAuth de MP para redirigir al dueño */
    @GetMapping("/connect-url")
    @PreAuthorize("hasAnyRole('OWNER')")
    public ResponseEntity<?> connectUrl(@AuthenticationPrincipal AuthPrincipal p) {
        try {
            return ResponseEntity.ok(mpSettingsService.getConnectUrl(p.businessId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * GET /api/settings/mp/oauth-callback — público, llamado por MP tras autorizar.
     * Intercambia el código, guarda tokens y redirige al frontend.
     */
    @GetMapping("/oauth-callback")
    public ResponseEntity<?> oauthCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        if (error != null || code == null) {
            log.warn("MP OAuth callback error: {}", error);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(appBaseUrl + "/settings/payments?mp_error=true"))
                    .build();
        }
        try {
            mpSettingsService.completeOAuth(code, state);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(appBaseUrl + "/settings/payments?mp_connected=true"))
                    .build();
        } catch (Exception e) {
            log.error("MP OAuth callback failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(appBaseUrl + "/settings/payments?mp_error=true"))
                    .build();
        }
    }

    /** POST /api/settings/mp/manual — conectar con token manual */
    @PostMapping("/manual")
    @PreAuthorize("hasAnyRole('OWNER')")
    public ResponseEntity<?> connectManual(@AuthenticationPrincipal AuthPrincipal p,
                                            @RequestBody Map<String, String> body) {
        try {
            String token = body.getOrDefault("accessToken", "").trim();
            return ResponseEntity.ok(mpSettingsService.connectManual(p.businessId(), token));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** DELETE /api/settings/mp — desconectar cuenta MP */
    @DeleteMapping
    @PreAuthorize("hasAnyRole('OWNER')")
    public ResponseEntity<?> disconnect(@AuthenticationPrincipal AuthPrincipal p) {
        mpSettingsService.disconnect(p.businessId());
        return ResponseEntity.ok(Map.of("connected", false));
    }
}
