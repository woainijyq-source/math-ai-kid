import { NextRequest, NextResponse } from "next/server";
import { buildRewardSummaryFromLogs } from "@/lib/data/session-log";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId_required" }, { status: 400 });
  }

  try {
    const summary = buildRewardSummaryFromLogs(profileId);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[rewards/summary]", error);
    return NextResponse.json({ summary: null });
  }
}
