"use client";

import { useEffect, useRef, useState } from "react";
import { sendTts } from "@/lib/ai/client";
import type { VoiceRole } from "@/types";

// ---------------------------------------------------------------------------
// 全局 TTS 播放状态（用于同步 RobotMood）
// ---------------------------------------------------------------------------

let isSpeakingNow = false;
const listeners = new Set<() => void>();

function setSpeaking(value: boolean) {
  if (isSpeakingNow === value) return;
  isSpeakingNow = value;
  listeners.forEach((fn) => fn());
}

export function getIsSpeaking(): boolean {
  return isSpeakingNow;
}

export function subscribeIsSpeaking(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ---------------------------------------------------------------------------
// TTS 队列
// ---------------------------------------------------------------------------

let ttsQueue: Promise<void> = Promise.resolve();

function enqueueTts(fn: () => Promise<void>) {
  ttsQueue = ttsQueue.then(fn).catch(() => {});
}

function speakWithBrowser(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.onend = () => { setSpeaking(false); resolve(); };
    utterance.onerror = () => { setSpeaking(false); resolve(); };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  });
}

function playAudioBase64(base64: string, mimeType: string): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      const audio = new Audio(`data:${mimeType};base64,${base64}`);
      audio.onended = () => { setSpeaking(false); resolve(); };
      audio.onerror = () => { setSpeaking(false); resolve(); };
      setSpeaking(true);
      const playPromise = audio.play();
      playPromise?.catch(() => { setSpeaking(false); resolve(); });
    } catch {
      setSpeaking(false);
      resolve();
    }
  });
}

const VALID_VOICE_ROLES: VoiceRole[] = [
  "guide",
  "opponent",
  "maker",
  "storyteller",
  "parent",
];

function toVoiceRole(role: string): VoiceRole {
  return VALID_VOICE_ROLES.includes(role as VoiceRole)
    ? (role as VoiceRole)
    : "guide";
}

export interface UseTtsOptions {
  voiceRole?: string;
  speakerName?: string;
  autoSpeak?: boolean;
  enabled?: boolean;
}

export interface UseTtsResult {
  isSpeaking: boolean;
  isComplete: boolean;
}

export function useTts(
  text: string,
  options: UseTtsOptions = {},
): UseTtsResult {
  const {
    voiceRole = "guide",
    speakerName,
    autoSpeak = true,
    enabled = true,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!autoSpeak || !enabled || spokenRef.current || !text) return;

    spokenRef.current = true;
    enqueueTts(async () => {
      setSpeaking(true);
      setIsSpeaking(true);
      setIsComplete(false);

      try {
        const response = await sendTts({
          text,
          voiceRole: toVoiceRole(voiceRole),
          speakerName,
        });

        if (response.audioBase64 && response.mimeType && !response.fallbackUsed) {
          await playAudioBase64(response.audioBase64, response.mimeType);
          setIsSpeaking(false);
          setIsComplete(true);
          return;
        }
      } catch {}

      await speakWithBrowser(text);
      setIsSpeaking(false);
      setIsComplete(true);
    });
  }, [text, autoSpeak, enabled, voiceRole, speakerName]);

  return { isSpeaking, isComplete };
}

export { enqueueTts, playAudioBase64, speakWithBrowser };
