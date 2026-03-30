package com.ssafy.ecosim.domain.news.service;

import com.ssafy.ecosim.domain.news.dto.response.NewsResponseDto;
import com.ssafy.ecosim.domain.news.repository.ExternalNewsRepository;
import com.ssafy.ecosim.domain.news.repository.InternalNewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NewsService {

    private final InternalNewsRepository internalNewsRepository;
    private final ExternalNewsRepository externalNewsRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * 현재 게임 날짜 기준으로 발행된 모든 뉴스(내부/외부)를 통합하여 최신순으로 반환합니다.
     */
    public List<NewsResponseDto> getPublishedNews() {
        // 1. Redis에서 현재 게임 날짜 조회
        LocalDateTime currentGameDateTime = getCurrentGameDateTime();
        
        // 2. 발행 날짜가 현재 게임 시각 이전인 뉴스 조회
        List<NewsResponseDto> internalNews = internalNewsRepository.findAllByPublishedAtBeforeOrderByPublishedAtDesc(currentGameDateTime)
                .stream()
                .map(news -> NewsResponseDto.builder()
                        .id(news.getId())
                        .title(news.getTitle())
                        .content(news.getContent())
                        .type("INTERNAL")
                        .publishedAt(news.getPublishedAt())
                        .build())
                .collect(Collectors.toList());

        List<NewsResponseDto> externalNews = externalNewsRepository.findAllByPublishedAtBeforeOrderByPublishedAtDesc(currentGameDateTime)
                .stream()
                .map(news -> NewsResponseDto.builder()
                        .id(news.getId())
                        .title(news.getTitle())
                        .content(news.getContent())
                        .type("EXTERNAL")
                        .publishedAt(news.getPublishedAt())
                        .build())
                .collect(Collectors.toList());

        // 3. 통합 및 정렬 (최신순)
        List<NewsResponseDto> allNews = new ArrayList<>();
        allNews.addAll(internalNews);
        allNews.addAll(externalNews);
        
        allNews.sort(Comparator.comparing(NewsResponseDto::getPublishedAt).reversed());

        return allNews;
    }

    /**
     * Redis에서 현재 게임 시뮬레이션 날짜를 가져와서 하루 뒤의 날짜 끝 시간(23:59:59)으로 반환합니다.
     * DB에 저장된 날짜보다 게임 내 하루(10분) 앞당겨 뉴스를 발행합니다.
     * 게임 시계가 초기화되지 않은 경우 예외를 발생시킵니다.
     */
    private LocalDateTime getCurrentGameDateTime() {
        Object dateObj = redisTemplate.opsForValue().get("game:simulation:date");
        
        if (dateObj == null) {
            log.error("[NewsService] 게임 시계가 초기화되지 않았습니다. (game:simulation:date 키 없음)");
            // 기본값으로 현재 날짜 자정 반환 (시뮬레이션 시작 전에는 뉴스 없음)
            return LocalDate.now().atStartOfDay();
        }
        
        try {
            LocalDate gameDate = LocalDate.parse(dateObj.toString());
            // 이틀 뒤의 뉴스까지 미리 보여주기 위해 +2일 추가
            // 예: 게임 날짜가 2024-03-21이면 2024-03-23 00:00:00 뉴스까지 노출
            // (데이터팀은 published_at을 해당 날짜의 00:00:00으로 입력)
            LocalDate adjustedDate = gameDate.plusDays(2);
            return adjustedDate.atTime(LocalTime.MAX);
        } catch (Exception e) {
            log.error("[NewsService] Redis game:simulation:date 파싱 실패: {}", dateObj, e);
            return LocalDate.now().atStartOfDay();
        }
    }
}
