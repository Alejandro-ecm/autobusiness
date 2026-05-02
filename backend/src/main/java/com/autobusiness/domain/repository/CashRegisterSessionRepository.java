package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.CashRegisterSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CashRegisterSessionRepository extends JpaRepository<CashRegisterSession, UUID> {
    List<CashRegisterSession> findTop10ByBusinessIdOrderByClosedAtDesc(UUID businessId);
}
