import { getActivitySession, type ActivitySessionRow } from "@/lib/data/db";
import { getSubGoalPlaybook } from "@/lib/training/domain-pedagogy";
import type { MasteryProfile } from "@/lib/training/mastery-engine";
import {
  buildPatternRecognitionActivityRuntime,
  readPatternRecognitionChallengeSpec,
} from "@/lib/training/pattern-activity-runtime";
import type { TrainingIntent } from "@/lib/training/training-intent";
import { buildSystemPrompt, type PromptBuildDebug } from "@/prompts/agent-system-prompt";
import type { AgentTurnRequest } from "@/types/agent";
import type {
  ChallengeGenerationStatus,
  ChildProfile,
  GeneratedPatternChallengeSpec,
  PatternChallengeSource,
  PromptAssemblyState,
  RepairStrategy,
  ScoringMode,
  ThinEvidenceType,
} from "@/types/goals";

export interface PromptBuilderContext {
  profile: ChildProfile;
  goalFocus: string[];
  turnIndex: number;
  currentActivity?: string;
  currentActivityId?: string;
  activitySessionId?: string;
  currentGoalId?: string;
  currentSubGoalId?: string;
  masteryProfile?: MasteryProfile;
  trainingIntent?: TrainingIntent;
  scoringMode?: ScoringMode;
}

export interface PromptAssemblyRuntime {
  assemblyState: PromptAssemblyState;
  redirectCount: number;
  noiseTurnCount: number;
  emptyEvidenceStreak: number;
  thinEvidenceType?: ThinEvidenceType;
  repairStrategy?: RepairStrategy;
  handoffTemplate?: string;
  silentStreak?: number;
  recognizedEvidenceKind?: string;
  circuitBreakerTriggered: boolean;
  currentTurnNoise: boolean;
  currentTurnRedirectCount: number;
  isColdStart: boolean;
  handoffExpired: boolean;
  challengeId?: string;
  challengeSpec?: GeneratedPatternChallengeSpec;
  challengeSource?: PatternChallengeSource;
  challengeGenerationStatus?: ChallengeGenerationStatus;
  sessionRow?: ActivitySessionRow;
}

export interface PromptAssemblyResult {
  prompt: string;
  debug: PromptBuildDebug;
  runtime: PromptAssemblyRuntime;
  effectiveTrainingIntent?: TrainingIntent;
}

function normalizeInputForHeuristic(input: string): string {
  return input.trim().toLowerCase();
}

function looksLikePatternWork(input: string): boolean {
  if (!input) return false;
  if (/\d/.test(input)) return true;
  if (/[+\-*/=<>]/.test(input)) return true;
  return /(规律|顺序|因为|每次|下一个|继续|一样|轮流|重复|pattern|next|because|same|more|less)/i.test(input);
}

function isClearlyOffTaskInput(childInput: AgentTurnRequest, context: PromptBuilderContext): boolean {
  if (childInput.inputType === "choice" || childInput.inputType === "number") {
    return false;
  }

  const normalized = normalizeInputForHeuristic(childInput.input);
  if (!normalized) return true;
  if (normalized.length <= 1 && !/\d/.test(normalized)) return true;

  const obviousOffTaskPattern = /(不想|不要|不玩|肚子饿|饿了|吃饭|晚饭|唱歌|玩具|聊天|不做数学|不做这个|skip|hungry|dinner|sing|song|toy)/i;
  if (obviousOffTaskPattern.test(normalized)) {
    return true;
  }

  const alphaOnly = /^[a-z\s]+$/i.test(normalized) && !looksLikePatternWork(normalized);
  if (alphaOnly) return true;

  if (context.currentSubGoalId === "pattern-recognition" && !looksLikePatternWork(normalized)) {
    const noMathShape = !/\d/.test(normalized) && !/(因为|每次|规律|下一个|一样|轮流|重复|变|红|黄|圆|方|大|小|转)/.test(normalized);
    if (noMathShape && normalized.length >= 4) {
      return true;
    }
  }

  return false;
}

function isColdStart(sessionRow: ActivitySessionRow | undefined, turnIndex: number): boolean {
  if (turnIndex === 0 || !sessionRow) {
    return true;
  }

  return (
    sessionRow.thin_evidence_type == null &&
    sessionRow.repair_strategy == null &&
    (sessionRow.redirect_count ?? 0) === 0 &&
    (sessionRow.noise_turn_count ?? 0) === 0 &&
    (sessionRow.empty_evidence_streak ?? 0) === 0 &&
    sessionRow.status === "in_progress"
  );
}

function buildEffectiveHandoffTemplate(
  trainingIntent: TrainingIntent | undefined,
  sessionRow: ActivitySessionRow | undefined,
  currentSubGoalId?: string,
): { handoffTemplate?: string; handoffExpired: boolean } {
  if (!trainingIntent?.handoffTemplate) {
    return { handoffTemplate: undefined, handoffExpired: false };
  }

  const playbook = currentSubGoalId ? getSubGoalPlaybook(currentSubGoalId) : undefined;
  const expiryMinutes = playbook?.handoffExpiryMinutes ?? 15;
  const updatedAt = sessionRow?.updated_at;
  if (!updatedAt) {
    return { handoffTemplate: trainingIntent.handoffTemplate, handoffExpired: false };
  }

  const elapsedMs = Date.now() - new Date(updatedAt).getTime();
  const handoffExpired = Number.isFinite(elapsedMs) && elapsedMs > expiryMinutes * 60_000;
  if (!handoffExpired) {
    return { handoffTemplate: trainingIntent.handoffTemplate, handoffExpired: false };
  }

  return {
    handoffTemplate: `欢迎回来！我们接着看刚才那一题。${trainingIntent.handoffTemplate}`,
    handoffExpired: true,
  };
}

function derivePromptAssemblyRuntime(
  childInput: AgentTurnRequest,
  context: PromptBuilderContext,
): PromptAssemblyRuntime {
  const sessionRow = context.activitySessionId
    ? getActivitySession(context.activitySessionId)
    : undefined;
  const redirectCount = sessionRow?.redirect_count ?? 0;
  const noiseTurnCount = sessionRow?.noise_turn_count ?? 0;
  const emptyEvidenceStreak = sessionRow?.empty_evidence_streak ?? 0;
  const thinEvidenceType = sessionRow?.thin_evidence_type as ThinEvidenceType | undefined;
  const repairStrategy = sessionRow?.repair_strategy as RepairStrategy | undefined;
  const silentStreak = sessionRow?.silent_streak ?? undefined;
  const recognizedEvidenceKind = sessionRow?.recognized_evidence_kind ?? undefined;
  const coldStart = isColdStart(sessionRow, context.turnIndex);
  const currentTurnNoise =
    (context.scoringMode ?? "experimental_unscored") === "formal_scored" &&
    !coldStart &&
    isClearlyOffTaskInput(childInput, context);
  const currentTurnRedirectCount = currentTurnNoise ? redirectCount + 1 : redirectCount;
  const nextNoiseTurnCount = currentTurnNoise ? noiseTurnCount + 1 : 0;
  const circuitBreakerTriggered =
    (context.scoringMode ?? "experimental_unscored") === "formal_scored" &&
    !coldStart &&
    (currentTurnRedirectCount >= 3 || emptyEvidenceStreak >= 3 || nextNoiseTurnCount >= 3);

  let assemblyState: PromptAssemblyState;
  if ((context.scoringMode ?? "experimental_unscored") !== "formal_scored") {
    assemblyState = "experimental_chat";
  } else if (coldStart) {
    assemblyState = "initial_probe";
  } else if (circuitBreakerTriggered) {
    assemblyState = "force_abandon";
  } else if (currentTurnNoise) {
    assemblyState = "gentle_redirect_ready";
  } else if (context.trainingIntent?.nextAction === "repair_evidence") {
    assemblyState = "evidence_repair";
  } else if (context.trainingIntent?.nextAction === "fallback") {
    assemblyState = "hint_repair";
  } else if (context.trainingIntent?.nextAction === "advance") {
    assemblyState = "stable_push";
  } else if (context.trainingIntent?.nextAction === "transfer") {
    assemblyState = "wrap_or_transfer";
  } else {
    assemblyState = "initial_probe";
  }

  return {
    assemblyState,
    redirectCount,
    noiseTurnCount,
    emptyEvidenceStreak,
    thinEvidenceType,
    repairStrategy,
    handoffTemplate: sessionRow?.handoff_template ?? undefined,
    silentStreak,
    recognizedEvidenceKind,
    circuitBreakerTriggered,
    currentTurnNoise,
    currentTurnRedirectCount,
    isColdStart: coldStart,
    handoffExpired: false,
    challengeId: sessionRow?.challenge_id ?? undefined,
    challengeSpec: readPatternRecognitionChallengeSpec(sessionRow),
    challengeSource: sessionRow?.challenge_source ?? undefined,
    challengeGenerationStatus: sessionRow?.challenge_generation_status ?? undefined,
    sessionRow,
  };
}

function buildEffectiveTrainingIntent(
  trainingIntent: TrainingIntent | undefined,
  runtime: PromptAssemblyRuntime,
  context: PromptBuilderContext,
): TrainingIntent | undefined {
  if (!trainingIntent) {
    return undefined;
  }

  const effective: TrainingIntent = { ...trainingIntent };

  if (runtime.assemblyState !== "evidence_repair") {
    effective.repairStrategy = undefined;
    effective.thinEvidenceType = undefined;
    effective.handoffTemplate = undefined;
    return effective;
  }

  effective.repairStrategy = effective.repairStrategy ?? runtime.repairStrategy;
  effective.thinEvidenceType = effective.thinEvidenceType ?? runtime.thinEvidenceType;

  const handoff = buildEffectiveHandoffTemplate(
    effective,
    runtime.sessionRow,
    context.currentSubGoalId,
  );

  runtime.handoffExpired = handoff.handoffExpired;
  effective.handoffTemplate = handoff.handoffTemplate;
  return effective;
}

export function buildPromptAssembly(
  childInput: AgentTurnRequest,
  context: PromptBuilderContext,
): PromptAssemblyResult {
  const runtime = derivePromptAssemblyRuntime(childInput, context);
  const effectiveTrainingIntent = buildEffectiveTrainingIntent(
    context.trainingIntent,
    runtime,
    context,
  );

  const effectiveCurrentActivity =
    context.currentSubGoalId === "pattern-recognition" &&
    (context.scoringMode ?? "experimental_unscored") === "formal_scored"
      ? (() => {
          const activityRuntime = buildPatternRecognitionActivityRuntime({
            activitySessionId: context.activitySessionId,
            difficultyLevel: effectiveTrainingIntent?.difficultyLevel,
            birthday: context.profile.birthday,
            assemblyState: runtime.assemblyState,
            repairStrategy: effectiveTrainingIntent?.repairStrategy,
            handoffTemplate: effectiveTrainingIntent?.handoffTemplate,
            challengeSpec: runtime.challengeSpec,
          });
          runtime.challengeSpec = activityRuntime.challengeSpec ?? runtime.challengeSpec;
          runtime.challengeId = activityRuntime.challengeSpec?.sessionChallengeId ?? runtime.challengeId;
          return activityRuntime.activityText;
        })()
      : context.currentActivity;

  const { prompt, debug } = buildSystemPrompt(
    context.profile,
    context.goalFocus,
    effectiveCurrentActivity,
    undefined,
    context.masteryProfile,
    effectiveTrainingIntent,
    {
      scoringMode: context.scoringMode ?? "experimental_unscored",
      assemblyState: runtime.assemblyState,
      redirectCount: runtime.currentTurnRedirectCount,
      emptyEvidenceStreak: runtime.emptyEvidenceStreak,
      circuitBreakerTriggered: runtime.circuitBreakerTriggered,
      thinEvidenceType: effectiveTrainingIntent?.thinEvidenceType ?? runtime.thinEvidenceType,
      repairStrategy: effectiveTrainingIntent?.repairStrategy ?? runtime.repairStrategy,
      handoffTemplate: effectiveTrainingIntent?.handoffTemplate ?? runtime.handoffTemplate,
      silentStreak: runtime.silentStreak,
      injectedFewShotProfile:
        context.currentSubGoalId === "pattern-recognition"
          ? "pattern-recognition-matrix-v2"
          : undefined,
    },
  );

  return {
    prompt,
    debug: {
      ...debug,
      isColdStart: runtime.isColdStart,
      handoffExpired: runtime.handoffExpired,
      injectedBlocks: debug.injectedBlocks,
      estimatedTokens: debug.estimatedTokens,
    },
    runtime,
    effectiveTrainingIntent,
  };
}
