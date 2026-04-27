"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType } from "@/types/agent";

type InputMode = "text" | "voice";

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
  initialMode = "voice",
  onSubmit,
}: TextInputSlotProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(initialMode === "text");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { voiceState, liveTranscript, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      if (!submitted) {
        setVoiceError(null);
        setSubmitted(true);
        onSubmit(transcript, "voice");
      }
    },
    () => {
      setVoiceError("语音识别暂时不可用，请直接输入。");
      setTextOpen(true);
    },
  );

  useEffect(() => {
    if (textOpen && !submitted) {
      inputRef.current?.focus();
    }
  }, [textOpen, submitted]);

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
    setTextOpen(false);
    void startRecording();
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
  const textDisabled = submitted || isRecording || isProcessing;
  const micDisabled = submitted || isProcessing;
  const textToggleDisabled = submitted || isRecording || isProcessing;
  const voiceTitle = isRecording ? "正在录音" : isProcessing ? "正在识别" : "语音回答";
  const voiceHint = isRecording
    ? "再点一下结束录音"
    : isProcessing
      ? "正在把刚才的话变成文字"
      : "点一下话筒开始说";

  return (
    <div className="bp-voice-first space-y-4">
      {prompt && (
        <p className="text-lg font-black leading-7 text-foreground md:text-xl">{prompt}</p>
      )}

      <div className="bp-voice-first-shell">
        <button
          type="button"
          onClick={handleVoiceToggle}
          disabled={micDisabled}
          className={`bp-voice-primary-button ${
            isRecording ? "bp-voice-primary-button-recording" : ""
          } ${isProcessing ? "bp-voice-primary-button-processing" : ""}`}
          aria-label={voiceTitle}
        >
          <span aria-hidden="true">
            {isProcessing ? "…" : isRecording ? "■" : "🎤"}
          </span>
        </button>

        <div className="bp-voice-first-copy">
          <p className="bp-voice-first-title">{voiceTitle}</p>
          <p className="bp-voice-first-hint">{voiceHint}</p>
          <div
            className={`bp-voice-mini-bars ${isRecording || isProcessing ? "bp-voice-mini-bars-active" : ""}`}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      {(isRecording || isProcessing || liveTranscript) && (
        <div className="bp-live-transcript" aria-live="polite">
          <span>{liveTranscript || "正在听你说..."}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setTextOpen((current) => !current)}
        disabled={textToggleDisabled}
        className={`bp-text-secondary-button ${textOpen ? "bp-text-secondary-button-active" : ""}`}
      >
        <span className="bp-text-secondary-icon" aria-hidden="true">⌨</span>
        <span>{textOpen ? "收起文字输入" : "文字输入"}</span>
      </button>

      {textOpen && (
        <div className="bp-text-drawer">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => {
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
            <p className="text-xs text-ink-soft">写一句就可以，林老师会顺着接。</p>
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
      )}

      {voiceError && (
        <p className="text-xs text-amber-700">{voiceError}</p>
      )}
    </div>
  );
}
