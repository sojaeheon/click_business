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
    endTime: number | null;
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
  addAlert: (alertData: Omit<Alert, 'id' | 'timeAgo' | 'read'>) => void;
  markAllAlertsAsRead: () => void;

  // 은행 데이터 동기화
  updateBankData: (data: Partial<BankData>) => void;
  updateDebt: (amount: number) => void; // 양수 = 부칄 증가, 음수 = 부칄 감소

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

    workstationState: {
      isStarting: false,
      isWorking: false,
      startTime: 0,
      totalMs: 0,
      endTime: null,
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

        const allItems: InventoryItem[] = inventoryRes.data.map((item: any) => item);

        const finalIndustry = realData?.industry_type ?? get().industry;
        const { material, product } = get().getIndustryItemNames(finalIndustry);

        const fixedWarehouseItems = (warehouseRes.data as WarehouseItem[]).map(item => ({
          ...item,
          name: item.type === "material" ? material : item.type === "product" ? product : item.name
        }));

        const warehouseMaxSlotsFromApi = (warehouseRes as any).maxSlots;
        const inventoryMaxSlotsFromApi = (inventoryRes as any).maxSlots;

        // ★ 작업장 상태: endTime을 폴링 시 덮어쓰지 않도록 보호
        const backendIsWorking = wsStatusRes.data?.isWorking ?? false;
        const currentEndTime = get().workstationState.endTime;

        // endTime 결정 로직:
        // 1. 작업 안 하면 → null (리셋)
        // 2. 작업 중이고 이미 endTime 있으면 → 기존 값 유지 (폴링이 덮어쓰지 않음)
        // 3. 작업 중인데 endTime 없으면 → 백엔드에서 받아옴 (최초 1회)
        let resolvedEndTime: number | null;
        if (!backendIsWorking) {
          resolvedEndTime = null;
        } else if (currentEndTime) {
          resolvedEndTime = currentEndTime;
        } else {
          resolvedEndTime = wsStatusRes.data?.expectedEndTime
            ? new Date(wsStatusRes.data.expectedEndTime).getTime()
            : null;
        }

        // ★ requestedQty 역산: 백엔드는 reservedQuantity(남은 재료)만 주므로
        // 산업별 비율로 "총 생산품 수량"을 계산
        // 예: 제조업 - 재료 20개 → 생산품 2개, reservedQty=0 + producedQty=2 → 총 2개
        const { reqMat, resProd } = get().getIndustryItemNames(finalIndustry);
        const reserved = wsStatusRes.data?.reservedQuantity ?? 0;
        const produced = wsStatusRes.data?.producedQuantity ?? 0;
        const consumedLaps = resProd > 0 ? Math.floor(produced / resProd) : 0;
        const remainingLaps = reqMat > 0 ? Math.floor(reserved / reqMat) : 0;
        const totalExpectedOutput = (consumedLaps + remainingLaps) * resProd;
        // 이미 설정된 값이 있으면 유지 (작업 시작 시 프론트에서 직접 세팅한 값)
        const resolvedRequestedQty = totalExpectedOutput > 0
          ? totalExpectedOutput
          : get().workstationState.requestedQty;

        set({
          money: realData?.cash ?? get().money,
          capital: realData?.total_asset ?? get().capital,
          companyName: realData?.name ?? get().companyName,
          industry: finalIndustry,
          warehouseMaxSlots: warehouseMaxSlotsFromApi ?? realData?.slots?.warehouse_slots ?? (get().warehouseMaxSlots === 10 ? 6 : get().warehouseMaxSlots),
          inventoryMax: inventoryMaxSlotsFromApi ?? realData?.slots?.inventory_slots ?? (get().inventoryMax === 50 ? 4 : get().inventoryMax),
          warehouseItems: fixedWarehouseItems,
          inventoryItems: allItems,
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
          workstationId: typeof workstationIdRes === "number" ? workstationIdRes : (workstationIdRes as any)?.data ?? 0,
          workstationState: {
            ...get().workstationState,
            isWorking: backendIsWorking,
            producedCount: produced,
            storedCount: produced,
            requestedQty: resolvedRequestedQty,
            endTime: resolvedEndTime,
          },
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