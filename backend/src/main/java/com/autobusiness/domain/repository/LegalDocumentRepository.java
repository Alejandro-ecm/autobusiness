package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.LegalDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LegalDocumentRepository extends JpaRepository<LegalDocument, UUID> {
    Optional<LegalDocument> findTopByTypeAndPublishedTrueOrderByPublishedAtDesc(String type);
}
