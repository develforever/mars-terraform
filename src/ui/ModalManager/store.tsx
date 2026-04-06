import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ModalType = "colony-name" | null;

export interface ModalState {
    isOpen: boolean;
    modalType: ModalType;
    open: (type: ModalType) => void;
    close: () => void;
}

export const useModalStore = create<ModalState>()(
    devtools((set) => ({
        isOpen: false,
        modalType: null,
        open: (type: ModalType) => set({ isOpen: true, modalType: type }),
        close: () => set({ isOpen: false, modalType: null }),
    }), { name: "ModalStore", enabled: true })
);

