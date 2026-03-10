package com.ssafy.ecosim.domain.market.kafka;

import org.springframework.stereotype.Component;

/**
 * 카프카 인프라가 준비되기 전까지 사용하는 가짜(Dummy) 이벤트 발행기입니다.
 * 매칭 엔진 코드(Redis 연산부)에서 체결이 일어났을 때 이 클래스를 호출하여
 * 비동기 이벤트가 잘 흘러가는지 콘솔 로그로 눈으로 확인합니다.
 */
@Component
public class DummyMarketEventPublisher implements MarketEventPublisher {

    @Override
    public void publishTradeEvent(Long orderId) {
        // 나중에 DE팀이 Kafka 연동을 완료하면, 이 더미 클래스는 삭제하거나 @Profile("local")로 빼두고
        // 실제 KafkaTemplate을 주입받아 토픽으로 쏘는 진짜(Real) Publisher 구현체로 교체합니다.
        
        System.out.println("=========================================");
        System.out.println("[KAFKA DUMMY] 체결 이벤트 발생!!!");
        System.out.println("[KAFKA DUMMY] 관련 주문 ID: " + orderId);
        System.out.println("[KAFKA DUMMY] 이 메시지는 추후 실제 Kafka 토픽(예: trade-event)으로 전송될 예정입니다.");
        System.out.println("=========================================");
    }
}
