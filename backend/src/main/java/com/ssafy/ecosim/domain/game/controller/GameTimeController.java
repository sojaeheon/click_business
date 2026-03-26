package com.ssafy.ecosim.domain.game.controller;

import com.ssafy.ecosim.domain.game.dto.response.GameTimeResponse;
import com.ssafy.ecosim.domain.game.service.GameTimeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Game Time", description = "게임 시뮬레이션 시간 API")
@RestController
@RequestMapping("/api/game/time")
@RequiredArgsConstructor
public class GameTimeController {

    private final GameTimeService gameTimeService;

    @Operation(summary = "현재 게임 시뮬레이션 시간 조회", 
               description = "현재 게임 시뮬레이션의 년/월/일/시/분/초를 조회합니다.")
    @GetMapping("/current")
    public ResponseEntity<GameTimeResponse> getCurrentGameTime() {
        return ResponseEntity.ok(gameTimeService.getCurrentGameTime());
    }
}