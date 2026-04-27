"use client";
/**
 * Task 4 — AgentNarrator 改造
 * 打字机文本 + 对话气泡样式 + useTts Hook + Avatar
 */

import { motion } from "framer-motion";
import { useTts } from "@/hooks/use-tts";
import { TypewriterText } from "./typewriter-text";
import { Avatar } from "./avatar";
import { TEACHER_AVATAR_SRC } from "./teacher-character";

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
      className="bp-teacher-line"
    >
      <Avatar
        src={avatarSrc ?? TEACHER_AVATAR_SRC}
        fallback="师"
        size={86}
        className="bp-teacher-avatar"
      />
      <div className="bp-teacher-bubble">
        <div className="bp-teacher-bubble-head">
          <p className={`bp-teacher-name ${roleColors[voiceRole] ?? "text-accent"}`}>
            {speakerName ?? "林老师"}
          </p>
          <span className="bp-teacher-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>
        <TypewriterText
          key={text}
          text={text}
          speed={55}
          onComplete={onComplete}
          className="bp-teacher-bubble-text"
        />
      </div>
    </motion.div>
  );
}
