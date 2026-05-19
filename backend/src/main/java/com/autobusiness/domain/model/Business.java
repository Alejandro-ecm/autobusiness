package com.autobusiness.domain.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "businesses")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Business {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    private String description;
    private String logoUrl;
    private String bannerUrl;

    @Column(length = 30)
    @Builder.Default
    private String storeTheme = "modern";

    private String phone;
    private String email;
    private String address;

    @Column(nullable = false)
    @Builder.Default
    private String plan = "free";

    @Column(nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean isSuspended = false;

    private Instant suspendedAt;

    private String subdomain;

    @Column(length = 50)
    private String profileType;

    @Column(nullable = false)
    @Builder.Default
    private boolean onboardingCompleted = false;

    // Mercado Pago por negocio
    @Column(length = 500)
    private String mpAccessToken;
    @Column(length = 500)
    private String mpRefreshToken;
    @Column(length = 100)
    private String mpUserId;
    @Column(length = 200)
    private String mpPublicKey;
    private Instant mpConnectedAt;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    @OneToMany(mappedBy = "business", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Branch> branches = new ArrayList<>();
}
