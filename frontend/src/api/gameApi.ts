import { apiClient } from './client';
import { WORKER_DEFINITIONS } from '../constants/workers';

// 💡 헬퍼 함수: 가짜 로딩 시간(0.5초)을 만들어주는 함수입니다.
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

export const CompanyAPI = {
  getStatus: async (companyId: number) => {
    // ✅ 실제 연동 + 아직 백엔드에 없는 데이터(재화 등)는 목업 데이터와 병합
    try {
      const res = await apiClient.get('/companies/me');
      const company = res.data?.data;
      if (!company) throw new Error("API 연동 실패 (데이터 누락)");
      return {
        data: {
          name: company.company_name ?? company.name,
          industry_type: company.industry_type, // 서버 데이터 우선
          cash: company.cash ?? 5000000,          // TODO: 백엔드 추가 필요
          total_asset: company.total_asset ?? 12000000,  // TODO: 백엔드 추가 필요
          slots: company.slots ?? { warehouse_slots: 10, inventory_slots: 50 }, // TODO
        }
      };
    } catch (err) {
      console.warn("API 연동 실패! CompanyAPI.getStatus 목업 데이터 사용", err);
      await mockDelay();
      return {
        data: {
          name: undefined,         // store에 있는 기존 로컬 정보 유지
          industry_type: undefined, // store에 있는 기존 로컬 정보 유지
          cash: 5000000,
          total_asset: 12000000,
          slots: { warehouse_slots: 10, inventory_slots: 50 }
        }
      };
    }
  },

  /** 회사 최초 생성 (산업선택 페이지에서 호출) */
  create: async (data: { companyName: string; industryType: string }) => {
    try {
      // ✅ POST /api/v1/companies  (API 명세서 기준)
      const res = await apiClient.post('/companies', {
        company_name: data.companyName,
        industry_type: data.industryType,
      });
      return { data: res.data?.data ?? { success: true } };
    } catch (err) {
      console.warn("CompanyAPI.create 목업 폴백:", err);
      await mockDelay(300);
      return { data: { success: true, mock: true } };
    }
  },
};

// 💡 작업장(Workstation) 백엔드 연동 전 임시 테스트용 목업 상태
let mockWorkIsWorking = false;
let mockWorkProgress = 0;      // 0 ~ 100 퍼센트
let mockWorkTotalQuantity = 0; // 총 생산 예상 개수 (유저 입력값)
let mockWorkUncollected = 0;   // 생산 완료된 미수령 아이템 개수
let mockWorkInterval: ReturnType<typeof setInterval> | null = null;
let mockWorkStartedAt = 0;     // 작업 시작 timestamp(ms)
let mockWorkTotalMs = 0;       // 총 소요 예상 시간(ms)

export const WorkstationAPI = {
  getStatus: async (companyId: number) => {
    // ✅ 실제 API 연결: GET /api/v1/workstations/{workstationId}
    try {
      const res = await apiClient.get('/workstations/1');
      const data = res.data.data;
      return {
        data: {
          isWorking: data.isActive,
          progress: data.progress ?? 0,
          producedQuantity: data.outputQuantity ?? data.producedQuantity ?? 0,
          totalQuantity: data.reservedQuantity ?? data.totalQuantity ?? 0,
          remainingMs: null as number | null, // 백엔드 미지원 → null
        }
      };
    } catch (err) {
      console.warn("API 연동 실패! WorkstationAPI.getStatus 목업 데이터 사용", err);
      const elapsed = mockWorkIsWorking ? Date.now() - mockWorkStartedAt : 0;
      const remaining = mockWorkIsWorking ? Math.max(0, mockWorkTotalMs - elapsed) : 0;
      return {
        data: {
          isWorking: mockWorkIsWorking,
          progress: Math.min(100, mockWorkProgress),
          producedQuantity: mockWorkUncollected,
          totalQuantity: mockWorkTotalQuantity || 0,
          remainingMs: mockWorkIsWorking ? remaining : null,
        }
      };
    }
  },
  // data.quantity = 유저가 요청한 생산 개수 (개 단위)
  // 시간 = (quantity / resProd) × 60초 비례 계산
  start: async (data: { companyId: number; recipeId: number; quantity: number; workerId: number }) => {
    let resProd = 1;
    let reqMat = 1;
    try {
      const { useGameStore } = await import('../store/gameStore');
      const names = useGameStore.getState().getIndustryItemNames();
      resProd = names.resProd;
      reqMat = names.reqMat;
    } catch (e) {}

    // 개수 비례 계산 (사이클 올림 없이 qty 그대로 반영)
    const ratio = data.quantity / resProd;
    const reserveQty = Math.ceil(ratio * reqMat); // 재료 (API reserve용)

    try {
      // ✅ 실제 API: reserve로 재료 예약 → toggle로 가동 시작
      await apiClient.post(`/workstations/1/reserve`, { quantity: reserveQty });
      await apiClient.post(`/workstations/1/toggle`);
      return { data: { success: true, message: "작업이 시작되었습니다." } };
    } catch (err) {
      console.warn("API 연동 실패! WorkstationAPI.start 목업 데이터 사용", err);
      await mockDelay();

      // 비례 시간: qty/resProd × 60000ms
      const totalMs = Math.ceil(ratio * 60000);
      mockWorkTotalQuantity = data.quantity; // 목표 개수 = 유저 입력 그대로
      mockWorkUncollected = 0;
      mockWorkIsWorking = true;
      mockWorkProgress = 0;
      mockWorkStartedAt = Date.now();
      mockWorkTotalMs = totalMs;

      let producedSoFar = 0;
      if (mockWorkInterval) { clearInterval(mockWorkInterval); mockWorkInterval = null; }
      const intervalMs = 500;
      const totalTicks = totalMs / intervalMs;
      const tickPercent = 100 / totalTicks;

      mockWorkInterval = setInterval(() => {
        if (mockWorkProgress < 100) {
          mockWorkProgress += tickPercent;
          if (mockWorkProgress > 100) mockWorkProgress = 100;
          const expectedItems = Math.floor((mockWorkProgress / 100) * mockWorkTotalQuantity);
          const newlyProduced = expectedItems - producedSoFar;
          if (newlyProduced > 0) {
            mockWorkUncollected += newlyProduced;
            producedSoFar = expectedItems;
          }
        } else {
          if (mockWorkInterval) { clearInterval(mockWorkInterval); mockWorkInterval = null; }
          mockWorkIsWorking = false;
        }
      }, intervalMs);

      return { data: { success: true, message: "작업이 시작되었습니다. (Mock)" } };
    }
  },
  collect: async (companyId: number) => {
    // ✅ 실제 API 연결: POST /api/v1/workstations/{workstationId}/harvest
    try {
      await apiClient.post(`/workstations/1/harvest`);
      return { data: { success: true, message: "수령 완료" } };
    } catch (err) {
      console.warn("API 연동 실패! WorkstationAPI.collect 목업 데이터 사용", err);
      await mockDelay();

      // 중간 수령 처리: 미수령 개수만 0으로 비움 (진행도는 그대로, 아직 작업중이면 계속 작업)
      mockWorkUncollected = 0;
      
      // 이미 100% 진행된 상태에서 수납했다면 작업 완료된 것으로 보고 상태 리셋
      if (mockWorkProgress >= 100) {
          mockWorkProgress = 0;
          mockWorkIsWorking = false;
      }

      return { data: { success: true, message: "수령 완료 (Mock)" } };

    }
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
  createOrder: async (data: { companyId: number; itemId: number; type: 'BUY' | 'SELL'; price: number; qty: number }) => {
    // ✅ 실제 API 연동
    return apiClient.post('/market/orders', {
      itemId: data.itemId,
      orderType: data.type,
      price: data.price,
      totalQuantity: data.qty
    });
  },
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
    // ✅ 실제 API 연동: GET /api/v1/inventory
    try {
      const res = await apiClient.get('/inventory');
      return {
        data: res.data.data.map((slot: any) => ({
          id: slot.itemId || (slot.slotIndex * 1000), // id가 없으면 고유 임시 id
          name: slot.itemName || undefined,
          level: slot.itemType === 'EQUIPMENT' ? slot.quantity : 1, // 장비는 quantity 등 화면 요구에 맞춤
          locked: false, // 백엔드에 아직 locked 컬럼 미지원
          quantity: slot.quantity,
          slotIndex: slot.slotIndex
        }))
      };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.getInventory 목업 데이터 사용", err);
      await mockDelay();
      return {
        data: WORKER_DEFINITIONS.map((w, i) => ({
          id: i + 1,
          name: w.displayName,
          level: 1,
          locked: i >= 4,  // 5번째부터 잠김
          quantity: i < 3 ? 2 : 1, // 낮은 레벨은 2개 보유
          icon: w.icon,
          modelPath: w.modelPath,
          workerType: w.type,
        }))
      };
    }
  },
  unlockSlot: async (data: { companyId: number; slotId: number }) => {
    try {
      // ✅ 실제 API 연동 (확장권 사용)
      await apiClient.post('/inventory/expand', null, { params: { ticketSlotIndex: data.slotId } });
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.unlockSlot 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true } };
    }
  },
};