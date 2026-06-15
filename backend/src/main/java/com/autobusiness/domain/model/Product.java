package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "products")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "business"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    private String sku;
    private String barcode;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal cost = BigDecimal.ZERO;

    // Stock ahora es decimal para soportar kg, gramos, etc.
    @Column(nullable = false, precision = 12, scale = 4)
    @Builder.Default
    private BigDecimal stock = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 4)
    @Builder.Default
    private BigDecimal minStock = BigDecimal.valueOf(5);

    private String imageUrl;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private boolean isOnline = false;

    // ── Modo de venta ─────────────────────────────────────────────────────────
    // UNIT = por pieza (default, backward compatible)
    // WEIGHT = por peso (kg, g, etc.)
    // MIXED = usuario elige pieza o peso en el POS
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String saleMode = "UNIT";

    // Unidad base: "unit", "kg", "g", "L", "mL", etc.
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String baseUnit = "unit";

    // Si el POS debe permitir cantidades decimales
    @Builder.Default
    private boolean allowsDecimal = false;

    // Precio por kg (usado cuando saleMode = WEIGHT o MIXED)
    @Column(precision = 12, scale = 4)
    private BigDecimal pricePerKg;

    // Variantes en JSON: [{"name":"Costal 50kg","multiplier":50,"priceOverride":null}, ...]
    @Column(columnDefinition = "TEXT")
    private String variants;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public BigDecimal getMargin() {
        if (price == null || price.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return price.subtract(cost != null ? cost : BigDecimal.ZERO)
                .divide(price, 4, java.math.RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    public boolean isLowStock() {
        if (stock == null || minStock == null) return false;
        return stock.compareTo(minStock) <= 0;
    }

    // Expone el id de la categoría en el JSON (el frontend lee `categoryId`).
    // Sin esto, la categoría sólo llega anidada en `category` y el front no la veía.
    public UUID getCategoryId() {
        return category != null ? category.getId() : null;
    }

    // Devuelve el precio efectivo dado un modo de venta
    public BigDecimal effectivePrice(String mode) {
        if ("WEIGHT".equals(mode) && pricePerKg != null) return pricePerKg;
        return price;
    }
}
