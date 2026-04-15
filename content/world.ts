import type { PlayerProfile, RewardState, WorldState } from "@/types";

export const initialWorldState: WorldState = {
  zone: "晨雾营地",
  statusText: "营地的灯重新亮起，通往迷雾小镇的路开始一点点清楚起来。",
  streakDays: 2,
  unlockedAreas: ["晨雾营地"],
  recentChanges: ["你让营地重新亮起，也让故事世界有了继续向前走的入口。"],
};

export const initialRewardState: RewardState = {
  currentIdentity: "故事观察员",
  unlockedTitles: ["故事观察员"],
  unlockedPerks: ["今日剧情入口"],
  lastSignals: [],
};

export const initialPlayerProfile: PlayerProfile = {
  nickname: "小队员",
  preferredModes: ["story"],
  totalSessions: 0,
};
