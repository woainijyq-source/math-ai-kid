import type { ToolName } from "./agent";

export interface DifficultyLevel {
  level: "L1" | "L2" | "L3" | "L4";
  label: string;
  description: string;
}

export type DifficultyLevelName = DifficultyLevel["level"];

export type GoalId =
  | "math-thinking"
  | "logical-reasoning"
  | "creative-thinking"
  | "language-thinking"
  | "strategy-thinking"
  | "observation-induction";

export type ObservationCorrectness =
  | "correct"
  | "partial"
  | "incorrect"
  | "unknown";

export type ObservationEvidenceType =
  | "answer"
  | "self_explanation"
  | "rule_statement"
  | "contrastive_rebuttal"
  | "activity_summary"
  | "strategy_prediction"
  | "transfer_check"
  | "idea_improvement"
  | "describe_observation"
  | "general";

export type ThinEvidenceType =
  | "intuition_only"
  | "energetic_but_unfocused"
  | "silent_or_blank_first"
  | "silent_or_blank_repeat"
  | "empty_evidence";

export type RepairStrategy =
  | "contrastive_rebuttal"
  | "feynman_teach_me"
  | "attention_recovery"
  | "sentence_frame";

export type EvidenceSlot =
  | "answer"
  | "self_explanation"
  | "activity_summary"
  | "strategy_prediction"
  | "transfer_check"
  | "idea_improvement"
  | "describe_observation";

export type ObservationSource =
  | "child_text"
  | "child_voice_stt"
  | "evaluator_inferred"
  | "system_event";

export type ObservationStatus =
  | "filled"
  | "missing"
  | "low_confidence"
  | "auto_inferred";

export type ActivitySessionStatus =
  | "in_progress"
  | "passed_complete"
  | "passed_evidence_thin"
  | "not_yet_mastered"
  | "abandoned";

export type ScoringMode =
  | "formal_scored"
  | "experimental_unscored";

export type PromptAssemblyState =
  | "initial_probe"
  | "hint_repair"
  | "evidence_repair"
  | "stable_push"
  | "wrap_or_transfer"
  | "gentle_redirect_ready"
  | "force_abandon"
  | "experimental_chat";

export type DomainReadiness =
  | "ready"
  | "pilot"
  | "building";

export type ActivityTrack = "core" | "transfer";

export type PatternKind = "quantity" | "attribute" | "space";

export type PatternChallengeSource = "ai_generated" | "authored_fallback";

export type ChallengeGenerationStatus =
  | "ready"
  | "retrying"
  | "fallback_ready"
  | "failed";

export type GeneratedPatternVisualShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "arrow";

export interface GeneratedPatternVisualItem {
  kind: "number" | "shape" | "symbol";
  label: string;
  text?: string;
  shape?: GeneratedPatternVisualShape;
  color?: string;
  size?: "small" | "medium" | "large";
  rotation?: 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
}

export interface GeneratedPatternVisualSpec {
  layout: "row";
  promptItems: GeneratedPatternVisualItem[];
  answerItem: GeneratedPatternVisualItem;
  questionTileLabel?: string;
  altText?: string;
}

export interface GeneratedPatternRuleModel {
  family: string;
  summary: string;
  explanationFrame: string;
  expectedEvidencePhrases: string[];
  contrastTarget: string;
}

export interface GeneratedPatternChallengeSpec {
  sessionChallengeId: string;
  subGoalId: "pattern-recognition";
  difficultyLevel: DifficultyLevelName;
  patternKind: PatternKind;
  prompt: string;
  options: string[];
  correctAnswer: string;
  acceptedAnswerAliases: string[];
  visualSpec: GeneratedPatternVisualSpec;
  ruleModel: GeneratedPatternRuleModel;
  contrastTarget: string;
  explanationFrame: string;
}

export interface CompletionCriteria {
  correctnessRate?: number;
  maxHintCount?: number;
  selfExplained?: boolean;
}

export interface ActivityTemplate {
  id: string;
  label: string;
  goalId: GoalId;
  subGoalId: string;
  description: string;
  suggestedTools: ToolName[];
  ageRange: [number, number];
  durationMinutes: number;
  systemPromptFragment: string;
  exampleFlow?: string;
  coreOrTransfer?: ActivityTrack;
  requiredEvidenceSlots?: EvidenceSlot[];
  evaluatorRubricId?: string;
  fallbackWhenEvidenceThin?: string;
}

export interface SubGoal {
  id: string;
  label: string;
  parentGoalId: GoalId;
  observableBehaviors: string[];
  difficultyLevels: DifficultyLevel[];
  completionCriteria: CompletionCriteria;
  activityTemplates?: ActivityTemplate[];
}

export interface TrainingGoal {
  id: GoalId;
  label: string;
  description: string;
  subGoals: SubGoal[];
}

export interface ObservationEvidence {
  childInput?: string;
  toolContext?: string[];
  hintUsed?: boolean;
  answerQuality?: string;
  evidenceType?: ObservationEvidenceType;
  rawEvidence?: string;
  thinEvidenceType?: ThinEvidenceType;
  recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
  repairRecommended?: RepairStrategy;
  silentStreak?: number;
}

export interface ObservationSummary {
  goalId: string;
  subGoalId: string;
  skill: string;
  observation: string;
  confidence: number;
  difficultyLevel: DifficultyLevelName;
  hintCount?: number;
  selfExplained?: boolean;
  correctness?: ObservationCorrectness;
  taskId?: string;
  activityId?: string;
  evidenceType?: ObservationEvidenceType;
  masteryDelta?: number;
  evidence?: ObservationEvidence;
  activitySessionId?: string;
  evidenceSlot?: EvidenceSlot;
  source?: ObservationSource;
  status?: ObservationStatus;
  misconceptionTag?: string;
  rubricScore?: number;
  isRequired?: boolean;
  isAutoInferred?: boolean;
  activityStatus?: ActivitySessionStatus;
  scoringMode?: ScoringMode;
  thinEvidenceType?: ThinEvidenceType;
  recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
  repairRecommended?: RepairStrategy;
  silentStreak?: number;
  createdAt: string;
}

export interface ActivitySessionSummary {
  id: string;
  sessionId: string;
  profileId: string;
  goalId: string;
  subGoalId: string;
  activityId: string;
  status: ActivitySessionStatus;
  scoringMode: ScoringMode;
  requiredEvidenceSlots: EvidenceSlot[];
  completedEvidenceSlots: EvidenceSlot[];
  missingEvidenceSlots: EvidenceSlot[];
  latestDifficultyLevel?: DifficultyLevelName;
  hintCount: number;
  evidenceThinCount: number;
  redirectCount: number;
  noiseTurnCount: number;
  emptyEvidenceStreak: number;
  thinEvidenceType?: ThinEvidenceType;
  repairStrategy?: RepairStrategy;
  handoffTemplate?: string;
  silentStreak?: number;
  recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
  challengeId?: string;
  challengeSpec?: GeneratedPatternChallengeSpec;
  challengeSource?: PatternChallengeSource;
  challengeGenerationStatus?: ChallengeGenerationStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface DomainPedagogyConfig {
  goalId: GoalId;
  methodologyModel: string;
  readiness: DomainReadiness;
  reportNarrativeStyle: "formal" | "warm_coach" | "playful";
  coreTeachingMoves: string[];
  requiredEvidenceSlots: EvidenceSlot[];
  defaultScaffoldLadder: Array<{
    level: 1 | 2 | 3;
    label: string;
    guidance: string;
  }>;
  masteryPromotionRules: string[];
  evidenceThinFallback: string;
}

export interface SubGoalPlaybook {
  goalId: GoalId;
  subGoalId: string;
  label: string;
  trainingIntent: string;
  commonMisconceptions: string[];
  hintLadder: Array<{
    level: 1 | 2 | 3;
    label: string;
    guidance: string;
  }>;
  evidenceRubric: {
    requiredEvidenceSlots: EvidenceSlot[];
    successSignals: string[];
    warningSignals: string[];
  };
  followUpPatterns: string[];
  transferPatterns: string[];
  promptDos: string[];
  promptDonts: string[];
  allowedTeachingMoves: string[];
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
  evaluatorFewShotMatrix?: Array<{
    input: string;
    recognizedEvidenceKind: ObservationEvidenceType | "empty_evidence";
    thinEvidenceType?: ThinEvidenceType;
    repairRecommended?: RepairStrategy;
    confidence: "high" | "medium-high" | "medium" | "low";
    notes?: string;
  }>;
  challengeBank?: PatternChallengeCard[];
}

export interface PatternChallengeCard {
  id: string;
  difficultyLevel: DifficultyLevelName;
  patternKind: PatternKind;
  stem: string;
  prompt: string;
  options: string[];
  answer: string;
  ruleHint: string;
  contrastChoice: string;
  explanationFrame: string;
}

export interface ChildProfile {
  id: string;
  nickname: string;
  birthday: string;
  goalPreferences: string[];
  recentObservations?: ObservationSummary[];
  avatarDataUrl?: string;
}
