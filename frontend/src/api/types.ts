// ==================== Auth ====================
export interface TokenResponse {
    accessToken: string;
}

export interface AuthCallbackResponse {
    accessToken: string;
    refreshToken: string;
}

// ==================== User ====================
export interface UserProfile {
    user_id: number;
    nickname: string;
    email: string;
    created_at: string;
}

// ==================== Company ====================
export interface CompanySlotInfo {
    warehouse_slots: number;
    inventory_slots: number;
}

export interface CompanyDetail {
    company_id: number;
    name: string;
    industry_type: string;
    cash: number;
    total_asset: number;
    slots: CompanySlotInfo;
}

// ==================== Storage (Inventory) ====================
export interface InventorySlot {
    inventory_id: number;
    slot_index: number;
    item_id: number;
    item_name: string;
    quantity: number;
}

export interface SaveInventoryItemRequest {
    item_id: number;
    quantity: number;
}

export interface MoveInventorySlotRequest {
    inventory_id: number;
    from_idx: number;
    to_idx: number;
}

// ==================== Storage (Warehouse) ====================
export interface WarehouseSlot {
    warehouse_id: number;
    slot_index: number;
    item_id: number;
    item_name: string;
    quantity: number;
}

export interface SaveWarehouseItemRequest {
    company_id: number;
    item_id: number;
    quantity: number;
}

// ==================== Workstation ====================
export type SlotType = 'IN' | 'OUT';

export interface WorkstationEquipment {
    equipment_id: number;
    name: string;
    level: number;
}

export interface WorkstationDetail {
    workstation_id: number;
    is_active: boolean;
    last_tick: string;
    equipment: WorkstationEquipment;
    inventory: WorkstationInventoryItem[];
}

export interface WorkstationPreview {
    workstation_id: number;
    is_active: boolean;
    progress: number; // 0~100
}

export interface WorkstationInventoryItem {
    workstation_inventory_id: number;
    item_id: number;
    item_name: string;
    quantity: number;
    slot_type: SlotType;
}

/** 작업 시작 요청 */
export interface StartWorkRequest {
    workstation_inventory_id: number;
    quantity: number;
    // slot_type은 내부적으로 'IN'
}

/** 완성품 수령 요청 */
export interface ReceiveProductRequest {
    workstation_inventory_id: number;
    slot_type: 'OUT';
}

// ==================== Market ====================
export interface OrderBookEntry {
    price: number;
    quantity: number;
    order_type: 'BUY' | 'SELL';
}

export interface OrderBook {
    item_id: number;
    item_name: string;
    entries: OrderBookEntry[];
}
