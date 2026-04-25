"use client";
/**
 * Universal Renderer — 社交媒体交替式布局
 * - narrate: 左对齐 AI 气泡，不参与聚焦/模糊
 * - show_choices / show_text_input: 右区域上浮出现，有聚焦光效
 * - 模糊只在有可交互选项时对 narrate 气泡应用
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { preloadTts, useTts } from "@/hooks/use-tts";
import { TEACHER_NAME } from "./teacher-character";

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

function isDisplayTool(name: string) {
  return name === "narrate" || name === "show_image";
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
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{
        opacity: dimmed ? 0.88 : 1,
        x: 0,
        filter: "none",
      }}
      exit={{ opacity: 0, x: -10, transition: { duration: 0.16 } }}
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
  const args = tc.arguments as Record<string, unknown>;
  const promptForSpeech = typeof args.prompt === "string" ? args.prompt : "";
  useTts(promptForSpeech, {
    speakerName: TEACHER_NAME,
    voiceRole: "guide",
    autoSpeak: true,
    enabled: Boolean(promptForSpeech),
  });

  const content = renderInteractiveTool(tc, onUserInput);
  if (!content) return null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: [
          "0 16px 34px rgba(49, 40, 23, 0.08)",
          "0 22px 48px rgba(31, 102, 89, 0.16)",
          "0 16px 34px rgba(49, 40, 23, 0.08)",
        ],
      }}
      exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{
        opacity: { duration: 0.28 },
        y: { duration: 0.35, ease: "easeOut" },
        scale: { duration: 0.35, ease: "easeOut" },
        boxShadow: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
      }}
      className="bp-stage-focus-card"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/55 to-transparent"
        animate={{ opacity: [0.18, 0.76, 0.18], scaleX: [0.72, 1, 0.72] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10">{content}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// show_image — 独立行
// ---------------------------------------------------------------------------

function ImageRow({ tc, dimmed, onComplete }: {
  tc: ToolCallResult;
  dimmed: boolean;
  onComplete: () => void;
}) {
  const args = tc.arguments as Record<string, unknown>;
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, 160);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dimmed ? 0.9 : 1, y: 0, filter: "none" }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }}
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
  const displayCalls = useMemo(
    () => toolCalls.filter((tc) => isDisplayTool(tc.name)),
    [toolCalls],
  );
  const [completedDisplayIds, setCompletedDisplayIds] = useState<Set<string>>(() => new Set());

  const interactives = toolCalls.filter((tc) => isInteractive(tc.name));
  const latestInteractive = interactives[interactives.length - 1];
  const latestInteractivePrompt =
    typeof (latestInteractive?.arguments as Record<string, unknown> | undefined)?.prompt === "string"
      ? String((latestInteractive?.arguments as Record<string, unknown>).prompt)
      : "";
  const visibleDisplayCount = useMemo(() => {
    if (displayCalls.length === 0) return 0;
    let count = 1;
    while (count < displayCalls.length && completedDisplayIds.has(displayCalls[count - 1].id)) {
      count += 1;
    }
    return count;
  }, [completedDisplayIds, displayCalls]);
  const lastDisplayCall = displayCalls[displayCalls.length - 1];
  const interactionReady = !lastDisplayCall || completedDisplayIds.has(lastDisplayCall.id);

  // 系统工具直接跳过
  const SKIP = new Set(["think", "award_badge", "end_activity", "log_observation"]);
  const unknown = toolCalls.filter(
    (tc) => !displayCalls.includes(tc) && !interactives.includes(tc) && !SKIP.has(tc.name)
  );

  function markDisplayComplete(id: string) {
    setCompletedDisplayIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!latestInteractivePrompt) return;
    preloadTts({
      text: latestInteractivePrompt,
      voiceRole: "guide",
      speakerName: TEACHER_NAME,
    });
  }, [latestInteractivePrompt]);

  return (
    <motion.div layout className="bp-stage-tool-stack">
      <AnimatePresence initial={false}>
        {displayCalls.slice(0, visibleDisplayCount).map((tc) => {
          const dimmed = false;
          if (tc.name === "show_image") {
            return (
              <ImageRow
                key={tc.id}
                tc={tc}
                dimmed={Boolean(dimmed)}
                onComplete={() => markDisplayComplete(tc.id)}
              />
            );
          }

          return (
            <NarrateRow
              key={tc.id}
              tc={tc}
              dimmed={Boolean(dimmed)}
              onComplete={() => markDisplayComplete(tc.id)}
            />
          );
        })}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {interactionReady && latestInteractive && (
          <InteractiveRow key={latestInteractive.id} tc={latestInteractive} onUserInput={onUserInput} />
        )}
      </AnimatePresence>

      {interactionReady && unknown.map((tc) => (
        <FallbackSlot key={tc.id} onContinue={() => onUserInput("继续", "text")} />
      ))}
    </motion.div>
  );
}
