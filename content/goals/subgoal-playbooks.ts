import type {
  ActivityTemplate,
  ObservationEvidenceType,
  PatternChallengeCard,
  RepairStrategy,
  ThinEvidenceType,
} from "@/types/goals";
import { ALL_ACTIVITIES } from "@/content/activities/activity-templates";
import { PATTERN_RECOGNITION_CHALLENGE_BANK } from "@/content/goals/pattern-recognition-challenges";

export type PilotGoalId =
  | "math-thinking"
  | "logical-reasoning"
  | "language-thinking";

export type PilotSubGoalId =
  | "pattern-recognition"
  | "quantity-comparison"
  | "strategy-planning";

export type TeachingMove =
  | "probe"
  | "hint"
  | "contrast"
  | "ask_to_explain"
  | "ask_to_predict"
  | "transfer_check"
  | "wrap_up";

export interface HintStep {
  level: 1 | 2 | 3;
  label: string;
  guidance: string;
}

export interface EvidenceSpec {
  coreEvidence: string[];
  successSignals: string[];
  warningSignals: string[];
}

export interface PromotionRule {
  condition: string;
  action: string;
}

export interface PatternFewShotExample {
  input: string;
  recognizedEvidenceKind: ObservationEvidenceType | "empty_evidence";
  confidence: "high" | "medium-high" | "medium" | "low";
  thinEvidenceType?: ThinEvidenceType;
  repairRecommended?: RepairStrategy;
  notes?: string;
}

export interface SubGoalPlaybook {
  subGoalId: PilotSubGoalId;
  goalId: "math-thinking";
  label: string;
  trainingIntent: string;
  observableBehaviors: string[];
  commonMistakes: string[];
  hintLadder: HintStep[];
  advanceRules: PromotionRule[];
  fallbackRules: PromotionRule[];
  exitRules: string[];
  evidenceSpec: EvidenceSpec;
  allowedTeachingMoves: TeachingMove[];
  activityIds: string[];
  thinEvidenceRoutes?: Partial<Record<ThinEvidenceType, RepairStrategy>>;
  repairPrompts?: Partial<Record<RepairStrategy, string[]>>;
  handoffPrompts?: Partial<Record<RepairStrategy, string[]>>;
  attentionRecoveryPrompts?: string[];
  ruleFragments?: string[];
  handoffExpiryMinutes?: number;
  contrastTargets?: Array<{
    label: string;
    prompt: string;
    category: "quantity" | "attribute" | "space";
  }>;
  evaluatorFewShotMatrix?: PatternFewShotExample[];
  challengeBank?: PatternChallengeCard[];
}

export const PILOT_PRIMARY_GOALS: PilotGoalId[] = ["math-thinking"];

export const PILOT_SUPPORTING_GOALS: PilotGoalId[] = [
  "logical-reasoning",
  "language-thinking",
];

export const PILOT_SUBGOAL_IDS: PilotSubGoalId[] = [
  "pattern-recognition",
  "quantity-comparison",
  "strategy-planning",
];

function getActivityIdsForSubGoal(subGoalId: PilotSubGoalId): string[] {
  return ALL_ACTIVITIES.filter(
    (activity: ActivityTemplate) =>
      activity.goalId === "math-thinking" && activity.subGoalId === subGoalId,
  ).map((activity) => activity.id);
}

export const SUBGOAL_PLAYBOOKS: Record<PilotSubGoalId, SubGoalPlaybook> = {
  "pattern-recognition": {
    subGoalId: "pattern-recognition",
    goalId: "math-thinking",
    label: "规律识别",
    trainingIntent:
      "训练孩子先观察变化，再用自己的话说出局部规则，并能预测下一项。正式闭环把“答对”与“说出规律”都视为关键证据。",
    observableBehaviors: [
      "能指出图形、颜色、数字或方向哪里在变化。",
      "能用自己的短句说出“每次怎么变”。",
      "能根据规律预测下一个答案。",
      "能说明为什么另一个答案不对。",
    ],
    commonMistakes: [
      "只给答案，不说规则。",
      "只看最后一项，忽略整段变化。",
      "说“感觉对”，但说不出到底哪里一样或哪里在变。",
      "已经答对，却不会挡住错误答案。",
    ],
    hintLadder: [
      {
        level: 1,
        label: "先看哪里在变",
        guidance: "先把注意力放回局部变化，不要直接给答案。让孩子先说出是变大、变小、重复，还是换了方向。",
      },
      {
        level: 2,
        label: "并排看两步",
        guidance: "把前后两步并排，让孩子比较“这一步和那一步哪里一样”。重点帮助孩子说出变化单位或重复块。",
      },
      {
        level: 3,
        label: "在两个规则里选",
        guidance: "给两个可能规则，让孩子选更像的一个，并解释为什么另一个不对。",
      },
    ],
    advanceRules: [
      {
        condition: "连续 2 次拿到答案证据和解释等价证据，且提示不超过 1 次。",
        action: "切到同类更长序列，或换成图形/颜色/方向的变式规律。",
      },
      {
        condition: "孩子能主动说出错误选项为什么不对。",
        action: "进入轻迁移，测试孩子能否在新表面故事里继续使用同一个规律。",
      },
    ],
    fallbackRules: [
      {
        condition: "连续 2 次只有答案，没有任何规则表达。",
        action: "保持当前难度，切到低压修复：先让孩子教脑脑，再改成半结构化句架。",
      },
      {
        condition: "提示走到第 3 层仍然说不出规律。",
        action: "降到更短、更具体的规律序列，先收一条清楚的规则短句。",
      },
    ],
    exitRules: [
      "本轮拿到答案证据 + 解释等价证据。",
      "孩子稳定后可切到轻迁移或收尾总结。",
      "如果孩子持续跑题或明显疲劳，允许结束 formal 活动并转入 experimental 陪聊。",
    ],
    evidenceSpec: {
      coreEvidence: [
        "是否给出下一项答案",
        "是否说出局部规律",
        "是否能反驳错误选项",
      ],
      successSignals: [
        "会说“每次多两个”“越来越小”“红黄重复”“转过来了”。",
        "会说“不是 7，因为它没跟前面一样”。",
      ],
      warningSignals: [
        "只说“感觉对”“就是它”。",
        "连续沉默，或只重复题面，不说变化规则。",
      ],
    },
    allowedTeachingMoves: [
      "probe",
      "hint",
      "contrast",
      "ask_to_explain",
      "transfer_check",
      "wrap_up",
    ],
    activityIds: getActivityIdsForSubGoal("pattern-recognition"),
    challengeBank: PATTERN_RECOGNITION_CHALLENGE_BANK,
    thinEvidenceRoutes: {
      intuition_only: "contrastive_rebuttal",
      energetic_but_unfocused: "feynman_teach_me",
      silent_or_blank_first: "attention_recovery",
      silent_or_blank_repeat: "sentence_frame",
    },
    repairPrompts: {
      contrastive_rebuttal: [
        "那为什么不能是另一个答案呢？你帮脑脑挡一下错答案。",
        "如果我故意选错了，它到底错在哪里？",
        "你觉得另一个答案哪里没跟前面一样？",
      ],
      feynman_teach_me: [
        "你太快就看出来了，我还没跟上，你教教我它是怎么变的。",
        "你像小老师一样，带脑脑再看一遍：它每次怎么变？",
        "脑脑有点慢，你带我一步一步看这排东西在怎么走。",
      ],
      attention_recovery: [
        "刚才那一题脑脑怕自己没跟上，你是怎么想到这个答案的呀？",
        "脑脑想再跟一下刚才那一步，你愿意带我看一眼吗？",
      ],
      sentence_frame: [
        "我们把它说完整一点：它是不是每次都在___？",
        "你来补半句：前面的东西一直在___。",
        "我们一起说完整：它每次都___，所以后面应该是___。",
      ],
    },
    handoffPrompts: {
      contrastive_rebuttal: [
        "说到刚才那一题，你已经选对了，那为什么不能是另一个答案呢？",
        "刚才你已经看出来了，脑脑继续追问一下：错答案到底错在哪里？",
      ],
      feynman_teach_me: [
        "刚才你太快就看出来了，我还没跟上，你教教我你是怎么发现的？",
        "说到刚才那一排，你已经选对了，脑脑还想请你带我看一遍。",
      ],
      attention_recovery: [
        "刚才那一题脑脑怕自己没听清，你是怎么选出这个答案的呀？",
        "说到刚才那一题，脑脑想再确认一下，你刚才是怎么想到的？",
      ],
      sentence_frame: [
        "刚才那题你已经选对了，我们把它说完整一点：它是不是每次都在___？",
        "刚才那一排你已经看对了，我们一起把这句话补完整吧。",
      ],
    },
    attentionRecoveryPrompts: [
      "刚才那一题脑脑怕自己没听清，你是怎么选出这个答案的呀？",
      "脑脑想跟上你刚才那一题的速度，你再带我看一下好吗？",
    ],
    handoffExpiryMinutes: 15,
    ruleFragments: [
      "每次加",
      "每次多",
      "每次大",
      "每次减",
      "每次少",
      "越来越大",
      "越来越小",
      "红黄重复",
      "方块圆圈重复",
      "轮流",
      "重复",
      "倒过来了",
      "转面了",
      "换边了",
      "一个大一个小",
      "一个长一个短",
    ],
    contrastTargets: [
      {
        label: "数量错项",
        prompt: "如果这里换成另一个数字，哪里就跟前面不一样了？",
        category: "quantity",
      },
      {
        label: "属性错项",
        prompt: "如果这里换成另一个颜色或形状，哪里就不再像前面那样重复了？",
        category: "attribute",
      },
      {
        label: "空间错项",
        prompt: "如果这里换成另一个方向，哪里就不像前面那样转过来了？",
        category: "space",
      },
    ],
    evaluatorFewShotMatrix: [
      {
        input: "每次多三个",
        recognizedEvidenceKind: "rule_statement",
        confidence: "high",
        notes: "数量规律短句",
      },
      {
        input: "越来越小",
        recognizedEvidenceKind: "rule_statement",
        confidence: "high",
        notes: "数量递减",
      },
      {
        input: "方块圆圈方块圆圈",
        recognizedEvidenceKind: "rule_statement",
        confidence: "high",
        notes: "属性重复",
      },
      {
        input: "红的黄的红的黄的",
        recognizedEvidenceKind: "rule_statement",
        confidence: "high",
        notes: "颜色交替",
      },
      {
        input: "它倒过来了",
        recognizedEvidenceKind: "rule_statement",
        confidence: "medium-high",
        notes: "空间翻转",
      },
      {
        input: "转面了",
        recognizedEvidenceKind: "rule_statement",
        confidence: "medium-high",
        notes: "空间旋转",
      },
      {
        input: "放蓝的就不好看了，跟前面不一样",
        recognizedEvidenceKind: "contrastive_rebuttal",
        confidence: "medium-high",
        notes: "反驳错误属性选项",
      },
      {
        input: "那个不对，少了",
        recognizedEvidenceKind: "contrastive_rebuttal",
        confidence: "medium",
        notes: "反驳错误数量选项",
      },
      {
        input: "下一个是红色，因为前面是红黄红黄",
        recognizedEvidenceKind: "rule_statement",
        confidence: "high",
        notes: "答案和规律混在一句里",
      },
      {
        input: "感觉对",
        recognizedEvidenceKind: "empty_evidence",
        confidence: "low",
        thinEvidenceType: "intuition_only",
        repairRecommended: "contrastive_rebuttal",
        notes: "只有直觉，没有规则",
      },
      {
        input: "不知道，就是它",
        recognizedEvidenceKind: "empty_evidence",
        confidence: "low",
        thinEvidenceType: "silent_or_blank_first",
        repairRecommended: "attention_recovery",
        notes: "没有可用规律证据",
      },
    ],
  },
  "quantity-comparison": {
    subGoalId: "quantity-comparison",
    goalId: "math-thinking",
    label: "数量比较",
    trainingIntent:
      "训练孩子比较两组数量，说明谁多谁少，以及差了多少。",
    observableBehaviors: [
      "能判断谁更多或更少。",
      "能说出差了多少。",
      "能跟踪加减变化后的数量。",
    ],
    commonMistakes: [
      "只能说谁多，不能说差多少。",
      "把当前数量和变化量混在一起。",
      "一遇到两步变化就忘了中间状态。",
    ],
    hintLadder: [
      { level: 1, label: "先数清楚", guidance: "先分别确认两边各有多少，再比较。" },
      { level: 2, label: "搭桥补足", guidance: "把问题改成“再给几个就一样多了”。" },
      { level: 3, label: "缩小差值", guidance: "给两个差值候选，让孩子选更合理的一个。" },
    ],
    advanceRules: [
      {
        condition: "连续 2 次比较正确并解释差值。",
        action: "进入更大数域或两步变化题。",
      },
    ],
    fallbackRules: [
      {
        condition: "比较正确但总是说不出差多少。",
        action: "保持当前难度，增加补足式追问。",
      },
    ],
    exitRules: [
      "本轮拿到比较结果和关系解释。",
      "达到稳定后再进入策略题。",
    ],
    evidenceSpec: {
      coreEvidence: ["比较结果", "差值表达", "变化跟踪"],
      successSignals: ["会说“这边比那边多 2 个”", "会说“再给 1 个就一样多”"],
      warningSignals: ["只会说“这个更多”", "变化一多就丢失当前数量"],
    },
    allowedTeachingMoves: [
      "probe",
      "hint",
      "contrast",
      "ask_to_explain",
      "ask_to_predict",
      "wrap_up",
    ],
    activityIds: getActivityIdsForSubGoal("quantity-comparison"),
  },
  "strategy-planning": {
    subGoalId: "strategy-planning",
    goalId: "math-thinking",
    label: "策略规划",
    trainingIntent:
      "训练孩子预测下一步、比较不同走法的后果，并说出当前选择为什么更稳。",
    observableBehaviors: [
      "能预测下一步或两步后的局面。",
      "能比较两种策略的不同后果。",
      "能说明自己为什么选这一招。",
    ],
    commonMistakes: [
      "只看眼前一步，不看后果。",
      "重复失败策略，不做调整。",
      "能选对但说不出理由。",
    ],
    hintLadder: [
      { level: 1, label: "往后看一步", guidance: "先追问“你这样做以后会剩下什么”。" },
      { level: 2, label: "并排比两种走法", guidance: "把两个方案放在一起比较谁更安全。" },
      { level: 3, label: "补半个结论", guidance: "给一个策略框架，让孩子补上最后一段理由。" },
    ],
    advanceRules: [
      {
        condition: "连续 2 次能预测后果并解释理由。",
        action: "进入更长步数或加入对手反应。",
      },
    ],
    fallbackRules: [
      {
        condition: "总是只报当前动作，无法说出后果。",
        action: "缩短到一步预测，再慢慢拉长。",
      },
    ],
    exitRules: [
      "本轮拿到预测和策略解释。",
      "稳定后才进入更复杂博弈。",
    ],
    evidenceSpec: {
      coreEvidence: ["后果预测", "策略解释", "失败后调整"],
      successSignals: ["会说“我拿 1 个以后会剩 6 个”", "会比较两种走法谁更稳"],
      warningSignals: ["不断重复失败走法", "只说“我想选这个”没有后果说明"],
    },
    allowedTeachingMoves: [
      "probe",
      "hint",
      "contrast",
      "ask_to_explain",
      "ask_to_predict",
      "transfer_check",
      "wrap_up",
    ],
    activityIds: getActivityIdsForSubGoal("strategy-planning"),
  },
};

export function getSubGoalPlaybook(
  subGoalId: PilotSubGoalId,
): SubGoalPlaybook {
  return SUBGOAL_PLAYBOOKS[subGoalId];
}
