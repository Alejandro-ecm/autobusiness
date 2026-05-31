package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, UUID> {
    Optional<PendingRegistration> findByMpExternalRef(String mpExternalRef);
    boolean existsByEmail(String email);
}
