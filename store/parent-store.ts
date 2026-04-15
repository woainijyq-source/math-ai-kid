"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MathEvidence, ParentSummary, TaskMode } from "@/types";

type ParentStore = {
  summary: ParentSummary;
  recordSession: (params: {
    mode: TaskMode;
    completion: string;
    highlights: string[];
    mathEvidence?: MathEvidence;
  }) => void;
};

const initialSummary: ParentSummary = {
  dailySummary: "今天还没有新的试玩记录。",
  strengthSignals: ["准备开始观察孩子更偏好的互动方式。"],
  stuckSignals: ["暂时还没有明显卡点。"],
  nextSuggestion: "先让孩子完成一个完整回合，观察最愿意继续的是哪种玩法。",
  recentHighlights: ["等待第一条真实记录。"],
  observedMoves: [],
  aiFocus: [],
};

function getModeLabel(mode: TaskMode) {
  if (mode === "opponent") {
    return "AI 对手";
  }

  if (mode === "co-create") {
    return "AI 共创";
  }

  return "AI 剧情";
}

export const useParentStore = create<ParentStore>()(
  persist(
    (set) => ({
      summary: initialSummary,
      recordSession: ({ mode, completion, highlights, mathEvidence }) =>
        set({
          summary: {
            dailySummary: mathEvidence
              ? `今天完成了 1 次${getModeLabel(mode)}试玩，重点在练“${mathEvidence.publicTitle}”。${completion}`
              : `今天完成了 1 次${getModeLabel(mode)}试玩。${completion}`,
            strengthSignals: [
              mathEvidence
                ? `这轮主要在练：${mathEvidence.skillFocus.slice(0, 2).join("、")}`
                : "孩子愿意继续停留在有明确回应的互动里。",
              mathEvidence?.observedMoves[0]
                ? `孩子这轮实际用到的思路：${mathEvidence.observedMoves[0]}`
                : "能对世界变化和结果反馈保持注意力。",
            ],
            stuckSignals: [
              "长文本输入时节奏会偏慢，更适合短句、语音或选项式互动。",
            ],
            nextSuggestion: mathEvidence
              ? `下一轮继续围绕“${mathEvidence.publicTitle}”追问“为什么这样想”。`
              : "继续观察孩子是否会主动要求再来一轮，并记录最自然的反馈语气。",
            recentHighlights: highlights,
            latestMathFocus: mathEvidence?.publicTitle,
            observedMoves: mathEvidence?.observedMoves ?? [],
            aiFocus: mathEvidence?.aiFocus ?? [],
          },
        }),
    }),
    { name: "brainplay-parent-store" },
  ),
);
