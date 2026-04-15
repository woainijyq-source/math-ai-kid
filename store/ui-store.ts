"use client";

import { create } from "zustand";
import type { RewardSignal } from "@/types";

type UiStore = {
  toast: RewardSignal | null;
  showToast: (signal: RewardSignal) => void;
  dismissToast: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  toast: null,
  showToast: (signal) => set({ toast: signal }),
  dismissToast: () => set({ toast: null }),
}));
