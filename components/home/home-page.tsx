"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { DAILY_THEME_DEFINITIONS } from "@/content/daily/theme-definitions";
import { getDefaultDailyThemeId } from "@/lib/daily/select-daily-question";
import { useIsClient } from "@/hooks/use-is-client";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import { TEACHER_AVATAR_SRC, TEACHER_NAME, TeacherCharacter } from "@/components/agent/teacher-character";
import type { DailyThemeId } from "@/types/daily";

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

function buildThemeHref(themeId: DailyThemeId) {
  return buildSessionHref({
    themeId,
  });
}

export function HomePage() {
  const activeProfile = useProfileStore((state) => state.getActiveProfile());
  const sessionId = useAgentStore((state) => state.sessionId);
  const currentThemeId = useAgentStore((state) => state.currentThemeId);
  const isClient = useIsClient();

  const profile = isClient ? activeProfile : null;
  const hasSession = isClient ? Boolean(sessionId) : false;
  const todayKey = new Date().toISOString().slice(0, 10);
  const defaultThemeId = currentThemeId ?? getDefaultDailyThemeId(todayKey);
  const recommendedTheme = DAILY_THEME_DEFINITIONS.find((theme) => theme.id === defaultThemeId) ?? DAILY_THEME_DEFINITIONS[0];
  const primaryHref = hasSession
    ? buildSessionHref({ themeId: currentThemeId })
    : buildSessionHref({
        themeId: defaultThemeId,
      });

  return (
    <div className="brainplay-page bp-home-page">
      <header className="brainplay-shell bp-nav">
        <div className="bp-brand">
          <Image
            src={TEACHER_AVATAR_SRC}
            alt={TEACHER_NAME}
            width={48}
            height={48}
            className="bp-brand-mark object-cover p-1"
          />
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-accent">BrainPlay</p>
            <p className="truncate text-sm text-ink-soft">每天 5 分钟陪聊</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="hidden rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-semibold text-foreground shadow-sm sm:inline">
              {profile.nickname}
            </span>
          )}
          <Link href="/parent" className="bp-button-secondary px-4 py-2 text-sm">
            家长简报
          </Link>
        </div>
      </header>

      <main className="brainplay-shell bp-home-main">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="bp-home-stage"
        >
          <div className="bp-home-copy">
            <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-black ${recommendedTheme.accentClass}`}>
              今日推荐：{recommendedTheme.label}
            </span>
            <h1 className="bp-home-title">
              {profile ? `${profile.nickname}，今天聊 5 分钟。` : "今天聊 5 分钟。"}
            </h1>
            <p className="bp-home-subtitle">
              {recommendedTheme.summary} {TEACHER_NAME}会先听你说，再顺着你的想法追半步。
            </p>

            <div className="bp-home-actions">
              <Link href={primaryHref} className="bp-button-primary px-9 py-4 text-base">
                {hasSession ? "继续刚才的小聊天" : "开始今天的小聊天"}
              </Link>
              <details className="bp-theme-switcher">
                <summary>换一个主题</summary>
                <div className="bp-theme-switcher-menu">
                  {DAILY_THEME_DEFINITIONS.map((theme) => (
                    <Link
                      key={theme.id}
                      href={buildThemeHref(theme.id)}
                      className={`bp-theme-mini ${theme.id === recommendedTheme.id ? "bp-theme-mini-active" : ""}`}
                    >
                      <span className="relative h-9 w-9 overflow-hidden rounded-2xl bg-white/82 shadow-sm">
                        <Image src={theme.icon} alt="" fill className="object-contain p-2" />
                      </span>
                      <span>{theme.label}</span>
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="bp-home-teacher"
          >
            <div className="bp-home-orbit" />
            <div className="bp-home-teacher-animation">
              <TeacherCharacter mood="encouraging" isSpeaking={false} size="large" />
            </div>
            <div className="bp-home-speech">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{TEACHER_NAME}</p>
              <p className="mt-2 text-lg font-black text-foreground">我先听你想到的第一句。</p>
            </div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
