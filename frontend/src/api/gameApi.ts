import { apiClient } from './client';
import { WORKER_DEFINITIONS } from '../constants/workers';

// 💡 헬퍼 함수: 가짜 로딩 시간(0.5초)을 만들어주는 함수입니다.
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const isGuestMode = () => localStorage.getItem('isGuest') === 'true';

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
          slots: company.slots ?? undefined, // 서버에서 slots를 반환하지 않으면 gameStore 기본값을 유지
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
          slots: undefined
        }
      };
    }
  },

  /** 회사 최초 생성 (산업선택 페이지에서 호출) */
  create: async (data: { companyName: string; industryType: string }) => {
    try {
      // ✅ POST /api/v1/companies  (API 명세서 기준)
      const res = await apiClient.post('/companies', {
        name: data.companyName,
        industryType: data.industryType,
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
    } catch (e) { }

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
  /** 📊 실시간 호가창 렌더링 */
  getOrderbook: async (itemId: number) => {
    try {
      const res = await apiClient.get('/market/orderbooks', { params: { item_id: itemId } });
      // 백엔드 응답 구조 디버그
      console.log("📦 raw res.data:", JSON.stringify(res.data));
      // ApiResponse { status, data: DTO } 또는 DTO 직접 반환 둘 다 처리
      const payload = res.data?.data ?? res.data;
      return { data: payload };
    } catch (err) {
      console.warn("MarketAPI.getOrderbook 실패:", err);
      return { data: { buyOrders: [], sellOrders: [], currentPrice: null } };
    }
  },

  /** 📝 지정가 주문 신청 */
  createOrder: async (data: { itemId: number; type: 'BUY' | 'SELL'; price: number; qty: number }) => {
    return apiClient.post('/market/orders', {
      itemId: data.itemId,
      orderType: data.type,
      price: data.price,
      totalQuantity: data.qty
    });
  },

  /** ❌ 주문 취소 */
  cancelOrder: (orderId: number) => apiClient.delete(`/market/orders/${orderId}`),

  /** 📈 체결 내역 조회 */
  getTrades: async (itemId: number) => {
    return apiClient.get('/market/trades', { params: { item_id: itemId } });
  },

  /** 💰 체결 결과 수령 */
  collectTrade: async (tradeHistoryId: number) => {
    return apiClient.post(`/market/orders/${tradeHistoryId}`);
  },

  getMarketChart: (itemId: number, range: '1D' | '1W' | '1M' = '1D') => apiClient.get('/market/charts', { params: { itemId, range } }),
};


export const BankAPI = {
  getSummary: async (companyId: number) => {
    try {
      const res = await apiClient.get('/bank/summary');
      return { data: res.data.data };
    } catch (err) {
      console.warn("API 연동 실패! BankAPI.getSummary 목업 데이터 사용", err);
      await mockDelay();
      return { data: { loanRate: 5.5, depositRate: 2.3, currentLoan: isGuestMode() ? 0 : 1000000, currentDeposit: isGuestMode() ? 0 : 500000 } };
    }
  },
  processLoan: (data: { companyId: number; type: 'BORROW' | 'REPAY' | 'DEPOSIT' | 'WITHDRAW'; amount: number }) => apiClient.post('/bank/loans', data)
};

export const HRAPI = {
  recruitWorker: (data: { companyId: number; type: 'NORMAL' | 'PREMIUM' }) => apiClient.post('/hr/recruit', data),
  upgradeWorker: (data: { companyId: number; currentLevel: number }) => apiClient.post('/hr/upgrade', data),
};

export const MinigameAPI = {
  claimReward: async (data: { companyId: number; clicks: number; isFever: boolean }) => {
    try {
      const res = await apiClient.post('/minigame/claim', data);
      return { data: res.data.data };
    } catch (err) {
      console.warn("API 연동 실패! MinigameAPI.claimReward 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true, reward: 500 } };
    }
  },
  unlockGame: async (data: { companyId: number; amount: number }) => {
    try {
      const res = await apiClient.post('/minigame/unlock', data);
      return { data: res.data.data };
    } catch (err) {
      console.warn("API 연동 실패! MinigameAPI.unlockGame 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true } };
    }
  },
};

export const RankingAPI = {
  getTopRanks: async () => {
    try {
      const res = await apiClient.get('/ranking/top');
      return { data: res.data.data };
    } catch (err) {
      console.warn("API 연동 실패! RankingAPI.getTopRanks 목업 데이터 사용", err);
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
    }
  },
};

export const WarehouseAPI = {
  getWarehouseItems: async (companyId: number) => {
    try {
      const res = await apiClient.get('/inventory');
      return {
        data: res.data.data
          .filter((slot: any) => slot.itemId != null)
          .map((slot: any) => ({
            id: `w_${slot.itemId || slot.slotIndex}`,
            type: slot.itemName?.includes("광석") || slot.itemName === "광산 드릴" || slot.itemName === "금괴" ? "material" : "product", // 이름 추론 로직 (임시)
            quantity: slot.quantity,
            name: slot.itemName,
          }))
      };
    } catch (err) {
      console.warn("API 연동 실패! WarehouseAPI 목업 데이터 사용", err);
      await mockDelay();
      return {
        data: isGuestMode() ? [] : [
          { id: "m1", type: "material", quantity: 47, name: "광산 드릴" },
          { id: "p1", type: "product", quantity: 253, name: "금광석" },
        ]
      };
    }
  }
};

export const InventoryAPI = {
  getInventory: async (companyId: number) => {
    // ✅ 실제 API 연동: GET /api/v1/inventory
    try {
      const res = await apiClient.get('/inventory'); // 백엔드 경로 수정
      return {
        data: res.data.data
          .filter((slot: any) => slot.itemId != null) // 실제 아이템이 들어있는 슬롯만 프론트엔드 인벤토리에 담기
          .map((slot: any) => ({
            id: slot.itemId || (slot.slotIndex * 1000), // id가 없으면 고유 임시 id
            name: slot.itemName || undefined,
            level: slot.itemType === 'EQUIPMENT' ? Math.max(1, slot.quantity) : 1, // 장비는 quantity 등 화면 요구에 맞춤
            locked: false, // 백엔드에 아직 locked 컬럼 미지원
            quantity: slot.quantity,
            slotIndex: slot.slotIndex,
            type: slot.itemType === 'TICKET' ? `ticket_${slot.itemName?.includes("창고") ? "warehouse" : "inventory"}` : `worker_${slot.itemName?.replace(/ /g, "_")}`
          }))
      };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.getInventory 목업 데이터 사용", err);
      await mockDelay();
      return {
        data: isGuestMode() ? [
          { id: "inv_default_1", type: "worker_수습_광부", itemName: "수습 광부", itemType: "EQUIPMENT", quantity: 1, level: 1, slotIndex: 1 }
        ] : WORKER_DEFINITIONS.map((w, i) => ({
          id: i + 1,
          name: w.displayName,
          level: 1,
          locked: i >= 4,
          quantity: i < 3 ? 2 : 1,
          icon: w.icon,
          modelPath: w.modelPath,
          workerType: w.type,
          type: `worker_${w.displayName?.replace(/ /g, "_")}` // required for gameStore mapping!
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