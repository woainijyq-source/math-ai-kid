"use client";

import { motion } from "framer-motion";
import type { VoiceState } from "@/hooks/use-voice-recorder";

interface VoiceRecorderControlProps {
  voiceState: VoiceState;
  onToggle: () => void;
  disabled?: boolean;
  label?: string;
  size?: "compact" | "large";
}

const SIZE_MAP = {
  compact: {
    button: "h-15 w-15 text-2xl",
    shell: "gap-3",
    title: "text-sm",
    bars: "h-8",
  },
  large: {
    button: "h-24 w-24 text-4xl",
    shell: "gap-4",
    title: "text-base",
    bars: "h-10",
  },
} as const;

function getHint(state: VoiceState) {
  if (state === "recording") return "再点一下结束录音";
  if (state === "processing") return "正在识别刚才这句话";
  return "点一下就可以直接说";
}

export function VoiceRecorderControl({
  voiceState,
  onToggle,
  disabled = false,
  label = "语音回答",
  size = "compact",
}: VoiceRecorderControlProps) {
  const styles = SIZE_MAP[size];
  const active = voiceState === "recording" || voiceState === "processing";

  return (
    <div className={`flex items-center ${styles.shell}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`bp-icon-button relative flex-shrink-0 overflow-hidden rounded-full shadow-sm ${
          active
            ? "bp-icon-button-danger"
            : "bg-accent text-white hover:bg-accent/92"
        } ${styles.button} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label={label}
      >
        <span className="relative z-10">
          {voiceState === "processing" ? "…" : voiceState === "recording" ? "■" : "🎤"}
        </span>
        {voiceState === "recording" && (
          <motion.span
            className="absolute inset-0 rounded-full border border-white/45"
            animate={{ scale: [1, 1.14, 1], opacity: [0.42, 0, 0.42] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`${styles.title} font-black text-foreground`}>{label}</p>
        <div className={`mt-2 flex items-end gap-1 ${styles.bars}`} aria-hidden="true">
          {[0.32, 0.56, 0.84, 0.48, 0.68].map((height, index) => (
            <motion.span
              key={`${label}-${index}`}
              className={`w-1.5 rounded-full ${active ? "bg-accent" : "bg-accent/24"}`}
              animate={
                active
                  ? { scaleY: [height, 1, height * 0.8 + 0.2] }
                  : { scaleY: [height, height, height] }
              }
              transition={{
                duration: 0.8,
                repeat: Infinity,
                repeatType: "reverse",
                delay: index * 0.08,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: "bottom", height: "100%" }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">{getHint(voiceState)}</p>
      </div>
    </div>
  );
}
