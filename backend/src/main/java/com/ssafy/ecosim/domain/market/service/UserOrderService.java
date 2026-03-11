package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserOrderService {

    private final OrderEventPublisher eventPublisher;

    /**
     * 프론트엔드에서 유저가 요청하는 실제 주문을 받아 검증하고 카프카로 발행합니다.
     */
    public void createOrder(Long userId, Long companyId, UserOrderRequestDto request) {
        
        // 1. 유효성 검증 로직 (보유 자산 체크)
        // TODO: 향후 User, Company, Inventory 도메인 Repository 주입 후 실제 DB 조회 로직으로 교체
        validateOrderPossibility(userId, companyId, request);

        // 2. 통합 이벤트 DTO 생성 (실제 유저의 요청이므로 isVirtual = false)
        OrderCreationEventDto eventDto = OrderCreationEventDto.builder()
                .itemId(request.getItemId())
                .companyId(companyId) // 유저가 소속된 회사 ID (Security Context나 DB에서 조회된 값)
                .orderType(request.getOrderType())
                .price(request.getPrice())
                .totalQuantity(request.getTotalQuantity())
                .isVirtual(false)
                .timestamp(System.currentTimeMillis())
                .build();

        // Kafka 토픽으로 전송 (현재는 DummyPublisher가 로그 출력)
        eventPublisher.publishOrderEvent(eventDto);
    }

    /**
     * 유저가 매수/매도 주문을 넣을 자격(돈/아이템 보유량)이 있는지 검증합니다.
     */
    private void validateOrderPossibility(Long userId, Long companyId, UserOrderRequestDto request) {
        switch (request.getOrderType()) {
            case BUY:
                // 매수의 경우: 회사 잔고(Cash) >= (price * quantity) 인지 확인
                // TODO: Company entity 에서 회사 캐시 조회하여 비교
                long totalOrderPrice = request.getPrice() * request.getTotalQuantity();
                // if (company.getCash() < totalOrderPrice) throw new InsufficientBalanceException();
                break;
                
            case SELL:
                // 매도의 경우: 유저가 속한 회사의 인벤토리에 해당 아이템 잔량이 충분한지 확인
                // TODO: Inventory 레포지토리에서 물품 수량 조회하여 비교
                long requiredItemCount = request.getTotalQuantity();
                // if (inventory.getQuantity(request.getItemId()) < requiredItemCount) throw new InsufficientItemException();
                break;
        }
    }
}
