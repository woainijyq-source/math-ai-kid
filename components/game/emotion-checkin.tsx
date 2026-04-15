"use client";
/**
 * T5.3 — EmotionCheckin
 * 三个表情按钮：😊开心 / 😕困惑 / 🔄想换个玩法
 */

import { useState } from "react";
import type { InputType, InputMeta } from "@/types/agent";

const EMOTIONS = [
  { id: "happy",   label: "开心",       emoji: "😊" },
  { id: "confused", label: "有点困惑",  emoji: "😕" },
  { id: "switch",  label: "换个玩法",   emoji: "🔄" },
] as const;

interface EmotionCheckinProps {
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function EmotionCheckin({ onSubmit }: EmotionCheckinProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleClick(emotion: (typeof EMOTIONS)[number]) {
    if (selected !== null) return;
    setSelected(emotion.id);
    onSubmit(emotion.label, "emotion", { emotionId: emotion.id });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">现在感觉怎么样？</p>
      <div className="flex gap-3">
        {EMOTIONS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => handleClick(e)}
            disabled={selected !== null}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 py-4 transition ${
              selected === e.id
                ? "border-accent bg-accent/10"
                : selected !== null
                  ? "border-border opacity-40"
                  : "border-border bg-white hover:border-accent"
            } disabled:cursor-not-allowed`}
          >
            <span className="text-3xl">{e.emoji}</span>
            <span className="text-xs text-ink-soft">{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
