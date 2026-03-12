package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.EquipmentInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipmentInventoryRepository extends JpaRepository<EquipmentInventory, Long> {
    Optional<EquipmentInventory> findByCompanyIdAndId(Long companyId, Long equipmentId);

    List<EquipmentInventory> findAllByCompanyId(Long companyId);
}
