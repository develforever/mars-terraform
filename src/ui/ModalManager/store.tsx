import { create } from "zustand";
import { devtools } from 'zustand/middleware'

export interface AppState {
    [key: string]: any;
    isOpen: boolean;
    onOk?: () => void;
    onCancel?: () => void;
    open: (onOk?: () => void, onCancel?: () => void) => void;
    close: () => void;
}


export const useModalStore = create<AppState>()(
    devtools((set) => ({
        isOpen: false,
        onOk: () => { },
        onCancel: () => { },
        open: (onOk?: () => void, onCancel?: () => void) => set({ isOpen: true, onOk, onCancel }),
        close: () => set({ isOpen: false }),
    }), { name: "ModalStore", enabled: true, })
);

