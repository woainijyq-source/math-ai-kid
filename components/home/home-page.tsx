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
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7ED] via-[#F9FAFB] to-[#EDE9FE]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/illustrations/character/robot-happy.png"
            alt="脑脑"
            width={44}
            height={44}
            className="rounded-full shadow-sm"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">BrainPlay</p>
            <p className="text-sm text-ink-soft">脑脑今日小聊</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile && <span className="hidden text-sm text-ink-soft sm:inline">{profile.nickname}</span>}
          <Link
            href="/parent"
            className="rounded-full border border-border bg-white px-4 py-2 text-sm text-ink-soft transition hover:bg-accent-soft"
          >
            家长
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-14 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
        >
          <div className="rounded-[32px] border border-white/70 bg-white/88 p-6 shadow-sm backdrop-blur-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Today&apos;s Tiny Chat</p>
            <div className="mt-4 flex items-start gap-4">
              <Image
                src="/illustrations/character/robot-encouraging.png"
                alt="脑脑"
                width={88}
                height={88}
                className="rounded-[24px] shadow-sm"
              />
              <div>
                <h1 className="text-3xl font-bold text-foreground sm:text-[2rem]">
                  {profile ? `${profile.nickname}，今天脑脑想和你聊一个小问题` : "今天脑脑想和你聊一个小问题"}
                </h1>
                <p className="mt-2 text-base leading-7 text-ink-soft">
                  先从一个小场景开始，脑脑会顺着你的话慢慢往前聊，不急着答对，只想一起想清楚一点点。
                </p>
                <p className="mt-2 text-sm text-ink-soft">
                  {hasSession
                    ? "上次那段小聊天还在，点一下就能继续。"
                    : "第一次开始前，会先一起设置名字和头像。"}
                </p>
                {visibleContinuity && (
                  <p className="mt-3 rounded-2xl bg-accent/8 px-4 py-3 text-sm leading-6 text-foreground">
                    脑脑还记得：{visibleContinuity.gentleOpen}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
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
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? `${theme.accentClass} shadow-sm`
                        : "border-border bg-white text-ink-soft hover:border-accent/40 hover:text-foreground"
                    }`}
                  >
                    {theme.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-accent/90 hover:shadow-xl"
              >
                {hasSession ? "继续刚才的小聊天" : "去找脑脑聊 5 分钟"}
              </Link>
              <button
                type="button"
                onClick={() => setRotationOffset((value) => value + 1)}
                className="rounded-full border border-border bg-white px-5 py-4 text-sm font-semibold text-foreground transition hover:bg-accent-soft"
              >
                换个聊天灵感
              </button>
            </div>

            {profileCount > 1 && (
              <p className="mt-4 text-xs text-ink-soft">当前档案：{profile?.nickname ?? "未选择"}</p>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className={`rounded-[32px] border bg-gradient-to-br p-6 shadow-sm ${previewTheme?.softClass ?? "from-slate-100 to-white"}`}
          >
            {previewTheme && previewQuestion ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${previewTheme.accentClass}`}>
                      今天想聊 · {previewTheme.label}
                    </p>
                    <h2 className="mt-4 text-2xl font-bold text-foreground">脑脑今天想从这个小场景开口</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">
                      不是抽一题出来做，而是从一个小画面开始，顺着孩子的话慢慢聊。
                    </p>
                  </div>
                  <div className="relative h-16 w-16 overflow-hidden rounded-[20px] bg-white/80 shadow-sm">
                    <Image src={previewTheme.icon} alt={previewTheme.label} fill className="object-contain p-2.5" />
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-sm">
                  <div className="max-w-[92%] rounded-[22px] rounded-tl-md border border-white/80 bg-white/92 px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">脑脑</p>
                    <p className="mt-2">{buildBrainySceneSetup(previewQuestion)}</p>
                  </div>
                  <div className="max-w-[92%] rounded-[22px] rounded-tl-md border border-white/80 bg-white/92 px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">脑脑可能会接着说</p>
                    <p className="mt-2">{buildBrainySceneVoice(previewQuestion)}</p>
                  </div>
                  <div className="ml-auto max-w-[88%] rounded-[22px] rounded-tr-md border border-border/70 bg-accent/10 px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">孩子可能会先这样接</p>
                    <p className="mt-2">{buildPreviewChildLead(previewQuestion.themeId)}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-[24px] border border-white/70 bg-white/80 p-5 text-sm leading-6 text-ink-soft">
                  <p className="font-medium text-foreground">{previewQuestion.title}</p>
                  <p>{buildBrainySceneReason(previewQuestion)}</p>
                  <p className="text-foreground">脑脑大概会这样继续问：{previewQuestion.mainQuestion}</p>
                  <p>{buildPreviewCoachNote(previewQuestion.themeId)}</p>
                  <p>如果孩子卡住，脑脑会给两个更容易开口的方向，而不是直接讲答案。</p>
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 text-sm text-ink-soft">
                脑脑正在准备今天的问题。
              </div>
            )}
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
