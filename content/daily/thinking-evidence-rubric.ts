import type { ThinkingMove } from "@/types/daily";

export const THINKING_MOVE_LABELS: Record<ThinkingMove, string> = {
  notice: "观察",
  represent: "表征",
  explain: "解释",
  compare: "比较",
  predict: "预测",
  transfer: "迁移",
  reflect: "反思",
};

export const THINKING_MOVE_PARENT_PROMPTS: Record<ThinkingMove, string> = {
  notice: "你刚才先看见了什么？",
  represent: "你能不能画一画、摆一摆，或者换句话说一遍？",
  explain: "你为什么会这样想？",
  compare: "这两个办法哪里一样，哪里不一样？",
  predict: "如果继续下去，下一步最可能发生什么？",
  transfer: "如果换一个人或换一个地方，这个办法还管用吗？",
  reflect: "如果重来一次，你想保留哪一步、改哪一步？",
};

export interface ThinkingEvidenceRubricLevel {
  level: 1 | 2 | 3 | 4;
  title: string;
  countsAsEvidence: string[];
  notEvidence: string[];
}

export const THINKING_EVIDENCE_RUBRIC: ThinkingEvidenceRubricLevel[] = [
  {
    level: 1,
    title: "能看见或进入情境",
    countsAsEvidence: [
      "孩子用自己的话指出一个数量、位置、变化、人物感受或第一步后果。",
      "孩子能在图、故事或生活场景里选出一个相关线索。",
    ],
    notEvidence: [
      "只点了一个选项，但没有任何补充。",
      "只复述 AI 给出的完整句子。",
    ],
  },
  {
    level: 2,
    title: "能补理由或说关系",
    countsAsEvidence: [
      "孩子用“因为、所以、我发现、我觉得”等表达，把答案和理由连起来。",
      "孩子能说明两个元素之间的数量、顺序、原因、规则或感受关系。",
    ],
    notEvidence: [
      "只说“对、不是、我不知道”。",
      "理由完全由 AI 说出，孩子只确认。",
    ],
  },
  {
    level: 3,
    title: "能处理变化或比较选择",
    countsAsEvidence: [
      "孩子能在条件变化后调整原来的答案、规则或办法。",
      "孩子能比较两个可能原因、办法、后果或规则，并说出取舍。",
    ],
    notEvidence: [
      "孩子只跟随 AI 的二选一标签，没有说出差异。",
      "AI 已经给出完整调整方案，孩子只说“可以”。",
    ],
  },
  {
    level: 4,
    title: "能自己总结、修正或迁移",
    countsAsEvidence: [
      "孩子自己说出规则、方法、总结、修正或可迁移的办法。",
      "孩子能把原来的想法换到新场景，并说明为什么还管用或为什么要改。",
    ],
    notEvidence: [
      "AI 总结后孩子只回答“对”。",
      "孩子只重复 AI 的规则句，没有加入自己的表达或修正。",
    ],
  },
];

export function getThinkingMoveLabel(move: ThinkingMove) {
  return THINKING_MOVE_LABELS[move];
}

export function getThinkingMoveParentPrompt(move: ThinkingMove) {
  return THINKING_MOVE_PARENT_PROMPTS[move];
}

export function getThinkingEvidenceRubricLevel(level: number) {
  return THINKING_EVIDENCE_RUBRIC.find((item) => item.level === level);
}
