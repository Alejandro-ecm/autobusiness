package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.InventoryTransferService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/inventory/transfers")
@RequiredArgsConstructor
public class InventoryTransferController {

    private final InventoryTransferService transferService;

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> transfer(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody InventoryTransferService.TransferRequest request) {
        try {
            return ResponseEntity.ok(transferService.transfer(principal, request));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> history(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(transferService.history(principal.businessId()));
    }
}
