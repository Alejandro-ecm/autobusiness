package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import com.autobusiness.events.EventPublisher;
import com.autobusiness.events.SaleCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OnlineStoreService {

    private final ProductRepository productRepo;
    private final OrderRepository orderRepo;
    private final BusinessRepository businessRepo;
    private final SaleRepository saleRepo;
    private final BranchRepository branchRepo;
    private final EventPublisher eventPublisher;

    public Map<String, Object> getStorefront(String businessSlug) {
        Business business = businessRepo.findBySlug(businessSlug)
                .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));
        List<Product> products = productRepo.findByBusinessIdAndIsOnlineTrueAndIsActiveTrue(business.getId());
        Map<String, Object> biz = new java.util.LinkedHashMap<>();
        biz.put("id", business.getId());
        biz.put("name", business.getName());
        biz.put("description", business.getDescription() != null ? business.getDescription() : "");
        biz.put("logoUrl", business.getLogoUrl() != null ? business.getLogoUrl() : "");
        biz.put("bannerUrl", business.getBannerUrl() != null ? business.getBannerUrl() : "");
        biz.put("storeTheme", business.getStoreTheme() != null ? business.getStoreTheme() : "modern");
        biz.put("mpPublicKey", business.getMpPublicKey() != null ? business.getMpPublicKey() : "");
        return Map.of("business", biz, "products", products);
    }

    @Transactional
    public Order placeOrder(String businessSlug, String customerName, String customerEmail,
                             String customerPhone, String deliveryAddress, String mapsUrl,
                             Double deliveryLat, Double deliveryLng,
                             List<Map<String, Object>> items,
                             String paymentMethod) {
        Business business = businessRepo.findBySlug(businessSlug)
                .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));

        String orderNumber = generateOrderNumber(business.getId());
        String resolvedPaymentMethod = (paymentMethod != null && !paymentMethod.isBlank())
                ? paymentMethod : "cash_on_delivery";

        Order order = Order.builder()
                .business(business)
                .orderNumber(orderNumber)
                .customerName(customerName)
                .customerEmail(customerEmail)
                .customerPhone(customerPhone)
                .deliveryAddress(deliveryAddress)
                .mapsUrl(mapsUrl)
                .deliveryLat(deliveryLat)
                .deliveryLng(deliveryLng)
                .paymentMethod(resolvedPaymentMethod)
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (Map<String, Object> item : items) {
            UUID productId = UUID.fromString(item.get("productId").toString());
            BigDecimal qty = new BigDecimal(item.get("quantity").toString());

            Product product = productRepo.findById(productId)
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));

            if (!product.isOnline()) throw new IllegalArgumentException("Producto no disponible: " + product.getName());
            if (product.getStock().compareTo(qty) < 0) {
                throw new IllegalStateException(
                        product.getStock().compareTo(BigDecimal.ZERO) == 0
                                ? product.getName() + " está agotado"
                                : "Solo quedan " + product.getStock().stripTrailingZeros().toPlainString()
                                  + " " + product.getBaseUnit() + " de " + product.getName()
                );
            }

            BigDecimal subtotal = product.getPrice().multiply(qty).setScale(2, java.math.RoundingMode.HALF_UP);
            order.getItems().add(OrderItem.builder()
                    .order(order)
                    .product(product)
                    .quantity(qty.intValue())
                    .unitPrice(product.getPrice())
                    .subtotal(subtotal)
                    .build());

            product.setStock(product.getStock().subtract(qty));
            productRepo.save(product);
            total = total.add(subtotal);
        }

        order.setSubtotal(total);
        order.setTotal(total);
        Order saved = orderRepo.save(order);
        log.info("order.created id={} business={} paymentMethod={} total={}",
                saved.getId(), business.getId(), resolvedPaymentMethod, saved.getTotal());
        return saved;
    }

    /**
     * Convierte un pedido online en una venta registrada en el dashboard.
     * Regla: tarjeta → se llama cuando MP confirma el pago.
     *        efectivo en entrega → se llama cuando el repartidor confirma la entrega.
     * Idempotente: si ya existe una Sale para esta orden, la devuelve sin crear otra.
     */
    @Transactional
    public Sale createSaleFromOrder(Order order) {
        if (saleRepo.existsBySourceOrderId(order.getId())) {
            log.info("Sale ya existe para order {}, omitiendo duplicado", order.getId());
            return saleRepo.findBySourceOrderId(order.getId()).orElseThrow();
        }

        Branch branch = branchRepo.findFirstByBusinessIdAndIsMainTrue(order.getBusiness().getId())
                .orElseGet(() -> branchRepo.findFirstByBusinessIdAndIsActiveTrue(order.getBusiness().getId())
                        .orElseThrow(() -> new IllegalStateException("No hay sucursal activa para el negocio")));

        String salePaymentMethod = "cash_on_delivery".equals(order.getPaymentMethod()) ? "cash" : "mercadopago";

        Sale sale = Sale.builder()
                .business(order.getBusiness())
                .branch(branch)
                .paymentMethod(salePaymentMethod)
                .channel("online")
                .subtotal(order.getSubtotal() != null ? order.getSubtotal() : order.getTotal())
                .total(order.getTotal())
                .sourceOrderId(order.getId())
                .notes("Pedido online " + order.getOrderNumber())
                .build();

        for (OrderItem oi : order.getItems()) {
            BigDecimal cost = (oi.getProduct() != null && oi.getProduct().getCost() != null)
                    ? oi.getProduct().getCost() : BigDecimal.ZERO;
            sale.getItems().add(SaleItem.builder()
                    .sale(sale)
                    .product(oi.getProduct())
                    .quantity(new BigDecimal(oi.getQuantity()))
                    .unitPrice(oi.getUnitPrice())
                    .unitCost(cost)
                    .subtotal(oi.getSubtotal())
                    .build());
        }

        Sale saved = saleRepo.save(sale);
        eventPublisher.publish(new SaleCreatedEvent(saved));
        log.info("sale.online id={} order={} paymentMethod={} total={}",
                saved.getId(), order.getId(), salePaymentMethod, saved.getTotal());
        return saved;
    }

    public List<Order> getOrders(UUID businessId) {
        return orderRepo.findByBusinessIdOrderByCreatedAtDesc(businessId);
    }

    @Transactional
    public Order updateOrderStatus(UUID businessId, UUID orderId, String status) {
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Orden no encontrada"));
        if (!order.getBusiness().getId().equals(businessId)) {
            throw new SecurityException("Acceso denegado");
        }
        order.setStatus(status);
        return orderRepo.save(order);
    }

    private String generateOrderNumber(UUID businessId) {
        return "ORD-" + Instant.now().getEpochSecond() + "-" + (int)(Math.random() * 1000);
    }
}
