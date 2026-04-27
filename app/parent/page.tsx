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

interface ParentProjectLevel {
  level: number;
  title: string;
  childGoal: string;
  parentDescription: string;
  evidenceExamples: string[];
  nextStep: string;
}

interface ParentProjectPlan {
  themeId: string;
  label: string;
  shortLabel: string;
  internalFocus: string;
  targetThinkingMoves: ParentThinkingMoveSummary[];
  whyThisMatters: string;
  scientificBasis: string[];
  levels: ParentProjectLevel[];
  currentLevel: number;
  currentLevelTitle: string;
  progressPercent: number;
  status: "ready" | "observing" | "active" | "stretch" | "support";
  statusLabel: string;
  statusDetail: string;
  recentEvidence: string[];
  nextStep: string;
  homePrompt: string;
  nonFormalObservationNote: string;
  lastPlayedAt?: string;
  completedSessionCount: number;
}

interface ParentThinkingMoveSummary {
  move: string;
  label: string;
  status: "seen" | "watching";
  evidenceCount: number;
  bestLevel: number;
  latestEvidence?: string;
  homePrompt: string;
}

interface ParentReportResponse {
  dailyBrief?: ParentDailyBrief | null;
  projectPlans?: ParentProjectPlan[];
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

function projectStatusClass(status: ParentProjectPlan["status"]) {
  switch (status) {
    case "stretch":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "support":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "active":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "observing":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "ready":
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getVisibleMoves(plan: ParentProjectPlan) {
  const seen = plan.targetThinkingMoves.filter((move) => move.status === "seen");
  return (seen.length > 0 ? seen : plan.targetThinkingMoves).slice(0, 5);
}

function getProjectEvidenceSummary(plan: ParentProjectPlan) {
  const totalEvidence = plan.targetThinkingMoves.reduce((sum, move) => sum + move.evidenceCount, 0);
  const repeatedMoveCount = plan.targetThinkingMoves.filter((move) => move.evidenceCount >= 2).length;

  if (repeatedMoveCount > 0) {
    return {
      label: "线索较清楚",
      detail: `已看到 ${totalEvidence} 条思维动作证据，其中 ${repeatedMoveCount} 个动作出现过多次。系统仍会换场景再确认。`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (totalEvidence > 0) {
    return {
      label: "线索还偏薄",
      detail: `已看到 ${totalEvidence} 条线索，但还需要轻支架或换场景复听，先不急着升层。`,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (plan.recentEvidence.length > 0 || plan.completedSessionCount > 0) {
    return {
      label: "正在观察",
      detail: "已有互动记录，但还没有形成稳定的思维动作证据。",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    label: "等待证据",
    detail: "还没有真实互动记录，第一次会从轻量小场景开始。",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function moveChipClass(status: ParentThinkingMoveSummary["status"]) {
  return status === "seen"
    ? "border-accent/25 bg-accent text-white"
    : "border-slate-200 bg-slate-50 text-ink-soft";
}

function LevelRail({ plan }: { plan: ParentProjectPlan }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-soft">
        <span>正在观察：L{plan.currentLevel} / {plan.currentLevelTitle}</span>
        <span>下一步看证据厚度</span>
      </div>
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${plan.levels.length}, minmax(0, 1fr))` }}>
        {plan.levels.map((level) => {
          const active = level.level === plan.currentLevel;
          const reached = level.level < plan.currentLevel;
          return (
            <div key={`${plan.themeId}-rail-${level.level}`} className="min-w-0">
              <div
                className={`h-2 rounded-full ${
                  active || reached ? "bg-accent" : "bg-slate-100"
                }`}
              />
              <p className={`mt-1 truncate text-[11px] font-black ${active ? "text-accent" : "text-ink-soft"}`}>
                L{level.level}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-soft">
        这里显示的是观察阶段，不是能力百分比或正式测评分数。
      </p>
    </div>
  );
}

function RecentThinkingMovesPanel({ plans }: { plans: ParentProjectPlan[] }) {
  const observedMoves = plans
    .flatMap((plan) =>
      plan.targetThinkingMoves
        .filter((move) => move.status === "seen")
        .map((move) => ({
          ...move,
          projectLabel: plan.shortLabel,
        })),
    )
    .sort((left, right) => right.evidenceCount - left.evidenceCount || right.bestLevel - left.bestLevel);
  const visibleMoves = observedMoves.slice(0, 6);
  const nextPlans = plans
    .filter((plan) => plan.completedSessionCount > 0 || plan.status !== "ready")
    .slice(0, 3);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">近期观察</p>
            <h4 className="mt-1 text-lg font-black text-foreground">最近看到的思维动作</h4>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-ink-soft">
            {visibleMoves.length > 0 ? `${visibleMoves.length} 项` : "观察中"}
          </span>
        </div>

        {visibleMoves.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visibleMoves.map((move) => (
              <div key={`${move.projectLabel}-${move.move}`} className="rounded-2xl border border-white/80 bg-white/75 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-foreground">{move.label}</p>
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-black text-accent">
                    {move.projectLabel} · 证据 {move.evidenceCount} 条 · L{move.bestLevel || 1}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-soft">
                  {move.latestEvidence ? `孩子说：“${move.latestEvidence}”` : move.homePrompt}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-white/75 px-3 py-3 text-sm leading-6 text-ink-soft">
            还没有足够真实证据。第一次会先从轻量小场景开始，不急着下结论。
          </p>
        )}
      </div>

      <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">下一步</p>
        <h4 className="mt-1 text-lg font-black text-foreground">下一步计划</h4>
        <div className="mt-4 space-y-3">
          {(nextPlans.length > 0 ? nextPlans : plans.slice(0, 2)).map((plan) => (
            <div key={`next-${plan.themeId}`} className="rounded-2xl bg-white/75 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-foreground">{plan.shortLabel}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${projectStatusClass(plan.status)}`}>
                  {plan.statusLabel}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-soft">{plan.nextStep}</p>
              <p className="mt-2 text-xs leading-5 text-foreground">在家接一句：{plan.homePrompt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectPlanCard({ plan }: { plan: ParentProjectPlan }) {
  const evidenceSummary = getProjectEvidenceSummary(plan);

  return (
    <article className="rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-sm transition hover:bg-white/86">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">{plan.shortLabel}</p>
          <h4 className="mt-2 text-lg font-black leading-tight text-foreground">{plan.label}</h4>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{plan.internalFocus}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${projectStatusClass(plan.status)}`}>
            {plan.statusLabel}
          </span>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${evidenceSummary.className}`}>
            {evidenceSummary.label}
          </span>
        </div>
      </div>

      <LevelRail plan={plan} />

      <div className="mt-4">
        <p className="text-xs font-black text-foreground">思维动作</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {getVisibleMoves(plan).map((move) => (
            <span
              key={`${plan.themeId}-${move.move}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-black ${moveChipClass(move.status)}`}
              title={move.latestEvidence ?? move.homePrompt}
            >
              {move.label}
              {move.evidenceCount > 0 ? ` · ${move.evidenceCount}` : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/72 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-foreground">证据厚度</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">{evidenceSummary.detail}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white/72 px-3 py-3">
        <p className="text-xs font-black text-foreground">最近真实证据</p>
        {plan.recentEvidence.length > 0 ? (
          <div className="mt-2 space-y-1">
            {plan.recentEvidence.slice(0, 2).map((evidence, index) => (
              <p key={`${plan.themeId}-evidence-${index}`} className="text-xs leading-5 text-ink-soft">
                {index + 1}. {evidence}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs leading-5 text-ink-soft">还没有真实互动记录，第一次会从轻量小场景开始。</p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-white/72 px-3 py-3">
          <p className="text-xs font-black text-foreground">下一步</p>
          <p className="mt-2 text-xs leading-5 text-ink-soft">{plan.nextStep}</p>
        </div>
        <div className="rounded-2xl bg-white/72 px-3 py-3">
          <p className="text-xs font-black text-foreground">在家可接</p>
          <p className="mt-2 text-xs leading-5 text-ink-soft">{plan.homePrompt}</p>
        </div>
      </div>

      <details className="mt-4 border-t border-white/80 pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2 text-xs font-black text-accent">
          <span>查看路径依据和 L1-L4 说明</span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="mt-4">
          <p className="text-sm leading-6 text-foreground">{plan.whyThisMatters}</p>
          <div className="mt-3 space-y-2">
            {plan.scientificBasis.map((basis) => (
              <p key={basis} className="rounded-2xl bg-white/72 px-3 py-2 text-xs leading-5 text-ink-soft">
                {basis}
              </p>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            {plan.levels.map((level) => {
              const active = level.level === plan.currentLevel;
              return (
                <div
                  key={`${plan.themeId}-${level.level}`}
                  className={`rounded-2xl border px-3 py-3 ${
                    active ? "border-accent/30 bg-accent/10" : "border-white/70 bg-white/56"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-accent">L{level.level}</p>
                      <p className="mt-1 text-sm font-black text-foreground">{level.title}</p>
                    </div>
                    {active && (
                      <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-black text-white">
                        当前
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-foreground">{level.parentDescription}</p>
                  <p className="mt-2 text-xs leading-5 text-ink-soft">
                    看这些证据：{level.evidenceExamples.join(" / ")}
                  </p>
                </div>
              );
            })}
          </div>

          {plan.lastPlayedAt && (
            <p className="mt-3 text-[11px] text-ink-soft">
              最近一次：{new Date(plan.lastPlayedAt).toLocaleString("zh-CN")}
            </p>
          )}
        </div>
      </details>
    </article>
  );
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
      className="bp-panel rounded-[30px]"
    >
      <summary className="cursor-pointer list-none px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</p>
        <p className="mt-1 text-base font-semibold text-foreground">{title}</p>
      </summary>
      <div className="border-t border-white/70 px-5 py-5">{children}</div>
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
  const [storedProjectPlans, setStoredProjectPlans] = useState<ParentProjectPlan[]>([]);
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
        setStoredProjectPlans(data.projectPlans ?? []);
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
        setStoredProjectPlans([]);
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
  const projectPlans = hasLoadedData ? storedProjectPlans : [];
  const skills = hasLoadedData ? storedSkills : [];
  const recent = hasLoadedData ? storedRecent : [];
  const report = hasLoadedData ? storedReport : null;
  const activitySessions = hasLoadedData ? storedSessions : [];
  const experimentalSessions = hasLoadedData ? storedExperimentalSessions : [];
  const hasDeepData = Boolean(
    projectPlans.some((plan) => plan.completedSessionCount > 0 || plan.recentEvidence.length > 0) ||
    (report?.items.length ?? 0) > 0 ||
    activitySessions.length > 0 ||
    experimentalSessions.length > 0 ||
    skills.length > 0 ||
    recent.length > 0,
  );

  return (
    <div className="brainplay-page">
      <header className="brainplay-shell bp-nav">
        <div>
          <p className="bp-kicker">Parent Brief</p>
          <h1 className="mt-1 text-lg font-black text-foreground">家长简报</h1>
        </div>
        <Link href="/" className="bp-button-secondary px-4 py-2 text-sm">
          返回首页
        </Link>
      </header>

      <main className="brainplay-shell space-y-6 pb-8 pt-3">
        {!hydratedProfile && (
          <div className="bp-panel rounded-[34px] p-6 text-center">
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
              className="bp-panel rounded-[44px] p-6 sm:p-8"
            >
              <p className="bp-chip px-3 py-1.5">今天的陪聊对象</p>
              <h2 className="bp-section-title mt-4">{hydratedProfile.nickname}</h2>
              <p className="bp-copy mt-3 max-w-2xl">
                这里优先告诉你：今天聊了什么、孩子是怎么想的、明天可以怎么顺手接一句。
              </p>
            </motion.section>

            {loading && (
              <p className="animate-pulse text-center text-sm text-ink-soft">正在整理今天的简报…</p>
            )}

            {!loading && projectPlans.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 }}
                className="bp-panel rounded-[40px] p-6 sm:p-7"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="bp-kicker">科学成长路径</p>
                    <h3 className="mt-3 text-2xl font-black leading-tight tracking-tight text-foreground">
                      最近看到的思维动作、真实证据和下一步计划。
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
                      {projectPlans[0]?.nonFormalObservationNote ?? "这些内容是形成性观察，不是正式测评分数。"}
                    </p>
                  </div>
                  <Link href="/session" className="bp-button-secondary px-4 py-2 text-sm">
                    去聊 5 分钟
                  </Link>
                </div>

                <div className="mt-5">
                  <RecentThinkingMovesPanel plans={projectPlans} />
                </div>

                <details className="mt-5 rounded-[28px] border border-white/70 bg-white/60 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">全部项目</p>
                      <p className="mt-1 text-base font-black text-foreground">查看 5 个成长项目的阶段和依据</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-accent shadow-sm">
                      展开 ⌄
                    </span>
                  </summary>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {projectPlans.map((plan) => (
                      <ProjectPlanCard key={plan.themeId} plan={plan} />
                    ))}
                  </div>
                </details>
              </motion.section>
            )}

            {!loading && !dailyBrief && !hasDeepData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bp-panel rounded-[34px] p-6 text-center"
              >
                <p className="text-sm text-ink-soft">今天还没有新的互动记录，先去和林老师聊一小会儿吧。</p>
                <Link
                  href="/session"
                  className="bp-button-primary mt-3 px-5 py-2 text-sm"
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
                className="bp-panel rounded-[40px] p-6 sm:p-7"
              >
                <p className="bp-kicker">今日简报</p>
                <h3 className="mt-3 max-w-3xl text-2xl font-black leading-tight tracking-tight text-foreground">{dailyBrief.summary}</h3>
                <p className="mt-2 text-xs text-ink-soft">
                  更新时间：{new Date(dailyBrief.generatedAt).toLocaleString("zh-CN")}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="bp-stat p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊了什么</p>
                    <p className="mt-3 text-base font-semibold text-foreground">{dailyBrief.questionTitle}</p>
                  </div>
                  <div className="bp-stat p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">她是怎么想的</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{dailyBrief.childThinking}</p>
                  </div>
                  <div className="bp-stat p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">这次对她来说</p>
                    <p className="mt-3 text-base font-semibold text-foreground">{dailyBrief.adaptationSummary ?? "林老师还在继续观察"}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{dailyBrief.adaptationDetail ?? "等再多几次小聊天，系统会更稳定地判断她现在偏轻松还是偏吃力。"}</p>
                  </div>
                  <div className="bp-stat p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">明天怎么接着问</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{dailyBrief.nextPrompt}</p>
                  </div>
                </div>

                {dailyBrief.recentTopics.length > 1 && (
                  <div className="bp-paper mt-5 rounded-[28px] p-4">
                    <p className="bp-kicker">最近聊过</p>
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
                  kicker="林老师观察"
                  title={`最近更适合这样接：${report?.primaryFocus ?? "先轻轻聊一轮"}`}
                >
                  <p className="text-xs text-ink-soft">
                    生成时间：{report?.generatedAt ? new Date(report.generatedAt).toLocaleString("zh-CN") : "-"}
                  </p>
                  <div className="mt-4 space-y-4">
                    {report?.items.map((item) => (
                      <div
                        key={`${item.goalId}-${item.subGoalId}`}
                         className="bp-muted-card p-4"
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
                        <p className="mt-3 text-sm text-foreground">林老师这次主要在看：{item.trainingFocus}</p>
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
                <CollapsibleSection kicker="回看记录" title="最近林老师陪聊过的片段">
                  {activitySessions.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground">结构化小片段</p>
                      <div className="mt-3 space-y-3">
                        {activitySessions.slice(0, 6).map((session) => (
                          <div key={session.id} className="bp-muted-card p-3">
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
                          <div key={`${item.goalId}-${item.activityId}-${index}`} className="bp-muted-card p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{item.goalId} / {item.activityId}</p>
                              <p className="text-xs text-ink-soft">{new Date(item.updatedAt).toLocaleString("zh-CN")}</p>
                            </div>
                            <p className="mt-2 text-sm text-foreground">{item.summary}</p>
                            <p className="mt-2 text-xs text-ink-soft">这些内容属于探索式陪聊，主要用来帮助林老师下次更会接话。</p>
                          </div>
                        ))}
                        {report?.experimentalItems?.length
                          ? null
                          : experimentalSessions.slice(0, 4).map((session) => (
                              <div key={session.id} className="bp-muted-card p-3">
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
                <CollapsibleSection kicker="更多线索" title="最近林老师看到的变化">
                  {skills.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-foreground">最近常出现的想法方向 Top {skills.length}</p>
                      <div className="mt-4 space-y-3">
                        {skills.map((skill) => (
                          <div key={skill.skill} className="bp-muted-card flex items-center justify-between gap-3 p-3">
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
                          <div key={item.id} className="bp-muted-card p-3">
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

      <section className="brainplay-shell pb-12">
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
