package com.autobusiness.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String eventType;

    private UUID userId;

    @Column(nullable = false)
    @Builder.Default
    private Instant timestamp = Instant.now();

    @Column(length = 45)
    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @CreationTimestamp
    private Instant createdAt;
}
