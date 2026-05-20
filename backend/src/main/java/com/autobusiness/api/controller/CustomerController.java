package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p,
                                   @RequestParam(required = false) String q) {
        return ResponseEntity.ok(customerService.getCustomers(p.businessId(), q));
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                    @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(customerService.createCustomer(p.businessId(), body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal AuthPrincipal p,
                                    @PathVariable UUID id,
                                    @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(customerService.updateCustomer(p.businessId(), id, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        customerService.deleteCustomer(p.businessId(), id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/{id}/transactions")
    public ResponseEntity<?> transactions(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        return ResponseEntity.ok(customerService.getTransactions(p.businessId(), id));
    }

    @PostMapping("/{id}/fiado")
    public ResponseEntity<?> addFiado(@AuthenticationPrincipal AuthPrincipal p,
                                       @PathVariable UUID id,
                                       @RequestBody Map<String, Object> body) {
        if (body.get("amount") == null) {
            throw new IllegalArgumentException("El campo amount es requerido");
        }
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
        String desc = body.get("description") != null ? body.get("description").toString() : null;
        UUID saleId = body.get("saleId") != null ? UUID.fromString(body.get("saleId").toString()) : null;
        return ResponseEntity.ok(customerService.addFiado(p.businessId(), id, amount, desc, saleId));
    }

    @PostMapping("/{id}/payment")
    public ResponseEntity<?> addPayment(@AuthenticationPrincipal AuthPrincipal p,
                                         @PathVariable UUID id,
                                         @RequestBody Map<String, Object> body) {
        if (body.get("amount") == null) {
            throw new IllegalArgumentException("El campo amount es requerido");
        }
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto debe ser mayor a cero");
        }
        String desc = body.get("description") != null ? body.get("description").toString() : null;
        return ResponseEntity.ok(customerService.addPayment(p.businessId(), id, amount, desc));
    }
}
