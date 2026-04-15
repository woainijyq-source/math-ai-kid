"use client";

import { useState } from "react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType, InputMeta } from "@/types/agent";

interface InputBarProps {
  pendingInputType: InputType | null;
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function InputBar({ pendingInputType, onSubmit }: InputBarProps) {
  const [value, setValue] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const { voiceState, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      setVoiceError(null);
      onSubmit(transcript, "voice");
    },
    () => {
      setVoiceError("语音识别暂时不可用，请改用文字输入。");
    },
  );

  if (
    pendingInputType === "choice" ||
    pendingInputType === "text" ||
    pendingInputType === "voice" ||
    pendingInputType === "number" ||
    pendingInputType === "photo" ||
    pendingInputType === "camera" ||
    pendingInputType === "drawing" ||
    pendingInputType === "emotion"
  ) {
    return null;
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    setVoiceError(null);
    onSubmit(trimmed, "text");
  }

  const isRecording = voiceState === "recording";
  const isProcessing = voiceState === "processing";

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (voiceError) setVoiceError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="说点什么…"
            disabled={isRecording}
            className="flex-1 rounded-2xl border border-border bg-white px-4 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => {
              if (isRecording) {
                stopRecording();
                return;
              }
              setVoiceError(null);
              void startRecording();
            }}
            disabled={isProcessing}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition ${
              isRecording
                ? "animate-pulse bg-red-500 text-white"
                : "bg-accent/10 text-accent hover:bg-accent/20"
            } disabled:opacity-40`}
          >
            {isProcessing ? "…" : isRecording ? "■" : "🎤"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || isRecording}
            className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            发送
          </button>
        </div>
        {voiceError && (
          <p className="mt-2 text-xs text-amber-700">{voiceError}</p>
        )}
      </div>
    </div>
  );
}
