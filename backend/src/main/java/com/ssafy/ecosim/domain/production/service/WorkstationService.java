package com.ssafy.ecosim.domain.production.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.entity.EquipmentInventory;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.repository.EquipmentInventoryRepository;
import com.ssafy.ecosim.domain.inventory.repository.InventorySlotRepository;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;
import com.ssafy.ecosim.domain.production.dto.response.WorkstationStatusResponse;
import com.ssafy.ecosim.domain.production.entity.Workstation;
import com.ssafy.ecosim.domain.production.repository.WorkstationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkstationService {

        private final WorkstationRepository workstationRepository;
        private final EquipmentInventoryRepository equipmentInventoryRepository;
        private final InventorySlotRepository inventorySlotRepository;
        private final CompanyRepository companyRepository;
        private final ItemRepository itemRepository;
        private final WarehouseService warehouseService;
        private final ApplicationEventPublisher eventPublisher;

        // 일꾼 레벨별 생산 속도 배율 (프론트 workers.ts의 speedMultiplier와 동일)
        private static double getWorkerSpeedMultiplier(int workerLevel) {
                return switch (workerLevel) {
                        case 1 -> 1.00;
                        case 2 -> 1.15;
                        case 3 -> 1.35;
                        case 4 -> 1.60;
                        case 5 -> 2.00;
                        case 6 -> 3.00;
                        default -> 1.00;
                };
        }

        @Transactional
        public Long createWorkstation(Long companyId) {
                Company company = companyRepository.findById(companyId)
                                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회사입니다."));
                if (workstationRepository.existsByCompanyId(companyId)) {
                        throw new IllegalArgumentException("이미 공장이 존재합니다.");
                }
                Workstation workstation = Workstation.builder()
                                .company(company)
                                .workstationLevel(1)
                                .build();

                return workstationRepository.save(workstation).getId();
        }

        @Transactional
        public boolean toggleWorkstation(Long companyId, Long workstationId) {
                Workstation workstation = findWorkstation(companyId, workstationId);
                workstation.toggleActive();
                return workstation.getIsActive();
        }

        /**
         * 일꾼 장착: 인벤토리 슬롯 인덱스를 Workstation에 연결
         */
        @Transactional
        public void equipWorker(Long companyId, Long workstationId, Integer slotIndex) {
                Workstation workstation = findWorkstation(companyId, workstationId);

                InventorySlot slot = inventorySlotRepository
                        .findByInventory_Company_IdAndSlotIndex(companyId, slotIndex)
                        .orElseThrow(() -> new IllegalArgumentException("해당 슬롯을 찾을 수 없습니다."));

                if (slot.getItem() == null) throw new IllegalArgumentException("슬롯이 비어있습니다.");
                if (slot.getItem().getWorkerLevel() == null)
                        throw new IllegalArgumentException("해당 아이템은 일꾼이 아닙니다.");

                workstation.equipWorker(slotIndex);
        }

        /**
         * 일꾼 장착 해제
         */
        @Transactional
        public void unequipWorker(Long companyId, Long workstationId) {
                findWorkstation(companyId, workstationId).unequipWorker();
        }

        @Transactional
        public void equipEquipment(Long companyId, Long workstationId, Long equipmentId) {
                Workstation workstation = findWorkstation(companyId, workstationId);
                EquipmentInventory equipment = equipmentInventoryRepository.findByCompanyIdAndId(companyId, equipmentId)
                                .orElseThrow(() -> new IllegalArgumentException("장비를 찾을 수 없거나 해당 회사의 장비가 아닙니다."));

                if (equipment.getIsEquipped()) throw new IllegalStateException("이미 장착 중인 장비입니다.");

                if (workstation.getEquipmentInventory() != null) workstation.unequipEquipment();
                workstation.equipEquipment(equipment);
        }

        @Transactional
        public void unequipEquipment(Long companyId, Long workstationId) {
                findWorkstation(companyId, workstationId).unequipEquipment();
        }

        /**
         * 재료 예약: 창고(MATERIAL) → 워크스테이션 예약석
         */
        @Transactional
        public void reserveMaterials(Long companyId, Long workstationId, Long quantity) {
                Workstation workstation = findWorkstation(companyId, workstationId);
                Long inputItemId = workstation.getCompany().getInputItemId();

                if (inputItemId == null) throw new IllegalArgumentException("회사의 생산 재료 설정이 되어있지 않습니다.");

                warehouseService.removeItem(companyId, inputItemId, quantity);
                workstation.addReservedQuantity(quantity);
        }

        /**
         * 생산 처리 (지연 평가 - Passive Tick)
         */
        @Transactional
        public void processProduction(Long companyId, Long workstationId) {
                Workstation workstation = findWorkstation(companyId, workstationId);

                if (!workstation.getIsActive()) return;

                LocalDateTime now = LocalDateTime.now();
                long secondsPassed = ChronoUnit.MINUTES.between(workstation.getLastTickTime(), now);

                if (secondsPassed <= 0) return;

                // 기본 생산량: 구 장비(EquipmentInventory) 레벨 기반
                long productionPerMinute = 1L;
                if (workstation.getEquipmentInventory() != null) {
                        productionPerMinute = workstation.getEquipmentInventory().getLevel();
                }

                // 일꾼 속도 배율 적용 (장착된 슬롯의 일꾼 workerLevel로 계산)
                double workerMult = 1.0;
                if (workstation.getEquippedWorkerSlotIndex() != null) {
                        workerMult = inventorySlotRepository
                                .findByInventory_Company_IdAndSlotIndex(companyId, workstation.getEquippedWorkerSlotIndex())
                                .filter(s -> s.getItem() != null && s.getItem().getWorkerLevel() != null)
                                .map(s -> getWorkerSpeedMultiplier(s.getItem().getWorkerLevel()))
                                .orElse(1.0);
                }

                long potentialProduction = (long) (secondsPassed * productionPerMinute * workerMult);
                Company company = workstation.getCompany();
                int requirement = company.getIndustryType().getBaseRequirement();
                int yield = company.getIndustryType().getBaseYield();

                long availableLaps = workstation.getReservedQuantity() / requirement;
                long actualLaps = Math.min(potentialProduction, availableLaps);

                if (actualLaps > 0) {
                        workstation.consumeReservedQuantity(actualLaps * requirement);
                        workstation.addProducedQuantity(actualLaps * yield);

                        eventPublisher.publishEvent(new NotificationEvent(
                                        company.getUser().getId(),
                                        String.format("[%s] 생산이 %d개 완료되었습니다!",
                                                      company.getIndustryType().name(), actualLaps * yield),
                                        NotificationType.PRODUCTION
                        ));
                }

                workstation.updateLastTickTime(now);
        }

        /**
         * 결과물 수확: 워크스테이션 → 창고(PRODUCT)
         */
        @Transactional
        public void harvestOutput(Long companyId, Long workstationId) {
                Workstation workstation = findWorkstation(companyId, workstationId);

                long harvestQuantity = workstation.getProducedQuantity();
                if (harvestQuantity <= 0) throw new IllegalStateException("수확할 아이템이 없습니다.");

                Long harvestItemId = workstation.getCompany().getOutputItemId();
                if (harvestItemId == null) throw new IllegalArgumentException("회사의 생산 결과물 설정이 되어있지 않습니다.");

                warehouseService.addItem(companyId, harvestItemId, harvestQuantity);
                workstation.clearProducedQuantity();
        }

        public WorkstationStatusResponse getWorkstationStatus(Long companyId, Long workstationId) {
                Workstation workstation = findWorkstation(companyId, workstationId);
                Long outputItemId = workstation.getCompany().getOutputItemId();

                WorkstationStatusResponse.WorkstationStatusResponseBuilder builder = WorkstationStatusResponse.builder()
                                .workstationId(workstation.getId())
                                .level(workstation.getWorkstationLevel())
                                .isActive(workstation.getIsActive())
                                .reservedQuantity(workstation.getReservedQuantity())
                                .producedQuantity(workstation.getProducedQuantity());

                if (outputItemId != null) {
                        itemRepository.findById(outputItemId).ifPresent(item ->
                                builder.outputItemId(item.getId())
                                       .outputItemName(item.getName())
                                       .outputQuantity(workstation.getProducedQuantity())
                        );
                }

                if (workstation.getEquipmentInventory() != null && workstation.getEquipmentInventory().getItem() != null) {
                        builder.equipmentId(workstation.getEquipmentInventory().getId())
                               .equipmentName(workstation.getEquipmentInventory().getItem().getName())
                               .equipmentLevel(workstation.getEquipmentInventory().getLevel());
                }

                if (workstation.getEquippedWorkerSlotIndex() != null) {
                        builder.equippedWorkerSlotIndex(workstation.getEquippedWorkerSlotIndex());
                        inventorySlotRepository
                                .findByInventory_Company_IdAndSlotIndex(companyId, workstation.getEquippedWorkerSlotIndex())
                                .filter(s -> s.getItem() != null && s.getItem().getWorkerLevel() != null)
                                .ifPresent(s -> builder.equippedWorkerLevel(s.getItem().getWorkerLevel()));
                }

                return builder.build();
        }

        private Workstation findWorkstation(Long companyId, Long workstationId) {
                return workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));
        }
}
