package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Invoice;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvoiceService {

    private final InvoiceRepository invoiceRepo;
    private final BusinessRepository businessRepo;

    private static final BigDecimal IVA_RATE = new BigDecimal("0.16");

    @Transactional
    public Invoice createInvoice(UUID businessId, Map<String, Object> body) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        String rfc         = require(body, "rfc").toUpperCase().replaceAll("\\s", "");
        String razonSocial = require(body, "razonSocial");
        String usoCfdi     = body.getOrDefault("usoCfdi", "G03").toString();
        String email       = body.getOrDefault("email", "").toString();
        String regimen     = body.getOrDefault("regimenFiscal", "").toString();
        String cp          = body.getOrDefault("cpReceptor", "").toString();

        BigDecimal total    = new BigDecimal(require(body, "total"));
        // Calcular subtotal e IVA desde el total (IVA incluido)
        BigDecimal subtotal = total.divide(BigDecimal.ONE.add(IVA_RATE), 2, RoundingMode.HALF_UP);
        BigDecimal iva      = total.subtract(subtotal);

        UUID orderId    = body.containsKey("orderId")   ? UUID.fromString(body.get("orderId").toString()) : null;
        UUID saleId     = body.containsKey("saleId")    ? UUID.fromString(body.get("saleId").toString())  : null;
        UUID paymentId  = body.containsKey("paymentId") ? UUID.fromString(body.get("paymentId").toString()): null;

        Invoice invoice = invoiceRepo.save(Invoice.builder()
                .business(business)
                .orderId(orderId)
                .saleId(saleId)
                .paymentId(paymentId)
                .rfc(rfc)
                .razonSocial(razonSocial)
                .usoCfdi(usoCfdi)
                .regimenFiscal(regimen.isBlank() ? null : regimen)
                .cpReceptor(cp.isBlank() ? null : cp)
                .email(email.isBlank() ? null : email)
                .subtotal(subtotal)
                .iva(iva)
                .total(total)
                .status("PENDING")
                .build());

        log.info("Invoice {} created for business {} RFC={}", invoice.getId(), businessId, rfc);
        return invoice;
    }

    public List<Invoice> getInvoices(UUID businessId) {
        return invoiceRepo.findByBusinessIdOrderByCreatedAtDesc(businessId);
    }

    public Map<String, Object> toMap(Invoice inv) {
        var m = new java.util.HashMap<String, Object>();
        m.put("id",            inv.getId());
        m.put("rfc",           inv.getRfc());
        m.put("razonSocial",   inv.getRazonSocial());
        m.put("usoCfdi",       inv.getUsoCfdi());
        m.put("email",         inv.getEmail());
        m.put("subtotal",      inv.getSubtotal());
        m.put("iva",           inv.getIva());
        m.put("total",         inv.getTotal());
        m.put("status",        inv.getStatus());
        m.put("folioFiscal",   inv.getFolioFiscal());
        m.put("orderId",       inv.getOrderId());
        m.put("saleId",        inv.getSaleId());
        m.put("createdAt",     inv.getCreatedAt());
        return m;
    }

    private String require(Map<String, Object> body, String key) {
        Object val = body.get(key);
        if (val == null || val.toString().isBlank())
            throw new IllegalArgumentException("Campo requerido: " + key);
        return val.toString().trim();
    }
}
