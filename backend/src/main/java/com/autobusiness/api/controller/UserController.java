package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.SaleRepository;
import com.autobusiness.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepo;
    private final BusinessRepository businessRepo;
    private final SaleRepository saleRepo;
    private final PasswordEncoder encoder;

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p) {
        List<User> users = userRepo.findByBusinessId(p.businessId());
        return ResponseEntity.ok(users.stream().map(u -> Map.of(
                "id",        u.getId(),
                "name",      u.getName(),
                "email",     u.getEmail(),
                "role",      u.getRole(),
                "isActive",  u.isActive(),
                "createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : ""
        )).toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                    @RequestBody Map<String, Object> body) {
        String email = body.get("email").toString().trim().toLowerCase();
        if (userRepo.existsByEmail(email))
            return ResponseEntity.badRequest().body(Map.of("error", "El email ya está registrado"));

        var business = businessRepo.findById(p.businessId())
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        String role = body.getOrDefault("role", "CASHIER").toString().toUpperCase();
        if (!List.of("OWNER", "ADMIN", "CASHIER").contains(role)) role = "CASHIER";

        User user = userRepo.save(User.builder()
                .business(business)
                .name(body.get("name").toString().trim())
                .email(email)
                .passwordHash(encoder.encode(body.get("password").toString()))
                .role(role)
                .build());

        return ResponseEntity.ok(Map.of(
                "id", user.getId(), "name", user.getName(),
                "email", user.getEmail(), "role", user.getRole()
        ));
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> toggleActive(@AuthenticationPrincipal AuthPrincipal p,
                                           @PathVariable UUID id,
                                           @RequestBody Map<String, Object> body) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!user.getBusiness().getId().equals(p.businessId()))
            return ResponseEntity.status(403).body(Map.of("error", "Acceso denegado"));
        if (user.getRole().equals("OWNER"))
            return ResponseEntity.badRequest().body(Map.of("error", "No se puede desactivar al propietario"));
        boolean active = Boolean.parseBoolean(body.getOrDefault("isActive", !user.isActive()).toString());
        user.setActive(active);
        userRepo.save(user);
        return ResponseEntity.ok(Map.of("id", user.getId(), "isActive", user.isActive()));
    }

    /** Estadísticas y rendimiento de ventas de un usuario (cajero). */
    @GetMapping("/{id}/stats")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> stats(@AuthenticationPrincipal AuthPrincipal p,
                                   @PathVariable UUID id) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!user.getBusiness().getId().equals(p.businessId()))
            return ResponseEntity.status(403).body(Map.of("error", "Acceso denegado"));

        Instant now    = Instant.now();
        Instant from30 = now.minus(30, ChronoUnit.DAYS);
        Instant from7  = now.minus(7, ChronoUnit.DAYS);
        Instant from365 = now.minus(365 * 5, ChronoUnit.DAYS); // histórico (5 años)

        return ResponseEntity.ok(Map.of(
                "userId",      user.getId(),
                "name",        user.getName(),
                "role",        user.getRole(),
                "last7",       periodStats(id, from7, now),
                "last30",      periodStats(id, from30, now),
                "allTime",     periodStats(id, from365, now),
                "byPayment",   paymentBreakdown(id, from30, now),
                "topProducts", topProducts(id, from30, now)
        ));
    }

    private Map<String, Object> periodStats(UUID cashierId, Instant from, Instant to) {
        long sales        = saleRepo.countByCashierAndPeriod(cashierId, from, to);
        BigDecimal revenue = saleRepo.sumByCashierAndPeriod(cashierId, from, to);
        BigDecimal cost    = saleRepo.sumCostByCashierAndPeriod(cashierId, from, to);
        if (revenue == null) revenue = BigDecimal.ZERO;
        if (cost == null)    cost = BigDecimal.ZERO;
        BigDecimal profit = revenue.subtract(cost);
        BigDecimal avg = sales > 0
                ? revenue.divide(BigDecimal.valueOf(sales), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return Map.of(
                "sales",     sales,
                "revenue",   revenue,
                "profit",    profit,
                "avgTicket", avg
        );
    }

    private Map<String, Object> paymentBreakdown(UUID cashierId, Instant from, Instant to) {
        BigDecimal cash = BigDecimal.ZERO, card = BigDecimal.ZERO;
        for (Object[] row : saleRepo.sumByPaymentMethodAndCashier(cashierId, from, to)) {
            String method = row[0] == null ? "" : row[0].toString().toLowerCase();
            BigDecimal amt = (BigDecimal) row[1];
            if (amt == null) amt = BigDecimal.ZERO;
            if (method.contains("card") || method.contains("tarjeta")) card = card.add(amt);
            else cash = cash.add(amt);
        }
        return Map.of("cash", cash, "card", card);
    }

    private List<Map<String, Object>> topProducts(UUID cashierId, Instant from, Instant to) {
        List<Map<String, Object>> out = new ArrayList<>();
        List<Object[]> rows = saleRepo.topProductsByCashier(cashierId, from, to);
        for (Object[] row : rows.subList(0, Math.min(5, rows.size()))) {
            out.add(Map.of(
                    "name",    row[0] == null ? "" : row[0].toString(),
                    "qty",     row[1] == null ? BigDecimal.ZERO : row[1],
                    "revenue", row[2] == null ? BigDecimal.ZERO : row[2]
            ));
        }
        return out;
    }
}
