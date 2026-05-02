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

    public record CartItemRequest(UUID productId, int quantity) {}

    public record CheckoutRequest(UUID businessId, UUID branchId, UUID cashierId,
                                   List<CartItemRequest> items, String paymentMethod,
                                   BigDecimal cashReceived) {}

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

            if (product.getStock() < item.quantity()) {
                throw new IllegalStateException(
                        product.getStock() == 0
                                ? product.getName() + " está agotado"
                                : "Solo quedan " + product.getStock() + " unidades de " + product.getName()
                );
            }

            BigDecimal itemSubtotal = product.getPrice().multiply(BigDecimal.valueOf(item.quantity()));
            SaleItem saleItem = SaleItem.builder()
                    .sale(sale)
                    .product(product)
                    .quantity(item.quantity())
                    .unitPrice(product.getPrice())
                    .unitCost(product.getCost())
                    .subtotal(itemSubtotal)
                    .build();
            sale.getItems().add(saleItem);

            product.setStock(product.getStock() - item.quantity());
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

    public List<Product> searchProducts(UUID businessId, String query) {
        if (query == null || query.isBlank()) {
            return productRepo.findByBusinessIdAndIsActiveTrue(businessId);
        }
        return productRepo.search(businessId, query);
    }

    // ── Corte de caja: resumen del día ────────────────────────────────────────
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
                ? totalRevenue.divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        List<CashRegisterSession> history = sessionRepo.findTop10ByBusinessIdOrderByClosedAtDesc(businessId);

        return Map.of(
                "totalRevenue",    totalRevenue,
                "transactionCount", count,
                "avgTicket",       avgTicket,
                "cash",            byMethod.getOrDefault("cash",     BigDecimal.ZERO),
                "card",            byMethod.getOrDefault("card",     BigDecimal.ZERO),
                "transfer",        byMethod.getOrDefault("transfer", BigDecimal.ZERO),
                "mp",              byMethod.getOrDefault("mp",       BigDecimal.ZERO),
                "history",         history.stream().map(s -> Map.of(
                        "id",          s.getId(),
                        "closedAt",    s.getClosedAt().toString(),
                        "total",       s.getTotalRevenue(),
                        "transactions", s.getTransactionCount()
                )).toList()
        );
    }

    // ── Persistir corte de caja ───────────────────────────────────────────────
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
                "saved",           true,
                "totalRevenue",    totalRevenue,
                "transactionCount", count,
                "cash",            byMethod.getOrDefault("cash",     BigDecimal.ZERO),
                "card",            byMethod.getOrDefault("card",     BigDecimal.ZERO),
                "transfer",        byMethod.getOrDefault("transfer", BigDecimal.ZERO),
                "mp",              byMethod.getOrDefault("mp",       BigDecimal.ZERO)
        );
    }
}
