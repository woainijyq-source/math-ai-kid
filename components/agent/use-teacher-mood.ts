"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getIsSpeaking, subscribeIsSpeaking } from "@/hooks/use-tts";
import { useAgentStore } from "@/store/agent-store";
import type { TeacherMood } from "./teacher-character";

export function useTeacherMood(): { mood: TeacherMood; isSpeaking: boolean } {
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const error = useAgentStore((s) => s.error);
  const activeToolCalls = useAgentStore((s) => s.activeToolCalls);
  const isSpeaking = useSyncExternalStore(
    subscribeIsSpeaking,
    getIsSpeaking,
    () => false,
  );

  return useMemo(() => {
    if (error) return { mood: "surprised" as const, isSpeaking: false };
    if (isStreaming && activeToolCalls.length === 0) {
      return { mood: "thinking" as const, isSpeaking: false };
    }

    const lastTool = activeToolCalls[activeToolCalls.length - 1];
    if (!lastTool) return { mood: "happy" as const, isSpeaking };
    if (lastTool.name === "narrate") return { mood: "happy" as const, isSpeaking };
    if (lastTool.name === "award_badge" || lastTool.name === "end_activity") {
      return { mood: "encouraging" as const, isSpeaking: false };
    }
    if (lastTool.name === "show_choices" || lastTool.name === "show_text_input") {
      return { mood: "playful" as const, isSpeaking: false };
    }

    return { mood: "happy" as const, isSpeaking };
  }, [activeToolCalls, error, isSpeaking, isStreaming]);
}
