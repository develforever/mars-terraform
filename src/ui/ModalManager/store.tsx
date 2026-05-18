import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ModalType = "colony-name" | "login" | "register" | "forgot-password" | "reset-password" | "verify-email" | null;

export interface ModalState {
    isOpen: boolean;
    modalType: ModalType;
    modalData?: any;
    open: (type: ModalType, data?: any) => void;
    close: () => void;
}

export const useModalStore = create<ModalState>()(
    devtools((set) => ({
        isOpen: false,
        modalType: null,
        modalData: null,
        open: (type: ModalType, data?: any) => set({ isOpen: true, modalType: type, modalData: data }),
        close: () => set({ isOpen: false, modalType: null, modalData: null }),
    }), { name: "ModalStore", enabled: true })
);

