import type { MathProgressionStage, ProgressionStageId } from "@/types";

export const mathProgressionStages: Record<ProgressionStageId, MathProgressionStage> = {
  "foundation-observe": {
    id: "foundation-observe",
    title: "观察与计数",
    summary: "先看见数量变化，再做动作，建立最基础的数学观察习惯。",
    skills: ["观察与计数", "模式识别"],
    nextStageId: "strategy-pattern",
  },
  "strategy-pattern": {
    id: "strategy-pattern",
    title: "模式与策略",
    summary: "在反复尝试里找规律，学会提前想下一步。",
    skills: ["模式识别", "策略规划", "多步推演"],
    nextStageId: "rules-expression",
  },
  "rules-expression": {
    id: "rules-expression",
    title: "规则构建",
    summary: "把模糊想法说成规则，理解条件会怎样改变玩法。",
    skills: ["规则表达", "条件约束", "策略规划"],
    nextStageId: "story-reasoning",
  },
  "story-reasoning": {
    id: "story-reasoning",
    title: "因果推理",
    summary: "在情境中做连续决策，理解选择带来的后果。",
    skills: ["因果推理", "多步推演", "策略规划"],
  },
};

export const mathProgressionOrder: ProgressionStageId[] = [
  "foundation-observe",
  "strategy-pattern",
  "rules-expression",
  "story-reasoning",
];
