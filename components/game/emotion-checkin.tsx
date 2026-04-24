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
      <p className="text-sm font-bold text-foreground">现在感觉怎么样？</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {EMOTIONS.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => handleClick(e)}
            disabled={selected !== null}
            className={`bp-theme-card flex flex-col items-center gap-2 px-4 py-5 transition ${
              selected === e.id
                ? "border-accent bg-accent/10 ring-2 ring-accent/15"
                : selected !== null
                  ? "opacity-40"
                  : "hover:border-accent/50"
            } disabled:cursor-not-allowed`}
          >
            <span className="text-3xl">{e.emoji}</span>
            <span className="text-sm font-bold text-foreground">{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
