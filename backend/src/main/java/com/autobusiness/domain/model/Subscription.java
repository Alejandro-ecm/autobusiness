package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false, unique = true)
    private Business business;

    @Column(nullable = false)
    @Builder.Default
    private String plan = "FREE";

    @Column(nullable = false)
    @Builder.Default
    private String status = "TRIAL";

    @Column(nullable = false)
    private Instant trialEndsAt;

    @Column(nullable = false)
    private Instant currentPeriodStart;

    @Column(nullable = false)
    private Instant currentPeriodEnd;

    private String mpPreapprovalId;

    @Column(name = "last_payment_id")
    private UUID lastPaymentId;

    private Instant canceledAt;
    private String cancelReason;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public boolean isActive() {
        return "ACTIVE".equals(status) ||
               ("TRIAL".equals(status) && Instant.now().isBefore(trialEndsAt));
    }

    public boolean isExpired() {
        return !isActive() && !"CANCELED".equals(status);
    }
}
