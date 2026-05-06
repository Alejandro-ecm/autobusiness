package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_movements")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InventoryMovement {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "business", "category"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String type; // IN, OUT, ADJUSTMENT, LOSS

    // Decimal para soportar movimientos en kg
    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    private String reason;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "business", "passwordHash"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
