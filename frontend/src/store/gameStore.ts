import { create } from "zustand";
import { persist } from "zustand/middleware";
// 🚨 gameApi.ts에 정의된 정확한 이름인 대문자 CompanyAPI로 가져옵니다.
import { CompanyAPI } from "../api/gameApi";

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
}

// ─── 인벤토리 아이템 종류 ────────────────────────────────────────────────
// 캐릭터(일꾼) 6종 + 창고 슬롯 확장권 + 인벤토리 슬롯 확장권
export type InventoryItemType =
  | "worker_수습_광부"
  | "worker_숙련_광부"
  | "worker_초보_제련공"
  | "worker_숙련_제련공"
  | "worker_견습_대장장이"
  | "worker_숙련_대장장이"
  | "ticket_warehouse"
  | "ticket_inventory";

export interface InventoryItem {
  id: string;
  type: InventoryItemType;
  name: string;
  icon: string;
  quantity: number;
  level?: number;
  workerType?: "miner" | "smelter" | "manufacturer";
}

/** 미니게임 보상 랜덤 풀 (8종) */
export const REWARD_ITEM_POOL: Omit<InventoryItem, "id">[] = [
  { type: "worker_수습_광부", name: "수습 광부", icon: "⛏️", quantity: 1, level: 1, workerType: "miner" },
  { type: "worker_숙련_광부", name: "숙련 광부", icon: "⛏️", quantity: 1, level: 2, workerType: "miner" },
  { type: "worker_초보_제련공", name: "초보 제련공", icon: "🔥", quantity: 1, level: 1, workerType: "smelter" },
  { type: "worker_숙련_제련공", name: "숙련 제련공", icon: "🔥", quantity: 1, level: 2, workerType: "smelter" },
  { type: "worker_견습_대장장이", name: "견습 대장장이", icon: "🔨", quantity: 1, level: 1, workerType: "manufacturer" },
  { type: "worker_숙련_대장장이", name: "숙련 대장장이", icon: "🔨", quantity: 1, level: 2, workerType: "manufacturer" },
  { type: "ticket_warehouse", name: "창고 확장권", icon: "📦", quantity: 1 },
  { type: "ticket_inventory", name: "인벤토리 확장권", icon: "🎒", quantity: 1 },
];

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
  getIndustryItemNames: () => { material: string; product: string; reqMat: number; resProd: number };

  fetchCompanyData: (companyId: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 상태 관리소 (persist 미들웨어 적용)
// ─────────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      companyName: "",
      industry: "금 제련업",
      money: 1000000,
      currency: "₩",
      capital: 5000000,
      debt: 2000000,
      warehouseMaxSlots: 10,
      inventoryMax: 4,
      alerts: [
        { id: "mock11", message: "[시장] 경쟁사 신제품 출시 소식", detail: "시장 점유율에 영향을 미칠 수 있습니다.", timeAgo: "방금 전", read: false },
        { id: "mock1", message: "[시스템] 시장 조사 보고서가 도착했습니다.", detail: "금주 수요량 증가 예상", timeAgo: "1분 전", read: false },
        { id: "mock2", message: "[창고] 자재 물류 트럭 도착", detail: "고급 철재 500개 입고 대기 중", timeAgo: "3분 전", read: false },
        { id: "mock12", message: "[재무] 이달의 법인세 납부 안내", detail: "기한 내 납부하지 않으면 가산세가 부과됩니다.", timeAgo: "10분 전", read: false },
        { id: "mock3", message: "[인사] 신입 사원 면접 평가 완료", timeAgo: "20분 전", read: true },
        { id: "mock13", message: "[시스템] 게임 클라이언트 업데이트 (v1.2.0)", detail: "UI 테마 및 성능 개선이 확정되었습니다.", timeAgo: "2시간 전", read: true },
        { id: "mock4", message: "[생산] 라인 A 점검 알림", detail: "정기 점검까지 2시간 남았습니다. 생산에 유의하세요.", timeAgo: "3시간 전", read: true },
        { id: "mock5", message: "[은행] 대출 이자율 변동 안내", timeAgo: "어제", read: true }
      ],
      news: [
        { id: "news1", headline: "속보! [O][O]공장 석유 유출 사고...", date: "TODAY 3rd Mar", isBreaking: true, summary: "대규모 환경 오염 우려" },
        { id: "news2", headline: "철강 가격 3개월 만에 최고치 경신", date: "2nd Mar", isBreaking: false },
      ],
      activeModal: null,
      selectedBuilding: null,
      activeBuildingPage: null,
      bankData: { loanRate: 5.5, depositRate: 2.3, currentLoan: 500000, currentDeposit: 150000 },
      warehouseItems: [
        { id: "m1", type: "material", quantity: 47 },
        { id: "p1", type: "product", quantity: 253 },
      ],
      hrData: { currentLevel: 1, expectedLevel: 2, successRate: 70, materialCurrent: 1, materialMax: 2 },
      isLoading: false,
      // 인베토리 아이템 (mock 시작값: 견습 광부 1개)
      inventoryItems: [
        { id: "inv_default_1", type: "worker_수습_광부", name: "수습 광부", icon: "⛏️", quantity: 1, level: 1, workerType: "miner" },
      ],
      warehouseExpandTickets: 0,
      inventoryExpandTickets: 0,

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
          inventoryItems: [...state.inventoryItems, { ...item, id: "inv_" + Date.now() + "_" + Math.random().toString(36).slice(2) }]
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

      getIndustryItemNames: () => {
        const ind = get().industry;
        if (ind === "금광업") return { material: "광산 드릴", product: "금광석", reqMat: 2, resProd: 40 };
        if (ind === "금 제련업" || ind === "제철업") return { material: "금광석", product: "금괴", reqMat: 12, resProd: 6 };
        if (ind === "제조업") return { material: "금괴", product: "광산 드릴", reqMat: 20, resProd: 2 };
        return { material: "재료", product: "생산품", reqMat: 1, resProd: 1 };
      },

      updateMoney: (amount) => {
        if (get().money + amount < 0) return false;
        set(state => ({ money: state.money + amount }));
        return true;
      },

      updateMaterial: (amount) => {
        const { usedSlots } = get().getWarehouseUsage();
        let actualAdded = amount;

        set(state => {
          const newItems = [...state.warehouseItems];
          const matIdx = newItems.findIndex(i => i.type === "material");
          const currentQty = matIdx >= 0 ? newItems[matIdx].quantity : 0;

          if (amount < 0) {
            if (currentQty + amount < 0) return state;
            actualAdded = amount;
          } else {
            const totalQty = newItems.reduce((acc, i) => acc + i.quantity, 0);
            const freeSpace = (state.warehouseMaxSlots * MAX_PER_SLOT) - totalQty;
            actualAdded = Math.min(amount, freeSpace);
          }

          if (matIdx >= 0) {
            newItems[matIdx] = { ...newItems[matIdx], quantity: currentQty + actualAdded };
          } else {
            newItems.push({ id: "m1", type: "material", quantity: actualAdded });
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
            const totalQty = newItems.reduce((acc, i) => acc + i.quantity, 0);
            const freeSpace = (state.warehouseMaxSlots * MAX_PER_SLOT) - totalQty;
            actualAdded = Math.min(amount, freeSpace);
          }

          if (pIdx >= 0) {
            newItems[pIdx] = { ...newItems[pIdx], quantity: currentQty + actualAdded };
          } else {
            newItems.push({ id: "p1", type: "product", quantity: actualAdded });
          }
          return { warehouseItems: newItems };
        });
        return actualAdded;
      },

      fetchCompanyData: async (companyId: number) => {
        set({ isLoading: true });
        try {
          const response = await CompanyAPI.getStatus(companyId);
          const realData = response.data;

          set({
            money: realData?.cash ?? get().money,
            capital: realData?.total_asset ?? get().capital,
            companyName: realData?.name ?? get().companyName,
            industry: realData?.industry_type ?? get().industry,
            warehouseMaxSlots: realData?.slots?.warehouse_slots ?? get().warehouseMaxSlots,
            inventoryMax: realData?.slots?.inventory_slots ?? get().inventoryMax,
            isLoading: false
          });
        } catch (error) {
          console.error("회사 정보 불러오기 실패:", error);
          set({ isLoading: false });
        }
      }
    }),
    { name: "game-storage" }
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