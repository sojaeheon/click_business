package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InventorySlotRepository extends JpaRepository<InventorySlot, Long> {
    Optional<InventorySlot> findByInventory_Company_IdAndSlotIndex(Long companyId, Integer slotIndex);
}
