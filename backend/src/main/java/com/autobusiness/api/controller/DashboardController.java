package com.autobusiness.api.controller;

import com.autobusiness.config.JwtAuthFilter.AuthPrincipal;
import com.autobusiness.domain.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getDashboard(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(dashboardService.getOwnerDashboard(principal.businessId()));
    }

    @GetMapping("/finance")
    public ResponseEntity<Map<String, Object>> getFinance(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(dashboardService.getFinanceData(principal.businessId()));
    }

    @GetMapping("/branches")
    public ResponseEntity<Map<String, Object>> getBranchComparison(
            @AuthenticationPrincipal AuthPrincipal principal) {
        return ResponseEntity.ok(dashboardService.getBranchComparison(principal.businessId()));
    }
}
