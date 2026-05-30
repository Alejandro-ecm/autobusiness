package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Product;
import com.autobusiness.domain.model.Sale;
import com.autobusiness.domain.service.MercadoPagoService;
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
    private final MercadoPagoService mpService;

    @GetMapping("/products")
    public ResponseEntity<List<Product>> searchProducts(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(posService.searchProducts(principal.businessId(), q));
    }

    @GetMapping("/top-products")
    public ResponseEntity<?> topProducts(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(posService.getTopProducts(principal.businessId()));
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {

        Object rawItemsObj = body.get("items");
        if (rawItemsObj == null) {
            throw new IllegalArgumentException("El carrito no puede estar vacío");
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawItems = (List<Map<String, Object>>) rawItemsObj;
        if (rawItems.isEmpty()) {
            throw new IllegalArgumentException("El carrito no puede estar vacío");
        }

        List<PosService.CartItemRequest> items = rawItems.stream()
                .map(item -> {
                    Object pid = item.get("productId");
                    Object qty = item.get("quantity");
                    if (pid == null || qty == null) {
                        throw new IllegalArgumentException("Cada ítem requiere productId y quantity");
                    }
                    return new PosService.CartItemRequest(
                            UUID.fromString(pid.toString()),
                            new BigDecimal(qty.toString()),
                            item.get("variantName") != null ? item.get("variantName").toString() : null,
                            item.get("saleMode") != null ? item.get("saleMode").toString() : "UNIT"
                    );
                }).toList();

        BigDecimal cashReceived = body.get("cashReceived") != null
                ? new BigDecimal(body.get("cashReceived").toString()) : null;

        Object branchIdObj = body.get("branchId");
        if (branchIdObj == null) {
            throw new IllegalArgumentException("Se requiere branchId");
        }

        Sale sale = posService.checkout(new PosService.CheckoutRequest(
                principal.businessId(),
                UUID.fromString(branchIdObj.toString()),
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

    // ── Pago con tarjeta vía Checkout Bricks ──────────────────────────────────

    @PostMapping("/create-payment")
    public ResponseEntity<?> createCardPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {

        BigDecimal total = new BigDecimal(body.get("total").toString());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawItems = body.containsKey("items")
                ? (List<Map<String, Object>>) body.get("items") : List.of();

        List<Map<String, Object>> mpItems = rawItems.stream()
                .map(item -> Map.<String, Object>of(
                        "title",      item.getOrDefault("name", "Producto").toString(),
                        "quantity",   Integer.parseInt(item.getOrDefault("quantity", 1).toString()),
                        "unit_price", Double.parseDouble(item.getOrDefault("price", 0).toString())
                )).toList();

        if (mpItems.isEmpty()) {
            mpItems = List.of(Map.<String, Object>of(
                    "title", "Venta en caja", "quantity", 1, "unit_price", total.doubleValue()));
        }

        Map<String, Object> preference = mpService.createPreference(
                principal.businessId(), null, mpItems, total, null, "pos", null);

        String publicKey = mpService.getEffectivePublicKey(principal.businessId());

        return ResponseEntity.ok(Map.of(
                "preferenceId", preference.get("preferenceId"),
                "mpPublicKey",  publicKey,
                "amount",       total
        ));
    }

    @PostMapping("/process-payment")
    public ResponseEntity<?> processCardPayment(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {

        @SuppressWarnings("unchecked")
        Map<String, Object> formData = body.containsKey("formData")
                ? (Map<String, Object>) body.get("formData") : body;

        Map<String, Object> mpResult = mpService.processCardPayment(
                principal.businessId(), null, formData, "Venta en caja");

        String status = mpResult.get("status").toString();

        if ("approved".equals(status) || "pending".equals(status) || "in_process".equals(status)) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rawItems = body.containsKey("items")
                    ? (List<Map<String, Object>>) body.get("items") : List.of();

            if (!rawItems.isEmpty()) {
                List<PosService.CartItemRequest> items = rawItems.stream().map(item -> {
                    Object pid = item.get("productId");
                    Object qty = item.get("quantity");
                    if (pid == null || qty == null) throw new IllegalArgumentException("Ítem inválido");
                    return new PosService.CartItemRequest(
                            UUID.fromString(pid.toString()),
                            new BigDecimal(qty.toString()),
                            null, "UNIT");
                }).toList();

                Object branchIdObj = body.get("branchId");
                if (branchIdObj == null) throw new IllegalArgumentException("Se requiere branchId");

                Sale sale = posService.checkout(new PosService.CheckoutRequest(
                        principal.businessId(),
                        UUID.fromString(branchIdObj.toString()),
                        principal.userId(),
                        items,
                        "card",
                        null));

                String transactionId = mpResult.get("id").toString();
                mpService.linkSaleToPayment(transactionId, sale.getId());

                return ResponseEntity.ok(Map.of(
                        "status", status,
                        "saleId", sale.getId(),
                        "total",  sale.getTotal(),
                        "change", BigDecimal.ZERO
                ));
            }
        }

        return ResponseEntity.ok(mpResult);
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
