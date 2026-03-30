package com.ssafy.ecosim.domain.inventory.repository;

import com.ssafy.ecosim.domain.inventory.entity.WarehouseSlot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseSlotRepository extends JpaRepository<WarehouseSlot, Long> {
}
