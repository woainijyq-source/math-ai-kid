"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import type { InputType, InputMeta } from "@/types/agent";

interface InputBarProps {
  pendingInputType: InputType | null;
  hidden?: boolean;
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function InputBar({ pendingInputType, hidden = false, onSubmit }: InputBarProps) {
  const [value, setValue] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { voiceState, liveTranscript, startRecording, stopRecording } = useVoiceRecorder(
    (transcript) => {
      setVoiceError(null);
      onSubmit(transcript, "voice");
    },
    () => {
      setVoiceError("语音识别暂时不可用，请改用文字输入。");
      setTextOpen(true);
    },
  );

  useEffect(() => {
    if (textOpen) {
      inputRef.current?.focus();
    }
  }, [textOpen]);

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
    setTextOpen(false);
    void startRecording();
  }

  function handleVoiceToggle() {
    if (isRecording) {
      stopRecording();
      return;
    }

    beginVoiceRecording();
  }

  const voiceTitle = isRecording ? "正在录音" : isProcessing ? "正在识别" : "语音回答";
  const voiceHint = isRecording
    ? "再点一下结束录音"
    : isProcessing
      ? "正在把刚才的话变成文字"
      : "点一下话筒开始说";
  const textDisabled = isRecording || isProcessing;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
      <div className="bp-input-dock mx-auto max-w-3xl p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">轮到你啦</p>
            <p className="mt-1 text-sm text-ink-soft">先说出来，想慢慢写再打开文字输入。</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            <div className="bp-voice-first-shell bp-voice-first-shell-dock">
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={isProcessing}
                className={`bp-voice-primary-button bp-voice-primary-button-dock ${
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
              <div className="bp-live-transcript bp-live-transcript-dock" aria-live="polite">
                <span>{liveTranscript || "正在听你说..."}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTextOpen((current) => !current)}
            disabled={isRecording || isProcessing}
            className={`bp-text-secondary-button bp-text-secondary-button-dock ${textOpen ? "bp-text-secondary-button-active" : ""}`}
          >
            <span className="bp-text-secondary-icon" aria-hidden="true">⌨</span>
            <span>{textOpen ? "收起文字" : "文字输入"}</span>
          </button>
        </div>

        {textOpen && (
          <div className="bp-text-drawer mt-3">
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
              placeholder="说点什么..."
              disabled={textDisabled}
              rows={2}
              className="bp-field min-h-16 w-full resize-none px-4 py-3 text-sm leading-6 disabled:opacity-50"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-soft">按 Enter 发送，Shift + Enter 换行。</p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!value.trim() || textDisabled}
                className="bp-button-primary min-h-12 px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
              >
                发送
              </button>
            </div>
          </div>
        )}

        {voiceError && <p className="mt-3 text-xs text-amber-700">{voiceError}</p>}
      </div>
    </div>
  );
}
