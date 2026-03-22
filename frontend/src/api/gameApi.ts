import { apiClient } from './client';

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
    const res = await apiClient.get('/companies/me/status');
    const company = res.data?.data;
    if (!company) throw new Error("API 연동 실패 (데이터 누락)");
    return {
      data: {
        name: company.companyName,
        industry_type: company.industry,
        cash: company.money,
        total_asset: company.capital,
        slots: undefined,
      }
    };
  },

  create: async (data: { companyName: string; industryType: string }) => {
    const res = await apiClient.post('/companies', {
      name: data.companyName,
      industryType: data.industryType,
    });
    return { data: res.data?.data ?? { success: true } };
  },
};

// 내 작업장 ID 세션 캐시 (한 번 조회 후 재사용)
let _cachedWorkstationId: number | null = null;

export const WorkstationAPI = {
  getMyId: async (): Promise<number> => {
    if (_cachedWorkstationId !== null) return _cachedWorkstationId;
    try {
      const res = await apiClient.get('/workstations/my');
      const id = res.data.data.workstationId as number;
      _cachedWorkstationId = id;
      return id;
    } catch (err: any) {
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
    const res = await apiClient.get('/workstations/my');
    const data = res.data.data;
    if (data.workstationId) _cachedWorkstationId = data.workstationId;
    return {
      data: {
        isWorking: data.isActive,
        progress: data.progress ?? 0,
        producedQuantity: data.outputQuantity ?? data.producedQuantity ?? 0,
        totalQuantity: data.reservedQuantity ?? data.totalQuantity ?? 0,
        expectedEndTime: data.expectedEndTime, // ✅ 백엔드 계산 시각 추가
        remainingMs: null as number | null,
      }
    };
  },

  start: async (data: { companyId: number; recipeId: number; quantity: number; workerId: number }) => {
    const wsId = await WorkstationAPI.getMyId();
    // 1. 재료 예약 실시 (Back: /api/v1/workstations/{id}/reserve)
    // 주의: quantity는 각 산업군별 baseYield(40, 6, 2 등)의 배수여야 400 에러가 나지 않습니다.
    await apiClient.post(`/workstations/${wsId}/reserve`, { quantity: data.quantity });

    // 2. 가동 시작 (Back: /api/v1/workstations/{id}/toggle)
    // 리저브 이후에 활성화되어야 Tick이 돌기 시작합니다. 
    // 이미 켜져있는 상태에서 다시 누르면 꺼질 수 있으므로, 상태 체크 후 토글하는 것이 안전합니다.
    const status = await WorkstationAPI.getStatus();
    if (!status.data?.isWorking) {
      await apiClient.post(`/workstations/${wsId}/toggle`);
    }

    return { data: { success: true, message: "작업이 시작되었습니다." } };
  },

  process: async (workstationId: number = 1) => {
    await apiClient.post(`/workstations/${workstationId}/process`, { outputItemId: 0 });
    return { data: { success: true } };
  },

  equip: async (workstationId: number, equipmentId: number) => {
    await apiClient.post(`/workstations/${workstationId}/equip-equipment/${equipmentId}`);
    return { data: { success: true } };
  },

  stop: async () => {
    const wsId = await WorkstationAPI.getMyId();
    // 켜져있을 때만 토글해서 끕니다.
    const status = await WorkstationAPI.getStatus();
    if (status.data?.isWorking) {
      return await apiClient.post(`/workstations/${wsId}/toggle`);
    }
  },

  collect: async () => {
    const wsId = await WorkstationAPI.getMyId();
    // 결과물 수확 (Back: /api/v1/workstations/{id}/harvest)
    return await apiClient.post(`/workstations/${wsId}/harvest`);
  },
};

export const MarketAPI = {
  getOrderbook: async (itemId: number) => {
    const res = await apiClient.get('/market/orderbooks', { params: { item_id: itemId } });
    const payload = res.data?.data ?? res.data;
    return { data: payload };
  },

  createOrder: async (data: { itemId: number; type: 'BUY' | 'SELL'; price: number; qty: number }) => {
    return apiClient.post('/market/orders', {
      itemId: data.itemId,
      orderType: data.type,
      price: data.price,
      totalQuantity: data.qty
    });
  },

  cancelOrder: (orderId: number) => apiClient.delete(`/market/orders/${orderId}`),

  /** 내 미체결 주문 목록 조회 (develop에서 추가) */
  getMyOrders: async (itemId: number) => {
    return apiClient.get('/market/orders/me', { params: { item_id: itemId } });
  },

  getTrades: async (itemId: number) => {
    return apiClient.get('/market/trades', { params: { item_id: itemId } });
  },

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
    const res = await apiClient.post('/minigame/claim');
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
    const res = await apiClient.get('/warehouses');
    const allSlots = res.data.data || [];
    return {
      data: allSlots
        .filter((slot: any) => slot.itemId != null && (slot.itemType === "MATERIAL" || slot.itemType === "PRODUCT"))
        .map((slot: any) => ({
          id: `w_${slot.itemId || slot.slotIndex}_${slot.slotIndex}`,
          type: slot.itemType === "MATERIAL" ? "material" : "product",
          quantity: slot.quantity,
          name: slot.itemName,
          slotIndex: slot.slotIndex,
        })),
      maxSlots: allSlots.length
    };
  },

  unlockSlot: async (data: { companyId: number; maxSlot: number }) => {
    await apiClient.post('/warehouses/expand', null, { params: { ticketSlotIndex: data.maxSlot } });
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
  getInventory: async (companyId: number) => {
    const res = await apiClient.get('/inventory');
    const allSlots = res.data.data || [];
    return {
      data: allSlots
        .filter((slot: any) => slot.itemId != null)
        .map((slot: any) => ({
          id: slot.itemId ? `inv_${slot.itemId}_${slot.slotIndex}` : `inv_slot_${slot.slotIndex * 1000}`,
          name: slot.itemName || undefined,
          level: slot.itemType === 'EQUIPMENT' ? Math.max(1, slot.quantity) : 1,
          locked: false,
          quantity: slot.quantity,
          slotIndex: slot.slotIndex,
          type: slot.itemType === 'TICKET' ? `ticket_${slot.itemName?.includes("창고") ? "warehouse" : "inventory"}` : `worker_${slot.itemName?.replace(/ /g, "_")}`
        })),
      maxSlots: allSlots.length
    };
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
  getAll: async (): Promise<import('./types').NotificationResponse[]> => {
    const res = await apiClient.get('/notifications');
    return res.data?.data ?? [];
  },

  markRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },
};

// ==================== News (develop에서 추가) ====================
export const NewsAPI = {
  /** 뉴스 목록 조회 (/api/news) */
  getNews: async (): Promise<any[]> => {
    const res = await apiClient.get('/api/news', { baseURL: '/' });
    return res.data?.data ?? [];
  }
};