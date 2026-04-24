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
      <p className="text-sm font-bold leading-6 text-foreground">{prompt}</p>
      <div className="flex flex-wrap items-center gap-3 rounded-[26px] border border-white/70 bg-white/60 p-3">
        <button
          type="button"
          onClick={() => setValue((v) => clamp(v - step))}
          disabled={value <= min || submitted}
          className="bp-icon-button h-12 w-12 text-xl font-black disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-[4rem] rounded-2xl bg-white/80 px-4 py-2 text-center text-3xl font-black text-foreground shadow-sm">
          {value}
        </span>
        <button
          type="button"
          onClick={() => setValue((v) => clamp(v + step))}
          disabled={value >= max || submitted}
          className="bp-icon-button h-12 w-12 text-xl font-black disabled:opacity-40"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="bp-button-primary ml-auto px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
        >
          确认
        </button>
      </div>
    </div>
  );
}
