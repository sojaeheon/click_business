package com.ssafy.ecosim.domain.production.repository;

import com.ssafy.ecosim.domain.production.entity.WorkstationInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WorkstationInventoryRepository extends JpaRepository<WorkstationInventory, Long> {
    Optional<WorkstationInventory> findByWorkstationId(Long workstationId);
}
