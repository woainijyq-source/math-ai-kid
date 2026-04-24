import type { GoalId } from "./goals";
import type { ProgressionStageId } from "./index";

export type DailyThemeId =
  | "math"
  | "pattern"
  | "why"
  | "fairness"
  | "what-if";

export type DailySuggestedInput = "choice" | "voice" | "text";

export type DailyCoachMove =
  | "open_question"
  | "clarify_reasoning"
  | "compare_options"
  | "push_half_step"
  | "scaffold_with_choices"
  | "gentle_rehook"
  | "wrap_up";

export type DailyChildSignalType =
  | "brief_answer"
  | "reasoned_answer"
  | "imaginative_answer"
  | "uncertain"
  | "off_topic"
  | "resistant";

export interface DailyThemeDefinition {
  id: DailyThemeId;
  label: string;
  shortLabel: string;
  icon: string;
  summary: string;
  accentClass: string;
  softClass: string;
}

export interface DailyThemePlaybook {
  themeId: DailyThemeId;
  childFacingGoal: string;
  anchorMoves: string[];
  sceneLenses: string[];
  moveGuidance: Record<DailyCoachMove, string>;
  warmPhrases: string[];
  avoid: string[];
}

export interface DailyThemeLevelDefinition {
  level: number;
  title: string;
  childGoal: string;
  signsOfReadiness: string[];
}

export interface DailyChildSignal {
  type: DailyChildSignalType;
  summary: string;
  suggestedMove: DailyCoachMove;
  shouldOfferChoices: boolean;
}

export interface DailyQuestion {
  id: string;
  themeId: DailyThemeId;
  title: string;
  progressionStageId?: ProgressionStageId;
  adaptationLevel?: number;
  sceneSetup: string;
  sceneDetail: string;
  hook: string;
  mainQuestion: string;
  firstFollowUp: string;
  twistFollowUp: string;
  suggestedInput: DailySuggestedInput;
  goalId: GoalId;
  subGoalId: string;
  coachFocus: string;
}
