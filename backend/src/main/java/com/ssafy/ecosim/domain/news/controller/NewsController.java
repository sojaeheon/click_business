package com.ssafy.ecosim.domain.news.controller;

import com.ssafy.ecosim.domain.news.dto.response.NewsResponseDto;
import com.ssafy.ecosim.domain.news.service.NewsService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "News", description = "뉴스 관련 API")
@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @Operation(summary = "발행된 뉴스 목록 조회", description = "현재 게임 진행 시간에 따라 발행된 내부 및 외부 뉴스를 최신순으로 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<NewsResponseDto>>> getNews() {
        List<NewsResponseDto> newsList = newsService.getPublishedNews();
        return ResponseEntity.ok(ApiResponse.success(newsList));
    }
}
