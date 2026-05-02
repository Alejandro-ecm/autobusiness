package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);
    Optional<Order> findByBusinessIdAndOrderNumber(UUID businessId, String orderNumber);
    List<Order> findByBusinessIdAndStatus(UUID businessId, String status);
    long countByOrderNumberStartingWith(String prefix);
}
