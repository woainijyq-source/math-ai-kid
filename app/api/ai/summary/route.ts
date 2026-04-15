import { NextResponse } from "next/server";
import { buildParentSummaryFromLogs, hasSessionLogs } from "@/lib/data/session-log";
import { runSummary } from "@/lib/ai/summary";

export async function POST() {
  const remoteSummary = await runSummary();
  const response = hasSessionLogs() ? buildParentSummaryFromLogs() : remoteSummary;

  console.info("[ai.summary]", { status: "ready" });

  return NextResponse.json(response);
}
