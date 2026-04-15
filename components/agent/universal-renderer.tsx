"use client";
/**
 * Universal Renderer — 社交媒体交替式布局
 * - narrate: 左对齐 AI 气泡，不参与聚焦/模糊
 * - show_choices / show_text_input: 右区域上浮出现，有聚焦光效
 * - 模糊只在有可交互选项时对 narrate 气泡应用
 */

import { useState } from "react";
import { motion } from "framer-motion";
import type { ToolCallResult, InputType, InputMeta } from "@/types/agent";
import { FallbackSlot } from "./tool-slot";
import { AgentNarrator } from "./agent-narrator";
import { ChoiceGrid } from "./choice-grid";
import { ImageSlot } from "./image-slot";
import { VoiceInputSlot } from "./voice-input-slot";
import { TextInputSlot } from "@/components/game/text-input-slot";
import { NumberInputSlot } from "@/components/game/number-input-slot";
import { PhotoCapture } from "@/components/game/photo-capture";
import { EmotionCheckin } from "@/components/game/emotion-checkin";
import { DragBoard } from "@/components/game/drag-board";
import { CameraView } from "@/components/agent/camera-view";
import { DrawingCanvas } from "@/components/game/drawing-canvas";

type OnUserInput = (input: string, type: InputType, meta?: InputMeta) => void;

// ---------------------------------------------------------------------------
// DragBoard wrapper
// ---------------------------------------------------------------------------

function DragBoardSlot({ args, onUserInput }: { args: Record<string, unknown>; onUserInput: OnUserInput }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <DragBoard
      selected={selected}
      onSelect={(f) => setSelected((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f])}
      fragments={args.fragments as string[] | undefined}
      prompt={args.prompt as string | undefined}
      submitLabel={args.submitLabel as string | undefined}
      onSubmit={onUserInput}
    />
  );
}

// ---------------------------------------------------------------------------
// 工具类型分类
// ---------------------------------------------------------------------------

const INTERACTIVE_TOOLS = new Set([
  "show_choices", "show_text_input", "request_voice",
  "show_number_input", "request_photo", "show_emotion_checkin",
  "request_camera", "show_drawing_canvas", "show_drag_board",
]);

function isInteractive(name: string) {
  return INTERACTIVE_TOOLS.has(name);
}

// ---------------------------------------------------------------------------
// 渲染单个交互工具（无 ToolSlot 包装，直接渲染）
// ---------------------------------------------------------------------------

function renderInteractiveTool(tc: ToolCallResult, onUserInput: OnUserInput) {
  const args = tc.arguments as Record<string, unknown>;
  switch (tc.name) {
    case "show_choices": {
      const choices = (args.choices as Array<{ id: string; label: string; desc?: string; badge?: string }>) ?? [];
      return <ChoiceGrid prompt={String(args.prompt ?? "")} choices={choices} onSubmit={onUserInput} />;
    }
    case "show_text_input":
      return <TextInputSlot prompt={String(args.prompt ?? "")} placeholder={args.placeholder as string | undefined} submitLabel={args.submitLabel as string | undefined} onSubmit={onUserInput} />;
    case "request_voice":
      return <VoiceInputSlot prompt={String(args.prompt ?? "")} language={args.language as string | undefined} onSubmit={onUserInput} />;
    case "show_number_input":
      return <NumberInputSlot prompt={String(args.prompt ?? "")} min={typeof args.min === "number" ? args.min : undefined} max={typeof args.max === "number" ? args.max : undefined} step={typeof args.step === "number" ? args.step : undefined} defaultValue={typeof args.defaultValue === "number" ? args.defaultValue : undefined} onSubmit={onUserInput} />;
    case "request_photo":
      return <PhotoCapture prompt={String(args.prompt ?? "")} hints={Array.isArray(args.hints) ? (args.hints as string[]) : undefined} onSubmit={onUserInput} />;
    case "show_emotion_checkin":
      return <EmotionCheckin onSubmit={onUserInput} />;
    case "show_drag_board":
      return <DragBoardSlot args={args} onUserInput={onUserInput} />;
    case "request_camera":
      return <CameraView prompt={String(args.prompt ?? "")} hints={Array.isArray(args.hints) ? (args.hints as string[]) : undefined} duration={typeof args.duration === "number" ? args.duration : undefined} onSubmit={onUserInput} />;
    case "show_drawing_canvas":
      return <DrawingCanvas prompt={String(args.prompt ?? "")} onSubmit={onUserInput} />;
    default:
      return <FallbackSlot onContinue={() => onUserInput("继续", "text")} />;
  }
}

// ---------------------------------------------------------------------------
// AI 气泡（narrate）— 左对齐，不参与模糊
// ---------------------------------------------------------------------------

function NarrateRow({ tc, dimmed, onComplete }: {
  tc: ToolCallResult;
  dimmed: boolean;
  onComplete: () => void;
}) {
  const args = tc.arguments as Record<string, unknown>;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: dimmed ? 0.55 : 1, x: 0, filter: dimmed ? "blur(1.5px)" : "none" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <AgentNarrator
        text={String(args.text ?? "")}
        speakerName={args.speakerName as string | undefined}
        voiceRole={args.voiceRole as string | undefined}
        autoSpeak={args.autoSpeak !== false}
        onComplete={onComplete}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 交互区域（choices/input）— 上浮入场，有聚焦光效
// ---------------------------------------------------------------------------

function InteractiveRow({ tc, onUserInput }: {
  tc: ToolCallResult;
  onUserInput: OnUserInput;
}) {
  const content = renderInteractiveTool(tc, onUserInput);
  if (!content) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative rounded-[20px] border border-border/60 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-sm"
      style={{
        boxShadow: "0 8px 32px rgba(31,102,89,0.13), 0 0 0 2px rgba(31,102,89,0.07)",
      }}
    >
      {/* 聚焦光斑 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[20px]"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,250,235,0.55) 0%, transparent 65%)",
        }}
      />
      <div className="relative z-10">{content}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// show_image — 独立行
// ---------------------------------------------------------------------------

function ImageRow({ tc }: { tc: ToolCallResult }) {
  const args = tc.arguments as Record<string, unknown>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-start"
    >
      <ImageSlot
        alt={String(args.alt ?? "")}
        imageUrl={args.imageUrl as string | undefined}
        generatePrompt={args.generatePrompt as string | undefined}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Universal Renderer
// ---------------------------------------------------------------------------

export function UniversalRenderer({
  toolCalls,
  onUserInput,
}: {
  toolCalls: ToolCallResult[];
  onUserInput: OnUserInput;
}) {
  // 打字机完成后才显示交互区
  const [narrateDone, setNarrateDone] = useState(false);

  // 分类
  const narrates = toolCalls.filter((tc) => tc.name === "narrate");
  const images = toolCalls.filter((tc) => tc.name === "show_image");
  const interactives = toolCalls.filter((tc) => isInteractive(tc.name));
  const latestInteractive = interactives[interactives.length - 1];
  const hasInteractive = interactives.length > 0;

  // 系统工具直接跳过
  const SKIP = new Set(["think", "award_badge", "end_activity", "log_observation"]);
  const unknown = toolCalls.filter(
    (tc) => !narrates.includes(tc) && !images.includes(tc) && !interactives.includes(tc) && !SKIP.has(tc.name)
  );

  return (
    <div className="space-y-3">
      {/* 1. 图片（AI 侧，左对齐） */}
      {images.map((tc) => <ImageRow key={tc.id} tc={tc} />)}

      {/* 2. AI 气泡（narrate）— 左对齐，最近2条清晰，更早的模糊 */}
      {narrates.map((tc, i) => {
        // 最近 2 条 narrate 保持清晰，更早的模糊
        const isRecent = i >= narrates.length - 2;
        const dimmed = hasInteractive && narrateDone && !isRecent;
        return (
          <NarrateRow
            key={tc.id}
            tc={tc}
            dimmed={dimmed}
            onComplete={() => {
              if (i === narrates.length - 1) setNarrateDone(true);
            }}
          />
        );
      })}

      {/* 3. 交互区（choices/input）— 上浮入场，打字机完成后出现 */}
      {(narrateDone || narrates.length === 0) && latestInteractive && (
        <InteractiveRow key={latestInteractive.id} tc={latestInteractive} onUserInput={onUserInput} />
      )}

      {/* 4. 未知工具兜底 */}
      {unknown.map((tc) => (
        <FallbackSlot key={tc.id} onContinue={() => onUserInput("继续", "text")} />
      ))}
    </div>
  );
}
