import type { NextRequest } from "next/server";
import type { AgentStartRequest } from "@/types/agent";
import type { ChildProfile, GoalId } from "@/types/goals";
import { buildMockAgentStart } from "@/lib/ai/mock";
import { runAgentTurn, type AgentLoopContext } from "@/lib/agent/agent-loop";
import { encodeSSE } from "@/lib/agent/stream-parser";
import { selectActivityForSubGoal } from "@/lib/agent/activity-selector";
import { getRecentObservationSummaries } from "@/lib/data/db";
import { ensureCurrentActivitySession } from "@/lib/training/activity-session-manager";
import { getFormalScoredSubGoalForGoal, resolveScoringMode } from "@/lib/training/domain-pedagogy";
import { cleanupIdleActivitySessions, evaluatePendingActivitySessions } from "@/lib/training/evaluator-agent";
import { buildMasteryProfile } from "@/lib/training/mastery-engine";
import { ensurePatternRecognitionChallengeSpec } from "@/lib/training/pattern-activity-runtime";
import { buildTrainingIntent } from "@/lib/training/training-intent";

function resolveGoalFocus(goalFocus: string[], profile?: ChildProfile): GoalId {
  const candidate = goalFocus[0] ?? profile?.goalPreferences?.[0] ?? "math-thinking";
  return candidate as GoalId;
}

export async function POST(req: NextRequest) {
  let body: AgentStartRequest;
  try {
    body = (await req.json()) as AgentStartRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { profileId, goalFocus = [], profile: bodyProfile, recentActivityIds = [] } = body;
  if (!profileId) {
    return new Response(JSON.stringify({ error: "profileId_required" }), { status: 400 });
  }

  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const providerMode = process.env.AI_PROVIDER_MODE ?? "qwen";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {

        if (providerMode === "mock") {
          controller.enqueue(encoder.encode(encodeSSE({
            type: "session_start" as const,
            sessionId,
            profileId,
            timestamp: Date.now(),
          })));
          for (const event of buildMockAgentStart()) {
            if (event.type !== "session_start") {
              controller.enqueue(encoder.encode(encodeSSE(event)));
            }
          }
          return;
        }

        const profile: ChildProfile = bodyProfile ?? {
          id: profileId,
          nickname: "Kid",
          birthday: "2018-01-01",
          goalPreferences: goalFocus,
        };
        const focusGoalId = resolveGoalFocus(goalFocus, profile);
        cleanupIdleActivitySessions({ profileId });
        evaluatePendingActivitySessions({ profileId });
        const recentObservations = getRecentObservationSummaries(profileId, {
          limit: 40,
          scoringMode: "formal_scored",
        });
        const hydratedProfile: ChildProfile = {
          ...profile,
          recentObservations,
        };
        const masteryProfile = buildMasteryProfile(profileId, recentObservations, focusGoalId, hydratedProfile.birthday);
        const resolvedRecentActivityIds = recentActivityIds.length > 0
          ? recentActivityIds
          : recentObservations
              .map((observation) => observation.activityId)
              .filter((value): value is string => Boolean(value));
        const selectedActivity = selectActivityForSubGoal({
          profileId,
          birthday: hydratedProfile.birthday,
          goalFocus: [focusGoalId],
          recentActivityIds: resolvedRecentActivityIds,
          preferredSubGoalIds: masteryProfile.recommendedSubGoalIds,
          requiredSubGoalId: getFormalScoredSubGoalForGoal(focusGoalId) ?? masteryProfile.primarySubGoalId,
          requiredGoalId: focusGoalId,
        });

        if (!selectedActivity) {
          throw new Error(`No activity available for goal ${focusGoalId}`);
        }

        controller.enqueue(encoder.encode(encodeSSE({
          type: "session_start" as const,
          sessionId,
          profileId,
          activityId: selectedActivity.id,
          timestamp: Date.now(),
        })));

        const scoringMode = resolveScoringMode(selectedActivity.goalId, selectedActivity.subGoalId);
        const activitySessionId = ensureCurrentActivitySession({
          sessionId,
          profileId,
          activity: selectedActivity,
          scoringMode,
          recommendedDifficulty: masteryProfile.states[selectedActivity.subGoalId]?.recommendedDifficulty,
        });
        if (scoringMode === "formal_scored" && selectedActivity.subGoalId === "pattern-recognition") {
          await ensurePatternRecognitionChallengeSpec({
            activitySessionId,
            birthday: hydratedProfile.birthday,
            difficultyLevel: masteryProfile.states[selectedActivity.subGoalId]?.recommendedDifficulty,
          });
        }
        const trainingIntent = buildTrainingIntent({
          masteryProfile,
          subGoalId: selectedActivity.subGoalId,
          activityId: selectedActivity.id,
          birthday: hydratedProfile.birthday,
        });

        const context: AgentLoopContext = {
          profile: hydratedProfile,
          goalFocus: [focusGoalId],
          turnIndex: 0,
          currentActivity: selectedActivity.systemPromptFragment,
          currentActivityId: selectedActivity.id,
          activitySessionId,
          currentGoalId: selectedActivity.goalId,
          currentSubGoalId: selectedActivity.subGoalId,
          masteryProfile,
          trainingIntent,
          scoringMode,
        };

        const firstInput = {
          sessionId,
          input: "你好，开始吧",
          inputType: "text" as const,
        };
        const initialConversation = [
          { role: "user" as const, content: firstInput.input },
        ];

        for await (const event of runAgentTurn(initialConversation, firstInput, context)) {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(encodeSSE({
          type: "error" as const,
          code: "internal_error",
          message: error instanceof Error ? error.message : "unknown",
          recoverable: false,
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Session-Id": sessionId,
    },
  });
}
