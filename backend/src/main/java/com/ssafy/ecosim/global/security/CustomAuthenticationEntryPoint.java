package com.ssafy.ecosim.global.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException, ServletException {

        // 인증 실패 시 JSON 응답을 반환합니다.
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        // Spring Boot 4 (Jackson 3) 환경에서의 패키지 변화(tools.jackson) 및 의존성 안정성을 위해
        // Security 필터 계층에서는 수동으로 JSON 문자열을 생성하여 반환합니다.
        String jsonResponse = "{\"success\":false,\"message\":\"인증에 실패했습니다. 토큰이 만료되었거나 유효하지 않습니다.\",\"data\":null}";

        response.getWriter().write(jsonResponse);
    }
}
