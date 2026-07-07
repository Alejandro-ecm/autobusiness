package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.InventoryTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface InventoryTransferRepository extends JpaRepository<InventoryTransfer, UUID> {
    List<InventoryTransfer> findTop50BySourceBusinessIdOrDestinationBusinessIdOrderByCreatedAtDesc(
            UUID sourceBusinessId, UUID destinationBusinessId);

    @Query("SELECT COALESCE(SUM(t.totalCost), 0) FROM InventoryTransfer t " +
            "WHERE t.destinationBusiness.id = :businessId AND t.createdAt BETWEEN :from AND :to")
    BigDecimal sumIncomingCostByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                                  @Param("from") Instant from,
                                                  @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(t.totalCost), 0) FROM InventoryTransfer t " +
            "WHERE t.sourceBusiness.id = :businessId AND t.createdAt BETWEEN :from AND :to")
    BigDecimal sumOutgoingCostByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                                  @Param("from") Instant from,
                                                  @Param("to") Instant to);
}
