"use client";

import { TextInputSlot } from "@/components/game/text-input-slot";
import type { InputType } from "@/types/agent";

interface VoiceInputSlotProps {
  prompt: string;
  language?: string;
  onSubmit: (input: string, type: InputType) => void;
}

export function VoiceInputSlot({ prompt, onSubmit }: VoiceInputSlotProps) {
  return (
    <TextInputSlot
      prompt={prompt}
      placeholder="不方便说的话，也可以在这里输入..."
      submitLabel="发送"
      initialMode="voice"
      onSubmit={onSubmit}
    />
  );
}
