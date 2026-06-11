package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.model.AiEmployee;
import com.autobusiness.domain.repository.AiEmployeeRepository;
import com.autobusiness.infrastructure.ai.AiEngineClient;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/ai-employees")
@RequiredArgsConstructor
public class AiEmployeeController {

    private static final Set<String> KNOWN_TYPES =
            Set.of("vendedor", "cobrador", "repositor", "vendedor_ig", "cobrador_ig", "repositor_ig");

    private final AiEmployeeRepository aiEmployeeRepo;
    private final AiEngineClient aiEngineClient;

    /** Estado de todos los empleados IA del negocio: { vendedor: true, cobrador: false, ... } */
    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal principal) {
        Map<String, Boolean> states = new HashMap<>();
        KNOWN_TYPES.forEach(t -> states.put(t, false));
        aiEmployeeRepo.findByBusinessId(principal.businessId())
                .forEach(e -> states.put(e.getEmployeeType(), e.isEnabled()));
        return ResponseEntity.ok(Map.of("employees", states));
    }

    /** Enciende/apaga un empleado IA (persistido por negocio). */
    @PatchMapping("/{type}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> toggle(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable String type,
            @RequestBody Map<String, Boolean> body) {
        if (!KNOWN_TYPES.contains(type)) {
            throw new IllegalArgumentException("Empleado IA desconocido: " + type);
        }
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        AiEmployee emp = aiEmployeeRepo
                .findByBusinessIdAndEmployeeType(principal.businessId(), type)
                .orElseGet(() -> AiEmployee.builder()
                        .businessId(principal.businessId())
                        .employeeType(type)
                        .build());
        emp.setEnabled(enabled);
        aiEmployeeRepo.save(emp);
        return ResponseEntity.ok(Map.of("type", type, "enabled", enabled));
    }

    /** Prueba el Vendedor IA sin WhatsApp: manda un texto y devuelve lo que respondería. */
    @PostMapping("/vendedor/test")
    public ResponseEntity<?> testVendedor(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody Map<String, String> body) {
        String text = body.getOrDefault("text", "").trim();
        if (text.isEmpty()) throw new IllegalArgumentException("El mensaje no puede estar vacío");
        return ResponseEntity.ok(aiEngineClient.vendedorReply(principal.businessId(), text, true));
    }
}
