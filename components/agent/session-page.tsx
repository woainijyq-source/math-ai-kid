"use client";
/**
 * T3.12 + T7.4 + TE.4 — Session Page 组件
 * 对话历史气泡（AI + User）+ 头像系统 + 动画增强 + 自动滚动
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import { getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { logCompletedSession } from "@/lib/data/client";
import { buildBrainySceneReason, buildBrainySceneSetup, buildBrainySceneVoice } from "@/lib/daily/brainy-voice";
import { getDailyQuestion } from "@/lib/daily/select-daily-question";
import { assessAdaptiveConversation } from "@/lib/daily/theme-adaptation";
import { UniversalRenderer } from "@/components/agent/universal-renderer";
import { InputBar } from "@/components/agent/input-bar";
import { RobotCharacter } from "@/components/agent/robot-character";
import { useRobotMood } from "@/components/agent/use-robot-mood";
import { ChatBubble } from "@/components/agent/chat-bubble";
import { Avatar } from "@/components/agent/avatar";
import { AvatarPicker } from "@/components/agent/avatar-picker";
import { ImageSlot } from "@/components/agent/image-slot";
import { useIsClient } from "@/hooks/use-is-client";
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

interface ContinuitySnapshot {
  label: string;
  questionTitle: string;
  themeLabel?: string;
  childThinking?: string;
  memoryLine: string;
  gentleOpen: string;
  createdAt: string;
}

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FFF7ED] to-[#F3E8FF] p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex justify-center">
          <Image
            src="/illustrations/character/robot-happy.png"
            alt="脑脑"
            width={96}
            height={96}
            className="rounded-3xl shadow-lg"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/illustrations/character/brainy-happy.png"; }}
          />
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-border bg-white/90 p-8 shadow-xl backdrop-blur-sm"
        >
          <h1 className="text-2xl font-bold text-foreground">先告诉脑脑你叫什么</h1>
          <p className="text-sm text-ink-soft">第一次见面前，先做一个小档案，脑脑就能记住你喜欢怎么聊。</p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="你的昵称"
            className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-accent"
            autoFocus
          />
          <AvatarPicker value={avatarDataUrl} onChange={setAvatarDataUrl} />
          <div className="space-y-1">
            <label className="text-xs text-ink-soft">生日</label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-40"
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
      <ChatBubble variant="ai" speakerName="脑脑">
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
  const { sessionId, currentThemeId, currentQuestionId, activeToolCalls, pendingInputType, isStreaming, error, conversation, sessionComplete, sessionSummary, startSession, sendTurn, reset } =
    useAgentStore();
  const [forceCreateForm, setForceCreateForm] = useState(false);
  const [isReviewingHistory, setIsReviewingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [continuitySnapshot, setContinuitySnapshot] = useState<ContinuitySnapshot | null>(null);
  const isClient = useIsClient();
  const { mood, isSpeaking } = useRobotMood();
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const showCreateForm = !activeProfile || forceCreateForm;

  useEffect(() => {
    if (!isClient || !activeProfile) return;
    const goals = initialGoal ? [initialGoal] : activeProfile.goalPreferences;
    const goalKey = goals[0] ?? "";
    const currentGoalFocus = useAgentStore.getState().currentGoalFocus;
    const sessionGoalKey = currentGoalFocus[0] ?? "";
    if (
      sessionId && (
        (goalKey && sessionGoalKey !== goalKey) ||
        (initialThemeId && currentThemeId !== initialThemeId) ||
        (initialQuestionId && currentQuestionId !== initialQuestionId)
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
    currentThemeId,
    currentQuestionId,
  ]);

  useEffect(() => {
    if (!activeProfile || !(currentThemeId ?? initialThemeId)) {
      return;
    }

    let cancelled = false;
    fetch(`/api/continuity/latest?profileId=${activeProfile.id}&theme=${currentThemeId ?? initialThemeId}`)
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
  }, [activeProfile, currentThemeId, initialThemeId]);

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

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
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
      questionId: initialQuestionId ?? currentQuestionId ?? undefined,
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

    logCompletedSession({
      profileId: activeProfile?.id,
      mode: "story",
      taskId: completedQuestionId ?? activeProfile?.goalPreferences[0] ?? "math-thinking",
      title: (completedQuestion?.title ?? sessionSummary.summary).slice(0, 30),
      completion: String(sessionSummary.completionRate ?? 1),
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

  // 从 conversation 提取历史消息（排除最后一条 assistant，由 UniversalRenderer 渲染）
  const historyMessages: Array<{ role: string; content?: string; toolCalls?: ToolCallResult[] }> = [];
  if (conversation && conversation.length > 0) {
    let lastAssistantIdx = -1;
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === "assistant" || conversation[i].role === "tool") {
        lastAssistantIdx = i;
        break;
      }
    }
    for (let i = 0; i < conversation.length; i++) {
      const msg = conversation[i];
      if (i >= lastAssistantIdx) continue;
      if (msg.role === "user") {
        historyMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        historyMessages.push({ role: "assistant", toolCalls: msg.toolCalls as ToolCallResult[] | undefined });
      }
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 顶部栏 */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/90 px-4 py-2 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2">
          <Image
            src="/illustrations/character/robot-happy.png"
            alt="脑脑"
            width={32}
            height={32}
            className="rounded-full"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/illustrations/character/brainy-happy.png"; }}
          />
          <span className="text-sm font-semibold text-foreground">脑脑</span>
        </div>
        <div className="flex items-center gap-3">
          {activeProfile && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={userAvatarSrc}
                fallback={userNickname[0]}
                size={24}
              />
              <span className="text-xs text-ink-soft">{userNickname}</span>
            </div>
          )}
          <Link href="/" className="text-xs text-ink-soft hover:text-accent">首页</Link>
          <button
            type="button"
            onClick={() => {
              reset();
              useProfileStore.getState().setActiveProfile(null);
              setForceCreateForm(true);
            }}
            className="text-xs text-ink-soft underline hover:text-accent"
          >
            重置
          </button>
        </div>
      </motion.div>

      {/* 桌面端：左侧机器人 */}
      <div className="pointer-events-none fixed bottom-24 left-4 z-20 hidden lg:block drop-shadow-lg">
        <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="large" />
      </div>

      {/* 移动端：左下角小机器人 */}
      <div className="pointer-events-none fixed bottom-20 left-2 z-20 lg:hidden">
        <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="small" />
      </div>

      {/* 主内容区 */}
      <div className="lg:ml-64">
        <div className="mx-auto max-w-2xl space-y-4 px-4 pb-32 pt-6">
          {activeQuestion && activeTheme && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-white/80 bg-white/88 px-5 py-5 shadow-sm backdrop-blur-sm"
            >
              <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${activeTheme.accentClass}`}>
                今天想聊 · {activeTheme.label}
              </p>
              <h1 className="mt-3 text-xl font-bold text-foreground">{activeQuestion.title}</h1>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{buildBrainySceneSetup(activeQuestion)}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{buildBrainySceneVoice(activeQuestion)}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{buildBrainySceneReason(activeQuestion)}</p>
              {continuitySnapshot && (
                <p className="mt-3 rounded-2xl bg-accent/8 px-4 py-3 text-sm leading-6 text-foreground">
                  脑脑还记得：{continuitySnapshot.gentleOpen}
                </p>
              )}
              <p className="mt-2 text-sm leading-6 text-ink-soft">这一轮不急着答对，先把你想到的告诉脑脑，它会顺着你的话继续聊。</p>
            </motion.div>
          )}

          {historyMessages.length > 0 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowHistory((value) => !value)}
                className="rounded-full border border-border/70 bg-white/80 px-4 py-2 text-xs font-semibold text-ink-soft transition hover:border-accent/40 hover:text-foreground"
              >
                {showHistory ? "收起刚才的小聊天" : "看看刚才聊到哪了"}
              </button>
            </div>
          )}

          {/* 历史对话气泡（默认折叠） */}
          {showHistory && historyMessages.length > 0 && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              className="space-y-3"
            >
              {historyMessages.map((msg, idx) => (
                <motion.div
                  key={`history-${idx}`}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  {msg.role === "user" ? (
                    <ChatBubble
                      variant="user"
                      avatarSrc={userAvatarSrc}
                      avatarFallback={userNickname[0]}
                      dimmed={!isReviewingHistory}
                    >
                      {msg.content ?? ""}
                    </ChatBubble>
                  ) : (
                    <HistoryAIBubble
                      toolCalls={msg.toolCalls}
                      dimmed={!isReviewingHistory}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

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
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"
              >
                <p className="text-sm text-red-600">出了点问题：{error}</p>
                <button
                  type="button"
                  onClick={() => activeProfile && startSession(activeProfile.id, activeProfile.goalPreferences, activeProfile, {
                    themeId: initialThemeId ?? currentThemeId ?? undefined,
                    questionId: initialQuestionId ?? currentQuestionId ?? undefined,
                  })}
                  className="mt-2 text-xs text-accent underline"
                >
                  重试
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 自动滚动锚点 */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 会话结束完成卡片 */}
      {sessionComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
        >
          <div className="w-full max-w-md rounded-3xl border border-border bg-white/95 p-8 text-center shadow-2xl">
            <div className="text-6xl mb-4">🌤️</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">脑脑先把今天这段小聊天装进口袋里</h2>
            {sessionSummary?.summary && (
              <p className="text-sm text-ink-soft mb-5">{sessionSummary.summary}</p>
            )}
            <div className="mb-6 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">今天聊到</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{activeQuestion?.title ?? "刚才那个小问题"}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">脑脑记住了</p>
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
                className="w-full rounded-2xl bg-accent py-3 text-center text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                看看今天留下什么小变化
              </Link>
              <button
                type="button"
                onClick={handleRestart}
                className="w-full rounded-2xl border border-border bg-white py-3 text-sm font-semibold text-foreground transition hover:bg-accent/5"
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

      {/* 底部输入栏（会话结束时隐藏） */}
      {!sessionComplete && (
        <InputBar
          pendingInputType={pendingInputType}
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
        <ChatBubble variant="ai" speakerName="脑脑" dimmed={dimmed}>
          {narrateTexts.join(" ")}
        </ChatBubble>
      )}
    </div>
  );
}
