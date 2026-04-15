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
  guide: "border-emerald-200 bg-white/90",
  opponent: "border-orange-200 bg-orange-50/80",
  maker: "border-purple-200 bg-purple-50/80",
  storyteller: "border-amber-200 bg-amber-50/80",
  parent: "border-blue-200 bg-blue-50/80",
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
      <motion.div {...motionProps} className="flex items-start gap-2">
        <Avatar
          src={avatarSrc ?? "/illustrations/character/robot-happy.png"}
          fallback={avatarFallback}
          size={32}
          className="mt-1"
        />
        <div className={`relative max-w-[80%] rounded-[24px] rounded-tl-md border px-4 py-3 shadow-sm ${bubbleClass}`}>
          {/* 三角缺口 */}
          <div className="absolute -left-2 top-3 h-3 w-3 rotate-45 border-b border-l border-inherit bg-inherit" />
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
    <motion.div {...motionProps} className="flex items-start justify-end gap-2">
      <div className="relative max-w-[75%] rounded-[24px] rounded-tr-md bg-accent px-4 py-3 shadow-sm">
        {/* 右侧三角缺口 */}
        <div className="absolute -right-2 top-3 h-3 w-3 rotate-45 border-r border-t border-accent bg-accent" />
        <div className="text-sm text-white">{children}</div>
      </div>
      <Avatar
        src={avatarSrc}
        fallback={avatarFallback}
        size={32}
        className="mt-1"
      />
    </motion.div>
  );
}
