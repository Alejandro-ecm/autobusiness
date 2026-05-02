package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.User;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepo;
    private final BusinessRepository businessRepo;
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
}
