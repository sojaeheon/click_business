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
  createGuest: () => apiClient.post('/users/guest'),
};

export const UserAPI = {
  signup: (data: any) => apiClient.post('/users/signup', data),
  login: (data: any) => apiClient.post('/users/login', data),
  getMe: () => apiClient.get('/users/me'),
  updateNickname: (userId: number, nickname: string) => apiClient.patch(`/users/${userId}`, { nickname }),
};

export const CompanyAPI = {
  getStatusById: async (companyId: number) => {
    const res = await apiClient.get(`/companies/${companyId}/status`);
    return { data: res.data?.data };
  },
  getStatus: async (companyId?: number) => {
    let id = companyId;
    if (!id) {
      // ✅ 내 회사 ID 조회 (GET /api/v1/companies/me)
      const resMe = await apiClient.get('/companies/me');
      id = resMe.data?.data?.id;
    }
    if (!id) throw new Error("API 연동 실패 (내 회사 정보를 찾을 수 없음)");

    // ✅ 게임 상태 뷰 전용 데이터 조회 (GET /companies/{id}/status -> GameStatusResponse)
    const res = await apiClient.get(`/companies/${id}/status`);
    const company = res.data?.data;
    if (!company) throw new Error("API 연동 실패 (상태 데이터 누락)");

    let mappedIndustry = "금광업";
    // GameStatusResponse의 'industry' 필드를 확인
    const backendIndustry = company.industry || company.industryType; 
    if (backendIndustry === "GOLD_SMELTING") mappedIndustry = "금 제련업";
    if (backendIndustry === "MANUFACTURING") mappedIndustry = "제조업";

    return {
      data: {
        name: company.companyName || company.name || "이름없음",
        industry_type: mappedIndustry, 
        cash: company.money ?? company.cash ?? 5000000,          
        total_asset: company.capital ?? company.total_asset ?? 12000000,  
        slots: company.slots ?? undefined, 
      }
    };
  },

  /** 회사 최초 생성 (산업선택 페이지에서 호출) */
  create: async (data: { companyName: string; industryType: string }) => {
    // IndustrySelectionPage에서 이미 'GOLD_SMELTING' 등으로 변환해서 넘겨줌.
    const res = await apiClient.post('/companies', {
      name: data.companyName,
      industryType: data.industryType,
    });
    return { data: res.data?.data ?? { success: true } };
  },
};



export const WorkstationAPI = {
  create: async (data: { companyId: number; name?: string; type?: string }) => {
    const res = await apiClient.post('/workstations/create', data);
    return { data: res.data?.data ?? { success: true } };
  },
  /** ✅ 실제 DB workstationId 조회 (GET /workstations/my) */
  getMyId: async (): Promise<{ data: number }> => {
    const res = await apiClient.get('/workstations/my');
    return { data: res.data?.data as number };
  },
  getStatus: async (workstationId: number) => {
    const res = await apiClient.get(`/workstations/${workstationId}`);
    const data = res.data.data;
    return {
      data: {
        isWorking: data.isActive,
        progress: data.progress ?? 0,
        producedQuantity: data.outputQuantity ?? data.producedQuantity ?? 0,
        totalQuantity: data.reservedQuantity ?? data.totalQuantity ?? 0,
        remainingMs: null as number | null, 
      }
    };
  },
  start: async (data: { companyId: number; recipeId: number; quantity: number; workerId: number; workstationId?: number }) => {
    const wId = data.workstationId ?? 1;
    await apiClient.post(`/workstations/${wId}/reserve`, { quantity: data.quantity });
    await apiClient.post(`/workstations/${wId}/toggle`);
    return { data: { success: true, message: "작업이 시작되었습니다." } };
  },
  process: async (workstationId: number) => {
    try {
      await apiClient.post(`/workstations/${workstationId}/process`, { outputItemId: 0 });
      return { data: { success: true } };
    } catch (err) {
      return { data: { success: true } };
    }
  },
  equip: async (workstationId: number, equipmentId: number) => {
    try {
      await apiClient.post(`/workstations/${workstationId}/equip-equipment/${equipmentId}`);
      return { data: { success: true } };
    } catch (err) {
      return { data: { success: true } };
    }
  },
  collect: async (workstationId: number) => {
    await apiClient.post(`/workstations/${workstationId}/harvest`);
    return { data: { success: true, message: "수령 완료" } };
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
    const res = await apiClient.post('/minigame/claim'); // 본문 없이 전송
    return { data: res.data.data };
  },
  unlockGame: async (data: { companyId: number; amount: number }) => {
    const res = await apiClient.post('/minigame/unlock', data);
    return { data: res.data.data };
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
          { rank: 1, companyName: "삼성제철", score: 99999 },
          { rank: 2, companyName: "현대광업", score: 88888 },
          { rank: 3, companyName: "딸깍 컴퍼니", score: 77777 },
          { rank: 4, companyName: "SSAFY 광물", score: 66666 },
          { rank: 5, companyName: "개미구멍", score: 55555 },
        ]
      };
    }
  },
};

export const WarehouseAPI = {
  discardItems: async (type: "material" | "product", qty: number) => {
    const itemType = type === "material" ? "MATERIAL" : "PRODUCT";
    await apiClient.delete('/warehouses/discard', { params: { itemType, amount: qty } });
  },

  getWarehouseItems: async () => {
    const res = await apiClient.get('/warehouses');
    return {
      data: res.data.data
        .filter((slot: any) => slot.itemId != null && (slot.itemType === "MATERIAL" || slot.itemType === "PRODUCT"))
        .map((slot: any) => ({
          id: `w_${slot.itemId || slot.slotIndex}`,
          type: slot.itemType === "MATERIAL" ? "material" : "product",
          quantity: slot.quantity,
          name: slot.itemName,
          slotIndex: slot.slotIndex,  // ✅ 실제 DB 슬롯 번호 보존 (스왓 시 반드시 필요)
        }))
    };
  },
  unlockSlot: async (data: { ticketSlotIndex: number }) => {
    await apiClient.post('/warehouses/expand', null, { params: { ticketSlotIndex: data.ticketSlotIndex } });
    return { data: { success: true } };
  },
  moveSlot: async (data: { fromIdx: number, toIdx: number }) => {
    await apiClient.post('/warehouses/swap', { fromSlot: data.fromIdx, toSlot: data.toIdx });
    return { data: { success: true } };
  },
  addTestItem: async (data: { itemId: number, amount: number }) => {
    await apiClient.post('/warehouses/add', null, { params: { itemId: data.itemId, amount: data.amount } });
    return { data: { success: true } };
  },
  decreaseItem: async (data: { slotIndex: number, amount: number }) => {
    await apiClient.delete('/warehouses/decrease', { data });
    return { data: { success: true } };
  }
};

export const InventoryAPI = {
  getInventory: async () => {
    const res = await apiClient.get('/inventory');
    return {
      data: res.data.data
        .filter((slot: any) => slot.itemId != null)
        .map((slot: any) => ({
          id: slot.itemId || (slot.slotIndex * 1000), 
          name: slot.itemName || undefined,
          level: slot.itemType === 'EQUIPMENT' ? Math.max(1, slot.quantity) : 1, 
          locked: false, 
          quantity: slot.quantity,
          slotIndex: slot.slotIndex,
          type: slot.itemType === 'TICKET' ? `ticket_${slot.itemName?.includes("창고") ? "warehouse" : "inventory"}` : `worker_lv${slot.level || 1}`
        }))
    };
  },
  unlockSlot: async (data: { ticketSlotIndex: number }) => {
    // TODO: 백엔드에 /inventory/expand API가 아직 없으므로 모의 처리
    console.warn("백엔드 미구현: 인벤토리 확장 API 호출 무시됨");
    return { data: { success: true } };
  },
  moveSlot: async (data: { fromIdx: number; toIdx: number }) => {
    await apiClient.post('/inventory/swap', { fromSlot: data.fromIdx, toSlot: data.toIdx });
    return { data: { success: true } };
  },
  addTestItem: async (data: { itemId: number, amount: number }) => {
    await apiClient.post('/inventory/add', null, { params: { itemId: data.itemId, amount: data.amount } });
    return { data: { success: true } };
  },
  decreaseItem: async (data: { slotIndex: number, amount: number }) => {
    await apiClient.delete('/inventory/decrease', { data });
    return { data: { success: true } };
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