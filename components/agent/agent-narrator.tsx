"use client";
/**
 * Task 4 — AgentNarrator 改造
 * 打字机文本 + 对话气泡样式 + useTts Hook + Avatar
 */

import { motion } from "framer-motion";
import { useTts } from "@/hooks/use-tts";
import { TypewriterText } from "./typewriter-text";
import { Avatar } from "./avatar";

interface AgentNarratorProps {
  text: string;
  speakerName?: string;
  voiceRole?: string;
  autoSpeak?: boolean;
  avatarSrc?: string;
  onComplete?: () => void;
}

const roleColors: Record<string, string> = {
  guide: "text-accent",
  opponent: "text-orange-500",
  maker: "text-purple-500",
  storyteller: "text-amber-600",
};

export function AgentNarrator({
  text,
  speakerName,
  voiceRole = "guide",
  autoSpeak = true,
  avatarSrc,
  onComplete,
}: AgentNarratorProps) {
  // TTS 在后台播放，不阻塞聚焦流转
  useTts(text, { voiceRole, speakerName, autoSpeak });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-2"
    >
      <Avatar
        src={avatarSrc ?? "/illustrations/character/robot-happy.png"}
        fallback="🤖"
        size={32}
        className="mt-1"
      />
      <div className="relative max-w-[85%] rounded-[24px] rounded-tl-md border border-border bg-white/90 px-4 py-3 shadow-sm">
        {/* 气泡左上角小三角 */}
        <div className="absolute -left-2 top-3 h-3 w-3 rotate-45 border-b border-l border-border bg-white/90" />
        {speakerName && (
          <p className={`mb-1 text-[11px] font-semibold uppercase tracking-widest ${roleColors[voiceRole] ?? "text-accent"}`}>
            {speakerName}
          </p>
        )}
        <TypewriterText
          key={text}
          text={text}
          speed={55}
          onComplete={onComplete}
          className="text-sm leading-6 text-foreground"
        />
      </div>
    </motion.div>
  );
}
