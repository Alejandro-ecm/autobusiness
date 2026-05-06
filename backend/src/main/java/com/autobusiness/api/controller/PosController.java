package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Product;
import com.autobusiness.domain.model.Sale;
import com.autobusiness.domain.service.PosService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/pos")
@RequiredArgsConstructor
public class PosController {

    private final PosService posService;

    @GetMapping("/products")
    public ResponseEntity<List<Product>> searchProducts(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(posService.searchProducts(principal.businessId(), q));
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawItems = (List<Map<String, Object>>) body.get("items");

        List<PosService.CartItemRequest> items = rawItems.stream()
                .map(item -> new PosService.CartItemRequest(
                        UUID.fromString(item.get("productId").toString()),
                        new BigDecimal(item.get("quantity").toString()),
                        item.get("variantName") != null ? item.get("variantName").toString() : null,
                        item.get("saleMode") != null ? item.get("saleMode").toString() : "UNIT"
                )).toList();

        BigDecimal cashReceived = body.get("cashReceived") != null
                ? new BigDecimal(body.get("cashReceived").toString()) : null;

        Sale sale = posService.checkout(new PosService.CheckoutRequest(
                principal.businessId(),
                UUID.fromString(body.get("branchId").toString()),
                principal.userId(),
                items,
                body.getOrDefault("paymentMethod", "cash").toString(),
                cashReceived
        ));

        return ResponseEntity.ok(Map.of(
                "saleId", sale.getId(),
                "total",  sale.getTotal(),
                "change", sale.getChangeGiven() != null ? sale.getChangeGiven() : BigDecimal.ZERO,
                "status", "completed"
        ));
    }

    // ── Corte de caja ─────────────────────────────────────────────────────────
    @GetMapping("/corte/today")
    public ResponseEntity<?> getTodaySummary(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(posService.getTodaySummary(principal.businessId()));
    }

    @PostMapping("/corte/close")
    public ResponseEntity<?> closeRegister(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {
        String notes = body.get("notes") != null ? body.get("notes").toString() : null;
        return ResponseEntity.ok(posService.closeRegister(
                principal.businessId(),
                principal.userId(),
                notes
        ));
    }
}
