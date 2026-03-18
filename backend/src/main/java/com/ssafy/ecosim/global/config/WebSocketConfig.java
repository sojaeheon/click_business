package com.ssafy.ecosim.global.config;

import com.ssafy.ecosim.global.security.StompHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompHandler stompHandler;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 메시지 브로커가 처리할 경로 설정
        // /topic: 1:N 브로드캐스팅
        // /queue: 1:1 메시징
        config.enableSimpleBroker("/topic", "/queue");

        // 클라이언트에서 메시지를 보낼 때 붙이는 접두사 설정
        config.setApplicationDestinationPrefixes("/app");

        // 특정 사용자에게 메시지를 보낼 때 사용할 접두사 설정
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOrigins.split(",");

        // 웹소켓 연결 엔드포인트 설정
        registry.addEndpoint("/ws-ecosim")
                .setAllowedOriginPatterns(origins)
                .withSockJS(); // SockJS 지원 (웹소켓 미지원 브라우저 대응)

        registry.addEndpoint("/ws-ecosim")
                .setAllowedOriginPatterns(origins); // 일반 웹소켓 연결용
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // JWT 검증을 위한 인터셉터 등록
        registration.interceptors(stompHandler);
    }
}
