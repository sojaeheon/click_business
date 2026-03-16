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
export interface WarehouseItem { id: string; name: string; type: "material" | "product"; quantity: number; maxQuantity: number; }
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
  warehouseUsed: number;
  warehouseMax: number;
  inventoryUsed: number;
  inventoryMax: number;
  inventoryPercent: number;
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

  fetchCompanyData: (companyId: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. 상태 관리소 (내부에서만 사용됨)
// ─────────────────────────────────────────────────────────────────────────
export const useGameStore = create<GameState>((set, get) => ({
  companyName: "철 좀 들자",
  industry: "제철업",
  money: 1000000,
  currency: "₵",
  capital: 5000000,
  debt: 2000000,
  warehouseUsed: 448,
  warehouseMax: 500,
  inventoryUsed: 32,
  inventoryMax: 50,
  inventoryPercent: 89.6,
  alerts: [
    { id: "n1", message: "철광석 매입 완료", detail: "2,500원 30개 완료", timeAgo: "방금 전", read: false },
    { id: "n2", message: "철수 괴 판매", detail: "시장가 판매 완료", timeAgo: "5분 전", read: false },
    { id: "n3", message: "재료 부족 - 작업 중단", detail: "철광석 재고 부족", timeAgo: "2시간 전", read: false },
    { id: "n4", message: "강화 성공 / 대출 상환 / 아이템 획득 등", detail: "강화 +2 성공", timeAgo: "3시간 전", read: true },
  ],
  news: [
    { id: "news1", headline: "속보! [O][O][O]공장 석유 유출 사고...", date: "TODAY 3rd Mar", isBreaking: true, summary: "대규모 환경 오염 우려" },
    { id: "news2", headline: "철강 가격 3개월 만에 최고치 경신", date: "2nd Mar", isBreaking: false },
  ],
  activeModal: null,
  selectedBuilding: null,
  activeBuildingPage: null,
  bankData: { loanRate: 5.5, depositRate: 2.3, currentLoan: 500000, currentDeposit: 150000 },
  warehouseItems: [
    { id: "m1", name: "재료", type: "material", quantity: 100, maxQuantity: 200 },
    { id: "p1", name: "상품", type: "product", quantity: 99, maxQuantity: 200 },
  ],
  hrData: { currentLevel: 1, expectedLevel: 2, successRate: 70, materialCurrent: 1, materialMax: 2 },
  isLoading: false,

  openModal: (tab) => set({ activeModal: tab }),
  closeModal: () => set({ activeModal: null }),
  switchTab: (tab) => set({ activeModal: tab }),
  dismissAlert: (id) => set((state) => ({ 
      alerts: state.alerts.filter(alert => alert.id !== id) 
  })),
  selectBuilding: (building) => set({ selectedBuilding: building }),
  openBuildingPage: (page) => set({ activeBuildingPage: page }),
  closeBuildingPage: () => set({ activeBuildingPage: null }),

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
          warehouseMax: realData?.slots?.warehouse_slots ?? get().warehouseMax,
          inventoryMax: realData?.slots?.inventory_slots ?? get().inventoryMax,
          isLoading: false 
      });
    } catch (error) {
      console.error("회사 정보 불러오기 실패:", error);
      set({ isLoading: false });
    }
  }
}));

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
    selectBuilding: store.selectBuilding,
    openBuildingPage: store.openBuildingPage,
    closeBuildingPage: store.closeBuildingPage,
    setGameState: () => console.warn("Zustand 적용으로 setGameState는 더 이상 필요하지 않습니다."),
  };
}

export const defaultGameState = useGameStore.getState();