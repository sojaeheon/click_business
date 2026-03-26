package com.ssafy.ecosim.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@RequiredArgsConstructor
public class OAuth2GuestFilter extends OncePerRequestFilter {

    public static final String GUEST_ID_COOKIE = "GUEST_ID";
    private final JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String uri = request.getRequestURI();
        // OAuth2 인증 시작 요청(/oauth2/authorization/*)인 경우에만 체크
        if (uri.contains("/oauth2/authorization/")) {
            String token = resolveToken(request);
            if (token != null && tokenProvider.validateToken(token)) {
                Authentication auth = tokenProvider.getAuthentication(token);
                if (auth != null) {
                    // JWT의 subject(userId)를 쿠키에 저장 (세션 대용)
                    // SameSite=None + Secure 없이도 동일 도메인(localhost)이므로 Lax로 충분
                    Cookie guestCookie = new Cookie(GUEST_ID_COOKIE, auth.getName());
                    guestCookie.setPath("/");
                    guestCookie.setHttpOnly(true);
                    guestCookie.setMaxAge(60 * 10); // 10분간 유효
                    response.addCookie(guestCookie);
                    System.out.println("[OAuth2GuestFilter] GUEST_ID cookie set: " + auth.getName());
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        // 프론트가 ?link_token={JWT} 쿼리 파라미터로 전달하는 경우 우선 처리
        String linkToken = request.getParameter("link_token");
        if (StringUtils.hasText(linkToken)) {
            return linkToken;
        }
        // 기존 Authorization 헤더 방식도 유지
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
