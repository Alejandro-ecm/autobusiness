package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Product;
import com.autobusiness.domain.repository.CategoryRepository;
import com.autobusiness.domain.repository.InventoryMovementRepository;
import com.autobusiness.domain.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryMovementRepository movementRepo;
    private final CategoryRepository categoryRepo;

    @GetMapping
    public ResponseEntity<List<Product>> getInventory(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(inventoryService.getInventory(principal.businessId()));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<List<Product>> getLowStock(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(inventoryService.getLowStock(principal.businessId()));
    }

    @PostMapping("/products")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> createProduct(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {
        try {
            Product product = Product.builder()
                    .name(body.get("name").toString())
                    .price(new BigDecimal(body.get("price").toString()))
                    .cost(body.get("cost") != null ? new BigDecimal(body.get("cost").toString()) : BigDecimal.ZERO)
                    .stock(body.get("stock") != null ? Integer.parseInt(body.get("stock").toString()) : 0)
                    .minStock(body.get("minStock") != null ? Integer.parseInt(body.get("minStock").toString()) : 5)
                    .sku(body.get("sku") != null ? body.get("sku").toString() : null)
                    .description(body.get("description") != null ? body.get("description").toString() : null)
                    .imageUrl(body.get("imageUrl") != null ? body.get("imageUrl").toString() : null)
                    .isOnline(body.get("isOnline") != null && Boolean.parseBoolean(body.get("isOnline").toString()))
                    .build();
            return ResponseEntity.ok(inventoryService.createProduct(principal.businessId(), product));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/products/{productId}/stock")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> adjustStock(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID productId,
            @RequestBody Map<String, Object> body) {
        try {
            int delta = Integer.parseInt(body.get("delta").toString());
            String reason = body.get("reason") != null ? body.get("reason").toString() : "Ajuste manual";
            return ResponseEntity.ok(inventoryService.adjustStock(principal.businessId(), productId, delta, reason));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/products/{productId}/barcode")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> setBarcode(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID productId,
            @RequestBody Map<String, Object> body) {
        try {
            String barcode = body.get("barcode") != null ? body.get("barcode").toString() : null;
            return ResponseEntity.ok(inventoryService.setBarcode(principal.businessId(), productId, barcode));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/products/import")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> importProducts(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody List<Map<String, Object>> rows) {
        try {
            return ResponseEntity.ok(inventoryService.bulkImport(principal.businessId(), rows));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/products/{productId}")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    public ResponseEntity<?> updateProduct(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID productId,
            @RequestBody Map<String, Object> body) {
        try {
            Product updates = Product.builder()
                    .name(body.get("name").toString())
                    .price(new BigDecimal(body.get("price").toString()))
                    .cost(body.get("cost") != null ? new BigDecimal(body.get("cost").toString()) : BigDecimal.ZERO)
                    .minStock(body.get("minStock") != null ? Integer.parseInt(body.get("minStock").toString()) : 5)
                    .description(body.get("description") != null ? body.get("description").toString() : null)
                    .isOnline(body.get("isOnline") != null && Boolean.parseBoolean(body.get("isOnline").toString()))
                    .imageUrl(body.get("imageUrl") != null ? body.get("imageUrl").toString() : null)
                    .build();
            // set category if provided
            if (body.get("categoryId") != null) {
                try {
                    var cat = categoryRepo.findById(UUID.fromString(body.get("categoryId").toString()));
                    cat.ifPresent(updates::setCategory);
                } catch (Exception ignored) {}
            }
            return ResponseEntity.ok(inventoryService.updateProduct(principal.businessId(), productId, updates));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/movements")
    public ResponseEntity<?> getMovements(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(movementRepo.findTop50ByBusinessIdOrderByCreatedAtDesc(principal.businessId()));
    }
}
