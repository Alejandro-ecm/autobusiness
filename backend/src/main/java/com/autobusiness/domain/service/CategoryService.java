package com.autobusiness.domain.service;

import com.autobusiness.domain.model.Business;
import com.autobusiness.domain.model.Category;
import com.autobusiness.domain.repository.BusinessRepository;
import com.autobusiness.domain.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepo;
    private final BusinessRepository businessRepo;

    public List<Category> getCategories(UUID businessId) {
        return categoryRepo.findByBusinessIdOrderByName(businessId);
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
