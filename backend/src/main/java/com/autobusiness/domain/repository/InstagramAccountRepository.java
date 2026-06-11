package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.InstagramAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InstagramAccountRepository extends JpaRepository<InstagramAccount, UUID> {
    Optional<InstagramAccount> findByBusinessId(UUID businessId);
    Optional<InstagramAccount> findByIgUserId(String igUserId);
    List<InstagramAccount> findByTokenExpiresAtBefore(Instant limit);
}
