package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Payment;
import com.autobusiness.domain.repository.PaymentRepository;
import com.autobusiness.domain.service.MercadoPagoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final MercadoPagoService mpService;
    private final PaymentRepository paymentRepo;

    /**
     * POST /api/payments/mercadopago/create-preference
     * Body: { orderId?, items: [{title, quantity, unit_price}], total, payerEmail? }
     */
    @PostMapping("/mercadopago/create-preference")
    public ResponseEntity<?> createPreference(@AuthenticationPrincipal AuthPrincipal p,
                                               @RequestBody Map<String, Object> body) {
        try {
            UUID orderId = body.containsKey("orderId") && body.get("orderId") != null
                    ? UUID.fromString(body.get("orderId").toString()) : null;

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = body.containsKey("items")
                    ? (List<Map<String, Object>>) body.get("items")
                    : List.of();

            BigDecimal total = new BigDecimal(body.getOrDefault("total", "0").toString());
            String payerEmail = body.getOrDefault("payerEmail", "").toString();

            // Si no vienen items, construir uno genérico con el total
            if (items.isEmpty()) {
                items = List.of(Map.of("title", "Pago AutoBusiness",
                        "quantity", 1, "unit_price", total.doubleValue()));
            }

            Map<String, Object> result = mpService.createPreference(
                    p.businessId(), orderId, items, total, payerEmail);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("create-preference error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/payments/mercadopago/webhook  — público, llamado por MP
     * Acepta tanto IPN legacy (?id=&topic=) como Notifications v2 (body JSON)
     */
    @PostMapping("/mercadopago/webhook")
    public ResponseEntity<?> webhook(
            @RequestParam(required = false) String id,
            @RequestParam(required = false) String topic,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            log.info("MP webhook: id={} topic={} body={}", id, topic, body);
            mpService.processWebhook(
                    topic != null ? topic : (body != null ? body.getOrDefault("type", "").toString() : ""),
                    id,
                    body);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("MP webhook error: {}", e.getMessage());
            // Siempre retornar 200 para que MP no reintente indefinidamente
            return ResponseEntity.ok().build();
        }
    }

    /**
     * GET /api/payments — historial de pagos del negocio
     */
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p) {
        List<Payment> payments = paymentRepo.findByBusinessIdOrderByCreatedAtDesc(p.businessId());
        List<Map<String, Object>> result = payments.stream().map(pay -> {
            var m = new HashMap<String, Object>();
            m.put("id",            pay.getId());
            m.put("method",        pay.getMethod());
            m.put("status",        pay.getStatus());
            m.put("amount",        pay.getAmount());
            m.put("currency",      pay.getCurrency());
            m.put("transactionId", pay.getTransactionId());
            m.put("preferenceId",  pay.getPreferenceId());
            m.put("payerEmail",    pay.getPayerEmail());
            m.put("payerName",     pay.getPayerName());
            m.put("orderId",       pay.getOrderId());
            m.put("createdAt",     pay.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/payments/order/{orderId} — pagos de una orden específica
     */
    @GetMapping("/order/{orderId}")
    public ResponseEntity<?> byOrder(@AuthenticationPrincipal AuthPrincipal p,
                                      @PathVariable UUID orderId) {
        List<Payment> payments = paymentRepo.findByOrderIdOrderByCreatedAtDesc(orderId);
        return ResponseEntity.ok(payments.stream().map(pay -> Map.of(
                "id",     pay.getId(),
                "status", pay.getStatus(),
                "amount", pay.getAmount(),
                "method", pay.getMethod()
        )).toList());
    }
}
