package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Sale;
import com.autobusiness.domain.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final SaleRepository saleRepo;

    @GetMapping("/sales")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> salesReport(@AuthenticationPrincipal AuthPrincipal p,
                                          @RequestParam(defaultValue = "0") long from,
                                          @RequestParam(defaultValue = "0") long to) {
        Instant now = Instant.now();
        Instant f   = from > 0 ? Instant.ofEpochMilli(from) : now.minusSeconds(30L * 86400);
        Instant t   = to   > 0 ? Instant.ofEpochMilli(to)   : now;

        List<Sale> sales = saleRepo.findByBusinessAndPeriod(p.businessId(), f, t);
        var result = sales.stream().map(s -> {
            var m = new java.util.HashMap<String, Object>();
            m.put("id",            s.getId());
            m.put("date",          s.getCreatedAt().toString());
            m.put("paymentMethod", s.getPaymentMethod());
            m.put("total",         s.getTotal());
            m.put("cashier",       s.getCashier() != null ? s.getCashier().getName() : "—");
            m.put("items", s.getItems().stream().map(i -> {
                var im = new java.util.HashMap<String, Object>();
                im.put("name",     i.getProduct().getName());
                im.put("qty",      i.getQuantity());
                im.put("price",    i.getUnitPrice());
                im.put("cost",     i.getUnitCost());
                im.put("subtotal", i.getSubtotal());
                return im;
            }).toList());
            return m;
        }).toList();

        return ResponseEntity.ok(Map.of("sales", result, "count", result.size()));
    }

    @GetMapping("/inventory/movements")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> inventoryMovements(@AuthenticationPrincipal AuthPrincipal p) {
        // Handled in InventoryController, exposed here for reports too
        return ResponseEntity.ok(Map.of("businessId", p.businessId()));
    }
}
