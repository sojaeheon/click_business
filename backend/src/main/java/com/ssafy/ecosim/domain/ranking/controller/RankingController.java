// backend/src/main/java/com/ssafy/ecosim/domain/ranking/controller/RankingController.java
package com.ssafy.ecosim.domain.ranking.controller;

import com.ssafy.ecosim.domain.ranking.dto.RankingPreviewResponse;
import com.ssafy.ecosim.domain.ranking.service.RankingService;
import com.ssafy.ecosim.global.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ranking")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping("/preview")
    public ApiResponse<List<RankingPreviewResponse>> getPreview(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(rankingService.getPreview(limit));
    }
}
