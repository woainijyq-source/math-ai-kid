import { NextResponse } from "next/server";
import { runVision } from "@/lib/ai/vision";

export async function POST(request: Request) {
  const formData = await request.formData();
  const response = await runVision(formData);

  console.info("[ai.vision]", { status: response.fallbackUsed ? "mock" : "real" });

  return NextResponse.json(response);
}
