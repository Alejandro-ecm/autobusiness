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

    boolean existsBySourceOrderId(UUID sourceOrderId);
    java.util.Optional<Sale> findBySourceOrderId(UUID sourceOrderId);

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

    // ----- Estadísticas por cajero -----

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.cashier.id = :cashierId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    Long countByCashierAndPeriod(@Param("cashierId") UUID cashierId,
                                 @Param("from") Instant from,
                                 @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.cashier.id = :cashierId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    BigDecimal sumByCashierAndPeriod(@Param("cashierId") UUID cashierId,
                                     @Param("from") Instant from,
                                     @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(si.unitCost * si.quantity), 0) FROM SaleItem si JOIN si.sale s " +
           "WHERE s.cashier.id = :cashierId AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed'")
    BigDecimal sumCostByCashierAndPeriod(@Param("cashierId") UUID cashierId,
                                         @Param("from") Instant from,
                                         @Param("to") Instant to);

    @Query("SELECT s.paymentMethod, COALESCE(SUM(s.total), 0) FROM Sale s " +
           "WHERE s.cashier.id = :cashierId AND s.createdAt BETWEEN :from AND :to " +
           "AND s.status = 'completed' GROUP BY s.paymentMethod")
    List<Object[]> sumByPaymentMethodAndCashier(@Param("cashierId") UUID cashierId,
                                                @Param("from") Instant from,
                                                @Param("to") Instant to);

    @Query("SELECT si.product.name, SUM(si.quantity), SUM(si.subtotal) " +
           "FROM SaleItem si JOIN si.sale s WHERE s.cashier.id = :cashierId " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed' " +
           "GROUP BY si.product.name ORDER BY SUM(si.subtotal) DESC")
    List<Object[]> topProductsByCashier(@Param("cashierId") UUID cashierId,
                                        @Param("from") Instant from,
                                        @Param("to") Instant to);

    // ----- Ranking de cajeros del negocio -----

    @Query("SELECT s.cashier.id, s.cashier.name, COUNT(s), COALESCE(SUM(s.total), 0) " +
           "FROM Sale s WHERE s.business.id = :businessId AND s.cashier IS NOT NULL " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed' " +
           "GROUP BY s.cashier.id, s.cashier.name ORDER BY SUM(s.total) DESC")
    List<Object[]> cashierRanking(@Param("businessId") UUID businessId,
                                  @Param("from") Instant from,
                                  @Param("to") Instant to);

    @Query("SELECT s.cashier.id, COALESCE(SUM(si.unitCost * si.quantity), 0) " +
           "FROM SaleItem si JOIN si.sale s WHERE s.business.id = :businessId AND s.cashier IS NOT NULL " +
           "AND s.createdAt BETWEEN :from AND :to AND s.status = 'completed' " +
           "GROUP BY s.cashier.id")
    List<Object[]> cashierCosts(@Param("businessId") UUID businessId,
                                @Param("from") Instant from,
                                @Param("to") Instant to);

    // ----- Ganancias totales por categoría -----
    // Devuelve: [categoryId (puede ser null), ingresos, ganancia, unidades vendidas]
    // LEFT JOIN para incluir también los productos sin categoría asignada.
    @Query("SELECT c.id, " +
           "COALESCE(SUM(si.subtotal), 0), " +
           "COALESCE(SUM((si.unitPrice - si.unitCost) * si.quantity), 0), " +
           "COALESCE(SUM(si.quantity), 0) " +
           "FROM SaleItem si JOIN si.sale s JOIN si.product p LEFT JOIN p.category c " +
           "WHERE s.business.id = :businessId AND s.status = 'completed' " +
           "GROUP BY c.id")
    List<Object[]> earningsByCategory(@Param("businessId") UUID businessId);
}
