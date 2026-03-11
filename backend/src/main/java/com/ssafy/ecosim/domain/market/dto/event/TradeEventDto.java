package com.ssafy.ecosim.domain.market.dto.event;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.Builder;
import lombok.Getter;

/**
 * 카프카 `trade-event` 토픽으로 전송할 체결 완료 데이터(영수증) DTO입니다.
 * 이 데이터는 DE팀의 파이프라인에서 소비되어 DB의 `trade_history` 테이블에 기록됩니다.
 */
@Getter
@Builder
public class TradeEventDto {
    private Long makerOrderId;  // 호가창에 먼저 등록되어 있던 사람의 주문 ID (maker)
    private Long takerOrderId;  // 방금 진입해서 체결을 낸 사람의 주문 ID (taker)
    
    private Integer itemId;     // 체결된 아이템 ID
    private OrderType makerOrderType; // 기존 주문자의 타입 (BUY/SELL)
    
    private Long matchedPrice;  // 체결 단가
    private Long matchedQuantity; // 체결 수량
    
    private Long timestamp;     // 체결 틱 시간
}
