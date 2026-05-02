package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.AiInsight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface AiInsightRepository extends JpaRepository<AiInsight, UUID> {

    @Query("SELECT i FROM AiInsight i WHERE i.business.id = :businessId AND i.isDismissed = false " +
           "ORDER BY i.priority DESC, i.createdAt DESC")
    List<AiInsight> findActiveByBusiness(UUID businessId);

    void deleteByBusinessIdAndType(UUID businessId, String type);
}
