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
@Table(name = "customer_transactions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CustomerTransaction {

    @Id @GeneratedValue
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "business"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false)
    private String type; // PURCHASE | PAYMENT

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    private String description;

    @Column(name = "sale_id")
    private UUID saleId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
