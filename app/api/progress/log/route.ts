import { NextResponse } from "next/server";
import { insertSessionLog } from "@/lib/data/session-log";
import type { CompletedSessionPayload } from "@/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as CompletedSessionPayload;
  insertSessionLog(payload);

  console.info("[progress.log]", {
    mode: payload.mode,
    taskId: payload.taskId,
    title: payload.title,
  });

  return NextResponse.json({ ok: true as const });
}
