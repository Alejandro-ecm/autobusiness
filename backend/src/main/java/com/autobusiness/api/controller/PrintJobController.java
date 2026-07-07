package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.PrintJob;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.PrintJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cola de impresión en la nube.
 *
 * Flujo: un dispositivo sin impresora (p. ej. iPhone) crea trabajos con
 * POST /print-jobs; un dispositivo con impresora los recoge y los marca
 * impresos. Hay dos tipos de dispositivo de impresión:
 *  - Estación de impresión (página /impresora, con sesión) → rutas /print-jobs/**
 *  - PC Print Bridge (sin JWT, autenticado por print_key secreta) → /print-queue/**
 */
@RestController
@RequiredArgsConstructor
public class PrintJobController {

    /** Solo se imprimen trabajos de los últimos N minutos. */
    private static final int FRESH_MINUTES = 10;
    /** Un dispositivo de impresión se considera activo si polleó hace < N segundos. */
    private static final int BRIDGE_ACTIVE_SECONDS = 90;

    private final PrintJobRepository jobRepo;
    private final BusinessRepository businessRepo;

    // ── Rutas con sesión (cajeros y estación de impresión) ──────────

    /** Encola un ticket. Devuelve willPrint=true si hay un dispositivo de impresión activo. */
    @PostMapping("/print-jobs")
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                    @RequestBody String payload) {
        Business biz = businessRepo.findById(p.businessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        boolean willPrint = biz.getPrintBridgeSeenAt() != null &&
                biz.getPrintBridgeSeenAt().isAfter(Instant.now().minusSeconds(BRIDGE_ACTIVE_SECONDS));
        PrintJob job = jobRepo.save(PrintJob.builder()
                .business(biz)
                .payload(payload)
                .build());
        return ResponseEntity.ok(Map.of("id", job.getId(), "willPrint", willPrint));
    }

    /** Estación de impresión: trabajos pendientes. El poll cuenta como "dispositivo activo". */
    @GetMapping("/print-jobs/pending")
    public ResponseEntity<?> pending(@AuthenticationPrincipal AuthPrincipal p) {
        markSeen(p.businessId());
        return ResponseEntity.ok(pendingJobs(p.businessId()));
    }

    @PatchMapping("/print-jobs/{id}/done")
    public ResponseEntity<?> done(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        jobRepo.findById(id).ifPresent(job -> {
            if (job.getBusiness().getId().equals(p.businessId())) markDone(job);
        });
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Llave secreta para configurar el PC Print Bridge (se genera la primera vez). */
    @GetMapping("/print-jobs/bridge-key")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> bridgeKey(@AuthenticationPrincipal AuthPrincipal p) {
        Business biz = businessRepo.findById(p.businessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        if (biz.getPrintKey() == null) {
            biz.setPrintKey(UUID.randomUUID());
            businessRepo.save(biz);
        }
        return ResponseEntity.ok(Map.of("printKey", biz.getPrintKey()));
    }

    // ── Rutas del PC Print Bridge (sin JWT, print_key secreta) ──────

    @GetMapping("/print-queue/{printKey}")
    public ResponseEntity<?> queueForBridge(@PathVariable UUID printKey) {
        Business biz = businessRepo.findByPrintKey(printKey)
                .orElseThrow(() -> new IllegalArgumentException("Llave de impresión inválida"));
        markSeen(biz.getId());
        return ResponseEntity.ok(pendingJobs(biz.getId()));
    }

    @PostMapping("/print-queue/{printKey}/{jobId}/done")
    public ResponseEntity<?> bridgeDone(@PathVariable UUID printKey, @PathVariable UUID jobId) {
        Business biz = businessRepo.findByPrintKey(printKey)
                .orElseThrow(() -> new IllegalArgumentException("Llave de impresión inválida"));
        jobRepo.findById(jobId).ifPresent(job -> {
            if (job.getBusiness().getId().equals(biz.getId())) markDone(job);
        });
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private List<Map<String, Object>> pendingJobs(UUID businessId) {
        Instant fresh = Instant.now().minus(FRESH_MINUTES, ChronoUnit.MINUTES);
        return jobRepo.findByBusinessIdAndStatusAndCreatedAtAfterOrderByCreatedAtAsc(businessId, "PENDING", fresh)
                .stream()
                .map(j -> Map.<String, Object>of("id", j.getId(), "payload", j.getPayload()))
                .toList();
    }

    private void markSeen(UUID businessId) {
        businessRepo.findById(businessId).ifPresent(biz -> {
            biz.setPrintBridgeSeenAt(Instant.now());
            businessRepo.save(biz);
        });
    }

    private void markDone(PrintJob job) {
        job.setStatus("DONE");
        job.setPrintedAt(Instant.now());
        jobRepo.save(job);
    }
}
