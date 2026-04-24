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
    <div className="fixed bottom-3 left-0 right-0 z-30 px-3 lg:pl-72">
      <div className="bp-input-dock mx-auto max-w-3xl p-3">
        <div className="flex items-center gap-2">
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
            className="bp-field min-h-12 flex-1 px-4 py-3 text-sm disabled:opacity-50"
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
            className={`bp-icon-button h-12 w-12 text-lg ${
              isRecording
                ? "bp-icon-button-danger animate-pulse"
                : ""
            } disabled:opacity-40`}
          >
            {isProcessing ? "…" : isRecording ? "■" : "🎤"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || isRecording}
            className="bp-button-primary min-h-12 px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
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
