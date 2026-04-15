import { getDomainPedagogyConfig, getSubGoalPlaybook, resolveScoringMode } from "@/lib/training/domain-pedagogy";
import { getAgeInteractionBand, getAgeInteractionRules, type AgeInteractionBand } from "@/prompts/modules/age-adapter";
import type {
  DifficultyLevelName,
  EvidenceSlot,
  GoalId,
  RepairStrategy,
  ScoringMode,
  ThinEvidenceType,
} from "@/types/goals";
import type { MasteryProfile, MasteryState } from "./mastery-engine";

export interface TrainingIntent {
  goalId: GoalId;
  subGoalId: string;
  scoringMode: ScoringMode;
  difficultyLevel: DifficultyLevelName;
  pedagogyModel: string;
  teachingMove: string;
  expectedEvidence: EvidenceSlot[];
  evidenceSlotTarget: EvidenceSlot;
  allowedActivityScope: string[];
  activityId?: string;
  masteryStage: MasteryState["stage"];
  nextAction: MasteryState["nextAction"];
  reason: string;
  trainingFocus: string;
  commonMistakes: string[];
  hintLadder: Array<{
    level: 1 | 2 | 3;
    label: string;
    guidance: string;
  }>;
  allowedTeachingMoves: string[];
  nextIfMastered: string;
  nextIfStuck: string;
  repairStrategy?: RepairStrategy;
  thinEvidenceType?: ThinEvidenceType;
  handoffTemplate?: string;
  repairPrompts?: Partial<Record<RepairStrategy, string[]>>;
  attentionRecoveryPrompts?: string[];
  ageBand: AgeInteractionBand;
  ageInteractionRules: string[];
}

export interface TrainingIntentRepairContext {
  thinEvidenceType?: ThinEvidenceType;
  silentStreak?: number;
}

export interface BuildTrainingIntentInput {
  masteryProfile: MasteryProfile;
  subGoalId?: string;
  activityId?: string;
  repairContext?: TrainingIntentRepairContext;
  birthday?: string;
}

function chooseTeachingMove(state: MasteryState): string {
  switch (state.nextAction) {
    case "diagnose":
      return "probe";
    case "fallback":
      return "hint";
    case "advance":
      return "ask_to_predict";
    case "transfer":
      return "transfer_check";
    case "repair_evidence":
      return "ask_to_explain";
    case "repeat":
    default:
      return state.selfExplainRate < 0.4 ? "ask_to_explain" : "contrast";
  }
}

export function buildTrainingIntent(input: BuildTrainingIntentInput): TrainingIntent {
  const subGoalId = input.subGoalId ?? input.masteryProfile.primarySubGoalId;
  const state = input.masteryProfile.states[subGoalId];
  const playbook = getSubGoalPlaybook(subGoalId);
  const domainConfig = getDomainPedagogyConfig(input.masteryProfile.goalId);
  const proposedMove = chooseTeachingMove(state);
  const teachingMove = playbook.allowedTeachingMoves.includes(proposedMove)
    ? proposedMove
    : playbook.allowedTeachingMoves[0];
  const repairThinEvidenceType = state.nextAction === "repair_evidence"
    ? input.repairContext?.thinEvidenceType
    : undefined;
  const repairStrategy = repairThinEvidenceType
    ? playbook.thinEvidenceRoutes?.[repairThinEvidenceType] ??
      (repairThinEvidenceType === "empty_evidence"
        ? (input.repairContext?.silentStreak ?? 0) >= 2
          ? "sentence_frame"
          : "attention_recovery"
        : undefined)
    : undefined;
  const handoffTemplate = repairStrategy
    ? playbook.handoffPrompts?.[repairStrategy]?.[0]
    : undefined;
  const evidenceSlotTarget = state.nextAction === "repair_evidence" &&
    playbook.evidenceRubric.requiredEvidenceSlots.includes("self_explanation")
    ? "self_explanation"
    : playbook.evidenceRubric.requiredEvidenceSlots[0];
  const ageBand = input.birthday ? getAgeInteractionBand(input.birthday) : "younger_kid";
  const ageInteractionRules = input.birthday
    ? getAgeInteractionRules(input.birthday)
    : ["Keep the tone clear, playful, and age-appropriate."];

  return {
    goalId: input.masteryProfile.goalId,
    subGoalId,
    scoringMode: resolveScoringMode(input.masteryProfile.goalId, subGoalId),
    difficultyLevel: state.recommendedDifficulty,
    pedagogyModel: domainConfig.methodologyModel,
    teachingMove,
    expectedEvidence: playbook.evidenceRubric.requiredEvidenceSlots,
    evidenceSlotTarget,
    allowedActivityScope: playbook.activityIds,
    activityId: input.activityId,
    masteryStage: state.stage,
    nextAction: state.nextAction,
    reason: state.reason,
    trainingFocus: playbook.trainingIntent,
    commonMistakes: playbook.commonMisconceptions,
    hintLadder: playbook.hintLadder,
    allowedTeachingMoves: playbook.allowedTeachingMoves,
    nextIfMastered: playbook.transferPatterns[0] ?? "Move to a transfer task in the same domain.",
    nextIfStuck: playbook.followUpPatterns[0] ?? "Stay on the same sub-goal with a lighter scaffold.",
    repairStrategy,
    thinEvidenceType: repairThinEvidenceType,
    handoffTemplate,
    repairPrompts: playbook.repairPrompts,
    attentionRecoveryPrompts: playbook.attentionRecoveryPrompts,
    ageBand,
    ageInteractionRules,
  };
}
