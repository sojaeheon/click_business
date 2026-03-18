package com.ssafy.ecosim.global.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Value("${cors.allowed-origins}")
        private String allowedOrigins;
        private final JwtTokenProvider tokenProvider;
        private final CustomOAuth2UserService customOAuth2UserService;
        private final OAuth2AuthenticationSuccessHandler successHandler;
        private final CustomAuthenticationEntryPoint customAuthenticationEntryPoint;

        public SecurityConfig(JwtTokenProvider tokenProvider,
                        CustomOAuth2UserService customOAuth2UserService,
                        OAuth2AuthenticationSuccessHandler successHandler,
                        CustomAuthenticationEntryPoint customAuthenticationEntryPoint) {
                this.tokenProvider = tokenProvider;
                this.customOAuth2UserService = customOAuth2UserService;
                this.successHandler = successHandler;
                this.customAuthenticationEntryPoint = customAuthenticationEntryPoint;
        }

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .csrf(AbstractHttpConfigurer::disable) // CSRF 비활성화 (REST API이므로)
                                .formLogin(AbstractHttpConfigurer::disable) // 기본 폼 로그인 비활성화
                                .httpBasic(AbstractHttpConfigurer::disable) // 기본 HTTP Basic 인증 비활성화
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS) // JWT 사용을 위해 세션
                                                                                                        // 생성 정책을
                                                                                                        // STATELESS로 설정
                                )
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers("/", "/h2-console/**", "/oauth2/**", "/login/**",
                                                                "/api/v1/users/signup",
                                                                "/api/v1/users/guest",
                                                                "/error",
                                                                "/actuator/**",
                                                                "/ws-ecosim/**"
                                                                )
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .headers(headers -> headers.frameOptions(options -> options.disable())) // H2 콘솔 프레임 허용
                                .addFilterBefore(new OAuth2GuestFilter(tokenProvider),
                                                OAuth2AuthorizationRequestRedirectFilter.class)
                                .addFilterBefore(new JwtAuthenticationFilter(tokenProvider),
                                                UsernamePasswordAuthenticationFilter.class)
                                .oauth2Login(oauth2 -> oauth2
                                                .userInfoEndpoint(info -> info.userService(customOAuth2UserService))
                                                .successHandler(successHandler))
                                .exceptionHandling(handler -> handler
                                                .authenticationEntryPoint(customAuthenticationEntryPoint));

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();
                config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
                config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", config);
                return source;
        }
}
