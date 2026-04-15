/**
 * T4.1 — 训练目标树（后半：目标 4-6）+ 主导出
 */

import type { TrainingGoal } from "@/types/goals";
import { MATH_THINKING, LOGICAL_REASONING, CREATIVE_THINKING } from "./goal-tree-part1";

const LANGUAGE_THINKING: TrainingGoal = {
  id: "language-thinking",
  label: "语言与表达",
  description: "训练孩子用语言清晰表达想法、描述现象和解释原因",
  subGoals: [
    {
      id: "explain-reasoning",
      label: "解释推理",
      parentGoalId: "language-thinking",
      observableBehaviors: ["能用完整句子解释自己的判断", "能说出因果关系"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "用1句话解释选择原因" },
        { level: "L2", label: "进阶", description: "用2-3句话完整解释" },
        { level: "L3", label: "挑战", description: "用逻辑链条解释" },
        { level: "L4", label: "专家", description: "反驳他人观点并提出自己的" },
      ],
      completionCriteria: { selfExplained: true },
    },
    {
      id: "describe-observation",
      label: "描述观察",
      parentGoalId: "language-thinking",
      observableBehaviors: ["能用语言描述图形或数字的特征", "能比较两个事物的异同"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "描述一个特征" },
        { level: "L2", label: "进阶", description: "比较两个特征的异同" },
        { level: "L3", label: "挑战", description: "多维度系统描述" },
        { level: "L4", label: "专家", description: "抽象归纳描述" },
      ],
      completionCriteria: { selfExplained: true },
    },
  ],
};

const STRATEGY_THINKING: TrainingGoal = {
  id: "strategy-thinking",
  label: "策略与博弈",
  description: "训练预判对手、最优策略和博弈思维",
  subGoals: [
    {
      id: "opponent-modeling",
      label: "预判对手",
      parentGoalId: "strategy-thinking",
      observableBehaviors: ["能考虑对手可能的行动", "能根据对手行动调整策略"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "预判1步" },
        { level: "L2", label: "进阶", description: "预判2步" },
        { level: "L3", label: "挑战", description: "预判3步并制定反制策略" },
        { level: "L4", label: "专家", description: "完全博弈分析" },
      ],
      completionCriteria: { correctnessRate: 0.7, selfExplained: true },
    },
    {
      id: "optimal-strategy",
      label: "最优策略",
      parentGoalId: "strategy-thinking",
      observableBehaviors: ["能找到保证胜利的策略", "能解释为什么这个策略是最优的"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "简单必胜策略" },
        { level: "L2", label: "进阶", description: "需要2步计算的最优策略" },
        { level: "L3", label: "挑战", description: "含有陷阱的策略题" },
        { level: "L4", label: "专家", description: "证明策略的唯一最优性" },
      ],
      completionCriteria: { correctnessRate: 0.75, selfExplained: true },
    },
    {
      id: "risk-assessment",
      label: "风险评估",
      parentGoalId: "strategy-thinking",
      observableBehaviors: ["能识别高风险和低风险选项", "能权衡风险与收益"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "识别明显的风险" },
        { level: "L2", label: "进阶", description: "比较两个选项的风险" },
        { level: "L3", label: "挑战", description: "不确定性下的决策" },
        { level: "L4", label: "专家", description: "概率性风险量化" },
      ],
      completionCriteria: { selfExplained: true },
    },
  ],
};

const OBSERVATION_INDUCTION: TrainingGoal = {
  id: "observation-induction",
  label: "观察与归纳",
  description: "训练系统观察、发现规律并归纳总结的能力",
  subGoals: [
    {
      id: "systematic-observation",
      label: "系统观察",
      parentGoalId: "observation-induction",
      observableBehaviors: ["能按顺序观察所有元素", "能发现容易被忽略的细节"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "观察3-4个元素" },
        { level: "L2", label: "进阶", description: "观察5-8个元素并分类" },
        { level: "L3", label: "挑战", description: "在干扰项中找目标" },
        { level: "L4", label: "专家", description: "多维度交叉观察" },
      ],
      completionCriteria: { correctnessRate: 0.8 },
    },
    {
      id: "inductive-generalization",
      label: "归纳总结",
      parentGoalId: "observation-induction",
      observableBehaviors: ["能从多个例子中总结共同规律", "能用一句话概括规律"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "从2个例子归纳" },
        { level: "L2", label: "进阶", description: "从3-4个例子归纳" },
        { level: "L3", label: "挑战", description: "排除反例后归纳" },
        { level: "L4", label: "专家", description: "归纳并预测新例" },
      ],
      completionCriteria: { correctnessRate: 0.75, selfExplained: true },
    },
    {
      id: "analogy-transfer",
      label: "类比迁移",
      parentGoalId: "observation-induction",
      observableBehaviors: ["能把一个领域的规律应用到另一个领域", "能识别两个不同情境的相似结构"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "直接类比（同类型题）" },
        { level: "L2", label: "进阶", description: "跨情境类比" },
        { level: "L3", label: "挑战", description: "结构类比" },
        { level: "L4", label: "专家", description: "抽象原理迁移" },
      ],
      completionCriteria: { correctnessRate: 0.7, selfExplained: true },
    },
  ],
};

// ---------------------------------------------------------------------------
// 主导出
// ---------------------------------------------------------------------------

export const TRAINING_GOALS: TrainingGoal[] = [
  MATH_THINKING,
  LOGICAL_REASONING,
  CREATIVE_THINKING,
  LANGUAGE_THINKING,
  STRATEGY_THINKING,
  OBSERVATION_INDUCTION,
];

export const GOAL_MAP = new Map<string, TrainingGoal>(
  TRAINING_GOALS.map((g) => [g.id, g])
);

export function getGoal(id: string): TrainingGoal | undefined {
  return GOAL_MAP.get(id);
}

export function getAllSubGoalIds(): string[] {
  return TRAINING_GOALS.flatMap((g) => g.subGoals.map((s) => s.id));
}
