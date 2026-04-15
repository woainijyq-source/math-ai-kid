"use client";
/**
 * T6.1 — CameraView
 * 开启摄像头，每 3 秒截帧发送给 Vision API，通过 onSubmit 回传描述。
 * 首次使用显示家长授权提示。
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { InputType, InputMeta } from "@/types/agent";

interface CameraViewProps {
  prompt: string;
  hints?: string[];
  duration?: number; // 最长拍摄秒数，默认 30
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

type CameraState = "consent" | "requesting" | "active" | "processing" | "done" | "error";

export function CameraView({ prompt, hints, duration = 30, onSubmit }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<CameraState>("consent");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(duration);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // 截帧 → base64
  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 640, 480);
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  }

  // 发送帧给 Vision API
  async function analyzeFrame(base64: string): Promise<string> {
    try {
      const form = new FormData();
      form.append("imageBase64", base64);
      form.append("mimeType", "image/jpeg");
      form.append("taskHint", prompt);
      const resp = await fetch("/api/ai/vision", { method: "POST", body: form });
      if (!resp.ok) return "";
      const data = (await resp.json()) as { description?: string };
      return data.description ?? "";
    } catch {
      return "";
    }
  }

  // 启动摄像头
  async function startCamera() {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("active");

      // 倒计时
      let secs = duration;
      const countTimer = setInterval(() => {
        secs--;
        setSecondsLeft(secs);
        if (secs <= 0) {
          clearInterval(countTimer);
          handleCapture();
        }
      }, 1000);
      intervalRef.current = countTimer;
    } catch (err) {
      setError(err instanceof Error ? err.message : "摄像头启动失败");
      setState("error");
    }
  }

  // 手动拍摄
  async function handleCapture() {
    stopCamera();
    setState("processing");
    const base64 = captureFrame();
    if (!base64) {
      setState("error");
      setError("截帧失败");
      return;
    }
    const desc = await analyzeFrame(base64);
    const result = desc || "[摄像头画面]"
    setDescription(result);
    setState("done");
    onSubmit(result, "camera", { photoBase64: base64 });
  }

  // 卸载时停止摄像头
  useEffect(() => () => stopCamera(), [stopCamera]);

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  if (state === "consent") {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">📷 需要使用摄像头</p>
        <p className="text-xs text-amber-700">{prompt}</p>
        <p className="text-xs text-amber-600">家长确认：此功能会开启摄像头，画面仅用于本次互动，不会上传保存。</p>
        {hints && (
          <ul className="list-inside list-disc space-y-1">
            {hints.map((h, i) => <li key={i} className="text-xs text-amber-700">{h}</li>)}
          </ul>
        )}
        <button
          type="button"
          onClick={startCamera}
          className="rounded-2xl bg-accent px-5 py-2 text-sm font-semibold text-white"
        >
          家长已确认，开启摄像头
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">摄像头出错：{error}</p>
        <button
          type="button"
          onClick={() => { setError(""); setState("consent"); }}
          className="text-xs text-accent underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (state === "processing") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface/60 p-4">
        <span className="animate-spin text-xl">🔍</span>
        <span className="text-sm text-ink-soft">正在分析画面…</span>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="space-y-2 rounded-2xl border border-green-200 bg-green-50 p-4">
        <p className="text-xs font-semibold text-green-700">✅ 已分析</p>
        <p className="text-sm text-green-800">{description}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{prompt}</p>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={videoRef}
          className="h-48 w-full object-cover"
          playsInline
          muted
        />
        {state === "active" && (
          <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
            {secondsLeft}s
          </div>
        )}
      </div>
      {state === "active" && (
        <button
          type="button"
          onClick={handleCapture}
          className="w-full rounded-2xl bg-accent py-2 text-sm font-semibold text-white"
        >
          📸 拍摄并分析
        </button>
      )}
      {state === "requesting" && (
        <p className="text-center text-xs text-ink-soft">正在启动摄像头…</p>
      )}
    </div>
  );
}
