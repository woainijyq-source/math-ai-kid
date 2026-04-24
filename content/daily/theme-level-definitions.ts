import type { DailyThemeId, DailyThemeLevelDefinition } from "@/types/daily";

export const DAILY_THEME_LEVEL_DEFINITIONS: Record<Exclude<DailyThemeId, "math">, DailyThemeLevelDefinition[]> = {
  pattern: [
    {
      level: 1,
      title: "先看见规律",
      childGoal: "先看到什么在重复，或者下一步大概会是什么。",
      signsOfReadiness: ["能说出下一项", "能说哪里一样"],
    },
    {
      level: 2,
      title: "开始说清规律",
      childGoal: "不只看见规律，还能开始用自己的话把它说清。",
      signsOfReadiness: ["能说每次怎么变", "能比较两个可能规则"],
    },
    {
      level: 3,
      title: "换一种样子也能认出来",
      childGoal: "换一种方向、顺序或表示方式后，还能继续跟上。",
      signsOfReadiness: ["换条件后仍能跟上", "不会一变就完全丢掉方向"],
    },
  ],
  why: [
    {
      level: 1,
      title: "先敢猜一个原因",
      childGoal: "先愿意大胆说一个可能原因。",
      signsOfReadiness: ["肯开口猜", "开始用“因为”"],
    },
    {
      level: 2,
      title: "开始比较两个原因",
      childGoal: "不只给一个原因，还能比较哪个更像。",
      signsOfReadiness: ["能比较两个原因", "会提到换个情况也许不同"],
    },
    {
      level: 3,
      title: "从猜原因走到想办法",
      childGoal: "能把原因推进成回应、办法或新的可能。",
      signsOfReadiness: ["能提出多个可能", "能从解释走到行动"],
    },
  ],
  fairness: [
    {
      level: 1,
      title: "先看出哪里不太公平",
      childGoal: "先开始区分一样多和公平并不总是一回事。",
      signsOfReadiness: ["能指出哪里别扭", "能给出一个简单理由"],
    },
    {
      level: 2,
      title: "开始比较规则",
      childGoal: "开始比较两种规则谁更合适。",
      signsOfReadiness: ["能比较规则", "能提出更合理的新规则"],
    },
    {
      level: 3,
      title: "情境变了规则也会变",
      childGoal: "一旦人或条件变了，能重新调整规则。",
      signsOfReadiness: ["能接受规则会变", "会根据新情况重新定规则"],
    },
  ],
  "what-if": [
    {
      level: 1,
      title: "先进入假设世界",
      childGoal: "先顺着一个假设说出第一件会发生什么。",
      signsOfReadiness: ["能说第一步变化", "不只说“会乱”"],
    },
    {
      level: 2,
      title: "开始比较不同后果",
      childGoal: "不只想一个画面，还能比较两个可能的变化。",
      signsOfReadiness: ["能比较后果", "会说“如果换一下也许会不同”"],
    },
    {
      level: 3,
      title: "开始想到规则和系统",
      childGoal: "能把假设推进到规则层或更大的系统变化。",
      signsOfReadiness: ["会提规则怎么改", "会想到结构怎么跟着变"],
    },
  ],
};

export function getThemeLevelDefinition(themeId: DailyThemeId | undefined, level = 1) {
  if (!themeId || themeId === "math") {
    return undefined;
  }

  return DAILY_THEME_LEVEL_DEFINITIONS[themeId]?.find((item) => item.level === level);
}
