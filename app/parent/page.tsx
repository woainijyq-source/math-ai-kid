"use client";

import { useEffect, useState, type ReactNode } from "react";
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

interface ParentDailyBrief {
  questionTitle: string;
  summary: string;
  childThinking: string;
  adaptationSummary?: string;
  adaptationDetail?: string;
  nextPrompt: string;
  recentTopics: string[];
  generatedAt: string;
}

interface ParentReportResponse {
  dailyBrief?: ParentDailyBrief | null;
  skills: SkillSummary[];
  recent: ObservationRow[];
  report?: ParentTrainingReport;
  activitySessions?: ActivitySessionSummary[];
  experimentalActivitySessions?: ActivitySessionSummary[];
}

function evidenceHealthLabel(health: ParentTrainingReportItem["evidenceHealth"]) {
  switch (health) {
    case "complete":
      return "线索比较清楚";
    case "thin":
      return "还需要再听一听";
    default:
      return "刚开始观察";
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

function confidenceColor(confidence: number) {
  return confidence >= 0.75
    ? "text-green-600"
    : confidence >= 0.5
      ? "text-amber-600"
      : "text-red-500";
}

function CollapsibleSection({
  title,
  kicker,
  children,
  defaultOpen = false,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-border bg-white shadow-sm"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</p>
        <p className="mt-1 text-base font-semibold text-foreground">{title}</p>
      </summary>
      <div className="border-t border-border/70 px-5 py-5">{children}</div>
    </details>
  );
}

export default function ParentPage() {
  const isClient = useIsClient();
  const activeProfile = useProfileStore((state) => state.getActiveProfile());
  const [storedDailyBrief, setStoredDailyBrief] = useState<ParentDailyBrief | null>(null);
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
        setStoredDailyBrief(data.dailyBrief ?? null);
        setStoredSkills(data.skills ?? []);
        setStoredRecent(data.recent ?? []);
        setStoredReport(data.report ?? null);
        setStoredSessions(data.activitySessions ?? []);
        setStoredExperimentalSessions(data.experimentalActivitySessions ?? []);
        setLoadedProfileId(hydratedProfile.id);
      })
      .catch(() => {
        if (cancelled) return;
        setStoredDailyBrief(null);
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
  const dailyBrief = hasLoadedData ? storedDailyBrief : null;
  const skills = hasLoadedData ? storedSkills : [];
  const recent = hasLoadedData ? storedRecent : [];
  const report = hasLoadedData ? storedReport : null;
  const activitySessions = hasLoadedData ? storedSessions : [];
  const experimentalSessions = hasLoadedData ? storedExperimentalSessions : [];
  const hasDeepData = Boolean(
    (report?.items.length ?? 0) > 0 ||
    activitySessions.length > 0 ||
    experimentalSessions.length > 0 ||
    skills.length > 0 ||
    recent.length > 0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#F8FAFC] to-[#EFF6FF]">
      <header className="flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-foreground">家长简报</h1>
        <Link href="/" className="text-sm text-accent underline">
          返回首页
        </Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
              className="rounded-[28px] border border-border bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">今天的陪聊对象</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">{hydratedProfile.nickname}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                这里优先告诉你：今天聊了什么、孩子是怎么想的、明天可以怎么顺手接一句。
              </p>
            </motion.section>

            {loading && (
              <p className="animate-pulse text-center text-sm text-ink-soft">正在整理今天的简报…</p>
            )}

            {!loading && !dailyBrief && !hasDeepData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-border bg-white p-6 text-center"
              >
                <p className="text-sm text-ink-soft">今天还没有新的互动记录，先去和脑脑聊一小会儿吧。</p>
                <Link
                  href="/session"
                  className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white"
                >
                  开始今天的 5 分钟
                </Link>
              </motion.div>
            )}

            {dailyBrief && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 }}
                className="rounded-[32px] border border-border bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">今日简报</p>
                <h3 className="mt-2 text-xl font-bold text-foreground">{dailyBrief.summary}</h3>
                <p className="mt-2 text-xs text-ink-soft">
                  更新时间：{new Date(dailyBrief.generatedAt).toLocaleString("zh-CN")}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊了什么</p>
                    <p className="mt-3 text-base font-semibold text-foreground">{dailyBrief.questionTitle}</p>
                  </div>
                  <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">她是怎么想的</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{dailyBrief.childThinking}</p>
                  </div>
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">这次对她来说</p>
                    <p className="mt-3 text-base font-semibold text-foreground">{dailyBrief.adaptationSummary ?? "脑脑还在继续观察"}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{dailyBrief.adaptationDetail ?? "等再多几次小聊天，系统会更稳定地判断她现在偏轻松还是偏吃力。"}</p>
                  </div>
                  <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">明天怎么接着问</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{dailyBrief.nextPrompt}</p>
                  </div>
                </div>

                {dailyBrief.recentTopics.length > 1 && (
                  <div className="mt-5 rounded-[24px] border border-border/70 bg-surface/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-accent">最近聊过</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dailyBrief.recentTopics.map((topic) => (
                        <span key={topic} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {(report?.items.length ?? 0) > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                <CollapsibleSection
                  kicker="脑脑观察"
                  title={`最近更适合这样接：${report?.primaryFocus ?? "先轻轻聊一轮"}`}
                >
                  <p className="text-xs text-ink-soft">
                    生成时间：{report?.generatedAt ? new Date(report.generatedAt).toLocaleString("zh-CN") : "-"}
                  </p>
                  <div className="mt-4 space-y-4">
                    {report?.items.map((item) => (
                      <div
                        key={`${item.goalId}-${item.subGoalId}`}
                        className="rounded-2xl border border-border/60 bg-surface/50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.goalLabel} / {item.label}</p>
                            <p className="text-xs text-ink-soft">现在大概在：{item.stage} · 下次先用：{item.recommendedDifficulty}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${evidenceHealthClass(item.evidenceHealth)}`}>
                            {evidenceHealthLabel(item.evidenceHealth)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-foreground">脑脑这次主要在看：{item.trainingFocus}</p>
                        <p className="mt-2 text-sm text-foreground">最清楚的一条线索：{item.strongestEvidence}</p>
                        <p className="mt-2 text-sm text-foreground">还需要慢慢接住的地方：{item.stuckPoint}</p>
                        <p className="mt-2 text-sm text-foreground">明天可以这样接：{item.nextSuggestion}</p>
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
                </CollapsibleSection>
              </motion.div>
            )}

            {(activitySessions.length > 0 || (report?.experimentalItems?.length ?? 0) > 0 || experimentalSessions.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <CollapsibleSection kicker="回看记录" title="最近脑脑陪聊过的片段">
                  {activitySessions.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground">结构化小片段</p>
                      <div className="mt-3 space-y-3">
                        {activitySessions.slice(0, 6).map((session) => (
                          <div key={session.id} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{session.activityId}</p>
                              <p className="text-xs text-ink-soft">{session.status}</p>
                            </div>
                            <p className="mt-1 text-xs text-ink-soft">已经听到的想法：{session.completedEvidenceSlots.join("、") || "暂无"}</p>
                            <p className="mt-1 text-xs text-ink-soft">下次还可以多听一点：{session.missingEvidenceSlots.join("、") || "无"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {((report?.experimentalItems?.length ?? 0) > 0 || experimentalSessions.length > 0) && (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-foreground">实验互动</p>
                      <div className="mt-3 space-y-3">
                        {(report?.experimentalItems ?? []).map((item, index) => (
                          <div key={`${item.goalId}-${item.activityId}-${index}`} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{item.goalId} / {item.activityId}</p>
                              <p className="text-xs text-ink-soft">{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
                            </div>
                            <p className="mt-2 text-sm text-foreground">{item.summary}</p>
                            <p className="mt-2 text-xs text-ink-soft">这些内容属于探索式陪聊，主要用来帮助脑脑下次更会接话。</p>
                          </div>
                        ))}
                        {report?.experimentalItems?.length
                          ? null
                          : experimentalSessions.slice(0, 4).map((session) => (
                              <div key={session.id} className="rounded-xl border border-border/60 bg-surface/50 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{session.goalId} / {session.activityId}</p>
                                  <p className="text-xs text-ink-soft">{session.status}</p>
                                </div>
                                <p className="mt-2 text-xs text-ink-soft">这是一条探索互动记录，主要用于回看孩子当时怎么想。</p>
                              </div>
                            ))}
                      </div>
                    </div>
                  )}
                </CollapsibleSection>
              </motion.div>
            )}

            {(skills.length > 0 || recent.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                <CollapsibleSection kicker="更多线索" title="最近脑脑看到的变化">
                  {skills.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground">最近常出现的想法方向 Top {skills.length}</p>
                      <div className="mt-4 space-y-3">
                        {skills.map((skill) => (
                          <div key={skill.skill} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface/50 p-3">
                            <span className="text-sm font-medium text-foreground">{skill.skill}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-ink-soft">出现 {skill.count} 次</span>
                              <span className={`text-sm font-bold ${confidenceColor(skill.avg_confidence)}`}>
                                {Math.round(skill.avg_confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recent.length > 0 && (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-foreground">最近观察</p>
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
                            <p className="mt-1 text-xs text-ink-soft">{new Date(item.created_at).toLocaleString("zh-CN")}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleSection>
              </motion.div>
            )}
          </>
        )}
      </main>

      <section className="mx-auto max-w-3xl px-4 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <SettingsPanel />
        </motion.div>
      </section>
    </div>
  );
}
