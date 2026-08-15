package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import com.autobusiness.events.AlertCreatedEvent;
import com.autobusiness.events.EventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

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
    public Product adjustStock(UUID businessId, UUID productId, BigDecimal delta, String reason) {
        return adjustStock(businessId, productId, delta, reason, null);
    }

    @Transactional
    public Product adjustStock(UUID businessId, UUID productId, BigDecimal delta, String reason, UUID userId) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));

        if (!product.getBusiness().getId().equals(businessId))
            throw new SecurityException("Acceso denegado");

        BigDecimal newStock = product.getStock().add(delta);
        if (newStock.compareTo(BigDecimal.ZERO) < 0)
            throw new IllegalStateException("Stock no puede ser negativo");

        product.setStock(newStock);
        Product saved = productRepo.save(product);

        User user = userId != null ? userRepo.findById(userId).orElse(null) : null;
        movementRepo.save(InventoryMovement.builder()
                .business(product.getBusiness())
                .product(product)
                .type(delta.compareTo(BigDecimal.ZERO) >= 0 ? "IN" : "OUT")
                .quantity(delta.abs())
                .reason(reason != null ? reason : "Ajuste manual")
                .createdBy(user)
                .build());

        if (saved.isLowStock()) {
            String stockDisplay = saved.getStock().stripTrailingZeros().toPlainString()
                    + (!"unit".equals(saved.getBaseUnit()) ? " " + saved.getBaseUnit() : "");
            Alert alert = alertRepo.save(Alert.builder()
                    .business(product.getBusiness())
                    .type("STOCK_LOW")
                    .severity("WARNING")
                    .message("Stock bajo: " + product.getName() + " — quedan " + stockDisplay)
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
    public void deleteProduct(UUID businessId, UUID productId) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!product.getBusiness().getId().equals(businessId))
            throw new SecurityException("Acceso denegado");
        product.setActive(false);
        productRepo.save(product);
    }

    @Transactional
    public Product setBarcode(UUID businessId, UUID productId, String barcode, String barcode2) {
        return setBarcode(businessId, productId, barcode, barcode2, null);
    }

    @Transactional
    public Product setBarcode(UUID businessId, UUID productId, String barcode, String barcode2, String extraBarcodes) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));
        if (!product.getBusiness().getId().equals(businessId))
            throw new SecurityException("Acceso denegado");
        product.setBarcode(barcode);
        product.setBarcode2(barcode2);
        product.setExtraBarcodes(extraBarcodes);
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
                if (name == null || name.isBlank()) {
                    errors.add("Fila " + (i + 2) + ": nombre requerido"); continue;
                }
                BigDecimal price = decimal(row, "price");
                if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
                    errors.add("Fila " + (i + 2) + ": precio inválido"); continue;
                }

                // Modo de venta (UNIT/WEIGHT/MIXED) — default UNIT
                String saleMode = str(row, "saleMode");
                if (saleMode == null) saleMode = str(row, "tipoVenta");
                if (saleMode == null) saleMode = "UNIT";
                saleMode = saleMode.toUpperCase();
                if (!Set.of("UNIT", "WEIGHT", "MIXED").contains(saleMode)) saleMode = "UNIT";

                // Unidad base
                String baseUnit = str(row, "baseUnit");
                if (baseUnit == null) baseUnit = str(row, "unidad");
                if (baseUnit == null) baseUnit = "WEIGHT".equals(saleMode) ? "kg" : "unit";

                // Precio por kg
                BigDecimal pricePerKg = decimal(row, "pricePerKg");
                if (pricePerKg == null) pricePerKg = decimal(row, "precioPorKg");

                // Variantes en formato texto: "Costal:50,Ton:1000"
                String variantsRaw = str(row, "variants");
                if (variantsRaw == null) variantsRaw = str(row, "variantes");
                String variantsJson = parseVariantsText(variantsRaw);

                // Stock decimal
                BigDecimal stock = decimalVal(row, "stock", BigDecimal.ZERO);
                BigDecimal minStock = decimalVal(row, "minStock", BigDecimal.valueOf(5));

                Product p = Product.builder()
                        .name(name.trim())
                        .price(price)
                        .cost(decimal(row, "cost") != null ? decimal(row, "cost") : BigDecimal.ZERO)
                        .stock(stock)
                        .minStock(minStock)
                        .sku(str(row, "sku"))
                        .barcode(str(row, "barcode"))
                        .description(str(row, "description"))
                        .isOnline(boolVal(row, "isOnline"))
                        .saleMode(saleMode)
                        .baseUnit(baseUnit)
                        .allowsDecimal("WEIGHT".equals(saleMode) || "MIXED".equals(saleMode))
                        .pricePerKg(pricePerKg)
                        .variants(variantsJson)
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

    /**
     * Convierte "Costal:50,Ton:1000" → JSON array de variantes.
     * Formato nombre:multiplicador o nombre:multiplicador:precioOverride
     */
    private String parseVariantsText(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            StringBuilder sb = new StringBuilder("[");
            String[] parts = raw.split(",");
            boolean first = true;
            for (String part : parts) {
                String[] tokens = part.trim().split(":");
                if (tokens.length < 2) continue;
                String vName = tokens[0].trim();
                String mult  = tokens[1].trim();
                // Validate mult is numeric to prevent JSON injection
                new java.math.BigDecimal(mult);
                if (!first) sb.append(",");
                first = false;
                sb.append("{\"name\":\"").append(escapeJsonString(vName))
                  .append("\",\"multiplier\":").append(mult);
                if (tokens.length >= 3) {
                    String priceOverride = tokens[2].trim();
                    new java.math.BigDecimal(priceOverride); // validate numeric
                    sb.append(",\"priceOverride\":").append(priceOverride);
                } else {
                    sb.append(",\"priceOverride\":null");
                }
                sb.append("}");
            }
            sb.append("]");
            return sb.toString().equals("[]") ? null : sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static String escapeJsonString(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    @Transactional
    public Product updateProduct(UUID businessId, UUID productId, Product updates) {
        Product product = productRepo.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado"));

        if (!product.getBusiness().getId().equals(businessId))
            throw new SecurityException("Acceso denegado");

        product.setName(updates.getName());
        product.setPrice(updates.getPrice());
        product.setCost(updates.getCost());
        product.setMinStock(updates.getMinStock());
        product.setDescription(updates.getDescription());
        product.setOnline(updates.isOnline());
        if (updates.getImageUrl() != null) product.setImageUrl(updates.getImageUrl());
        if (updates.getCategory() != null) product.setCategory(updates.getCategory());

        // Nuevos campos de modo de venta
        if (updates.getSaleMode() != null) product.setSaleMode(updates.getSaleMode());
        if (updates.getBaseUnit() != null) product.setBaseUnit(updates.getBaseUnit());
        product.setAllowsDecimal(updates.isAllowsDecimal());
        if (updates.getPricePerKg() != null) product.setPricePerKg(updates.getPricePerKg());
        if (updates.getVariants() != null) product.setVariants(updates.getVariants());

        return productRepo.save(product);
    }

    // ── Helpers de parseo ─────────────────────────────────────────────────────
    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v != null && !v.toString().isBlank() ? v.toString().trim() : null;
    }

    private BigDecimal decimal(Map<String, Object> m, String k) {
        try { Object v = m.get(k); return v != null ? new BigDecimal(v.toString()) : null; }
        catch (Exception e) { return null; }
    }

    private BigDecimal decimalVal(Map<String, Object> m, String k, BigDecimal def) {
        try { Object v = m.get(k); return v != null ? new BigDecimal(v.toString()) : def; }
        catch (Exception e) { return def; }
    }

    private boolean boolVal(Map<String, Object> m, String k) {
        Object v = m.get(k); if (v == null) return false;
        String s = v.toString().toLowerCase();
        return s.equals("si") || s.equals("sí") || s.equals("true") || s.equals("1") || s.equals("yes");
    }
}
