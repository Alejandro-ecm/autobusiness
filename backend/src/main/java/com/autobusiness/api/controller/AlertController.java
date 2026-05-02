package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertRepository alertRepo;

    @GetMapping
    public ResponseEntity<?> getAlerts(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(Map.of(
                "alerts", alertRepo.findByBusinessIdAndIsReadFalseOrderByCreatedAtDesc(principal.businessId()),
                "unread", alertRepo.countByBusinessIdAndIsReadFalse(principal.businessId())
        ));
    }

    @PatchMapping("/{alertId}/read")
    public ResponseEntity<?> markRead(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID alertId) {
        alertRepo.findById(alertId).ifPresent(alert -> {
            if (alert.getBusiness().getId().equals(principal.businessId())) {
                alert.setRead(true);
                alertRepo.save(alert);
            }
        });
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
