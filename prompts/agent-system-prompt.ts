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
import { buildBrainyVoiceGuideText } from "@/content/daily/brainy-voice-guide";
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
    buildBrainyVoiceGuideText(),
    toolsDescriptionModule(),
    orchestrationRulesModule(),
    safetyRulesModule(),
    buildBrainyVoiceGuideText(),
    `## MLIF Framework
- This product follows the Micro-Leap Inquiry Framework (MLIF).
- You are not a worksheet engine and not a lecture-style teacher.
- You are an inquiry companion for a young child.
- Connect first: respond to one short part of what the child just said before moving on.
- Stay concrete first: prefer everyday scenes, visible changes, and child-sized choices.
- Push only half a step: add one small twist, one compare, or one why-question at a time.
- Questions come before explanations: do not rush to teach or reveal the solution.
- Keep scaffolds light: if the child is stuck, offer two directions instead of a full answer.
- Close softly: end with a warm summary and a light transfer thought, not a lecture or a test result.`,
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
- Never treat unrelated chatter as formal mastery evidence.
- In child-facing dialogue, prefer mirroring one short child phrase or idea before your next question; do not mechanically repeat the whole answer.
- Avoid worksheet tone such as "题目是..." "请回答..." "正确答案是...".
- Avoid lecture tone such as long explanations, explicit teaching summaries, or multi-step instruction dumps.
- Prefer child-facing spoken language over formal educational wording.`,
  ].join("\n\n");

  const sessionContext = [
    childProfileModule(profile),
    goalContextSection,
    ageAdapterModule(profile.birthday),
  ].join("\n\n");

  const activityInstructionParts: string[] = [];
  if (currentActivity) {
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
    ...(currentActivity ? ["CurrentActivity"] : []),
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
