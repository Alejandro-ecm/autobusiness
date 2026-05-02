package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    List<Invoice> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    List<Invoice> findByOrderIdOrderByCreatedAtDesc(UUID orderId);
}
