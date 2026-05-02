package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Invoice;
import com.autobusiness.domain.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    /** GET /api/invoices — lista de facturas del negocio */
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(
                invoiceService.getInvoices(p.businessId()).stream()
                        .map(invoiceService::toMap).toList()
        );
    }

    /**
     * POST /api/invoices — solicitar factura
     * Body: { rfc, razonSocial, usoCfdi?, regimenFiscal?, cpReceptor?, email?,
     *         total, orderId?, saleId?, paymentId? }
     */
    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                     @RequestBody Map<String, Object> body) {
        try {
            Invoice inv = invoiceService.createInvoice(p.businessId(), body);
            return ResponseEntity.ok(invoiceService.toMap(inv));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** GET /api/invoices/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@AuthenticationPrincipal AuthPrincipal p,
                                  @PathVariable UUID id) {
        return ResponseEntity.ok(invoiceService.getInvoices(p.businessId())
                .stream()
                .filter(inv -> inv.getId().equals(id))
                .findFirst()
                .map(invoiceService::toMap)
                .orElseThrow(() -> new IllegalArgumentException("Factura no encontrada")));
    }
}
