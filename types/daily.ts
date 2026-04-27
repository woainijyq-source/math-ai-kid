import type { GoalId } from "./goals";
import type { ProgressionStageId } from "./index";

export type DailyThemeId =
  | "math"
  | "pattern"
  | "why"
  | "fairness"
  | "what-if";

export type DailySuggestedInput = "choice" | "voice" | "text";

export type ThinkingMove =
  | "notice"
  | "represent"
  | "explain"
  | "compare"
  | "predict"
  | "transfer"
  | "reflect";

export type ThinkingSupportLevel = "none" | "light" | "medium" | "heavy";

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

export interface ThinkingEvidence {
  themeId: DailyThemeId;
  scenarioId?: string;
  scenarioTitle?: string;
  thinkingMove: ThinkingMove;
  level: 1 | 2 | 3 | 4;
  childInitiated: boolean;
  supportLevel: ThinkingSupportLevel;
  confidence: number;
  childUtterance: string;
  aiPrompt?: string;
}

export interface ScenarioTemplateVariable {
  key: string;
  label: string;
  examples: string[];
  defaultValue?: string;
}

export interface ScenarioTemplate {
  id: string;
  themeId: DailyThemeId;
  title: string;
  scenarioType: string;
  levelRange: [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
  targetThinkingMoves: ThinkingMove[];
  variables: ScenarioTemplateVariable[];
  imagePrompt: string;
  sceneSetup: string;
  sceneDetail: string;
  hook: string;
  openingQuestion: string;
  scaffoldOptions: string[];
  conditionChanges: string[];
  evidenceTargets: string[];
  wrapUpQuestion: string;
  suggestedInput: DailySuggestedInput;
  goalId: GoalId;
  subGoalId: string;
  progressionStageId?: ProgressionStageId;
  coachFocus: string;
}

export interface DailyChildSignal {
  type: DailyChildSignalType;
  summary: string;
  suggestedMove: DailyCoachMove;
  shouldOfferChoices: boolean;
}

export interface DailyQuestion {
  id: string;
  scenarioTemplateId?: string;
  scenarioVariantKey?: string;
  scenarioVariables?: Record<string, string>;
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
