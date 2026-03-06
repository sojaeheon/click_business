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

    @Column(nullable = false)
    private Boolean isGuest = false;

    // Default constructor for JPA
    protected User() {
    }

    public User(Boolean isGuest) {
        this.isGuest = isGuest;
    }

    public Long getId() {
        return id;
    }

    public Boolean getIsGuest() {
        return isGuest;
    }

    public void promoteFromGuest() {
        this.isGuest = false;
    }
}
