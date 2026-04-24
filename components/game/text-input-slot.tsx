"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTts } from "@/hooks/use-tts";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { TypewriterText } from "@/components/agent/typewriter-text";
import { Avatar } from "@/components/agent/avatar";
import type { InputType } from "@/types/agent";

interface TextInputSlotProps {
  prompt: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (input: string, type: InputType) => void;
}

export function TextInputSlot({
  prompt,
  placeholder = "在这里输入...",
  submitLabel = "提交",
  onSubmit,
}: TextInputSlotProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [inputReady, setInputReady] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useTts(prompt, { voiceRole: "guide", autoSpeak: true });

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
    if (inputReady) {
      inputRef.current?.focus();
    }
  }, [inputReady]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || submitted) return;
    setSubmitted(true);
    setVoiceError(null);
    setValue("");
    onSubmit(trimmed, "text");
  }

  const textDisabled = !inputReady || submitted || voiceState !== "idle";
  const micDisabled = !inputReady || submitted || voiceState === "processing";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar
          src="/illustrations/character/robot-happy.png"
          fallback="脑"
          size={36}
          className="bp-avatar-ring mt-1"
        />
        <div className="bp-chat-bubble bp-chat-bubble-ai max-w-[min(85%,44rem)] px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
            脑脑
          </p>
          <TypewriterText
            key={prompt}
            text={prompt}
            speed={55}
            onComplete={() => setInputReady(true)}
            className="text-sm leading-6 text-foreground"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0.4 }}
        animate={{ opacity: inputReady ? 1 : 0.4 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (voiceError) setVoiceError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder={placeholder}
            disabled={textDisabled}
            className="bp-field min-h-12 flex-1 px-4 py-3 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => {
              if (voiceState === "recording") {
                stopRecording();
                return;
              }
              setVoiceError(null);
              void startRecording();
            }}
            disabled={micDisabled}
            className={`bp-icon-button h-12 w-12 text-lg ${
              voiceState === "recording"
                ? "bp-icon-button-danger animate-pulse"
                : ""
            } disabled:opacity-40`}
          >
            {voiceState === "processing" ? "…" : voiceState === "recording" ? "■" : "🎤"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={textDisabled || !value.trim()}
            className="bp-button-primary min-h-12 px-5 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
        {voiceError && (
          <p className="mt-2 text-xs text-amber-700">{voiceError}</p>
        )}
      </motion.div>
    </div>
  );
}
