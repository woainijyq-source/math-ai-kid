import { getLatestActivitySessionForSession, upsertActivitySession } from "@/lib/data/db";
import type { ActivityTemplate, DifficultyLevelName, ScoringMode } from "@/types/goals";

export function ensureCurrentActivitySession(input: {
  sessionId: string;
  profileId: string;
  activity: ActivityTemplate;
  scoringMode: ScoringMode;
  recommendedDifficulty?: DifficultyLevelName;
}) {
  const latest = getLatestActivitySessionForSession(input.sessionId);
  const canReuse = latest &&
    latest.activity_id === input.activity.id &&
    latest.goal_id === input.activity.goalId &&
    latest.sub_goal_id === input.activity.subGoalId &&
    latest.scoring_mode === input.scoringMode &&
    (latest.status === "in_progress" || latest.status === "passed_evidence_thin");

  const id = canReuse
    ? latest.id
    : `${input.sessionId}-${input.activity.id}-${Date.now().toString(36)}`;

  upsertActivitySession({
    id,
    sessionId: input.sessionId,
    profileId: input.profileId,
    goalId: input.activity.goalId,
    subGoalId: input.activity.subGoalId,
    activityId: input.activity.id,
    scoringMode: input.scoringMode,
    requiredEvidenceSlots: input.activity.requiredEvidenceSlots ?? ["answer", "self_explanation", "activity_summary"],
    latestDifficultyLevel: input.recommendedDifficulty,
  });

  return id;
}
