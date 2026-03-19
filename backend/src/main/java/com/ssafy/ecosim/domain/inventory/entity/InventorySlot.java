package com.ssafy.ecosim.domain.inventory.entity;

import com.ssafy.ecosim.domain.item.entity.Item;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "inventory_slot", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"inventory_id", "slot_index"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InventorySlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "slot_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_id", nullable = false)
    private Inventory inventory;

    @Column(name = "slot_index", nullable = false)
    private Integer slotIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id")
    private Item item;

    @Column(nullable = false)
    private Long quantity = 0L;

    public InventorySlot(Inventory inventory, Integer slotIndex) {
        this.inventory = inventory;
        this.slotIndex = slotIndex;
        this.item = null;
        this.quantity = 0L;
    }

    public void addItem(Item item, Long amount) {
        this.item = item;
        this.quantity += amount;
    }

    public void clearSlot() {
        this.item = null;
        this.quantity = 0L;
    }

    public void setItemAndQuantity(Item item, Long quantity) {
        this.item = item;
        this.quantity = quantity;
    }
}
