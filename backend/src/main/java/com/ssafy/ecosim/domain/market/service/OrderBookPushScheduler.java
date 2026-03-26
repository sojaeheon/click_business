package com.ssafy.ecosim.domain.market.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.ecosim.domain.market.dto.response.OrderBookResponseDto;
import com.ssafy.ecosim.domain.market.repository.redis.OrderBookManager;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 호가창 실시간 WebSocket Push 스케줄러
 *
 * <p>동작 방식:
 * <ol>
 *   <li>체결 시 {@link #markDirty(Integer)} 로 더티 플래그만 세운다 (Redis 접근 없음)</li>
 *   <li>300ms 스케줄러가 더티 아이템만 호가창을 새로 계산한다</li>
 *   <li>계산 결과를 Redis 스냅샷에 저장하고 WebSocket으로 브로드캐스트한다</li>
 * </ol>
 *
 * <p>구독 경로: {@code /topic/orderbook/{itemId}}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderBookPushScheduler {

    private static final List<Integer> ITEM_IDS = List.of(1, 2, 3);

    // itemId별 더티 플래그 — 체결이 일어났으면 true, push 완료 후 false
    private final Map<Integer, AtomicBoolean> dirtyFlags = new ConcurrentHashMap<>(Map.of(
            1, new AtomicBoolean(false),
            2, new AtomicBoolean(false),
            3, new AtomicBoolean(false)
    ));

    // 종료 플래그 — Spring 컨텍스트 종료 시 Redis 접근 차단
    private final AtomicBoolean stopping = new AtomicBoolean(false);

    private final OrderBookService orderBookService;
    private final OrderBookManager orderBookManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @PreDestroy
    public void onShutdown() {
        stopping.set(true);
    }

    /**
     * 체결 발생 시 해당 아이템의 더티 플래그를 세웁니다.
     * {@link MarketMatchingService#executeTrade} 에서 호출합니다.
     */
    public void markDirty(Integer itemId) {
        AtomicBoolean flag = dirtyFlags.get(itemId);
        if (flag != null) {
            flag.set(true);
        }
    }

    /**
     * 300ms마다 더티 아이템의 호가창을 계산하여 Redis 스냅샷 저장 + WebSocket 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 300)
    public void pushOrderBooks() {
        if (stopping.get()) return;

        for (Integer itemId : ITEM_IDS) {
            AtomicBoolean dirty = dirtyFlags.get(itemId);
            // compareAndSet(true, false): 더티면 false로 바꾸고 진입, 아니면 스킵
            if (dirty == null || !dirty.compareAndSet(true, false)) continue;

            try {
                // 항상 새로 계산 (스냅샷 우선 읽기 로직을 우회하는 내부 메서드 사용)
                OrderBookResponseDto dto = orderBookService.computeOrderBook(itemId);

                // Redis 스냅샷 저장 → REST API가 재계산 없이 반환 가능
                String json = objectMapper.writeValueAsString(dto);
                orderBookManager.saveSnapshot(itemId, json);

                // WebSocket 브로드캐스트
                messagingTemplate.convertAndSend("/topic/orderbook/" + itemId, dto);

            } catch (JsonProcessingException e) {
                log.error("[OrderBookPushScheduler] JSON 직렬화 실패 itemId={}", itemId, e);
            } catch (Exception e) {
                log.error("[OrderBookPushScheduler] 호가창 push 실패 itemId={}", itemId, e);
            }
        }
    }
}
