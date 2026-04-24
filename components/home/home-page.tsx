"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { DAILY_THEME_DEFINITIONS, getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { buildBrainySceneReason, buildBrainySceneSetup, buildBrainySceneVoice } from "@/lib/daily/brainy-voice";
import { getDailyQuestion, getDefaultDailyThemeId, selectDailyQuestion } from "@/lib/daily/select-daily-question";
import { useIsClient } from "@/hooks/use-is-client";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import type { DailyThemeId } from "@/types/daily";

interface ContinuitySnapshot {
  label: string;
  questionTitle: string;
  themeLabel?: string;
  childThinking?: string;
  memoryLine: string;
  gentleOpen: string;
  createdAt: string;
}

function buildSessionHref(options: {
  themeId?: DailyThemeId | null;
  questionId?: string | null;
}) {
  const params = new URLSearchParams();
  if (options.themeId) params.set("theme", options.themeId);
  if (options.questionId) params.set("question", options.questionId);
  const query = params.toString();
  return query ? `/session?${query}` : "/session";
}

function buildPreviewChildLead(themeId: DailyThemeId | undefined) {
  switch (themeId) {
    case "math":
      return "嗯，我想先分一分，再看看剩下多少。";
    case "pattern":
      return "让我先看看，哪里一直是一样的。";
    case "why":
      return "我先猜一个原因，再看看会不会变。";
    case "fairness":
      return "我想先看看，这样是不是每个人都能接受。";
    case "what-if":
    default:
      return "那我先想想，第一件会变的事情是什么。";
  }
}

function buildPreviewCoachNote(themeId: DailyThemeId | undefined) {
  switch (themeId) {
    case "math":
      return "脑脑更像在陪孩子找办法，不会立刻把答案摆出来。";
    case "pattern":
      return "脑脑会先陪孩子看一看，再慢慢问“你是从哪里发现的”。";
    case "why":
      return "脑脑会先接住孩子的猜想，再问一句“为什么会这样想”。";
    case "fairness":
      return "脑脑会先听孩子怎么定规则，而不是直接告诉她什么才公平。";
    case "what-if":
    default:
      return "脑脑会先陪孩子把想象说出来，再顺着那个世界往前走半步。";
  }
}

export function HomePage() {
  const activeProfile = useProfileStore((state) => state.getActiveProfile());
  const profiles = useProfileStore((state) => state.profiles);
  const {
    sessionId,
    currentThemeId,
    currentQuestionId,
  } = useAgentStore((state) => ({
    sessionId: state.sessionId,
    currentThemeId: state.currentThemeId,
    currentQuestionId: state.currentQuestionId,
  }));
  const isClient = useIsClient();

  const profile = isClient ? activeProfile : null;
  const hasSession = isClient ? Boolean(sessionId) : false;
  const profileCount = isClient ? profiles.length : 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selectedThemeId, setSelectedThemeId] = useState<DailyThemeId>(
    currentThemeId ?? getDefaultDailyThemeId(todayKey),
  );
  const [rotationOffset, setRotationOffset] = useState(0);
  const [continuitySnapshot, setContinuitySnapshot] = useState<ContinuitySnapshot | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let cancelled = false;
    fetch(`/api/continuity/latest?profileId=${profile.id}&theme=${selectedThemeId}`)
      .then((response) => response.json())
      .then((data: { snapshot?: ContinuitySnapshot | null }) => {
        if (!cancelled) {
          setContinuitySnapshot(data.snapshot ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContinuitySnapshot(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile, selectedThemeId]);

  const selectedQuestion = useMemo(
    () => selectDailyQuestion({
      themeId: selectedThemeId,
      rotationSeed: `${todayKey}:${selectedThemeId}:${rotationOffset}`,
    }),
    [rotationOffset, selectedThemeId, todayKey],
  );

  const resumedQuestion = currentQuestionId ? getDailyQuestion(currentQuestionId) : undefined;
  const previewQuestion = hasSession && resumedQuestion ? resumedQuestion : selectedQuestion;
  const visibleContinuity = profile ? continuitySnapshot : null;
  const previewTheme = getDailyThemeDefinition(
    (hasSession && resumedQuestion?.themeId) ? resumedQuestion.themeId : selectedThemeId,
  );
  const primaryHref = hasSession
    ? buildSessionHref({ themeId: currentThemeId, questionId: currentQuestionId })
    : buildSessionHref({
        themeId: selectedThemeId,
        questionId: selectedThemeId === "math" ? null : (selectedQuestion?.id ?? null),
      });

  return (
    <div className="brainplay-page">
      <header className="brainplay-shell bp-nav">
        <div className="bp-brand">
          <Image
            src="/illustrations/character/robot-happy.png"
            alt="脑脑"
            width={48}
            height={48}
            className="bp-brand-mark p-1"
          />
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-accent">BrainPlay</p>
            <p className="truncate text-sm text-ink-soft">每天 5 分钟，陪孩子把想法说出来</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="hidden rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-foreground shadow-sm sm:inline">
              {profile.nickname}
            </span>
          )}
          <Link
            href="/parent"
            className="bp-button-secondary px-4 py-2 text-sm"
          >
            家长简报
          </Link>
        </div>
      </header>

      <main className="brainplay-shell pb-14">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]"
        >
          <div className="bp-panel rounded-[44px] p-5 sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
              <div>
                <p className="bp-chip px-3 py-1.5">Today&apos;s Thinking Room</p>
                <h1 className="bp-title mt-5">
                  {profile ? `${profile.nickname}，今天不做题，和脑脑聊一小段。` : "今天不做题，和脑脑聊一小段。"}
                </h1>
                <p className="bp-copy mt-5 max-w-2xl">
                  脑脑会从一个小场景开口，顺着孩子的话往前追问。不抢答案、不打分，只把“我为什么这样想”慢慢说清楚。
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href={primaryHref} className="bp-button-primary px-7 py-4 text-base">
                    {hasSession ? "继续刚才的小聊天" : "开始今天 5 分钟"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRotationOffset((value) => value + 1)}
                    className="bp-button-secondary px-5 py-4 text-sm"
                  >
                    换个灵感
                  </button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="bp-stat p-4">
                    <p className="text-2xl font-black text-foreground">5 分钟</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">短到孩子愿意开始</p>
                  </div>
                  <div className="bp-stat p-4">
                    <p className="text-2xl font-black text-foreground">不判分</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">先听见想法怎么来</p>
                  </div>
                  <div className="bp-stat p-4">
                    <p className="text-2xl font-black text-foreground">会接话</p>
                    <p className="mt-1 text-xs leading-5 text-ink-soft">下次从记忆里继续</p>
                  </div>
                </div>

                {visibleContinuity && (
                  <p className="mt-5 rounded-[24px] border border-accent/12 bg-accent/8 px-4 py-3 text-sm leading-6 text-foreground">
                    脑脑还记得：{visibleContinuity.gentleOpen}
                  </p>
                )}

                <p className="mt-4 text-sm text-ink-soft">
                  {hasSession
                    ? "上次那段小聊天还在，点一下就能回到刚才的位置。"
                    : "第一次开始前，会先一起设置名字和头像。"}
                </p>
                {profileCount > 1 && (
                  <p className="mt-2 text-xs text-ink-soft">当前档案：{profile?.nickname ?? "未选择"}</p>
                )}
              </div>

              <div className="hidden rounded-[34px] border border-white/70 bg-white/62 p-4 shadow-sm xl:block">
                <Image
                  src="/illustrations/character/robot-encouraging.png"
                  alt="脑脑"
                  width={188}
                  height={188}
                  className="mx-auto rounded-[30px]"
                />
                <p className="mt-3 text-center text-sm font-semibold leading-6 text-foreground">
                  “先说一个猜想也可以，我会陪你一起看。”
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-black/5 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="bp-kicker">Choose a door</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">今天从哪个方向开口？</h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-ink-soft">
                  选方向不是选题型，只是给脑脑一个开场角度。
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {DAILY_THEME_DEFINITIONS.map((theme) => {
                  const active = theme.id === selectedThemeId;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setSelectedThemeId(theme.id);
                        setRotationOffset(0);
                      }}
                      className={`bp-theme-card min-h-[172px] p-4 text-left ${
                        active
                          ? `${theme.accentClass} ring-2 ring-accent/20`
                          : "text-ink-soft hover:text-foreground"
                      }`}
                    >
                      <span className="relative z-10 flex h-full flex-col">
                        <span className="relative h-12 w-12 overflow-hidden rounded-[20px] bg-white/84 shadow-sm">
                          <Image src={theme.icon} alt="" fill className="object-contain p-2.5" />
                        </span>
                        <span className="mt-4 block text-base font-black text-foreground">{theme.label}</span>
                        <span className="mt-2 block text-xs leading-5">{theme.summary}</span>
                        <span className="mt-auto pt-4 text-xs font-bold text-accent">{active ? "正在预览" : "点一下换过去"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className={`bp-scene-card rounded-[44px] bg-gradient-to-br p-5 sm:p-6 ${previewTheme?.softClass ?? "from-slate-100 to-white"}`}
          >
            {previewTheme && previewQuestion ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${previewTheme.accentClass}`}>
                      Live Preview · {previewTheme.label}
                    </p>
                    <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-foreground">脑脑会怎么开口？</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">不是抽一题出来做，而是先搭一个孩子能进入的小画面。</p>
                  </div>
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[24px] bg-white/80 shadow-sm">
                    <Image src={previewTheme.icon} alt={previewTheme.label} fill className="object-contain p-2.5" />
                  </div>
                </div>

                <div className="bp-paper mt-6 space-y-3 rounded-[32px] p-4">
                  <div className="bp-dialogue-bubble max-w-[94%] px-4 py-3 text-sm leading-6 text-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">脑脑</p>
                    <p className="mt-2">{buildBrainySceneSetup(previewQuestion)}</p>
                  </div>
                  <div className="bp-dialogue-bubble max-w-[94%] px-4 py-3 text-sm leading-6 text-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">脑脑可能会接着说</p>
                    <p className="mt-2">{buildBrainySceneVoice(previewQuestion)}</p>
                  </div>
                  <div className="bp-dialogue-bubble bp-dialogue-bubble-user ml-auto max-w-[88%] px-4 py-3 text-sm leading-6 text-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">孩子可能会先这样接</p>
                    <p className="mt-2">{buildPreviewChildLead(previewQuestion.themeId)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-6 text-ink-soft">
                  <div className="bp-muted-card p-4">
                    <p className="font-bold text-foreground">{previewQuestion.title}</p>
                    <p className="mt-2">{buildBrainySceneReason(previewQuestion)}</p>
                  </div>
                  <div className="bp-muted-card p-4">
                    <p className="font-bold text-foreground">脑脑下一句</p>
                    <p className="mt-2">{previewQuestion.mainQuestion}</p>
                  </div>
                  <div className="bp-muted-card p-4">
                    <p>{buildPreviewCoachNote(previewQuestion.themeId)}</p>
                    <p className="mt-2">如果孩子卡住，脑脑会给两个更容易开口的方向，而不是直接讲答案。</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bp-muted-card p-5 text-sm text-ink-soft">
                脑脑正在准备今天的问题。
              </div>
            )}
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
