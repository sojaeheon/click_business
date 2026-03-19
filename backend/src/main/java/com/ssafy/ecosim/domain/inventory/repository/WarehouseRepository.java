package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
    Optional<Warehouse> findByCompanyId(Long companyId);
}
