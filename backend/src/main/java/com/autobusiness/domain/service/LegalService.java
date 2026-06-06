package com.autobusiness.domain.service;

import com.autobusiness.domain.model.AuditLog;
import com.autobusiness.domain.model.LegalAcceptance;
import com.autobusiness.domain.model.LegalDocument;
import com.autobusiness.domain.repository.AuditLogRepository;
import com.autobusiness.domain.repository.LegalAcceptanceRepository;
import com.autobusiness.domain.repository.LegalDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class LegalService {

    private static final String TERMS          = "TERMS";
    private static final String PRIVACY        = "PRIVACY";
    private static final String ACCEPTABLE_USE = "ACCEPTABLE_USE";

    private final LegalDocumentRepository docRepo;
    private final LegalAcceptanceRepository acceptanceRepo;
    private final AuditLogRepository auditRepo;

    public Map<String, Object> getActiveDocument(String type) {
        LegalDocument doc = docRepo.findTopByTypeAndPublishedTrueOrderByPublishedAtDesc(type)
                .orElseThrow(() -> new IllegalStateException("Documento no disponible"));
        return Map.of(
                "type",    doc.getType(),
                "version", doc.getVersion(),
                "title",   doc.getTitle(),
                "content", doc.getContent()
        );
    }

    /** Returns latest active versions for all three documents */
    public Map<String, String> getActiveVersions() {
        String tv = docRepo.findTopByTypeAndPublishedTrueOrderByPublishedAtDesc(TERMS)
                .map(LegalDocument::getVersion).orElse("1.0");
        String pv = docRepo.findTopByTypeAndPublishedTrueOrderByPublishedAtDesc(PRIVACY)
                .map(LegalDocument::getVersion).orElse("1.0");
        String av = docRepo.findTopByTypeAndPublishedTrueOrderByPublishedAtDesc(ACCEPTABLE_USE)
                .map(LegalDocument::getVersion).orElse("1.0");
        return Map.of("termsVersion", tv, "privacyVersion", pv, "acceptableUseVersion", av);
    }

    /** Check if user has accepted the currently active versions of all documents */
    public boolean hasAcceptedLatest(UUID userId) {
        Map<String, String> versions = getActiveVersions();
        return acceptanceRepo.existsByUserIdAndTermsVersionAndPrivacyVersionAndAcceptableUseVersion(
                userId,
                versions.get("termsVersion"),
                versions.get("privacyVersion"),
                versions.get("acceptableUseVersion")
        );
    }

    @Transactional
    public void recordAcceptance(UUID userId, String ipAddress, String userAgent) {
        Map<String, String> versions = getActiveVersions();

        LegalAcceptance acceptance = LegalAcceptance.builder()
                .userId(userId)
                .termsVersion(versions.get("termsVersion"))
                .privacyVersion(versions.get("privacyVersion"))
                .acceptableUseVersion(versions.get("acceptableUseVersion"))
                .acceptedAt(Instant.now())
                .ipAddress(ipAddress)
                .userAgent(userAgent != null && userAgent.length() > 500
                        ? userAgent.substring(0, 500) : userAgent)
                .build();

        acceptanceRepo.save(acceptance);

        auditRepo.save(AuditLog.builder()
                .eventType("LEGAL_ACCEPTANCE")
                .userId(userId)
                .timestamp(Instant.now())
                .ipAddress(ipAddress)
                .metadata(String.format(
                    "{\"termsVersion\":\"%s\",\"privacyVersion\":\"%s\",\"acceptableUseVersion\":\"%s\"}",
                    versions.get("termsVersion"),
                    versions.get("privacyVersion"),
                    versions.get("acceptableUseVersion")
                ))
                .build());

        log.info("Legal acceptance recorded: userId={} terms={} privacy={} au={} ip={}",
                userId, versions.get("termsVersion"), versions.get("privacyVersion"),
                versions.get("acceptableUseVersion"), ipAddress);
    }
}
