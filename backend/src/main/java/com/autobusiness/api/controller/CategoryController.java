package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal AuthPrincipal p) {
        return ResponseEntity.ok(categoryService.getCategories(p.businessId()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthPrincipal p,
                                    @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(categoryService.createCategory(
                p.businessId(),
                body.get("name"),
                body.get("color"),
                body.get("icon")));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> update(@AuthenticationPrincipal AuthPrincipal p,
                                    @PathVariable UUID id,
                                    @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(categoryService.updateCategory(
                p.businessId(), id, body.get("name"), body.get("color"), body.get("icon")));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    public ResponseEntity<?> delete(@AuthenticationPrincipal AuthPrincipal p, @PathVariable UUID id) {
        categoryService.deleteCategory(p.businessId(), id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }
}
