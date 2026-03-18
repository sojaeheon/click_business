package com.ssafy.ecosim.domain.notification.service;

import com.ssafy.ecosim.domain.notification.dto.NotificationEvent;
import com.ssafy.ecosim.domain.notification.dto.NotificationResponse;
import com.ssafy.ecosim.domain.notification.entity.Notification;
import com.ssafy.ecosim.domain.notification.repository.NotificationRepository;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 알림 생성 및 발송
     */
    @Transactional
    public void sendNotification(NotificationEvent event) {
        User user = userRepository.findById(event.userId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Notification notification = Notification.builder()
                .user(user)
                .message(event.message())
                .type(event.type())
                .build();

        notificationRepository.save(notification);

        // 실시간 웹소켓 전송
        // 구독 경로: /user/queue/notifications
        messagingTemplate.convertAndSendToUser(
                user.getId().toString(),
                "/queue/notifications",
                NotificationResponse.from(notification)
        );

        log.debug("Notification sent to user {}: {}", user.getId(), event.message());
    }

    /**
     * 유저별 알림 목록 조회
     */
    public List<NotificationResponse> getNotifications(Long userId) {
        return notificationRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    /**
     * 알림 읽음 처리
     */
    @Transactional
    public void readNotification(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 알림입니다."));
        notification.read();
    }

    /**
     * 모든 알림 읽음 처리
     */
    @Transactional
    public void readAllNotifications(Long userId) {
        notificationRepository.markAllAsReadByUserId(userId);
    }

    /**
     * 알림 삭제
     */
    @Transactional
    public void deleteNotification(Long notificationId) {
        notificationRepository.deleteById(notificationId);
    }
}
