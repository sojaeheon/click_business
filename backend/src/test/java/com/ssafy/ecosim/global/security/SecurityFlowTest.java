package com.ssafy.ecosim.global.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class SecurityFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private com.ssafy.ecosim.domain.user.repository.UserRepository userRepository;

    @Test
    @DisplayName("회원가입 API는 인증 없이 접근 가능해야 한다")
    public void signupApiIsPublic() throws Exception {
        String randomId = java.util.UUID.randomUUID().toString();
        mockMvc.perform(post("/api/v1/users/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format(
                        "{\"provider\": \"GOOGLE\", \"providerUserId\": \"%s\", \"email\": \"%s@test.com\"}", randomId,
                        randomId)))
                .andExpect(unauthenticated())
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("인증 없이 보호된 자원에 접근하면 401 Unauthorized를 반환한다")
    void profileAccessUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized()); // 302가 아닌 401 확인
    }

    @Test
    @DisplayName("유효한 JWT 토큰을 제공하면 내 정보를 성공적으로 조회한다")
    void profileAccessAuthenticatedWithToken() throws Exception {
        // 1. 실제 DB에 유저 저장
        com.ssafy.ecosim.domain.user.entity.User user = new com.ssafy.ecosim.domain.user.entity.User(false);
        userRepository.save(user);
        Long savedId = user.getId();

        // 2. 해당 유저 ID로 토큰 생성
        String token = tokenProvider.createToken(savedId, "test@test.com");

        // 3. 요청 및 검증 (200 OK가 나오면 인증 성공을 의미함)
        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
