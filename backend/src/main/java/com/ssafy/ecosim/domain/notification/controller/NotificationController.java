package com.ssafy.ecosim.domain.notification.controller;

import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.dto.NotificationResponse;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;
import com.ssafy.ecosim.domain.notification.service.NotificationService;
import com.ssafy.ecosim.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "알림", description = "알림 조회, 읽음 처리, 삭제")
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "내 알림 목록 조회", description = "현재 로그인한 유저의 알림 목록을 반환합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getMyNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        List<NotificationResponse> response = notificationService.getNotifications(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "알림 읽음 처리", description = "특정 알림을 읽음 상태로 변경합니다.")
    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> readNotification(
            @Parameter(description = "읽음 처리할 알림 ID", example = "1") @PathVariable("id") Long id) {
        notificationService.readNotification(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "모든 알림 읽음 처리", description = "현재 로그인한 유저의 모든 알림을 읽음 상태로 변경합니다.")
    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> readAllNotifications(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        notificationService.readAllNotifications(userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "알림 삭제", description = "특정 알림을 삭제합니다.")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNotification(
            @Parameter(description = "삭제할 알림 ID", example = "1") @PathVariable("id") Long id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Operation(summary = "[개발용] 테스트 알림 발송", description = "WebSocket 실시간 알림 연동 확인용 테스트 알림을 발송합니다.")
    @PostMapping("/test")
    public ResponseEntity<ApiResponse<Void>> sendTestNotification(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = Long.parseLong(userDetails.getUsername());
        notificationService.sendNotification(new NotificationEvent(
                userId,
                "실시간 알림 테스트 메시지입니다! (" + LocalDateTime.now() + ")",
                NotificationType.SYSTEM
        ));
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
