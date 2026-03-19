package com.ssafy.ecosim.global.kafka.resolver;

import org.springframework.stereotype.Component;

/**
 * Kafka message key(partition_key) 보조 유틸.
 *
 * 역할:
 * - partitionKey 정규화
 * - 필요 시 ID 타입별 key 생성 헬퍼 제공
 */
@Component
public class MessageKeyResolver {

    /**
     * partition_key 정규화.
     * - null/blank는 null로 통일해 Kafka 기본 파티셔닝 사용
     */
    public String normalize(String partitionKey) {
        if (partitionKey == null || partitionKey.isBlank()) {
            return null;
        }
        return partitionKey;
    }

    /** company_id 기반 key 생성 헬퍼 */
    public String fromCompanyId(Long companyId) {
        return companyId == null ? null : String.valueOf(companyId);
    }

    /** item_id 기반 key 생성 헬퍼 */
    public String fromItemId(Integer itemId) {
        return itemId == null ? null : String.valueOf(itemId);
    }
}
