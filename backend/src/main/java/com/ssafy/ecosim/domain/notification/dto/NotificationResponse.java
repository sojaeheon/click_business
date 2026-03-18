package com.ssafy.ecosim.domain.notification.dto;

import com.ssafy.ecosim.domain.notification.entity.Notification;
import com.ssafy.ecosim.domain.notification.entity.NotificationType;

import java.time.LocalDateTime;

public record NotificationResponse(
    Long id,
    String message,
    NotificationType type,
    Boolean isRead,
    LocalDateTime createdAt
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
