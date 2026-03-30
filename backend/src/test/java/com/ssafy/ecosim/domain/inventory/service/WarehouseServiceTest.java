package com.ssafy.ecosim.domain.inventory.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.inventory.entity.Warehouse;
import com.ssafy.ecosim.domain.inventory.entity.WarehouseSlot;
import com.ssafy.ecosim.domain.inventory.repository.WarehouseRepository;
import com.ssafy.ecosim.domain.inventory.repository.WarehouseSlotRepository;
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
class WarehouseServiceTest {

    @Mock
    private WarehouseRepository warehouseRepository;

    @Mock
    private WarehouseSlotRepository warehouseSlotRepository;

    @Mock
    private ItemRepository itemRepository;

    @InjectMocks
    private WarehouseService warehouseService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(warehouseService, "initialSlotCount", 20);
        ReflectionTestUtils.setField(warehouseService, "expandSlotAmount", 5);
        ReflectionTestUtils.setField(warehouseService, "maxExpandableLimit", 100);
    }

    @Test
    @DisplayName("기업 생성 시 기본 창고가 성공적으로 지급된다")
    void createDefaultWarehouse_Success() {
        // given
        Company company = mock(Company.class);
        when(warehouseRepository.save(any(Warehouse.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // when
        Warehouse warehouse = warehouseService.createDefaultWarehouse(company);

        // then
        assertThat(warehouse.getMaxSlot()).isEqualTo(20);
        verify(warehouseSlotRepository, times(1)).saveAll(anyList());
    }

    @Test
    @DisplayName("아이템 추가 로직 검증 - 빈 슬롯에 새로 추가")
    void addItem_ToEmptySlot() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        slots.add(new WarehouseSlot(warehouse, 0));
        slots.add(new WarehouseSlot(warehouse, 1));
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).maxStackSize(100L).build();

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));
        when(itemRepository.findById(10L)).thenReturn(Optional.of(item));

        // when
        warehouseService.addItem(1L, 10L, 50L);

        // then
        assertThat(slots.get(0).getItem()).isEqualTo(item);
        assertThat(slots.get(0).getQuantity()).isEqualTo(50L);
        assertThat(slots.get(1).getItem()).isNull();
    }

    @Test
    @DisplayName("아이템 추가 로직 검증 - 최대 스택 초과 시 슬롯 분할")
    void addItem_ExceedMaxStack_SplitSlots() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        WarehouseSlot slot0 = new WarehouseSlot(warehouse, 0);
        WarehouseSlot slot1 = new WarehouseSlot(warehouse, 1);
        slots.add(slot0);
        slots.add(slot1);
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).maxStackSize(100L).build();
        ReflectionTestUtils.setField(item, "id", 10L);
        slot0.addItem(item, 80L); // 0번 슬롯에 이미 80개

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));
        when(itemRepository.findById(10L)).thenReturn(Optional.of(item));

        // when
        warehouseService.addItem(1L, 10L, 30L); // 30개 추가 (0번 20개 채우고, 1번에 10개)

        // then
        assertThat(slot0.getQuantity()).isEqualTo(100L);
        assertThat(slot1.getItem()).isEqualTo(item);
        assertThat(slot1.getQuantity()).isEqualTo(10L);
    }

    @Test
    @DisplayName("특정 슬롯 수량 감소 - 일부 차감 후 남은 수량이 유지된다")
    void decreaseQuantity_Partial() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        WarehouseSlot slot = new WarehouseSlot(warehouse, 0);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).maxStackSize(100L).build();
        slot.addItem(item, 80L);
        slots.add(slot);
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));

        // when
        warehouseService.decreaseQuantity(1L, 0, 30L);

        // then
        assertThat(slot.getItem()).isEqualTo(item);
        assertThat(slot.getQuantity()).isEqualTo(50L);
    }

    @Test
    @DisplayName("특정 슬롯 수량 감소 - 전부 차감 시 슬롯이 비워진다")
    void decreaseQuantity_All_SlotCleared() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        WarehouseSlot slot = new WarehouseSlot(warehouse, 0);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).maxStackSize(100L).build();
        slot.addItem(item, 50L);
        slots.add(slot);
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));

        // when
        warehouseService.decreaseQuantity(1L, 0, 50L);

        // then
        assertThat(slot.getItem()).isNull();
        assertThat(slot.getQuantity()).isEqualTo(0L);
    }

    @Test
    @DisplayName("특정 슬롯 수량 감소 - 수량 부족 시 예외 발생")
    void decreaseQuantity_InsufficientQuantity_ThrowsException() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        WarehouseSlot slot = new WarehouseSlot(warehouse, 0);

        Item item = Item.builder().name("철광석").type(ItemType.MATERIAL).maxStackSize(100L).build();
        slot.addItem(item, 10L);
        slots.add(slot);
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));

        // when & then
        assertThrows(IllegalStateException.class,
                () -> warehouseService.decreaseQuantity(1L, 0, 99L));
    }

    @Test
    @DisplayName("특정 슬롯 수량 감소 - 빈 슬롯 차감 시 예외 발생")
    void decreaseQuantity_EmptySlot_ThrowsException() {
        // given
        Company company = mock(Company.class);
        Warehouse warehouse = new Warehouse(company, 20);
        List<WarehouseSlot> slots = new ArrayList<>();
        slots.add(new WarehouseSlot(warehouse, 0));
        ReflectionTestUtils.setField(warehouse, "slots", slots);

        when(warehouseRepository.findByCompanyId(1L)).thenReturn(Optional.of(warehouse));

        // when & then
        assertThrows(IllegalArgumentException.class,
                () -> warehouseService.decreaseQuantity(1L, 0, 10L));
    }

    @Test
    @DisplayName("특정 슬롯 수량 감소 - 0 이하 amount 입력 시 예외 발생")
    void decreaseQuantity_InvalidAmount_ThrowsException() {
        // when & then
        assertThrows(IllegalArgumentException.class,
                () -> warehouseService.decreaseQuantity(1L, 0, 0L));
        assertThrows(IllegalArgumentException.class,
                () -> warehouseService.decreaseQuantity(1L, 0, -5L));
    }
}
