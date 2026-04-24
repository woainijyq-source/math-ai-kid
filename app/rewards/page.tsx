"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { IdentityBadge } from "@/components/reward/identity-badge";
import { ProgressMap, type ProgressMapNode } from "@/components/reward/progress-map";
import { getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import { getDailyQuestion } from "@/lib/daily/select-daily-question";

interface RewardTimelineEntry {
  dateKey: string;
  dateLabel: string;
  questionTitle: string;
  themeLabel?: string;
  changeTitle: string;
  changeDetail: string;
  childThinking?: string;
  adaptationSummary?: string;
}

interface RewardSummary {
  streakDays: number;
  activeDaysLast7: number;
  totalSessions: number;
  currentIdentity: string;
  recentDays: RewardTimelineEntry[];
  lastingTraces: string[];
  milestoneBadges: Array<{
    id: string;
    label: string;
    detail: string;
  }>;
  worldTraces: Array<{
    id: string;
    title: string;
    detail: string;
  }>;
  growthMap: ProgressMapNode[];
}

function pickLatestChildLine(conversation: Array<{ role: string; content?: string }>) {
  const latest = [...conversation]
    .reverse()
    .find((message) => message.role === "user" && typeof message.content === "string" && message.content.trim().length > 0);

  return latest?.content?.trim();
}

export default function RewardsPage() {
  const activeProfile = useProfileStore((s) => s.getActiveProfile());
  const {
    activeToolCalls,
    currentThemeId,
    currentQuestionId,
    sessionSummary,
    conversation,
  } = useAgentStore((state) => ({
    activeToolCalls: state.activeToolCalls,
    currentThemeId: state.currentThemeId,
    currentQuestionId: state.currentQuestionId,
    sessionSummary: state.sessionSummary,
    conversation: state.conversation,
  }));

  const [rewardSummary, setRewardSummary] = useState<RewardSummary | null>(null);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    let cancelled = false;
    fetch(`/api/rewards/summary?profileId=${activeProfile.id}`)
      .then((response) => response.json())
      .then((data: { summary?: RewardSummary | null }) => {
        if (!cancelled) {
          setRewardSummary(data.summary ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRewardSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  const badges = activeToolCalls
    .filter((toolCall) => toolCall.name === "award_badge")
    .map((toolCall) => (toolCall.arguments as { badgeId?: string; title?: string; detail?: string }));

  const activeTheme = getDailyThemeDefinition(currentThemeId ?? undefined);
  const activeQuestion = getDailyQuestion(currentQuestionId ?? undefined);
  const latestChildLine = pickLatestChildLine(conversation);
  const highlightTitle = badges[0]?.title ?? "今天的小变化";
  const highlightDetail = badges[0]?.detail ?? "脑脑把刚才那一点点变化记住了。";
  const persistedRewardSummary = activeProfile ? rewardSummary : null;
  const persistentDays = persistedRewardSummary?.recentDays ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7ED] via-[#FFFDF7] to-[#F3E8FF]">
      <header className="flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-foreground">今天留下的小变化</h1>
        <Link href="/" className="text-sm text-accent underline">返回首页</Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <section className="rounded-[32px] border border-white/70 bg-white/92 p-6 text-center shadow-sm backdrop-blur-sm">
            <Image
              src="/illustrations/character/brainy-encouraging.png"
              alt="脑脑鼓励"
              width={120}
              height={120}
              className="mx-auto rounded-3xl"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />

            <h2 className="mt-4 text-2xl font-bold text-foreground">
              {activeProfile ? `${activeProfile.nickname}，脑脑把最近这些小变化都收起来了` : "脑脑把最近这些小变化都收起来了"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              变化不只在今天这一轮里。脑脑会把最近聊到的东西、你更愿意开的口、还有慢慢亮起来的小习惯，一点点记住。
            </p>
            {persistedRewardSummary?.currentIdentity && (
              <div className="mt-4 flex justify-center">
                <IdentityBadge label={persistedRewardSummary.currentIdentity} />
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊到</p>
              <p className="mt-3 text-base font-semibold text-foreground">{activeQuestion?.title ?? persistentDays[0]?.questionTitle ?? "最近那个小问题"}</p>
              <p className="mt-2 text-sm text-ink-soft">{activeTheme ? `脑脑今天是从“${activeTheme.label}”这个方向开口的。` : "脑脑最近一直在陪你慢慢聊。"}</p>
            </div>

            <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">你刚才说过</p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {latestChildLine
                  ? `“${latestChildLine}”`
                  : persistentDays[0]?.childThinking ?? "脑脑最近已经记住了你愿意把自己的想法说出来。"}
              </p>
            </div>

            <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">脑脑记住了</p>
              <p className="mt-3 text-base font-semibold text-foreground">{highlightTitle}</p>
              <p className="mt-2 text-sm text-ink-soft">{highlightDetail}</p>
            </div>

            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">最近的小习惯</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{rewardSummary?.streakDays ?? 0}</p>
              <p className="mt-2 text-sm text-ink-soft">连续留下小变化的天数</p>
              <p className="mt-2 text-xs text-ink-soft">最近 7 天里，有 {persistedRewardSummary?.activeDaysLast7 ?? 0} 天和脑脑聊过。</p>
            </div>
          </section>

          {sessionSummary?.summary && (
            <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">脑脑今天的小结</p>
              <p className="mt-3 text-sm leading-7 text-foreground">{sessionSummary.summary}</p>
            </section>
          )}

          <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">最近几天</p>
                <p className="mt-1 text-sm text-ink-soft">不是只看今天这一轮，而是看看最近几天慢慢亮起来的东西。</p>
              </div>
              <p className="text-xs text-ink-soft">一共记录了 {persistedRewardSummary?.totalSessions ?? 0} 次小聊天</p>
            </div>

            <div className="mt-5 space-y-4">
              {persistentDays.length > 0 ? persistentDays.map((day) => (
                <div key={day.dateKey} className="rounded-[24px] border border-border/70 bg-surface/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{day.dateLabel}</p>
                      <p className="mt-2 text-base font-semibold text-foreground">{day.questionTitle}</p>
                      {day.themeLabel && <p className="mt-1 text-xs text-ink-soft">方向：{day.themeLabel}</p>}
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                      {day.changeTitle}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">{day.changeDetail}</p>
                  {day.adaptationSummary && (
                    <p className="mt-2 text-xs font-medium text-amber-700">{day.adaptationSummary}</p>
                  )}
                  {day.childThinking && (
                    <p className="mt-2 text-xs text-ink-soft">{day.childThinking}</p>
                  )}
                </div>
              )) : (
                <div className="rounded-[24px] border border-border/70 bg-surface/50 p-5 text-sm text-ink-soft">
                  还没有跨天的小变化记录。等聊过几次以后，这里会慢慢亮起来。
                </div>
              )}
            </div>
          </section>

          {persistedRewardSummary?.milestoneBadges?.length ? (
            <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">最近亮起的小徽章</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {persistedRewardSummary.milestoneBadges.map((badge) => (
                  <div key={badge.id} className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">{badge.label}</p>
                    <p className="mt-2 text-sm leading-6 text-amber-700">{badge.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {persistedRewardSummary?.worldTraces?.length ? (
            <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">脑脑的小世界也变了一点</p>
              <div className="mt-4 space-y-3">
                {persistedRewardSummary.worldTraces.map((trace) => (
                  <div key={trace.id} className="rounded-[22px] border border-sky-200 bg-sky-50 p-4">
                    <p className="text-sm font-semibold text-foreground">{trace.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{trace.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {persistedRewardSummary?.growthMap?.length ? (
            <ProgressMap
              title="脑脑的成长地图"
              subtitle="不是一下子长大，而是最近几天一点点亮起来。"
              nodes={persistedRewardSummary.growthMap}
            />
          ) : null}

          {persistedRewardSummary?.lastingTraces?.length ? (
            <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">一直亮着的小东西</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {persistedRewardSummary.lastingTraces.map((trace) => (
                  <span key={trace} className="rounded-full border border-border/70 bg-surface/50 px-3 py-2 text-sm text-foreground">
                    {trace}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {badges.length > 0 && (
            <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">今天亮起来的小东西</p>
              <div className="mt-4 space-y-3">
                {badges.map((badge, index) => (
                  <motion.div
                    key={`${badge.badgeId ?? badge.title ?? "badge"}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <Image
                      src="/illustrations/icons/badge-star.png"
                      alt="小变化"
                      width={48}
                      height={48}
                      className="flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    <div>
                      <p className="font-semibold text-amber-800">{badge.title ?? "小变化"}</p>
                      <p className="text-sm text-amber-700">{badge.detail ?? "脑脑把这一点点变化记住了。"}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href="/session"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              再聊一个小问题
            </Link>
            <Link
              href="/parent"
              className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft"
            >
              给家长看看最近的变化
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
