"use client";
/**
 * ChatBubble — 统一对话气泡组件
 * AI 气泡左对齐 + 白底，User 气泡右对齐 + accent 底色。
 * 带头像、入场动画、voiceRole 色彩变化。
 */

import { motion } from "framer-motion";
import { Avatar } from "./avatar";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ChatBubbleProps {
  children: React.ReactNode;
  variant: "ai" | "user";
  avatarSrc?: string;
  avatarFallback?: string;
  speakerName?: string;
  voiceRole?: string;
  animated?: boolean;
  dimmed?: boolean;
}

const BUBBLE_ACCENT: Record<string, string> = {
  guide: "border-emerald-200/80",
  opponent: "border-orange-200/80",
  maker: "border-purple-200/80",
  storyteller: "border-amber-200/80",
  parent: "border-blue-200/80",
};

const ROLE_COLORS: Record<string, string> = {
  guide: "text-accent",
  opponent: "text-orange-500",
  maker: "text-purple-500",
  storyteller: "text-amber-600",
  parent: "text-blue-500",
};

export function ChatBubble({
  children,
  variant,
  avatarSrc,
  avatarFallback = variant === "ai" ? "🤖" : "?",
  speakerName,
  voiceRole = "guide",
  animated = true,
  dimmed = false,
}: ChatBubbleProps) {
  const reduced = useReducedMotion();
  const skipAnim = !animated || reduced;

  const isAI = variant === "ai";

  const motionProps = skipAnim
    ? {}
    : {
        initial: { opacity: 0, x: isAI ? -20 : 20 },
        animate: {
          opacity: dimmed ? 0.72 : 1,
          x: 0,
        },
        transition: { duration: 0.3, ease: "easeOut" as const },
      };

  if (isAI) {
    const bubbleClass = BUBBLE_ACCENT[voiceRole] ?? BUBBLE_ACCENT.guide;
    return (
      <motion.div {...motionProps} className="flex items-start gap-3">
        <Avatar
          src={avatarSrc ?? "/illustrations/character/robot-happy.png"}
          fallback={avatarFallback}
          size={36}
          className="bp-avatar-ring mt-1"
        />
        <div className={`bp-chat-bubble bp-chat-bubble-ai max-w-[min(84%,44rem)] px-4 py-3 ${bubbleClass}`}>
          {speakerName && (
            <p className={`mb-1 text-[11px] font-semibold uppercase tracking-widest ${ROLE_COLORS[voiceRole] ?? "text-accent"}`}>
              {speakerName}
            </p>
          )}
          <div className="text-sm leading-6 text-foreground">{children}</div>
        </div>
      </motion.div>
    );
  }

  // User variant
  return (
    <motion.div {...motionProps} className="flex items-start justify-end gap-3">
      <div className="bp-chat-bubble bp-chat-bubble-user max-w-[min(78%,38rem)] px-4 py-3">
        <div className="text-sm leading-6 text-white">{children}</div>
      </div>
      <Avatar
        src={avatarSrc}
        fallback={avatarFallback}
        size={36}
        className="bp-avatar-ring mt-1"
      />
    </motion.div>
  );
}
