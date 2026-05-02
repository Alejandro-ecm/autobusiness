package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import com.autobusiness.events.AlertCreatedEvent;
import com.autobusiness.events.EventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final ProductRepository productRepo;
    private final BusinessRepository businessRepo;
    private final BranchRepository branchRepo;
    private final AlertRepository alertRepo;
    private final InventoryMovementRepository movementRepo;
    private final UserRepository userRepo;
    private final EventPublisher eventPublisher;

    public List<Product> getInventory(UUID businessId) {
        return productRepo.findByBusinessIdAndIsActiveTrue(businessId);
    }

    public List<Product> getLowStock(UUID businessId) {
        return productRepo.findLowStock(businessId);
    }

    @Transactional
    public Product adjustStock(UUID businessId, UUID productId, int delta, String reason) {
        return adjustStock(businessId, productId, delta, reason, null);
    }

    @Transactional
    public Product adjustStock(UUID businessId, UUID productId, int delta, String reason, UUID userId) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));

        if (!product.getBusiness().getId().equals(businessId)) {
            throw new SecurityException("Acceso denegado");
        }

        int newStock = product.getStock() + delta;
        if (newStock < 0) throw new IllegalStateException("Stock no puede ser negativo");

        product.setStock(newStock);
        Product saved = productRepo.save(product);

        User user = userId != null ? userRepo.findById(userId).orElse(null) : null;
        movementRepo.save(InventoryMovement.builder()
                .business(product.getBusiness())
                .product(product)
                .type(delta >= 0 ? "IN" : "OUT")
                .quantity(Math.abs(delta))
                .reason(reason != null ? reason : "Ajuste manual")
                .createdBy(user)
                .build());

        if (saved.isLowStock()) {
            Alert alert = alertRepo.save(Alert.builder()
                    .business(product.getBusiness())
                    .type("STOCK_LOW")
                    .severity("WARNING")
                    .message("Stock bajo: " + product.getName() + " — quedan " + newStock + " unidades")
                    .referenceType("product")
                    .referenceId(productId)
                    .build());
            eventPublisher.publish(new AlertCreatedEvent(alert));
        }

        return saved;
    }

    @Transactional
    public Product createProduct(UUID businessId, Product product) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        product.setBusiness(business);
        return productRepo.save(product);
    }

    @Transactional
    public Product setBarcode(UUID businessId, UUID productId, String barcode) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!product.getBusiness().getId().equals(businessId))
            throw new SecurityException("Acceso denegado");
        product.setBarcode(barcode);
        return productRepo.save(product);
    }

    @Transactional
    public Map<String, Object> bulkImport(UUID businessId, List<Map<String, Object>> rows) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        int created = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            try {
                String name = str(row, "name");
                if (name == null || name.isBlank()) { errors.add("Fila " + (i + 2) + ": nombre requerido"); continue; }
                BigDecimal price = decimal(row, "price");
                if (price == null || price.compareTo(BigDecimal.ZERO) < 0) { errors.add("Fila " + (i + 2) + ": precio inválido"); continue; }

                Product p = Product.builder()
                        .name(name.trim())
                        .price(price)
                        .cost(decimal(row, "cost") != null ? decimal(row, "cost") : BigDecimal.ZERO)
                        .stock(intVal(row, "stock", 0))
                        .minStock(intVal(row, "minStock", 5))
                        .sku(str(row, "sku"))
                        .barcode(str(row, "barcode"))
                        .description(str(row, "description"))
                        .isOnline(boolVal(row, "isOnline"))
                        .business(business)
                        .build();
                productRepo.save(p);
                created++;
            } catch (Exception e) {
                errors.add("Fila " + (i + 2) + ": " + e.getMessage());
            }
        }
        return Map.of("created", created, "errors", errors);
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k); return v != null && !v.toString().isBlank() ? v.toString().trim() : null;
    }
    private BigDecimal decimal(Map<String, Object> m, String k) {
        try { Object v = m.get(k); return v != null ? new BigDecimal(v.toString()) : null; } catch (Exception e) { return null; }
    }
    private int intVal(Map<String, Object> m, String k, int def) {
        try { Object v = m.get(k); return v != null ? (int) Double.parseDouble(v.toString()) : def; } catch (Exception e) { return def; }
    }
    private boolean boolVal(Map<String, Object> m, String k) {
        Object v = m.get(k); if (v == null) return false;
        String s = v.toString().toLowerCase(); return s.equals("si") || s.equals("sí") || s.equals("true") || s.equals("1") || s.equals("yes");
    }

   @Transactional
public Product updateProduct(UUID businessId, UUID productId, Product updates) {
    Product product = productRepo.findById(productId)
            .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));

    if (!product.getBusiness().getId().equals(businessId)) {
        throw new SecurityException("Acceso denegado");
    }

    product.setName(updates.getName());
    product.setPrice(updates.getPrice());
    product.setCost(updates.getCost());
    product.setMinStock(updates.getMinStock());
    product.setDescription(updates.getDescription());
    product.setOnline(updates.isOnline());
    if (updates.getImageUrl() != null) product.setImageUrl(updates.getImageUrl());
    if (updates.getCategory() != null) product.setCategory(updates.getCategory());

    return productRepo.save(product);
}

    // Lombok doesn't generate setIsOnline - add manually
    // This is a workaround since Lombok generates setOnline for boolean isOnline
}
