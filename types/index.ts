import type { DailyThemeId } from "./daily";

export type TaskMode = "opponent" | "co-create" | "story";
export type InputMode = "text" | "voice" | "choice" | "touch";
export type AIIntent =
  | "challenge"
  | "coach"
  | "storybeat"
  | "reflection"
  | "summary";
export type VoiceStatus = "idle" | "recording" | "uploading" | "ready" | "error";
export type VoiceRole = "guide" | "opponent" | "maker" | "storyteller" | "parent";

export interface TaskStep {
  id: string;
  label: string;
  description: string;
}

export interface TaskConfig {
  id: string;
  mode: TaskMode;
  title: string;
  goal: string;
  subtitle: string;
  inputModes: InputMode[];
  steps: TaskStep[];
  completionRule: string;
  rewardHooks: Array<"instant" | "identity" | "world">;
}

export interface AIMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  intent: AIIntent;
  hints: string[];
  nextAction?: string;
  speakerName?: string;
  voiceRole?: VoiceRole;
  speakableText?: string;
  autoSpeak?: boolean;
}

export interface TaskSessionState {
  taskId: string;
  mode: TaskMode;
  stage: number;
  status: "idle" | "active" | "completed";
  progress: number;
  completion: string;
  messages: AIMessage[];
  meta: Record<string, unknown>;
}

export interface WorldState {
  zone: string;
  statusText: string;
  streakDays: number;
  unlockedAreas: string[];
  recentChanges: string[];
}

export interface RewardSignal {
  type: "instant" | "identity" | "world";
  title: string;
  detail: string;
}

export interface RewardState {
  currentIdentity: string;
  unlockedTitles: string[];
  unlockedPerks: string[];
  lastSignals: RewardSignal[];
}

export interface PlayerProfile {
  nickname: string;
  preferredModes: TaskMode[];
  totalSessions: number;
  lastTaskId?: string;
}

export interface ParentSummary {
  dailySummary: string;
  strengthSignals: string[];
  stuckSignals: string[];
  nextSuggestion: string;
  recentHighlights: string[];
  latestMathFocus?: string;
  observedMoves?: string[];
  aiFocus?: string[];
}

export interface VoiceInputState {
  status: VoiceStatus;
  transcript: string;
  fallbackUsed: boolean;
  confidence: number;
}

export interface ChatRequestPayload {
  mode: TaskMode;
  taskId: string;
  message: string;
  session: TaskSessionState;
  action?: string;
}

export interface ChatResponsePayload {
  messages: AIMessage[];
  sessionPatch: Partial<TaskSessionState>;
  worldPatch: Partial<WorldState>;
  rewardSignals: RewardSignal[];
}

export interface SttResponsePayload {
  transcript: string;
  confidence: number;
  fallbackUsed: boolean;
}

export interface TtsRequestPayload {
  text: string;
  voiceRole: VoiceRole;
  speakerName?: string;
}

export interface TtsResponsePayload {
  text: string;
  voiceRole: VoiceRole;
  speakerName?: string;
  fallbackUsed: boolean;
  audioBase64?: string;
  mimeType?: string;
}

export type SummaryResponsePayload = ParentSummary;

export type MathDifficultySignal = "too_easy" | "fit" | "too_hard";

export type MathSupportLevel = "light" | "medium" | "heavy";

export interface MathEvidence {
  themeId?: DailyThemeId;
  kernelId?: string;
  publicTitle: string;
  skillFocus: string[];
  observedMoves: string[];
  aiFocus: string[];
  progressionStageId?: ProgressionStageId;
  goalId?: string;
  subGoalId?: string;
  reasoningShown?: boolean;
  transferAttempted?: boolean;
  supportLevel?: MathSupportLevel;
  difficultySignal?: MathDifficultySignal;
  adaptationLevel?: number;
  nextSuggestedLevel?: number;
  nextSuggestedStageId?: ProgressionStageId;
}

export interface CompletedSessionPayload {
  profileId?: string;
  mode: TaskMode;
  taskId: string;
  sceneId?: string;
  title: string;
  completion: string;
  highlights: string[];
  rewardSignals: RewardSignal[];
  mathEvidence?: MathEvidence;
}

export type PlaytestMode = TaskMode | "mixed";
export type ContinueIntent = "high" | "medium" | "low";

export interface PlaytestLogEntry {
  id: string;
  createdAt: string;
  testerName: string;
  participantLabel: string;
  mode: PlaytestMode;
  summary: string;
  delightMoment: string;
  frictionPoint: string;
  nextAction: string;
  continueIntent: ContinueIntent;
}

export type MathSkillTag =
  | "观察与计数"
  | "模式识别"
  | "策略规划"
  | "规则表达"
  | "条件约束"
  | "因果推理"
  | "多步推演";

export type ProgressionStageId =
  | "foundation-observe"
  | "strategy-pattern"
  | "rules-expression"
  | "story-reasoning";

export interface MathProgressionStage {
  id: ProgressionStageId;
  title: string;
  summary: string;
  skills: MathSkillTag[];
  nextStageId?: ProgressionStageId;
}

export interface SceneLearningFocus {
  stageId: ProgressionStageId;
  childGoal: string;
  adultNote: string;
  aiExpansionPrompt: string;
  skills: MathSkillTag[];
}

export interface OpponentSceneConfig {
  id: string;
  mode: "opponent";
  title: string;
  intro: string;
  introSpeakable: string;
  hint: string;
  actionLabels: {
    takeOne: { label: string; description: string; userLine: string };
    takeTwo: { label: string; description: string; userLine: string };
  };
  voicePrompt: string;
  learning: SceneLearningFocus;
  completionHighlights: string[];
}

export interface CoCreateSceneConfig {
  id: string;
  mode: "co-create";
  title: string;
  intro: string;
  introSpeakable: string;
  hint: string;
  starterRules: string[];
  fragments: string[];
  placeholder: string;
  submitLabel: string;
  learning: SceneLearningFocus;
  completionHighlights: string[];
}

export interface StoryChoiceConfig {
  label: string;
  description: string;
  value: string;
  badge: string;
}

export interface StorySceneConfig {
  id: string;
  mode: "story";
  title: string;
  intro: string;
  introSpeakable: string;
  hint: string;
  worldLineLabel: string;
  worldLineSummary: string;
  choiceSets: StoryChoiceConfig[][];
  learning: SceneLearningFocus;
  completionHighlights: string[];
}

export type MathKernelId =
  | "quantity-allocation"
  | "pattern-routing"
  | "constraint-elimination"
  | "multi-step-planning";

export interface MathTaskVariable {
  key: string;
  label: string;
  description: string;
}

export interface MathTaskConstraint {
  key: string;
  label: string;
  description: string;
}

export interface StoryOptionSeed {
  id: string;
  label: string;
  description: string;
  mathMove: string;
}

export interface MathTaskFrame {
  id: string;
  childPrompt: string;
  directorNote: string;
  optionSeeds: StoryOptionSeed[];
  followUpQuestion: string;
}

export type KernelSkillTag =
  | MathSkillTag
  | "数量关系与分配"
  | "规律识别"
  | "策略规划"
  | "规则表达"
  | "条件约束"
  | "因果推理"
  | "多步推演"
  | "逻辑推理";

export interface MathTaskKernel {
  id: MathKernelId;
  title: string;
  publicTitle: string;
  mathGoal: string;
  childFacingHook: string;
  skillFocus: KernelSkillTag[];
  variables: MathTaskVariable[];
  constraints: MathTaskConstraint[];
  aiDirectorPrompt: string;
  aiEvaluationFocus: string[];
  successSignal: string;
  frames: MathTaskFrame[];
}

export interface StoryEpisode {
  id: string;
  title: string;
  narratorName: string;
  sceneBackdrop: string;
  openingBeat: string;
  worldLineLabel: string;
  worldLineSummary: string;
  kernelId: MathKernelId;
}
