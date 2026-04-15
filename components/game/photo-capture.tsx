"use client";
/**
 * T5.2 — PhotoCapture
 * 拍照或选择相册图片，base64 编码后提交。
 */

import { useRef, useState } from "react";
import type { InputType, InputMeta } from "@/types/agent";

interface PhotoCaptureProps {
  prompt: string;
  hints?: string[];
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function PhotoCapture({ prompt, hints, onSubmit }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string) ?? "";
      setPreview(base64);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!preview || submitted) return;
    setSubmitted(true);
    onSubmit("[照片]", "photo", { photoBase64: preview });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{prompt}</p>
      {hints && hints.length > 0 && (
        <ul className="list-inside list-disc space-y-1">
          {hints.map((h, i) => (
            <li key={i} className="text-xs text-ink-soft">{h}</li>
          ))}
        </ul>
      )}

      {/* 预览 */}
      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="预览" className="max-h-48 w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={submitted}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface/60 py-8 text-ink-soft transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm">点击拍照或选择图片</span>
        </button>
      )}

      {/* 隐藏 input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* 提交 / 重拍 */}
      {preview && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreview(null)}
            disabled={submitted}
            className="flex-1 rounded-2xl border border-border py-2 text-sm text-ink-soft disabled:opacity-40"
          >
            重拍
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitted}
            className="flex-1 rounded-2xl bg-accent py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            发送照片
          </button>
        </div>
      )}
    </div>
  );
}
