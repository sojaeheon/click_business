package com.ssafy.ecosim.domain.market.dto.event;

import com.ssafy.ecosim.domain.market.entity.OrderType;
import lombok.Builder;
import lombok.Getter;

/**
 * 프론트엔드 유저 요청 및 백엔드 봇이 생성한 신규 주문 데이터를
 * 통합하여 Kafka `order-event` 토픽으로 전송하기 위한 DTO입니다.
 */
@Getter
@Builder
public class OrderCreationEventDto {
    private Integer itemId;
    private Long companyId;
    private OrderType orderType;
    private Long price;
    private Long totalQuantity;
    private Boolean isVirtual;
    private Long timestamp;
}
