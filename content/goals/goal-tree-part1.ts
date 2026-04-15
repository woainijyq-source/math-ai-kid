/**
 * T4.1 — 训练目标树（前半：目标 1-3）
 * 完整文件见 goal-tree.ts，由 goal-tree-part2.ts 合并导出。
 */

import type { TrainingGoal } from "@/types/goals";

const MATH_THINKING: TrainingGoal = {
  id: "math-thinking",
  label: "数学思维",
  description: "通过观察、归纳、推理、策略训练孩子的数学直觉和逻辑能力",
  subGoals: [
    {
      id: "pattern-recognition",
      label: "规律识别",
      parentGoalId: "math-thinking",
      observableBehaviors: ["能找出数列中的变化规律", "能用自己的话描述发现的规律"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "3以内简单加法规律，如 1,2,3,4" },
        { level: "L2", label: "进阶", description: "等差数列，步长2-5" },
        { level: "L3", label: "挑战", description: "多步规律或混合规律" },
        { level: "L4", label: "专家", description: "二维规律或多条件组合规律" },
      ],
      completionCriteria: { correctnessRate: 0.75, maxHintCount: 2 },
    },
    {
      id: "quantity-comparison",
      label: "数量关系",
      parentGoalId: "math-thinking",
      observableBehaviors: ["能比较两组数量的多少", "能用加减法解释数量变化"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "10以内数量比较" },
        { level: "L2", label: "进阶", description: "20以内加减运算" },
        { level: "L3", label: "挑战", description: "多步数量关系推理" },
        { level: "L4", label: "专家", description: "比例与分配问题" },
      ],
      completionCriteria: { correctnessRate: 0.8 },
    },
    {
      id: "strategy-planning",
      label: "策略规划",
      parentGoalId: "math-thinking",
      observableBehaviors: ["能预判几步后的结果", "能解释为什么选择某个策略"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "2步以内的策略选择" },
        { level: "L2", label: "进阶", description: "3-4步策略规划" },
        { level: "L3", label: "挑战", description: "考虑对手行动的博弈策略" },
        { level: "L4", label: "专家", description: "最优策略证明" },
      ],
      completionCriteria: { correctnessRate: 0.7, selfExplained: true },
    },
    {
      id: "spatial-reasoning",
      label: "空间推理",
      parentGoalId: "math-thinking",
      observableBehaviors: ["能描述图形的位置关系", "能在脑中旋转或翻转图形"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "基本形状识别和位置描述" },
        { level: "L2", label: "进阶", description: "图形变换（旋转、对称）" },
        { level: "L3", label: "挑战", description: "拼图和空间组合" },
        { level: "L4", label: "专家", description: "三维空间想象" },
      ],
      completionCriteria: { correctnessRate: 0.7 },
    },
  ],
};

const LOGICAL_REASONING: TrainingGoal = {
  id: "logical-reasoning",
  label: "逻辑推理",
  description: "训练条件判断、消去法、多步推演等核心逻辑能力",
  subGoals: [
    {
      id: "conditional-thinking",
      label: "条件推理",
      parentGoalId: "logical-reasoning",
      observableBehaviors: ["能理解条件关系", "能根据条件推导结论"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "单一条件推理" },
        { level: "L2", label: "进阶", description: "两个条件组合" },
        { level: "L3", label: "挑战", description: "矛盾条件识别" },
        { level: "L4", label: "专家", description: "多条件复合推理" },
      ],
      completionCriteria: { correctnessRate: 0.75, selfExplained: true },
    },
    {
      id: "elimination-method",
      label: "消去法",
      parentGoalId: "logical-reasoning",
      observableBehaviors: ["能主动排除不符合条件的选项", "能解释为什么某个选项被排除"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "从3个选项中排除1个" },
        { level: "L2", label: "进阶", description: "从4个选项中排除2个" },
        { level: "L3", label: "挑战", description: "多轮排除" },
        { level: "L4", label: "专家", description: "逆向推理确认唯一解" },
      ],
      completionCriteria: { correctnessRate: 0.8 },
    },
    {
      id: "multi-step-reasoning",
      label: "多步推演",
      parentGoalId: "logical-reasoning",
      observableBehaviors: ["能把复杂问题分解为多个小步骤", "能按顺序执行推理步骤"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "2步推理" },
        { level: "L2", label: "进阶", description: "3步推理" },
        { level: "L3", label: "挑战", description: "4-5步推理链" },
        { level: "L4", label: "专家", description: "分支推理" },
      ],
      completionCriteria: { correctnessRate: 0.7, selfExplained: true },
    },
  ],
};

const CREATIVE_THINKING: TrainingGoal = {
  id: "creative-thinking",
  label: "创意思维",
  description: "鼓励发散思维、规则创造和非常规解法",
  subGoals: [
    {
      id: "rule-creation",
      label: "规则创造",
      parentGoalId: "creative-thinking",
      observableBehaviors: ["能提出一条有逻辑的新规则", "能解释规则的适用条件"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "修改现有规则的一个参数" },
        { level: "L2", label: "进阶", description: "创造包含条件的规则" },
        { level: "L3", label: "挑战", description: "设计公平的双人规则" },
        { level: "L4", label: "专家", description: "创造自洽的规则系统" },
      ],
      completionCriteria: { selfExplained: true },
    },
    {
      id: "divergent-thinking",
      label: "发散思维",
      parentGoalId: "creative-thinking",
      observableBehaviors: ["能给出3个以上不同的答案", "能接受开放性问题没有唯一答案"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "列举2种不同方法" },
        { level: "L2", label: "进阶", description: "列举3-4种方法并比较" },
        { level: "L3", label: "挑战", description: "找出非常规解法" },
        { level: "L4", label: "专家", description: "跨领域类比迁移" },
      ],
      completionCriteria: { selfExplained: true },
    },
    {
      id: "hypothetical-thinking",
      label: "假设推演",
      parentGoalId: "creative-thinking",
      observableBehaviors: ["能接受假设情境", "能推演假设下的结果"],
      difficultyLevels: [
        { level: "L1", label: "初级", description: "单步假设" },
        { level: "L2", label: "进阶", description: "多步假设推演" },
        { level: "L3", label: "挑战", description: "反事实推理" },
        { level: "L4", label: "专家", description: "假设系统的一致性验证" },
      ],
      completionCriteria: { selfExplained: true },
    },
  ],
};

export { MATH_THINKING, LOGICAL_REASONING, CREATIVE_THINKING };
