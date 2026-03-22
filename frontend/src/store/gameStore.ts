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
        await get().fetchCompanyData(1);
      } catch (error) {
        console.error("일꾼 장착 실패:", error);
        throw error;
      }
    },

    unequipWorker: async () => {
      try {
        await WorkstationAPI.unequipWorker();
        await get().fetchCompanyData(1);
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
      endTime: null,
      requestedQty: 0,
      storedCount: 0,
      producedCount: 0,
      minuteOutput: null,
      workerLevel: null,
      speedMultiplier: null,
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

        // ✅ 인벤토리 아이템 매핑 (백엔드 필드명 방어적으로 처리)
        const allItems: InventoryItem[] = (inventoryRes.data as any[]).map((item: any) => {
          const workerLevel = item.level ?? item.workerLevel ?? item.worker_level ?? 1;
          const itemType: InventoryItemType = item.type?.startsWith('ticket_')
            ? item.type
            : `worker_lv${workerLevel}` as InventoryItemType;
          return {
            id: item.id ?? `slot_${Math.random().toString(36).substr(2, 9)}`,
            slotId: item.slotId,
            slotIndex: item.slotIndex,
            type: itemType,
            name: item.name ?? "아이템",
            icon: item.icon ?? "",
            quantity: item.quantity ?? 1,
            level: workerLevel,
            equipped: !!item.equipped
          };
        });

        const finalIndustry = realData?.industry_type ?? get().industry;
        const { material, product } = get().getIndustryItemNames(finalIndustry);

        const fixedWarehouseItems = (warehouseRes.data as WarehouseItem[]).map(item => ({
          ...item,
          name: item.type === "material" ? material : item.type === "product" ? product : item.name
        }));

        const warehouseMaxSlotsFromApi = (warehouseRes as any).maxSlots;
        const inventoryMaxSlotsFromApi = (inventoryRes as any).maxSlots;

        // ─── 작업장 상태 결정 ──────────────────────────────────────────
        const backendIsWorking = wsStatusRes.data?.isWorking ?? false;
        const currentState = get().workstationState;

        // ★★★ 핵심: 프론트에서 이미 "완료"로 판정해 isWorking=false로 세팅한 경우,
        //   백엔드가 아직 isActive=true를 반환해도 덮어쓰지 않음 (타이머 재시작 방지)
        const locallyCompleted = !currentState.isWorking && currentState.startTime > 0;
        const resolvedIsWorking = locallyCompleted ? false : backendIsWorking;

        // endTime 결정 로직
        let resolvedEndTime: number | null;
        if (!resolvedIsWorking) {
          // 작업이 끝났거나 로컬에서 완료 판정 → endTime 초기화
          resolvedEndTime = locallyCompleted ? null : currentState.endTime;
        } else if (currentState.endTime) {
          // 작업 중이고 이미 endTime 있으면 → 기존 값 유지 (폴링이 덮어쓰지 않음)
          resolvedEndTime = currentState.endTime;
        } else {
          // 작업 중인데 endTime 없으면 → 백엔드에서 받아옴 (최초 1회)
          resolvedEndTime = wsStatusRes.data?.expectedEndTime
            ? new Date(wsStatusRes.data.expectedEndTime).getTime()
            : null;
        }

        // ★★★ requestedQty: 프론트에서 작업 시작 시 세팅한 값 우선 유지
        //   백엔드의 reservedQuantity는 재료 수량이므로 산업별 비율로 역산
        const { reqMat, resProd } = get().getIndustryItemNames(finalIndustry);
        const produced = wsStatusRes.data?.producedQuantity ?? 0;
        const reserved = wsStatusRes.data?.reservedQuantity ?? 0;
        const consumedLaps = resProd > 0 ? Math.floor(produced / resProd) : 0;
        const remainingLaps = reqMat > 0 ? Math.floor(reserved / reqMat) : 0;
        const backendTotalOutput = (consumedLaps + remainingLaps) * resProd;

        // 이미 프론트에서 세팅된 requestedQty가 있으면 유지, 없으면 백엔드 역산값 사용
        const resolvedRequestedQty = currentState.requestedQty > 0
          ? currentState.requestedQty
          : (backendTotalOutput > 0 ? backendTotalOutput : 0);

        // startTime/totalMs: 작업 중인데 없으면 백엔드 endTime 기반으로 역산
        let resolvedStartTime = currentState.startTime;
        let resolvedTotalMs = currentState.totalMs;
        if (resolvedIsWorking && resolvedStartTime === 0 && resolvedEndTime) {
          // 폴링 초기 진입 시: 현재 시각과 endTime으로 대략적인 startTime+totalMs 추정
          // (정확한 값은 start 시 프론트에서 직접 세팅)
          resolvedEndTime = resolvedEndTime; // already set above
        }

        // ★ 수확(harvest) 이후 producedCount/storedCount 처리:
        //   백엔드가 harvest 직후에도 isActive=true로 응답할 수 있음.
        //   storedCount는 백엔드 producedQuantity 기준으로 갱신 (harvest 후 0이 됨).
        const resolvedProducedCount = resolvedIsWorking ? produced : 0;
        const resolvedStoredCount = wsStatusRes.data?.producedQuantity ?? 0;

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
          equippedWorkerId: allItems.find(i => i.equipped)?.id ?? null,
          workstationState: {
            ...currentState,
            isWorking: resolvedIsWorking,
            startTime: resolvedStartTime,
            totalMs: resolvedTotalMs,
            endTime: resolvedEndTime,
            producedCount: resolvedProducedCount,
            storedCount: resolvedStoredCount,
            requestedQty: resolvedRequestedQty,
            // ✅ 백엔드 production 메타데이터 갱신 (없으면 기존값 유지)
            minuteOutput: wsStatusRes.data?.minuteOutput ?? currentState.minuteOutput,
            workerLevel: wsStatusRes.data?.workerLevel ?? currentState.workerLevel,
            speedMultiplier: wsStatusRes.data?.speedMultiplier ?? currentState.speedMultiplier,
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