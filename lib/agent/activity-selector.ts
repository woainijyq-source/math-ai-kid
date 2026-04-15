import { ALL_ACTIVITIES } from "@/content/activities/activity-templates";
import { calcAge } from "@/prompts/modules/age-adapter";
import type { ActivityTemplate } from "@/types/goals";

export interface ActivitySelectorInput {
  profileId: string;
  birthday: string;
  goalFocus: string[];
  recentActivityIds?: string[];
  preferredSubGoalIds?: string[];
  requiredSubGoalId?: string;
  requiredGoalId?: string;
}

function scoreActivity(
  activity: ActivityTemplate,
  input: ActivitySelectorInput,
  age: number,
): number {
  let score = 0;
  const focusGoals = input.goalFocus.length > 0 ? input.goalFocus : [input.requiredGoalId ?? activity.goalId];

  if (focusGoals.includes(activity.goalId)) score += 12;
  else score -= 40;

  if (input.requiredGoalId && input.requiredGoalId === activity.goalId) {
    score += 16;
  }

  if (input.requiredSubGoalId === activity.subGoalId) {
    score += 22;
  } else if (input.requiredSubGoalId) {
    score -= 8;
  }

  const preferredIndex = input.preferredSubGoalIds?.indexOf(activity.subGoalId) ?? -1;
  if (preferredIndex >= 0) score += Math.max(5, 10 - preferredIndex * 2);

  const mid = (activity.ageRange[0] + activity.ageRange[1]) / 2;
  score += Math.max(0, 3 - Math.abs(age - mid));

  const recentIdx = (input.recentActivityIds ?? []).indexOf(activity.id);
  if (recentIdx === 0) score -= 8;
  else if (recentIdx === 1) score -= 4;
  else if (recentIdx >= 2) score -= 1;

  if (activity.coreOrTransfer === "core") score += 2;

  return score;
}

function getGoalScopedCandidates(input: ActivitySelectorInput, age: number) {
  const allowedGoals = input.goalFocus.length > 0
    ? new Set(input.goalFocus)
    : new Set(input.requiredGoalId ? [input.requiredGoalId] : ALL_ACTIVITIES.map((activity) => activity.goalId));

  return ALL_ACTIVITIES.filter(
    (activity) =>
      age >= activity.ageRange[0] &&
      age <= activity.ageRange[1] &&
      allowedGoals.has(activity.goalId),
  );
}

export function selectActivity(input: ActivitySelectorInput): ActivityTemplate | null {
  const age = calcAge(input.birthday);
  const candidates = getGoalScopedCandidates(input, age);
  if (candidates.length === 0) return null;

  const scored = candidates.map((activity) => ({
    activity,
    score: scoreActivity(activity, input, age),
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.activity ?? null;
}

export function selectActivityForSubGoal(input: ActivitySelectorInput): ActivityTemplate | null {
  if (!input.requiredSubGoalId) {
    return selectActivity(input);
  }

  const age = calcAge(input.birthday);
  const candidates = getGoalScopedCandidates(input, age).filter(
    (activity) => activity.subGoalId === input.requiredSubGoalId,
  );

  if (candidates.length === 0) {
    return selectActivity(input);
  }

  const scored = candidates.map((activity) => ({
    activity,
    score: scoreActivity(activity, input, age),
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.activity ?? null;
}

export function selectTopActivities(
  input: ActivitySelectorInput,
  topN = 3,
): ActivityTemplate[] {
  const age = calcAge(input.birthday);
  const candidates = getGoalScopedCandidates(input, age);
  const scored = candidates.map((activity) => ({
    activity,
    score: scoreActivity(activity, input, age),
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, topN).map((item) => item.activity);
}
