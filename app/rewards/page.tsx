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
  const activeToolCalls = useAgentStore((state) => state.activeToolCalls);
  const currentThemeId = useAgentStore((state) => state.currentThemeId);
  const currentQuestionId = useAgentStore((state) => state.currentQuestionId);
  const sessionSummary = useAgentStore((state) => state.sessionSummary);
  const conversation = useAgentStore((state) => state.conversation);

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
  const highlightDetail = badges[0]?.detail ?? "林老师把刚才那一点点变化记住了。";
  const persistedRewardSummary = activeProfile ? rewardSummary : null;
  const persistentDays = persistedRewardSummary?.recentDays ?? [];

  return (
    <div className="brainplay-page">
      <header className="brainplay-shell bp-nav">
        <div>
          <p className="bp-kicker">BrainPlay Traces</p>
          <h1 className="mt-1 text-lg font-black text-foreground">今天留下的小变化</h1>
        </div>
        <Link href="/" className="bp-button-secondary px-4 py-2 text-sm">返回首页</Link>
      </header>

      <main className="brainplay-shell pb-12 pt-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <section className="bp-panel grid gap-6 rounded-[44px] p-6 text-left md:grid-cols-[auto_1fr] md:items-center sm:p-8">
            <Image
              src="/illustrations/character/brainy-encouraging.png"
              alt="林老师鼓励"
              width={124}
              height={124}
              className="rounded-[30px] shadow-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />

            <div>
              <p className="bp-chip px-3 py-1.5">Growth, Not Scores</p>
              <h2 className="bp-section-title mt-4 max-w-3xl">
                {activeProfile ? `${activeProfile.nickname}，林老师把最近这些小变化都收起来了` : "林老师把最近这些小变化都收起来了"}
              </h2>
              <p className="bp-copy mt-3 max-w-2xl">
                变化不只在今天这一轮里。林老师会把最近聊到的东西、你更愿意开的口、还有慢慢亮起来的小习惯，一点点记住。
              </p>
              {persistedRewardSummary?.currentIdentity && (
                <div className="mt-4 flex">
                  <IdentityBadge label={persistedRewardSummary.currentIdentity} />
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="bp-stat p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊到</p>
              <p className="mt-3 text-base font-semibold text-foreground">{activeQuestion?.title ?? persistentDays[0]?.questionTitle ?? "最近那个小问题"}</p>
              <p className="mt-2 text-sm text-ink-soft">{activeTheme ? `林老师今天是从“${activeTheme.label}”这个方向开口的。` : "林老师最近一直在陪你慢慢聊。"}</p>
            </div>

            <div className="bp-stat p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">你刚才说过</p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {latestChildLine
                  ? `“${latestChildLine}”`
                  : persistentDays[0]?.childThinking ?? "林老师最近已经记住了你愿意把自己的想法说出来。"}
              </p>
            </div>

            <div className="bp-stat p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">林老师记住了</p>
              <p className="mt-3 text-base font-semibold text-foreground">{highlightTitle}</p>
              <p className="mt-2 text-sm text-ink-soft">{highlightDetail}</p>
            </div>

            <div className="bp-stat p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">最近的小习惯</p>
              <p className="mt-3 text-3xl font-bold text-foreground">{rewardSummary?.streakDays ?? 0}</p>
              <p className="mt-2 text-sm text-ink-soft">连续留下小变化的天数</p>
              <p className="mt-2 text-xs text-ink-soft">最近 7 天里，有 {persistedRewardSummary?.activeDaysLast7 ?? 0} 天和林老师聊过。</p>
            </div>
          </section>

          {sessionSummary?.summary && (
            <section className="bp-scene-card rounded-[32px] p-6">
              <p className="bp-kicker">林老师今天的小结</p>
              <p className="mt-3 text-sm leading-7 text-foreground">{sessionSummary.summary}</p>
            </section>
          )}

          <section className="bp-panel rounded-[38px] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="bp-kicker">最近几天</p>
                <p className="mt-1 text-sm text-ink-soft">不是只看今天这一轮，而是看看最近几天慢慢亮起来的东西。</p>
              </div>
              <p className="text-xs text-ink-soft">一共记录了 {persistedRewardSummary?.totalSessions ?? 0} 次小聊天</p>
            </div>

            <div className="mt-5 space-y-4">
              {persistentDays.length > 0 ? persistentDays.map((day) => (
                <div key={day.dateKey} className="bp-paper rounded-[28px] p-5">
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
                <div className="bp-paper rounded-[28px] p-5 text-sm text-ink-soft">
                  还没有跨天的小变化记录。等聊过几次以后，这里会慢慢亮起来。
                </div>
              )}
            </div>
          </section>

          {persistedRewardSummary?.milestoneBadges?.length ? (
            <section className="bp-panel rounded-[34px] p-6">
              <p className="bp-kicker">最近亮起的小徽章</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {persistedRewardSummary.milestoneBadges.map((badge) => (
                  <div key={badge.id} className="rounded-[24px] border border-amber-200 bg-amber-50/82 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-amber-800">{badge.label}</p>
                    <p className="mt-2 text-sm leading-6 text-amber-700">{badge.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {persistedRewardSummary?.worldTraces?.length ? (
            <section className="bp-panel rounded-[34px] p-6">
              <p className="bp-kicker">林老师的小世界也变了一点</p>
              <div className="mt-4 space-y-3">
                {persistedRewardSummary.worldTraces.map((trace) => (
                  <div key={trace.id} className="rounded-[24px] border border-sky-200 bg-sky-50/82 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">{trace.title}</p>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{trace.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {persistedRewardSummary?.growthMap?.length ? (
            <ProgressMap
              title="林老师的成长地图"
              subtitle="不是一下子长大，而是最近几天一点点亮起来。"
              nodes={persistedRewardSummary.growthMap}
            />
          ) : null}

          {persistedRewardSummary?.lastingTraces?.length ? (
            <section className="bp-panel rounded-[34px] p-6">
              <p className="bp-kicker">一直亮着的小东西</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {persistedRewardSummary.lastingTraces.map((trace) => (
                  <span key={trace} className="rounded-full border border-white/70 bg-white/68 px-3 py-2 text-sm font-medium text-foreground shadow-sm">
                    {trace}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {badges.length > 0 && (
            <section className="bp-panel rounded-[34px] p-6">
              <p className="bp-kicker">今天亮起来的小东西</p>
              <div className="mt-4 space-y-3">
                {badges.map((badge, index) => (
                  <motion.div
                    key={`${badge.badgeId ?? badge.title ?? "badge"}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-4 rounded-[24px] border border-amber-200 bg-amber-50/82 p-4 shadow-sm"
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
                      <p className="text-sm text-amber-700">{badge.detail ?? "林老师把这一点点变化记住了。"}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-col items-center gap-3 pt-2">
            <Link href="/session" className="bp-button-primary px-6 py-3 text-sm">
              再聊一个小问题
            </Link>
            <Link
              href="/parent"
              className="bp-button-secondary px-6 py-3 text-sm"
            >
              给家长看看最近的变化
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
