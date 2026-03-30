package com.ssafy.ecosim.global.kafka.resolver;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MessageKeyResolverTest {

    private final MessageKeyResolver keyResolver = new MessageKeyResolver();

    @Test
    void fromCompanyId_shouldReturnStringKey() {
        assertThat(keyResolver.fromCompanyId(1001L)).isEqualTo("1001");
    }

    @Test
    void fromCompanyId_withNull_shouldReturnNull() {
        assertThat(keyResolver.fromCompanyId(null)).isNull();
    }

    @Test
    void normalize_blank_shouldReturnNull() {
        assertThat(keyResolver.normalize(" ")).isNull();
    }

    @Test
    void normalize_value_shouldReturnSameValue() {
        assertThat(keyResolver.normalize("1001")).isEqualTo("1001");
    }
}
