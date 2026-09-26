package com.autobusiness.domain.service;

import com.autobusiness.config.JwtUtil;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Branch;
import com.autobusiness.domain.model.PasswordResetToken;
import com.autobusiness.domain.model.PendingRegistration;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.model.Customer;
import com.autobusiness.domain.model.LegalAcceptance;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.BranchRepository;
import com.autobusiness.domain.repository.CustomerRepository;
import com.autobusiness.domain.repository.LegalAcceptanceRepository;
import com.autobusiness.domain.repository.PasswordResetTokenRepository;
import com.autobusiness.domain.repository.PendingRegistrationRepository;
import com.autobusiness.domain.repository.UserRepository;
import com.autobusiness.infrastructure.analytics.AlejandriaClient;
import com.autobusiness.infrastructure.email.ResendClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final java.util.Set<String> ALLOWED_EMAIL_DOMAINS = java.util.Set.of(
        "gmail.com", "hotmail.com", "hotmail.es", "hotmail.com.mx", "hotmail.fr",
        "outlook.com", "outlook.es", "outlook.com.mx", "live.com", "live.com.mx"
    );

    private void validateEmailDomain(String email) {
        if (email == null || !email.contains("@")) throw new IllegalArgumentException("Email inválido");
        String domain = email.trim().toLowerCase().split("@")[1];
        if (!ALLOWED_EMAIL_DOMAINS.contains(domain))
            throw new IllegalArgumentException(
                "Solo se aceptan correos de Gmail (@gmail.com) o Hotmail/Outlook (@hotmail.com, @outlook.com)");
    }

    private final UserRepository userRepo;
    private final BusinessRepository businessRepo;
    private final BranchRepository branchRepo;
    private final SubscriptionService subscriptionService;
    private final PendingRegistrationRepository pendingRepo;
    private final PasswordResetTokenRepository resetTokenRepo;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;
    private final AlejandriaClient alejandria;
    private final LegalService legalService;
    private final ResendClient resendClient;
    private final LegalAcceptanceRepository legalAcceptanceRepo;
    private final CustomerRepository customerRepo;

    private static final long DELETION_GRACE_PERIOD_DAYS = 30;

    @Value("${app.base-url}")
    private String appBaseUrl;

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

        boolean needsLegal = !legalService.hasAcceptedLatest(user.getId());

        var userMap = new HashMap<String, Object>();
        userMap.put("id",           user.getId());
        userMap.put("name",         user.getName());
        userMap.put("email",        user.getEmail());
        userMap.put("role",         user.getRole());
        userMap.put("isSuperAdmin", user.isSuperAdmin());
        userMap.put("businessId",   user.getBusiness().getId());
        userMap.put("businessName", user.getBusiness().getName());
        userMap.put("businessSlug", user.getBusiness().getSlug());
        userMap.put("ticketRefundText", user.getBusiness().getTicketRefundText());
        if (user.getBusiness().getDeletionRequestedAt() != null) {
            userMap.put("deletionRequestedAt", user.getBusiness().getDeletionRequestedAt());
            userMap.put("deletionScheduledFor",
                    user.getBusiness().getDeletionRequestedAt().plus(DELETION_GRACE_PERIOD_DAYS, ChronoUnit.DAYS));
        }
        userMap.put("subscription", Map.of(
                "plan",     sub.get("plan"),
                "status",   sub.get("status"),
                "isActive", sub.get("isActive"),
                "daysLeft", sub.get("daysLeft")
        ));
        if (branchId != null) userMap.put("branchId", branchId);
        userMap.put("profileType",              user.getBusiness().getProfileType());
        userMap.put("onboardingCompleted",       user.getBusiness().isOnboardingCompleted());
        userMap.put("requiresLegalAcceptance",   needsLegal);

        log.info("Login: {} role={} requiresLegal={}", email, user.getRole(), needsLegal);
        return Map.of("token", token, "user", userMap, "requiresLegalAcceptance", needsLegal);
    }

    @Transactional
    public Map<String, Object> register(String businessName, String ownerName,
                                         String email, String password,
                                         String ipAddress, String userAgent) {
        if (userRepo.existsByEmail(email))
            throw new IllegalArgumentException("El email ya está registrado");
        validateEmailDomain(email);
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

        // Registrar aceptación legal al momento del registro
        legalService.recordAcceptance(owner.getId(), ipAddress, userAgent);

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
        userMap2.put("requiresLegalAcceptance", false);
        userMap2.put("subscription",       Map.of("plan", "FREE", "status", "TRIAL",
                                                   "isActive", true, "daysLeft", 14));
        return Map.of("token", token, "user", userMap2);
    }

    /**
     * Derechos ARCO — paso 1: marca el negocio para eliminacion, pero no
     * borra ni anonimiza nada todavia. La anonimizacion real la ejecuta
     * runScheduledDeletions() cuando se cumple el periodo de gracia, para
     * que el dueño tenga oportunidad de cancelar.
     */
    @Transactional
    public Map<String, Object> requestAccountDeletion(UUID userId, UUID businessId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!"OWNER".equals(user.getRole()))
            throw new IllegalStateException("Solo el dueño puede eliminar la cuenta");
        if (!user.getBusiness().getId().equals(businessId))
            throw new IllegalStateException("No tienes permiso para eliminar este negocio");

        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        Instant requestedAt = Instant.now();
        business.setDeletionRequestedAt(requestedAt);
        businessRepo.save(business);

        Instant scheduledFor = requestedAt.plus(DELETION_GRACE_PERIOD_DAYS, ChronoUnit.DAYS);
        log.info("Account deletion requested: business={} scheduledFor={}", businessId, scheduledFor);
        return Map.of(
                "message", "Solicitud de eliminación registrada",
                "deletionRequestedAt", requestedAt,
                "deletionScheduledFor", scheduledFor
        );
    }

    /** Derechos ARCO — cancela una solicitud de eliminación dentro del periodo de gracia. */
    @Transactional
    public Map<String, Object> cancelAccountDeletion(UUID userId, UUID businessId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!"OWNER".equals(user.getRole()))
            throw new IllegalStateException("Solo el dueño puede cancelar la eliminación");
        if (!user.getBusiness().getId().equals(businessId))
            throw new IllegalStateException("No tienes permiso sobre este negocio");

        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        if (!business.isActive())
            throw new IllegalStateException("Esta cuenta ya fue eliminada y no se puede recuperar");
        business.setDeletionRequestedAt(null);
        businessRepo.save(business);

        log.info("Account deletion cancelled: business={}", businessId);
        return Map.of("message", "Solicitud de eliminación cancelada");
    }

    /**
     * Anonimizacion real (antes era el contenido de deleteAccount, ejecutado
     * al instante). No toca sales/orders/inventory_movements — esos se
     * conservan por obligaciones fiscales, solo pierden el nombre real al
     * quedar ligados a un negocio/usuario anonimizado.
     */
    @Transactional
    void executeAccountDeletion(UUID businessId) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));

        String tombstone = UUID.randomUUID().toString();
        userRepo.findByBusinessId(businessId).forEach(u -> {
            u.setEmail("deleted-" + u.getId() + "@deleted.autobusiness");
            u.setName("[Cuenta Eliminada]");
            u.setPasswordHash(tombstone);
            u.setActive(false);
            userRepo.save(u);
        });

        business.setActive(false);
        business.setSuspended(true);
        business.setName("[Eliminado] " + business.getName());
        // Limpiar la marca de solicitud — si no, runScheduledDeletions() la
        // volveria a encontrar y reprocesar cada noche indefinidamente.
        business.setDeletionRequestedAt(null);
        businessRepo.save(business);

        log.info("Account deletion executed: business={}", businessId);
    }

    /** Corre 1x/dia — ejecuta las eliminaciones cuyo periodo de gracia ya venció. */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void runScheduledDeletions() {
        Instant cutoff = Instant.now().minus(DELETION_GRACE_PERIOD_DAYS, ChronoUnit.DAYS);
        for (Business b : businessRepo.findByDeletionRequestedAtIsNotNull()) {
            if (b.getDeletionRequestedAt().isBefore(cutoff) || b.getDeletionRequestedAt().equals(cutoff)) {
                executeAccountDeletion(b.getId());
            }
        }
    }

    /**
     * Derechos ARCO — exporta los datos personales del usuario en JSON. No
     * duplica lo que Inventario/Reportes ya exportan en CSV (productos,
     * ventas): esto es perfil, historial de aceptaciones legales, y si es
     * OWNER, datos del negocio y su cartera de clientes/fiado.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportAccountData(UUID userId, UUID businessId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (!user.getBusiness().getId().equals(businessId))
            throw new IllegalStateException("No tienes permiso sobre este negocio");

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("role", user.getRole());
        profile.put("createdAt", user.getCreatedAt());

        List<Map<String, Object>> acceptances = new ArrayList<>();
        for (LegalAcceptance a : legalAcceptanceRepo.findByUserIdOrderByAcceptedAtDesc(userId)) {
            Map<String, Object> row = new HashMap<>();
            row.put("termsVersion", a.getTermsVersion());
            row.put("privacyVersion", a.getPrivacyVersion());
            row.put("acceptableUseVersion", a.getAcceptableUseVersion());
            row.put("acceptedAt", a.getAcceptedAt());
            row.put("ipAddress", a.getIpAddress());
            acceptances.add(row);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("exportedAt", Instant.now());
        result.put("profile", profile);
        result.put("legalAcceptances", acceptances);

        if ("OWNER".equals(user.getRole())) {
            Business business = user.getBusiness();
            Map<String, Object> businessData = new HashMap<>();
            businessData.put("name", business.getName());
            businessData.put("slug", business.getSlug());
            businessData.put("phone", business.getPhone());
            businessData.put("email", business.getEmail());
            businessData.put("address", business.getAddress());
            businessData.put("createdAt", business.getCreatedAt());
            result.put("business", businessData);

            List<Map<String, Object>> customers = new ArrayList<>();
            for (Customer c : customerRepo.findByBusinessIdAndIsActiveTrueOrderByName(businessId)) {
                Map<String, Object> row = new HashMap<>();
                row.put("name", c.getName());
                row.put("phone", c.getPhone());
                row.put("email", c.getEmail());
                row.put("address", c.getAddress());
                row.put("totalCredit", c.getTotalCredit());
                row.put("createdAt", c.getCreatedAt());
                customers.add(row);
            }
            result.put("customers", customers);
        }

        return result;
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

    // ── Recuperación de contraseña (self-service, incluye al OWNER) ──────────
    private static final int RESET_TOKEN_EXPIRY_MINUTES = 30;

    @Transactional
    public void forgotPassword(String email) {
        // Siempre se comporta igual exista o no el email, para no revelar
        // qué correos están registrados.
        if (email == null || email.isBlank()) return;
        userRepo.findByEmail(email.trim().toLowerCase()).ifPresent(user -> {
            String rawToken = generateResetToken();
            PasswordResetToken token = PasswordResetToken.builder()
                    .user(user)
                    .tokenHash(hashToken(rawToken))
                    .expiresAt(Instant.now().plus(RESET_TOKEN_EXPIRY_MINUTES, ChronoUnit.MINUTES))
                    .build();
            resetTokenRepo.save(token);

            String link = appBaseUrl + "/reset-password?token=" + rawToken;
            String html = "<p>Hola " + user.getName() + ",</p>"
                    + "<p>Recibimos una solicitud para restablecer tu contraseña de AutoBusiness AI.</p>"
                    + "<p><a href=\"" + link + "\">Haz clic aquí para crear una nueva contraseña</a></p>"
                    + "<p>Este enlace expira en " + RESET_TOKEN_EXPIRY_MINUTES + " minutos. "
                    + "Si tú no lo solicitaste, puedes ignorar este correo.</p>";
            resendClient.sendHtml(user.getEmail(), "Recupera tu contraseña — AutoBusiness AI", html);
            log.info("forgot-password: email enviado a userId={}", user.getId());
        });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank())
            throw new IllegalArgumentException("Token inválido");
        if (newPassword == null || newPassword.length() < 6)
            throw new IllegalArgumentException("La contraseña debe tener al menos 6 caracteres");

        PasswordResetToken token = resetTokenRepo.findByTokenHash(hashToken(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("El enlace no es válido o ya fue usado"));
        if (token.getUsedAt() != null)
            throw new IllegalArgumentException("El enlace no es válido o ya fue usado");
        if (token.getExpiresAt().isBefore(Instant.now()))
            throw new IllegalArgumentException("El enlace expiró, solicita uno nuevo");

        User user = token.getUser();
        user.setPasswordHash(encoder.encode(newPassword));
        userRepo.save(user);

        token.setUsedAt(Instant.now());
        resetTokenRepo.save(token);
        log.info("reset-password: contraseña actualizada userId={}", user.getId());
    }

    private String generateResetToken() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo procesar el token", e);
        }
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
        validateEmailDomain(email);
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
