package com.ssafy.ecosim.domain.production.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.entity.EquipmentInventory;
import com.ssafy.ecosim.domain.inventory.repository.EquipmentInventoryRepository;
import com.ssafy.ecosim.domain.production.entity.Workstation;
import com.ssafy.ecosim.domain.production.repository.WorkstationRepository;
import com.ssafy.ecosim.domain.production.dto.response.WorkstationStatusResponse;
import com.ssafy.ecosim.domain.company.entity.IndustryType;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;
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
        private final CompanyRepository companyRepository;
        private final ItemRepository itemRepository;
        private final InventoryService inventoryService;
        private final ApplicationEventPublisher eventPublisher;

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
         * 생산을 위한 재료 예약 (창고 -> 워크스테이션 예약석)
         */
        @Transactional
        public void reserveMaterials(Long companyId, Long workstationId, Long quantity) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                Company company = workstation.getCompany();
                Long inputItemId = company.getInputItemId();

                if (inputItemId == null) {
                        throw new IllegalArgumentException("회사의 생산 재료 설정이 되어있지 않습니다.");
                }

                // 창고에서 재료 차감
                inventoryService.removeItem(companyId, inputItemId, quantity);

                // 워크스테이션 예약 수량 증가
                workstation.addReservedQuantity(quantity);
        }

        /**
         * 생산 처리 (지연 평가 - Passive Tick)
         * 이 메서드는 상태 조회, 재료 투입 전, 수확 전 등 최신화가 필요할 때 호출됩니다.
         */
        @Transactional
        public void processProduction(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                if (!workstation.getIsActive()) {
                        return; // 가동 중지 상태면 생산하지 않음
                }

                LocalDateTime now = LocalDateTime.now();
                // FIXME 개발 시 계산이 편하게 분당으로 변화 추후 초당으로 바꾸면 됨
                long secondsPassed = ChronoUnit.MINUTES.between(workstation.getLastTickTime(), now);

                if (secondsPassed <= 0) {
                        return;
                }

                // 장산량 결정 (기본 1개)
                long productionPerSecond = 1L;
                if (workstation.getEquipmentInventory() != null) {
                        productionPerSecond = workstation.getEquipmentInventory().getLevel() * 1L;
                }

                long potentialProduction = secondsPassed * productionPerSecond; // 이번 틱에 가능한 최대 생산 횟수(Laps)

                Company company = workstation.getCompany();
                
                int requirement = company.getIndustryType().getBaseRequirement();
                int yield = company.getIndustryType().getBaseYield();

                // 예약된 재료로 실제 가능한 생산 횟수(Laps) 계산
                long availableLaps = workstation.getReservedQuantity() / requirement;

                // 실제 진행될 생산 횟수
                long actualLaps = Math.min(potentialProduction, availableLaps);

                if (actualLaps > 0) {
                        // 실제 소모될 재료량과 생성될 산출물량 계산
                        long consumedMaterial = actualLaps * requirement;
                        long producedYield = actualLaps * yield;

                        // 예약량 차감 및 생산완료량 증가
                        workstation.consumeReservedQuantity(consumedMaterial);
                        workstation.addProducedQuantity(producedYield);

                        // 알림 이벤트 발행
                        eventPublisher.publishEvent(new NotificationEvent(
                                        company.getUser().getId(),
                                        String.format("[%s] 생산이 %d개 완료되었습니다!", 
                                                      company.getIndustryType().name(), producedYield),
                                        NotificationType.PRODUCTION
                        ));
                }

                // 최신화 완료 후 시간 동기화
                workstation.updateLastTickTime(now);
        }

        /**
         * 결과물 수확 (OUTPUT 슬롯 -> 플레이어 인벤토리)
         */
        @Transactional
        public void harvestOutput(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                Long harvestQuantity = workstation.getProducedQuantity();
                if (harvestQuantity <= 0) {
                        throw new IllegalStateException("수확할 아이템이 없습니다.");
                }

                Company company = workstation.getCompany();
                Long harvestItemId = company.getOutputItemId();

                if (harvestItemId == null) {
                        throw new IllegalArgumentException("회사의 생산 결과물 설정이 되어있지 않습니다.");
                }

                // 플레이어 인벤토리에 추가
                inventoryService.addItem(companyId, harvestItemId, harvestQuantity);

                // 출력 슬롯 비우기
                workstation.clearProducedQuantity();
        }

        /**
         * 작업장 현재 상태(투입/산출 재고 등) 조회
         */
        public WorkstationStatusResponse getWorkstationStatus(Long companyId, Long workstationId) {
                Workstation workstation = workstationRepository.findByCompanyIdAndId(companyId, workstationId)
                                .orElseThrow(() -> new IllegalArgumentException("작업장을 찾을 수 없습니다."));

                Company company = workstation.getCompany();
                Long inputItemId = company.getInputItemId();
                Long outputItemId = company.getOutputItemId();

                WorkstationStatusResponse.WorkstationStatusResponseBuilder builder = WorkstationStatusResponse.builder()
                                .workstationId(workstation.getId())
                                .level(workstation.getWorkstationLevel())
                                .isActive(workstation.getIsActive())
                                .reservedQuantity(workstation.getReservedQuantity())
                                .producedQuantity(workstation.getProducedQuantity());

                // 결과물 정보 추가
                if (outputItemId != null) {
                        itemRepository.findById(outputItemId).ifPresent(item -> {
                                builder.outputItemId(item.getId())
                                                .outputItemName(item.getName())
                                                .outputQuantity(workstation.getProducedQuantity());
                        });
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
