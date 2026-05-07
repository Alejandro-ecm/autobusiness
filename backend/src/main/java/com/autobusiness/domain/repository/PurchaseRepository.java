package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {
    List<Purchase> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);
}
