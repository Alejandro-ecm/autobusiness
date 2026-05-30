package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Subscription;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.ProductRepository;
import com.autobusiness.domain.repository.SubscriptionRepository;
import com.autobusiness.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepo;
    private final BusinessRepository businessRepo;
    private final ProductRepository productRepo;
    private final UserRepository userRepo;

    // ── Límites por plan ────────────────────────────────────────────────────
    private static final Map<String, Map<String, Object>> PLAN_LIMITS = Map.of(
        "FREE",    Map.of("maxProducts", 20,  "maxUsers", 2,  "onlineStore", false, "reports", false, "price", 0),
        "BASIC",   Map.of("maxProducts", 100, "maxUsers", 5,  "onlineStore", true,  "reports", true,  "price", 60),
        "PRO",     Map.of("maxProducts", -1,  "maxUsers", 15, "onlineStore", true,  "reports", true,  "ai", true, "price", 120),
        "PREMIUM", Map.of("maxProducts", -1,  "maxUsers", -1, "onlineStore", true,  "reports", true,  "ai", true, "cfdi", true, "price", 190)
    );

    @Transactional
    public Subscription createTrialSubscription(Business business) {
        return subscriptionRepo.findByBusinessId(business.getId()).orElseGet(() -> {
            Instant now = Instant.now();
            return subscriptionRepo.save(Subscription.builder()
                    .business(business)
                    .plan("FREE")
                    .status("TRIAL")
                    .trialEndsAt(now.plus(14, ChronoUnit.DAYS))
                    .currentPeriodStart(now)
                    .currentPeriodEnd(now.plus(30, ChronoUnit.DAYS))
                    .build());
        });
    }

    public Subscription getOrCreate(UUID businessId) {
        return subscriptionRepo.findByBusinessId(businessId).orElseGet(() -> {
            Business biz = businessRepo.findById(businessId)
                    .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
            return createTrialSubscription(biz);
        });
    }

    public Map<String, Object> getStatus(UUID businessId) {
        Subscription sub = getOrCreate(businessId);
        Map<String, Object> limits = PLAN_LIMITS.getOrDefault(sub.getPlan(), PLAN_LIMITS.get("FREE"));

        long productCount = productRepo.countByBusinessId(businessId);
        long userCount    = userRepo.findByBusinessId(businessId).size();

        var m = new HashMap<String, Object>();
        m.put("plan",     sub.getPlan());
        m.put("status",   sub.getStatus());
        m.put("isActive", sub.isActive());
        m.put("trialEndsAt",        sub.getTrialEndsAt());
        m.put("currentPeriodEnd",   sub.getCurrentPeriodEnd());
        m.put("limits",   limits);
        m.put("usage",    Map.of(
                "products", productCount,
                "users",    userCount
        ));
        m.put("daysLeft", sub.isActive()
                ? ChronoUnit.DAYS.between(Instant.now(),
                  "TRIAL".equals(sub.getStatus()) ? sub.getTrialEndsAt() : sub.getCurrentPeriodEnd())
                : 0);
        return m;
    }

    @Transactional
    public Subscription upgradePlan(UUID businessId, String plan, String mpPreapprovalId) {
        if (!PLAN_LIMITS.containsKey(plan.toUpperCase()))
            throw new IllegalArgumentException("Plan inválido: " + plan);

        Subscription sub = getOrCreate(businessId);
        Instant now = Instant.now();
        sub.setPlan(plan.toUpperCase());
        sub.setStatus("ACTIVE");
        sub.setMpPreapprovalId(mpPreapprovalId);
        sub.setCurrentPeriodStart(now);
        sub.setCurrentPeriodEnd(now.plus(30, ChronoUnit.DAYS));
        sub.setCanceledAt(null);
        sub.setCancelReason(null);
        log.info("Business {} upgraded to plan {}", businessId, plan);
        return subscriptionRepo.save(sub);
    }

    @Transactional
    public Subscription cancelSubscription(UUID businessId, String reason) {
        Subscription sub = getOrCreate(businessId);
        sub.setStatus("CANCELED");
        sub.setCanceledAt(Instant.now());
        sub.setCancelReason(reason);
        return subscriptionRepo.save(sub);
    }

    public void assertCanAddProduct(UUID businessId) {
        Subscription sub = getOrCreate(businessId);
        if (!sub.isActive()) throw new IllegalStateException("Suscripción vencida. Renueva tu plan para agregar productos.");
        int maxProducts = (int) PLAN_LIMITS.getOrDefault(sub.getPlan(), PLAN_LIMITS.get("FREE")).get("maxProducts");
        if (maxProducts < 0) return;
        long count = productRepo.countByBusinessId(businessId);
        if (count >= maxProducts) throw new IllegalStateException(
                "Límite de productos alcanzado (" + maxProducts + "). Actualiza tu plan.");
    }

    public void assertCanAddUser(UUID businessId) {
        Subscription sub = getOrCreate(businessId);
        int maxUsers = (int) PLAN_LIMITS.getOrDefault(sub.getPlan(), PLAN_LIMITS.get("FREE")).get("maxUsers");
        if (maxUsers < 0) return;
        long count = userRepo.findByBusinessId(businessId).size();
        if (count >= maxUsers) throw new IllegalStateException(
                "Límite de usuarios alcanzado (" + maxUsers + "). Actualiza tu plan.");
    }

    public boolean canUseOnlineStore(UUID businessId) {
        Subscription sub = getOrCreate(businessId);
        if (!sub.isActive()) return false;
        return (boolean) PLAN_LIMITS.getOrDefault(sub.getPlan(), PLAN_LIMITS.get("FREE"))
                .getOrDefault("onlineStore", false);
    }

    public static Map<String, Map<String, Object>> getAllPlans() {
        return PLAN_LIMITS;
    }

    // ── Job nocturno para expirar trials y suscripciones ─────────────────
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void expireSubscriptions() {
        Instant now = Instant.now();
        List<Subscription> expiredTrials = subscriptionRepo.findExpiredTrials(now);
        expiredTrials.forEach(s -> { s.setStatus("PAST_DUE"); subscriptionRepo.save(s); });

        List<Subscription> expiredActive = subscriptionRepo.findExpiredActive(now);
        expiredActive.forEach(s -> { s.setStatus("PAST_DUE"); subscriptionRepo.save(s); });

        log.info("Subscription expiry job: {} trials, {} active expired",
                 expiredTrials.size(), expiredActive.size());
    }
}
