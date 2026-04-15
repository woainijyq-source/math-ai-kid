"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialWorldState } from "@/content/world";
import type { WorldState } from "@/types";

type WorldStore = {
  world: WorldState;
  applyPatch: (patch: Partial<WorldState>) => void;
};

export const useWorldStore = create<WorldStore>()(
  persist(
    (set) => ({
      world: initialWorldState,
      applyPatch: (patch) =>
        set((state) => ({
          world: {
            ...state.world,
            ...patch,
            unlockedAreas: patch.unlockedAreas ?? state.world.unlockedAreas,
            recentChanges: patch.recentChanges ?? state.world.recentChanges,
          },
        })),
    }),
    { name: "brainplay-world-store" },
  ),
);
