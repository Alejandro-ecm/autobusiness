package com.autobusiness.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "legal_acceptances")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LegalAcceptance {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String termsVersion;

    @Column(nullable = false, length = 20)
    private String privacyVersion;

    @Column(nullable = false, length = 20)
    private String acceptableUseVersion;

    @Column(nullable = false)
    @Builder.Default
    private Instant acceptedAt = Instant.now();

    @Column(length = 45)
    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String userAgent;

    @CreationTimestamp
    private Instant createdAt;
}
