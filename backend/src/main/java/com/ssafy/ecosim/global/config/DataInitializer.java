package com.ssafy.ecosim.global.config;

import com.ssafy.ecosim.domain.item.entity.Item;
import com.ssafy.ecosim.domain.item.entity.ItemType;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 게임 아이템 초기 데이터를 코드로 관리하는 클래스.
 *
 * 새로운 아이템을 추가할 때는 ITEMS 리스트에 추가하면 됩니다.
 * 이미 존재하는 아이템(이름 기준)은 건너뜁니다.
 *
 * ⚠️ 주의: 아이템 이름을 바꾸면 새 아이템으로 인식해 중복 삽입됩니다.
 *           이름 변경 시에는 기존 아이템을 직접 수정하는 로직이 필요합니다.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private final ItemRepository itemRepository;

    public DataInitializer(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    // ──────────────────────────────────────────────────────────────────────
    // 아이템 목록 — 새 아이템은 여기에 추가하면 됩니다
    // ──────────────────────────────────────────────────────────────────────
    private static final List<Item> ITEMS = List.of(

            // ── 재료 (MATERIAL) ─────────────────────────────────────────
            Item.builder()
                    .name("금광석")
                    .type(ItemType.MATERIAL)
                    .description("채굴한 금 원석. 제련하면 금괴가 된다.")
                    .maxStackSize(100L)
                    .build(),

            // ── 유통 자원 (MATERIAL) — 회사 타입에 따라 input/output 역할이 달라짐
            Item.builder()
                    .name("금괴")
                    .type(ItemType.MATERIAL)
                    .description("순도 높은 금괴. 드릴 제조에 사용된다.")
                    .maxStackSize(50L)
                    .build(),

            Item.builder()
                    .name("금 드릴")
                    .type(ItemType.MATERIAL)
                    .description("금을 채굴하는 데 사용되는 드릴.")
                    .maxStackSize(10L)
                    .build(),

            // ── 일꾼 (EQUIPMENT) — 미니게임 보상 ───────────────────────
            Item.builder()
                    .name("초보 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("갓 고용된 일꾼. 기본적인 작업을 수행한다.")
                    .maxStackSize(1L)
                    .workerLevel(1)
                    .build(),

            Item.builder()
                    .name("견습 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("경험을 쌓은 일꾼. 작업 속도가 빨라진다.")
                    .maxStackSize(1L)
                    .workerLevel(2)
                    .build(),

            Item.builder()
                    .name("숙련 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("숙련된 기술을 가진 일꾼.")
                    .maxStackSize(1L)
                    .workerLevel(3)
                    .build(),

            Item.builder()
                    .name("마스터 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("뛰어난 실력의 일꾼.")
                    .maxStackSize(1L)
                    .workerLevel(4)
                    .build(),

            Item.builder()
                    .name("에픽 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("희귀한 능력을 지닌 일꾼.")
                    .maxStackSize(1L)
                    .workerLevel(5)
                    .build(),

            Item.builder()
                    .name("레전드 일꾼")
                    .type(ItemType.EQUIPMENT)
                    .description("전설적인 일꾼. 최고의 생산 효율을 자랑한다.")
                    .maxStackSize(1L)
                    .workerLevel(6)
                    .build(),

            // ── 확장권 (TICKET) — 미니게임 보상 ────────────────────────
            Item.builder()
                    .name("창고 확장권")
                    .type(ItemType.TICKET)
                    .description("창고 슬롯을 1칸 확장합니다.")
                    .maxStackSize(10L)
                    .build(),

            Item.builder()
                    .name("인벤토리 확장권")
                    .type(ItemType.TICKET)
                    .description("인벤토리 슬롯을 1칸 확장합니다.")
                    .maxStackSize(10L)
                    .build()
    );

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Item item : ITEMS) {
            if (!itemRepository.existsByName(item.getName())) {
                itemRepository.save(item);
            }
        }
    }
}
