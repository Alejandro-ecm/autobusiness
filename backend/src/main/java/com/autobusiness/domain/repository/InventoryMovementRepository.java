package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, UUID> {
    List<InventoryMovement> findTop50ByBusinessIdOrderByCreatedAtDesc(UUID businessId);
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(UUID productId);
}
