package com.ssafy.ecosim.domain.item.repository;

import com.ssafy.ecosim.domain.item.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
    boolean existsByName(String name);
}
