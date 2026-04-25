"use client";

import { useEffect, useRef, useState } from "react";
import { InputModeToggle, type InputMode } from "@/components/agent/input-mode-toggle";
import { VoiceRecorderControl } from "@/components/agent/voice-recorder-control";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType, InputMeta } from "@/types/agent";

interface InputBarProps {
  pendingInputType: InputType | null;
  hidden?: boolean;
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function InputBar({ pendingInputType, hidden = false, onSubmit }: InputBarProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<InputMode>("text");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { voiceState, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      setVoiceError(null);
      onSubmit(transcript, "voice");
    },
    () => {
      setVoiceError("语音识别暂时不可用，请改用文字输入。");
    },
  );

  useEffect(() => {
    if (mode === "text") {
      inputRef.current?.focus();
    }
  }, [mode]);

  if (
    hidden ||
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

  function beginVoiceRecording() {
    setVoiceError(null);
    setMode("voice");
    void startRecording();
  }

  function handleModeChange(nextMode: InputMode) {
    setMode(nextMode);
    if (nextMode === "voice" && voiceState === "idle") {
      beginVoiceRecording();
    }
  }

  function handleVoiceToggle() {
    if (isRecording) {
      stopRecording();
      return;
    }

    beginVoiceRecording();
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
      <div className="bp-input-dock mx-auto max-w-3xl p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">轮到你啦</p>
            <p className="mt-1 text-sm text-ink-soft">说一点点也可以。</p>
          </div>
          <InputModeToggle
            mode={mode}
            onChange={handleModeChange}
            disabled={isRecording || isProcessing}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div
            className={`rounded-[28px] border p-3 shadow-sm transition ${
              mode === "text"
                ? "border-accent/20 bg-white/92"
                : "border-white/70 bg-white/68"
            }`}
          >
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => {
                setMode("text");
                setValue(e.target.value);
                if (voiceError) setVoiceError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="说点什么..."
              disabled={isRecording || isProcessing || mode === "voice"}
              rows={2}
              className="bp-field min-h-16 w-full resize-none px-4 py-3 text-sm leading-6 disabled:opacity-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-soft">
                {mode === "text" ? "按 Enter 发送。" : "切回“打字”就能发送文字。"}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || isRecording || isProcessing || mode === "voice"}
                className="bp-button-primary min-h-12 px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
              >
                发送
              </button>
            </div>
          </div>

          <div
            className={`rounded-[28px] border p-4 shadow-sm transition ${
              mode === "voice"
                ? "border-accent/20 bg-accent/6"
                : "border-white/70 bg-white/72"
            }`}
          >
            <VoiceRecorderControl
              voiceState={voiceState}
              onToggle={handleVoiceToggle}
              disabled={isProcessing}
              label={isRecording ? "正在用语音回答" : isProcessing ? "正在识别语音" : "语音回答"}
            />
          </div>
        </div>

        {voiceError && <p className="mt-3 text-xs text-amber-700">{voiceError}</p>}
      </div>
    </div>
  );
}
