package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.PurchaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/purchases")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchaseService;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(purchaseService.getPurchases(p.businessId()));
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                     @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawItems = (List<Map<String, Object>>) body.get("items");

        List<PurchaseService.PurchaseItemRequest> items = rawItems.stream()
                .map(i -> new PurchaseService.PurchaseItemRequest(
                        UUID.fromString(i.get("productId").toString()),
                        new BigDecimal(i.get("quantity").toString()),
                        new BigDecimal(i.get("unitCost").toString())
                )).toList();

        String supplierName = body.get("supplierName") != null ? body.get("supplierName").toString() : null;
        String notes        = body.get("notes")        != null ? body.get("notes").toString()        : null;
        UUID branchId       = body.get("branchId")     != null
                ? UUID.fromString(body.get("branchId").toString()) : null;

        var result = purchaseService.createPurchase(
                p.businessId(), branchId, p.userId(),
                supplierName, notes, items);

        return ResponseEntity.ok(result);
    }
}
