package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.infrastructure.whatsapp.WhatsAppServiceClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/whatsapp")
@RequiredArgsConstructor
public class WhatsAppController {

    private final WhatsAppServiceClient waClient;

    /** Inicia (o reanuda) la sesión de WhatsApp del negocio — genera QR si hace falta. */
    @PostMapping("/connect")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> connect(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(waClient.connect(principal.businessId()));
    }

    /** Estado actual: disconnected | connecting | qr | connected (+ qr dataURL, phone). */
    @GetMapping("/status")
    public ResponseEntity<?> status(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(waClient.status(principal.businessId()));
    }

    /** Cierra sesión y borra credenciales del número. */
    @PostMapping("/logout")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> logout(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(waClient.logout(principal.businessId()));
    }
}
