package com.autobusiness.domain.service;

import com.autobusiness.config.JwtUtil;
import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Branch;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.BranchRepository;
import com.autobusiness.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;

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

        String token = jwtUtil.generate(owner.getId(), owner.getEmail(),
                owner.getRole(), business.getId(), false);

        log.info("Registered: business='{}' slug='{}' owner={}", businessName, slug, email);

        return Map.of(
                "token", token,
                "user", Map.of(
                        "id",           owner.getId(),
                        "name",         owner.getName(),
                        "email",        owner.getEmail(),
                        "role",         owner.getRole(),
                        "isSuperAdmin", false,
                        "businessId",   business.getId(),
                        "businessName", business.getName(),
                        "businessSlug", business.getSlug(),
                        "branchId",     mainBranch.getId(),
                        "subscription", Map.of("plan", "FREE", "status", "TRIAL",
                                               "isActive", true, "daysLeft", 14)
                )
        );
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
