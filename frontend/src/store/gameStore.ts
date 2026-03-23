import { create } from "zustand";

// 🚨 gameApi.ts에 정의된 정확한 이름인 대문자 CompanyAPI로 가져옵니다.
import { CompanyAPI, WarehouseAPI, InventoryAPI, BankAPI, WorkstationAPI, NewsAPI } from "../api/gameApi";
import { WORKER_DEFINITIONS, getWorkerDefByLevel } from "../constants/workers";
import { useAlertStore } from "./useAlertStore";

// ─────────────────────────────────────────────────────────────────────────
// 1. 타입 정의 (Types)
// ─────────────────────────────────────────────────────────────────────────
export type ModalTab = "profile" | "news" | "newsDetail" | "ranking" | "inventory" | "alert" | "settings" | null;
export type BuildingPage = "hr" | "bank" | "warehouse" | "minigame" | "workstation" | "market" | null;

export interface Alert { id: string; message: string; detail?: string; timeAgo: string; read: boolean; }
export interface NewsItem { id: string; headline: string; date: string; isBreaking?: boolean; summary?: string; }
export interface BankData { loanRate: number; depositRate: number; currentLoan: number; currentDeposit: number; }
// 슬롯 하나에 담을 수 있는 최대량 (예: 100개)
export const MAX_PER_SLOT = 100;

// 영어 산업명 → 한글 변환
const INDUSTRY_KO: Record<string, string> = {
  GOLD_MINING: "금광업",
  GOLD_SMELTING: "금 제련업",
  MANUFACTURING: "제조업",
};
export function toKoIndustry(name: string): string {
  return INDUSTRY_KO[name] ?? name;
}
/** 문자열 내 영어 산업명을 한글로 치환 */
export function localizeIndustryText(text: string): string {
  return text.replace(/GOLD_MINING|GOLD_SMELTING|MANUFACTURING/g, (m) => INDUSTRY_KO[m] ?? m);
}

export interface WarehouseItem {
  id: string;
  type: "material" | "product";
  quantity: number;
  name?: string;
}

// ─── 인벤토리 아이템 종류 ────────────────────────────────────────────────
export type InventoryItemType =
  | "worker_lv1"
  | "worker_lv2"
  | "worker_lv3"
  | "worker_lv4"
  | "worker_lv5"
  | "worker_lv6"
  | "ticket_warehouse"
  | "ticket_inventory";

export interface InventoryItem {
  id: string;
  type: InventoryItemType;
  name: string;
  icon: string;
  quantity: number;
  level?: number;
  slotIndex?: number;
  slotId?: number;    // ✅ 백엔드 PK
  equipped?: boolean;  // ✅ 장착 여부
}



export interface HRData { currentLevel: number; expectedLevel: number; successRate: number; materialCurrent: number; materialMax: number; }

// ─────────────────────────────────────────────────────────────────────────
// 2. Zustand 스토어 형태 정의 (Data + Actions)
// ─────────────────────────────────────────────────────────────────────────
export interface GameState {
  companyName: string;
  industry: string;
  money: number;
  currency: string;
  capital: number;
  debt: number;
  warehouseMaxSlots: number;
  inventoryMax: number;
  inventoryPurchaseCount: number; // 돈으로 구매한 슬롯 횟수 (가격 산정용)

  // 인벤토리 아이템 (캐릭터 + 확장권) 전역 관리
  inventoryItems: InventoryItem[];
  // 확장권 보유 수 (Warehouse, Inventory)
  warehouseExpandTickets: number;
  inventoryExpandTickets: number;

  alerts: Alert[];
  news: NewsItem[];
  activeModal: ModalTab;
  selectedBuilding: string | null;
  activeBuildingPage: BuildingPage;
  bankData: BankData;
  warehouseItems: WarehouseItem[];
  hrData: HRData;
  isLoading: boolean;
  workstationId: number;  // ✅ 실제 DB workstation ID (하드코딩 1 제거)

  // 장착 일꾼 ID & 새로운 일꾼 알람
  equippedWorkerId: string | null;
  hasNewWorker: boolean;
  setEquippedWorkerId: (id: string | null) => void;
  setHasNewWorker: (v: boolean) => void;

  equipWorker: (slotIndex: number) => Promise<void>;
  unequipWorker: () => Promise<void>;

  // 작업장 로컬 상태 캐시
  workstationState: {
    isStarting?: boolean;
    isWorking: boolean;
    startTime: number;
    totalMs: number;
    endTime: number | null;
    requestedQty: number;
    storedCount: number;
    producedCount: number;
    collectedTotal: number;
    uncollectedPile: number;
    // ✅ 백엔드에서 받는 생산 관련 추가 필드
    minuteOutput: number | null;      // 분당 생산량 (백엔드에서 산업별로 계산)
    workerLevel: number | null;       // 장착 캐릭터 레벨
    speedMultiplier: number | null;   // 속도 가중치 (레벨별 1.0, 1.5, 2.0 등)
  };
  setWorkstationState: (updater: Partial<GameState["workstationState"]>) => void;

  openModal: (tab: ModalTab) => void;
  closeModal: () => void;
  switchTab: (tab: ModalTab) => void;
  dismissAlert: (id: string) => void;
  selectBuilding: (building: string | null) => void;
  openBuildingPage: (page: BuildingPage) => void;
  closeBuildingPage: () => void;

  setCompanyInfo: (name: string, industry: string) => void;
  addAlert: (alertData: Omit<Alert, 'id' | 'timeAgo' | 'read'>) => void;
  markAllAlertsAsRead: () => void;

  // 은행 데이터 동기화
  updateBankData: (data: Partial<BankData>) => void;
  updateDebt: (amount: number) => void; // 양수 = 부채 증가, 음수 = 부채 감소

  getWarehouseUsage: () => { usedSlots: number; percent: number };
  getIndustryItemNames: (indOverride?: string) => { material: string; product: string; reqMat: number; resProd: number; batchSize: number };

  fetchCompanyData: (companyId: number) => Promise<void>;
  fetchNews: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 상태 관리소
// ─────────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>()(
  (set, get) => ({
    companyName: "",
    industry: "금광업",
    money: 0,
    currency: "₩",
    capital: 0,
    debt: 0,
    warehouseMaxSlots: 6,
    inventoryMax: 4,
    inventoryPurchaseCount: 0,
    alerts: [],
    news: [],
    activeModal: null,
    selectedBuilding: null,
    activeBuildingPage: null,
    bankData: { loanRate: 0, depositRate: 0, currentLoan: 0, currentDeposit: 0 },
    warehouseItems: [],
    hrData: { currentLevel: 0, expectedLevel: 0, successRate: 0, materialCurrent: 0, materialMax: 0 },
    isLoading: false,
    workstationId: 0,
    inventoryItems: [],
    warehouseExpandTickets: 0,
    inventoryExpandTickets: 0,

    equippedWorkerId: null,
    hasNewWorker: false,
    setEquippedWorkerId: (id) => set({ equippedWorkerId: id }),
    setHasNewWorker: (v) => set({ hasNewWorker: v }),

    equipWorker: async (slotIndex: number) => {
      try {
        await WorkstationAPI.equipWorker(slotIndex);
        await get().fetchCompanyData(1); // 데이터 동기화
      } catch (error) {
        console.error("일꾼 장착 실패:", error);
        throw error;
      }
    },

    unequipWorker: async () => {
      try {
        await WorkstationAPI.unequipWorker();
        await get().fetchCompanyData(1); // 데이터 동기화
      } catch (error) {
        console.error("일꾼 장착 해제 실패:", error);
        throw error;
      }
    },

    workstationState: {
      isStarting: false,
      isWorking: false,
      startTime: 0,
      totalMs: 0,
      requestedQty: 0,
      storedCount: 0,
      producedCount: 0,
    },
    setWorkstationState: (updater) => set(s => ({
      workstationState: { ...s.workstationState, ...updater }
    })),


    openModal: (tab) => set({ activeModal: tab }),
    closeModal: () => set({ activeModal: null }),
    switchTab: (tab) => set({ activeModal: tab }),
    addAlert: (alertData) => set((state) => {
      const newAlert: Alert = {
        ...alertData,
        id: "alert_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timeAgo: "방금 전",
        read: false
      };
      return { alerts: [newAlert, ...state.alerts] };
    }),
    dismissAlert: (id) => set((state) => ({
      alerts: state.alerts.filter(alert => alert.id !== id)
    })),
    markAllAlertsAsRead: () => set((state) => ({
      alerts: state.alerts.map(alert => ({ ...alert, read: true }))
    })),
    selectBuilding: (building) => set({ selectedBuilding: building }),
    openBuildingPage: (page) => set({ activeBuildingPage: page }),
    closeBuildingPage: () => set({ activeBuildingPage: null }),

    setCompanyInfo: (name, industry) => set({ companyName: name, industry: toKoIndustry(industry) }),



    // 은행 데이터 통합 동기화
    updateBankData: (data) => set(state => ({ bankData: { ...state.bankData, ...data } })),
    updateDebt: (amount) => set(state => ({
      bankData: { ...state.bankData, currentLoan: Math.max(0, state.bankData.currentLoan + amount) },
      debt: Math.max(0, state.debt + amount),
    })),

    getWarehouseUsage: () => {
      const usedSlots = get().warehouseItems.length;
      const percent = Math.min((usedSlots / get().warehouseMaxSlots) * 100, 100);
      return { usedSlots, percent };
    },

    getIndustryItemNames: (indOverride?: string) => {
      const ind = indOverride || get().industry;
      if (ind === "GOLD_MINING" || ind === "금광업") return { material: "광산 드릴", product: "금광석", reqMat: 2, resProd: 40, batchSize: 20 };
      if (ind === "GOLD_SMELTING" || ind === "금 제련업" || ind === "제철업") return { material: "금광석", product: "금괴", reqMat: 12, resProd: 6, batchSize: 10 };
      if (ind === "MANUFACTURING" || ind === "제조업") return { material: "금괴", product: "광산 드릴", reqMat: 20, resProd: 2, batchSize: 5 };
      return { material: "재료", product: "생산품", reqMat: 1, resProd: 1, batchSize: 5 };
    },



    fetchCompanyData: async (companyId: number) => {
      set({ isLoading: true });
      try {
        const [companyRes, warehouseRes, inventoryRes, bankRes, workstationIdRes, wsStatusRes] = await Promise.all([
          CompanyAPI.getStatus(),
          WarehouseAPI.getWarehouseItems(1).catch(() => ({ data: [], maxSlots: undefined })),
          InventoryAPI.getInventory(companyId).catch(() => ({ data: [], maxSlots: undefined })),
          BankAPI.getSummary(companyId).catch(() => ({ data: { loanRate: 0, depositRate: 0, currentLoan: 0, currentDeposit: 0 } })),
          WorkstationAPI.getMyId().catch(() => 1),
          WorkstationAPI.getStatus().catch(() => ({ data: null }))
        ]);

        const realData = companyRes.data;

        // ✅ 백엔드 응답을 모든 가능한 필드명 규격(중첩 가능성 포함)에 맞게 초강력 방어적으로 매핑
        const allItems: InventoryItem[] = inventoryRes.data.map((item: any) => {
          // 1. 중첩된 item 객체가 있을 경우를 대비해 병합
          const source = item.item ? { ...item, ...item.item } : item;

          // 2. 모든 필드에 대해 백엔드의 가능한 모든 변수명 체크 (CamelCase, SnakeCase, 간단 이름 등)
          const slotId = source.slotId ?? source.slot_id ?? source.id;
          const slotIndex = source.slotIndex ?? source.slot_index;
          const itemType = source.itemType ?? source.item_type ?? source.type;
          const itemName = source.itemName ?? source.item_name ?? source.name;
          const workerLevel = source.workerLevel ?? source.worker_level ?? source.level;
          const quantity = source.quantity ?? source.amount ?? 1;
          const equipped = source.equipped ?? source.isEquipped ?? source.is_equipped ?? false;
          const itemId = source.itemId ?? source.item_id ?? source.id;

          // 3. 정밀 Type 판별 로직 (TICKET 우선 판별)
          let type: InventoryItemType = "worker_lv1";

          // rawItemType: 문자열, 숫자(Ordinal), 또는 객체 형태({name: 'TICKET'}) 대응
          const rawType = source.itemType ?? source.item_type ?? source.type;
          const typeStr = (typeof rawType === 'object' && rawType !== null) ? (rawType.name || rawType.type) : String(rawType).toUpperCase();
          const typeIdx = Number(rawType);
          const itmId = Number(itemId);
          const nameStr = String(itemName || "");

          const isTicketType = typeStr === "TICKET" || typeIdx === 3 || itmId === 11 || itmId === 12 || nameStr.includes("확장권");
          const isEquipmentType = typeStr === "EQUIPMENT" || typeIdx === 2;

          if (isTicketType) {
            if (nameStr.includes("인벤토리") || itmId === 11 || nameStr.toLowerCase().includes("inventory")) {
              type = "ticket_inventory";
            } else {
              type = "ticket_warehouse";
            }
          } else if (isEquipmentType) {
            type = `worker_lv${workerLevel || 1}` as InventoryItemType;
          } else {
            // 🚨 타입 판별 실패 시 기본 폴백 (이름 기반 추가 시도)
            if (nameStr.includes("일꾼") || nameStr.toLowerCase().includes("worker")) {
              type = `worker_lv${workerLevel || 1}` as InventoryItemType;
            }
          }

          return {
            id: slotId ? slotId.toString() : `slot_${Math.random().toString(36).substr(2, 9)}`,
            slotId: slotId,
            slotIndex: slotIndex,
            type: type,
            name: itemName || (itemId === 11 ? "인벤토리 확장권" : (itemId === 12 ? "창고 확장권" : "아이템")),
            icon: "",
            quantity: quantity,
            level: workerLevel || 1,
            equipped: !!equipped
          };
        });

        const finalIndustry = toKoIndustry(realData?.industry_type ?? get().industry);
        const { material, product } = get().getIndustryItemNames(finalIndustry);

        const fixedWarehouseItems = (warehouseRes.data as WarehouseItem[]).map(item => ({
          ...item,
          name: item.type === "material" ? material : item.type === "product" ? product : item.name
        }));

        // 백엔드가 maxSlots를 제공하면 가장 우선 적용 (과거 캐시 문제 해결)
        const warehouseMaxSlotsFromApi = (warehouseRes as any).maxSlots;
        const inventoryMaxSlotsFromApi = (inventoryRes as any).maxSlots;

        set({
          money: realData?.cash ?? get().money,
          capital: realData?.total_asset ?? get().capital,
          companyName: realData?.name ?? get().companyName,
          industry: finalIndustry,
          warehouseMaxSlots: warehouseMaxSlotsFromApi ?? realData?.slots?.warehouse_slots ?? (get().warehouseMaxSlots === 10 ? 6 : get().warehouseMaxSlots),
          inventoryMax: inventoryMaxSlotsFromApi ?? realData?.slots?.inventory_slots ?? (get().inventoryMax === 50 ? 4 : get().inventoryMax),
          warehouseItems: fixedWarehouseItems,
          inventoryItems: allItems,
          // 티켓은 inventoryItems 안에 아이템으로 저장됨. 개수 정보는 UI에서 type로 필터링
          warehouseExpandTickets: allItems.filter(i => i.type === 'ticket_warehouse').reduce((a, i) => a + (i.quantity || 1), 0),
          inventoryExpandTickets: allItems.filter(i => i.type === 'ticket_inventory').reduce((a, i) => a + (i.quantity || 1), 0),
          bankData: {
            ...get().bankData,
            loanRate: bankRes.data.loanRate,
            depositRate: bankRes.data.depositRate,
            currentLoan: bankRes.data.currentLoan,
            currentDeposit: bankRes.data.currentDeposit,
          },
          debt: bankRes.data.currentLoan,
          workstationId: typeof workstationIdRes === "number" ? workstationIdRes : (workstationIdRes as any)?.data ?? 0,  // ✅ 실제 DB ID 저장
          workstationState: {
            ...get().workstationState,
            isWorking: wsStatusRes.data?.isWorking ?? false,
            producedCount: wsStatusRes.data?.producedQuantity ?? 0,
            storedCount: wsStatusRes.data?.producedQuantity ?? 0,
            requestedQty: wsStatusRes.data?.totalQuantity ?? 0,
          },
          // ✅ 장착된 일꾼 ID 동기화 (equipped: true인 아이템의 id 사용)
          equippedWorkerId: allItems.find(i => i.equipped)?.id ?? null,
          isLoading: false
        });
      } catch (error) {
        console.error("전반적인 회사 게임 데이터 로드 실패:", error);
        set({ isLoading: false });
      }
    },

    fetchNews: async () => {
      try {
        const newsData = await NewsAPI.getNews();

        const mappedNews: NewsItem[] = newsData.map((item: any) => {
          let dateStr = "";
          if (typeof item.publishedAt === "string") {
            dateStr = item.publishedAt.split('T')[0].replaceAll('-', '.');
          } else if (Array.isArray(item.publishedAt)) {
            const [year, month, day] = item.publishedAt;
            dateStr = `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
          }

          return {
            id: String(item.id ?? "anonymous"),
            headline: item.title ?? "제목 없는 뉴스",
            summary: item.content ?? "",
            date: dateStr,
            isBreaking: item.type === 'INTERNAL',
          };
        });

        set({ news: mappedNews });
      } catch (err) {
        console.error("뉴스 데이터 로드 실패:", err);
      }
    }
  })
);

// ─────────────────────────────────────────────────────────────────────────
// 4. 하위 호환성 래퍼 훅 (다른 파일 수정 방지용)
// ─────────────────────────────────────────────────────────────────────────
export function useGame() {
  const store = useGameStore();

  return {
    state: store,
    openModal: store.openModal,
    closeModal: store.closeModal,
    switchTab: store.switchTab,
    dismissAlert: store.dismissAlert,
    markAllAlertsAsRead: store.markAllAlertsAsRead,
    selectBuilding: store.selectBuilding,
    openBuildingPage: store.openBuildingPage,
    closeBuildingPage: store.closeBuildingPage,
    setGameState: () => console.warn("Zustand 적용으로 setGameState는 더 이상 필요하지 않습니다."),
  };
}

export const defaultGameState = useGameStore.getState();