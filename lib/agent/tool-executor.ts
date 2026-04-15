import type { SystemEffect, ToolCall } from "../../types/agent";
import { appendActivitySessionEvent, getActivitySession } from "../data/db";

const SYSTEM_TOOL_NAMES = new Set([
  "think",
  "award_badge",
  "end_activity",
  "log_observation",
]);

export function isSystemTool(name: string): boolean {
  return SYSTEM_TOOL_NAMES.has(name);
}

function maybeAppendActivityEvent(
  call: ToolCall,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const args = (call.arguments ?? {}) as Record<string, unknown>;
  const activitySessionId = typeof args.activity_session_id === "string"
    ? args.activity_session_id
    : typeof args.activitySessionId === "string"
      ? args.activitySessionId
      : "";
  const sessionId = typeof args.session_id === "string"
    ? args.session_id
    : typeof args.sessionId === "string"
      ? args.sessionId
      : "";

  if (!activitySessionId || !sessionId) return;
  const row = getActivitySession(activitySessionId);
  const scoringMode = args.scoring_mode === "formal_scored"
    ? "formal_scored"
    : row?.scoring_mode === "formal_scored"
      ? "formal_scored"
      : "experimental_unscored";

  appendActivitySessionEvent({
    id: `${eventType}-${activitySessionId}-${Date.now()}`,
    activitySessionId,
    sessionId,
    turnIndex: Number.isFinite(Number(args.turn_index)) ? Number(args.turn_index) : undefined,
    eventType,
    source: "interaction_agent",
    scoringMode,
    payload,
  });
}

export function executeSystemTool(call: ToolCall): SystemEffect | null {
  switch (call.name) {
    case "think":
      if (process.env.NODE_ENV === "development") {
        console.debug("[think]", call.arguments?.reasoning);
      }
      return null;

    case "award_badge":
      return {
        type: "award_badge",
        data: call.arguments,
      };

    case "end_activity": {
      const args = (call.arguments ?? {}) as Record<string, unknown>;
      const eventType = args.abandoned === true ? "activity_abandoned" : "activity_completed";
      maybeAppendActivityEvent(call, eventType, args);
      return {
        type: "end_activity",
        data: call.arguments,
      };
    }

    case "log_observation": {
      const args = (call.arguments ?? {}) as Record<string, unknown>;
      maybeAppendActivityEvent(call, "candidate_observation", args);
      return {
        type: "log_observation",
        data: call.arguments,
      };
    }

    default:
      return null;
  }
}
