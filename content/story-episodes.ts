import { getMathStoryKernel } from "@/content/math-story-kernels";
import type { StoryEpisode } from "@/types";

export const storyEpisodes: Record<string, StoryEpisode> = {
  mist_town_route: {
    id: "mist_town_route",
    title: "迷雾小镇路线",
    narratorName: "迷雾叙事者",
    sceneBackdrop: "迷雾和路灯把岔路分成了几条不同方向的小路。",
    openingBeat:
      "小镇入口的路灯一亮一暗，像是在给你提示。你不能乱走，要先看清哪些信号在重复。",
    worldLineLabel: "规律找路",
    worldLineSummary: "这条线会训练孩子从重复信号里找规律，再用规律决定路线。",
    kernelId: "pattern-routing",
  },
  clock_tower_signal: {
    id: "clock_tower_signal",
    title: "钟楼信号追踪",
    narratorName: "钟楼观察员",
    sceneBackdrop: "钟楼顶端的灯和铃声交替出现，像一道需要拆开的条件题。",
    openingBeat:
      "钟楼发来三条线索，但不是每条都能同时成立。你得先排掉不可能的，再决定往哪边追。",
    worldLineLabel: "条件排除",
    worldLineSummary: "这条线会训练孩子同时看多个条件，并主动排除不可能。",
    kernelId: "constraint-elimination",
  },
  market_bridge_bargain: {
    id: "market_bridge_bargain",
    title: "桥市交换风向",
    narratorName: "桥市主持人",
    sceneBackdrop: "桥市只开了一半摊位，大家都在等你决定先怎么分东西。",
    openingBeat:
      "桥市今天资源不够所有人一起满足。你得先看谁更需要、怎么分更公平，世界才会继续往前走。",
    worldLineLabel: "数量分配",
    worldLineSummary: "这条线会训练孩子比较数量、做取舍，并解释分配理由。",
    kernelId: "quantity-allocation",
  },
  river_boat_rescue: {
    id: "river_boat_rescue",
    title: "河湾小舟求援",
    narratorName: "河湾引航员",
    sceneBackdrop: "河道弯弯绕绕，任何一步顺序错了，后面的救援都会受影响。",
    openingBeat:
      "小舟被困住了，但你不能只看眼前一步。你得先想好前后顺序，再决定先做什么。",
    worldLineLabel: "多步计划",
    worldLineSummary: "这条线会训练孩子先想两步，再安排行动顺序。",
    kernelId: "multi-step-planning",
  },
};

export const storyEpisodeOrder = [
  "mist_town_route",
  "clock_tower_signal",
  "market_bridge_bargain",
  "river_boat_rescue",
] as const;

export function getStoryEpisode(sceneId?: string) {
  const fallbackId = storyEpisodeOrder[0];
  return (sceneId && storyEpisodes[sceneId]) || storyEpisodes[fallbackId];
}

export function getStoryEpisodeKernel(sceneId?: string) {
  const episode = getStoryEpisode(sceneId);
  return getMathStoryKernel(episode.kernelId);
}
