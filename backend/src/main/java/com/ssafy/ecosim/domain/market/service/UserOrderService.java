package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
import com.ssafy.ecosim.domain.market.dto.event.OrderCancellationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.dto.request.UserOrderRequestDto;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.kafka.OrderEventPublisher;
import com.ssafy.ecosim.domain.market.repository.MarketOrderRepository;
import com.ssafy.ecosim.global.kafka.publisher.CompanyCashEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class UserOrderService {

    private final OrderEventPublisher eventPublisher;
    private final CompanyRepository companyRepository;
    private final MarketOrderRepository marketOrderRepository;
    private final CompanyCashEventPublisher companyCashEventPublisher;
    private final WarehouseService warehouseService;

    /**
     * 주문 생성:
     * 1. 자산 보유량 검증
     * 2. 즉시 자산 차감 (BUY → cash, SELL → item)
     * 3. Kafka market.events 발행
     */
    @Transactional
    public void createOrder(Long userId, UserOrderRequestDto request) {

        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다. userId=" + userId));
        Long companyId = company.getId();
        long price = request.getPrice();
        long qty = request.getTotalQuantity();

        validateOrderPossibility(company, request);

        if (request.getOrderType() == OrderType.BUY) {
            long cost = price * qty;
            company.spendCash(cost);
            companyCashEventPublisher.publishCashChanged(
                    companyId, company.getCash(), -cost,
                    "MARKET_BUY_ORDER", null, Instant.now()
            );
        } else {
            // SELL: 창고에서 아이템 즉시 차감
            warehouseService.removeItem(companyId, (long) request.getItemId(), qty, "MARKET_SELL_ORDER");
        }

        OrderCreationEventDto eventDto = OrderCreationEventDto.builder()
                .itemId(request.getItemId())
                .companyId(companyId)
                .orderType(request.getOrderType())
                .price(request.getPrice())
                .totalQuantity(request.getTotalQuantity())
                .isVirtual(false)
                .timestamp(System.currentTimeMillis())
                .build();

        eventPublisher.publishOrderEvent(eventDto);
    }

    /**
     * 주문 취소:
     * 1. 권한 확인
     * 2. 차감했던 자산 복구 (BUY → cash 환불, SELL → item 반환)
     * 3. Kafka market.events 발행
     */
    @Transactional
    public void cancelOrder(Long userId, Long orderId) {

        MarketOrder order = marketOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 주문입니다. orderId=" + orderId));

        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다. userId=" + userId));

        if (!order.getCompanyId().equals(company.getId())) {
            throw new IllegalStateException("본인 회사의 주문만 취소할 수 있습니다.");
        }

        order.cancelOrder();

        long remaining = order.getRemainingQuantity();
        long price = order.getPrice();

        if (order.getOrderType() == OrderType.BUY) {
            long refund = price * remaining;
            company.receiveCash(refund);
            companyCashEventPublisher.publishCashChanged(
                    company.getId(), company.getCash(), refund,
                    "MARKET_BUY_CANCEL", orderId.toString(), Instant.now()
            );
        } else {
            // SELL 취소: 차감했던 아이템 복구
            warehouseService.addItem(company.getId(), (long) order.getItemId(), remaining, "MARKET_SELL_CANCEL");
        }

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
     * 주문 가능 여부 검증 (자산 체크)
     */
    private void validateOrderPossibility(Company company, UserOrderRequestDto request) {
        long price = request.getPrice();
        long qty = request.getTotalQuantity();

        switch (request.getOrderType()) {
            case BUY -> {
                long required = price * qty;
                if (company.getCash() < required) {
                    throw new IllegalStateException(
                            String.format("잔고가 부족합니다. 필요: %d, 보유: %d", required, company.getCash()));
                }
            }
            case SELL -> {
                long held = warehouseService.getItemQuantity(company.getId(), request.getItemId().longValue());
                if (held < qty) {
                    throw new IllegalStateException(
                            String.format("아이템 수량이 부족합니다. 필요: %d, 보유: %d", qty, held));
                }
            }
        }
    }

    /**
     * 특정 아이템에 대해 내 회사가 낸 미체결 주문 목록을 조회합니다.
     */
    public java.util.List<com.ssafy.ecosim.domain.market.dto.response.UserOrderResponseDto> getMyPendingOrders(Long userId, Integer itemId) {
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다. userId=" + userId));

        return marketOrderRepository.findByCompanyIdAndItemIdAndStatusInOrderByCreatedAtDesc(
                company.getId(),
                itemId,
                java.util.List.of(com.ssafy.ecosim.domain.market.entity.OrderStatus.PENDING, com.ssafy.ecosim.domain.market.entity.OrderStatus.PARTIALLY_COMPLETED)
        ).stream()
         .map(com.ssafy.ecosim.domain.market.dto.response.UserOrderResponseDto::new)
         .toList();
    }
}

