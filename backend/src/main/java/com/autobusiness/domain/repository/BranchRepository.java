package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BranchRepository extends JpaRepository<Branch, UUID> {
    List<Branch> findByBusinessId(UUID businessId);
    List<Branch> findByBusinessIdAndIsActiveTrue(UUID businessId);
    Optional<Branch> findFirstByBusinessIdAndIsMainTrue(UUID businessId);
}
