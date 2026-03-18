package com.ssafy.ecosim.domain.notification.entity;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.global.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "notifications")
public class Notification extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private Boolean isRead;

    @Builder
    public Notification(User user, String message, NotificationType type) {
        this.user = user;
        this.message = message;
        this.type = type;
        this.isRead = false;
    }

    public void read() {
        this.isRead = true;
    }
}
