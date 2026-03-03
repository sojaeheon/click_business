package com.ssafy.ecosim.domain.user.entity;

import com.ssafy.ecosim.global.common.BaseEntity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(length = 50, nullable = false)
    private String nickname;

    @Column(nullable = false)
    private Boolean isGuest = false;

    // Default constructor for JPA
    protected User() {
    }

    public User(String nickname, Boolean isGuest) {
        this.nickname = nickname;
        this.isGuest = isGuest;
    }

    public Long getId() {
        return id;
    }

    public String getNickname() {
        return nickname;
    }

    public Boolean getIsGuest() {
        return isGuest;
    }
}
