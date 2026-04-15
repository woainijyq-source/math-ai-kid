"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SettingsPanel } from "@/components/parent/settings-panel";
import { useIsClient } from "@/hooks/use-is-client";
import { useProfileStore } from "@/store/profile-store";
import type { ActivitySessionSummary } from "@/types/goals";

interface SkillSummary {
  skill: string;
  avg_confidence: number;
  count: number;
}

interface ObservationRow {
  id: number;
  skill: string;
  observation: string;
  confidence: number;
  created_at: string;
}

interface ParentTrainingReportItem {
  goalId: string;
  goalLabel: string;
  subGoalId: string;
  label: string;
  trainingFocus: string;
  strongestEvidence: string;
  stuckPoint: string;
  stage: string;
  recommendedDifficulty: string;
  nextSuggestion: string;
  recentEvidence: string[];
  evidenceHealth: "complete" | "thin" | "early";
}

interface ParentTrainingReport {
  primaryFocus: string;
  generatedAt: string;
  items: ParentTrainingReportItem[];
  experimentalItems?: Array<{
    goalId: string;
    subGoalId: string;
    activityId: string;
    summary: string;
    updatedAt: string;
  }>;
}

interface ParentReportResponse {
  skills: SkillSummary[];
  recent: ObservationRow[];
  report?: ParentTrainingReport;
  activitySessions?: ActivitySessionSummary[];
  experimentalActivitySessions?: ActivitySessionSummary[];
}

function evidenceHealthLabel(health: ParentTrainingReportItem["evidenceHealth"]) {
  switch (health) {
    case "complete":
      return "证据完整";
    case "thin":
      return "证据偏薄";
    default:
      return "刚起步";
  }
}

function evidenceHealthClass(health: ParentTrainingReportItem["evidenceHealth"]) {
  switch (health) {
    case "complete":
      return "bg-emerald-50 text-emerald-700";
    case "thin":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function ParentPage() {
  const isClient = useIsClient();
  const activeProfile = useProfileStore((state) => state.getActiveProfile());
  const [storedSkills, setStoredSkills] = useState<SkillSummary[]>([]);
  const [storedRecent, setStoredRecent] = useState<ObservationRow[]>([]);
  const [storedReport, setStoredReport] = useState<ParentTrainingReport | null>(null);
  const [storedSessions, setStoredSessions] = useState<ActivitySessionSummary[]>([]);
  const [storedExperimentalSessions, setStoredExperimentalSessions] = useState<ActivitySessionSummary[]>([]);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);

  const hydratedProfile = isClient ? activeProfile : null;

  useEffect(() => {
    if (!hydratedProfile) return;
    let cancelled = false;

    fetch(`/api/parent/report?profileId=${hydratedProfile.id}`)
      .then((response) => response.json())
      .then((data: ParentReportResponse) => {
        if (cancelled) return;
        setStoredSkills(data.skills ?? []);
        setStoredRecent(data.recent ?? []);
        setStoredReport(data.report ?? null);
        setStoredSessions(data.activitySessions ?? []);
        setStoredExperimentalSessions(data.experimentalActivitySessions ?? []);
        setLoadedProfileId(hydratedProfile.id);
      })
      .catch(() => {
        if (cancelled) return;
        setStoredSkills([]);
        setStoredRecent([]);
        setStoredReport(null);
        setStoredSessions([]);
        setStoredExperimentalSessions([]);
        setLoadedProfileId(hydratedProfile.id);
      });

    return () => {
      cancelled = true;
    };
  }, [hydratedProfile]);

  const hasLoadedData = Boolean(hydratedProfile && loadedProfileId === hydratedProfile.id);
  const loading = Boolean(hydratedProfile && !hasLoadedData);
  const skills = hasLoadedData ? storedSkills : [];
  const recent = hasLoadedData ? storedRecent : [];
  const report = hasLoadedData ? storedReport : null;
  const activitySessions = hasLoadedData ? storedSessions : [];
  const experimentalSessions = hasLoadedData ? storedExperimentalSessions : [];

  const confidenceColor = (confidence: number) =>
    confidence >= 0.75
      ? "text-green-600"
      : confidence >= 0.5
        ? "text-amber-600"
        : "text-red-500";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] to-[#EFF6FF]">
      <header className="flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-foreground">家长训练报告</h1>
        <Link href="/" className="text-sm text-accent underline">
          返回首页
        </Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {!hydratedProfile && (
          <div className="rounded-2xl border border-border bg-white p-6 text-center">
            <p className="text-sm text-ink-soft">
              请先
              <Link href="/session" className="text-accent underline">
                创建孩子档案
              </Link>
            </p>
          </div>
        )}

        {hydratedProfile && (
          <>
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">孩子档案</p>
              <h2 className="mt-2 text-xl font-bold">{hydratedProfile.nickname}</h2>
              <p className="text-sm text-ink-soft">
                训练偏好：{hydratedProfile.goalPreferences.join("、") || "综合"}
              </p>
            </motion.section>

            {loading && (
              <p className="animate-pulse text-center text-sm text-ink-soft">报告生成中…</p>
            )}

            {!loading && skills.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-border bg-white p-6 text-center"
              >
                <p className="text-sm text-ink-soft">还没有训练记录，先去和脑脑互动几轮吧。</p>
                <Link
                  href="/session"
                  className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white"
                >
                  开始互动
                </Link>
              </motion.div>
            )}

            {report && report.items.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">训练解释</p>
                <h3 className="mt-2 text-lg font-bold text-foreground">当前重点：{report.primaryFocus}</h3>
                <p className="mt-1 text-xs text-ink-soft">
                  生成时间：{new Date(report.generatedAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-4 space-y-4">
                  {report.items.map((item) => (
                    <div
                      key={`${item.goalId}-${item.subGoalId}`}
                      className="rounded-2xl border border-border/60 bg-surface/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.goalLabel} / {item.label}</p>
                          <p className="text-xs text-ink-soft">
                            阶段：{item.stage} · 推荐难度：{item.recommendedDifficulty}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${evidenceHealthClass(item.evidenceHealth)}`}>
                          {evidenceHealthLabel(item.evidenceHealth)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-foreground">本次训练点：{item.trainingFocus}</p>
                      <p className="mt-2 text-sm text-foreground">最强证据：{item.strongestEvidence}</p>
                      <p className="mt-2 text-sm text-foreground">当前卡点：{item.stuckPoint}</p>
                      <p className="mt-2 text-sm text-foreground">下一步建议：{item.nextSuggestion}</p>
                      {item.recentEvidence.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {item.recentEvidence.map((evidence, index) => (
                            <p key={`${item.subGoalId}-${index}`} className="text-xs text-ink-soft">
                              {index + 1}. {evidence}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {activitySessions.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">最近活动会话</p>
                <div className="mt-4 space-y-3">
                  {activitySessions.slice(0, 6).map((session) => (
                    <div key={session.id} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{session.activityId}</p>
                        <p className="text-xs text-ink-soft">{session.status}</p>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        已覆盖证据：{session.completedEvidenceSlots.join("、") || "暂无"}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">
                        缺失证据：{session.missingEvidenceSlots.join("、") || "无"}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {((report?.experimentalItems?.length ?? 0) > 0 || experimentalSessions.length > 0) && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">瀹炶抗浜掑姩</p>
                <div className="mt-4 space-y-3">
                  {(report?.experimentalItems ?? []).map((item, index) => (
                    <div key={`${item.goalId}-${item.activityId}-${index}`} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{item.goalId} / {item.activityId}</p>
                        <p className="text-xs text-ink-soft">{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{item.summary}</p>
                      <p className="mt-2 text-xs text-ink-soft">杩欎簺鍐呭灞炰簬瀹炶抗妯″紡锛屼笉璁″叆姝ｅ紡璁粌杩涘害銆?</p>
                    </div>
                  ))}
                  {report?.experimentalItems?.length ? null : experimentalSessions.slice(0, 4).map((session) => (
                    <div key={session.id} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{session.goalId} / {session.activityId}</p>
                        <p className="text-xs text-ink-soft">{session.status}</p>
                      </div>
                      <p className="mt-2 text-xs text-ink-soft">杩欐槸瀹炶抗浜掑姩璁板綍锛屼笉浼氱敤鏉ユ洿鏂版帉鎻＄姸鎬併€?</p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {skills.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                  近期练习能力 Top {skills.length}
                </p>
                <div className="mt-4 space-y-3">
                  {skills.map((skill) => (
                    <div key={skill.skill} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{skill.skill}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-soft">{skill.count} 次练习</span>
                        <span className={`text-sm font-bold ${confidenceColor(skill.avg_confidence)}`}>
                          {Math.round(skill.avg_confidence * 100)}%
                        </span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${Math.round(skill.avg_confidence * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {recent.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">最近观察记录</p>
                <div className="mt-4 space-y-4">
                  {recent.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent">{item.skill}</span>
                        <span className={`text-xs font-bold ${confidenceColor(item.confidence)}`}>
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{item.observation}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {new Date(item.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </>
        )}
      </main>

      <section className="mx-auto max-w-2xl px-4 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <SettingsPanel />
        </motion.div>
      </section>
    </div>
  );
}
