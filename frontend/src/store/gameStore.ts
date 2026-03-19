import { create } from "zustand";
import { persist } from "zustand/middleware";
// 🚨 gameApi.ts에 정의된 정확한 이름인 대문자 CompanyAPI로 가져옵니다.
import { CompanyAPI, WarehouseAPI, InventoryAPI, BankAPI } from "../api/gameApi";

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
}

// ─── 미니게임 보상 가중치 풀 ──────────────────────────────────────────────
// ⚠️ 백엔드 /v1/minigame/reward-pool API 결과로 대체 예정
// 없으면 아래 프론트 기본값 사용 (weight sum = 100)
type RewardEntry = { item: Omit<InventoryItem, "id">; weight: number };

export const REWARD_WEIGHT_POOL: RewardEntry[] = [
  { item: { type: "worker_lv1", name: "초보 일꾼",   icon: "⛏️", quantity: 1, level: 1 }, weight: 59.5 },
  { item: { type: "ticket_inventory", name: "인벤토리 확장권", icon: "🎒", quantity: 1 }, weight: 10.5 },
  { item: { type: "ticket_warehouse", name: "창고 확장권",    icon: "📦", quantity: 1 }, weight: 10.5 },
  { item: { type: "worker_lv2", name: "견습 일꾼",   icon: "🔥", quantity: 1, level: 2 }, weight: 10.0 },
  { item: { type: "worker_lv3", name: "숙련 일꾼",   icon: "🔨", quantity: 1, level: 3 }, weight:  5.0 },
  { item: { type: "worker_lv4", name: "마스터 일꾼", icon: "🏹", quantity: 1, level: 4 }, weight:  3.0 },
  { item: { type: "worker_lv5", name: "에픽 일꾼",   icon: "🗡️", quantity: 1, level: 5 }, weight:  1.0 },
  { item: { type: "worker_lv6", name: "레전드 일꾼", icon: "👑", quantity: 1, level: 6 }, weight:  0.5 },
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

  // 장착 일꾼 ID & 새로운 일꾼 알람
  equippedWorkerId: string | null;
  hasNewWorker: boolean;
  setEquippedWorkerId: (id: string | null) => void;
  setHasNewWorker: (v: boolean) => void;

  // 작업장 로컬 상태 캐시 (백엔드 연동 전 임시)
  workstationState: {
    isStarting?: boolean;
    isWorking: boolean;
    startTime: number;
    totalMs: number;
    requestedQty: number;
    storedCount: number; // 미수령 상태로 남아있는 양
    producedCount: number; // 금번 작업에서 총 생산된 양 (UI 애니메이션 타겟)
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

  // 인베토리 아이템 관리
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  removeInventoryItem: (id: string) => void;
  // 확장권 사용
  useWarehouseTicket: () => boolean;    // 성공 시 true
  useInventoryTicket: () => boolean;
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
  persist(
    (set, get) => ({
      companyName: "",
      industry: "금광업",
      money: 5000000,
      currency: "₩",
      capital: 5000000,
      debt: 0,
      warehouseMaxSlots: 6,
      inventoryMax: 4,
      alerts: [],
      news: [],
      activeModal: null,
      selectedBuilding: null,
      activeBuildingPage: null,
      bankData: { loanRate: 5.5, depositRate: 2.3, currentLoan: 0, currentDeposit: 0 },
      warehouseItems: [],
      hrData: { currentLevel: 1, expectedLevel: 2, successRate: 70, materialCurrent: 1, materialMax: 2 },
      isLoading: false,
      // 인벤토리 아이템 (기본 캐릭터 지급 1개)
      inventoryItems: [
        { id: "inv_default_1", type: "worker_lv1", name: "초보 일꾼", icon: "⛏️", quantity: 1, level: 1 },
      ],
      warehouseExpandTickets: 0,
      inventoryExpandTickets: 0,
      
      equippedWorkerId: "inv_default_1",
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

      // 인벤토리 아이템 추가 (확장권일 경우 별도 수치 증가, 캐릭터일 경우 인벤토리 배열에 추가)
      addInventoryItem: (item) => set(state => {
        if (item.type === "ticket_warehouse") {
          return { warehouseExpandTickets: state.warehouseExpandTickets + item.quantity };
        }
        if (item.type === "ticket_inventory") {
          return { inventoryExpandTickets: state.inventoryExpandTickets + item.quantity };
        }
        return {
          inventoryItems: [...state.inventoryItems, { ...item, id: "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2) }],
          hasNewWorker: true,
        };
      }),
      removeInventoryItem: (id) => set(state => ({
        inventoryItems: state.inventoryItems.filter(i => i.id !== id)
      })),

      // 확장권 사용 — 삼엔드 스토어 수치 + 확장권 상담
      useWarehouseTicket: () => {
        const s = get();
        if (s.warehouseExpandTickets <= 0) return false;
        set(state => ({
          warehouseExpandTickets: state.warehouseExpandTickets - 1,
          warehouseMaxSlots: state.warehouseMaxSlots + 1,
        }));
        return true;
      },
      useInventoryTicket: () => {
        const s = get();
        if (s.inventoryExpandTickets <= 0) return false;
        set(state => ({
          inventoryExpandTickets: state.inventoryExpandTickets - 1,
          inventoryMax: state.inventoryMax + 1,
        }));
        return true;
      },

      // 은행 데이터 통합 동기화
      updateBankData: (data) => set(state => ({ bankData: { ...state.bankData, ...data } })),
      updateDebt: (amount) => set(state => ({
        bankData: { ...state.bankData, currentLoan: Math.max(0, state.bankData.currentLoan + amount) },
        debt: Math.max(0, state.debt + amount),
      })),

      getWarehouseUsage: () => {
        const items = get().warehouseItems;
        let usedSlots = 0;
        items.forEach(item => {
          usedSlots += Math.ceil(item.quantity / MAX_PER_SLOT);
        });
        const percent = Math.min((usedSlots / get().warehouseMaxSlots) * 100, 100);
        return { usedSlots, percent };
      },

      getIndustryItemNames: (indOverride?: string) => {
        const ind = indOverride || get().industry;
        if (ind === "금광업") return { material: "광산 드릴", product: "금광석", reqMat: 2, resProd: 40, batchSize: 20 };
        if (ind === "금 제련업" || ind === "제철업") return { material: "금광석", product: "금괴", reqMat: 12, resProd: 6, batchSize: 10 };
        if (ind === "제조업") return { material: "금괴", product: "광산 드릴", reqMat: 20, resProd: 2, batchSize: 5 };
        return { material: "재료", product: "생산품", reqMat: 1, resProd: 1, batchSize: 10 };
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
          // 백엔드 API 종합 호출 (fallback 포함)
          const [companyRes, warehouseRes, inventoryRes, bankRes] = await Promise.all([
            CompanyAPI.getStatus(companyId),
            WarehouseAPI.getWarehouseItems(companyId),
            InventoryAPI.getInventory(companyId),
            BankAPI.getSummary(companyId)
          ]);

          const realData = companyRes.data;
          
          let wTickets = 0;
          let iTickets = 0;
          const workers: InventoryItem[] = [];

          inventoryRes.data.forEach((item: any) => {
            if (item.type === "ticket_warehouse" || item.id === "ticket_warehouse_expand") {
              wTickets += item.quantity || 1;
            } else if (item.type === "ticket_inventory" || item.id === "ticket_inventory_expand") {
              iTickets += item.quantity || 1;
            } else {
              workers.push(item);
            }
          });

          // 기본 캐릭터 (수습 광부) 지급 보장 (비어있을 경우)
          if (workers.length === 0) {
            workers.push({
              id: "inv_default_1",
              type: "worker_lv1",
              name: "초보 일꾼",
              icon: "⛏️",
              quantity: 1,
              level: 1,
            });
          }

          const finalIndustry = realData?.industry_type ?? get().industry;
          const { material, product } = get().getIndustryItemNames(finalIndustry);

          const fixedWarehouseItems = (warehouseRes.data as WarehouseItem[]).map(item => ({
            ...item,
            name: item.type === "material" ? material : item.type === "product" ? product : item.name
          }));

          set({
            money: realData?.cash ?? get().money,
            capital: realData?.total_asset ?? get().capital,
            companyName: realData?.name ?? get().companyName,
            industry: finalIndustry,
            // 과거 캐시에 의해 프론트엔드 슬롯이 각각 10, 50으로 고정된 유저들을 위한 강제 보정 로직
            warehouseMaxSlots: realData?.slots?.warehouse_slots ?? (get().warehouseMaxSlots === 10 ? 6 : get().warehouseMaxSlots),
            inventoryMax: realData?.slots?.inventory_slots ?? (get().inventoryMax === 50 ? 4 : get().inventoryMax),
            warehouseItems: fixedWarehouseItems,
            inventoryItems: workers,
            warehouseExpandTickets: wTickets,
            inventoryExpandTickets: iTickets,
            bankData: {
              ...get().bankData,
              loanRate: bankRes.data.loanRate,
              depositRate: bankRes.data.depositRate,
              currentLoan: bankRes.data.currentLoan,
              currentDeposit: bankRes.data.currentDeposit,
            },
            debt: bankRes.data.currentLoan, // 은행의 대출금액과 동기화
            isLoading: false
          });
        } catch (error) {
          console.error("전반적인 회사 게임 데이터 로드 실패:", error);
          set({ isLoading: false });
        }
      }
    }),
    { 
      name: "game-storage",
      partialize: (state) => ({
        companyName: state.companyName,
        industry: state.industry,
        money: state.money,
        currency: state.currency,
        capital: state.capital,
        debt: state.debt,
        warehouseMaxSlots: state.warehouseMaxSlots,
        inventoryMax: state.inventoryMax,
        bankData: state.bankData,
        warehouseItems: state.warehouseItems,
        inventoryItems: state.inventoryItems,
        warehouseExpandTickets: state.warehouseExpandTickets,
        inventoryExpandTickets: state.inventoryExpandTickets,
        equippedWorkerId: state.equippedWorkerId,
        hasNewWorker: state.hasNewWorker,
        hrData: state.hrData,
      }),
    }
  )
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