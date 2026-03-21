package com.ssafy.ecosim.domain.item.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "item")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "item_id")
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ItemType type;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "max_stack_size", nullable = false)
    private Long maxStackSize;

    @Column(name = "worker_level")
    private Integer workerLevel; // 일꾼 아이템만 사용 (lv1~6), 나머지는 null

    @Builder
    public Item(String name, ItemType type, String description, Long maxStackSize, Integer workerLevel) {
        this.name = name;
        this.type = type;
        this.description = description;
        this.maxStackSize = maxStackSize;
        this.workerLevel = workerLevel;
    }
}
