package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.LegalService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/legal")
@RequiredArgsConstructor
public class LegalController {

    private final LegalService legalService;

    @GetMapping("/terms")
    public ResponseEntity<?> getTerms() {
        return ResponseEntity.ok(legalService.getActiveDocument("TERMS"));
    }

    @GetMapping("/privacy")
    public ResponseEntity<?> getPrivacy() {
        return ResponseEntity.ok(legalService.getActiveDocument("PRIVACY"));
    }

    @GetMapping("/acceptable-use")
    public ResponseEntity<?> getAcceptableUse() {
        return ResponseEntity.ok(legalService.getActiveDocument("ACCEPTABLE_USE"));
    }

    @GetMapping("/versions")
    public ResponseEntity<?> getVersions() {
        return ResponseEntity.ok(legalService.getActiveVersions());
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus(@AuthenticationPrincipal AuthPrincipal principal) {
        boolean accepted = legalService.hasAcceptedLatest(principal.userId());
        return ResponseEntity.ok(Map.of(
                "accepted", accepted,
                "requiresAcceptance", !accepted
        ));
    }

    @PostMapping("/accept")
    public ResponseEntity<?> accept(
            @AuthenticationPrincipal AuthPrincipal principal,
            HttpServletRequest request) {
        try {
            String ip = getClientIp(request);
            String ua = request.getHeader("User-Agent");
            legalService.recordAcceptance(principal.userId(), ip, ua);
            return ResponseEntity.ok(Map.of("message", "Aceptación registrada correctamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return request.getRemoteAddr();
    }
}
