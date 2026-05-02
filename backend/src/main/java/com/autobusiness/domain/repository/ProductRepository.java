package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findByBusinessIdAndIsActiveTrue(UUID businessId);

    List<Product> findByBusinessIdAndBranchIdAndIsActiveTrue(UUID businessId, UUID branchId);

    @Query("SELECT p FROM Product p WHERE p.business.id = :businessId AND p.isActive = true " +
           "AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<Product> search(@Param("businessId") UUID businessId, @Param("q") String query);

    @Query("SELECT p FROM Product p WHERE p.business.id = :businessId AND p.isActive = true " +
           "AND p.stock <= p.minStock")
    List<Product> findLowStock(@Param("businessId") UUID businessId);

    List<Product> findByBusinessIdAndIsOnlineTrueAndIsActiveTrue(UUID businessId);

    long countByBusinessId(UUID businessId);
}
