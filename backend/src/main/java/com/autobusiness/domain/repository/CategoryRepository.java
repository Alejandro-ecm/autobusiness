package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    List<Category> findByBusinessIdOrderByName(UUID businessId);
}
