"use client";
/**
 * T5.1 — NumberInputSlot
 * 数字选择器，支持 +/- 按钮调整数值并提交。
 */

import { useState } from "react";
import type { InputType } from "@/types/agent";

interface NumberInputSlotProps {
  prompt: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  onSubmit: (input: string, type: InputType) => void;
}

export function NumberInputSlot({
  prompt,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 0,
  onSubmit,
}: NumberInputSlotProps) {
  const [value, setValue] = useState(defaultValue);
  const [submitted, setSubmitted] = useState(false);

  function clamp(v: number) {
    return Math.min(max, Math.max(min, v));
  }

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    onSubmit(String(value), "number");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{prompt}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setValue((v) => clamp(v - step))}
          disabled={value <= min || submitted}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-xl font-bold text-accent disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-2xl font-bold text-foreground">
          {value}
        </span>
        <button
          type="button"
          onClick={() => setValue((v) => clamp(v + step))}
          disabled={value >= max || submitted}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-xl font-bold text-accent disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="ml-4 rounded-2xl bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          确认
        </button>
      </div>
    </div>
  );
}
