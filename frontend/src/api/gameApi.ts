import { apiClient } from './client';
import { WORKER_DEFINITIONS } from '../constants/workers';

// 💡 헬퍼 함수: 가짜 로딩 시간(0.5초)을 만들어주는 함수입니다.
const mockDelay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));
const isGuestMode = () => sessionStorage.getItem('isGuest') === 'true';

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

  getStatus: async () => {
    // ✅ 내 회사 게임 상태 조회 (GET /api/v1/companies/me/status)
    // money(현금), capital(총자산) 포함된 GameStatusResponse 반환
    try {
      const res = await apiClient.get('/companies/me/status');
      const company = res.data?.data;
      if (!company) throw new Error("API 연동 실패 (데이터 누락)");
      return {
        data: {
          name: company.companyName,
          industry_type: company.industry,
          cash: company.money,
          total_asset: company.capital,
          slots: undefined, // slots 정보는 별도 API에서 관리
        }
      };
    } catch (err) {
      throw err;
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
      throw err;
    }
  },
};

// 내 작업장 ID 세션 캐시 (한 번 조회 후 재사용)
let _cachedWorkstationId: number | null = null;



export const WorkstationAPI = {
  // 내 작업장 ID를 가져오는 헬퍼 (세션 중 최초 1회만 API 호출)
  getMyId: async (): Promise<number> => {
    if (_cachedWorkstationId !== null) return _cachedWorkstationId;
    try {
      const res = await apiClient.get('/workstations/my');
      const id = res.data.data.workstationId as number;
      _cachedWorkstationId = id;
      return id;
    } catch (err: any) {
      // 공장이 없으면 자동 생성 후 재시도
      const msg = err?.response?.data?.message ?? '';
      if (msg.includes('공장이 존재하지 않습니다') || err?.response?.status === 404) {
        await apiClient.post('/workstations/create');
        const retry = await apiClient.get('/workstations/my');
        const id = retry.data.data.workstationId as number;
        _cachedWorkstationId = id;
        return id;
      }
      throw err;
    }
  },

  create: async (data: { companyId: number; name?: string; type?: string }) => {
    const res = await apiClient.post('/workstations/create', data);
    return { data: res.data?.data ?? { success: true } };
  },

  getStatus: async () => {
    // ✅ 실제 API 연결: GET /api/v1/workstations/my
    try {
      const res = await apiClient.get('/workstations/my');
      const data = res.data.data;
      if (data.workstationId) _cachedWorkstationId = data.workstationId;
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
      // 프론트 자체 계산 금지
      throw err;
    }
  },
  start: async (data: { companyId: number; recipeId: number; quantity: number; workerId: number }) => {
    try {
      // ✅ 유저가 입력한 data.quantity (개수) 그대로 백엔드에 요청. 프론트엔드 연산(ratio/resProd 등) 제거
      const wsId = await WorkstationAPI.getMyId();
      await apiClient.post(`/workstations/${wsId}/reserve`, { quantity: data.quantity });
      await apiClient.post(`/workstations/${wsId}/toggle`);
      return { data: { success: true, message: "작업이 시작되었습니다." } };
    } catch (err) {
      // 프론트 임의 계산 로직 삭제
      throw err;
    }
  },
  process: async (workstationId: number = 1) => {
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
  collect: async (companyId: number) => {
    // ✅ 실제 API 연결: POST /api/v1/workstations/{workstationId}/harvest
    try {
      const wsId = await WorkstationAPI.getMyId();
      await apiClient.post(`/workstations/${wsId}/harvest`);
      return { data: { success: true, message: "수령 완료" } };
    } catch (err) {
      throw err;
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

  /** 📋 내 미체결 주문 목록 조회 */
  getMyOrders: async (itemId: number) => {
    return apiClient.get('/market/orders/me', { params: { item_id: itemId } });
  },

  /** 📈 체결 내역 조회 */
  getTrades: async (itemId: number) => {
    return apiClient.get('/market/trades', { params: { item_id: itemId } });
  },

  /** 💰 체결 결과 수령 */
  collectTrade: async (tradeHistoryId: number) => {
    return apiClient.post(`/market/orders/${tradeHistoryId}`);
  },

  getMarketChart: (itemId: number) => apiClient.get('/market/chart', { params: { item_id: itemId } }),
};


export const BankAPI = {
  getSummary: async (companyId: number) => {
    const res = await apiClient.get('/bank/summary');
    return { data: res.data.data };
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
    const res = await apiClient.get('/ranking/preview');
    return { data: res.data.data };
  },
};

export const WarehouseAPI = {
  discardItems: async (type: "material" | "product", qty: number) => {
    const itemType = type === "material" ? "MATERIAL" : "PRODUCT";
    await apiClient.delete('/warehouses/discard', { params: { itemType, amount: qty } });
  },

  getSlots: async (): Promise<Array<{
    slotIndex: number;
    itemId: number | null;
    itemName: string | null;
    itemType: string | null;
    quantity: number;
    maxQuantity: number;
  }>> => {
    const res = await apiClient.get('/warehouses');
    return res.data.data;
  },

  getWarehouseItems: async (companyId: number) => {
    try {
      const res = await apiClient.get('/warehouses');
      const allSlots = res.data.data || [];
      return {
        data: allSlots
          .filter((slot: any) => slot.itemId != null && (slot.itemType === "MATERIAL" || slot.itemType === "PRODUCT"))
          .map((slot: any) => ({
            id: `w_${slot.itemId || slot.slotIndex}_${slot.slotIndex}`, // 중복 ID 방지를 위해 slotIndex 추가
            type: slot.itemType === "MATERIAL" ? "material" : "product",
            quantity: slot.quantity,
            name: slot.itemName,
            slotIndex: slot.slotIndex,
          })),
        maxSlots: allSlots.length // 실제 백엔드 슬롯 총 개수
      };
    } catch (err) {
      console.warn("API 연동 실패! WarehouseAPI", err);
      return { data: [] };
    }
  },
  unlockSlot: async (data: { companyId: number; maxSlot: number }) => {
    try {
      await apiClient.post('/warehouses/expand', null, { params: { ticketSlotIndex: data.maxSlot } });
      return { data: { success: true } };
    } catch (err) {
      console.warn("API 연동 실패! WarehouseAPI.unlockSlot", err);
      return { data: { success: true } };
    }
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
  getInventory: async (companyId: number) => {
    // ✅ 실제 API 연동: GET /api/v1/inventory/
    try {
      const res = await apiClient.get('/inventory'); // 백엔드 경로 수정
      const allSlots = res.data.data || [];
      return {
        data: allSlots
          .filter((slot: any) => slot.itemId != null) // 실제 아이템이 들어있는 슬롯만 프론트엔드 인벤토리에 담기
          .map((slot: any) => ({
            id: slot.itemId ? `inv_${slot.itemId}_${slot.slotIndex}` : `inv_slot_${slot.slotIndex * 1000}`, // 고유 임시 id 보장
            name: slot.itemName || undefined,
            level: slot.itemType === 'EQUIPMENT' ? Math.max(1, slot.quantity) : 1, // 장비는 quantity 등 화면 요구에 맞춤
            locked: false, // 백엔드에 아직 locked 컬럼 미지원
            quantity: slot.quantity,
            slotIndex: slot.slotIndex,
            type: slot.itemType === 'TICKET' ? `ticket_${slot.itemName?.includes("창고") ? "warehouse" : "inventory"}` : `worker_${slot.itemName?.replace(/ /g, "_")}`
          })),
        maxSlots: allSlots.length
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
  unlockSlot: async (data: { ticketSlotIndex: number }) => {
    await apiClient.post('/inventory/expand', null, { params: { ticketSlotIndex: data.ticketSlotIndex } });
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

// ==================== News ====================
export const NewsAPI = {
  /** 뉴스 목록 조회 (/api/news) */
  getNews: async (): Promise<any[]> => {
    try {
      const res = await apiClient.get('/api/news', { baseURL: '/' });
      return res.data?.data ?? [];
    } catch (err) {
      console.warn('NewsAPI.getNews 실패', err);
      return [];
    }
  }
};