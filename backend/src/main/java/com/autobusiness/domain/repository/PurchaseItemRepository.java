package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.PurchaseItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PurchaseItemRepository extends JpaRepository<PurchaseItem, UUID> {
}
