package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invoices")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "sale_id")
    private UUID saleId;

    @Column(name = "payment_id")
    private UUID paymentId;

    @Column(nullable = false, length = 20)
    private String rfc;

    @Column(nullable = false)
    private String razonSocial;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String usoCfdi = "G03";

    @Column(length = 10)
    private String regimenFiscal;

    @Column(length = 10)
    private String cpReceptor;

    private String email;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal iva = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal total;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    private String folioFiscal;

    @Column(columnDefinition = "TEXT")
    private String cfdiXml;

    private String pdfUrl;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}
