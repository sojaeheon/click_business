package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventorySlotRepository extends JpaRepository<InventorySlot, Long> {
}
