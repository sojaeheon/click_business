-- Flyway Migration V8: 인벤토리 테이블 생성 (EQUIPMENT/TICKET 전용)

CREATE TABLE inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    company_id   BIGINT NOT NULL UNIQUE,
    max_slot     INT    NOT NULL,
    CONSTRAINT fk_inventory_company FOREIGN KEY (company_id) REFERENCES company(company_id)
);

CREATE TABLE inventory_slot (
    slot_id      BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL,
    slot_index   INT    NOT NULL,
    item_id      BIGINT,
    quantity     BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_inventory_slot_inventory FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id),
    CONSTRAINT fk_inventory_slot_item      FOREIGN KEY (item_id)      REFERENCES item(item_id),
    CONSTRAINT uq_inventory_slot           UNIQUE (inventory_id, slot_index)
);
