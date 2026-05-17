package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {
    List<Purchase> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    @Query("SELECT COALESCE(SUM(p.total), 0) FROM Purchase p WHERE p.business.id = :businessId " +
           "AND p.createdAt BETWEEN :from AND :to")
    BigDecimal sumByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                      @Param("from") Instant from,
                                      @Param("to") Instant to);
}
