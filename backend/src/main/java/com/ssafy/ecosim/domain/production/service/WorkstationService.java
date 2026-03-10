package com.ssafy.ecosim.domain.production.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.entity.EquipmentInventory;
import com.ssafy.ecosim.domain.inventory.repository.EquipmentInventoryRepository;
import com.ssafy.ecosim.domain.production.entity.Workstation;
import com.ssafy.ecosim.domain.production.entity.WorkstationInventory;
import com.ssafy.ecosim.domain.production.repository.WorkstationRepository;
import com.ssafy.ecosim.domain.production.repository.WorkstationInventoryRepository;
import com.ssafy.ecosim.domain.production.dto.response.WorkstationStatusResponse;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import lombok.RequiredArgsConstructor;
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
        private final CompanyRepository companyRepository;
        private final WorkstationInventoryRepository workstationInventoryRepository;
        private final ItemRepository itemRepository;
        private final InventoryService inventoryService;

        /**
         * 공장(작업장) 생성
         */
        @Transactional
        public Long createWorkstation(Long companyId) {
                Company company = companyRepository.findById(companyId)
                                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 회사입니다."));
                if (workstationRepository.existsByCompanyId(companyId)) {
                        throw new IllegalArgumentException("이미 공장이 존재합니다.");
                }
                Workstation workstation = Workstation.builder()
                                .company(company)
                                .workstationLevel(1) // 기본 레벨 1
                                .build();

                return workstationRepository.save(workstation).getId();
        }

        /**
         * 공장 가동 상태 토글 (ON/OFF)
         */
        @Transactional
        public boolean toggleWorkstation(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                workstation.toggleActive();
                return workstation.getIsActive();
        }

        /**
         * 장비 장착
         */
        @Transactional
        public void equipEquipment(Long companyId, Long workstationId, Long equipmentId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                EquipmentInventory equipment = equipmentInventoryRepository.findByCompanyIdAndId(companyId, equipmentId)
                                .orElseThrow(() -> new IllegalArgumentException("장비를 찾을 수 없거나 해당 회사의 장비가 아닙니다."));

                if (equipment.getIsEquipped()) {
                        throw new IllegalStateException("이미 장착 중인 장비입니다.");
                }

                // 기존 장비가 있다면 해제 (선택사항, 기획에 따라 변경 가능)
                if (workstation.getEquipmentInventory() != null) {
                        workstation.unequipEquipment();
                }

                workstation.equipEquipment(equipment);
        }

        /**
         * 장비 해제
         */
        @Transactional
        public void unequipEquipment(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                workstation.unequipEquipment();
        }

        /**
         * 생산 처리 (지연 평가 - Passive Tick)
         * 이 메서드는 상태 조회, 재료 투입 전, 수확 전 등 최신화가 필요할 때 호출됩니다.
         */
        @Transactional
        public void processProduction(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                Company company = workstation.getCompany();
                Long targetInputItemId = company.getInputItemId();
                Long targetOutputItemId = company.getOutputItemId();

                if (targetOutputItemId == null) {
                        throw new IllegalArgumentException("회사의 생산 결과물 설정이 되어있지 않습니다.");
                }

                if (!workstation.getIsActive()) {
                        return; // 가동 중지 상태면 생산하지 않음
                }

                WorkstationInventory outputInventory = workstationInventoryRepository
                                .findByWorkstationId(workstationId)
                                .orElse(null);

                // 만약 OUTPUT 슬롯에 이미 아이템이 있고, 그 아이템이 생산될 결과물과 다르다면 수확을 기다려야 함
                if (outputInventory != null && outputInventory.getItem() != null
                                && !outputInventory.getItem().getId().equals(targetOutputItemId)) {
                        return; // 수확 전이므로 생산 지연 평가 중지
                }

                LocalDateTime now = LocalDateTime.now();
                // FIXME 개발 시 계산이 편하게 분당으로 변화 추후 초당으로 바꾸면 됨
                long secondsPassed = ChronoUnit.MINUTES.between(workstation.getLastTickTime(), now);

                if (secondsPassed <= 0) {
                        return;
                }

                // 장비에 따른 초당 생산량 결정 (장비가 없으면 레벨당 1개라고 가정하거나 0 처리, 여기선 기본 1개로 처리)
                long productionPerSecond = 1L;
                if (workstation.getEquipmentInventory() != null) {
                        productionPerSecond = workstation.getEquipmentInventory().getLevel() * 1L;
                }

                long potentialProduction = secondsPassed * productionPerSecond;
                long actualProduction = 0L;

                // 창고에서 필요한 재료량이 있는지 확인
                if (targetInputItemId != null) {
                        long availableQuantity = inventoryService.getItemQuantity(companyId, targetInputItemId);
                        if (availableQuantity > 0) {
                                // 소모율 1:1이라고 가정
                                actualProduction = Math.min(potentialProduction, availableQuantity);
                                inventoryService.removeItem(companyId, targetInputItemId, actualProduction);
                        }
                } else {
                        // 재료가 필요 없는 레시피인 경우 바로 생산
                        actualProduction = potentialProduction;
                }

                if (actualProduction > 0) {
                        // OUTPUT 재고 증가
                        if (outputInventory == null) {
                                outputInventory = workstationInventoryRepository.save(
                                                WorkstationInventory.builder()
                                                                .workstation(workstation)
                                                                .build());
                        }

                        Item outputItem = itemRepository.findById(targetOutputItemId)
                                        .orElseThrow(() -> new IllegalArgumentException("결과물 아이템을 찾을 수 없습니다."));

                        outputInventory.addMaterial(outputItem, actualProduction);
                }

                // 최신화 완료 후 시간 동기화
                workstation.updateLastTickTime(now);
        }

        /**
         * 결과물 수확 (OUTPUT 슬롯 -> 플레이어 인벤토리)
         */
        @Transactional
        public void harvestOutput(Long companyId, Long workstationId) {
                if (!workstationRepository.existsByCompanyIdAndId(companyId, workstationId)) {
                        throw new IllegalArgumentException("작업장을 찾을 수 없습니다.");
                }

                WorkstationInventory outputInventory = workstationInventoryRepository
                                .findByWorkstationId(workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("수확할 결과물이 없습니다."));

                if (outputInventory.getQuantity() <= 0 || outputInventory.getItem() == null) {
                        throw new IllegalStateException("수확할 아이템이 없습니다.");
                }

                Long harvestItemId = outputInventory.getItem().getId();
                Long harvestQuantity = outputInventory.getQuantity();

                // 플레이어 인벤토리에 추가
                inventoryService.addItem(companyId, harvestItemId, harvestQuantity);

                // 출력 슬롯 비우기
                outputInventory.consumeMaterial(harvestQuantity);
        }

        /**
         * 작업장 현재 상태(투입/산출 재고 등) 조회
         */
        public WorkstationStatusResponse getWorkstationStatus(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                Company company = workstation.getCompany();
                Long inputItemId = company.getInputItemId();

                WorkstationInventory outputInventory = workstationInventoryRepository
                                .findByWorkstationId(workstationId)
                                .orElse(null);

                WorkstationStatusResponse.WorkstationStatusResponseBuilder builder = WorkstationStatusResponse.builder()
                                .workstationId(workstation.getId())
                                .level(workstation.getWorkstationLevel())
                                .isActive(workstation.getIsActive());

                // 공장의 내 인벤토리에서 재료(input 아이템) 보유량 총합을 조회하여 추가
                if (inputItemId != null) {
                        itemRepository.findById(inputItemId).ifPresent(item -> {
                                builder.inputItemId(item.getId())
                                                .inputItemName(item.getName())
                                                .inputQuantity(inventoryService.getItemQuantity(companyId,
                                                                inputItemId));
                        });
                }

                if (outputInventory != null && outputInventory.getItem() != null) {
                        builder.outputItemId(outputInventory.getItem().getId())
                                        .outputItemName(outputInventory.getItem().getName())
                                        .outputQuantity(outputInventory.getQuantity());
                }

                if (workstation.getEquipmentInventory() != null
                                && workstation.getEquipmentInventory().getItem() != null) {
                        builder.equipmentId(workstation.getEquipmentInventory().getId())
                                        .equipmentName(workstation.getEquipmentInventory().getItem().getName())
                                        .equipmentLevel(workstation.getEquipmentInventory().getLevel());
                }

                return builder.build();
        }
}
