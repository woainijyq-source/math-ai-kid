import { NextRequest, NextResponse } from "next/server";
import { buildContinuitySnapshot } from "@/lib/data/session-log";
import type { DailyThemeId } from "@/types/daily";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  const themeId = req.nextUrl.searchParams.get("theme") as DailyThemeId | null;

  if (!profileId) {
    return NextResponse.json({ error: "profileId_required" }, { status: 400 });
  }

  try {
    const snapshot = buildContinuitySnapshot(profileId, themeId ?? undefined);
    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("[continuity/latest]", error);
    return NextResponse.json({ snapshot: null });
  }
}
