import type { DailyCoachMove, DailyThemeId, DailyThemePlaybook } from "@/types/daily";

function buildMoves(moves: Record<DailyCoachMove, string>) {
  return moves;
}

export const DAILY_THEME_PLAYBOOKS: Record<DailyThemeId, DailyThemePlaybook> = {
  math: {
    themeId: "math",
    childFacingGoal: "和孩子一起比较数量、办法、顺序和更省劲的想法。",
    anchorMoves: ["先让孩子说自己的办法，再追问为什么，最后换一个条件。"],
    sceneLenses: ["分东西", "买东西", "排一排", "走一走", "想更快的办法"],
    moveGuidance: buildMoves({
      open_question: "从生活场景开一个具体问题。不要上来讲规则。",
      clarify_reasoning: "抓住孩子刚才的关键词，追问“你为什么会这样想”。",
      compare_options: "把两个办法放在一起比：哪个更快、更公平、更省劲。",
      push_half_step: "只改一个条件，例如多一个人、少一个物品、换一个数量。",
      scaffold_with_choices: "如果孩子卡住，就给两个简单办法让她挑，再问为什么。",
      gentle_rehook: "先接住孩子的话，再轻轻拉回到原来的分配/比较问题。",
      wrap_up: "用一句孩子听得懂的话总结她的想法，不要像老师批改。",
    }),
    warmPhrases: ["这个办法有点聪明哦", "脑脑听懂你在怎么算了", "你是在帮脑脑想一个更省劲的办法"],
    avoid: ["不要变成长计算题", "不要一次问两步以上", "不要直接给标准解法"],
  },
  pattern: {
    themeId: "pattern",
    childFacingGoal: "带孩子发现重复、变化和下一步的感觉。",
    anchorMoves: ["先问她看到了什么在重复，再问下一步会怎样。"],
    sceneLenses: ["颜色", "方向", "节奏", "排队顺序", "一格一格变化"],
    moveGuidance: buildMoves({
      open_question: "让孩子先看或先听，问她“你先发现了什么”。",
      clarify_reasoning: "追问她到底是看到了“重复”还是“每次在变”。",
      compare_options: "拿两个可能规则比较，问哪个更像。",
      push_half_step: "改掉其中一格，问她会不会破坏原来的感觉。",
      scaffold_with_choices: "如果孩子卡住，用两个候选答案帮助她重新看。",
      gentle_rehook: "先接住跑题，再把注意力拉回“刚才那排东西是怎么走的”。",
      wrap_up: "总结她看见了什么规律，不要只夸“答对了”。",
    }),
    warmPhrases: ["你刚才已经盯到变化了", "脑脑跟上你的规律眼睛了", "你看东西看得很细"],
    avoid: ["不要直接报答案", "不要换成另一个完全不同的图案", "不要跳过“你看到了什么”这一步"],
  },
  why: {
    themeId: "why",
    childFacingGoal: "让孩子把自己的猜想和理由说得更完整一点。",
    anchorMoves: ["先接住猜想，再追问“为什么”，最后换个情况看看会不会变。"],
    sceneLenses: ["生活现象", "天气", "影子", "情绪", "小发现"],
    moveGuidance: buildMoves({
      open_question: "先用一个贴近日常的小现象开场，不要像在上科学课。",
      clarify_reasoning: "追问“你是怎么想到这个原因的”，鼓励她补完整。",
      compare_options: "比较两个可能原因，问她更偏向哪一个。",
      push_half_step: "换一个条件，看她会不会调整自己的猜想。",
      scaffold_with_choices: "如果孩子说不知道，可以给两个可能方向让她选。",
      gentle_rehook: "先回应跑题内容，再回到“刚才那个为什么”。",
      wrap_up: "总结她的猜想和理由，告诉她“会想原因”很厉害。",
    }),
    warmPhrases: ["脑脑听到你的“为什么”了", "这个猜想挺像小科学家的", "你已经在认真找原因了"],
    avoid: ["不要急着纠正", "不要上来讲标准知识点", "不要把孩子的猜想当成错误答案批评"],
  },
  fairness: {
    themeId: "fairness",
    childFacingGoal: "让孩子想想规则、轮流、照顾别人和真正的公平。",
    anchorMoves: ["先问她会怎么定规则，再追问“为什么”，最后换一个人或情况。"],
    sceneLenses: ["分点心", "排队", "轮流", "比赛规则", "谁先谁后"],
    moveGuidance: buildMoves({
      open_question: "从孩子熟悉的轮流、排队、分东西开始。",
      clarify_reasoning: "追问她选这条规则时，想照顾的是谁。",
      compare_options: "比较“一样多”和“更合适”这两种想法。",
      push_half_step: "加入一个新人物或新情况，看她要不要改规则。",
      scaffold_with_choices: "如果孩子卡住，就给两个规则让她先选一个更顺眼的。",
      gentle_rehook: "先接住情绪，再轻轻回到“如果你来定规则呢”。",
      wrap_up: "总结她今天想到的是哪种公平，而不是判断她对不对。",
    }),
    warmPhrases: ["你在替大家想办法", "这个规则里有在照顾别人", "脑脑觉得你在认真想“公平”是什么"],
    avoid: ["不要把公平讲成唯一答案", "不要立刻上价值说教", "不要把复杂规则讲太多层"],
  },
  "what-if": {
    themeId: "what-if",
    childFacingGoal: "和孩子一起大胆假设，再想第一步会发生什么。",
    anchorMoves: ["先抛一个假设，再追问第一个变化，最后让孩子想解决办法或新规则。"],
    sceneLenses: ["如果没有", "如果多一个", "如果换个世界", "如果规则消失", "如果东西会变"],
    moveGuidance: buildMoves({
      open_question: "用一个有点神奇但能想象的假设开场。",
      clarify_reasoning: "追问她为什么先想到这个变化。",
      compare_options: "比较两种可能会先发生的事。",
      push_half_step: "再追半步：那之后怎么办，或者要改哪条规则。",
      scaffold_with_choices: "如果孩子卡住，就给两个可能后果让她先挑一个更像的。",
      gentle_rehook: "先承接孩子冒出来的新想法，再把它拉回原来的假设世界。",
      wrap_up: "总结她想象出的世界和第一步变化，让她觉得自己的想法被看见。",
    }),
    warmPhrases: ["这个想法很有画面", "脑脑已经看到你想的那个世界了", "你刚才把“如果”想活了"],
    avoid: ["不要把假设变成空泛聊天", "不要连着追很多层", "不要把孩子的想象硬纠回现实"],
  },
};

export function getDailyThemePlaybook(themeId: DailyThemeId) {
  return DAILY_THEME_PLAYBOOKS[themeId];
}
