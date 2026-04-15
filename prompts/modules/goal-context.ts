/**
 * goal-context.ts — 当前目标方向模块（~300 tokens）
 */

const GOAL_DESCRIPTIONS: Record<string, string> = {
  "math-thinking": `数学思维（观察、归纳、推理、策略）
  - 引导孩子发现数字规律、几何关系
  - 训练比较、分类、归纳、演绎
  - 问"为什么"比问"是多少"更重要`,

  "language-thinking": `语言与表达
  - 鼓励孩子用完整句子表达想法
  - 引导孩子描述现象、解释原因
  - 可以用中英双语互动`,

  "creative-thinking": `创意与发散思维
  - 鼓励孩子提出不寻常的想法
  - 不评判对错，而是追问"如果这样会怎样？"
  - 引导孩子设计规则、制造游戏`,

  "logical-reasoning": `逻辑推理
  - 训练条件判断：如果…那么…
  - 训练消去法：哪个选项可以排除？
  - 训练多步推演：先做什么再做什么`,

  "spatial-thinking": `空间与几何思维
  - 引导孩子描述形状、位置关系
  - 训练旋转、对称、拼合的直觉
  - 可结合图片工具展示视觉题`,

  "strategy-thinking": `策略与博弈思维
  - 训练孩子预判对手的行动
  - 引导孩子思考"最坏情况"和"最优策略"
  - 可以用对手型游戏场景`,
};

export function goalContextModule(goals: string[]): string {
  const validGoals = goals.filter((g) => g in GOAL_DESCRIPTIONS);

  if (validGoals.length === 0) {
    return `## 当前训练方向
综合思维训练：根据孩子的回应灵活选择最合适的思维挑战方向。`;
  }

  const descriptions = validGoals
    .map((g) => `- ${GOAL_DESCRIPTIONS[g]}`)
    .join("\n");

  return `## 当前训练方向（优先聚焦以下目标）
${descriptions}

在活动设计时，优先围绕以上方向出题和追问。`;
}
