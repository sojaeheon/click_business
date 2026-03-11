import { apiClient } from './client';

export const CompanyAPI = {
  getStatus: (companyId: number) => apiClient.get(`/companies/${companyId}/status`),
};

export const WorkstationAPI = {
  getStatus: (companyId: number) => apiClient.get('/workstations', { params: { companyId } }),
  start: (data: { companyId: number; recipeId: number; quantity: number; workerId: number }) => apiClient.post('/workstations/start', data),
  collect: (companyId: number) => apiClient.post('/workstations/collect', { companyId })
};

export const MarketAPI = {
  getOrderbook: (itemId: number) => apiClient.get('/market/orderbook', { params: { itemId } }),
  createOrder: (data: { companyId: number; itemId: number; type: 'BUY' | 'SELL'; price: number; qty: number }) => apiClient.post('/market/orders', data),
  cancelOrder: (orderId: number, companyId: number) => apiClient.delete('/market/orders/' + orderId, { params: { companyId } }),
  // === [신규 추가] 실시간 차트 히스토리 조회 ===
  getMarketChart: (itemId: number, range: '1D' | '1W' | '1M' = '1D') => apiClient.get('/market/charts', { params: { itemId, range } }),
};

export const BankAPI = {
  getSummary: (companyId: number) => apiClient.get('/bank/summary', { params: { companyId } }),
  processLoan: (data: { companyId: number; type: 'BORROW' | 'REPAY' | 'DEPOSIT' | 'WITHDRAW'; amount: number }) => apiClient.post('/bank/loans', data)
};

export const HRAPI = {
  // === [신규 추가] 신규 고용 (가챠) ===
  recruitWorker: (data: { companyId: number; type: 'NORMAL' | 'PREMIUM' }) => apiClient.post('/hr/recruit', data),
  upgradeWorker: (data: { companyId: number; currentLevel: number }) => apiClient.post('/hr/upgrade', data),
};

export const MinigameAPI = {
  // === [신규 추가] 미니게임 피버타임 보상 수령 ===
  claimReward: (data: { companyId: number; clicks: number; isFever: boolean }) => apiClient.post('/minigame/claim', data),
  unlockGame: (data: { companyId: number; amount: number }) => apiClient.post('/minigame/unlock', data),
};

export const RankingAPI = {
  getTopRanks: () => apiClient.get('/ranking/top'),
};

export const InventoryAPI = {
  getInventory: (companyId: number) => apiClient.get('/inventory', { params: { companyId } }),
  unlockSlot: (data: { companyId: number; slotId: number }) => apiClient.post('/inventory/unlock', data),
};
