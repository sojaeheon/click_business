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

    @Builder
    public Item(String name, ItemType type, String description, Long maxStackSize) {
        this.name = name;
        this.type = type;
        this.description = description;
        this.maxStackSize = maxStackSize;
    }
}
