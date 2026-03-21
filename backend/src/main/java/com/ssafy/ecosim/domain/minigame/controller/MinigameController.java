package com.ssafy.ecosim.domain.minigame.controller;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.minigame.dto.MinigameClaimResponse;
import com.ssafy.ecosim.domain.minigame.service.MinigameService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "미니게임", description = "미니게임 보상 수령")
@RestController
@RequestMapping("/api/v1/minigame")
@RequiredArgsConstructor
public class MinigameController {

    private final MinigameService minigameService;
    private final CompanyRepository companyRepository;

    @Operation(
            summary = "미니게임 보상 수령",
            description = "미니게임 클리어 후 호출합니다. 서버에서 가중치 확률로 보상 아이템을 결정하고 인벤토리에 저장합니다."
    )
    @PostMapping("/claim")
    public ApiResponse<MinigameClaimResponse> claimReward(
            @AuthenticationPrincipal UserDetails userDetails) {
        Company company = getCompany(userDetails);
        MinigameClaimResponse response = minigameService.claimReward(company.getId());
        return ApiResponse.success(response);
    }

    private Company getCompany(UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("기업을 찾을 수 없습니다."));
    }
}
