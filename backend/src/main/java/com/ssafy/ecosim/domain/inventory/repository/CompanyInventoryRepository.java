package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.CompanyInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompanyInventoryRepository extends JpaRepository<CompanyInventory, Long> {
    Optional<CompanyInventory> findByCompanyId(Long companyId);
}
