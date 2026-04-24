"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendTts } from "@/lib/ai/client";
import type { AIMessage, VoiceRole } from "@/types";

const roleTuning: Record<VoiceRole, { rate: number; pitch: number }> = {
  guide: { rate: 0.98, pitch: 1.08 },
  opponent: { rate: 1.02, pitch: 0.92 },
  maker: { rate: 1, pitch: 1.18 },
  storyteller: { rate: 0.94, pitch: 1.02 },
  parent: { rate: 0.95, pitch: 1 },
};

function pickVoice(role: VoiceRole) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return undefined;
  }

  const voices = window.speechSynthesis.getVoices();
  const zhVoices = voices.filter((voice) => voice.lang.toLowerCase().includes("zh"));
  const available = zhVoices.length > 0 ? zhVoices : voices;

  if (available.length === 0) {
    return undefined;
  }

  const roleMatchers: Record<VoiceRole, RegExp[]> = {
    guide: [/xiaoxiao/i, /xiaoyi/i, /female/i],
    opponent: [/yunxi/i, /male/i, /xiaoyi/i],
    maker: [/xiaomo/i, /female/i, /xiaoxiao/i],
    storyteller: [/xiaohan/i, /xiaoxiao/i, /female/i],
    parent: [/xiaoxiao/i, /female/i],
  };

  const names = roleMatchers[role];
  return (
    available.find((voice) => names.some((matcher) => matcher.test(voice.name))) ??
    available[0]
  );
}

export function NarrationControls({
  messages,
  className = "",
  autoStart = false,
  compact = false,
  showDescription = true,
}: {
  messages: AIMessage[];
  className?: string;
  autoStart?: boolean;
  compact?: boolean;
  showDescription?: boolean;
}) {
  const [enabled, setEnabled] = useState(autoStart);
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusText, setStatusText] = useState(autoStart ? "语音引导已开启" : "语音引导关闭");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const latestRequestRef = useRef(0);
  const lastSpokenIdRef = useRef<string | null>(null);

  const latestAssistantMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.autoSpeak !== false);
  }, [messages]);

  const stopPlayback = useCallback(() => {
    latestRequestRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    utteranceRef.current = null;
    setIsPlaying(false);
    setStatusText((current) => (current === "语音引导关闭" ? current : "语音播放已停止"));
  }, []);

  const speakWithBrowser = useCallback(
    async (text: string, voiceRole: VoiceRole, requestId: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        throw new Error("speech synthesis unavailable");
      }

      const utterance = new SpeechSynthesisUtterance(text);
      const tuning = roleTuning[voiceRole];
      const voice = pickVoice(voiceRole);
      utterance.lang = "zh-CN";
      utterance.rate = tuning.rate;
      utterance.pitch = tuning.pitch;
      if (voice) {
        utterance.voice = voice;
      }
      utteranceRef.current = utterance;

      utterance.onend = () => {
        if (latestRequestRef.current === requestId) {
          setIsPlaying(false);
          setStatusText("播放完成");
        }
      };

      utterance.onerror = () => {
        if (latestRequestRef.current === requestId) {
          setIsPlaying(false);
          setStatusText("浏览器语音播放失败");
        }
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const speakMessage = useCallback(
    async (message: AIMessage) => {
      const text = message.speakableText ?? message.content;
      const voiceRole = message.voiceRole ?? "guide";
      const requestId = Date.now();

      stopPlayback();
      latestRequestRef.current = requestId;
      setIsPlaying(true);
      setStatusText(`正在播放 ${message.speakerName ?? "AI"} 的语音`);

      try {
        const response = await sendTts({
          text,
          voiceRole,
          speakerName: message.speakerName,
        });

        if (latestRequestRef.current !== requestId) {
          return;
        }

        if (response.audioBase64 && response.mimeType) {
          const audio = new Audio(
            `data:${response.mimeType};base64,${response.audioBase64}`,
          );
          audioRef.current = audio;
          audio.onended = () => {
            if (latestRequestRef.current === requestId) {
              setIsPlaying(false);
              setStatusText("播放完成");
            }
          };
          audio.onerror = async () => {
            if (latestRequestRef.current === requestId) {
              await speakWithBrowser(text, voiceRole, requestId);
            }
          };
          await audio.play();
        } else {
          await speakWithBrowser(text, voiceRole, requestId);
        }
      } catch {
        if (latestRequestRef.current === requestId) {
          try {
            await speakWithBrowser(text, voiceRole, requestId);
          } catch {
            setIsPlaying(false);
            setStatusText("当前设备暂时无法播放语音");
          }
        }
      }
    },
    [speakWithBrowser, stopPlayback],
  );

  useEffect(() => {
    if (!enabled || !latestAssistantMessage) {
      return;
    }

    if (lastSpokenIdRef.current === latestAssistantMessage.id) {
      return;
    }

    lastSpokenIdRef.current = latestAssistantMessage.id;
    const timer = window.setTimeout(() => {
      void speakMessage(latestAssistantMessage);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [enabled, latestAssistantMessage, speakMessage]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const canReplay = Boolean(latestAssistantMessage);
  const buttonClass = compact
    ? "rounded-full px-3 py-2 text-xs font-semibold"
    : "rounded-full px-4 py-2 text-sm font-semibold";

  return (
    <div className={`space-y-3 ${className}`}>
      {showDescription ? (
        <p className="text-sm leading-6 text-ink-soft">
          开启后，关键剧情会自动播报。孩子可以先听，再做选择，不用一直盯着屏幕读字。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            setStatusText(next ? "语音引导已开启" : "语音引导关闭");

            if (next && latestAssistantMessage) {
              lastSpokenIdRef.current = latestAssistantMessage.id;
              void speakMessage(latestAssistantMessage);
            } else if (!next) {
              stopPlayback();
            }
          }}
          className={`${buttonClass} ${
            enabled ? "bg-accent text-white shadow-sm" : "border border-white/70 bg-white/72"
          }`}
        >
          {enabled ? "关闭语音" : "开启语音"}
        </button>

        <button
          type="button"
          disabled={!canReplay}
          onClick={() => {
            if (latestAssistantMessage) {
              lastSpokenIdRef.current = latestAssistantMessage.id;
              void speakMessage(latestAssistantMessage);
            }
          }}
          className={`${buttonClass} ${
            canReplay
              ? "border border-white/70 bg-white/72"
              : "cursor-not-allowed border border-white/60 bg-white/50 text-ink-soft"
          }`}
        >
          重播
        </button>

        <button
          type="button"
          disabled={!isPlaying}
          onClick={stopPlayback}
          className={`${buttonClass} ${
            isPlaying
              ? "border border-white/70 bg-white/72"
              : "cursor-not-allowed border border-white/60 bg-white/50 text-ink-soft"
          }`}
        >
          停止
        </button>
      </div>

      <p className="text-xs text-ink-soft">{statusText}</p>
    </div>
  );
}
