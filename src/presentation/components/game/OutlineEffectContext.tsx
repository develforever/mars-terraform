import { createContext, useContext } from "react";
import type { OutlineEffect } from "postprocessing";

export const OutlineEffectContext = createContext<OutlineEffect | null>(null);

export function useOutlineEffect() {
    return useContext(OutlineEffectContext);
}
