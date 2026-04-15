import { NextResponse } from "next/server";
import { runStt } from "@/lib/ai/stt";

export async function POST(request: Request) {
  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "opponent");
  const response = await runStt(mode, formData);

  console.info("[ai.stt]", {
    mode,
    fallbackUsed: response.fallbackUsed,
    confidence: response.confidence,
  });

  return NextResponse.json(response);
}
