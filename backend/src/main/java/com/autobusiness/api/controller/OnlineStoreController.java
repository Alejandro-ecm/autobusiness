package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.OnlineStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OnlineStoreController {

    private final OnlineStoreService storeService;

    // Público — catálogo de la tienda online
    @GetMapping("/store/{slug}")
    public ResponseEntity<?> getStorefront(@PathVariable String slug) {
        try {
            return ResponseEntity.ok(storeService.getStorefront(slug));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Público — hacer pedido
    @PostMapping("/store/{slug}/orders")
    public ResponseEntity<?> placeOrder(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
            return ResponseEntity.ok(storeService.placeOrder(
                    slug,
                    body.get("customerName") != null ? body.get("customerName").toString() : "Cliente",
                    body.get("customerEmail") != null ? body.get("customerEmail").toString() : null,
                    body.get("customerPhone") != null ? body.get("customerPhone").toString() : null,
                    items
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Autenticado — gestionar órdenes
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(storeService.getOrders(principal.businessId()));
    }

    @PatchMapping("/orders/{orderId}/status")
    public ResponseEntity<?> updateOrderStatus(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID orderId,
            @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(storeService.updateOrderStatus(
                    principal.businessId(), orderId, body.get("status")));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
