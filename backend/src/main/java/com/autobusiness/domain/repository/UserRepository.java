package com.autobusiness.domain.repository;

import com.autobusiness.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    List<User> findByBusinessId(UUID businessId);
    boolean existsByEmail(String email);
}
