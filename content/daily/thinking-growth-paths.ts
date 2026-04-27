import { getThinkingMoveLabel } from "@/content/daily/thinking-evidence-rubric";
import type { DailyThemeId, ThinkingMove } from "@/types/daily";
import type { GoalId } from "@/types/goals";

export type ThinkingProjectStatus = "ready" | "observing" | "active" | "stretch" | "support";

export interface ThinkingGrowthLevel {
  level: number;
  title: string;
  childGoal: string;
  parentDescription: string;
  evidenceExamples: string[];
  evidenceIndicators?: Partial<Record<ThinkingMove, string[]>>;
  nextStep: string;
}

export interface ThinkingGrowthPath {
  themeId: DailyThemeId;
  label: string;
  shortLabel: string;
  internalFocus: string;
  targetThinkingMoves: ThinkingMove[];
  goalId: GoalId;
  subGoalIds: string[];
  whyThisMatters: string;
  scientificBasis: string[];
  levels: ThinkingGrowthLevel[];
}

export const THINKING_GROWTH_PATHS: ThinkingGrowthPath[] = [
  {
    themeId: "math",
    label: "数学思维",
    shortLabel: "数学",
    internalFocus: "数量关系、空间关系、策略比较、规则表达",
    targetThinkingMoves: ["notice", "represent", "compare", "predict", "transfer", "reflect"],
    goalId: "math-thinking",
    subGoalIds: ["quantity-comparison", "spatial-reasoning", "pattern-recognition", "strategy-planning"],
    whyThisMatters: "数学不是反复刷算式，而是让孩子在真实小情境里理解数量、结构和策略。",
    scientificBasis: [
      "Common Core 数学实践：理解问题、构造理由、寻找结构、发现重复推理。",
      "新加坡小学数学框架：以问题解决为中心，把概念、技能、过程和元认知连起来。",
    ],
    levels: [
      {
        level: 1,
        title: "观察与计数",
        childGoal: "先看见数量、位置或多少的变化。",
        parentDescription: "孩子先能说出“有几个、谁多一点、放在哪里”。",
        evidenceExamples: ["能指出数量差异", "能说先数什么", "能比较多和少"],
        nextStep: "下一次先用分一分、比一比、摆一摆的轻场景进入。",
      },
      {
        level: 2,
        title: "策略比较",
        childGoal: "开始比较两个办法哪个更省劲、更稳。",
        parentDescription: "孩子不只给答案，还能说为什么这个办法更好。",
        evidenceExamples: ["会比较两种数法", "会说哪个更快", "会解释为什么这样分"],
        nextStep: "下一次会换一个相近场景，让孩子比较两种办法。",
      },
      {
        level: 3,
        title: "规则表达",
        childGoal: "把做法说成别人也听得懂的小规则。",
        parentDescription: "孩子能把“我会做”推进到“我能说清楚怎么做”。",
        evidenceExamples: ["能说出规则", "能指出关键条件", "能发现条件变了规则也要改"],
        nextStep: "下一次会让孩子把办法说成一句小规则，再轻轻换一个条件。",
      },
      {
        level: 4,
        title: "多步推理",
        childGoal: "在故事里连续想两三步，看到选择带来的后果。",
        parentDescription: "孩子开始把顺序、条件和结果放在一起想。",
        evidenceExamples: ["能预测下一步", "能解释顺序影响", "能根据新情况调整计划"],
        nextStep: "下一次会用故事决策题，看孩子能不能连续想后果。",
      },
    ],
  },
  {
    themeId: "pattern",
    label: "观察规律",
    shortLabel: "规律",
    internalFocus: "系统观察、归纳、规则检验、迁移",
    targetThinkingMoves: ["notice", "represent", "explain", "compare", "transfer"],
    goalId: "observation-induction",
    subGoalIds: ["systematic-observation", "inductive-generalization"],
    whyThisMatters: "规律训练的重点不是猜中下一格，而是看见证据、说出规则、检查例外。",
    scientificBasis: [
      "Project Zero 可视化思维：先看见，再解释，再提出疑问。",
      "Common Core 数学实践：寻找结构和重复推理。",
    ],
    levels: [
      {
        level: 1,
        title: "先看见重复",
        childGoal: "先说出什么在重复，或者下一步像什么。",
        parentDescription: "孩子能从颜色、方向、节奏里先抓住明显线索。",
        evidenceExamples: ["能说出下一项", "能说哪里一样", "能指出重复块"],
        nextStep: "下一次会用短规律，让孩子先说看见了什么。",
      },
      {
        level: 2,
        title: "说清规则",
        childGoal: "用自己的话说出每次怎么变。",
        parentDescription: "孩子开始从“猜到了”走向“能说为什么”。",
        evidenceExamples: ["会说每次多几个", "会说红蓝怎么轮流", "会比较两个可能规则"],
        nextStep: "下一次会让孩子把规律说成一句短话。",
      },
      {
        level: 3,
        title: "检查例外",
        childGoal: "看到一个不一样的地方，判断它有没有破坏规律。",
        parentDescription: "孩子开始用证据挡住不合适的答案。",
        evidenceExamples: ["能说明错答案哪里错", "能发现中间多了一格", "能说规则还成不成立"],
        nextStep: "下一次会放一个小变化，让孩子判断规则有没有被打破。",
      },
      {
        level: 4,
        title: "换样子迁移",
        childGoal: "换成声音、动作或不同图形后，还能认出同一种规律。",
        parentDescription: "孩子不只记住表面图案，而是抓住背后的结构。",
        evidenceExamples: ["能把颜色规律迁移到动作", "能换一种说法仍认出规则", "能自己造一个同类规律"],
        nextStep: "下一次会换一种表现方式，看孩子能不能继续认出同一类规律。",
      },
    ],
  },
  {
    themeId: "why",
    label: "为什么与解释",
    shortLabel: "为什么",
    internalFocus: "原因猜想、证据支持、解释修正、行动建议",
    targetThinkingMoves: ["notice", "explain", "compare", "predict", "reflect"],
    goalId: "language-thinking",
    subGoalIds: ["explain-reasoning"],
    whyThisMatters: "会解释不是背标准答案，而是愿意提出原因、比较原因、根据证据修正想法。",
    scientificBasis: [
      "NGSS 科学实践：提出问题、构建解释、用证据比较观点。",
      "Project Zero Claim / Support / Question：提出想法、找支持、继续追问。",
    ],
    levels: [
      {
        level: 1,
        title: "敢猜原因",
        childGoal: "先愿意说一个可能的“因为”。",
        parentDescription: "孩子先能大胆提出一个原因，不急着对错。",
        evidenceExamples: ["愿意猜一个原因", "开始使用因为", "能联系生活经验"],
        nextStep: "下一次会用生活小现象，让孩子先猜一个原因。",
      },
      {
        level: 2,
        title: "补上理由",
        childGoal: "把原因说完整一点，说出自己怎么想到的。",
        parentDescription: "孩子开始把一个短猜想补成更完整的解释。",
        evidenceExamples: ["能补一句理由", "能说从哪里看出来", "能把现象和原因连起来"],
        nextStep: "下一次会接住孩子的猜想，再请她补一句理由。",
      },
      {
        level: 3,
        title: "比较原因",
        childGoal: "比较两个可能原因，判断哪个更像。",
        parentDescription: "孩子开始知道同一个现象可能不止一个解释。",
        evidenceExamples: ["能比较两个原因", "能说哪个更像", "能想到换条件后可能不同"],
        nextStep: "下一次会给两个可能方向，让孩子选更像的并说明原因。",
      },
      {
        level: 4,
        title: "从解释到办法",
        childGoal: "根据原因想一个办法，或修正原来的猜想。",
        parentDescription: "孩子能把解释推进成行动、验证或新的问题。",
        evidenceExamples: ["能提出验证办法", "能修正猜想", "能把原因变成下一步行动"],
        nextStep: "下一次会问如果这个原因是真的，可以怎么试一试。",
      },
    ],
  },
  {
    themeId: "fairness",
    label: "公平与选择",
    shortLabel: "公平",
    internalFocus: "规则意识、视角转换、权衡、负责任选择",
    targetThinkingMoves: ["notice", "compare", "predict", "transfer", "reflect"],
    goalId: "creative-thinking",
    subGoalIds: ["rule-creation"],
    whyThisMatters: "公平不是唯一标准答案，而是让孩子学习看见不同人的需要，并调整规则。",
    scientificBasis: [
      "CASEL 社会情绪学习：社会觉察、关系技能、负责任决策。",
      "OECD Learning Compass：在冲突和两难中权衡、行动、反思。",
    ],
    levels: [
      {
        level: 1,
        title: "看见不公平",
        childGoal: "先指出哪里让人觉得不太公平。",
        parentDescription: "孩子开始注意到一样多和真正合适不总是一回事。",
        evidenceExamples: ["能指出谁可能不开心", "能说哪里别扭", "能注意到数量或顺序差异"],
        nextStep: "下一次会用分东西或排队场景，让孩子先指出哪里不太公平。",
      },
      {
        level: 2,
        title: "比较规则",
        childGoal: "比较两种规则，选一个更合适的。",
        parentDescription: "孩子开始明白规则会影响不同的人。",
        evidenceExamples: ["能比较一样多和看情况", "能说规则照顾了谁", "能提出一个更顺的办法"],
        nextStep: "下一次会给两种规则，让孩子比较哪一种更合适。",
      },
      {
        level: 3,
        title: "照顾变化",
        childGoal: "当人数、需要或条件变了，愿意调整规则。",
        parentDescription: "孩子开始接受公平需要看情境，不是死规则。",
        evidenceExamples: ["能根据新人加入改规则", "能想到有人需要更多帮助", "能接受规则会变"],
        nextStep: "下一次会加一个新条件，看孩子会不会调整原规则。",
      },
      {
        level: 4,
        title: "自己设计规则",
        childGoal: "设计一条大家更容易接受的新规则。",
        parentDescription: "孩子开始综合公平、效率、感受来创造规则。",
        evidenceExamples: ["能设计新规则", "能说明规则保护谁", "能想到执行后的影响"],
        nextStep: "下一次会请孩子当规则设计师，想一条能执行的规则。",
      },
    ],
  },
  {
    themeId: "what-if",
    label: "假设与预测",
    shortLabel: "如果",
    internalFocus: "假设进入、后果预测、系统变化、创造性改进",
    targetThinkingMoves: ["predict", "compare", "transfer", "reflect"],
    goalId: "creative-thinking",
    subGoalIds: ["hypothetical-thinking"],
    whyThisMatters: "假设题不是随便幻想，而是练习先预测第一步，再看后果怎样连起来。",
    scientificBasis: [
      "OECD PISA 创造性思维：生成多样想法、评价并改进想法。",
      "OECD Learning Compass：预想、行动、反思的循环。",
    ],
    levels: [
      {
        level: 1,
        title: "进入假设",
        childGoal: "顺着一个如果，说出第一件会发生什么。",
        parentDescription: "孩子先能进入想象世界，并说出一个具体变化。",
        evidenceExamples: ["能说第一步变化", "能描述一个画面", "不只说会乱"],
        nextStep: "下一次会用一个小小的如果，让孩子先说第一件事。",
      },
      {
        level: 2,
        title: "比较后果",
        childGoal: "比较两种可能后果，判断哪一个更像。",
        parentDescription: "孩子开始知道一个假设可能有不止一种结果。",
        evidenceExamples: ["能说两种可能", "能比较谁先受影响", "能说为什么这个更像"],
        nextStep: "下一次会让孩子比较两个可能后果。",
      },
      {
        level: 3,
        title: "想到规则",
        childGoal: "看到如果发生后，哪些规则或习惯要跟着变。",
        parentDescription: "孩子开始从单个画面走向系统变化。",
        evidenceExamples: ["能说要改哪条规则", "能想到影响到谁", "能说哪里变得不一样"],
        nextStep: "下一次会追问这个变化会让哪条规则跟着改。",
      },
      {
        level: 4,
        title: "创造新办法",
        childGoal: "为这个新世界设计一个更好的办法。",
        parentDescription: "孩子能把想象推进成解决方案或新规则。",
        evidenceExamples: ["能设计新办法", "能改进原想法", "能说明办法为什么更好"],
        nextStep: "下一次会让孩子给假设世界设计一个小办法。",
      },
    ],
  },
];

export const THINKING_GROWTH_PATH_MAP = new Map(
  THINKING_GROWTH_PATHS.map((path) => [path.themeId, path]),
);

export function getThinkingGrowthPath(themeId: DailyThemeId | undefined) {
  return themeId ? THINKING_GROWTH_PATH_MAP.get(themeId) : undefined;
}

export function clampThinkingLevel(themeId: DailyThemeId, level: number | undefined) {
  const path = getThinkingGrowthPath(themeId);
  const maxLevel = path?.levels.length ?? 4;
  const normalized = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 1;
  return Math.max(1, Math.min(maxLevel, normalized));
}

export function getThinkingGrowthLevel(themeId: DailyThemeId, level: number | undefined) {
  const path = getThinkingGrowthPath(themeId);
  const clamped = clampThinkingLevel(themeId, level);
  return path?.levels.find((item) => item.level === clamped) ?? path?.levels[0];
}

export function buildThinkingGrowthPromptLines(themeId: DailyThemeId, level: number | undefined) {
  const path = getThinkingGrowthPath(themeId);
  const currentLevel = getThinkingGrowthLevel(themeId, level);
  if (!path || !currentLevel) return [];

  return [
    "科学成长路径：",
    `项目：${path.label}`,
    `内部能力：${path.internalFocus}`,
    `目标 Thinking Moves：${path.targetThinkingMoves.map(getThinkingMoveLabel).join(" / ")}`,
    `当前层级：L${currentLevel.level} / ${currentLevel.title}`,
    `这一层儿童目标：${currentLevel.childGoal}`,
    `这一层可观察证据：${currentLevel.evidenceExamples.join(" / ")}`,
    "证据边界：只点选项只能算薄线索；L4 必须来自孩子自己的总结、规则、办法或修正，不能由 AI 总结后孩子只回答“对”。",
    `下一步安排原则：${currentLevel.nextStep}`,
  ];
}
