package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Payment;
import com.autobusiness.domain.repository.PaymentRepository;
import com.autobusiness.domain.service.MercadoPagoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final MercadoPagoService mpService;
    private final PaymentRepository paymentRepo;

    @Value("${mercadopago.webhook-secret:}")
    private String webhookSecret;

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
                    p.businessId(), orderId, items, total, payerEmail, null, null);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("create-preference error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/payments/mercadopago/webhook  — público, llamado por MP
     * Acepta tanto IPN legacy (?id=&topic=) como Notifications v2 (body JSON).
     * Valida firma HMAC-SHA256 cuando webhookSecret está configurado.
     */
    @PostMapping("/mercadopago/webhook")
    public ResponseEntity<?> webhook(
            @RequestParam(required = false) String id,
            @RequestParam(required = false) String topic,
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestHeader(value = "x-request-id", required = false) String requestId,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            // Validar firma MP si el secret está configurado
            if (webhookSecret != null && !webhookSecret.isBlank() && xSignature != null) {
                String ts = extractSignaturePart(xSignature, "ts");
                String v1 = extractSignaturePart(xSignature, "v1");
                if (ts != null && v1 != null) {
                    String manifest = "id:" + (id != null ? id : "") +
                            ";request-id:" + (requestId != null ? requestId : "") +
                            ";ts:" + ts + ";";
                    String computed = hmacSha256(webhookSecret, manifest);
                    if (!computed.equals(v1)) {
                        log.warn("MP webhook: firma inválida — posible request falso");
                        return ResponseEntity.ok().build(); // 200 para no revelar el rechazo
                    }
                }
            }
            // No loguear body completo — puede contener datos sensibles
            log.info("MP webhook: id={} topic={}", id, topic);
            mpService.processWebhook(
                    topic != null ? topic : (body != null ? body.getOrDefault("type", "").toString() : ""),
                    id,
                    body);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("MP webhook error: {}", e.getMessage());
            return ResponseEntity.ok().build();
        }
    }

    private String extractSignaturePart(String signature, String key) {
        for (String part : signature.split(";")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].trim().equals(key)) return kv[1].trim();
        }
        return null;
    }

    private String hmacSha256(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
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
     * Solo retorna pagos del negocio autenticado (previene acceso horizontal).
     */
    @GetMapping("/order/{orderId}")
    public ResponseEntity<?> byOrder(@AuthenticationPrincipal AuthPrincipal p,
                                      @PathVariable UUID orderId) {
        List<Payment> payments = paymentRepo.findByOrderIdOrderByCreatedAtDesc(orderId);
        return ResponseEntity.ok(payments.stream()
                .filter(pay -> p.businessId().equals(pay.getBusinessId()))
                .map(pay -> Map.of(
                        "id",     pay.getId(),
                        "status", pay.getStatus(),
                        "amount", pay.getAmount(),
                        "method", pay.getMethod()
                )).toList());
    }
}
