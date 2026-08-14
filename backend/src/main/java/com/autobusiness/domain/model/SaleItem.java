package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SaleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    // Nullable: los ítems "libres" (ej: copias a precio variable) no tienen
    // producto de inventario asociado — ver customName.
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "business", "branch", "category"})
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = true)
    private Product product;

    // Nombre del ítem cuando no hay producto (venta libre desde la Caja)
    @Column(name = "custom_name")
    private String customName;

    // Decimal para soportar kg (ej: 1.750 kg)
    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal unitCost = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    // Nombre de la variante usada ("Costal 50kg", null si venta normal)
    private String variantName;

    public String getDisplayName() {
        return product != null ? product.getName() : customName;
    }
}
