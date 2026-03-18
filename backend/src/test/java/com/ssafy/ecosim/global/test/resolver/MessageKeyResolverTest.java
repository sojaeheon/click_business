package com.ssafy.ecosim.global.kafka.resolver;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MessageKeyResolver 단위 테스트.
 *
 * companyId가 Kafka key로 문자열 변환되는지 검증한다.
 */
class MessageKeyResolverTest {

    private final MessageKeyResolver keyResolver = new MessageKeyResolver();

    @Test
    void shouldReturnCompanyIdAsString() {
        String key = keyResolver.resolve(1001L);
        assertThat(key).isEqualTo("1001");
    }
}