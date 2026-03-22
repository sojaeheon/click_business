package com.ssafy.ecosim.domain.feedback.controller;

import com.ssafy.ecosim.domain.feedback.dto.request.FeedbackRequest;
import com.ssafy.ecosim.domain.feedback.service.FeedbackService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@Tag(name = "피드백", description = "버그 제보 및 개선 사항 제출")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;

    @Operation(summary = "피드백 제출", description = "버그 제보, 개선 사항, 문의 등을 제출합니다.")
    @PostMapping
    public ApiResponse<String> submitFeedback(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody FeedbackRequest request) {

        Long userId = Long.parseLong(userDetails.getUsername());
        feedbackService.submitFeedback(userId, request.getCategory(), request.getContent());

        return ApiResponse.success("피드백이 접수되었습니다. 감사합니다!");
    }
}
