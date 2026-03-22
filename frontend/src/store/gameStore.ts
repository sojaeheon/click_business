import { create } from "zustand";

// 🚨 gameApi.ts에 정의된 정확한 이름인 대문자 CompanyAPI로 가져옵니다.
import { CompanyAPI, WarehouseAPI, InventoryAPI, BankAPI, WorkstationAPI } from "../api/gameApi";
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

export interface WarehouseItem {
  id: string;
  type: "material" | "product";
  quantity: number;
  name?: string;
}

// ─── 인벤토리 아이템 종류 ────────────────────────────────────────────────
// 캐릭터(일꾼) Lv1~6 + 창고 슬롯 확장권 + 인벤토리 슬롯 확장권
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
}

// ─── 미니게임 보상 가중치 풀 ──────────────────────────────────────────────

// 없으면 아래 프론트 기본값 사용 (weight sum = 100)
type RewardEntry = { item: Omit<InventoryItem, "id">; weight: number };

export const REWARD_WEIGHT_POOL: RewardEntry[] = [
  { item: { type: "worker_lv1", name: "초보 일꾼", icon: "⛏️", quantity: 1, level: 1 }, weight: 70 },
  { item: { type: "ticket_inventory", name: "인벤토리 확장권", icon: "🎒", quantity: 1 }, weight: 24.7 },
  { item: { type: "ticket_warehouse", name: "창고 확장권", icon: "📦", quantity: 1 }, weight: 4.7 },
  { item: { type: "worker_lv2", name: "견습 일꾼", icon: "🔥", quantity: 1, level: 2 }, weight: 0.4 },
  { item: { type: "worker_lv3", name: "숙련 일꾼", icon: "🔨", quantity: 1, level: 3 }, weight: 0.18 },
  { item: { type: "worker_lv4", name: "마스터 일꾼", icon: "🏹", quantity: 1, level: 4 }, weight: 0.01 },
  { item: { type: "worker_lv5", name: "에픽 일꾼", icon: "🗡️", quantity: 1, level: 5 }, weight: 0.009 },
  { item: { type: "worker_lv6", name: "레전드 일꾼", icon: "👑", quantity: 1, level: 6 }, weight: 0.001 },
];

/**
 * 미니게임 보상 1개를 가중치 확률로 랜덤 픽.
 * ⚠️ 서버에서 결과를 내려주면 API response로 대체하세요.
 */
export function pickReward(pool = REWARD_WEIGHT_POOL): Omit<InventoryItem, "id"> {
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const entry of pool) {
    rand -= entry.weight;
    if (rand <= 0) return entry.item;
  }
  return pool[0].item;
}

// 하위 호환성 (기존 코드가 import하는 REWARD_ITEM_POOL)
export const REWARD_ITEM_POOL: Omit<InventoryItem, "id">[] = REWARD_WEIGHT_POOL.map(e => e.item);

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

  // 작업장 로컬 상태 캐시
  workstationState: {
    isStarting?: boolean;
    isWorking: boolean;
    startTime: number;
    totalMs: number;
    requestedQty: number;
    storedCount: number;
    producedCount: number;
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
  updateMoney: (amount: number) => boolean;
  updateMaterial: (amount: number) => number;
  updateProduct: (amount: number) => number;
  addAlert: (alertData: Omit<Alert, 'id' | 'timeAgo' | 'read'>) => void;
  markAllAlertsAsRead: () => void;

  // 은행 데이터 동기화
  updateBankData: (data: Partial<BankData>) => void;
  updateDebt: (amount: number) => void; // 양수 = 부칄 증가, 음수 = 부칄 감소

  getWarehouseUsage: () => { usedSlots: number; percent: number };
  getIndustryItemNames: (indOverride?: string) => { material: string; product: string; reqMat: number; resProd: number; batchSize: number };

  fetchCompanyData: (companyId: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 상태 관리소 (persist 미들웨어 적용)
// ─────────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>()(
    (set, get) => ({
      companyName: "",
      industry: "금광업",
      money: 5000000,
      currency: "₩",
      capital: 5000000,
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
      workstationId: 0,  // ✅ 실제 DB workstation ID (0 = 아직 불러옴)
      inventoryItems: [],
      warehouseExpandTickets: 0,
      inventoryExpandTickets: 0,

      equippedWorkerId: null,
      hasNewWorker: false,
      setEquippedWorkerId: (id) => set({ equippedWorkerId: id }),
      setHasNewWorker: (v) => set({ hasNewWorker: v }),

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

      setCompanyInfo: (name, industry) => set({ companyName: name, industry }),



      // 은행 데이터 통합 동기화
      updateBankData: (data) => set(state => ({ bankData: { ...state.bankData, ...data } })),
      updateDebt: (amount) => set(state => ({
        bankData: { ...state.bankData, currentLoan: Math.max(0, state.bankData.currentLoan + amount) },
        debt: Math.max(0, state.debt + amount),
      })),

      getWarehouseUsage: () => {
        // 백엔드에서 빈 슬롯을 걸러낸(item이 존재하는) 슬롯 배열의 길이를 사용합니다.
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

      updateMoney: (amount) => {
        if (get().money + amount < 0) return false;
        set(state => ({ money: state.money + amount }));
        return true;
      },

      updateMaterial: (amount) => {
        let actualAdded = amount;
        set(state => {
          const newItems = [...state.warehouseItems];
          const matIdx = newItems.findIndex(i => i.type === "material");
          const currentQty = matIdx >= 0 ? newItems[matIdx].quantity : 0;

          if (amount < 0) {
            if (currentQty + amount < 0) return state;
            actualAdded = amount;
          } else {
            let slotsByOther = 0;
            state.warehouseItems.forEach(i => {
              if (i.type !== "material") slotsByOther += Math.ceil(i.quantity / MAX_PER_SLOT);
            });
            const slotsAvailable = state.warehouseMaxSlots - slotsByOther;
            let freeSpace = 0;
            if (slotsAvailable <= 0) {
              const currentSlots = Math.ceil(currentQty / MAX_PER_SLOT);
              freeSpace = Math.max(0, (currentSlots * MAX_PER_SLOT) - currentQty);
            } else {
              freeSpace = Math.max(0, (slotsAvailable * MAX_PER_SLOT) - currentQty);
            }
            actualAdded = Math.min(amount, freeSpace);
          }

          if (matIdx >= 0) {
            newItems[matIdx] = { ...newItems[matIdx], quantity: currentQty + actualAdded, name: get().getIndustryItemNames().material };
          } else if (actualAdded > 0) {
            newItems.push({ id: "m1", type: "material", quantity: actualAdded, name: get().getIndustryItemNames().material });
          }
          return { warehouseItems: newItems };
        });
        return actualAdded;
      },

      updateProduct: (amount) => {
        let actualAdded = amount;
        set(state => {
          const newItems = [...state.warehouseItems];
          const pIdx = newItems.findIndex(i => i.type === "product");
          const currentQty = pIdx >= 0 ? newItems[pIdx].quantity : 0;

          if (amount < 0) {
            if (currentQty + amount < 0) return state;
            actualAdded = amount;
          } else {
            let slotsByOther = 0;
            state.warehouseItems.forEach(i => {
              if (i.type !== "product") slotsByOther += Math.ceil(i.quantity / MAX_PER_SLOT);
            });
            const slotsAvailable = state.warehouseMaxSlots - slotsByOther;
            let freeSpace = 0;
            if (slotsAvailable <= 0) {
              const currentSlots = Math.ceil(currentQty / MAX_PER_SLOT);
              freeSpace = Math.max(0, (currentSlots * MAX_PER_SLOT) - currentQty);
            } else {
              freeSpace = Math.max(0, (slotsAvailable * MAX_PER_SLOT) - currentQty);
            }
            actualAdded = Math.min(amount, freeSpace);
          }

          if (pIdx >= 0) {
            newItems[pIdx] = { ...newItems[pIdx], quantity: currentQty + actualAdded, name: get().getIndustryItemNames().product };
          } else if (actualAdded > 0) {
            newItems.push({ id: "p1", type: "product", quantity: actualAdded, name: get().getIndustryItemNames().product });
          }
          return { warehouseItems: newItems };
        });
        return actualAdded;
      },

      fetchCompanyData: async (companyId: number) => {
        set({ isLoading: true });
        try {
          // 백엔드 API 종합 호출 (workstationId도 함께 초기화)
          const [companyRes, warehouseRes, inventoryRes, bankRes, workstationIdRes] = await Promise.all([
            CompanyAPI.getStatus(),
            WarehouseAPI.getWarehouseItems(1).catch(() => ({ data: [], maxSlots: undefined })),
            InventoryAPI.getInventory(companyId).catch(() => ({ data: [], maxSlots: undefined })),
            BankAPI.getSummary(companyId).catch(() => ({ data: { loanRate: 0, depositRate: 0, currentLoan: 0, currentDeposit: 0 } })),
            WorkstationAPI.getMyId().catch(() => 1), // 에러시 1로 폴백
          ]);

          const realData = companyRes.data;

          // 모든 아이템(티켓 / 일꾼 구분 없이)을 inventoryItems에 그대로 저장
          // 관련 UI(InventoryModal)에서 type.startsWith("ticket_")로 구분한다
          const allItems: InventoryItem[] = inventoryRes.data.map((item: any) => item);

          // ✅ 더미 아이템 삽입 제거: 이제 실제 DB에 있는 데이터만 보여줌 (빈 DB일 경우 400 에러 혼동 방지)
          const finalIndustry = realData?.industry_type ?? get().industry;
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
            isLoading: false
          });
        } catch (error) {
          console.error("전반적인 회사 게임 데이터 로드 실패:", error);
          set({ isLoading: false });
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