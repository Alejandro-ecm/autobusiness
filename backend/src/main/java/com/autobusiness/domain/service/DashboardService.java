package com.autobusiness.domain.service;

import com.autobusiness.domain.model.AiInsight;
import com.autobusiness.domain.model.Alert;
import com.autobusiness.domain.model.Product;
import com.autobusiness.domain.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final SaleRepository saleRepo;
    private final ProductRepository productRepo;
    private final AiInsightRepository insightRepo;
    private final AlertRepository alertRepo;
    private final BranchRepository branchRepo;
    private final PurchaseRepository purchaseRepo;

    public Map<String, Object> getOwnerDashboard(UUID businessId) {
        Instant now = Instant.now();
        Instant todayStart = now.truncatedTo(ChronoUnit.DAYS);
        Instant monthStart = now.minus(30, ChronoUnit.DAYS);
        Instant prevMonthStart = now.minus(60, ChronoUnit.DAYS);

        BigDecimal todayRevenue = Objects.requireNonNullElse(saleRepo.sumByBusinessAndPeriod(businessId, todayStart, now), BigDecimal.ZERO);
        BigDecimal monthRevenue = Objects.requireNonNullElse(saleRepo.sumByBusinessAndPeriod(businessId, monthStart, now), BigDecimal.ZERO);
        BigDecimal prevMonthRevenue = Objects.requireNonNullElse(saleRepo.sumByBusinessAndPeriod(businessId, prevMonthStart, monthStart), BigDecimal.ZERO);

        long todaySales = saleRepo.countByBusinessAndPeriod(businessId, todayStart, now);
        long monthSales = saleRepo.countByBusinessAndPeriod(businessId, monthStart, now);

        BigDecimal revenueGrowth = calcGrowth(monthRevenue, prevMonthRevenue);

        List<Product> lowStock = productRepo.findLowStock(businessId);
        List<AiInsight> insights = insightRepo.findActiveByBusiness(businessId);
        List<Alert> alerts = alertRepo.findByBusinessIdAndIsReadFalseOrderByCreatedAtDesc(businessId);
        long unreadAlerts = alertRepo.countByBusinessIdAndIsReadFalse(businessId);

        List<Object[]> topProducts = saleRepo.topProductsByRevenue(businessId, monthStart, now);

        String businessStatus = determineStatus(insights);

        return Map.of(
                "status", businessStatus,
                "kpis", Map.of(
                        "todayRevenue", todayRevenue,
                        "todaySales", todaySales,
                        "monthRevenue", monthRevenue,
                        "monthSales", monthSales,
                        "revenueGrowth", revenueGrowth,
                        "lowStockCount", lowStock.size()
                ),
                "insights", insights,
                "alerts", alerts,
                "unreadAlerts", unreadAlerts,
                "lowStockProducts", lowStock.stream().limit(5).toList(),
                "topProducts", topProducts.stream().limit(5).map(r -> Map.of(
                        "id", r[0],
                        "name", r[1],
                        "quantity", r[2],
                        "revenue", r[3]
                )).toList()
        );
    }

    public Map<String, Object> getFinanceData(UUID businessId) {
        Instant now = Instant.now();
        Instant from = now.minus(30, ChronoUnit.DAYS);

        BigDecimal revenue = Objects.requireNonNullElse(saleRepo.sumByBusinessAndPeriod(businessId, from, now), BigDecimal.ZERO);
        BigDecimal cost = Objects.requireNonNullElse(saleRepo.sumCostByBusinessAndPeriod(businessId, from, now), BigDecimal.ZERO);
        BigDecimal purchases = Objects.requireNonNullElse(purchaseRepo.sumByBusinessAndPeriod(businessId, from, now), BigDecimal.ZERO);
        BigDecimal grossProfit = revenue.subtract(cost);
        BigDecimal margin = revenue.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO :
                grossProfit.divide(revenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);

        List<Object[]> dailyRaw = saleRepo.dailyRevenue(businessId, from, now);
        List<Map<String, Object>> daily = dailyRaw.stream().map(r -> {
            String day = r[0].toString().substring(0, 10);
            Object rev = r[1];
            return Map.<String, Object>of("day", day, "revenue", rev);
        }).toList();

        List<Object[]> topRaw = saleRepo.topProductsByRevenue(businessId, from, now);
        List<Map<String, Object>> topProducts = topRaw.stream().limit(5).map(r ->
                Map.<String, Object>of("id", r[0], "name", r[1], "qty", r[2], "revenue", r[3])
        ).toList();

        Instant prevFrom = from.minus(30, ChronoUnit.DAYS);
        BigDecimal prevRevenue = Objects.requireNonNullElse(saleRepo.sumByBusinessAndPeriod(businessId, prevFrom, from), BigDecimal.ZERO);
        BigDecimal revenueGrowth = prevRevenue.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO :
                revenue.subtract(prevRevenue).divide(prevRevenue, 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(1, RoundingMode.HALF_UP);

        BigDecimal netCash = revenue.subtract(purchases);

        var result = new java.util.HashMap<String, Object>();
        result.put("period", "ultimos 30 dias");
        result.put("revenue", revenue);
        result.put("cost", cost);
        result.put("purchases", purchases);
        result.put("netCash", netCash);
        result.put("grossProfit", grossProfit);
        result.put("margin", margin);
        result.put("daily", daily);
        result.put("topProducts", topProducts);
        result.put("prevRevenue", prevRevenue);
        result.put("revenueGrowth", revenueGrowth);
        result.put("simulation", Map.of(
                "price_up_10", revenue.multiply(BigDecimal.valueOf(1.10)).setScale(2, RoundingMode.HALF_UP),
                "price_up_15", revenue.multiply(BigDecimal.valueOf(1.15)).setScale(2, RoundingMode.HALF_UP),
                "message", "Simulacion basada en ventas de los ultimos 30 dias"
        ));
        return result;
    }

    public Map<String, Object> getBranchComparison(UUID businessId) {
        var branches = branchRepo.findByBusinessIdAndIsActiveTrue(businessId);
        Instant from = Instant.now().minus(30, ChronoUnit.DAYS);
        Instant to = Instant.now();

        var comparisons = branches.stream().map(b -> {
            BigDecimal revenue = Objects.requireNonNullElse(saleRepo.sumByBranchAndPeriod(b.getId(), from, to), BigDecimal.ZERO);
            long sales = saleRepo.countByBusinessAndPeriod(businessId, from, to);
            return Map.of(
                    "branchId", b.getId(),
                    "branchName", b.getName(),
                    "revenue", revenue,
                    "sales", sales
            );
        }).toList();

        return Map.of("branches", comparisons);
    }

    private BigDecimal calcGrowth(BigDecimal current, BigDecimal previous) {
        if (current == null || previous == null || previous.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return current.subtract(previous)
                .divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(1, RoundingMode.HALF_UP);
    }

    private String determineStatus(List<AiInsight> insights) {
        if (insights.stream().anyMatch(i -> "RED".equals(i.getStatus()))) return "RED";
        if (insights.stream().anyMatch(i -> "YELLOW".equals(i.getStatus()))) return "YELLOW";
        return "GREEN";
    }
}
