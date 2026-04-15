"use client";

import { useRef, useState } from "react";
import { aiClient } from "@/lib/ai/client";

export function VoiceInputButton({
  mode,
  disabled = false,
  onTranscript,
}: {
  mode: string;
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "recording" | "loading">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    if (disabled) {
      return;
    }

    if (!("MediaRecorder" in window) || !navigator.mediaDevices) {
      onTranscript("当前浏览器不支持录音，已切换为示例语音文本。");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      setStatus("loading");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const result = await aiClient.stt(blob, mode);
      onTranscript(result.transcript);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStatus("idle");
    };

    recorder.start();
    setStatus("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  return (
    <button
      type="button"
      onClick={status === "recording" ? stopRecording : startRecording}
      disabled={disabled || status === "loading"}
      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
        status === "recording"
          ? "bg-warm text-white shadow-lg"
          : "border border-border bg-white text-foreground hover:bg-accent-soft"
      } ${(disabled || status === "loading") ? "cursor-not-allowed opacity-60" : ""}`}
    >
      {status === "recording" ? "停止录音" : status === "loading" ? "识别中..." : "语音输入"}
    </button>
  );
}
