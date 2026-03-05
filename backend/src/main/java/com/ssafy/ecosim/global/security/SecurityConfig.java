package com.ssafy.ecosim.global.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider tokenProvider;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2AuthenticationSuccessHandler successHandler;

    public SecurityConfig(JwtTokenProvider tokenProvider,
            CustomOAuth2UserService customOAuth2UserService,
            OAuth2AuthenticationSuccessHandler successHandler) {
        this.tokenProvider = tokenProvider;
        this.customOAuth2UserService = customOAuth2UserService;
        this.successHandler = successHandler;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // CSRF 비활성화 (REST API이므로)
                .formLogin(AbstractHttpConfigurer::disable) // 기본 폼 로그인 비활성화
                .httpBasic(AbstractHttpConfigurer::disable) // 기본 HTTP Basic 인증 비활성화
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS) // JWT 사용을 위해 세션 생성 정책을 STATELESS로 설정
                                                                                // (Django의 SessionMiddleware와 다른 점)
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/h2-console/**", "/oauth2/**", "/login/**").permitAll() // 메인, H2 콘솔, 로그인
                                                                                                       // 경로는 허용
                        .anyRequest().authenticated() // 나머지는 인증 필요
                )
                .headers(headers -> headers.frameOptions(options -> options.disable())) // H2 콘솔 프레임 허용
                .addFilterBefore(new JwtAuthenticationFilter(tokenProvider), UsernamePasswordAuthenticationFilter.class)
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(info -> info.userService(customOAuth2UserService))
                        .successHandler(successHandler));

        return http.build();
    }
}
