"use client";
/**
 * TE.3 — useRobotMood hook
 * 从 agent-store 状态推导 RobotMood；
 * isSpeaking 改为订阅 use-tts 全局信号，确保与真实 TTS 播放同步。
 */

import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { useAgentStore } from "@/store/agent-store";
import { getIsSpeaking, subscribeIsSpeaking } from "@/hooks/use-tts";
import type { RobotMood } from "./robot-character";

export function useRobotMood(): { mood: RobotMood; isSpeaking: boolean } {
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const error = useAgentStore((s) => s.error);
  const activeToolCalls = useAgentStore((s) => s.activeToolCalls);

  // 订阅真实 TTS 播放状态（SSR fallback 为 false）
  const isSpeaking = useSyncExternalStore(
    subscribeIsSpeaking,
    getIsSpeaking,
    () => false,
  );

  return useMemo(() => {
    if (error) return { mood: "surprised" as const, isSpeaking: false };
    if (isStreaming && activeToolCalls.length === 0)
      return { mood: "thinking" as const, isSpeaking: false };

    const lastTool = activeToolCalls[activeToolCalls.length - 1];
    if (!lastTool) return { mood: "happy" as const, isSpeaking };

    if (lastTool.name === "narrate")
      return { mood: "happy" as const, isSpeaking };
    if (lastTool.name === "award_badge")
      return { mood: "encouraging" as const, isSpeaking: false };
    if (lastTool.name === "end_activity")
      return { mood: "encouraging" as const, isSpeaking: false };
    if (lastTool.name === "show_choices" || lastTool.name === "show_text_input")
      return { mood: "playful" as const, isSpeaking: false };

    return { mood: "happy" as const, isSpeaking };
  }, [isStreaming, error, activeToolCalls, isSpeaking]);
}
