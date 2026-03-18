package com.ssafy.ecosim.domain.notification.dto;

import com.ssafy.ecosim.domain.notification.entity.NotificationType;

public record NotificationEvent(
    Long userId,
    String message,
    NotificationType type
) {
}
