package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    List<Customer> findByBusinessIdAndIsActiveTrueOrderByName(UUID businessId);

    List<Customer> findByBusinessIdAndIsActiveTrueAndTotalCreditGreaterThan(UUID businessId, java.math.BigDecimal min);

    @Query("SELECT c FROM Customer c WHERE c.business.id = :bid AND c.isActive = true " +
           "AND (LOWER(c.name) LIKE LOWER(CONCAT('%',:q,'%')) OR c.phone LIKE CONCAT('%',:q,'%'))")
    List<Customer> search(@Param("bid") UUID businessId, @Param("q") String query);
}
