import { create } from 'zustand';

interface AlertState {
  isOpen: boolean;
  message: string;
  title: string;
  onConfirm?: () => void;
  openAlert: (message: string, title?: string, onConfirm?: () => void) => void;
  closeAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  isOpen: false,
  message: '',
  title: '알림',
  openAlert: (message, title = '알림', onConfirm) => set({ isOpen: true, message, title, onConfirm }),
  closeAlert: () => set({ isOpen: false, onConfirm: undefined }),
}));
