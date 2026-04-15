import { NextResponse } from "next/server";
import { runTts } from "@/lib/ai/tts";
import type { TtsRequestPayload } from "@/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as TtsRequestPayload;
  const result = await runTts(payload);

  console.info("[ai.tts]", {
    voiceRole: payload.voiceRole,
    source: result.source,
    hasAudio: Boolean(result.response.audioBase64),
    fallbackUsed: result.response.fallbackUsed,
  });

  return NextResponse.json(result.response);
}
