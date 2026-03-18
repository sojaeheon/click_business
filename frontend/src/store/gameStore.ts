import { create } from "zustand";
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
  warehouseMaxSlots: number; // 총 창고 슬롯 칸 (예: 10칸)
  inventoryMax: number;

  // 파생 상태 (혹은 계산 가능하지만 store에 포함)
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

  // 새로 추가되는 게임 로직 액션들
  setCompanyInfo: (name: string, industry: string) => void;
  updateMoney: (amount: number) => boolean;
  updateMaterial: (amount: number) => number; // 실제 변경된 수량 반환
  updateProduct: (amount: number) => number;
  addAlert: (alertData: Omit<Alert, 'id' | 'timeAgo' | 'read'>) => void;
  markAllAlertsAsRead: () => void;

  getWarehouseUsage: () => { usedSlots: number; percent: number };
  getIndustryItemNames: () => { material: string; product: string; reqMat: number; resProd: number };

  fetchCompanyData: (companyId: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 상태 관리소 (내부에서만 사용됨)
// ─────────────────────────────────────────────────────────────────────────
import { persist } from "zustand/middleware";

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      companyName: "",
      industry: "금 제련업",  // 기본값: 유효한 산업 (IndustrySelectionPage에서 덮어씀)
      money: 1000000,
      currency: "₩",
      capital: 5000000,
      debt: 2000000,
      warehouseMaxSlots: 10,
      inventoryMax: 50,
      alerts: [],
      news: [
        { id: "news1", headline: "속보! [O][O][O]공장 석유 유출 사고...", date: "TODAY 3rd Mar", isBreaking: true, summary: "대규모 환경 오염 우려" },
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
        // 음수면 차감, 양수면 증가. 창고 여유 슬롯 검사
        const { usedSlots } = get().getWarehouseUsage();
        let actualAdded = amount;

        set(state => {
          const newItems = [...state.warehouseItems];
          const matIdx = newItems.findIndex(i => i.type === "material");
          const currentQty = matIdx >= 0 ? newItems[matIdx].quantity : 0;

          if (amount < 0) {
            if (currentQty + amount < 0) return state; // 부족함
            actualAdded = amount;
          } else {
            // 증가 시, 최대 가능한 만큼만 계산
            const maxCanHold = (state.warehouseMaxSlots * MAX_PER_SLOT) - (state.warehouseItems.filter(i => i.type !== 'material').reduce((acc, i) => acc + Math.ceil(i.quantity / MAX_PER_SLOT), 0) * MAX_PER_SLOT);
            // 매우 거친 방법이지만 간단히 슬롯 잔여로 계산
            // 정확히는 "총 용량 1000 - 총 수량" 이 아니라 슬롯 단위로 나뉘므로 약간 다름. 간단히 총 개수로 제약을 걸 수도 있음.
            // 여기선 요구사항인 "슬롯당 100개, 총 10슬롯 = 1000개. 즉 전체 아이템 합 < 1000 유지"로 근사함.
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
            if (currentQty + amount < 0) return state; // 부족함
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
          // 🚨 gameApi.ts에 있는 getStatus 함수를 호출하도록 수정했습니다.
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
    }), { name: 'game-storage' }
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