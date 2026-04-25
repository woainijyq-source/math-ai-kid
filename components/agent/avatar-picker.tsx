"use client";
/**
 * AvatarPicker — 预设头像网格 + 自定义上传。
 */

import { useRef, useState } from "react";
import { Avatar } from "./avatar";

// 预设头像列表（emoji 占位，后续可替换为 PNG 路径）
const PRESET_AVATARS = [
  { id: "astronaut", emoji: "🧑‍🚀", label: "宇航员" },
  { id: "cat", emoji: "🐱", label: "小猫" },
  { id: "dinosaur", emoji: "🦕", label: "恐龙" },
  { id: "panda", emoji: "🐼", label: "熊猫" },
  { id: "student", emoji: "🎒", label: "书包" },
  { id: "unicorn", emoji: "🦄", label: "独角兽" },
  { id: "bear", emoji: "🐻", label: "小熊" },
  { id: "fox", emoji: "🦊", label: "狐狸" },
];

interface AvatarPickerProps {
  value?: string;
  onChange: (avatarDataUrl: string) => void;
}

function emojiToDataUrl(emoji: string): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#f3e8ff";
  ctx.fillRect(0, 0, 128, 128);
  ctx.font = "72px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 64, 70);
  return canvas.toDataURL("image/png");
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas context")); return; }
        // 居中裁剪
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePreset(preset: typeof PRESET_AVATARS[0]) {
    setSelectedId(preset.id);
    const dataUrl = emojiToDataUrl(preset.emoji);
    onChange(dataUrl);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 128);
      setSelectedId("custom");
      onChange(dataUrl);
    } catch (err) {
      console.warn("[AvatarPicker] resize failed", err);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-ink-soft">选择头像</label>
      <div className="grid grid-cols-4 gap-2">
        {PRESET_AVATARS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePreset(preset)}
            className={`flex flex-col items-center gap-1 rounded-2xl p-2 transition ${
              selectedId === preset.id
                ? "bg-accent/10 ring-2 ring-accent/50"
                : "bg-white/48 hover:bg-white/80"
            }`}
          >
            <span className="text-2xl">{preset.emoji}</span>
            <span className="text-[10px] text-ink-soft">{preset.label}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-2xl border border-dashed border-accent/24 bg-white/60 px-3 py-2 text-xs font-semibold text-ink-soft hover:border-accent/50 hover:text-accent"
        >
          上传自定义头像
        </button>
        {value && (
          <Avatar src={value} fallback="?" size={40} />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
