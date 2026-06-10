package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import com.autobusiness.events.EventPublisher;
import com.autobusiness.events.SaleCreatedEvent;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PosService {

    private final SaleRepository saleRepo;
    private final ProductRepository productRepo;
    private final BranchRepository branchRepo;
    private final UserRepository userRepo;
    private final BusinessRepository businessRepo;
    private final CashRegisterSessionRepository sessionRepo;
    private final EventPublisher eventPublisher;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * quantity es BigDecimal para soportar kg decimales (ej: 1.750).
     * variantName es opcional ("Costal 50kg").
     * saleMode indica cómo se cobró: "UNIT" o "WEIGHT".
     */
    public record CartItemRequest(
            UUID productId,
            BigDecimal quantity,
            String variantName,
            String saleMode
    ) {}

    public record CheckoutRequest(
            UUID businessId,
            UUID branchId,
            UUID cashierId,
            List<CartItemRequest> items,
            String paymentMethod,
            BigDecimal cashReceived
    ) {}

    @Transactional
    public Sale checkout(CheckoutRequest req) {
        Business business = businessRepo.findById(req.businessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        Branch branch = branchRepo.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Sucursal no encontrada"));
        User cashier = req.cashierId() != null
                ? userRepo.findById(req.cashierId()).orElse(null)
                : null;

        Sale sale = Sale.builder()
                .business(business)
                .branch(branch)
                .cashier(cashier)
                .paymentMethod(req.paymentMethod())
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;

        for (CartItemRequest item : req.items()) {
            Product product = productRepo.findById(item.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado: " + item.productId()));

            BigDecimal qty = item.quantity() != null ? item.quantity() : BigDecimal.ONE;
            if (qty.compareTo(BigDecimal.ZERO) <= 0)
                throw new IllegalArgumentException("Cantidad inválida para " + product.getName());

            // Verificar stock disponible
            if (product.getStock().compareTo(qty) < 0) {
                throw new IllegalStateException(
                    product.getStock().compareTo(BigDecimal.ZERO) == 0
                        ? product.getName() + " está agotado"
                        : "Solo quedan " + fmtQty(product.getStock(), product.getBaseUnit())
                          + " de " + product.getName()
                );
            }

            // Precio: variante > pricePerKg (WEIGHT) > price estándar
            BigDecimal unitPrice = resolveUnitPrice(product, item.variantName(), item.saleMode());
            BigDecimal itemSubtotal = unitPrice.multiply(qty).setScale(2, RoundingMode.HALF_UP);

            sale.getItems().add(SaleItem.builder()
                    .sale(sale)
                    .product(product)
                    .quantity(qty)
                    .unitPrice(unitPrice)
                    .unitCost(product.getCost() != null ? product.getCost() : BigDecimal.ZERO)
                    .subtotal(itemSubtotal)
                    .variantName(item.variantName())
                    .build());

            product.setStock(product.getStock().subtract(qty));
            productRepo.save(product);
            subtotal = subtotal.add(itemSubtotal);
        }

        sale.setSubtotal(subtotal);
        sale.setTotal(subtotal);

        if ("cash".equals(req.paymentMethod()) && req.cashReceived() != null) {
            sale.setCashReceived(req.cashReceived());
            sale.setChangeGiven(req.cashReceived().subtract(subtotal));
        }

        Sale saved = saleRepo.save(sale);
        log.info("sale.created id={} business={} total={}", saved.getId(), req.businessId(), saved.getTotal());
        eventPublisher.publish(new SaleCreatedEvent(saved));
        return saved;
    }

    /**
     * Precio prioritario: priceOverride de variante > multiplier*base > pricePerKg > price
     */
    private BigDecimal resolveUnitPrice(Product product, String variantName, String saleMode) {
        if (variantName != null && !variantName.isBlank() && product.getVariants() != null) {
            try {
                List<Map<String, Object>> variants = MAPPER.readValue(
                        product.getVariants(), new TypeReference<>() {});
                for (Map<String, Object> v : variants) {
                    if (variantName.equals(v.get("name"))) {
                        Object po = v.get("priceOverride");
                        if (po != null) return new BigDecimal(po.toString());
                        // Sin priceOverride: multiplier * precio base (por kg o unitario)
                        Object mult = v.get("multiplier");
                        if (mult != null) {
                            BigDecimal base = ("WEIGHT".equals(saleMode) && product.getPricePerKg() != null)
                                    ? product.getPricePerKg() : product.getPrice();
                            return base.multiply(new BigDecimal(mult.toString()))
                                    .setScale(2, RoundingMode.HALF_UP);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error parsing variants for product {}: {}", product.getId(), e.getMessage());
            }
        }

        if ("WEIGHT".equals(saleMode) && product.getPricePerKg() != null) {
            return product.getPricePerKg();
        }
        return product.getPrice();
    }

    private String fmtQty(BigDecimal qty, String unit) {
        if (qty == null) return "0";
        String num = qty.stripTrailingZeros().toPlainString();
        return (unit != null && !"unit".equals(unit)) ? num + " " + unit : num;
    }

    public List<Product> searchProducts(UUID businessId, String query) {
        if (query == null || query.isBlank()) {
            return productRepo.findByBusinessIdAndIsActiveTrue(businessId);
        }
        return productRepo.search(businessId, query);
    }

    /** Top 15 productos más vendidos en los últimos 7 días, en orden de ranking */
    public List<Map<String, Object>> getTopProducts(UUID businessId) {
        Instant from = Instant.now().minus(7, ChronoUnit.DAYS);
        Instant to   = Instant.now();
        List<Object[]> rows = saleRepo.topProductsByRevenue(businessId, from, to);
        List<UUID> topIds = rows.stream().limit(15).map(r -> (UUID) r[0]).toList();
        if (topIds.isEmpty()) return List.of();

        // findAllById no respeta el orden pedido: reordenar según el ranking de ventas
        Map<UUID, Product> found = new java.util.HashMap<>();
        productRepo.findAllById(topIds).forEach(p -> { if (p.isActive()) found.put(p.getId(), p); });

        return topIds.stream()
                .map(found::get)
                .filter(p -> p != null)
                .map(p -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id",         p.getId());
                    m.put("name",       p.getName());
                    m.put("price",      p.getPrice());
                    m.put("stock",      p.getStock());
                    m.put("saleMode",   p.getSaleMode());
                    m.put("baseUnit",   p.getBaseUnit());
                    m.put("pricePerKg", p.getPricePerKg());
                    m.put("variants",   p.getVariants());
                    return m;
                }).toList();
    }

    // ── Corte de caja ────────────────────────────────────────────────────────
    public Map<String, Object> getTodaySummary(UUID businessId) {
        Instant from = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Instant to   = Instant.now();

        BigDecimal totalRevenue = Objects.requireNonNullElse(
                saleRepo.sumByBusinessAndPeriod(businessId, from, to), BigDecimal.ZERO);
        long count = saleRepo.countByBusinessAndPeriod(businessId, from, to);

        Map<String, BigDecimal> byMethod = new HashMap<>();
        for (Object[] row : saleRepo.sumByPaymentMethodAndPeriod(businessId, from, to)) {
            byMethod.put(row[0].toString(), (BigDecimal) row[1]);
        }

        BigDecimal avgTicket = count > 0
                ? totalRevenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        List<CashRegisterSession> history = sessionRepo.findTop10ByBusinessIdOrderByClosedAtDesc(businessId);

        return Map.of(
                "totalRevenue",     totalRevenue,
                "transactionCount", count,
                "avgTicket",        avgTicket,
                "cash",             byMethod.getOrDefault("cash",     BigDecimal.ZERO),
                "card",             byMethod.getOrDefault("card",     BigDecimal.ZERO),
                "transfer",         byMethod.getOrDefault("transfer", BigDecimal.ZERO),
                "mp",               byMethod.getOrDefault("mp",       BigDecimal.ZERO),
                "history",          history.stream().map(s -> Map.of(
                        "id",           s.getId(),
                        "closedAt",     s.getClosedAt().toString(),
                        "total",        s.getTotalRevenue(),
                        "transactions", s.getTransactionCount()
                )).toList()
        );
    }

    @Transactional
    public Map<String, Object> closeRegister(UUID businessId, UUID cashierId, String notes) {
        Instant from = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Instant to   = Instant.now();

        BigDecimal totalRevenue = Objects.requireNonNullElse(
                saleRepo.sumByBusinessAndPeriod(businessId, from, to), BigDecimal.ZERO);
        long count = saleRepo.countByBusinessAndPeriod(businessId, from, to);

        Map<String, BigDecimal> byMethod = new HashMap<>();
        for (Object[] row : saleRepo.sumByPaymentMethodAndPeriod(businessId, from, to)) {
            byMethod.put(row[0].toString(), (BigDecimal) row[1]);
        }

        Business business = businessRepo.findById(businessId).orElseThrow();
        User cashier = cashierId != null ? userRepo.findById(cashierId).orElse(null) : null;

        CashRegisterSession session = CashRegisterSession.builder()
                .business(business)
                .cashier(cashier)
                .openedAt(from)
                .closedAt(to)
                .totalCash(     byMethod.getOrDefault("cash",     BigDecimal.ZERO))
                .totalCard(     byMethod.getOrDefault("card",     BigDecimal.ZERO))
                .totalTransfer( byMethod.getOrDefault("transfer", BigDecimal.ZERO))
                .totalMp(       byMethod.getOrDefault("mp",       BigDecimal.ZERO))
                .totalRevenue(  totalRevenue)
                .transactionCount((int) count)
                .notes(notes)
                .status("CLOSED")
                .build();

        sessionRepo.save(session);
        log.info("corte.closed business={} total={} transactions={}", businessId, totalRevenue, count);

        return Map.of(
                "saved",            true,
                "totalRevenue",     totalRevenue,
                "transactionCount", count,
                "cash",             byMethod.getOrDefault("cash",     BigDecimal.ZERO),
                "card",             byMethod.getOrDefault("card",     BigDecimal.ZERO),
                "transfer",         byMethod.getOrDefault("transfer", BigDecimal.ZERO),
                "mp",               byMethod.getOrDefault("mp",       BigDecimal.ZERO)
        );
    }
}
