package com.ssafy.ecosim.global.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    /**
     * Spring Boot 부품통(ApplicationContext)에 ObjectMapper를 미리 하나 만들어 둡니다.
     * Java 8 날짜 시간 모듈을 등록하여 createdAt, updatedAt 등이 정상 직렬화되도록 합니다.
     */
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS); // 날짜를 배열이 아닌 문자열 형태(ISO-8601)로 저장
        return mapper;
    }
}
