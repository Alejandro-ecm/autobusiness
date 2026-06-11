package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "customers")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Customer {

    @Id @GeneratedValue
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private String name;

    private String phone;
    private String email;
    private String address;
    private String notes;

    @Column(name = "total_credit")
    @Builder.Default
    private BigDecimal totalCredit = BigDecimal.ZERO;

    @Builder.Default
    private boolean isActive = true;

    /** Último recordatorio de pago enviado por el Cobrador IA */
    @Column(name = "cobrador_reminded_at")
    private Instant cobradorRemindedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
