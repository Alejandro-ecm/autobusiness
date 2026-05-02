package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByTransactionId(String transactionId);

    Optional<Payment> findByPreferenceId(String preferenceId);

    List<Payment> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    List<Payment> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

    @Query("SELECT p FROM Payment p WHERE p.business.id = :businessId AND p.status = :status ORDER BY p.createdAt DESC")
    List<Payment> findByBusinessIdAndStatus(@Param("businessId") UUID businessId, @Param("status") String status);

    boolean existsByTransactionId(String transactionId);
}
