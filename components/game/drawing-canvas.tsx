"use client";
/**
 * T6.3 — DrawingCanvas
 * 简单画板：Canvas 2D，支持画线、选颜色、清除、导出提交。
 */

import { useRef, useState, useEffect } from "react";
import type { InputType, InputMeta } from "@/types/agent";

interface DrawingCanvasProps {
  prompt: string;
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

const COLORS = ["#1C1917", "#F97316", "#3B82F6", "#10B981", "#EF4444", "#A855F7", "#FBBF24"];

export function DrawingCanvas({ prompt, onSubmit }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(4);
  const [submitted, setSubmitted] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // 初始化 canvas 背景
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFBF7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (submitted) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || submitted) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFBF7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function handleSubmit() {
    if (submitted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    setSubmitted(true);
    onSubmit("[我的画]", "drawing", { photoBase64: base64 });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold leading-6 text-foreground">{prompt}</p>

      {/* 颜色选择 */}
      <div className="flex items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-2 transition ${
              color === c ? "border-foreground scale-110" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-soft">粗细</span>
          {[2, 4, 8].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setLineWidth(w)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                lineWidth === w ? "border-accent bg-accent/10" : "border-border bg-white/70"
              }`}
            >
              <div
                className="rounded-full bg-foreground"
                style={{ width: w + 4, height: w + 4 }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 画布 */}
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className={`w-full touch-none rounded-[28px] border border-white/70 bg-white shadow-sm ${
          submitted ? "opacity-60" : "cursor-crosshair"
        }`}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={submitted}
          className="bp-button-secondary flex-1 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
        >
          清除
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="bp-button-primary flex-1 py-3 text-sm disabled:pointer-events-none disabled:opacity-40"
        >
          {submitted ? "已提交 ✓" : "完成"}
        </button>
      </div>
    </div>
  );
}
