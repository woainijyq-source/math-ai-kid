"use client";
/**
 * T3.12 + T7.4 + TE.4 — Session Page 组件
 * 对话历史气泡（AI + User）+ 头像系统 + 动画增强 + 自动滚动
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import { getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { logCompletedSession } from "@/lib/data/client";
import { getDailyQuestion } from "@/lib/daily/select-daily-question";
import { assessAdaptiveConversation } from "@/lib/daily/theme-adaptation";
import { UniversalRenderer } from "@/components/agent/universal-renderer";
import { InputBar } from "@/components/agent/input-bar";
import { TEACHER_AVATAR_SRC, TEACHER_NAME, TeacherCharacter } from "@/components/agent/teacher-character";
import { useTeacherMood } from "@/components/agent/use-teacher-mood";
import { ChatBubble } from "@/components/agent/chat-bubble";
import { Avatar } from "@/components/agent/avatar";
import { AvatarPicker } from "@/components/agent/avatar-picker";
import { ImageSlot } from "@/components/agent/image-slot";
import { useIsClient } from "@/hooks/use-is-client";
import { primeAudioPlayback, useAudioUnlockPrompt } from "@/hooks/use-tts";
import type { InputType, InputMeta, ToolCallResult } from "@/types/agent";
import type { DailyThemeId } from "@/types/daily";

const BG_MAP: Record<string, string> = {
  "math-thinking":         "/illustrations/backgrounds/math.png",
  "logical-reasoning":     "/illustrations/backgrounds/logic.png",
  "creative-thinking":     "/illustrations/backgrounds/creative.png",
  "language-thinking":     "/illustrations/backgrounds/language.png",
  "strategy-thinking":     "/illustrations/backgrounds/logic.png",
  "observation-induction": "/illustrations/backgrounds/general.png",
};

const INLINE_INPUT_TOOLS = new Set([
  "show_choices",
  "show_text_input",
  "request_voice",
  "show_number_input",
  "request_photo",
  "show_emotion_checkin",
  "request_camera",
  "show_drawing_canvas",
  "show_drag_board",
]);

// ---------------------------------------------------------------------------
// 创建档案表单（含头像选择）
// ---------------------------------------------------------------------------

function CreateProfileForm({ onCreated }: { onCreated: () => void }) {
  const createProfile = useProfileStore((s) => s.createProfile);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const [nickname, setNickname] = useState("");
  const [birthday, setBirthday] = useState("2016-01-01");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    const profile = createProfile(nickname.trim(), birthday, avatarDataUrl || undefined);
    setActiveProfile(profile.id);
    onCreated();
  }

  return (
    <div className="brainplay-page flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex justify-center">
          <Image
            src={TEACHER_AVATAR_SRC}
            alt={TEACHER_NAME}
            width={96}
            height={96}
            className="rounded-3xl shadow-lg"
          />
        </div>
        <form
          onSubmit={handleSubmit}
          className="bp-panel space-y-4 rounded-[32px] p-8"
        >
          <h1 className="text-2xl font-bold text-foreground">先告诉{TEACHER_NAME}你叫什么</h1>
          <p className="text-sm text-ink-soft">第一次见面前，先做一个小档案，{TEACHER_NAME}就能记住你喜欢怎么聊。</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="你的昵称"
            className="bp-field w-full px-4 py-3 text-sm"
            autoFocus
          />
          <AvatarPicker value={avatarDataUrl} onChange={setAvatarDataUrl} />
          <div className="space-y-1">
            <label className="text-xs text-ink-soft">生日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="bp-field w-full px-4 py-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="bp-button-primary w-full py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
          >
            开始今天的小聊天
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 思考动画（带气泡样式）
// ---------------------------------------------------------------------------

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <ChatBubble variant="ai" speakerName={TEACHER_NAME}>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block h-2 w-2 rounded-full bg-accent"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </ChatBubble>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Session Page
// ---------------------------------------------------------------------------

export function SessionPage({
  initialGoal,
  initialThemeId,
  initialQuestionId,
}: {
  initialGoal?: string;
  initialThemeId?: DailyThemeId;
  initialQuestionId?: string;
}) {
  const activeProfile = useProfileStore((s) => s.getActiveProfile());
  const {
    sessionId,
    requestedThemeId,
    requestedQuestionId,
    currentThemeId,
    currentQuestionId,
    activeToolCalls,
    pendingInputType,
    isStreaming,
    error,
    conversation,
    sessionComplete,
    sessionSummary,
    startSession,
    sendTurn,
    reset,
  } =
    useAgentStore();
  const [forceCreateForm, setForceCreateForm] = useState(false);
  const [isReviewingHistory, setIsReviewingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const isClient = useIsClient();
  const { mood, isSpeaking } = useTeacherMood();
  const { unlockNeeded, unlockAndReplay } = useAudioUnlockPrompt();
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const showCreateForm = !activeProfile || forceCreateForm;
  const historyMessages = useMemo<Array<{ role: string; content?: string; toolCalls?: ToolCallResult[] }>>(() => {
    const messages: Array<{ role: string; content?: string; toolCalls?: ToolCallResult[] }> = [];
    if (!conversation.length) return messages;

    let lastAssistantIdx = -1;
    for (let i = conversation.length - 1; i >= 0; i -= 1) {
      if (conversation[i].role === "assistant" || conversation[i].role === "tool") {
        lastAssistantIdx = i;
        break;
      }
    }

    for (let i = 0; i < conversation.length; i += 1) {
      const msg = conversation[i];
      if (i >= lastAssistantIdx) continue;
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        messages.push({ role: "assistant", toolCalls: msg.toolCalls as ToolCallResult[] | undefined });
      }
    }

    return messages;
  }, [conversation]);

  useEffect(() => {
    if (!isClient || !activeProfile) return;
    const goals = initialGoal ? [initialGoal] : activeProfile.goalPreferences;
    const goalKey = goals[0] ?? "";
    const currentGoalFocus = useAgentStore.getState().currentGoalFocus;
    const sessionGoalKey = currentGoalFocus[0] ?? "";
    if (
      sessionId && (
        (goalKey && sessionGoalKey !== goalKey) ||
        (requestedThemeId ?? null) !== (initialThemeId ?? null) ||
        (requestedQuestionId ?? null) !== (initialQuestionId ?? null)
      )
    ) {
      reset();
      return;
    }
    if (!sessionId && !isStreaming) {
      startSession(activeProfile.id, goals, activeProfile, {
        themeId: initialThemeId,
        questionId: initialQuestionId,
      });
    }
  }, [
    isClient,
    activeProfile,
    sessionId,
    isStreaming,
    startSession,
    reset,
    initialGoal,
    initialThemeId,
    initialQuestionId,
    requestedThemeId,
    requestedQuestionId,
    currentThemeId,
    currentQuestionId,
  ]);

  useEffect(() => {
    if (!isClient) return;

    const handleUserGesture = () => {
      void primeAudioPlayback();
    };

    window.addEventListener("pointerdown", handleUserGesture, { passive: true });
    window.addEventListener("keydown", handleUserGesture);
    window.addEventListener("touchstart", handleUserGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleUserGesture);
      window.removeEventListener("keydown", handleUserGesture);
      window.removeEventListener("touchstart", handleUserGesture);
    };
  }, [isClient]);

  // 新内容出现时自动滚动（延迟 100ms 等动画开始）
  useEffect(() => {
    if (!isClient || isReviewingHistory || !shouldAutoScrollRef.current) return;

    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeToolCalls, conversation, isClient, isReviewingHistory]);

  useEffect(() => {
    if (!isClient) return;

    let lastY = window.scrollY;
    let lastTouchY: number | null = null;
    const isNearBottom = () => {
      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      return scrollBottom >= docHeight - 140;
    };

    const handleScroll = () => {
      const currentY = window.scrollY;
      const deltaY = currentY - lastY;
      const nearBottom = isNearBottom();

      if (deltaY < -4 && !nearBottom) {
        shouldAutoScrollRef.current = false;
        setIsReviewingHistory(true);
      } else if (nearBottom || deltaY > 8) {
        shouldAutoScrollRef.current = true;
        setIsReviewingHistory(false);
      }

      lastY = currentY;
    };

    const pauseAutoScrollForUpwardIntent = () => {
      shouldAutoScrollRef.current = false;
      setIsReviewingHistory(true);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < -2) {
        pauseAutoScrollForUpwardIntent();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentTouchY = event.touches[0]?.clientY ?? null;
      if (lastTouchY !== null && currentTouchY !== null && currentTouchY > lastTouchY + 4) {
        pauseAutoScrollForUpwardIntent();
      }
      lastTouchY = currentTouchY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isClient]);

  function handleUserInput(input: string, type: InputType, meta?: InputMeta) {
    setShowHistory(false);
    sendTurn(input, type, meta);
  }

  // 重启会话：重置 store 后重新启动
  function handleRestart() {
    if (!activeProfile) return;
    reset();
    const goals = initialGoal ? [initialGoal] : activeProfile.goalPreferences;
    startSession(activeProfile.id, goals, activeProfile, {
      themeId: initialThemeId ?? currentThemeId ?? undefined,
      questionId: currentQuestionId ?? initialQuestionId ?? undefined,
    });
  }

  // 会话结束时写入 session_logs 表（防重入）
  const loggedRef = useRef(false);
  useEffect(() => {
    loggedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionComplete || !sessionSummary) return;
    if (loggedRef.current) return;
    loggedRef.current = true;

    const badgeHighlights = conversation
      .flatMap((msg) => msg.toolCalls ?? [])
      .filter((call) => call.name === "award_badge")
      .map((call) => {
        const args = call.arguments as { label?: string; title?: string; detail?: string };
        return args.label ?? args.title ?? args.detail ?? "";
      });
    const childLines = conversation
      .filter((message) => message.role === "user")
      .map((message) => message.content?.trim() ?? "")
      .filter(Boolean);
    const latestChildLine = childLines.at(-1);
    const highlights = [
      ...(latestChildLine ? [`她说：“${latestChildLine.slice(0, 42)}${latestChildLine.length > 42 ? "..." : ""}”`] : []),
      ...badgeHighlights,
    ].filter(Boolean).slice(0, 4);

    const completedThemeId = currentThemeId ?? initialThemeId;
    const completedQuestionId = currentQuestionId ?? initialQuestionId;
    const completedQuestion = getDailyQuestion(completedQuestionId);
    const mathEvidence = completedQuestion && completedThemeId
      ? assessAdaptiveConversation(completedQuestion, conversation)
      : undefined;
    const completedTitle = completedQuestion?.title ?? "刚才那个小问题";
    const completionSummary = sessionSummary.summary?.trim()
      ? sessionSummary.summary.trim()
      : `今天围绕“${completedTitle}”聊了一小段，${TEACHER_NAME}记住了她愿意把想法说出来。`;

    logCompletedSession({
      profileId: activeProfile?.id,
      mode: "story",
      taskId: completedQuestionId ?? activeProfile?.goalPreferences[0] ?? "math-thinking",
      title: (completedQuestion?.title ?? completionSummary).slice(0, 30),
      completion: completionSummary,
      highlights,
      rewardSignals: [],
      mathEvidence,
    }).catch((err) => console.error("[session-page] logCompletedSession failed", err));
  }, [
    activeProfile?.goalPreferences,
    activeProfile?.id,
    conversation,
    currentThemeId,
    currentQuestionId,
    initialThemeId,
    initialQuestionId,
    sessionComplete,
    sessionSummary,
    sessionId,
  ]);

  if (!isClient) return null;

  if (showCreateForm && !activeProfile) {
    return <CreateProfileForm onCreated={() => setForceCreateForm(false)} />;
  }

  const goalFocus = initialGoal ? [initialGoal] : (activeProfile?.goalPreferences ?? []);
  const bgImage = BG_MAP[goalFocus[0] ?? ""] ?? "/illustrations/backgrounds/general.png";
  const userAvatarSrc = activeProfile?.avatarDataUrl;
  const userNickname = activeProfile?.nickname ?? "?";
  const activeThemeId = currentThemeId ?? initialThemeId ?? undefined;
  const activeQuestionId = currentQuestionId ?? initialQuestionId ?? undefined;
  const activeTheme = getDailyThemeDefinition(activeThemeId);
  const activeQuestion = getDailyQuestion(activeQuestionId);
  const hasInlineInput = activeToolCalls.some((call) => INLINE_INPUT_TOOLS.has(call.name));
  const hideBottomInput = isStreaming || hasInlineInput;

  const visibleHistoryMessages = showHistory ? historyMessages : historyMessages.slice(-3);
  const hiddenHistoryCount = Math.max(0, historyMessages.length - visibleHistoryMessages.length);
  const userTurnCount = conversation.filter((message) => message.role === "user").length;
  const stageProgress = Math.min(3, Math.max(1, userTurnCount + (hasInlineInput ? 1 : 0)));
  const latestUserLine = [...conversation]
    .reverse()
    .find((message) => message.role === "user" && message.content?.trim())?.content?.trim();
  const stageTitle = activeQuestion?.title ?? activeTheme?.label ?? "今天的小聊天";
  const stageLead = activeQuestion?.sceneSetup ?? activeTheme?.summary ?? `${TEACHER_NAME}正在准备今天的小问题。`;
  const stageQuestion = activeQuestion?.mainQuestion ?? "先说一句你刚想到的想法。";

  return (
    <div
      className="brainplay-page bp-stage-page"
    >
      <div
        className={`bp-stage-backdrop ${hasInlineInput ? "bp-stage-backdrop-focus" : ""}`}
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bp-stage-topbar"
      >
        <div className="flex items-center gap-3">
          <div className="bp-brand">
            <Image
              src={TEACHER_AVATAR_SRC}
              alt={TEACHER_NAME}
              width={40}
              height={40}
              className="bp-brand-mark p-1"
            />
            <div>
              <span className="text-sm font-black text-foreground">BrainPlay</span>
              <p className="hidden text-[11px] text-ink-soft sm:block">{TEACHER_NAME}陪聊中</p>
            </div>
          </div>
        </div>

        <div className="bp-stage-status">
          {activeTheme && (
            <span className={`bp-stage-theme-pill ${activeTheme.accentClass}`}>
              {activeTheme.shortLabel}
            </span>
          )}
          <span className="bp-stage-progress">{stageProgress} / 3 小选择</span>
          {activeProfile && (
            <span className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-foreground shadow-sm sm:inline-flex">
              <Avatar src={userAvatarSrc} fallback={userNickname[0]} size={22} className="bp-avatar-ring" />
              {userNickname}
            </span>
          )}
          <Link href="/" className="bp-button-secondary px-3 py-2 text-xs">首页</Link>
        </div>
      </motion.div>

      <main className="bp-stage-shell">
        <section className={`bp-stage-world ${hasInlineInput ? "bp-stage-world-muted" : ""}`}>
          <div className="bp-stage-world-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="bp-kicker">Today</p>
                <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                  {stageTitle}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-ink-soft">{stageLead}</p>
              </div>
              {activeTheme && (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[24px] border border-white/70 bg-white/82 shadow-sm">
                  <Image src={activeTheme.icon} alt="" fill className="object-contain p-3" />
                </div>
              )}
            </div>

            <div className="bp-stage-clues" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="bp-stage-question">
              <p>{stageQuestion}</p>
            </div>

            {latestUserLine && (
              <div className="bp-stage-trace">
                <span>刚才你说</span>
                <strong>{latestUserLine}</strong>
              </div>
            )}
          </div>
        </section>

        <div className="bp-stage-character">
          <TeacherCharacter mood={mood} isSpeaking={isSpeaking} size="large" />
          <div className="bp-stage-character-shadow" />
        </div>

        <section className={`bp-stage-live ${hasInlineInput ? "bp-stage-live-focus" : ""}`}>
          <div className="bp-stage-live-header">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Live</p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {hasInlineInput ? "轮到你啦" : isStreaming ? `${TEACHER_NAME}正在想` : `${TEACHER_NAME}在这里接话`}
              </p>
            </div>
            {(showHistory || hiddenHistoryCount > 0) && (
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-sm hover:text-accent"
              >
                {showHistory ? "收起回看" : `回看 ${historyMessages.length} 条`}
              </button>
            )}
          </div>

          {showHistory && historyMessages.length > 0 && (
            <div className="bp-stage-history soft-scroller">
              {visibleHistoryMessages.map((msg, idx) => (
                <div key={`history-${idx}`} className="bp-stage-history-row">
                  {msg.role === "user" ? (
                    <ChatBubble
                      variant="user"
                      avatarSrc={userAvatarSrc}
                      avatarFallback={userNickname[0]}
                      animated={false}
                    >
                      {msg.content ?? ""}
                    </ChatBubble>
                  ) : (
                    <HistoryAIBubble toolCalls={msg.toolCalls} dimmed />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bp-stage-renderer">
            <AnimatePresence mode="popLayout">
                {activeToolCalls.length > 0 && (
                  <motion.div
                    key="renderer"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.4 }}
                  >
                    <UniversalRenderer
                      toolCalls={activeToolCalls}
                      onUserInput={handleUserInput}
                    />
                  </motion.div>
                )}

                {isStreaming && activeToolCalls.length === 0 && (
                  <ThinkingIndicator key="thinking" />
                )}

                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3"
                  >
                    <p className="text-sm text-red-600">出了点问题：{error}</p>
                    <button
                      type="button"
                      onClick={() => activeProfile && startSession(activeProfile.id, activeProfile.goalPreferences, activeProfile, {
                        themeId: initialThemeId ?? currentThemeId ?? undefined,
                        questionId: currentQuestionId ?? initialQuestionId ?? undefined,
                      })}
                      className="mt-2 text-xs font-bold text-accent underline"
                    >
                      重试
                    </button>
                  </motion.div>
                )}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </section>
      </main>

      {/* 会话结束完成卡片 */}
      {sessionComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/38 p-6 backdrop-blur-md"
        >
          <div className="bp-panel w-full max-w-lg rounded-[40px] p-7 text-center sm:p-8">
            <p className="bp-chip mb-4 px-3 py-1.5">Session Saved</p>
            <Image
              src={TEACHER_AVATAR_SRC}
              alt={TEACHER_NAME}
              width={92}
              height={92}
              className="mx-auto mb-4 rounded-[26px] shadow-sm"
            />
            <h2 className="mb-2 text-3xl font-black leading-tight tracking-tight text-foreground">{TEACHER_NAME}先把今天这段小聊天装进口袋里</h2>
            {sessionSummary?.summary && (
              <p className="mb-5 text-sm leading-6 text-ink-soft">{sessionSummary.summary}</p>
            )}
            <div className="mb-6 grid gap-3 text-left sm:grid-cols-2">
              <div className="bp-stat p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊到</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{activeQuestion?.title ?? "刚才那个小问题"}</p>
              </div>
              <div className="bp-stat p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">{TEACHER_NAME}记住了</p>
                <p className="mt-2 text-sm text-foreground">{activeTheme ? `你今天愿意围着“${activeTheme.label}”多想半步。` : "你刚才愿意把自己的想法说出来。"}</p>
              </div>
            </div>
            {typeof sessionSummary?.completionRate === "number" && (
              <p className="mb-6 text-xs text-ink-soft">
                这一轮已经差不多聊到尾声了（{Math.round(sessionSummary.completionRate * 100)}%）。
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Link
                href="/rewards"
                className="bp-button-primary w-full py-3 text-sm"
              >
                看看今天留下什么小变化
              </Link>
              <button
                type="button"
                onClick={handleRestart}
                className="bp-button-secondary w-full py-3 text-sm"
              >
                再聊一个小问题
              </button>
              <Link
                href="/"
                className="w-full rounded-2xl py-3 text-center text-sm font-semibold text-ink-soft transition hover:text-foreground"
              >
                回到首页
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {unlockNeeded && !sessionComplete && (
        <button
          type="button"
          onClick={() => void unlockAndReplay()}
          className="fixed bottom-36 right-4 z-50 rounded-full border border-accent/18 bg-accent px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-accent-strong"
        >
          打开声音
        </button>
      )}

      {/* 底部输入栏（会话结束时隐藏） */}
      {!sessionComplete && (
        <InputBar
          pendingInputType={pendingInputType}
          hidden={hideBottomInput}
          onSubmit={handleUserInput}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI 历史气泡
// ---------------------------------------------------------------------------

function HistoryAIBubble({
  toolCalls,
  dimmed = true,
}: {
  toolCalls?: ToolCallResult[];
  dimmed?: boolean;
}) {
  const imageCalls = (toolCalls ?? []).filter((tc) => tc.name === "show_image");
  const narrateTexts = (toolCalls ?? [])
    .filter((tc) => tc.name === "narrate")
    .map((tc) => (tc.arguments as { text?: string })?.text)
    .filter((t): t is string => Boolean(t));

  if (imageCalls.length === 0 && narrateTexts.length === 0) return null;

  return (
    <div className="space-y-3">
      {imageCalls.map((tc) => {
        const args = tc.arguments as { alt?: string; imageUrl?: string; generatePrompt?: string };
        return (
          <div
            key={tc.id}
            className="transition-opacity duration-200"
            style={{ opacity: dimmed ? 0.72 : 1 }}
          >
            <ImageSlot
              alt={args.alt ?? ""}
              imageUrl={args.imageUrl}
              generatePrompt={args.generatePrompt}
            />
          </div>
        );
      })}
      {narrateTexts.length > 0 && (
        <ChatBubble variant="ai" speakerName={TEACHER_NAME} dimmed={dimmed}>
          {narrateTexts.join(" ")}
        </ChatBubble>
      )}
    </div>
  );
}
