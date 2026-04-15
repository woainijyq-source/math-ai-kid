import type {
  AIMessage,
  ChatResponsePayload,
  RewardSignal,
  SttResponsePayload,
  SummaryResponsePayload,
  TtsResponsePayload,
} from "@/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRewardSignal(value: unknown): value is RewardSignal {
  return (
    isObject(value) &&
    (value.type === "instant" || value.type === "identity" || value.type === "world") &&
    typeof value.title === "string" &&
    typeof value.detail === "string"
  );
}

function isAIMessage(value: unknown): value is AIMessage {
  return (
    isObject(value) &&
    (value.role === "assistant" || value.role === "user" || value.role === "system") &&
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    typeof value.intent === "string" &&
    isStringArray(value.hints) &&
    (value.nextAction === undefined || typeof value.nextAction === "string") &&
    (value.speakerName === undefined || typeof value.speakerName === "string") &&
    (value.voiceRole === undefined ||
      value.voiceRole === "guide" ||
      value.voiceRole === "opponent" ||
      value.voiceRole === "maker" ||
      value.voiceRole === "storyteller" ||
      value.voiceRole === "parent") &&
    (value.speakableText === undefined || typeof value.speakableText === "string") &&
    (value.autoSpeak === undefined || typeof value.autoSpeak === "boolean")
  );
}

export function isChatResponsePayload(value: unknown): value is ChatResponsePayload {
  return (
    isObject(value) &&
    Array.isArray(value.messages) &&
    value.messages.every(isAIMessage) &&
    isObject(value.sessionPatch) &&
    isObject(value.worldPatch) &&
    Array.isArray(value.rewardSignals) &&
    value.rewardSignals.every(isRewardSignal)
  );
}

export function isSttResponsePayload(value: unknown): value is SttResponsePayload {
  return (
    isObject(value) &&
    typeof value.transcript === "string" &&
    typeof value.confidence === "number" &&
    typeof value.fallbackUsed === "boolean"
  );
}

export function isSummaryResponsePayload(value: unknown): value is SummaryResponsePayload {
  return (
    isObject(value) &&
    typeof value.dailySummary === "string" &&
    isStringArray(value.strengthSignals) &&
    isStringArray(value.stuckSignals) &&
    typeof value.nextSuggestion === "string" &&
    isStringArray(value.recentHighlights)
  );
}

export function isTtsResponsePayload(value: unknown): value is TtsResponsePayload {
  return (
    isObject(value) &&
    typeof value.text === "string" &&
    typeof value.voiceRole === "string" &&
    typeof value.fallbackUsed === "boolean" &&
    (value.speakerName === undefined || typeof value.speakerName === "string") &&
    (value.audioBase64 === undefined || typeof value.audioBase64 === "string") &&
    (value.mimeType === undefined || typeof value.mimeType === "string")
  );
}

export function isVisionResponsePayload(
  value: unknown,
): value is { description: string; fallbackUsed?: boolean } {
  return (
    isObject(value) &&
    typeof value.description === "string" &&
    (value.fallbackUsed === undefined || typeof value.fallbackUsed === "boolean")
  );
}
