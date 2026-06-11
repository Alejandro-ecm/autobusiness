package com.autobusiness.domain.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "instagram_accounts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InstagramAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "business_id", nullable = false, unique = true)
    private UUID businessId;

    @Column(name = "ig_user_id", nullable = false, unique = true, length = 50)
    private String igUserId;

    @Column(length = 100)
    private String username;

    @JsonIgnore
    @Column(name = "access_token", nullable = false, columnDefinition = "TEXT")
    private String accessToken;

    @Column(name = "token_expires_at")
    private Instant tokenExpiresAt;

    @CreationTimestamp
    @Column(name = "connected_at")
    private Instant connectedAt;
}
