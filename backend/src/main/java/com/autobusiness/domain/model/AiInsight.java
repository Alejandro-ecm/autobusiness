package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ai_insights")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiInsight {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    @Builder.Default
    private String status = "GREEN"; // GREEN, YELLOW, RED

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String diagnosis;

    private String cause;

    @Column(nullable = false)
    private String action;

    private String impact;

    @Column(precision = 12, scale = 2)
    private BigDecimal impactAmount;

    @Builder.Default
    private Integer priority = 1;

    @Builder.Default
    private boolean isDismissed = false;

    @CreationTimestamp
    private Instant createdAt;

    private Instant expiresAt;
}
