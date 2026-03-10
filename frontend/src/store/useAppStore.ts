import { create } from 'zustand';
import { companyApi, workstationApi, inventoryApi, warehouseApi } from '../api/services';
import type { CompanyDetail, InventorySlot, WarehouseSlot, WorkstationPreview } from '../api/types';

// ─────────────────────────────────────────────────────────────────────────
// State Shapes
// ─────────────────────────────────────────────────────────────────────────

interface CompanyState {
    company: CompanyDetail | null;
    isLoading: boolean;
    fetchCompany: (companyId: number) => Promise<void>;
}

interface WorkstationState {
    preview: WorkstationPreview | null;
    isActive: boolean;
    progress: number; // 0~100
    isLoading: boolean;
    fetchPreview: (workstationId: number) => Promise<void>;
    setProgress: (p: number) => void;
    setActive: (v: boolean) => void;
}

interface InventoryState {
    slots: InventorySlot[];
    isLoading: boolean;
    fetchSlots: () => Promise<void>;
}

interface WarehouseState {
    slots: WarehouseSlot[];
    isLoading: boolean;
    fetchSlots: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────
// Stores
// ─────────────────────────────────────────────────────────────────────────

/** 기업 자산 (HUD: 현금, 총자산, 슬롯) */
export const useCompanyStore = create<CompanyState>((set) => ({
    company: null,
    isLoading: false,
    fetchCompany: async (companyId) => {
        set({ isLoading: true });
        try {
            const { data } = await companyApi.getDetail(companyId);
            set({ company: data });
        } catch (e) {
            console.error('[CompanyStore] fetchCompany failed', e);
        } finally {
            set({ isLoading: false });
        }
    },
}));

/** 작업장 가동 상태 + 진행도 (메인 씬 연동) */
export const useWorkstationStore = create<WorkstationState>((set) => ({
    preview: null,
    isActive: false,
    progress: 0,
    isLoading: false,
    fetchPreview: async (workstationId) => {
        set({ isLoading: true });
        try {
            const { data } = await workstationApi.getPreview(workstationId);
            set({ preview: data, isActive: data.is_active, progress: data.progress ?? 0 });
        } catch (e) {
            console.error('[WorkstationStore] fetchPreview failed', e);
        } finally {
            set({ isLoading: false });
        }
    },
    setProgress: (p) => set({ progress: p }),
    setActive: (v) => set({ isActive: v }),
}));

/** 인벤토리 슬롯 목록 */
export const useInventoryStore = create<InventoryState>((set) => ({
    slots: [],
    isLoading: false,
    fetchSlots: async () => {
        set({ isLoading: true });
        try {
            const { data } = await inventoryApi.getSlots();
            set({ slots: data });
        } catch (e) {
            console.error('[InventoryStore] fetchSlots failed', e);
        } finally {
            set({ isLoading: false });
        }
    },
}));

/** 창고 슬롯 목록 */
export const useWarehouseStore = create<WarehouseState>((set) => ({
    slots: [],
    isLoading: false,
    fetchSlots: async () => {
        set({ isLoading: true });
        try {
            const { data } = await warehouseApi.getSlots();
            set({ slots: data });
        } catch (e) {
            console.error('[WarehouseStore] fetchSlots failed', e);
        } finally {
            set({ isLoading: false });
        }
    },
}));
