package com.ssafy.ecosim.domain.inventory.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.dto.response.InventorySlotResponse;
import com.ssafy.ecosim.domain.inventory.entity.CompanyInventory;
import com.ssafy.ecosim.domain.inventory.entity.InventorySlot;
import com.ssafy.ecosim.domain.inventory.repository.CompanyInventoryRepository;
import com.ssafy.ecosim.domain.inventory.repository.InventorySlotRepository;
import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private CompanyInventoryRepository companyInventoryRepository;

    @Mock
    private InventorySlotRepository inventorySlotRepository;

    @Mock
    private ItemRepository itemRepository;

    @InjectMocks
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(inventoryService, "initialSlotCount", 20);
        ReflectionTestUtils.setField(inventoryService, "maxStackSize", 100L);
        ReflectionTestUtils.setField(inventoryService, "expandSlotAmount", 5);
        ReflectionTestUtils.setField(inventoryService, "maxExpandableLimit", 100);
    }

    @Test
    @DisplayName("기업 생성 시 기본 창고가 성공적으로 지급된다")
    void createDefaultInventory_Success() {
        // given
        Company company = mock(Company.class);
        when(companyInventoryRepository.save(any(CompanyInventory.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // when
        CompanyInventory inventory = inventoryService.createDefaultInventory(company);

        // then
        assertThat(inventory.getMaxSlot()).isEqualTo(20);
        verify(inventorySlotRepository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("아이템 추가 로직 검증 - 빈 슬롯에 새로 추가")
    void addItem_ToEmptySlot() {
        // given
        Company company = mock(Company.class);
        CompanyInventory inventory = new CompanyInventory(company, 20);
        List<InventorySlot> slots = new ArrayList<>();
        slots.add(new InventorySlot(inventory, 0)); // 빈 슬롯
        slots.add(new InventorySlot(inventory, 1)); // 빈 슬롯
        ReflectionTestUtils.setField(inventory, "slots", slots);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).build();

        when(companyInventoryRepository.findByCompanyId(1L)).thenReturn(Optional.of(inventory));
        when(itemRepository.findById(10L)).thenReturn(Optional.of(item));

        // when
        inventoryService.addItem(1L, 10L, 50L);

        // then
        assertThat(slots.get(0).getItem()).isEqualTo(item);
        assertThat(slots.get(0).getQuantity()).isEqualTo(50L);
        assertThat(slots.get(1).getItem()).isNull(); // 두 번째 슬롯은 비어있어야 함
    }

    @Test
    @DisplayName("아이템 추가 로직 검증 - 최대 스택 초과 시 슬롯 분할")
    void addItem_ExceedMaxStack_SplitSlots() {
        // given
        Company company = mock(Company.class);
        CompanyInventory inventory = new CompanyInventory(company, 20);
        List<InventorySlot> slots = new ArrayList<>();
        InventorySlot slot0 = new InventorySlot(inventory, 0);
        InventorySlot slot1 = new InventorySlot(inventory, 1);
        slots.add(slot0);
        slots.add(slot1);
        ReflectionTestUtils.setField(inventory, "slots", slots);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).build();
        // ID 부여를 위해 Reflection 사용 (Mock 대신 실제 엔티티에 ID 세팅)
        ReflectionTestUtils.setField(item, "id", 10L);

        // 0번 슬롯에 이미 80개가 있음
        slot0.addItem(item, 80L);

        when(companyInventoryRepository.findByCompanyId(1L)).thenReturn(Optional.of(inventory));
        when(itemRepository.findById(10L)).thenReturn(Optional.of(item));

        // when
        inventoryService.addItem(1L, 10L, 30L); // 30개 추가 (0번 20개 채우고, 1번에 10개)

        // then
        assertThat(slot0.getQuantity()).isEqualTo(100L); // maxStackSize
        assertThat(slot1.getItem()).isEqualTo(item);
        assertThat(slot1.getQuantity()).isEqualTo(10L);
    }
}
