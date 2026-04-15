import { GOAL_MAP } from "@/content/goals/goal-tree";
import { getSubGoalPlaybook } from "@/lib/training/domain-pedagogy";
import { calcAge } from "@/prompts/modules/age-adapter";
import type {
  DifficultyLevelName,
  GoalId,
  ObservationSummary,
} from "@/types/goals";

export type MasteryStage =
  | "emerging"
  | "practicing"
  | "stable"
  | "ready_to_transfer";

export type MasteryNextAction =
  | "diagnose"
  | "repeat"
  | "advance"
  | "fallback"
  | "transfer"
  | "repair_evidence";

export interface MasteryState {
  profileId: string;
  goalId: GoalId;
  subGoalId: string;
  stage: MasteryStage;
  recommendedDifficulty: DifficultyLevelName;
  recentEvidenceSummary: string;
  nextAction: MasteryNextAction;
  reason: string;
  recentObservationCount: number;
  recentCorrectStreak: number;
  avgHintCount: number;
  selfExplainRate: number;
  evidenceThinCount: number;
  suggestedActivityIds: string[];
}

export interface MasteryProfile {
  profileId: string;
  goalId: GoalId;
  states: Record<string, MasteryState>;
  recommendedSubGoalIds: string[];
  primarySubGoalId: string;
  generatedAt: string;
}

function difficultyToIndex(level: DifficultyLevelName | undefined): number {
  switch (level) {
    case "L2":
      return 1;
    case "L3":
      return 2;
    case "L4":
      return 3;
    default:
      return 0;
  }
}

function indexToDifficulty(index: number): DifficultyLevelName {
  if (index >= 3) return "L4";
  if (index === 2) return "L3";
  if (index === 1) return "L2";
  return "L1";
}

function increaseDifficulty(level: DifficultyLevelName | undefined): DifficultyLevelName {
  return indexToDifficulty(difficultyToIndex(level) + 1);
}

function decreaseDifficulty(level: DifficultyLevelName | undefined): DifficultyLevelName {
  return indexToDifficulty(difficultyToIndex(level) - 1);
}

function maxDifficulty(
  left: DifficultyLevelName | undefined,
  right: DifficultyLevelName | undefined,
): DifficultyLevelName {
  return difficultyToIndex(left) >= difficultyToIndex(right) ? left ?? "L1" : right ?? "L1";
}

function ageDifficultyFloor(goalId: GoalId, age?: number): DifficultyLevelName {
  if (goalId !== "math-thinking" || age === undefined) {
    return "L1";
  }

  if (age >= 11) return "L4";
  if (age >= 9) return "L3";
  if (age >= 7) return "L2";
  return "L1";
}

function countLeading<T>(items: T[], predicate: (item: T) => boolean): number {
  let count = 0;
  for (const item of items) {
    if (!predicate(item)) break;
    count += 1;
  }
  return count;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildEvidenceSummary(
  observations: ObservationSummary[],
  metrics: {
    correctStreak: number;
    avgHintCount: number;
    selfExplainRate: number;
    evidenceThinCount: number;
  },
): string {
  if (observations.length === 0) {
    return "No stable evidence yet. Start with a diagnostic activity.";
  }

  const latest = observations[0];
  const parts = [
    `Recent evidence count ${observations.length}.`,
    `Correct streak ${metrics.correctStreak}.`,
    `Average hints ${metrics.avgHintCount.toFixed(1)}.`,
    `Reasoning evidence rate ${Math.round(metrics.selfExplainRate * 100)}%.`,
  ];

  if (metrics.evidenceThinCount > 0) {
    parts.push(`Evidence-thin sessions ${metrics.evidenceThinCount}.`);
  }

  parts.push(`Latest signal: ${latest.observation}`);
  return parts.join(" ");
}

function deriveMasteryState(
  profileId: string,
  goalId: GoalId,
  subGoalId: string,
  observations: ObservationSummary[],
  age?: number,
): MasteryState {
  const playbook = getSubGoalPlaybook(subGoalId);
  const difficultyFloor = ageDifficultyFloor(goalId, age);
  const isReasoningEquivalent = (observation: ObservationSummary) =>
    observation.evidenceType === "self_explanation" ||
    observation.evidenceType === "rule_statement" ||
    observation.evidenceType === "contrastive_rebuttal" ||
    observation.selfExplained;
  const latest = observations[0];
  const recentCorrectStreak = countLeading(
    observations,
    (observation) =>
      observation.evidenceType === "activity_summary" &&
      (observation.correctness === "correct" || observation.activityStatus === "passed_complete"),
  );
  const recentIncorrectStreak = countLeading(
    observations,
    (observation) =>
      observation.evidenceType === "activity_summary" &&
      (observation.correctness === "incorrect" || observation.activityStatus === "not_yet_mastered"),
  );
  const avgHintCount = average(observations.map((observation) => observation.hintCount ?? 0));
  const selfExplainRate = average(
    observations
      .filter((observation) => observation.evidenceType !== "activity_summary")
      .map((observation) => (isReasoningEquivalent(observation) ? 1 : 0)),
  );
  const evidenceThinCount = observations.filter(
    (observation) => observation.activityStatus === "passed_evidence_thin",
  ).length;
  const latestDifficulty = maxDifficulty(latest?.difficultyLevel ?? "L1", difficultyFloor);
  const metrics = {
    correctStreak: recentCorrectStreak,
    avgHintCount,
    selfExplainRate,
    evidenceThinCount,
  };

  if (observations.length === 0) {
    return {
      profileId,
      goalId,
      subGoalId,
      stage: "emerging",
      recommendedDifficulty: difficultyFloor,
      recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
      nextAction: "diagnose",
      reason: "No recent evidence for this sub-goal. Start with a diagnostic activity.",
      recentObservationCount: 0,
      recentCorrectStreak,
      avgHintCount,
      selfExplainRate,
      evidenceThinCount,
      suggestedActivityIds: playbook.activityIds,
    };
  }

  if (evidenceThinCount >= 1) {
    return {
      profileId,
      goalId,
      subGoalId,
      stage: "practicing",
      recommendedDifficulty: maxDifficulty(latestDifficulty, difficultyFloor),
      recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
      nextAction: "repair_evidence",
      reason: "The child can often reach the answer, but rule-telling or answer-defense evidence is still too thin to promote mastery.",
      recentObservationCount: observations.length,
      recentCorrectStreak,
      avgHintCount,
      selfExplainRate,
      evidenceThinCount,
      suggestedActivityIds: playbook.activityIds,
    };
  }

  if (recentCorrectStreak >= 3 && selfExplainRate >= 0.65 && avgHintCount <= 1) {
    return {
      profileId,
      goalId,
      subGoalId,
      stage: "ready_to_transfer",
      recommendedDifficulty: maxDifficulty(latestDifficulty, difficultyFloor),
      recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
      nextAction: "transfer",
      reason: "The child is consistently correct and can express or defend the pattern rule with little support.",
      recentObservationCount: observations.length,
      recentCorrectStreak,
      avgHintCount,
      selfExplainRate,
      evidenceThinCount,
      suggestedActivityIds: playbook.activityIds,
    };
  }

  if (recentCorrectStreak >= 2 && selfExplainRate >= 0.45 && avgHintCount <= 1) {
    return {
      profileId,
      goalId,
      subGoalId,
      stage: "stable",
      recommendedDifficulty: maxDifficulty(increaseDifficulty(latestDifficulty), difficultyFloor),
      recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
      nextAction: difficultyToIndex(latestDifficulty) >= 3 ? "transfer" : "advance",
      reason: difficultyToIndex(latestDifficulty) >= 3
        ? "Performance is stable at the current difficulty. Shift into transfer instead of just raising difficulty."
        : "Recent complete evidence is stable enough to try the next difficulty.",
      recentObservationCount: observations.length,
      recentCorrectStreak,
      avgHintCount,
      selfExplainRate,
      evidenceThinCount,
      suggestedActivityIds: playbook.activityIds,
    };
  }

  if (recentIncorrectStreak >= 2 || (latest?.correctness === "incorrect" && avgHintCount >= 2)) {
    return {
      profileId,
      goalId,
      subGoalId,
      stage: "emerging",
      recommendedDifficulty: maxDifficulty(decreaseDifficulty(latestDifficulty), difficultyFloor),
      recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
      nextAction: "fallback",
      reason: "Recent sessions show repeated errors or heavy support, so the child should return to a safer difficulty band.",
      recentObservationCount: observations.length,
      recentCorrectStreak,
      avgHintCount,
      selfExplainRate,
      evidenceThinCount,
      suggestedActivityIds: playbook.activityIds,
    };
  }

  return {
    profileId,
    goalId,
    subGoalId,
    stage: observations.length >= 2 ? "practicing" : "emerging",
    recommendedDifficulty: maxDifficulty(latestDifficulty, difficultyFloor),
    recentEvidenceSummary: buildEvidenceSummary(observations, metrics),
    nextAction: "repeat",
    reason: "Evidence is not yet stable enough. Keep the child on same-level variations and collect fuller evidence.",
    recentObservationCount: observations.length,
    recentCorrectStreak,
    avgHintCount,
    selfExplainRate,
    evidenceThinCount,
    suggestedActivityIds: playbook.activityIds,
  };
}

function actionPriority(action: MasteryNextAction): number {
  switch (action) {
    case "repair_evidence":
      return 110;
    case "fallback":
      return 100;
    case "repeat":
      return 90;
    case "diagnose":
      return 85;
    case "advance":
      return 80;
    case "transfer":
      return 70;
    default:
      return 0;
  }
}

export function buildMasteryProfile(
  profileId: string,
  observations: ObservationSummary[],
  goalId: GoalId = "math-thinking",
  birthday?: string,
): MasteryProfile {
  const goal = GOAL_MAP.get(goalId) ?? GOAL_MAP.get("math-thinking")!;
  const age = birthday ? calcAge(birthday) : undefined;
  const goalObservations = observations
    .filter((observation) => observation.goalId === goal.id)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  const latestSubGoalId = goalObservations[0]?.subGoalId;
  const states = Object.fromEntries(
    goal.subGoals.map((subGoal) => {
      const subGoalObservations = goalObservations
        .filter((observation) => observation.subGoalId === subGoal.id)
        .slice(0, 6);
      return [subGoal.id, deriveMasteryState(profileId, goal.id, subGoal.id, subGoalObservations, age)];
    }),
  ) as Record<string, MasteryState>;

  const recommendedSubGoalIds = goal.subGoals
    .map((subGoal) => subGoal.id)
    .sort((left, right) => {
      const leftState = states[left];
      const rightState = states[right];
      const leftScore = actionPriority(leftState.nextAction) +
        (latestSubGoalId === left ? 10 : 0) +
        Math.min(leftState.recentObservationCount, 6);
      const rightScore = actionPriority(rightState.nextAction) +
        (latestSubGoalId === right ? 10 : 0) +
        Math.min(rightState.recentObservationCount, 6);
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return goal.subGoals.findIndex((subGoal) => subGoal.id === left) -
        goal.subGoals.findIndex((subGoal) => subGoal.id === right);
    });

  return {
    profileId,
    goalId: goal.id,
    states,
    recommendedSubGoalIds,
    primarySubGoalId: recommendedSubGoalIds[0] ?? goal.subGoals[0]?.id ?? "pattern-recognition",
    generatedAt: new Date().toISOString(),
  };
}
