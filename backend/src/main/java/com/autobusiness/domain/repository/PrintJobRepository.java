package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.PrintJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PrintJobRepository extends JpaRepository<PrintJob, UUID> {

    /** Trabajos pendientes recientes — lo viejo no se imprime (ticket rancio). */
    List<PrintJob> findByBusinessIdAndStatusAndCreatedAtAfterOrderByCreatedAtAsc(
            UUID businessId, String status, Instant after);
}
