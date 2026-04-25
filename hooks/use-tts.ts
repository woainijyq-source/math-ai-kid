"use client";

import { useEffect, useRef, useState } from "react";
import { sendTts, streamRealtimeTts } from "@/lib/ai/client";
import type { TtsRequestPayload, TtsResponsePayload, VoiceRole } from "@/types";

// ---------------------------------------------------------------------------
// 全局 TTS 播放状态（用于同步 RobotMood）
// ---------------------------------------------------------------------------

let isSpeakingNow = false;
const listeners = new Set<() => void>();
let needsAudioUnlock = false;
const audioUnlockListeners = new Set<() => void>();
let currentAudio: HTMLAudioElement | null = null;
let sharedAudioContext: AudioContext | null = null;
let currentPcmSources: AudioBufferSourceNode[] = [];
let lastTtsPayload: TtsRequestPayload | null = null;
const pendingTtsRequests = new Map<string, Promise<TtsResponsePayload>>();

const SILENT_WAV_DATA_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";

function setSpeaking(value: boolean) {
  if (isSpeakingNow === value) return;
  isSpeakingNow = value;
  listeners.forEach((fn) => fn());
}

function setNeedsAudioUnlock(value: boolean) {
  if (needsAudioUnlock === value) return;
  needsAudioUnlock = value;
  audioUnlockListeners.forEach((fn) => fn());
}

export function getIsSpeaking(): boolean {
  return isSpeakingNow;
}

export function subscribeIsSpeaking(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getNeedsAudioUnlock(): boolean {
  return needsAudioUnlock;
}

export function subscribeNeedsAudioUnlock(callback: () => void): () => void {
  audioUnlockListeners.add(callback);
  return () => audioUnlockListeners.delete(callback);
}

// ---------------------------------------------------------------------------
// TTS 队列
// ---------------------------------------------------------------------------

let ttsQueue: Promise<void> = Promise.resolve();

function enqueueTts(fn: () => Promise<void>) {
  ttsQueue = ttsQueue.then(fn).catch(() => {});
}

function buildTtsRequestKey(payload: TtsRequestPayload) {
  return [
    payload.voiceRole,
    payload.speakerName?.trim() ?? "",
    payload.text.trim(),
  ].join("::");
}

function shouldUseBrowserTtsFallback() {
  return process.env.NEXT_PUBLIC_ALLOW_BROWSER_TTS_FALLBACK === "1";
}

function shouldUseRealtimeTts() {
  return process.env.NEXT_PUBLIC_DISABLE_REALTIME_TTS !== "1";
}

function prepareTtsResponse(payload: TtsRequestPayload) {
  const key = buildTtsRequestKey(payload);
  const existing = pendingTtsRequests.get(key);
  if (existing) {
    return existing;
  }

  const request = sendTts(payload).finally(() => {
    window.setTimeout(() => pendingTtsRequests.delete(key), 30_000);
  });
  pendingTtsRequests.set(key, request);
  return request;
}

export function preloadTts(payload: TtsRequestPayload) {
  lastTtsPayload = payload;
  if (shouldUseRealtimeTts()) return;
  void prepareTtsResponse(payload).catch(() => undefined);
}

function speakWithBrowser(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.onend = () => { setSpeaking(false); resolve(); };
    utterance.onerror = () => { setSpeaking(false); resolve(); };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  });
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function stopCurrentPcmSources() {
  for (const source of currentPcmSources) {
    try {
      source.stop();
    } catch {
      // The source may have already finished.
    }
  }
  currentPcmSources = [];
}

function base64ToPcmFloat32(base64: string) {
  const binary = window.atob(base64);
  const byteLength = binary.length;
  const data = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    data[i] = binary.charCodeAt(i);
  }

  const view = new DataView(data.buffer);
  const sampleCount = Math.floor(byteLength / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }

  return samples;
}

function streamAndPlayRealtimePcm(payload: TtsRequestPayload): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      reject(new Error("audio context unavailable"));
      return;
    }

    currentAudio?.pause();
    currentAudio = null;
    stopCurrentPcmSources();

    let settled = false;
    let done = false;
    let receivedAudio = false;
    let pendingSources = 0;
    let sampleRate = 24000;
    let nextStartTime = 0;

    const finish = (error?: unknown) => {
      if (settled) return;
      if (!error && (!done || pendingSources > 0)) return;

      settled = true;
      currentPcmSources = currentPcmSources.filter((source) => {
        try {
          return source.context.state !== "closed";
        } catch {
          return false;
        }
      });
      setSpeaking(false);
      if (error) {
        stopCurrentPcmSources();
        reject(error);
      } else {
        resolve();
      }
    };

    const start = async () => {
      try {
        sharedAudioContext ??= new AudioContextConstructor();
        if (sharedAudioContext.state === "suspended") {
          await sharedAudioContext.resume();
        }

        const context = sharedAudioContext;
        nextStartTime = context.currentTime + 0.04;
        setSpeaking(true);

        await streamRealtimeTts(payload, {
          onEvent(event) {
            if (event.type === "start") {
              sampleRate = event.sampleRate;
              setNeedsAudioUnlock(false);
              return;
            }

            if (event.type === "audio") {
              const samples = base64ToPcmFloat32(event.delta);
              if (samples.length === 0) return;
              receivedAudio = true;

              const audioBuffer = context.createBuffer(1, samples.length, sampleRate);
              audioBuffer.copyToChannel(samples, 0);

              const source = context.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(context.destination);
              pendingSources += 1;
              currentPcmSources.push(source);
              source.onended = () => {
                pendingSources = Math.max(0, pendingSources - 1);
                currentPcmSources = currentPcmSources.filter((item) => item !== source);
                finish();
              };

              const startAt = Math.max(nextStartTime, context.currentTime + 0.01);
              source.start(startAt);
              nextStartTime = startAt + audioBuffer.duration;
              return;
            }

            if (event.type === "done") {
              done = true;
              if (!receivedAudio) {
                finish(new Error("realtime tts completed without audio"));
                return;
              }
              finish();
              return;
            }

            if (event.type === "error") {
              finish(new Error(event.message));
            }
          },
        });

        done = true;
        if (!receivedAudio) {
          finish(new Error("realtime tts completed without audio"));
          return;
        }
        finish();
      } catch (error) {
        setNeedsAudioUnlock(true);
        finish(error);
      }
    };

    void start();
  });
}

function playAudioBase64(base64: string, mimeType: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      if (typeof window === "undefined") {
        resolve();
        return;
      }

      currentAudio?.pause();
      currentAudio = null;
      stopCurrentPcmSources();

      const url = URL.createObjectURL(base64ToBlob(base64, mimeType));
      const audio = new Audio(url);
      currentAudio = audio;
      let settled = false;

      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        setSpeaking(false);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      audio.onended = () => finish();
      audio.onerror = () => finish(new Error("audio element failed to play tts"));
      setSpeaking(true);
      const playPromise = audio.play();
      playPromise
        ?.then(() => {
          setNeedsAudioUnlock(false);
        })
        .catch((error) => finish(error));
    } catch (error) {
      setSpeaking(false);
      reject(error);
    }
  });
}

export async function primeAudioPlayback() {
  if (typeof window === "undefined") return;

  let unlocked = false;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  try {
    if (AudioContextConstructor) {
      sharedAudioContext ??= new AudioContextConstructor();
      if (sharedAudioContext.state === "suspended") {
        await sharedAudioContext.resume();
      }
      unlocked = sharedAudioContext.state === "running";
    }
  } catch {
    // Some browsers block AudioContext until a direct user gesture.
  }

  try {
    const audio = new Audio(SILENT_WAV_DATA_URL);
    audio.volume = 0;
    await audio.play();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    unlocked = true;
  } catch {
    // If this fails, keep the explicit unlock prompt visible.
  }

  if (unlocked) {
    setNeedsAudioUnlock(false);
  }
}

export async function unlockAndReplayLatestTts() {
  await primeAudioPlayback();
  if (!lastTtsPayload) return;

  if (shouldUseRealtimeTts()) {
    try {
      await streamAndPlayRealtimePcm(lastTtsPayload);
      return;
    } catch {
      setNeedsAudioUnlock(true);
    }
  }

  try {
    const response = await prepareTtsResponse(lastTtsPayload);
    if (response.audioBase64 && response.mimeType && !response.fallbackUsed) {
      await playAudioBase64(response.audioBase64, response.mimeType);
      return;
    }
  } catch {
    setNeedsAudioUnlock(true);
  }

  if (shouldUseBrowserTtsFallback()) {
    await speakWithBrowser(lastTtsPayload.text);
  }
}

export function useAudioUnlockPrompt() {
  const [unlockNeeded, setUnlockNeeded] = useState(getNeedsAudioUnlock);

  useEffect(() => subscribeNeedsAudioUnlock(() => setUnlockNeeded(getNeedsAudioUnlock())), []);

  return {
    unlockNeeded,
    unlockAndReplay: unlockAndReplayLatestTts,
  };
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
    const payload: TtsRequestPayload = {
      text,
      voiceRole: toVoiceRole(voiceRole),
      speakerName,
    };
    lastTtsPayload = payload;

    enqueueTts(async () => {
      setSpeaking(true);
      setIsSpeaking(true);
      setIsComplete(false);

      if (shouldUseRealtimeTts()) {
        try {
          await streamAndPlayRealtimePcm(payload);
          setIsSpeaking(false);
          setIsComplete(true);
          return;
        } catch {
          setNeedsAudioUnlock(true);
        }
      }

      try {
        const responsePromise = prepareTtsResponse(payload);
        const response = await responsePromise;

        if (response.audioBase64 && response.mimeType && !response.fallbackUsed) {
          try {
            await playAudioBase64(response.audioBase64, response.mimeType);
            setIsSpeaking(false);
            setIsComplete(true);
            return;
          } catch {
            setNeedsAudioUnlock(true);
            setIsSpeaking(false);
            setIsComplete(true);
            return;
          }
        }
      } catch {}

      if (shouldUseBrowserTtsFallback()) {
        await speakWithBrowser(text);
      } else {
        setSpeaking(false);
      }
      setIsSpeaking(false);
      setIsComplete(true);
    });
  }, [text, autoSpeak, enabled, voiceRole, speakerName]);

  return { isSpeaking, isComplete };
}

export { enqueueTts, playAudioBase64, speakWithBrowser };
