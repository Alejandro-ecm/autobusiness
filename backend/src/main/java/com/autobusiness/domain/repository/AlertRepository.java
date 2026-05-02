package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlertRepository extends JpaRepository<Alert, UUID> {
    List<Alert> findByBusinessIdAndIsReadFalseOrderByCreatedAtDesc(UUID businessId);
    long countByBusinessIdAndIsReadFalse(UUID businessId);
}
