package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.service.MercadoPagoService;
import com.autobusiness.domain.service.OnlineStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OnlineStoreController {

    private final OnlineStoreService storeService;
    private final MercadoPagoService mpService;
    private final BusinessRepository businessRepo;

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
            Double lat = body.get("deliveryLat") != null ? Double.parseDouble(body.get("deliveryLat").toString()) : null;
            Double lng = body.get("deliveryLng") != null ? Double.parseDouble(body.get("deliveryLng").toString()) : null;
            String paymentMethod = body.get("paymentMethod") != null
                    ? body.get("paymentMethod").toString() : "cash_on_delivery";
            return ResponseEntity.ok(storeService.placeOrder(
                    slug,
                    body.get("customerName")    != null ? body.get("customerName").toString()    : "Cliente",
                    body.get("customerEmail")   != null ? body.get("customerEmail").toString()   : null,
                    body.get("customerPhone")   != null ? body.get("customerPhone").toString()   : null,
                    body.get("deliveryAddress") != null ? body.get("deliveryAddress").toString() : null,
                    body.get("mapsUrl")         != null ? body.get("mapsUrl").toString()         : null,
                    lat, lng,
                    items,
                    paymentMethod
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Público — crear preferencia de Mercado Pago para una orden de tienda online
    @PostMapping("/store/{slug}/pay")
    public ResponseEntity<?> createPayment(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        try {
            Business business = businessRepo.findBySlug(slug)
                    .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));

            UUID orderId = body.containsKey("orderId") && body.get("orderId") != null
                    ? UUID.fromString(body.get("orderId").toString()) : null;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = body.containsKey("items")
                    ? (List<Map<String, Object>>) body.get("items")
                    : List.of();

            BigDecimal total = new BigDecimal(body.getOrDefault("total", "0").toString());
            String payerEmail = body.getOrDefault("payerEmail", "").toString();

            if (items.isEmpty()) {
                items = List.of(Map.of("title", "Pedido " + slug,
                        "quantity", 1, "unit_price", total.doubleValue()));
            }

            Map<String, Object> result = mpService.createPreference(
                    business.getId(), orderId, items, total, payerEmail, slug, null);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Público — procesar pago con tarjeta via Checkout Bricks
    @PostMapping("/store/{slug}/process-payment")
    public ResponseEntity<?> processPayment(
            @PathVariable String slug,
            @RequestBody Map<String, Object> body) {
        try {
            Business business = businessRepo.findBySlug(slug)
                    .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));

            UUID orderId = body.containsKey("orderId") && body.get("orderId") != null
                    ? UUID.fromString(body.get("orderId").toString()) : null;

            @SuppressWarnings("unchecked")
            Map<String, Object> formData = body.containsKey("formData")
                    ? (Map<String, Object>) body.get("formData") : body;

            Map<String, Object> result = mpService.processCardPayment(business.getId(), orderId, formData);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private static final java.util.Set<String> ALLOWED_THEMES = java.util.Set.of("modern", "classic", "minimal");

    // Autenticado — actualizar diseño/configuración de la tienda
    @PatchMapping("/business/settings")
    public ResponseEntity<?> updateBusinessSettings(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, Object> body) {
        try {
            Business business = businessRepo.findById(principal.businessId())
                    .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

            if (body.containsKey("name") && body.get("name") != null) {
                String name = body.get("name").toString().trim();
                if (!name.isEmpty()) business.setName(name);
            }
            if (body.containsKey("description"))
                business.setDescription(body.get("description") != null ? body.get("description").toString() : null);
            if (body.containsKey("logoUrl"))
                business.setLogoUrl(body.get("logoUrl") != null ? body.get("logoUrl").toString() : null);
            if (body.containsKey("bannerUrl"))
                business.setBannerUrl(body.get("bannerUrl") != null ? body.get("bannerUrl").toString() : null);
            if (body.containsKey("storeTheme")) {
                String theme = body.get("storeTheme") != null ? body.get("storeTheme").toString() : "modern";
                business.setStoreTheme(ALLOWED_THEMES.contains(theme) ? theme : "modern");
            }

            businessRepo.save(business);
            return ResponseEntity.ok(Map.of("message", "Configuración guardada"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Autenticado — código de sincronización para app delivery
    @GetMapping("/business/delivery-code")
    public ResponseEntity<?> getDeliveryCode(@AuthenticationPrincipal AuthPrincipal principal) {
        return businessRepo.findById(principal.businessId())
                .map(b -> ResponseEntity.ok(Map.of("deliveryCode", b.getDeliveryCode() != null ? b.getDeliveryCode() : "")))
                .orElse(ResponseEntity.notFound().build());
    }

    // Autenticado — gestionar órdenes
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(@AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(storeService.getOrders(principal.businessId()));
    }

    private static final java.util.Set<String> ALLOWED_ORDER_STATUSES =
            java.util.Set.of("pending", "confirmed", "preparing", "ready", "delivered", "cancelled");

    @PatchMapping("/orders/{orderId}/status")
    public ResponseEntity<?> updateOrderStatus(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID orderId,
            @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El campo status es requerido"));
        }
        if (!ALLOWED_ORDER_STATUSES.contains(status.toLowerCase())) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Estado inválido. Valores permitidos: " + String.join(", ", ALLOWED_ORDER_STATUSES)));
        }
        try {
            return ResponseEntity.ok(storeService.updateOrderStatus(
                    principal.businessId(), orderId, status.toLowerCase()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
