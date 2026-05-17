package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseService {

    private final PurchaseRepository          purchaseRepo;
    private final ProductRepository           productRepo;
    private final BranchRepository            branchRepo;
    private final UserRepository              userRepo;
    private final BusinessRepository          businessRepo;
    private final InventoryMovementRepository movementRepo;

    public record PurchaseItemRequest(
            UUID productId,
            BigDecimal quantity,
            BigDecimal unitCost
    ) {}

    public List<Map<String, Object>> getPurchases(UUID businessId) {
        return purchaseRepo.findByBusinessIdOrderByCreatedAtDesc(businessId)
                .stream()
                .map(this::toMap)
                .toList();
    }

    @Transactional
    public Map<String, Object> createPurchase(UUID businessId, UUID branchId, UUID userId,
                                               String supplierName, String notes,
                                               List<PurchaseItemRequest> items) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        Branch branch = branchId != null
                ? branchRepo.findById(branchId).orElse(null)
                : branchRepo.findFirstByBusinessIdAndIsMainTrue(businessId).orElse(null);

        User createdBy = userId != null ? userRepo.findById(userId).orElse(null) : null;

        Purchase purchase = Purchase.builder()
                .business(business)
                .branch(branch)
                .createdBy(createdBy)
                .supplierName(supplierName)
                .notes(notes)
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (PurchaseItemRequest req : items) {
            Product product = productRepo.findById(req.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado: " + req.productId()));

            BigDecimal qty  = req.quantity();
            BigDecimal cost = req.unitCost();
            if (qty.compareTo(BigDecimal.ZERO) <= 0)
                throw new IllegalArgumentException("Cantidad inválida para " + product.getName());
            if (cost.compareTo(BigDecimal.ZERO) < 0)
                throw new IllegalArgumentException("Costo inválido para " + product.getName());

            BigDecimal subtotal = cost.multiply(qty).setScale(2, RoundingMode.HALF_UP);

            purchase.getItems().add(PurchaseItem.builder()
                    .purchase(purchase)
                    .product(product)
                    .quantity(qty)
                    .unitCost(cost)
                    .subtotal(subtotal)
                    .build());

            // Costo promedio ponderado antes de actualizar stock
            BigDecimal oldStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            BigDecimal oldCost  = product.getCost()  != null ? product.getCost()  : BigDecimal.ZERO;
            BigDecimal newStock = oldStock.add(qty);

            // Actualizar stock
            product.setStock(newStock);

            if (newStock.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal weightedCost = oldStock.multiply(oldCost)
                        .add(qty.multiply(cost))
                        .divide(newStock, 4, RoundingMode.HALF_UP);
                product.setCost(weightedCost.setScale(2, RoundingMode.HALF_UP));
            }

            productRepo.save(product);

            // Registrar movimiento de inventario (entrada por compra)
            movementRepo.save(InventoryMovement.builder()
                    .business(product.getBusiness())
                    .product(product)
                    .type("IN")
                    .quantity(qty)
                    .reason("Compra a proveedor" + (supplierName != null ? ": " + supplierName : ""))
                    .createdBy(createdBy)
                    .build());

            total = total.add(subtotal);
        }

        purchase.setTotal(total);
        Purchase saved = purchaseRepo.save(purchase);
        log.info("purchase.created id={} business={} supplier='{}' total={}",
                saved.getId(), businessId, supplierName, total);

        return toMap(saved);
    }

    private Map<String, Object> toMap(Purchase p) {
        var m = new HashMap<String, Object>();
        m.put("id",           p.getId());
        m.put("supplierName", p.getSupplierName() != null ? p.getSupplierName() : "");
        m.put("notes",        p.getNotes() != null ? p.getNotes() : "");
        m.put("total",        p.getTotal());
        m.put("status",       p.getStatus());
        m.put("createdAt",    p.getCreatedAt() != null ? p.getCreatedAt().toString() : Instant.now().toString());
        m.put("createdBy",    p.getCreatedBy() != null ? p.getCreatedBy().getName() : "—");
        m.put("items", p.getItems().stream().map(i -> Map.of(
                "productId",   i.getProduct().getId(),
                "productName", i.getProduct().getName(),
                "quantity",    i.getQuantity(),
                "unitCost",    i.getUnitCost(),
                "subtotal",    i.getSubtotal()
        )).toList());
        return m;
    }
}
