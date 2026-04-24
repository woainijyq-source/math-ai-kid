import type { NextRequest } from "next/server";
import type { AgentTurnRequest, ConversationMessage, ToolCall } from "@/types/agent";
import type { ChildProfile, GoalId } from "@/types/goals";
import { getActivity } from "@/content/activities/activity-templates";
import { buildMockAgentTurn } from "@/lib/ai/mock";
import { isDirectChatEnabled } from "@/lib/ai/qwen-chat";
import { runAgentTurn, type AgentLoopContext } from "@/lib/agent/agent-loop";
import { buildDailyQuestionMockTurn } from "@/lib/daily/mock";
import { buildDailyQuestionActivity, selectDailyQuestion } from "@/lib/daily/select-daily-question";
import { encodeSSE } from "@/lib/agent/stream-parser";
import { shouldUseFastPath, runFastPath } from "@/lib/agent/fast-path";
import { selectActivityForSubGoal } from "@/lib/agent/activity-selector";
import { getActivitySession, getLatestActivitySessionForSession, getRecentObservationSummaries } from "@/lib/data/db";
import { ensureCurrentActivitySession } from "@/lib/training/activity-session-manager";
import { getFormalScoredSubGoalForGoal, resolveScoringMode } from "@/lib/training/domain-pedagogy";
import { cleanupIdleActivitySessions, evaluatePendingActivitySessions, logInteractionEvent } from "@/lib/training/evaluator-agent";
import { buildMasteryProfile } from "@/lib/training/mastery-engine";
import { ensurePatternRecognitionChallengeSpec } from "@/lib/training/pattern-activity-runtime";
import { buildTrainingIntent } from "@/lib/training/training-intent";

function resolveGoalFocus(goalFocus: string[], profile?: ChildProfile): GoalId {
  const candidate = goalFocus[0] ?? profile?.goalPreferences?.[0] ?? "math-thinking";
  return candidate as GoalId;
}

export async function POST(req: NextRequest) {
  let body: AgentTurnRequest & {
    conversation?: ConversationMessage[];
    turnIndex?: number;
    lastTurnToolCalls?: ToolCall[];
    goalFocus?: string[];
    profile?: ChildProfile;
    recentActivityIds?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const {
    sessionId,
    input,
    inputType,
    inputMeta,
    conversation = [],
    turnIndex = 0,
    lastTurnToolCalls,
    goalFocus = [],
    themeId,
    questionId,
    profile: reqProfile,
    recentActivityIds = [],
  } = body;

  if (!sessionId || !input || !inputType) {
    return new Response(JSON.stringify({ error: "missing_required_fields" }), { status: 400 });
  }

  const providerMode = process.env.AI_PROVIDER_MODE ?? "qwen";
  const turnRequest: AgentTurnRequest = {
    sessionId,
    input,
    inputType,
    inputMeta,
    themeId,
    questionId,
  };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (providerMode === "mock") {
          for (const event of buildMockAgentTurn(turnRequest, turnIndex)) {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          }
          return;
        }

        const resolvedProfile: ChildProfile = reqProfile ?? {
          id: "anonymous",
          nickname: "Kid",
          birthday: "2018-01-01",
          goalPreferences: goalFocus,
        };
        cleanupIdleActivitySessions({ profileId: resolvedProfile.id });
        evaluatePendingActivitySessions({ profileId: resolvedProfile.id, sessionId });
        const requestedDailyQuestion = selectDailyQuestion({
          themeId,
          questionId,
          rotationSeed: `${resolvedProfile.id}:${new Date().toISOString().slice(0, 10)}`,
        });
        const focusGoalId = requestedDailyQuestion?.goalId ?? resolveGoalFocus(goalFocus, resolvedProfile);
        const recentObservations = getRecentObservationSummaries(resolvedProfile.id, {
          limit: 50,
          goalId: focusGoalId,
        });
        const hydratedProfile: ChildProfile = {
          ...resolvedProfile,
          recentObservations,
        };
        const masteryProfile = buildMasteryProfile(
          hydratedProfile.id,
          recentObservations,
          focusGoalId,
          hydratedProfile.birthday,
        );

        if (requestedDailyQuestion) {
          if (!isDirectChatEnabled()) {
            for (const event of buildDailyQuestionMockTurn(requestedDailyQuestion, turnRequest, turnIndex)) {
              controller.enqueue(encoder.encode(encodeSSE(event)));
            }
            return;
          }

          const trainingIntent = buildTrainingIntent({
            masteryProfile,
            subGoalId: requestedDailyQuestion.subGoalId,
            activityId: requestedDailyQuestion.id,
            birthday: hydratedProfile.birthday,
          });

          const context: AgentLoopContext = {
            profile: hydratedProfile,
            goalFocus: [focusGoalId],
            turnIndex,
            lastTurnToolCalls,
            currentActivity: buildDailyQuestionActivity(requestedDailyQuestion, {
              childInput: input,
              turnIndex,
            }),
            currentActivityId: requestedDailyQuestion.id,
            currentGoalId: requestedDailyQuestion.goalId,
            currentSubGoalId: requestedDailyQuestion.subGoalId,
            masteryProfile,
            trainingIntent,
            scoringMode: "experimental_unscored",
          };

          if (shouldUseFastPath(turnRequest, lastTurnToolCalls ?? [])) {
            const fastEvents = await runFastPath(turnRequest, conversation, context);
            for (const event of fastEvents) {
              controller.enqueue(encoder.encode(encodeSSE(event)));
            }
          } else {
            for await (const event of runAgentTurn(conversation, turnRequest, context)) {
              controller.enqueue(encoder.encode(encodeSSE(event)));
            }
          }
          return;
        }

        const latestSession = getLatestActivitySessionForSession(sessionId);
        const sessionDowngradedToExperimental = latestSession?.scoring_mode === "formal_scored" &&
          latestSession?.status === "abandoned";

        const chosenActivityFromInput = inputMeta?.choiceId ? getActivity(inputMeta.choiceId) : undefined;
        const selectedActivity = chosenActivityFromInput?.goalId === focusGoalId
          ? chosenActivityFromInput
          : selectActivityForSubGoal({
              profileId: hydratedProfile.id,
              birthday: hydratedProfile.birthday,
              goalFocus: [focusGoalId],
              recentActivityIds: recentActivityIds.length > 0
                ? recentActivityIds
                : recentObservations
                    .map((observation) => observation.activityId)
                    .filter((value): value is string => Boolean(value)),
              preferredSubGoalIds: masteryProfile.recommendedSubGoalIds,
              requiredSubGoalId: sessionDowngradedToExperimental
                ? masteryProfile.primarySubGoalId
                : getFormalScoredSubGoalForGoal(focusGoalId) ?? masteryProfile.primarySubGoalId,
              requiredGoalId: focusGoalId,
            });

        if (!selectedActivity) {
          throw new Error(`No activity available for goal ${focusGoalId}`);
        }

        const scoringMode = sessionDowngradedToExperimental
          ? "experimental_unscored"
          : resolveScoringMode(selectedActivity.goalId, selectedActivity.subGoalId);
        const activitySessionId = ensureCurrentActivitySession({
          sessionId,
          profileId: hydratedProfile.id,
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

        logInteractionEvent({
          activitySessionId,
          sessionId,
          turnIndex,
          scoringMode,
          eventType: "child_turn_submitted",
          payload: {
            input,
            inputType,
            inputMeta,
            goalId: selectedActivity.goalId,
            subGoalId: selectedActivity.subGoalId,
            activityId: selectedActivity.id,
            expectedEvidence: selectedActivity.requiredEvidenceSlots,
          },
        });

        const trainingIntent = buildTrainingIntent({
          masteryProfile,
          subGoalId: selectedActivity.subGoalId,
          activityId: selectedActivity.id,
          birthday: hydratedProfile.birthday,
          repairContext: (() => {
            const activitySession = getActivitySession(activitySessionId);
            return activitySession
              ? {
                  thinEvidenceType: activitySession.thin_evidence_type ?? undefined,
                  silentStreak: activitySession.silent_streak ?? undefined,
                }
              : undefined;
          })(),
        });

        const context: AgentLoopContext = {
          profile: hydratedProfile,
          goalFocus: [focusGoalId],
          turnIndex,
          lastTurnToolCalls,
          currentActivity: selectedActivity.systemPromptFragment,
          currentActivityId: selectedActivity.id,
          activitySessionId,
          currentGoalId: selectedActivity.goalId,
          currentSubGoalId: selectedActivity.subGoalId,
          masteryProfile,
          trainingIntent,
          scoringMode,
        };

        if (shouldUseFastPath(turnRequest, lastTurnToolCalls ?? [])) {
          const fastEvents = await runFastPath(turnRequest, conversation, context);
          for (const event of fastEvents) {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          }
        } else {
          for await (const event of runAgentTurn(conversation, turnRequest, context)) {
            controller.enqueue(encoder.encode(encodeSSE(event)));
          }
        }

        evaluatePendingActivitySessions({ sessionId, limit: 6 });
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
    },
  });
}
