package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Payment;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.OrderRepository;
import com.autobusiness.domain.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MercadoPagoService {

    private final PaymentRepository paymentRepo;
    private final OrderRepository orderRepo;
    private final BusinessRepository businessRepo;
    private final SubscriptionService subscriptionService;
    private final OnlineStoreService onlineStoreService;
    private final WebClient.Builder webClientBuilder;

    @Value("${mercadopago.access-token:TEST-placeholder}")
    private String accessToken;

    @Value("${mercadopago.public-key:}")
    private String platformPublicKey;

    public String getPlatformPublicKey() { return platformPublicKey; }

    public String getEffectivePublicKey(UUID businessId) {
        return businessRepo.findById(businessId)
                .map(b -> (b.getMpPublicKey() != null && !b.getMpPublicKey().isBlank())
                        ? b.getMpPublicKey() : platformPublicKey)
                .orElse(platformPublicKey);
    }

    @Value("${mercadopago.notification-url:http://localhost:8080/api/payments/mercadopago/webhook}")
    private String notificationUrl;

    @Value("${mercadopago.success-url:http://localhost:3000/payment/success}")
    private String successUrl;

    @Value("${mercadopago.failure-url:http://localhost:3000/payment/failure}")
    private String failureUrl;

    @Value("${mercadopago.pending-url:http://localhost:3000/payment/pending}")
    private String pendingUrl;

    private static final String MP_API = "https://api.mercadopago.com";

    /**
     * Crea una preferencia de pago en Mercado Pago y retorna el init_point.
     * El externalRef se usa como referencia para identificar la orden en el webhook.
     */
    @Transactional
    public Map<String, Object> createPreference(UUID businessId, UUID orderId,
                                                 List<Map<String, Object>> items,
                                                 BigDecimal total,
                                                 String payerEmail,
                                                 String slugSuffix,
                                                 String subscriptionPlan) {
        return createPreference(businessId, orderId, items, total, payerEmail, slugSuffix, subscriptionPlan, null);
    }

    public Map<String, Object> createPreference(UUID businessId, UUID orderId,
                                                 List<Map<String, Object>> items,
                                                 BigDecimal total,
                                                 String payerEmail,
                                                 String slugSuffix,
                                                 String subscriptionPlan,
                                                 String tokenOverride) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        // Usar el token del negocio si está conectado, si no el token de la plataforma
        String effectiveToken = (tokenOverride != null && !tokenOverride.isBlank())
                ? tokenOverride
                : (business.getMpAccessToken() != null && !business.getMpAccessToken().isBlank()
                        ? business.getMpAccessToken()
                        : accessToken);

        String externalRef = orderId != null ? orderId.toString() : UUID.randomUUID().toString();

        // Build preference payload
        var mpItems = items.stream().map(item -> Map.of(
                "title",       item.getOrDefault("title", item.getOrDefault("name", "Producto")).toString(),
                "quantity",    Integer.parseInt(item.getOrDefault("quantity", 1).toString()),
                "unit_price",  Double.parseDouble(item.getOrDefault("unit_price",
                               item.getOrDefault("price", 0)).toString()),
                "currency_id", "MXN"
        )).toList();

        var preference = new HashMap<String, Object>();
        preference.put("items", mpItems);
        preference.put("external_reference", externalRef);
        preference.put("notification_url", notificationUrl);
        String slugParam = (slugSuffix != null && !slugSuffix.isBlank()) ? "&slug=" + slugSuffix : "";
        preference.put("back_urls", Map.of(
                "success", successUrl + "?ref=" + externalRef + slugParam,
                "failure", failureUrl + "?ref=" + externalRef + slugParam,
                "pending", pendingUrl + "?ref=" + externalRef + slugParam
        ));
        // auto_return only valid with public (non-localhost) back_urls
        if (!successUrl.contains("localhost") && !successUrl.contains("127.0.0.1")) {
            preference.put("auto_return", "approved");
        }
        if (payerEmail != null && !payerEmail.isBlank()) {
            preference.put("payer", Map.of("email", payerEmail));
        }
        var metaMap = new HashMap<String, Object>();
        metaMap.put("business_id", businessId.toString());
        if (subscriptionPlan != null && !subscriptionPlan.isBlank()) {
            metaMap.put("type", "subscription");
            metaMap.put("plan", subscriptionPlan);
        }
        preference.put("metadata", metaMap);

        WebClient client = webClientBuilder.baseUrl(MP_API)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + effectiveToken)
                .build();

        @SuppressWarnings("unchecked")
        Map<String, Object> result = client.post()
                .uri("/checkout/preferences")
                .bodyValue(preference)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (result == null || result.containsKey("error")) {
            String err = result != null ? result.getOrDefault("message", "Error MP").toString() : "Sin respuesta";
            log.error("MP preference creation failed: {}", err);
            throw new IllegalStateException("Error al crear preferencia de pago: " + err);
        }

        String preferenceId = result.get("id").toString();
        String initPoint    = result.get("init_point").toString();
        String sandboxPoint = result.getOrDefault("sandbox_init_point", initPoint).toString();

        // Persistir payment en estado pending
        Payment payment = Payment.builder()
                .business(business)
                .orderId(orderId)
                .method("mercadopago")
                .status("pending")
                .amount(total)
                .currency("MXN")
                .preferenceId(preferenceId)
                .externalRef(externalRef)
                .payerEmail(payerEmail)
                .build();
        paymentRepo.save(payment);

        log.info("MP preference created: {} for business {}", preferenceId, businessId);

        return Map.of(
                "preferenceId", preferenceId,
                "initPoint",    initPoint,
                "sandboxPoint", sandboxPoint,
                "paymentId",    payment.getId()
        );
    }

    /**
     * Procesa una notificación IPN de Mercado Pago.
     * Consulta la API de MP para confirmar el estado real del pago.
     */
    @Transactional
    public void processWebhook(String topic, String resourceId,
                                Map<String, Object> body) {
        String type       = body != null ? (String) body.getOrDefault("type", topic) : topic;
        String paymentId  = resourceId;

        if ("payment".equals(type) && body != null && body.containsKey("data")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");
            paymentId = data != null ? data.getOrDefault("id", resourceId).toString() : resourceId;
        }

        if (paymentId == null || paymentId.isBlank()) {
            log.warn("MP webhook received with no payment_id");
            return;
        }

        // Idempotencia: si ya procesamos este payment_id, skip
        if (paymentRepo.existsByTransactionId(paymentId)) {
            log.info("MP payment {} already processed, skipping", paymentId);
            return;
        }

        // Consultar estado real en MP
        Map<String, Object> mpPayment = fetchPayment(paymentId);
        if (mpPayment == null) return;

        String status       = mpPayment.getOrDefault("status", "unknown").toString();
        String extRef       = mpPayment.getOrDefault("external_reference", "").toString();
        Object amountObj    = mpPayment.getOrDefault("transaction_amount", 0);
        BigDecimal amount   = new BigDecimal(amountObj.toString());
        String email        = "";
        String name         = "";

        if (mpPayment.containsKey("payer")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> payer = (Map<String, Object>) mpPayment.get("payer");
            email = payer != null ? payer.getOrDefault("email", "").toString() : "";
            name  = payer != null
                    ? payer.getOrDefault("first_name", "") + " " + payer.getOrDefault("last_name", "")
                    : "";
        }

        log.info("MP payment {} status={} extRef={}", paymentId, status, extRef);

        // Extraer metadata del pago (business_id, type, plan)
        String businessIdStr = "";
        String mpType = "";
        String mpPlan = "BASIC";
        if (mpPayment.containsKey("metadata")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> mpMeta = (Map<String, Object>) mpPayment.get("metadata");
            if (mpMeta != null) {
                businessIdStr = mpMeta.getOrDefault("business_id", "").toString();
                mpType        = mpMeta.getOrDefault("type", "").toString();
                mpPlan        = mpMeta.getOrDefault("plan", "BASIC").toString();
            }
        }

        // Buscar el payment pendiente por externalRef
        Payment payment = null;
        if (!extRef.isBlank()) {
            payment = paymentRepo.findAll().stream()
                    .filter(p -> extRef.equals(p.getExternalRef()) && "pending".equals(p.getStatus()))
                    .findFirst().orElse(null);
        }

        if (payment == null) {
            if (businessIdStr.isBlank()) {
                log.warn("MP webhook: no business_id in metadata, payment_id={}", paymentId);
                return;
            }
            Business biz = businessRepo.findById(UUID.fromString(businessIdStr)).orElse(null);
            if (biz == null) return;

            payment = Payment.builder()
                    .business(biz)
                    .method("mercadopago")
                    .amount(amount)
                    .currency("MXN")
                    .externalRef(extRef)
                    .build();
        }

        // Actualizar payment
        payment.setTransactionId(paymentId);
        payment.setRawStatus(status);
        payment.setPayerEmail(email);
        payment.setPayerName(name.trim());
        payment.setAmount(amount);

        if ("approved".equals(status)) {
            payment.setStatus("approved");
            if ("subscription".equals(mpType) && !businessIdStr.isBlank()) {
                // Activar suscripción del negocio
                try {
                    subscriptionService.upgradePlan(UUID.fromString(businessIdStr), mpPlan, paymentId);
                    log.info("Subscription {} activated via MP payment {} for business {}", mpPlan, paymentId, businessIdStr);
                } catch (Exception e) {
                    log.error("Failed to activate subscription: {}", e.getMessage());
                }
            } else if (!extRef.isBlank()) {
                // Marcar la orden de tienda online como confirmada y registrar venta
                try {
                    UUID oid = UUID.fromString(extRef);
                    payment.setOrderId(oid);
                    final String finalPaymentId = paymentId;
                    final Payment finalPayment = payment;
                    orderRepo.findById(oid).ifPresent(order -> {
                        order.setStatus("confirmed");
                        orderRepo.save(order);
                        try {
                            var sale = onlineStoreService.createSaleFromOrder(order);
                            finalPayment.setSaleId(sale.getId());
                            log.info("Order {} confirmed + sale {} created via MP payment {}",
                                    oid, sale.getId(), finalPaymentId);
                        } catch (Exception e) {
                            log.error("Could not create sale for order {}: {}", oid, e.getMessage());
                        }
                    });
                } catch (IllegalArgumentException ignored) { /* extRef no es UUID de orden */ }
            }
        } else if ("rejected".equals(status) || "cancelled".equals(status)) {
            payment.setStatus(status);
        } else {
            payment.setStatus("pending");
        }

        paymentRepo.save(payment);
    }

    private Map<String, Object> fetchPayment(String paymentId) {
        try {
            WebClient client = webClientBuilder.baseUrl(MP_API)
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .build();

            @SuppressWarnings("unchecked")
            Map<String, Object> result = client.get()
                    .uri("/v1/payments/" + paymentId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return result;
        } catch (Exception e) {
            log.error("Failed to fetch MP payment {}: {}", paymentId, e.getMessage());
            return null;
        }
    }

    /**
     * Procesa un pago con tarjeta usando el token generado por Checkout Bricks.
     * Llamado desde el frontend en lugar de redirigir a Checkout Pro.
     */
    public Map<String, Object> processCardPayment(UUID businessId, UUID orderId,
                                                   Map<String, Object> formData) {
        return processCardPayment(businessId, orderId, formData, "Pedido tienda online");
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> processCardPayment(UUID businessId, UUID orderId,
                                                   Map<String, Object> formData,
                                                   String description) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        String effectiveToken = (business.getMpAccessToken() != null && !business.getMpAccessToken().isBlank())
                ? business.getMpAccessToken() : accessToken;

        Map<String, Object> payload = new HashMap<>();
        payload.put("transaction_amount",
                new BigDecimal(formData.getOrDefault("transaction_amount", "0").toString()).doubleValue());
        payload.put("token",              formData.get("token"));
        payload.put("description",        description);
        payload.put("installments",       Integer.parseInt(formData.getOrDefault("installments", "1").toString()));
        payload.put("payment_method_id",  formData.get("payment_method_id"));
        if (formData.containsKey("issuer_id") && formData.get("issuer_id") != null)
            payload.put("issuer_id", formData.get("issuer_id"));
        if (formData.containsKey("payer"))
            payload.put("payer", formData.get("payer"));
        if (orderId != null) payload.put("external_reference", orderId.toString());
        payload.put("metadata", Map.of("business_id", businessId.toString(),
                                       "order_id", orderId != null ? orderId.toString() : ""));

        WebClient client = webClientBuilder.baseUrl(MP_API)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + effectiveToken)
                .build();

        Map<String, Object> result = client.post()
                .uri("/v1/payments")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (result == null) throw new IllegalStateException("Sin respuesta de Mercado Pago");

        String status    = result.getOrDefault("status", "rejected").toString();
        String mpId      = result.getOrDefault("id", "").toString();
        BigDecimal amount = new BigDecimal(
                formData.getOrDefault("transaction_amount", "0").toString());

        if ("approved".equals(status) && orderId != null) {
            final String finalMpId = mpId;
            orderRepo.findById(orderId).ifPresent(o -> {
                o.setStatus("confirmed");
                orderRepo.save(o);
                try {
                    var sale = onlineStoreService.createSaleFromOrder(o);
                    linkSaleToPayment(finalMpId, sale.getId());
                    log.info("Order {} confirmed + sale {} created via Bricks payment {}",
                            o.getId(), sale.getId(), finalMpId);
                } catch (Exception e) {
                    log.error("Could not create sale for order {}: {}", o.getId(), e.getMessage());
                }
            });
        }

        Payment payment = Payment.builder()
                .business(business)
                .orderId(orderId)
                .method("mercadopago_card")
                .status(status)
                .amount(amount)
                .currency("MXN")
                .transactionId(mpId)
                .externalRef(orderId != null ? orderId.toString() : mpId)
                .build();
        paymentRepo.save(payment);

        log.info("Card payment {} status={} for business {}", mpId, status, businessId);
        return Map.of("status", status, "id", mpId,
                "statusDetail", result.getOrDefault("status_detail", ""));
    }

    @Transactional
    public void linkSaleToPayment(String transactionId, UUID saleId) {
        if (transactionId == null || transactionId.isBlank()) return;
        paymentRepo.findByTransactionId(transactionId).ifPresent(p -> {
            p.setSaleId(saleId);
            paymentRepo.save(p);
        });
    }

    /**
     * Procesa pago de suscripción con tarjeta via Bricks.
     * Siempre usa el token de la plataforma para que el dinero vaya al dueño del SaaS.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> processSubscriptionCardPayment(UUID businessId, String plan,
                                                               Map<String, Object> formData) {
        Map<String, Integer> prices = Map.of("BASIC", 49, "PRO", 100, "PREMIUM", 180);
        int price = prices.getOrDefault(plan.toUpperCase(), 29);

        Map<String, Object> payload = new HashMap<>();
        payload.put("transaction_amount", (double) price);
        payload.put("token",             formData.get("token"));
        payload.put("description",       "AutoBusiness " + plan + " — mensual");
        payload.put("installments",      Integer.parseInt(formData.getOrDefault("installments", "1").toString()));
        payload.put("payment_method_id", formData.get("payment_method_id"));
        if (formData.containsKey("issuer_id") && formData.get("issuer_id") != null)
            payload.put("issuer_id", formData.get("issuer_id"));
        if (formData.containsKey("payer")) payload.put("payer", formData.get("payer"));
        payload.put("metadata", Map.of("business_id", businessId.toString(),
                                       "type", "subscription", "plan", plan));

        WebClient client = webClientBuilder.baseUrl(MP_API)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .build();

        Map<String, Object> result = client.post()
                .uri("/v1/payments")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (result == null) throw new IllegalStateException("Sin respuesta de Mercado Pago");

        String status = result.getOrDefault("status", "rejected").toString();
        String mpId   = result.getOrDefault("id", "").toString();

        if ("approved".equals(status)) {
            subscriptionService.upgradePlan(businessId, plan, mpId);
            log.info("Subscription {} activated via Bricks payment {} for business {}", plan, mpId, businessId);
        }

        Business business = businessRepo.findById(businessId).orElseThrow();
        Payment payment = Payment.builder()
                .business(business)
                .method("mercadopago_subscription")
                .status(status)
                .amount(BigDecimal.valueOf(price))
                .currency("MXN")
                .transactionId(mpId)
                .build();
        paymentRepo.save(payment);

        return Map.of("status", status, "id", mpId,
                "statusDetail", result.getOrDefault("status_detail", ""));
    }

    /**
     * Crea un link de pago para suscripción mensual.
     */
    public Map<String, Object> createSubscriptionLink(UUID businessId, String plan) {
        Map<String, Integer> prices = Map.of("BASIC", 49, "PRO", 100, "PREMIUM", 180);
        int price = prices.getOrDefault(plan.toUpperCase(), 29);

        var items = List.of(Map.<String, Object>of(
                "title",      "AutoBusiness " + plan + " — mensual",
                "quantity",   1,
                "unit_price", price
        ));

        // Use platform token so subscription revenue goes to the platform, not the business
        return createPreference(businessId, null, items,
                BigDecimal.valueOf(price), null, null, plan, accessToken);
    }
}
