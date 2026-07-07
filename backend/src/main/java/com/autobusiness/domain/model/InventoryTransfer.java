package com.autobusiness.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "inventory_transfers")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InventoryTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_business_id", nullable = false)
    private Business sourceBusiness;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_business_id", nullable = false)
    private Business destinationBusiness;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_product_id", nullable = false)
    private Product sourceProduct;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_product_id", nullable = false)
    private Product destinationProduct;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "total_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalCost;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_retail_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalRetailValue;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "COMPLETED";

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_authorized_by")
    private User destinationAuthorizedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
