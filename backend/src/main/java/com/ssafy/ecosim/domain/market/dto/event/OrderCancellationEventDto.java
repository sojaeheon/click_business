package com.ssafy.ecosim.domain.market.dto.event;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.Builder;
import lombok.Getter;

/**
 * 유저가 주문 취소를 요청했을 때 Kafka market.events 토픽으로
 * 전달하기 위한 내부 이벤트 DTO입니다.
 */
@Getter
@Builder
public class OrderCancellationEventDto {
    private Long orderId;
    private Integer itemId;
    private Long companyId;
    private OrderType orderType;
    private Integer price;
    private Integer quantity;
    private Boolean isVirtual;
    private Long timestamp;
}
