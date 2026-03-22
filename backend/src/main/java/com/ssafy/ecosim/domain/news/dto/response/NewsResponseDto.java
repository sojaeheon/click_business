package com.ssafy.ecosim.domain.news.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NewsResponseDto {
    private Long id;
    private String title;
    private String content;
    private String type; // "INTERNAL" or "EXTERNAL"
    private LocalDateTime publishedAt;
}
