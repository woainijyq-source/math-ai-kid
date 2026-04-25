"use client";

import { useEffect, useRef, useState } from "react";
import { InputModeToggle, type InputMode } from "@/components/agent/input-mode-toggle";
import { VoiceRecorderControl } from "@/components/agent/voice-recorder-control";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType } from "@/types/agent";

interface TextInputSlotProps {
  prompt: string;
  placeholder?: string;
  submitLabel?: string;
  initialMode?: InputMode;
  onSubmit: (input: string, type: InputType) => void;
}

export function TextInputSlot({
  prompt,
  placeholder = "在这里输入...",
  submitLabel = "提交",
  initialMode = "text",
  onSubmit,
}: TextInputSlotProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [mode, setMode] = useState<InputMode>(initialMode);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { voiceState, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      if (!submitted) {
        setVoiceError(null);
        setSubmitted(true);
        onSubmit(transcript, "voice");
      }
    },
    () => {
      setVoiceError("语音识别暂时不可用，请直接输入。");
    },
  );

  useEffect(() => {
    if (mode === "text" && !submitted) {
      inputRef.current?.focus();
    }
  }, [mode, submitted]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || submitted) return;
    setSubmitted(true);
    setVoiceError(null);
    setValue("");
    onSubmit(trimmed, "text");
  }

  function beginVoiceRecording() {
    setVoiceError(null);
    setMode("voice");
    void startRecording();
  }

  function handleModeChange(nextMode: InputMode) {
    setMode(nextMode);
    if (nextMode === "voice" && voiceState === "idle" && !submitted) {
      beginVoiceRecording();
    }
  }

  function handleVoiceToggle() {
    if (voiceState === "recording") {
      stopRecording();
      return;
    }
    beginVoiceRecording();
  }

  const isRecording = voiceState === "recording";
  const isProcessing = voiceState === "processing";
  const modeSwitchDisabled = submitted || isRecording || isProcessing;
  const textDisabled = submitted || isRecording || isProcessing || mode === "voice";
  const micDisabled = submitted || isProcessing;

  return (
    <div className="space-y-3">
      {prompt && (
        <p className="text-sm font-semibold leading-6 text-foreground">{prompt}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">可以打字，也可以直接说</p>
        <InputModeToggle mode={mode} onChange={handleModeChange} disabled={modeSwitchDisabled} />
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
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
            placeholder={placeholder}
            disabled={textDisabled}
            rows={3}
            className="bp-field min-h-28 w-full resize-none px-4 py-3 text-sm leading-6 disabled:opacity-50"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-soft">
              {mode === "text" ? "写一句就可以，林老师会顺着接。" : "切回“打字”就能发文字。"}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={textDisabled || !value.trim()}
              className="bp-button-primary min-h-12 px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
            >
              {submitLabel}
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
            disabled={micDisabled}
            label={isRecording ? "正在用语音回答" : isProcessing ? "正在识别语音" : "语音回答"}
          />
        </div>
      </div>

      {voiceError && (
        <p className="text-xs text-amber-700">{voiceError}</p>
      )}
    </div>
  );
}
