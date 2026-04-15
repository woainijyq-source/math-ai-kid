"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialRewardState } from "@/content/world";
import type { RewardSignal, RewardState } from "@/types";

type RewardStore = {
  reward: RewardState;
  applySignals: (signals: RewardSignal[]) => void;
};

export const useRewardStore = create<RewardStore>()(
  persist(
    (set) => ({
      reward: initialRewardState,
      applySignals: (signals) =>
        set((state) => {
          const identitySignal = signals.find((signal) => signal.type === "identity");
          const worldSignal = signals.find((signal) => signal.type === "world");
          const newTitles = identitySignal
            ? Array.from(
                new Set([...state.reward.unlockedTitles, identitySignal.title]),
              )
            : state.reward.unlockedTitles;
          const newPerks = worldSignal
            ? Array.from(
                new Set([...state.reward.unlockedPerks, worldSignal.detail]),
              )
            : state.reward.unlockedPerks;

          return {
            reward: {
              currentIdentity: identitySignal?.title ?? state.reward.currentIdentity,
              unlockedTitles: newTitles,
              unlockedPerks: newPerks,
              lastSignals: signals,
            },
          };
        }),
    }),
    { name: "brainplay-reward-store" },
  ),
);
