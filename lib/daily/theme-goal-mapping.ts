import type { DailyThemeId } from "@/types/daily";
import type { GoalId } from "@/types/goals";
import type { ProgressionStageId } from "@/types";

export interface ThemeGoalMapping {
  goalId: GoalId;
  subGoalId: string;
  preferredSubGoalIds?: string[];
}

export const MATH_STAGE_GOAL_MAPPING: Record<ProgressionStageId, ThemeGoalMapping> = {
  "foundation-observe": {
    goalId: "math-thinking",
    subGoalId: "quantity-comparison",
    preferredSubGoalIds: ["quantity-comparison", "spatial-reasoning"],
  },
  "strategy-pattern": {
    goalId: "math-thinking",
    subGoalId: "pattern-recognition",
    preferredSubGoalIds: ["pattern-recognition", "strategy-planning"],
  },
  "rules-expression": {
    goalId: "math-thinking",
    subGoalId: "strategy-planning",
    preferredSubGoalIds: ["strategy-planning", "pattern-recognition", "spatial-reasoning"],
  },
  "story-reasoning": {
    goalId: "math-thinking",
    subGoalId: "strategy-planning",
    preferredSubGoalIds: ["strategy-planning", "spatial-reasoning", "quantity-comparison"],
  },
};

export const DAILY_THEME_GOAL_MAPPING: Record<Exclude<DailyThemeId, "math">, ThemeGoalMapping> = {
  pattern: {
    goalId: "observation-induction",
    subGoalId: "inductive-generalization",
  },
  why: {
    goalId: "language-thinking",
    subGoalId: "explain-reasoning",
  },
  fairness: {
    goalId: "creative-thinking",
    subGoalId: "rule-creation",
  },
  "what-if": {
    goalId: "creative-thinking",
    subGoalId: "hypothetical-thinking",
  },
};

export function getMathStageGoalMapping(stageId?: ProgressionStageId): ThemeGoalMapping {
  return stageId ? MATH_STAGE_GOAL_MAPPING[stageId] : MATH_STAGE_GOAL_MAPPING["foundation-observe"];
}

export function getThemeGoalMapping(
  themeId: DailyThemeId | undefined,
  options?: { progressionStageId?: ProgressionStageId },
) {
  if (!themeId) {
    return undefined;
  }
  if (themeId === "math") {
    return getMathStageGoalMapping(options?.progressionStageId);
  }

  return DAILY_THEME_GOAL_MAPPING[themeId];
}
