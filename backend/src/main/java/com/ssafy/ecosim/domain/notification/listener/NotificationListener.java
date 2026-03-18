package com.ssafy.ecosim.domain.notification.listener;

import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationListener {

    private final NotificationService notificationService;

    @Async // 알림 처리는 비동기로 수행하여 메인 로직의 성능에 영향을 주지 않도록 함
    @EventListener
    public void handleNotificationEvent(NotificationEvent event) {
        notificationService.sendNotification(event);
    }
}
