import { apiClient } from './client';

// 💡 헬퍼 함수: 가짜 로딩 시간(0.5초)을 만들어주는 함수입니다.
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const CompanyAPI = {
  getStatus: async (companyId: number) => {
    // ❌ 원래 코드: return apiClient.get(`/companies/${companyId}/status`);
    // ✅ 목업 데이터
    await mockDelay();
    return {
      data: {
        name: "딸깍 컴퍼니",
        industry_type: "제철업",
        cash: 5000000,          // 500만 원
        total_asset: 12000000,  // 자본금 1200만 원
        slots: {
          warehouse_slots: 10,
          inventory_slots: 50
        }
      }
    };
  },
};

export const WorkstationAPI = {
  getStatus: async (companyId: number) => {
    // return apiClient.get('/workstations', { params: { companyId } });
    await mockDelay();
    return { data: { isWorking: false, progress: 0 } };
  },
  start: async (data: { companyId: number; recipeId: number; quantity: number; workerId: number }) => {
    // return apiClient.post('/workstations/start', data);
    await mockDelay();
    return { data: { success: true, message: "작업이 시작되었습니다." } };
  },
  collect: async (companyId: number) => {
    // return apiClient.post('/workstations/collect', { companyId });
    await mockDelay();
    return { data: { success: true, message: "수령 완료" } };
  }
};

export const MarketAPI = {
  getOrderbook: async (itemId: number) => {
    // return apiClient.get('/market/orderbook', { params: { itemId } });
    await mockDelay();
    return {
      data: [
        { price: 3000, qty: 50, type: 'SELL' },
        { price: 2900, qty: 120, type: 'SELL' },
        { price: 2800, qty: 200, type: 'BUY' },
        { price: 2700, qty: 80, type: 'BUY' },
      ]
    };
  },
  createOrder: (data: { companyId: number; itemId: number; type: 'BUY' | 'SELL'; price: number; qty: number }) => apiClient.post('/market/orders', data),
  cancelOrder: (orderId: number, companyId: number) => apiClient.delete('/market/orders/' + orderId, { params: { companyId } }),
  getMarketChart: (itemId: number, range: '1D' | '1W' | '1M' = '1D') => apiClient.get('/market/charts', { params: { itemId, range } }),
};

export const BankAPI = {
  getSummary: async (companyId: number) => {
    // return apiClient.get('/bank/summary', { params: { companyId } });
    await mockDelay();
    return { data: { loanRate: 5.5, depositRate: 2.3, currentLoan: 1000000, currentDeposit: 500000 } };
  },
  processLoan: (data: { companyId: number; type: 'BORROW' | 'REPAY' | 'DEPOSIT' | 'WITHDRAW'; amount: number }) => apiClient.post('/bank/loans', data)
};

export const HRAPI = {
  recruitWorker: (data: { companyId: number; type: 'NORMAL' | 'PREMIUM' }) => apiClient.post('/hr/recruit', data),
  upgradeWorker: (data: { companyId: number; currentLevel: number }) => apiClient.post('/hr/upgrade', data),
};

export const MinigameAPI = {
  claimReward: async (data: { companyId: number; clicks: number; isFever: boolean }) => {
    // return apiClient.post('/minigame/claim', data);
    await mockDelay();
    return { data: { success: true, reward: 500 } };
  },
  unlockGame: async (data: { companyId: number; amount: number }) => {
    // return apiClient.post('/minigame/unlock', data);
    await mockDelay();
    return { data: { success: true } };
  },
};

export const RankingAPI = {
  getTopRanks: async () => {
    // ❌ 원래 코드: return apiClient.get('/ranking/top');
    // ✅ 랭킹 모달용 가짜 데이터
    await mockDelay();
    return {
      data: [
        { rank: 1, companyName: "삼성제철", score: 99999, tier: "챌린저" },
        { rank: 2, companyName: "현대광업", score: 88888, tier: "다이아" },
        { rank: 3, companyName: "딸깍 컴퍼니", score: 77777, tier: "플래티넘" },
        { rank: 4, companyName: "SSAFY 광물", score: 66666, tier: "골드" },
        { rank: 5, companyName: "개미구멍", score: 55555, tier: "실버" },
      ]
    };
  },
};

export const InventoryAPI = {
  getInventory: async (companyId: number) => {
    // ❌ 원래 코드: return apiClient.get('/inventory', { params: { companyId } });
    // ✅ 인벤토리 슬롯용 가짜 데이터
    await mockDelay();
    return {
      data: [
        { id: 1, name: "수습 광부", level: 1, locked: false },
        { id: 2, name: "숙련된 제련공", level: 3, locked: false },
        { id: 3, name: "전설의 대장장이", level: 5, locked: false },
        { id: 4, locked: false }, // 비어있는 슬롯
        { id: 5, locked: true },  // 잠긴 슬롯
        { id: 6, locked: true },  // 잠긴 슬롯
      ]
    };
  },
  unlockSlot: async (data: { companyId: number; slotId: number }) => {
    // return apiClient.post('/inventory/unlock', data);
    await mockDelay();
    return { data: { success: true } };
  },
};