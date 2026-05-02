package com.autobusiness.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cash_register_sessions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashRegisterSession {

    @Id @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id")
    private Branch branch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cashier_id")
    private User cashier;

    @Column(name = "opened_at")
    private Instant openedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "total_cash")
    private BigDecimal totalCash;

    @Column(name = "total_card")
    private BigDecimal totalCard;

    @Column(name = "total_transfer")
    private BigDecimal totalTransfer;

    @Column(name = "total_mp")
    private BigDecimal totalMp;

    @Column(name = "total_revenue")
    private BigDecimal totalRevenue;

    @Column(name = "transaction_count")
    private Integer transactionCount;

    private String notes;
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
