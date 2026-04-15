"use client";
/**
 * T3.2 — Profile Store
 * 管理孩子档案，持久化到 localStorage。
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChildProfile } from "@/types/goals";

// ---------------------------------------------------------------------------
// Store 类型
// ---------------------------------------------------------------------------

interface ProfileState {
  profiles: ChildProfile[];
  activeProfileId: string | null;

  // Actions
  createProfile: (nickname: string, birthday: string, avatarDataUrl?: string) => ChildProfile;
  setActiveProfile: (id: string | null) => void;
  updateGoalPreferences: (id: string, goals: string[]) => void;
  updateAvatar: (id: string, avatarDataUrl: string) => void;
  getActiveProfile: () => ChildProfile | null;
  deleteProfile: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Store 实现
// ---------------------------------------------------------------------------

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      createProfile: (nickname, birthday, avatarDataUrl) => {
        const id = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const profile: ChildProfile = {
          id,
          nickname,
          birthday,
          goalPreferences: [],
          avatarDataUrl,
        };
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: s.activeProfileId ?? id,
        }));
        return profile;
      },

      setActiveProfile: (id) => {
        if (id === null) {
          set({ activeProfileId: null });
          return;
        }
        const profile = get().profiles.find((p) => p.id === id);
        if (profile) set({ activeProfileId: id });
      },

      updateGoalPreferences: (id, goals) => {
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, goalPreferences: goals } : p
          ),
        }));
      },

      updateAvatar: (id, avatarDataUrl) => {
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, avatarDataUrl } : p
          ),
        }));
      },

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        return profiles.find((p) => p.id === activeProfileId) ?? null;
      },

      deleteProfile: (id) => {
        set((s) => {
          const remaining = s.profiles.filter((p) => p.id !== id);
          const newActiveId =
            s.activeProfileId === id
              ? (remaining[0]?.id ?? null)
              : s.activeProfileId;
          return { profiles: remaining, activeProfileId: newActiveId };
        });
      },
    }),
    {
      name: "brainplay-profile-store",
    },
  ),
);
