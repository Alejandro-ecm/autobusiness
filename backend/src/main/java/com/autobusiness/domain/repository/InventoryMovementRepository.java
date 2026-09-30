package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, UUID> {
    List<InventoryMovement> findTop50ByBusinessIdOrderByCreatedAtDesc(UUID businessId);
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(UUID productId);

    // Valor de la merma a COSTO (no a precio de venta) en el periodo — para
    // que Finanzas descuente lo mismo que ya muestra Inventario.
    @Query("SELECT COALESCE(SUM(m.quantity * m.product.cost), 0) FROM InventoryMovement m " +
           "WHERE m.business.id = :businessId AND m.type = 'LOSS' AND m.createdAt BETWEEN :from AND :to")
    BigDecimal sumLossCostByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                               @Param("from") Instant from,
                                               @Param("to") Instant to);
}
