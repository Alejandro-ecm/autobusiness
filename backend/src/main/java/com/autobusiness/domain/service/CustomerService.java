package com.autobusiness.domain.service;

import com.autobusiness.domain.model.*;
import com.autobusiness.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepo;
    private final CustomerTransactionRepository txRepo;
    private final BusinessRepository businessRepo;

    public List<Customer> getCustomers(UUID businessId, String query) {
        if (query != null && !query.isBlank())
            return customerRepo.search(businessId, query.trim());
        return customerRepo.findByBusinessIdAndIsActiveTrueOrderByName(businessId);
    }

    @Transactional
    public Customer createCustomer(UUID businessId, Map<String, Object> body) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        String name = body.get("name") != null ? body.get("name").toString().trim() : null;
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Nombre requerido");
        return customerRepo.save(Customer.builder()
                .business(business)
                .name(name)
                .phone(str(body, "phone"))
                .email(str(body, "email"))
                .address(str(body, "address"))
                .notes(str(body, "notes"))
                .build());
    }

    @Transactional
    public Customer updateCustomer(UUID businessId, UUID customerId, Map<String, Object> body) {
        Customer c = get(businessId, customerId);
        if (body.containsKey("name"))    c.setName(body.get("name").toString().trim());
        if (body.containsKey("phone"))   c.setPhone(str(body, "phone"));
        if (body.containsKey("email"))   c.setEmail(str(body, "email"));
        if (body.containsKey("address")) c.setAddress(str(body, "address"));
        if (body.containsKey("notes"))   c.setNotes(str(body, "notes"));
        return customerRepo.save(c);
    }

    @Transactional
    public void deleteCustomer(UUID businessId, UUID customerId) {
        Customer c = get(businessId, customerId);
        c.setActive(false);
        customerRepo.save(c);
    }

    // ── Fiado: apuntar compra a crédito ──────────────────────────────────────
    @Transactional
    public CustomerTransaction addFiado(UUID businessId, UUID customerId,
                                        BigDecimal amount, String description, UUID saleId) {
        Customer c = get(businessId, customerId);
        c.setTotalCredit(c.getTotalCredit().add(amount));
        customerRepo.save(c);
        return txRepo.save(CustomerTransaction.builder()
                .business(c.getBusiness())
                .customer(c)
                .type("PURCHASE")
                .amount(amount)
                .description(description != null ? description : "Compra a crédito")
                .saleId(saleId)
                .build());
    }

    // ── Abono: registrar pago de deuda ────────────────────────────────────────
    @Transactional
    public CustomerTransaction addPayment(UUID businessId, UUID customerId,
                                          BigDecimal amount, String description) {
        Customer c = get(businessId, customerId);
        BigDecimal newBalance = c.getTotalCredit().subtract(amount);
        c.setTotalCredit(newBalance.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : newBalance);
        customerRepo.save(c);
        return txRepo.save(CustomerTransaction.builder()
                .business(c.getBusiness())
                .customer(c)
                .type("PAYMENT")
                .amount(amount)
                .description(description != null ? description : "Abono")
                .build());
    }

    public List<CustomerTransaction> getTransactions(UUID businessId, UUID customerId) {
        get(businessId, customerId); // validates ownership
        return txRepo.findByCustomerIdOrderByCreatedAtDesc(customerId);
    }

    private Customer get(UUID businessId, UUID customerId) {
        Customer c = customerRepo.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado"));
        if (!c.getBusiness().getId().equals(businessId)) throw new SecurityException("Acceso denegado");
        return c;
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return (v != null && !v.toString().isBlank()) ? v.toString().trim() : null;
    }
}
