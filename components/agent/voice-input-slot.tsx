"use client";

import { useState } from "react";
import { TextInputSlot } from "@/components/game/text-input-slot";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType } from "@/types/agent";

interface VoiceInputSlotProps {
  prompt: string;
  language?: string;
  onSubmit: (input: string, type: InputType) => void;
}

type VoiceState = "idle" | "recording" | "processing" | "fallback";

export function VoiceInputSlot({ prompt, onSubmit }: VoiceInputSlotProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);

  const { voiceState, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      setError(null);
      setState("idle");
      onSubmit(transcript, "voice");
    },
    () => {
      setError("语音识别暂时不可用，请直接输入。");
      setState("fallback");
    },
  );

  if (state === "fallback") {
    return <TextInputSlot prompt={prompt} onSubmit={onSubmit} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{prompt}</p>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (voiceState === "recording") {
              stopRecording();
              setState("processing");
              return;
            }
            setError(null);
            setState("recording");
            void startRecording();
          }}
          disabled={voiceState === "processing"}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-lg transition ${
            voiceState === "recording"
              ? "animate-pulse bg-red-500 text-white"
              : "bg-accent text-white hover:bg-accent/90"
          } disabled:opacity-50`}
        >
          {voiceState === "processing" ? "…" : voiceState === "recording" ? "■" : "🎤"}
        </button>
        <p className="text-xs text-ink-soft">
          {voiceState === "recording" ? "再点一次结束录音" : voiceState === "processing" ? "识别中…" : "点一下开始说话"}
        </p>
        {error && <p className="text-xs text-amber-700">{error}</p>}
      </div>
    </div>
  );
}
