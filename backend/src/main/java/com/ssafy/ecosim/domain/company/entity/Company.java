package com.ssafy.ecosim.domain.company.entity;

import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.global.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "company")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Company extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "company_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "input_item_id")
    private Long inputItemId;

    @Column(name = "output_item_id")
    private Long outputItemId;

    public Company(User user, String name, Long inputItemId, Long outputItemId) {
        this.user = user;
        this.name = name;
        this.inputItemId = inputItemId;
        this.outputItemId = outputItemId;
    }
}
