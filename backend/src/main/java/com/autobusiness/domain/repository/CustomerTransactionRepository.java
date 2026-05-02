package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.CustomerTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerTransactionRepository extends JpaRepository<CustomerTransaction, UUID> {
    List<CustomerTransaction> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);
}
