import { NextResponse } from "next/server";
import { runChat } from "@/lib/ai/chat";
import type { ChatRequestPayload } from "@/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as ChatRequestPayload;
  const result = await runChat(payload);

  console.info("[ai.chat]", {
    mode: payload.mode,
    taskId: payload.taskId,
    action: payload.action ?? "message",
    source: result.source,
    status: result.response.sessionPatch.progress === 100 ? "completed" : "active",
    qwenDebug:
      result.debug
        ? {
            reason: result.debug.reason ?? null,
            model: result.debug.model ?? null,
            runtime: result.debug.runtime ?? null,
            responseSummary: result.debug.responseSummary ?? null,
          }
        : undefined,
  });

  return NextResponse.json(result.response);
}
