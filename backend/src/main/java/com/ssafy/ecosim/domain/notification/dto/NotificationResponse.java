package com.ssafy.ecosim.domain.notification.dto;

import com.ssafy.ecosim.domain.notification.entity.Notification;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "알림 응답")
public record NotificationResponse(
    @Schema(description = "알림 ID", example = "1") Long id,
    @Schema(description = "알림 메시지", example = "주문이 체결되었습니다.") String message,
    @Schema(description = "알림 타입", example = "TRADE") NotificationType type,
    @Schema(description = "읽음 여부", example = "false") Boolean isRead,
    @Schema(description = "생성 시각", example = "2026-03-19T11:00:00") LocalDateTime createdAt
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getMessage(),
            notification.getType(),
            notification.getIsRead(),
            notification.getCreatedAt()
        );
    }
}
