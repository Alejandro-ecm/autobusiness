package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Business;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface BusinessRepository extends JpaRepository<Business, UUID> {
    Optional<Business> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
