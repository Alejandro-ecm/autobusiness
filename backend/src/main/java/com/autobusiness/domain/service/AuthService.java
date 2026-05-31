package com.autobusiness.domain.service;

import com.autobusiness.config.JwtUtil;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Branch;
import com.autobusiness.domain.model.PendingRegistration;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.BranchRepository;
import com.autobusiness.domain.repository.PendingRegistrationRepository;
import com.autobusiness.domain.repository.UserRepository;
import com.autobusiness.infrastructure.analytics.AlejandriaClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepo;
    private final BusinessRepository businessRepo;
    private final BranchRepository branchRepo;
    private final SubscriptionService subscriptionService;
    private final PendingRegistrationRepository pendingRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;
    private final AlejandriaClient alejandria;

    public Map<String, Object> login(String email, String password) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Credenciales inválidas"));

        if (!encoder.matches(password, user.getPasswordHash()))
            throw new IllegalArgumentException("Credenciales inválidas");
        if (!user.isActive())
            throw new IllegalArgumentException("Usuario inactivo");
        if (!user.isSuperAdmin() && user.getBusiness().isSuspended())
            throw new IllegalArgumentException("Negocio suspendido. Contacta soporte.");

        user.setLastLogin(Instant.now());
        userRepo.save(user);

        String token = jwtUtil.generate(user.getId(), user.getEmail(),
                user.getRole(), user.getBusiness().getId(), user.isSuperAdmin());

        UUID branchId = user.getBranch() != null ? user.getBranch().getId()
                : branchRepo.findFirstByBusinessIdAndIsMainTrue(user.getBusiness().getId())
                            .map(Branch::getId).orElse(null);

        var sub = subscriptionService.getStatus(user.getBusiness().getId());

        var userMap = new HashMap<String, Object>();
        userMap.put("id",           user.getId());
        userMap.put("name",         user.getName());
        userMap.put("email",        user.getEmail());
        userMap.put("role",         user.getRole());
        userMap.put("isSuperAdmin", user.isSuperAdmin());
        userMap.put("businessId",   user.getBusiness().getId());
        userMap.put("businessName", user.getBusiness().getName());
        userMap.put("businessSlug", user.getBusiness().getSlug());
        userMap.put("subscription", Map.of(
                "plan",     sub.get("plan"),
                "status",   sub.get("status"),
                "isActive", sub.get("isActive"),
                "daysLeft", sub.get("daysLeft")
        ));
        if (branchId != null) userMap.put("branchId", branchId);
        userMap.put("profileType",         user.getBusiness().getProfileType());
        userMap.put("onboardingCompleted", user.getBusiness().isOnboardingCompleted());

        log.info("Login: {} role={}", email, user.getRole());
        return Map.of("token", token, "user", userMap);
    }

    @Transactional
    public Map<String, Object> register(String businessName, String ownerName,
                                         String email, String password) {
        if (userRepo.existsByEmail(email))
            throw new IllegalArgumentException("El email ya está registrado");
        if (businessName == null || businessName.isBlank())
            throw new IllegalArgumentException("El nombre del negocio es requerido");
        if (password == null || password.length() < 6)
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");

        String slug = generateSlug(businessName);

        Business business = businessRepo.save(Business.builder()
                .name(businessName.trim())
                .slug(slug)
                .deliveryCode(generateDeliveryCode())
                .build());

        Branch mainBranch = branchRepo.save(Branch.builder()
                .business(business)
                .name("Sucursal Principal")
                .isMain(true)
                .build());

        User owner = userRepo.save(User.builder()
                .business(business)
                .branch(mainBranch)
                .email(email.trim().toLowerCase())
                .passwordHash(encoder.encode(password))
                .name(ownerName.trim())
                .role("OWNER")
                .build());

        // Crear suscripción trial de 14 días automáticamente
        subscriptionService.createTrialSubscription(business);

        long totalUsuarios = userRepo.count();
        alejandria.trackMetric("total_usuarios", totalUsuarios, "count");

        String token = jwtUtil.generate(owner.getId(), owner.getEmail(),
                owner.getRole(), business.getId(), false);

        log.info("Registered: business='{}' slug='{}' owner={}", businessName, slug, email);

        var userMap2 = new HashMap<String, Object>();
        userMap2.put("id",                 owner.getId());
        userMap2.put("name",               owner.getName());
        userMap2.put("email",              owner.getEmail());
        userMap2.put("role",               owner.getRole());
        userMap2.put("isSuperAdmin",       false);
        userMap2.put("businessId",         business.getId());
        userMap2.put("businessName",       business.getName());
        userMap2.put("businessSlug",       business.getSlug());
        userMap2.put("branchId",           mainBranch.getId());
        userMap2.put("profileType",        null);
        userMap2.put("onboardingCompleted",false);
        userMap2.put("subscription",       Map.of("plan", "FREE", "status", "TRIAL",
                                                   "isActive", true, "daysLeft", 14));
        return Map.of("token", token, "user", userMap2);
    }

    @Transactional
    public Map<String, Object> deleteAccount(UUID userId, UUID businessId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!"OWNER".equals(user.getRole()))
            throw new IllegalStateException("Solo el dueño puede eliminar la cuenta");
        if (!user.getBusiness().getId().equals(businessId))
            throw new IllegalStateException("No tienes permiso para eliminar este negocio");

        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        String tombstone = UUID.randomUUID().toString();
        // Anonymize all users in the business
        userRepo.findByBusinessId(businessId).forEach(u -> {
            u.setEmail("deleted-" + u.getId() + "@deleted.autobusiness");
            u.setName("[Cuenta Eliminada]");
            u.setPasswordHash(tombstone);
            u.setActive(false);
            userRepo.save(u);
        });

        // Mark business as deleted
        business.setActive(false);
        business.setSuspended(true);
        business.setName("[Eliminado] " + business.getName());
        businessRepo.save(business);

        log.info("Account deleted: business={}", businessId);
        return Map.of("message", "Cuenta eliminada correctamente");
    }

    @Transactional
    public Map<String, Object> completeOnboarding(UUID businessId, String profileType) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        business.setProfileType(profileType);
        business.setOnboardingCompleted(true);
        businessRepo.save(business);
        log.info("onboarding.completed business={} profileType={}", businessId, profileType);
        return Map.of("onboardingCompleted", true, "profileType", profileType);
    }

    private String generateDeliveryCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        java.security.SecureRandom rng = new java.security.SecureRandom();
        String code;
        do {
            StringBuilder sb = new StringBuilder(10);
            for (int i = 0; i < 10; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
            code = sb.toString();
        } while (businessRepo.existsByDeliveryCode(code));
        return code;
    }

    // ── Pre-checkout: valida datos y crea registro pendiente (sin cuenta en DB aún) ──
    @Transactional
    public Map<String, Object> preCheckout(String businessName, String ownerName,
                                            String email, String password, String plan) {
        if (userRepo.existsByEmail(email))
            throw new IllegalArgumentException("El email ya está registrado");
        if (pendingRepo.existsByEmail(email))
            throw new IllegalArgumentException("Ya hay un registro pendiente para este email");
        if (businessName == null || businessName.isBlank())
            throw new IllegalArgumentException("El nombre del negocio es requerido");
        if (password == null || password.length() < 6)
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");

        String externalRef = UUID.randomUUID().toString();
        PendingRegistration pending = pendingRepo.save(PendingRegistration.builder()
                .businessName(businessName.trim())
                .ownerName(ownerName.trim())
                .email(email.trim().toLowerCase())
                .passwordHash(encoder.encode(password))
                .plan(plan != null ? plan.toUpperCase() : "PRO")
                .mpExternalRef(externalRef)
                .paid(false)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(24, ChronoUnit.HOURS))
                .build());

        log.info("PreCheckout: email={} plan={} ref={}", email, plan, externalRef);
        return Map.of("ref", externalRef, "pendingId", pending.getId().toString());
    }

    // ── Activar registro después de pago confirmado ──────────────────────────
    @Transactional
    public Map<String, Object> activateRegistration(String externalRef) {
        PendingRegistration pending = pendingRepo.findByMpExternalRef(externalRef)
                .orElseThrow(() -> new IllegalArgumentException("Registro no encontrado"));

        if (pending.isExpired())
            throw new IllegalStateException("El enlace de registro expiró. Vuelve a registrarte.");

        // Idempotente: si ya se creó la cuenta, solo devolver token
        var existingUser = userRepo.findByEmail(pending.getEmail());
        if (existingUser.isPresent()) {
            return buildTokenResponse(existingUser.get());
        }

        if (!pending.isPaid())
            throw new IllegalStateException("El pago aún no ha sido confirmado");

        return createAccountFromPending(pending);
    }

    // ── Guarda el preferenceId en el registro pendiente ──────────────────────
    @Transactional
    public void updatePendingPreference(String externalRef, String preferenceId) {
        pendingRepo.findByMpExternalRef(externalRef).ifPresent(p -> {
            p.setMpPreferenceId(preferenceId);
            pendingRepo.save(p);
        });
    }

    private Map<String, Object> createAccountFromPending(PendingRegistration pending) {
        String slug = generateSlug(pending.getBusinessName());

        Business business = businessRepo.save(Business.builder()
                .name(pending.getBusinessName())
                .slug(slug)
                .deliveryCode(generateDeliveryCode())
                .build());

        Branch mainBranch = branchRepo.save(Branch.builder()
                .business(business).name("Sucursal Principal").isMain(true).build());

        User owner = userRepo.save(User.builder()
                .business(business).branch(mainBranch)
                .email(pending.getEmail())
                .passwordHash(pending.getPasswordHash())
                .name(pending.getOwnerName())
                .role("OWNER").build());

        // Activar suscripción de pago directamente (no trial)
        subscriptionService.upgradePlan(business.getId(), pending.getPlan(), "checkout_" + pending.getMpExternalRef());

        pendingRepo.delete(pending);
        alejandria.trackMetric("total_usuarios", userRepo.count(), "count");
        log.info("Account created: business='{}' email={} plan={}", pending.getBusinessName(), pending.getEmail(), pending.getPlan());
        return buildTokenResponse(owner);
    }

    private Map<String, Object> buildTokenResponse(User owner) {
        String token = jwtUtil.generate(owner.getId(), owner.getEmail(),
                owner.getRole(), owner.getBusiness().getId(), false);
        UUID branchId = owner.getBranch() != null ? owner.getBranch().getId()
                : branchRepo.findFirstByBusinessIdAndIsMainTrue(owner.getBusiness().getId())
                             .map(Branch::getId).orElse(null);
        var sub = subscriptionService.getStatus(owner.getBusiness().getId());
        var map = new HashMap<String, Object>();
        map.put("id",           owner.getId());
        map.put("name",         owner.getName());
        map.put("email",        owner.getEmail());
        map.put("role",         owner.getRole());
        map.put("isSuperAdmin", false);
        map.put("businessId",   owner.getBusiness().getId());
        map.put("businessName", owner.getBusiness().getName());
        map.put("businessSlug", owner.getBusiness().getSlug());
        map.put("branchId",     branchId);
        map.put("profileType",  null);
        map.put("onboardingCompleted", false);
        map.put("subscription", Map.of("plan", sub.get("plan"), "status", sub.get("status"),
                                       "isActive", sub.get("isActive"), "daysLeft", sub.get("daysLeft")));
        return Map.of("token", token, "user", map);
    }

    private String generateSlug(String name) {
        String base = name.toLowerCase()
                .replaceAll("[áàäâã]", "a").replaceAll("[éèëê]", "e")
                .replaceAll("[íìïî]", "i").replaceAll("[óòöôõ]", "o")
                .replaceAll("[úùüû]", "u").replaceAll("ñ", "n")
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
        if (base.isBlank()) base = "negocio";
        String slug = base;
        int i = 1;
        while (businessRepo.existsBySlug(slug)) slug = base + "-" + i++;
        return slug;
    }
}
