import { NextRequest, NextResponse } from "next/server";
import {
  getRecentActivitySessionsForProfile,
  getRecentThinkingEvidence,
  getRecentObservationSummaries,
  getRecentObservations,
  getSkillSummary,
  toActivitySessionSummary,
} from "@/lib/data/db";
import { buildParentDailyBrief, listRecentSessionLogs } from "@/lib/data/session-log";
import { buildParentProjectPlans } from "@/lib/daily/thinking-growth-progress";
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
    const [skills, recentRows, recentSummaries, formalActivitySessions, experimentalActivitySessions, recentLogs, recentThinkingEvidence] = await Promise.all([
      Promise.resolve(getSkillSummary(profileId, 8, "formal_scored")),
      Promise.resolve(getRecentObservations(profileId, { limit: 24, scoringMode: "formal_scored" })),
      Promise.resolve(getRecentObservationSummaries(profileId, { limit: 40, scoringMode: "formal_scored" })),
      Promise.resolve(getRecentActivitySessionsForProfile(profileId, 12, "formal_scored")),
      Promise.resolve(getRecentActivitySessionsForProfile(profileId, 12, "experimental_unscored")),
      Promise.resolve(listRecentSessionLogs(40, profileId)),
      Promise.resolve(getRecentThinkingEvidence(profileId, { limit: 120 })),
    ]);
    const activitySessions = formalActivitySessions.map(toActivitySessionSummary);
    const experimentalActivitySessionsSummary = experimentalActivitySessions.map(toActivitySessionSummary);
    const report = buildParentTrainingReport(
      profileId,
      recentSummaries,
      experimentalActivitySessionsSummary,
    );
    const dailyBrief = buildParentDailyBrief(profileId);
    const projectPlans = buildParentProjectPlans({
      logs: recentLogs,
      observations: recentSummaries,
      thinkingEvidence: recentThinkingEvidence,
      activitySessions,
      experimentalSessions: experimentalActivitySessionsSummary,
    });

    return NextResponse.json({
      dailyBrief,
      projectPlans,
      skills,
      recent: recentRows,
      report,
      activitySessions,
      experimentalActivitySessions: experimentalActivitySessionsSummary,
    });
  } catch (error) {
    console.error("[parent/report]", error);
    return NextResponse.json({
      skills: [],
      recent: [],
      dailyBrief: null,
      projectPlans: buildParentProjectPlans({ logs: [], observations: [] }),
      report: { items: [], experimentalItems: [] },
      activitySessions: [],
      experimentalActivitySessions: [],
    });
  }
}
