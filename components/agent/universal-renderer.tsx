"use client";
/**
 * Universal Renderer — 社交媒体交替式布局
 * - narrate: 左对齐 AI 气泡，不参与聚焦/模糊
 * - show_choices / show_text_input: 右区域上浮出现，有聚焦光效
 * - 模糊只在有可交互选项时对 narrate 气泡应用
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ToolCallResult, InputType, InputMeta } from "@/types/agent";
import { FallbackSlot } from "./tool-slot";
import { AgentNarrator } from "./agent-narrator";
import {
  ChoiceGrid,
  preloadChoiceImages,
  type Choice,
  type ChoiceSceneContext,
} from "./choice-grid";
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

const EMPTY_CHOICES: Choice[] = [];

function isInteractive(name: string) {
  return INTERACTIVE_TOOLS.has(name);
}

function isDisplayTool(name: string) {
  return name === "narrate" || name === "show_image";
}

function stringifySceneContext(sceneContext?: ChoiceSceneContext | null) {
  return [
    sceneContext?.alt,
    sceneContext?.generatePrompt,
    sceneContext?.referenceImageUrl,
  ].filter(Boolean).join(" ");
}

function isVagueChildPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, "");
  if (!normalized) return true;
  return [
    "林老师在这里陪你",
    "你现在想说什么",
    "现在想说什么",
    "说点什么",
    "先说一句",
    "想慢慢写",
    "可以直接说",
    "轮到你啦",
  ].some((phrase) => normalized.includes(phrase));
}

function isVagueNarration(text: string) {
  const normalized = text.replace(/\s+/g, "");
  if (!normalized) return true;
  return [
    "轻轻接住这一小步",
    "先轻轻接住",
    "林老师在这里陪你",
    "我们继续想一想",
    "好我们先",
  ].some((phrase) => normalized.includes(phrase));
}

function buildSceneQuestion(sceneText: string) {
  if (!sceneText) {
    return "你先说一个你注意到的地方，林老师再顺着你往下想。";
  }

  if (/水果|梨|苹果|橙|香蕉|分|公平|分享|饼干|蛋糕|糖果/.test(sceneText)) {
    return "看着这盘东西，你觉得第一步怎么分，才会让大家觉得比较公平？";
  }
  if (/规律|排序|颜色|红|黄|蓝|形状|下一/.test(sceneText)) {
    return "看着图里的顺序，你发现它是怎么重复的吗？下一步可能是什么？";
  }
  if (/如果|假设|变成|突然|会发生/.test(sceneText)) {
    return "看着这张图，如果这件事真的发生了，第一件变化会是什么？";
  }
  if (/为什么|原因|怎么会|发生|现象/.test(sceneText)) {
    return "看着这张图，你猜这是为什么？先说一个可能的原因就可以。";
  }

  return "看着这张图，你先说一个你注意到的地方，林老师再顺着你往下想。";
}

function buildSceneNarration(sceneText: string) {
  if (/水果|梨|苹果|橙|香蕉|分|公平|分享|饼干|蛋糕|糖果/.test(sceneText)) {
    return "我看到大家正围着一盘东西，我们先想想怎么分才比较合适。";
  }
  if (/规律|排序|颜色|红|黄|蓝|形状|下一/.test(sceneText)) {
    return "我看到图里有一串顺序，我们先找找它重复的地方。";
  }
  if (/如果|假设|变成|突然|会发生/.test(sceneText)) {
    return "这张图像是在发生一个特别的如果，我们先抓住第一件变化。";
  }
  if (/为什么|原因|怎么会|发生|现象/.test(sceneText)) {
    return "这张图里有个值得猜原因的小现象，我们先说一个可能的因为。";
  }
  return "我看到这张图里有个小场景，我们先从最明显的地方开始说。";
}

function withContextualPrompt(tc: ToolCallResult, sceneContext?: ChoiceSceneContext | null) {
  const args = tc.arguments as Record<string, unknown>;
  const rawPrompt = typeof args.prompt === "string" ? args.prompt : "";
  if (!isVagueChildPrompt(rawPrompt)) return tc;

  return {
    ...tc,
    arguments: {
      ...args,
      prompt: buildSceneQuestion(stringifySceneContext(sceneContext)),
    },
  };
}

// ---------------------------------------------------------------------------
// 渲染单个交互工具（无 ToolSlot 包装，直接渲染）
// ---------------------------------------------------------------------------

function renderInteractiveTool(
  tc: ToolCallResult,
  onUserInput: OnUserInput,
  sceneContext?: ChoiceSceneContext | null,
) {
  const args = tc.arguments as Record<string, unknown>;
  switch (tc.name) {
    case "show_choices": {
      const choices = (args.choices as Array<{
        id: string;
        label: string;
        desc?: string;
        badge?: string;
        imageUrl?: string;
        imageAlt?: string;
        generatePrompt?: string;
      }>) ?? [];
      return (
        <ChoiceGrid
          prompt={String(args.prompt ?? "")}
          choices={choices}
          sceneContext={sceneContext}
          onSubmit={onUserInput}
        />
      );
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

function NarrateRow({ tc, dimmed, sceneText, shouldAutoSpeak, onComplete }: {
  tc: ToolCallResult;
  dimmed: boolean;
  sceneText?: string;
  shouldAutoSpeak: boolean;
  onComplete: () => void;
}) {
  const args = tc.arguments as Record<string, unknown>;
  const rawText = String(args.text ?? "");
  const text = sceneText && isVagueNarration(rawText)
    ? buildSceneNarration(sceneText)
    : rawText;
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
        text={text}
        speakerName={args.speakerName as string | undefined}
        voiceRole={args.voiceRole as string | undefined}
        autoSpeak={shouldAutoSpeak && args.autoSpeak !== false}
        onComplete={onComplete}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 交互区域（choices/input）— 上浮入场，有聚焦光效
// ---------------------------------------------------------------------------

function InteractiveRow({ tc, sceneContext, onUserInput }: {
  tc: ToolCallResult;
  sceneContext?: ChoiceSceneContext | null;
  onUserInput: OnUserInput;
}) {
  const contextualToolCall = withContextualPrompt(tc, sceneContext);
  const args = contextualToolCall.arguments as Record<string, unknown>;
  const promptForSpeech = typeof args.prompt === "string" ? args.prompt : "";
  useTts(promptForSpeech, {
    speakerName: TEACHER_NAME,
    voiceRole: "guide",
    autoSpeak: true,
    enabled: Boolean(promptForSpeech),
  });

  const content = renderInteractiveTool(contextualToolCall, onUserInput, sceneContext);
  if (!content) return null;
  const isChoiceTool = tc.name === "show_choices";
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
      className={`bp-stage-focus-card ${isChoiceTool ? "bp-stage-focus-card-choice" : ""}`}
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
  onComplete: (imageUrl?: string) => void;
}) {
  const args = tc.arguments as Record<string, unknown>;
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, 180000);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const handleImageReady = useCallback((imageUrl: string | null) => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(imageUrl ?? undefined);
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
        onImageReady={handleImageReady}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Universal Renderer
// ---------------------------------------------------------------------------

export function UniversalRenderer({
  toolCalls,
  sceneContextFallback,
  onUserInput,
}: {
  toolCalls: ToolCallResult[];
  sceneContextFallback?: ChoiceSceneContext | null;
  onUserInput: OnUserInput;
}) {
  const displayCalls = useMemo(
    () => toolCalls.filter((tc) => isDisplayTool(tc.name)),
    [toolCalls],
  );
  const [completedDisplayIds, setCompletedDisplayIds] = useState<Set<string>>(() => new Set());
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});
  const preloadedChoiceSignatureRef = useRef<string | null>(null);

  const interactives = toolCalls.filter((tc) => isInteractive(tc.name));
  const latestInteractive = interactives[interactives.length - 1];
  const latestInteractiveIndex = latestInteractive
    ? toolCalls.findIndex((tc) => tc.id === latestInteractive.id)
    : -1;
  let latestInteractiveSceneContext: ChoiceSceneContext | null = sceneContextFallback ?? null;
  if (latestInteractive) {
    const previousCalls = latestInteractiveIndex >= 0
      ? toolCalls.slice(0, latestInteractiveIndex)
      : toolCalls;
    const imageCall = [...previousCalls].reverse().find((tc) => tc.name === "show_image");
    if (imageCall) {
      const args = imageCall.arguments as Record<string, unknown>;
      const alt = typeof args.alt === "string" ? args.alt : undefined;
      const generatePrompt = typeof args.generatePrompt === "string" ? args.generatePrompt : undefined;
      const explicitImageUrl = typeof args.imageUrl === "string" ? args.imageUrl : undefined;
      const referenceImageUrl = explicitImageUrl ?? resolvedImageUrls[imageCall.id];

      latestInteractiveSceneContext = alt || generatePrompt || referenceImageUrl
        ? {
            sourceId: imageCall.id,
            alt,
            generatePrompt,
            referenceImageUrl,
          }
        : sceneContextFallback ?? null;
    }
  }
  const latestChoiceSceneSourceId = latestInteractiveSceneContext?.sourceId;
  const latestChoiceSceneAlt = latestInteractiveSceneContext?.alt;
  const latestChoiceSceneGeneratePrompt = latestInteractiveSceneContext?.generatePrompt;
  const latestChoiceSceneReferenceImageUrl = latestInteractiveSceneContext?.referenceImageUrl;
  const latestInteractivePrompt =
    typeof (latestInteractive?.arguments as Record<string, unknown> | undefined)?.prompt === "string"
      ? String((latestInteractive?.arguments as Record<string, unknown>).prompt)
      : "";
  const latestChoiceArgs = latestInteractive?.name === "show_choices"
    ? (latestInteractive.arguments as Record<string, unknown>)
    : null;
  const latestChoiceItems = Array.isArray(latestChoiceArgs?.choices)
    ? (latestChoiceArgs.choices as Choice[])
    : EMPTY_CHOICES;
  const latestChoicePreloadSignature = latestChoiceArgs
    ? [
        latestInteractive?.id,
        latestInteractivePrompt,
        latestChoiceItems
          .map((choice, index) => [
            index,
            choice.id,
            choice.label,
            choice.desc ?? "",
            choice.imageUrl ?? "",
            choice.imageAlt ?? "",
            choice.generatePrompt ?? "",
          ].join("~"))
          .join("|"),
        latestChoiceSceneSourceId ?? "",
        latestChoiceSceneAlt ?? "",
        latestChoiceSceneGeneratePrompt ?? "",
        latestChoiceSceneReferenceImageUrl ? "ref" : "",
      ].join("::")
    : "";
  const shouldSpeakNarration = !latestInteractivePrompt;
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

  const markDisplayComplete = useCallback((id: string) => {
    setCompletedDisplayIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const markImageComplete = useCallback((id: string, imageUrl?: string) => {
    if (imageUrl) {
      setResolvedImageUrls((current) => (
        current[id] === imageUrl ? current : { ...current, [id]: imageUrl }
      ));
    }
    markDisplayComplete(id);
  }, [markDisplayComplete]);

  useEffect(() => {
    if (!latestInteractivePrompt) return;
    preloadTts({
      text: latestInteractivePrompt,
      voiceRole: "guide",
      speakerName: TEACHER_NAME,
    });
  }, [latestInteractivePrompt]);

  useEffect(() => {
    if (!latestChoiceArgs || latestChoiceItems.length === 0) return;
    if (preloadedChoiceSignatureRef.current === latestChoicePreloadSignature) return;
    preloadedChoiceSignatureRef.current = latestChoicePreloadSignature;

    const sceneContext = latestChoiceSceneSourceId || latestChoiceSceneAlt || latestChoiceSceneGeneratePrompt || latestChoiceSceneReferenceImageUrl
      ? {
          sourceId: latestChoiceSceneSourceId,
          alt: latestChoiceSceneAlt,
          generatePrompt: latestChoiceSceneGeneratePrompt,
          referenceImageUrl: latestChoiceSceneReferenceImageUrl,
        }
      : null;

    preloadChoiceImages(
      latestInteractivePrompt,
      latestChoiceItems,
      sceneContext,
    );
  }, [
    latestChoiceArgs,
    latestChoiceItems,
    latestChoicePreloadSignature,
    latestInteractivePrompt,
    latestChoiceSceneSourceId,
    latestChoiceSceneAlt,
    latestChoiceSceneGeneratePrompt,
    latestChoiceSceneReferenceImageUrl,
  ]);

  return (
    <motion.div layout className="bp-stage-tool-stack">
      <AnimatePresence initial={false}>
        {displayCalls.slice(0, visibleDisplayCount).map((tc, index) => {
          const dimmed = false;
          if (tc.name === "show_image") {
            return (
              <ImageRow
                key={tc.id}
                tc={tc}
                dimmed={Boolean(dimmed)}
                onComplete={(imageUrl) => markImageComplete(tc.id, imageUrl)}
              />
            );
          }

          return (
            <NarrateRow
              key={tc.id}
              tc={tc}
              dimmed={Boolean(dimmed)}
              shouldAutoSpeak={shouldSpeakNarration}
              sceneText={stringifySceneContext(
                ([...displayCalls.slice(index + 1), ...displayCalls.slice(0, index)]
                  .find((call) => call.name === "show_image")?.arguments as ChoiceSceneContext | undefined) ?? null,
              )}
              onComplete={() => markDisplayComplete(tc.id)}
            />
          );
        })}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {interactionReady && latestInteractive && (
          <InteractiveRow
            key={latestInteractive.id}
            tc={latestInteractive}
            sceneContext={latestInteractiveSceneContext}
            onUserInput={onUserInput}
          />
        )}
      </AnimatePresence>

      {interactionReady && unknown.map((tc) => (
        <FallbackSlot key={tc.id} onContinue={() => onUserInput("继续", "text")} />
      ))}
    </motion.div>
  );
}
