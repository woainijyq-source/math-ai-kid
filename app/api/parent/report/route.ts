import { NextRequest, NextResponse } from "next/server";
import {
  getRecentActivitySessionsForProfile,
  getRecentObservationSummaries,
  getRecentObservations,
  getSkillSummary,
  toActivitySessionSummary,
} from "@/lib/data/db";
import { buildParentDailyBrief } from "@/lib/data/session-log";
import { cleanupIdleActivitySessions, evaluatePendingActivitySessions } from "@/lib/training/evaluator-agent";
import { buildParentTrainingReport } from "@/lib/training/parent-report";

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId_required" }, { status: 400 });
  }

  try {
    cleanupIdleActivitySessions({ profileId, limit: 40 });
    evaluatePendingActivitySessions({ profileId, limit: 20 });
    const [skills, recentRows, recentSummaries, formalActivitySessions, experimentalActivitySessions] = await Promise.all([
      Promise.resolve(getSkillSummary(profileId, 8, "formal_scored")),
      Promise.resolve(getRecentObservations(profileId, { limit: 24, scoringMode: "formal_scored" })),
      Promise.resolve(getRecentObservationSummaries(profileId, { limit: 40, scoringMode: "formal_scored" })),
      Promise.resolve(getRecentActivitySessionsForProfile(profileId, 12, "formal_scored")),
      Promise.resolve(getRecentActivitySessionsForProfile(profileId, 12, "experimental_unscored")),
    ]);
    const report = buildParentTrainingReport(
      profileId,
      recentSummaries,
      experimentalActivitySessions.map(toActivitySessionSummary),
    );
    const dailyBrief = buildParentDailyBrief(profileId);

    return NextResponse.json({
      dailyBrief,
      skills,
      recent: recentRows,
      report,
      activitySessions: formalActivitySessions.map(toActivitySessionSummary),
      experimentalActivitySessions: experimentalActivitySessions.map(toActivitySessionSummary),
    });
  } catch (error) {
    console.error("[parent/report]", error);
    return NextResponse.json({
      skills: [],
      recent: [],
      dailyBrief: null,
      report: { items: [], experimentalItems: [] },
      activitySessions: [],
      experimentalActivitySessions: [],
    });
  }
}
