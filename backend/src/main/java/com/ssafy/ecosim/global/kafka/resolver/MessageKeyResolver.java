package com.ssafy.ecosim.global.kafka.resolver;

import org.springframework.stereotype.Component;

/**
 * Kafka 메시지 key를 결정하는 Resolver.
 *
 * 현재 창고 이벤트는 회사 단위로 파티셔닝하는 것이 자연스러우므로
 * companyId를 문자열로 변환해 key로 사용한다.
 */
@Component
public class MessageKeyResolver {

    /**
     * Kafka 메시지 key를 반환한다.
     *
     * @param companyId 회사 ID
     * @return Kafka partition key
     */
    public String resolve(Long companyId) {
        return String.valueOf(companyId);
    }
}