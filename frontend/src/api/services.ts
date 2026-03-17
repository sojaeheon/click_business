import { apiClient } from './client';
import type {
    ApiResponse, AuthCallbackResponse, TokenResponse, GuestLoginResponse,
    CompanyDetail,
    InventorySlot, SaveInventoryItemRequest, MoveInventorySlotRequest,
    WarehouseSlot, SaveWarehouseItemRequest,
    WorkstationDetail, WorkstationPreview,
    StartWorkRequest, ReceiveProductRequest,
    OrderBook,
    UserProfile,
} from './types';

// ─────────────────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────────────────
export const authApi = {
    /** Google OAuth 로그인 페이지 URL 반환 */
    getLoginUrl: () =>
        `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/auth/google/login`,

    /** Authorization code로 JWT 발급 */
    callback: (code: string) =>
        apiClient.get<AuthCallbackResponse>('/auth/callback', { params: { code } }),

    /** Access token 갱신 (refresh 쿠키 사용) */
    refresh: () =>
        apiClient.post<TokenResponse>('/auth/refresh'),

     /** 게스트 로그인 */
    createGuest: () =>
        apiClient.post<ApiResponse<GuestLoginResponse>>('/users/guest'),

    /** 로그아웃 (쿠키 만료) */
    logout: () =>
        apiClient.post('/auth/logout'),
};

// ─────────────────────────────────────────────────────────────────────────
// User API
// ─────────────────────────────────────────────────────────────────────────
export const userApi = {
    /** 닉네임 수정 */
    updateNickname: (userId: number, nickname: string) =>
        apiClient.patch<UserProfile>(`/users/${userId}`, { nickname }),
};

// ─────────────────────────────────────────────────────────────────────────
// Company API
// ─────────────────────────────────────────────────────────────────────────
export const companyApi = {
    /** 기업 상세 정보 조회 (자산, 슬롯 현황) */
    getDetail: (companyId: number) =>
        apiClient.get<CompanyDetail>('/companies', { params: { company_id: companyId } }),

    /** 신규 유저: 산업군 설정 */
    setIndustry: (industryType: string) =>
        apiClient.post<CompanyDetail>('/companies', { industry_type: industryType }),

    /** 신규 유저: 회사명 설정 */
    setName: (companyName: string) =>
        apiClient.post<CompanyDetail>('/companies', { company_name: companyName }),
};

// ─────────────────────────────────────────────────────────────────────────
// Inventory API (인벤토리)
// ─────────────────────────────────────────────────────────────────────────
export const inventoryApi = {
    /** 인벤토리 슬롯 조회 */
    getSlots: () =>
        apiClient.get<InventorySlot[]>('/storage/inventories'),

    /** 아이템 저장 */
    saveItem: (data: SaveInventoryItemRequest) =>
        apiClient.post<InventorySlot>('/storage/inventories', data),

    /** 아이템 삭제 */
    deleteItem: (inventoryId: number) =>
        apiClient.delete(`/storage/inventories/${inventoryId}`),

    /** 슬롯 위치 변경 (드래그 앤 드롭) */
    moveSlot: (data: MoveInventorySlotRequest) =>
        apiClient.patch<InventorySlot>('/storage/inventories/slots', data),
};

// ─────────────────────────────────────────────────────────────────────────
// Warehouse API (창고)
// ─────────────────────────────────────────────────────────────────────────
export const warehouseApi = {
    /** 창고 슬롯 조회 */
    getSlots: () =>
        apiClient.get<WarehouseSlot[]>('/storage/warehouses'),

    /** 아이템 저장 */
    saveItem: (data: SaveWarehouseItemRequest) =>
        apiClient.post<WarehouseSlot>('/storage/warehouses', data),
};

// ─────────────────────────────────────────────────────────────────────────
// Workstation API (작업장)
// ─────────────────────────────────────────────────────────────────────────
export const workstationApi = {
    /** 작업장 상태 상세 조회 */
    getDetail: (workstationId: number) =>
        apiClient.get<WorkstationDetail>('/workstations', { params: { workstation_id: workstationId } }),

    /** 메인 페이지용 작업장 요약 조회 */
    getPreview: (workstationId: number) =>
        apiClient.get<WorkstationPreview>('/workstations/preview', { params: { workstation_id: workstationId } }),

    /**
     * 작업 시작 (slot_type: IN)
     * → 입력물 설정 및 is_active = true
     */
    startWork: (data: StartWorkRequest) =>
        apiClient.post('/workstation_inventories', {
            workstation_inventory_id: data.workstation_inventory_id,
            quantity: data.quantity,
            // 서버에서 IN으로 처리
        }),

    /**
     * 완성품 수령 (slot_type: OUT)
     * → 출력물 창고 이동 및 수량 리셋
     */
    receiveProduct: (data: ReceiveProductRequest) =>
        apiClient.post('/workstation_inventories', data),
};

// ─────────────────────────────────────────────────────────────────────────
// Market API
// ─────────────────────────────────────────────────────────────────────────
export const marketApi = {
    /** 실시간 호가창 조회 */
    getOrderBook: (itemId: number) =>
        apiClient.get<OrderBook>('/market/orderbooks', { params: { item_id: itemId } }),
};
