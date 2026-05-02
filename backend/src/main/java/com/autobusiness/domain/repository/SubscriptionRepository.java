package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    Optional<Subscription> findByBusinessId(UUID businessId);

    @Query("SELECT s FROM Subscription s WHERE s.status = 'TRIAL' AND s.trialEndsAt < :now")
    List<Subscription> findExpiredTrials(@Param("now") Instant now);

    @Query("SELECT s FROM Subscription s WHERE s.status = 'ACTIVE' AND s.currentPeriodEnd < :now")
    List<Subscription> findExpiredActive(@Param("now") Instant now);

    @Query("SELECT COUNT(s) FROM Subscription s WHERE s.status = :status")
    long countByStatus(@Param("status") String status);

    @Query("SELECT COUNT(s) FROM Subscription s WHERE s.plan = :plan AND s.status = 'ACTIVE'")
    long countActivePlan(@Param("plan") String plan);
}
