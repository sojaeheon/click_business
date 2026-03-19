import { apiClient } from './client';
import { WORKER_DEFINITIONS } from '../constants/workers';

// 💡 헬퍼 함수: 가짜 로딩 시간(0.5초)을 만들어주는 함수입니다.
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const isGuestMode = () => localStorage.getItem('isGuest') === 'true';

export const AuthAPI = {
  getLoginUrl: () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
    return baseUrl.replace('/api/v1', '') + '/oauth2/authorization/google';
  },
  callback: (code: string) => apiClient.get('/auth/callback', { params: { code } }),
  refresh: () => apiClient.post('/auth/refresh'),
  logout: () => apiClient.post('/auth/logout'),
};

export const UserAPI = {
  signup: (data: any) => apiClient.post('/users/signup', data),
  login: (data: any) => apiClient.post('/users/login', data),
  createGuest: () => apiClient.post('/users/guest'),
  getMe: () => apiClient.get('/users/me'),
  updateNickname: (userId: number, nickname: string) => apiClient.patch(`/users/${userId}`, { nickname }),
};

export const CompanyAPI = {
  getStatusById: async (companyId: number) => {
    try {
      const res = await apiClient.get(`/companies/${companyId}/status`);
      return { data: res.data?.data };
    } catch (err) {
      console.warn("API 연동 실패! CompanyAPI.getStatusById 목업 폴백", err);
      return { data: { cash: 5000000, total_asset: 12000000 } };
    }
  },
  getStatus: async () => {
    // ✅ 내 회사 조회 (GET /api/v1/companies/me)
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
  create: async (data: { companyId: number; name?: string; type?: string }) => {
    try {
      const res = await apiClient.post('/workstations/create', data);
      return { data: res.data?.data ?? { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! WorkstationAPI.create 목업 폴백", err);
      return { data: { success: true } };
    }
  },
  getStatus: async (workstationId: number = 1) => {
    // ✅ 실제 API 연결: GET /api/v1/workstations/{workstationId}
    try {
      const res = await apiClient.get(`/workstations/${workstationId}`);
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
      // ✅ 실제 연동 /api/v1/workstations/{workstation_id}/reserve (예약 및 가동)
      await apiClient.post(`/workstations/1/reserve`, { quantity: data.quantity });
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
  process: async (workstationId: number = 1) => {
    try {
      await apiClient.post(`/workstations/${workstationId}/process`);
      return { data: { success: true } };
    } catch (err) {
      return { data: { success: true } };
    }
  },
  equip: async (workstationId: number = 1, equipmentId: number) => {
    try {
      await apiClient.post(`/workstations/${workstationId}/equip/${equipmentId}`);
      return { data: { success: true } };
    } catch (err) {
      return { data: { success: true } };
    }
  },
  collect: async (companyId: number) => {
    // ✅ 실제 API 연결: POST /api/v1/workstations/{workstationId}/harvest
    const workstationId = 1; // 임시
    try {
      await apiClient.post(`/workstations/${workstationId}/harvest`);
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
      const res = await apiClient.get('/ranking/preview');
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
  discardItems: async (type: "material" | "product", qty: number) => {
    // 실제로는 창고 폐기 API가 없어서 mock으로 막거나, delete api를 호출해야 함. 이전 코드는 delete /storage/warehouses/{warehouseId} 였을 것입니다.
    const companyId = 1; // 임시 고정
    await apiClient.delete(`/storage/warehouses/${companyId}`);
  },

  getWarehouseItems: async (companyId: number) => {
    try {
      const res = await apiClient.get('/storage/warehouses');
      return {
        data: res.data.data
          .filter((slot: any) => slot.itemId != null && (slot.itemType === "MATERIAL" || slot.itemType === "PRODUCT"))
          .map((slot: any) => ({
            id: `w_${slot.itemId || slot.slotIndex}`,
            type: slot.itemType === "MATERIAL" ? "material" : "product",
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
  },
  unlockSlot: async (data: { companyId: number; maxSlot: number }) => {
    try {
      // ✅ 명세: 창고 슬롯 확장 (POST /api/v1/storage/warehouses)
      await apiClient.post('/storage/warehouses', { company_id: data.companyId, max_slot: data.maxSlot });
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! WarehouseAPI.unlockSlot 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true } };
    }
  },
  moveSlot: async (data: { companyId: number, fromIdx: number, toIdx: number }) => {
    try {
      // ✅ 명세: 슬롯 간 이동
      await apiClient.patch(`/storage/warehouses/slots`, { warehouse_id: data.companyId, from_idx: data.fromIdx, to_idx: data.toIdx });
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! WarehouseAPI.moveSlot 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true } };
    }
  }
};

export const InventoryAPI = {
  getInventory: async (companyId: number) => {
    // ✅ 실제 API 연동: GET /api/v1/inventory/
    try {
      const res = await apiClient.get('/inventory/'); // 백엔드 경로 수정
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
        // 🔑 Mock 데이터: 개발/백엔드 미연동 시 사용
        // level은 반드시 w.level (실제 레벨) 사용. 1로 하드코딩하면 강화 뒤에도 이름이 틀림
        // type은 반드시 `worker_lv{n}` 형식 — gameStore & 인벤토리 모달이 이 형식으로 레벨을 파악함
        data: isGuestMode() ? [
          { id: "inv_default_1", type: "worker_lv1", name: "초보 일꾼", quantity: 2, level: 1, icon: "⛏️" }
        ] : WORKER_DEFINITIONS.slice(0, 2).map((w) => ({
          id: `inv_mock_lv${w.level}`,
          name: w.displayName,       // "초보 일꾼", "견습 일꾼" 등 정확한 이름
          level: w.level,            // ← 핵심! 1로 하드코딩 금지
          quantity: 2,               // 강화 테스트용으로 모두 2개
          icon: w.icon,
          modelPath: w.modelPath,
          type: `worker_lv${w.level}` as const,  // ← "worker_lv1", "worker_lv2" 형식
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
  moveSlot: async (data: { fromSlot: number; toSlot: number }) => {
    try {
      // ✅ 명세: { "fromSlot": 0, "toSlot": 5 } -> 인벤토리 슬롯 아이템 교환
      await apiClient.post('/inventory/swap', data);
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.moveSlot 목업 데이터 사용", err);
      await mockDelay();
      return { data: { success: true } };
    }
  },
  addTestItem: async (data: { itemId: number, amount: number }) => {
    try {
      // ✅ 명세: 테스트용 아이템 추가 기능 POST /api/v1/inventory/add (Dev)
      await apiClient.post('/inventory/add', data);
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.addTestItem 목업 폴백", err);
      return { data: { success: true } };
    }
  },
  decreaseItem: async (data: { slotIndex: number, amount: number }) => {
    try {
      // ✅ 명세: 슬롯 아이템 수량 감소 DELETE /api/v1/inventory/decrease
      await apiClient.delete('/inventory/decrease', { data });
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! InventoryAPI.decreaseItem 목업 폴백", err);
      return { data: { success: true } };
    }
  }
};

// ==================== Notifications ====================
export const NotificationAPI = {
  /** 과거 알림 목록 조회 */
  getAll: async (): Promise<import('./types').NotificationResponse[]> => {
    try {
      const res = await apiClient.get('/notifications');
      return res.data?.data ?? [];
    } catch (err) {
      console.warn('NotificationAPI.getAll 실패, 빈 배열 반환', err);
      return [];
    }
  },

  /** 특정 알림 읽음 처리 */
  markRead: async (id: number): Promise<void> => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.warn('NotificationAPI.markRead 실패', err);
    }
  },
};