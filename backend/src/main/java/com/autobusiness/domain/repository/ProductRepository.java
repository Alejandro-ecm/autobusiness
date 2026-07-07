package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findByBusinessIdAndIsActiveTrue(UUID businessId);

    List<Product> findByBusinessIdAndBranchIdAndIsActiveTrue(UUID businessId, UUID branchId);

    @Query("SELECT p FROM Product p WHERE p.business.id = :businessId AND p.isActive = true " +
           "AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR p.barcode LIKE CONCAT('%', :q, '%'))")
    List<Product> search(@Param("businessId") UUID businessId, @Param("q") String query);

    @Query("SELECT p FROM Product p WHERE p.business.id = :businessId AND p.isActive = true " +
           "AND p.stock <= p.minStock")
    List<Product> findLowStock(@Param("businessId") UUID businessId);

    List<Product> findByBusinessIdAndIsOnlineTrueAndIsActiveTrue(UUID businessId);

    long countByBusinessId(UUID businessId);

    Optional<Product> findFirstByBusinessIdAndBarcodeAndIsActiveTrue(UUID businessId, String barcode);
    Optional<Product> findFirstByBusinessIdAndSkuIgnoreCaseAndIsActiveTrue(UUID businessId, String sku);
    Optional<Product> findFirstByBusinessIdAndNameIgnoreCaseAndIsActiveTrue(UUID businessId, String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :productId")
    Optional<Product> findByIdForUpdate(@Param("productId") UUID productId);
}
