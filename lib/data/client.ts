"use client";

import type { CompletedSessionPayload, SummaryResponsePayload } from "@/types";

export async function logCompletedSession(payload: CompletedSessionPayload) {
  const response = await fetch("/api/progress/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("progress log failed");
  }

  return (await response.json()) as { ok: true };
}

export async function fetchPersistedSummary() {
  const response = await fetch("/api/ai/summary", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("summary request failed");
  }

  return (await response.json()) as SummaryResponsePayload;
}
