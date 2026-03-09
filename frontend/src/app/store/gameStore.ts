import { createContext, useContext } from "react";

export type ModalTab = "profile" | "news" | "politics" | "incentive" | "inventory" | "notification" | "settings" | null;

export type BuildingPage = "hr" | "bank" | "warehouse" | "minigame" | "factory" | "market" | null;

export interface Notification {
  id: string;
  message: string;
  detail?: string;
  timeAgo: string;
  read: boolean;
}

export interface NewsItem {
  id: string;
  headline: string;
  date: string;
  isBreaking?: boolean;
  summary?: string;
}

export interface BankData {
  loanRate: number;
  depositRate: number;
  currentLoan: number;
  currentDeposit: number;
}

export interface WarehouseItem {
  id: string;
  name: string;
  type: "material" | "product";
  quantity: number;
  maxQuantity: number;
}

export interface HRData {
  currentLevel: number;
  expectedLevel: number;
  successRate: number;
  materialCurrent: number;
  materialMax: number;
}

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
  notifications: Notification[];
  news: NewsItem[];
  activeModal: ModalTab;
  selectedBuilding: string | null;
  activeBuildingPage: BuildingPage;
  bankData: BankData;
  warehouseItems: WarehouseItem[];
  hrData: HRData;
}

export const defaultGameState: GameState = {
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
  notifications: [
    { id: "n1", message: "철광석 매입 완료", detail: "2,500원 30개 완료", timeAgo: "방금 전", read: false },
    { id: "n2", message: "철수 괴 판매", detail: "시장가 판매 완료", timeAgo: "5분 전", read: false },
    { id: "n3", message: "재료 부족 - 작업 중단", detail: "철광석 재고 부족", timeAgo: "2시간 전", read: false },
    { id: "n4", message: "강화 성공 / 대출 상환 / 아이템 획득 등", detail: "강화 +2 성공", timeAgo: "3시간 전", read: true },
  ],
  news: [
    { id: "news1", headline: "속보! [O][O][O]공장 석유 유출 사고...", date: "TODAY 3rd Mar", isBreaking: true, summary: "대규모 환경 오염 우려" },
    { id: "news2", headline: "철강 가격 3개월 만에 최고치 경신", date: "2nd Mar", isBreaking: false },
    { id: "news3", headline: "정부, 제철업 보조금 확대 방안 발표", date: "1st Mar", isBreaking: false },
    { id: "news4", headline: "글로벌 원자재 시장 불안정 지속", date: "28th Feb", isBreaking: false },
    { id: "news5", headline: "신규 광산 개발 허가 승인", date: "27th Feb", isBreaking: false },
  ],
  activeModal: null,
  selectedBuilding: null,
  activeBuildingPage: null,
  bankData: {
    loanRate: 5.5,
    depositRate: 2.3,
    currentLoan: 500000,
    currentDeposit: 150000,
  },
  warehouseItems: [
    { id: "m1", name: "재료", type: "material", quantity: 100, maxQuantity: 200 },
    { id: "m2", name: "재료", type: "material", quantity: 100, maxQuantity: 200 },
    { id: "m3", name: "재료", type: "material", quantity: 64, maxQuantity: 200 },
    { id: "p1", name: "상품", type: "product", quantity: 99, maxQuantity: 200 },
  ],
  hrData: {
    currentLevel: 1,
    expectedLevel: 2,
    successRate: 70,
    materialCurrent: 1,
    materialMax: 2,
  },
};

export interface GameContextType {
  state: GameState;
  openModal: (tab: ModalTab) => void;
  closeModal: () => void;
  switchTab: (tab: ModalTab) => void;
  dismissNotification: (id: string) => void;
  selectBuilding: (building: string | null) => void;
  openBuildingPage: (page: BuildingPage) => void;
  closeBuildingPage: () => void;
}

export const GameContext = createContext<GameContextType | null>(null);

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}