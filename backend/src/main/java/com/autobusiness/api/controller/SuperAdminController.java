package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Subscription;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.SaleRepository;
import com.autobusiness.domain.repository.SubscriptionRepository;
import com.autobusiness.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/super-admin")
@RequiredArgsConstructor
@Slf4j
public class SuperAdminController {

    private final BusinessRepository businessRepo;
    private final UserRepository userRepo;
    private final SubscriptionRepository subscriptionRepo;
    private final SaleRepository saleRepo;

    /** Verifica que quien llama es SUPER_ADMIN */
    private void requireSuperAdmin(AuthPrincipal p) {
        if (!"SUPER_ADMIN".equals(p.role()))
            throw new org.springframework.security.access.AccessDeniedException("Solo super administradores");
    }

    /** GET /api/super-admin/businesses — todos los negocios */
    @GetMapping("/businesses")
    public ResponseEntity<?> businesses(@AuthenticationPrincipal AuthPrincipal p) {
        requireSuperAdmin(p);
        List<Business> all = businessRepo.findAll();
        List<Map<String, Object>> result = all.stream().map(biz -> {
            long userCount = userRepo.findByBusinessId(biz.getId()).size();
            Optional<Subscription> sub = subscriptionRepo.findByBusinessId(biz.getId());

            var m = new HashMap<String, Object>();
            m.put("id",          biz.getId());
            m.put("name",        biz.getName());
            m.put("slug",        biz.getSlug());
            m.put("isActive",    biz.isActive());
            m.put("isSuspended", biz.isSuspended());
            m.put("plan",        biz.getPlan());
            m.put("userCount",   userCount);
            m.put("createdAt",   biz.getCreatedAt());
            m.put("subscription", sub.map(s -> Map.of(
                    "plan",   s.getPlan(),
                    "status", s.getStatus(),
                    "periodEnd", s.getCurrentPeriodEnd()
            )).orElse(null));
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /** GET /api/super-admin/metrics — métricas globales del SaaS */
    @GetMapping("/metrics")
    public ResponseEntity<?> metrics(@AuthenticationPrincipal AuthPrincipal p) {
        requireSuperAdmin(p);
        Instant now     = Instant.now();
        Instant from30d = now.minus(30, ChronoUnit.DAYS);

        long totalBusinesses  = businessRepo.count();
        long activeBusinesses = businessRepo.findAll().stream()
                .filter(b -> b.isActive() && !b.isSuspended()).count();
        long totalUsers       = userRepo.count();

        long trialCount   = subscriptionRepo.countByStatus("TRIAL");
        long activeCount  = subscriptionRepo.countByStatus("ACTIVE");
        long basicCount   = subscriptionRepo.countActivePlan("BASIC");
        long proCount     = subscriptionRepo.countActivePlan("PRO");
        long premiumCount = subscriptionRepo.countActivePlan("PREMIUM");

        return ResponseEntity.ok(Map.of(
                "businesses",  Map.of("total", totalBusinesses, "active", activeBusinesses),
                "users",       totalUsers,
                "subscriptions", Map.of(
                        "trial",   trialCount,
                        "active",  activeCount,
                        "basic",   basicCount,
                        "pro",     proCount,
                        "premium", premiumCount,
                        "mrr",     basicCount * 299 + proCount * 599 + premiumCount * 999
                )
        ));
    }

    /** PATCH /api/super-admin/businesses/{id}/suspend */
    @PatchMapping("/businesses/{id}/suspend")
    public ResponseEntity<?> suspend(@AuthenticationPrincipal AuthPrincipal p,
                                      @PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, String> body) {
        requireSuperAdmin(p);
        Business biz = businessRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        biz.setSuspended(true);
        biz.setSuspendedAt(Instant.now());
        businessRepo.save(biz);
        log.info("SuperAdmin suspended business {}", id);
        return ResponseEntity.ok(Map.of("suspended", true));
    }

    /** PATCH /api/super-admin/businesses/{id}/activate */
    @PatchMapping("/businesses/{id}/activate")
    public ResponseEntity<?> activate(@AuthenticationPrincipal AuthPrincipal p,
                                       @PathVariable UUID id) {
        requireSuperAdmin(p);
        Business biz = businessRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        biz.setSuspended(false);
        biz.setSuspendedAt(null);
        biz.setActive(true);
        businessRepo.save(biz);
        log.info("SuperAdmin activated business {}", id);
        return ResponseEntity.ok(Map.of("activated", true));
    }

    /** PATCH /api/super-admin/businesses/{id}/plan — cambiar plan manualmente */
    @PatchMapping("/businesses/{id}/plan")
    public ResponseEntity<?> setPlan(@AuthenticationPrincipal AuthPrincipal p,
                                      @PathVariable UUID id,
                                      @RequestBody Map<String, String> body) {
        requireSuperAdmin(p);
        String plan = body.getOrDefault("plan", "FREE").toUpperCase();
        Subscription sub = subscriptionRepo.findByBusinessId(id)
                .orElseThrow(() -> new IllegalArgumentException("Sin suscripción"));
        sub.setPlan(plan);
        sub.setStatus("ACTIVE");
        sub.setCurrentPeriodEnd(Instant.now().plus(30, ChronoUnit.DAYS));
        subscriptionRepo.save(sub);
        return ResponseEntity.ok(Map.of("plan", plan, "status", "ACTIVE"));
    }
}
