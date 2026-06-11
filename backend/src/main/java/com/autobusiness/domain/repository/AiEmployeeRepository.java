package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.AiEmployee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiEmployeeRepository extends JpaRepository<AiEmployee, UUID> {
    List<AiEmployee> findByBusinessId(UUID businessId);
    Optional<AiEmployee> findByBusinessIdAndEmployeeType(UUID businessId, String employeeType);
    List<AiEmployee> findByEmployeeTypeAndEnabledTrue(String employeeType);
}
