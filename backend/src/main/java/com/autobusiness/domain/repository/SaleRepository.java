package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SaleRepository extends JpaRepository<Sale, UUID> {

    List<Sale> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.business.id = :businessId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    BigDecimal sumByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                      @Param("from") Instant from,
                                      @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.branch.id = :branchId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    BigDecimal sumByBranchAndPeriod(@Param("branchId") UUID branchId,
                                    @Param("from") Instant from,
                                    @Param("to") Instant to);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.business.id = :businessId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    Long countByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                   @Param("from") Instant from,
                                   @Param("to") Instant to);

    @Query("SELECT s FROM Sale s WHERE s.business.id = :businessId " +
           "AND s.createdAt BETWEEN :from AND :to ORDER BY s.createdAt DESC")
    List<Sale> findByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                       @Param("from") Instant from,
                                       @Param("to") Instant to);

    @Query("SELECT si.product.id, si.product.name, SUM(si.quantity) as qty, SUM(si.subtotal) as revenue " +
           "FROM SaleItem si JOIN si.sale s WHERE s.business.id = :businessId " +
           "AND s.createdAt BETWEEN :from AND :to GROUP BY si.product.id, si.product.name " +
           "ORDER BY revenue DESC")
    List<Object[]> topProductsByRevenue(@Param("businessId") UUID businessId,
                                         @Param("from") Instant from,
                                         @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(si.unitCost * si.quantity), 0) FROM SaleItem si JOIN si.sale s " +
           "WHERE s.business.id = :businessId AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    BigDecimal sumCostByBusinessAndPeriod(@Param("businessId") UUID businessId,
                                          @Param("from") Instant from,
                                          @Param("to") Instant to);

    @Query(value = "SELECT DATE_TRUNC('day', created_at) as day, COALESCE(SUM(total), 0) as revenue " +
                   "FROM sales WHERE business_id = :businessId " +
                   "AND created_at BETWEEN :from AND :to AND status = 'completed' " +
                   "GROUP BY DATE_TRUNC('day', created_at) ORDER BY day",
           nativeQuery = true)
    List<Object[]> dailyRevenue(@Param("businessId") UUID businessId,
                                @Param("from") Instant from,
                                @Param("to") Instant to);

    @Query("SELECT s.paymentMethod, COALESCE(SUM(s.total), 0) FROM Sale s " +
           "WHERE s.business.id = :businessId AND s.createdAt BETWEEN :from AND :to " +
           "AND s.status = 'completed' GROUP BY s.paymentMethod")
    List<Object[]> sumByPaymentMethodAndPeriod(@Param("businessId") UUID businessId,
                                               @Param("from") Instant from,
                                               @Param("to") Instant to);
}
