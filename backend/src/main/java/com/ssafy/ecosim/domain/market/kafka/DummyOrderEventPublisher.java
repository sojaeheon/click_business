package com.ssafy.ecosim.domain.market.kafka;

import org.springframework.stereotype.Component;
import com.ssafy.ecosim.domain.market.dto.event.OrderCreationEventDto;
import com.ssafy.ecosim.domain.market.dto.event.TradeEventDto;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.repository.MarketOrderRepository;
import com.ssafy.ecosim.domain.market.repository.redis.OrderDetailsCacheManager;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import lombok.RequiredArgsConstructor;

/**
 * 카프카 인프라가 준비되기 전까지 사용하는 가짜(Dummy) 이벤트 발행기입니다.
 * 현재 프론트/DE팀 연동 전 **임시 테스트용**으로, 
 * 이벤트가 발생하면 즉시 DB와 Redis에 데이터를 강제로 적재(Save)해 줍니다!
 */
@Component
@RequiredArgsConstructor
public class DummyOrderEventPublisher implements OrderEventPublisher {

    private final MarketOrderRepository marketOrderRepository;
    private final OrderDetailsCacheManager orderDetailsCacheManager;
    private final OrderBookManager orderBookManager;

    @Override
    public void publishTradeEvent(TradeEventDto event) {
        System.out.println("=========================================");
        System.out.println("[KAFKA DUMMY] Trade event generated!!!");
        System.out.printf("[KAFKA DUMMY] Details: Maker Order ID %d <-> Taker Order ID %d\n", event.getMakerOrderId(), event.getTakerOrderId());
        System.out.printf("[KAFKA DUMMY] Price: %d, Quantity: %d\n", event.getMatchedPrice(), event.getMatchedQuantity());
        System.out.println("=========================================");
    }

    @Override
    public void publishOrderEvent(OrderCreationEventDto event) {
        String userType = event.getIsVirtual() ? "[Virtual Bot]" : "[Real User]";
        System.out.println("-----------------------------------------");
        System.out.printf("[KAFKA DUMMY] New order event received -> Executing temporary DB & Redis load! (By: %s)\n", userType);
        
        // 1. 임시 DB 적재 (원래는 DE팀 파이프라인이 할 일)
        MarketOrder entity = MarketOrder.builder()
                .itemId(event.getItemId())
                .companyId(event.getCompanyId())
                .orderType(event.getOrderType())
                .price(event.getPrice())
                .totalQuantity(event.getTotalQuantity())
                .isVirtual(event.getIsVirtual())
                .build();
        marketOrderRepository.save(entity);

        // 2. 임시 Redis Hash 적재 (주문 상세 정보)
        orderDetailsCacheManager.saveOrderCache(entity);

        // 3. 임시 Redis ZSet 적재 (호가창 우선순위 등록)
        // 임시 Score 계산: (가격) + (시간 역순 가중치) -> 정밀한 로직은 추후 매칭 엔진이 구현
        double timeWeight = 1.0 - (System.currentTimeMillis() % 1000000) / 1000000.0;
        double score = event.getPrice() + timeWeight; 

        if ("BUY".equals(event.getOrderType().name())) {
            orderBookManager.addBid(event.getItemId(), entity.getId(), score);
        } else {
            orderBookManager.addAsk(event.getItemId(), entity.getId(), score);
        }

        System.out.printf("[KAFKA DUMMY] DB/Redis load complete: %s Price: %d, Qty: %d (Item: %d)\n", 
            event.getOrderType().name(), event.getPrice(), event.getTotalQuantity(), event.getItemId());
        System.out.println("-----------------------------------------");
    }
}
