package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
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

    public Map<String, Object> getStorefront(String businessSlug) {
        Business business = businessRepo.findBySlug(businessSlug)
                .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));
        List<Product> products = productRepo.findByBusinessIdAndIsOnlineTrueAndIsActiveTrue(business.getId());
        return Map.of(
                "business", Map.of(
                        "id", business.getId(),
                        "name", business.getName(),
                        "description", business.getDescription() != null ? business.getDescription() : "",
                        "logoUrl", business.getLogoUrl() != null ? business.getLogoUrl() : ""
                ),
                "products", products
        );
    }

    @Transactional
    public Order placeOrder(String businessSlug, String customerName, String customerEmail,
                             String customerPhone, List<Map<String, Object>> items) {
        Business business = businessRepo.findBySlug(businessSlug)
                .orElseThrow(() -> new IllegalArgumentException("Tienda no encontrada"));

        String orderNumber = generateOrderNumber(business.getId());

        Order order = Order.builder()
                .business(business)
                .orderNumber(orderNumber)
                .customerName(customerName)
                .customerEmail(customerEmail)
                .customerPhone(customerPhone)
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
        log.info("order.created id={} business={} total={}", saved.getId(), business.getId(), saved.getTotal());
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
