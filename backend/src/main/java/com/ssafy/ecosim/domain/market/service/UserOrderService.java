package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.market.dto.event.OrderCancellationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.repository.MarketOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserOrderService {

    private final OrderEventPublisher eventPublisher;
    private final CompanyRepository companyRepository;
    private final MarketOrderRepository marketOrderRepository;

    /**
     * 3. 체결 서버(Kafka)에 주문 이벤트 발행 (UserOrderService.create)
     * → market.events 토픽 발행 (eventType: market.order.created)
     */
    public void createOrder(Long userId, UserOrderRequestDto request) {

        // 1. userId → companyId DB 조회 (User FK 경로 사용)
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다. userId=" + userId));
        Long companyId = company.getId();

        // 2. 유효성 검증 로직 (보유 자산 체크)
        validateOrderPossibility(company, request);

        // 3. 통합 이벤트 DTO 생성 (실제 유저의 요청이므로 isVirtual = false)
        OrderCreationEventDto eventDto = OrderCreationEventDto.builder()
                .itemId(request.getItemId())
                .companyId(companyId)
                .orderType(request.getOrderType())
                .price(request.getPrice())
                .totalQuantity(request.getTotalQuantity())
                .isVirtual(false)
                .timestamp(System.currentTimeMillis())
                .build();

        // Kafka 토픽으로 전송
        eventPublisher.publishOrderEvent(eventDto);
    }

    /**
     * 2. 체결 서버(Kafka)에 취소 이벤트 발행 (UserOrderService.cancel)
     * → market.events 토픽 발행 (eventType: market.order.cancelled)
     */
    @Transactional
    public void cancelOrder(Long userId, Long orderId) {

        // 1. 주문 조회
        MarketOrder order = marketOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 주문입니다. orderId=" + orderId));

        // 2. 권한 확인: 해당 주문이 이 유저 회사의 주문인지 검증
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다. userId=" + userId));

        if (!order.getCompanyId().equals(company.getId())) {
            throw new IllegalStateException("본인 회사의 주문만 취소할 수 있습니다.");
        }

        // 3. 주문 상태를 CANCELED로 변경 (entity 비즈니스 로직 사용)
        order.cancelOrder();

        // 4. 취소 이벤트 DTO 생성 및 Kafka 발행
        OrderCancellationEventDto eventDto = OrderCancellationEventDto.builder()
                .orderId(order.getId())
                .itemId(order.getItemId())
                .companyId(company.getId())
                .orderType(order.getOrderType())
                .price(order.getPrice().intValue())
                .quantity(order.getRemainingQuantity().intValue())
                .isVirtual(order.getIsVirtual())
                .timestamp(System.currentTimeMillis())
                .build();

        eventPublisher.publishOrderCancelledEvent(eventDto);
    }

    /**
     * 유저가 매수/매도 주문을 넣을 자격(돈/아이템 보유량)이 있는지 검증합니다.
     */
    private void validateOrderPossibility(Company company, UserOrderRequestDto request) {
        switch (request.getOrderType()) {
            case BUY:
                // 매수의 경우: 회사 잔고(Cash) >= (price * quantity) 인지 확인
                // TODO: company.getCash() < request.getPrice() * request.getTotalQuantity()
                // throw new InsufficientBalanceException();
                break;

            case SELL:
                // 매도의 경우: 유저가 속한 회사의 인벤토리에 해당 아이템 잔량이 충분한지 확인
                // TODO: Inventory 레포지토리에서 물품 수량 조회하여 비교
                // throw new InsufficientItemException();
                break;
        }
    }
}
