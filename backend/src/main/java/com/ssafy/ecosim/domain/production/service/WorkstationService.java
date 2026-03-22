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

import java.time.Instant;
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

        @Transactional
        public void reserveMaterials(Long companyId, Long workstationId, Long outputQuantity) {
                Workstation workstation = findWorkstation(companyId, workstationId);
                Long inputItemId = workstation.getCompany().getInputItemId();

                if (inputItemId == null) throw new IllegalArgumentException("회사의 생산 재료 설정이 되어있지 않습니다.");

                int baseYield = workstation.getCompany().getIndustryType().getBaseYield();
                int baseRequirement = workstation.getCompany().getIndustryType().getBaseRequirement();

                long laps = outputQuantity / baseYield;
                if (laps == 0) throw new IllegalArgumentException("생산 수량이 너무 적습니다. 최소 " + baseYield + "개 이상 입력하세요.");

                long requiredMaterials = laps * baseRequirement;

                warehouseService.removeItem(companyId, inputItemId, requiredMaterials);
                workstation.addReservedQuantity(requiredMaterials);
        }

        @Transactional
        public void processProduction(Long companyId, Long workstationId) {
                Workstation workstation = findWorkstation(companyId, workstationId);

                if (!workstation.getIsActive()) return;

                LocalDateTime now = LocalDateTime.now();
                long secondsPassed = ChronoUnit.SECONDS.between(workstation.getLastTickTime(), now);

                if (secondsPassed <= 0) return;

                long productionPerMinute = 1L;
                if (workstation.getEquipmentInventory() != null) {
                        productionPerMinute = workstation.getEquipmentInventory().getLevel();
                }

                double workerMult = 1.0;
                if (workstation.getEquippedWorkerSlotIndex() != null) {
                        workerMult = inventorySlotRepository
                                .findByInventory_Company_IdAndSlotIndex(companyId, workstation.getEquippedWorkerSlotIndex())
                                .filter(s -> s.getItem() != null && s.getItem().getWorkerLevel() != null)
                                .map(s -> getWorkerSpeedMultiplier(s.getItem().getWorkerLevel()))
                                .orElse(1.0);
                }

                long potentialProduction = (long) (secondsPassed * productionPerMinute / 60.0 * workerMult);
                Company company = workstation.getCompany();
                int requirement = company.getIndustryType().getBaseRequirement();
                int yield = company.getIndustryType().getBaseYield();

                long availableLaps = workstation.getReservedQuantity() / requirement;
                
                if (potentialProduction > 0) {
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

                        long secondsUsed = (long) (potentialProduction * 60.0 / (productionPerMinute * workerMult));
                        workstation.updateLastTickTime(workstation.getLastTickTime().plusSeconds(secondsUsed));
                }
        }

        @Transactional
        public void harvestOutput(Long companyId, Long workstationId) {
                processProduction(companyId, workstationId);

                Workstation workstation = findWorkstation(companyId, workstationId);

                long harvestQuantity = workstation.getProducedQuantity();
                if (harvestQuantity <= 0) return;  // ★ 여기만 수정: throw → return

                Long harvestItemId = workstation.getCompany().getOutputItemId();
                if (harvestItemId == null) throw new IllegalArgumentException("회사의 생산 결과물 설정이 되어있지 않습니다.");

                warehouseService.addItem(companyId, harvestItemId, harvestQuantity);
                workstation.clearProducedQuantity();
        }
        
        @Transactional
        public WorkstationStatusResponse getMyWorkstationStatus(Long companyId) {
                Workstation workstation = workstationRepository.findAllByCompanyId(companyId)
                                .stream()
                                .findFirst()
                                .orElseThrow(() -> new IllegalArgumentException("공장이 존재하지 않습니다."));
                processProduction(companyId, workstation.getId());
                return getWorkstationStatus(companyId, workstation.getId());
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

                double workerMult = 1.0;
                if (workstation.getEquippedWorkerSlotIndex() != null) {
                        builder.equippedWorkerSlotIndex(workstation.getEquippedWorkerSlotIndex());
                        workerMult = inventorySlotRepository
                                .findByInventory_Company_IdAndSlotIndex(companyId, workstation.getEquippedWorkerSlotIndex())
                                .filter(s -> s.getItem() != null && s.getItem().getWorkerLevel() != null)
                                .map(s -> {
                                        builder.equippedWorkerLevel(s.getItem().getWorkerLevel());
                                        return getWorkerSpeedMultiplier(s.getItem().getWorkerLevel());
                                })
                                .orElse(1.0);
                }

                if (workstation.getIsActive() && workstation.getReservedQuantity() > 0) {
                        long productionPerMinute = (workstation.getEquipmentInventory() != null)
                                ? workstation.getEquipmentInventory().getLevel() : 1L;
                        double productionPerSecond = productionPerMinute / 60.0 * workerMult;
                        int requirement = workstation.getCompany().getIndustryType().getBaseRequirement();
                        long availableLaps = workstation.getReservedQuantity() / requirement;
                        
                        long secondsToComplete = (long) Math.ceil(availableLaps / productionPerSecond);
                        
                        java.time.Instant expected = workstation.getLastTickTime()
                            .atZone(java.time.ZoneId.systemDefault())
                            .toInstant()
                            .plusSeconds(secondsToComplete);
                            
                        builder.expectedEndTime(expected);
                }

                return builder.build();
        }

        private Workstation findWorkstation(Long companyId, Long workstationId) {
                return workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));
        }
}