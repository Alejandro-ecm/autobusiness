package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Category;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.CategoryRepository;
import com.autobusiness.domain.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepo;
    private final BusinessRepository businessRepo;
    private final SaleRepository saleRepo;

    public List<Category> getCategories(UUID businessId) {
        return categoryRepo.findByBusinessIdOrderByName(businessId);
    }

    /**
     * Ganancias totales por categoría: ingresos, ganancia (precio-costo) y unidades vendidas.
     * Incluye una fila "Sin categoría" para los productos sin categoría asignada.
     */
    public List<Map<String, Object>> getEarningsByCategory(UUID businessId) {
        // categoryId -> [revenue, profit, units]
        Map<UUID, BigDecimal[]> byCat = new HashMap<>();
        BigDecimal[] uncategorized = { BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO };

        for (Object[] row : saleRepo.earningsByCategory(businessId)) {
            UUID catId    = (UUID) row[0];
            BigDecimal rev = (BigDecimal) row[1];
            BigDecimal pro = (BigDecimal) row[2];
            BigDecimal qty = (BigDecimal) row[3];
            if (catId == null) {
                uncategorized[0] = rev;
                uncategorized[1] = pro;
                uncategorized[2] = qty;
            } else {
                byCat.put(catId, new BigDecimal[]{ rev, pro, qty });
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Category cat : categoryRepo.findByBusinessIdOrderByName(businessId)) {
            BigDecimal[] vals = byCat.getOrDefault(cat.getId(),
                    new BigDecimal[]{ BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO });
            Map<String, Object> m = new HashMap<>();
            m.put("categoryId", cat.getId());
            m.put("name", cat.getName());
            m.put("color", cat.getColor());
            m.put("revenue", vals[0]);
            m.put("profit", vals[1]);
            m.put("units", vals[2]);
            result.add(m);
        }

        // Fila para productos sin categoría (sólo si tuvieron ventas)
        if (uncategorized[0].signum() != 0 || uncategorized[2].signum() != 0) {
            Map<String, Object> m = new HashMap<>();
            m.put("categoryId", null);
            m.put("name", "Sin categoría");
            m.put("color", "#94a3b8");
            m.put("revenue", uncategorized[0]);
            m.put("profit", uncategorized[1]);
            m.put("units", uncategorized[2]);
            result.add(m);
        }
        return result;
    }

    @Transactional
    public Category createCategory(UUID businessId, String name, String color, String icon) {
        Business business = businessRepo.findById(businessId)
                .orElseThrow(() -> new IllegalArgumentException("Negocio no encontrado"));
        return categoryRepo.save(Category.builder()
                .business(business)
                .name(name.trim())
                .color(color != null ? color : "#6366f1")
                .icon(icon)
                .build());
    }

    @Transactional
    public Category updateCategory(UUID businessId, UUID categoryId, String name, String color, String icon) {
        Category cat = categoryRepo.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Categoría no encontrada"));
        if (!cat.getBusiness().getId().equals(businessId)) throw new SecurityException("Acceso denegado");
        cat.setName(name.trim());
        if (color != null) cat.setColor(color);
        if (icon != null) cat.setIcon(icon);
        return categoryRepo.save(cat);
    }

    @Transactional
    public void deleteCategory(UUID businessId, UUID categoryId) {
        Category cat = categoryRepo.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Categoría no encontrada"));
        if (!cat.getBusiness().getId().equals(businessId)) throw new SecurityException("Acceso denegado");
        categoryRepo.delete(cat);
    }
}
