package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.LegalAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LegalAcceptanceRepository extends JpaRepository<LegalAcceptance, UUID> {
    Optional<LegalAcceptance> findTopByUserIdOrderByAcceptedAtDesc(UUID userId);
    boolean existsByUserIdAndTermsVersionAndPrivacyVersionAndAcceptableUseVersion(
        UUID userId, String termsVersion, String privacyVersion, String acceptableUseVersion);
}
