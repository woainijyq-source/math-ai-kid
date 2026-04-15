import type { ChildProfile, PromptAssemblyState, ScoringMode } from "../types/goals";
import { identityModule } from "./modules/identity";
import { toolsDescriptionModule } from "./modules/tools-description";
import { ageAdapterModule } from "./modules/age-adapter";
import { safetyRulesModule } from "./modules/safety-rules";
import { childProfileModule } from "./modules/child-profile";
import { orchestrationRulesModule } from "./modules/orchestration-rules";
import { trainingIntentModule } from "./modules/training-intent";
import {
  buildGoalContextPrompt,
  type SkillObservation,
} from "./goal-context-builder";
import type { MasteryProfile } from "@/lib/training/mastery-engine";
import type { TrainingIntent } from "@/lib/training/training-intent";

export interface PromptBuildOptions {
  scoringMode: ScoringMode;
  assemblyState: PromptAssemblyState;
  redirectCount: number;
  emptyEvidenceStreak: number;
  circuitBreakerTriggered: boolean;
  thinEvidenceType?: string;
  repairStrategy?: string;
  handoffTemplate?: string;
  silentStreak?: number;
  injectedFewShotProfile?: string;
}

export interface PromptBuildDebug {
  scoringMode: ScoringMode;
  assemblyState: PromptAssemblyState;
  redirectCount: number;
  emptyEvidenceStreak: number;
  circuitBreakerTriggered: boolean;
  thinEvidenceType?: string;
  repairStrategy?: string;
  handoffTemplate?: string;
  silentStreak?: number;
  injectedFewShotProfile?: string;
  isColdStart?: boolean;
  handoffExpired?: boolean;
  injectedBlocks: string[];
  estimatedTokens: number;
}

export function buildSystemPrompt(
  profile: ChildProfile,
  goals: string[],
  currentActivity?: string,
  observations?: SkillObservation[],
  masteryProfile?: MasteryProfile,
  trainingIntent?: TrainingIntent,
  options: PromptBuildOptions = {
    scoringMode: "experimental_unscored",
    assemblyState: "experimental_chat",
    redirectCount: 0,
    emptyEvidenceStreak: 0,
    circuitBreakerTriggered: false,
    thinEvidenceType: undefined,
    repairStrategy: undefined,
    handoffTemplate: undefined,
    silentStreak: undefined,
    injectedFewShotProfile: undefined,
  },
): { prompt: string; debug: PromptBuildDebug } {
  const skillObs: SkillObservation[] = [
    ...(observations ?? []),
    ...(profile.recentObservations ?? []).map((observation) => ({
      skill: observation.skill,
      subGoalId: observation.subGoalId,
      goalId: observation.goalId,
      observation: observation.observation,
      confidence: observation.confidence,
      difficultyLevel: observation.difficultyLevel,
      hintCount: observation.hintCount,
      selfExplained: observation.selfExplained,
      correctness: observation.correctness,
      evidenceType: observation.evidenceType,
    })),
  ];

  const goalContextSection = buildGoalContextPrompt({
    goalFocus: goals,
    recentObservations: skillObs,
    masteryStates: masteryProfile?.states,
    preferredSubGoalIds: masteryProfile?.recommendedSubGoalIds,
    maxSubGoalsPerGoal: 2,
  });

  const systemPrompt = [
    identityModule(),
    toolsDescriptionModule(),
    orchestrationRulesModule(),
    safetyRulesModule(),
    `## Runtime Guardrails
- scoringMode: ${options.scoringMode}
- assemblyState: ${options.assemblyState}
- redirectCount: ${options.redirectCount}
- emptyEvidenceStreak: ${options.emptyEvidenceStreak}
- circuitBreakerTriggered: ${options.circuitBreakerTriggered ? "true" : "false"}
- thinEvidenceType: ${options.thinEvidenceType ?? "none"}
- repairStrategy: ${options.repairStrategy ?? "none"}
- handoffTemplate: ${options.handoffTemplate ?? "none"}
- silentStreak: ${options.silentStreak ?? 0}
- injectedFewShotProfile: ${options.injectedFewShotProfile ?? "none"}
- If the child says something completely unrelated to the current task, acknowledge it briefly and gently guide back.
- Never treat unrelated chatter as formal mastery evidence.`,
  ].join("\n\n");

  const sessionContext = [
    childProfileModule(profile),
    goalContextSection,
    ageAdapterModule(profile.birthday),
  ].join("\n\n");

  const activityInstructionParts: string[] = [];
  if (currentActivity && options.scoringMode === "formal_scored") {
    activityInstructionParts.push(`## Current Activity\n${currentActivity}`);
  }
  if (trainingIntent) {
    activityInstructionParts.push(
      trainingIntentModule(trainingIntent, {
        scoringMode: options.scoringMode,
        assemblyState: options.assemblyState,
      }),
    );
  }
  if (options.assemblyState === "force_abandon") {
    activityInstructionParts.push(`## Force Abandon Rule
- End the current formal activity kindly.
- Do not keep asking for math evidence.
- Hand off into exploratory chat.`);
  }

  const injectedBlocks = [
    "SystemPrompt",
    "SessionContext",
    ...(currentActivity && options.scoringMode === "formal_scored" ? ["CurrentActivity"] : []),
    ...(trainingIntent ? ["ActivityInstruction"] : []),
  ];

  const prompt = [
    systemPrompt,
    `## Session Context\n${sessionContext}`,
    ...(activityInstructionParts.length > 0
      ? [`## Activity Instruction\n${activityInstructionParts.join("\n\n")}`]
      : []),
  ].join("\n\n");

  const debug: PromptBuildDebug = {
    scoringMode: options.scoringMode,
    assemblyState: options.assemblyState,
    redirectCount: options.redirectCount,
    emptyEvidenceStreak: options.emptyEvidenceStreak,
    circuitBreakerTriggered: options.circuitBreakerTriggered,
    thinEvidenceType: options.thinEvidenceType,
    repairStrategy: options.repairStrategy,
    handoffTemplate: options.handoffTemplate,
    silentStreak: options.silentStreak,
    injectedFewShotProfile: options.injectedFewShotProfile,
    injectedBlocks,
    estimatedTokens: estimateTokens(prompt),
  };

  if (process.env.NODE_ENV === "development") {
    console.debug("[system-prompt]", debug);
  }

  return { prompt, debug };
}

export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const nonChinese = text.replace(/[\u4e00-\u9fff]/g, " ");
  const words = nonChinese.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(chineseChars * 1.5 + words * 0.75);
}
