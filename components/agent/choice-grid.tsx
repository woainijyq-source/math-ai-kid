"use client";

/**
 * ChoiceGrid
 * 打字机 prompt + stagger 选项入场动画，并发预热选项配图。
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChoiceCard } from "@/components/game/choice-card";
import { TypewriterText } from "@/components/agent/typewriter-text";
import type { InputMeta, InputType } from "@/types/agent";
import {
  buildGeneratedImageCacheKey,
  getCachedGeneratedImage,
  requestGeneratedImage,
} from "./generated-image-client";

export interface Choice {
  id: string;
  label: string;
  desc?: string;
  badge?: string;
  imageUrl?: string;
  imageAlt?: string;
  generatePrompt?: string;
}

interface ChoiceGridProps {
  prompt: string;
  choices: Choice[];
  sceneContext?: ChoiceSceneContext | null;
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export interface ChoiceSceneContext {
  sourceId?: string;
  alt?: string;
  generatePrompt?: string;
  referenceImageUrl?: string;
}

type ChoiceImageState = {
  cacheKey: string;
  imageUrl: string | null;
  status: "loading" | "ready" | "failed";
};

function buildChoiceSlotKey(choice: Choice, index: number) {
  return `${choice.id || "choice"}:${index}:${choice.label}`;
}

function buildChoiceImageAlt(choice: Choice) {
  return [choice.label, choice.desc].filter(Boolean).join("：");
}

function buildChoiceImagePrompt(prompt: string, choice: Choice, sceneContext?: ChoiceSceneContext | null) {
  const optionPrompt = choice.generatePrompt?.trim()
    ? choice.generatePrompt.trim()
    : [
        `Current question: ${prompt}`,
        `Option content: ${choice.label}`,
        choice.desc ? `Option detail: ${choice.desc}` : "",
      ].filter(Boolean).join(" ");

  const continuityLines = sceneContext?.generatePrompt || sceneContext?.alt
    ? [
        "Keep strict visual continuity with the question image.",
        "Use the same story world, character design, room/location, lighting, palette, camera distance, and children's picture-book style.",
        sceneContext.generatePrompt ? `Question image prompt: ${sceneContext.generatePrompt}` : "",
        sceneContext.alt ? `Question image description: ${sceneContext.alt}` : "",
      ]
    : [
        "Use a consistent warm children's picture-book style across all option cards.",
      ];

  return [
    "Generate one answer option illustration for a child reasoning conversation.",
    ...continuityLines,
    "The image must depict only this option's outcome or idea, with a clear main subject.",
    "No readable text, captions, UI, labels, buttons, logos, or worksheets inside the image.",
    "Do not change to a generic placeholder or icon; make it a real scene from the same situation.",
    optionPrompt,
  ].filter(Boolean).join(" ");
}

export function buildChoiceImageRequest(prompt: string, choice: Choice, sceneContext?: ChoiceSceneContext | null) {
  const alt = choice.imageAlt?.trim() || buildChoiceImageAlt(choice);
  const generatePrompt = buildChoiceImagePrompt(prompt, choice, sceneContext);
  const sceneKey = sceneContext?.sourceId ? `scene:${sceneContext.sourceId}` : "scene:none";
  const cacheKey = `choice:${buildGeneratedImageCacheKey(`${sceneKey}::${alt}`, generatePrompt)}`;
  return { alt, cacheKey, generatePrompt, referenceImageUrl: sceneContext?.referenceImageUrl };
}

export function preloadChoiceImages(
  prompt: string,
  choices: Choice[],
  sceneContext?: ChoiceSceneContext | null,
) {
  const requests = choices
    .filter((choice) => !choice.imageUrl)
    .map((choice) => buildChoiceImageRequest(prompt, choice, sceneContext))
    .filter((request) => !getCachedGeneratedImage(request.cacheKey));

  requests.forEach((request) => {
    void requestGeneratedImage(
      request.cacheKey,
      request.generatePrompt,
      request.alt,
      request.referenceImageUrl,
      { acceptFallback: false },
    ).catch(() => null);
  });
}

export function ChoiceGrid({ prompt, choices, sceneContext, onSubmit }: ChoiceGridProps) {
  const [selected, setSelected] = useState<{ slotKey: string; signature: string } | null>(null);
  const [completedPrompt, setCompletedPrompt] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Record<string, ChoiceImageState>>({});
  const choiceSignature = useMemo(
    () => choices.map((choice, index) => buildChoiceSlotKey(choice, index)).join("|"),
    [choices],
  );
  const showChoices = completedPrompt === prompt;
  const selectedSlotKey = selected?.signature === choiceSignature ? selected.slotKey : null;

  useEffect(() => {
    let cancelled = false;
    const pendingRequests: Array<{
      slotKey: string;
      alt: string;
      cacheKey: string;
      generatePrompt: string;
      referenceImageUrl?: string;
    }> = [];
    const nextStates: Record<string, ChoiceImageState> = {};

    choices.forEach((choice, index) => {
      if (choice.imageUrl) return;

      const slotKey = buildChoiceSlotKey(choice, index);
      const { alt, cacheKey, generatePrompt, referenceImageUrl } = buildChoiceImageRequest(prompt, choice, sceneContext);
      const cachedUrl = getCachedGeneratedImage(cacheKey);

      if (cachedUrl) {
        nextStates[slotKey] = { cacheKey, imageUrl: cachedUrl, status: "ready" };
        return;
      }

      nextStates[slotKey] = { cacheKey, imageUrl: null, status: "loading" };
      pendingRequests.push({ slotKey, alt, cacheKey, generatePrompt, referenceImageUrl });
    });

    if (Object.keys(nextStates).length > 0) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setGeneratedImages((current) => {
          const next = { ...current };
          for (const [choiceId, state] of Object.entries(nextStates)) {
            const existing = current[choiceId];
            if (existing?.cacheKey === state.cacheKey && existing.status === "ready") continue;
            if (existing?.cacheKey === state.cacheKey && existing.status === "loading" && state.status === "loading") continue;
            next[choiceId] = state;
          }
          return next;
        });
      });
    }

    pendingRequests.forEach((request) => {
      void requestGeneratedImage(
        request.cacheKey,
        request.generatePrompt,
        request.alt,
        request.referenceImageUrl,
        { acceptFallback: false },
      )
        .then((url) => {
          if (cancelled) return;
          setGeneratedImages((current) => ({
            ...current,
            [request.slotKey]: url
              ? { cacheKey: request.cacheKey, imageUrl: url, status: "ready" }
              : { cacheKey: request.cacheKey, imageUrl: null, status: "failed" },
          }));
        })
        .catch(() => {
          if (cancelled) return;
          setGeneratedImages((current) => ({
            ...current,
            [request.slotKey]: {
              cacheKey: request.cacheKey,
              imageUrl: null,
              status: "failed",
            },
          }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [choices, prompt, sceneContext]);

  function handleClick(choice: Choice, slotKey: string) {
    if (selectedSlotKey !== null) return;
    setSelected({ slotKey, signature: choiceSignature });
    onSubmit(choice.label, "choice", { choiceId: choice.id });
  }

  return (
    <div className="bp-choice-box">
      <div className="bp-choice-box-title-row">
        <span className="bp-choice-box-star bp-choice-box-star-gold" aria-hidden="true">★</span>
        <h2 className="bp-choice-prompt">
          <TypewriterText
            key={prompt}
            text={prompt}
            speed={38}
            onComplete={() => setCompletedPrompt(prompt)}
          />
        </h2>
        <span className="bp-choice-box-star bp-choice-box-star-green" aria-hidden="true">★</span>
      </div>
      {showChoices && (
        <div className="bp-choice-grid">
          {choices.map((choice, i) => {
            const slotKey = buildChoiceSlotKey(choice, i);
            const request = choice.imageUrl ? null : buildChoiceImageRequest(prompt, choice, sceneContext);
            const storedGenerated = generatedImages[slotKey];
            const generated = storedGenerated?.cacheKey === request?.cacheKey ? storedGenerated : undefined;
            const imageUrl = choice.imageUrl ?? generated?.imageUrl ?? undefined;
            const imageStatus = choice.imageUrl ? "ready" : generated?.status ?? "loading";

            return (
              <motion.div
                key={slotKey}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, delay: i * 0.08, ease: "easeOut" }}
              >
                <ChoiceCard
                  label={choice.label}
                  description={choice.desc ?? ""}
                  badge={choice.badge}
                  imageUrl={imageUrl}
                  imageStatus={imageStatus}
                  disabled={selectedSlotKey !== null}
                  onClick={() => handleClick(choice, slotKey)}
                />
              </motion.div>
            );
          })}
        </div>
      )}
      <div className="bp-choice-hint">
        <span aria-hidden="true">💡</span>
        <strong>小提示：</strong>
        <span>仔细观察，想一想再选哦！</span>
      </div>
    </div>
  );
}
