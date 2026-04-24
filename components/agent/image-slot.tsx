"use client";

import { useEffect, useMemo, useState } from "react";

interface ImageSlotProps {
  alt: string;
  imageUrl?: string;
  generatePrompt?: string;
}

const generatedImageCache = new Map<string, string>();
const inFlightImageRequests = new Map<string, Promise<string | null>>();

function buildCacheKey(alt: string, generatePrompt?: string) {
  return `${alt}::${generatePrompt ?? ""}`;
}

async function requestGeneratedImage(cacheKey: string, prompt: string, alt: string) {
  const existing = inFlightImageRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, alt }),
      });
      const data = (await response.json()) as { imageUrl?: string | null };
      const url = typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? data.imageUrl : null;
      if (url) {
        generatedImageCache.set(cacheKey, url);
      }
      return url;
    } finally {
      inFlightImageRequests.delete(cacheKey);
    }
  })();

  inFlightImageRequests.set(cacheKey, request);
  return request;
}

export function ImageSlot({ alt, imageUrl, generatePrompt }: ImageSlotProps) {
  const cacheKey = useMemo(() => buildCacheKey(alt, generatePrompt), [alt, generatePrompt]);
  const cachedUrl = useMemo(() => generatedImageCache.get(cacheKey) ?? null, [cacheKey]);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(() => generatedImageCache.get(cacheKey) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (imageUrl) {
      return;
    }

    if (cachedUrl) {
      return;
    }

    if (!generatePrompt) {
      return;
    }

    let cancelled = false;

    void requestGeneratedImage(cacheKey, generatePrompt, alt)
      .then((url) => {
        if (cancelled) return;
        if (url) {
          setGeneratedUrl(url);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [alt, cacheKey, cachedUrl, generatePrompt, imageUrl]);

  const src = imageUrl ?? generatedUrl ?? cachedUrl;
  const generating = !src && !failed && Boolean(generatePrompt);

  if (src) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/78 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block w-full object-cover"
          loading="eager"
          onError={() => {
            setGeneratedUrl(null);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-[28px] border-2 border-dashed border-accent/20 bg-white/58 px-4 py-6">
      <div className="text-center">
        <p className="text-2xl">{generating ? "⏳" : failed ? "😵" : "🖼️"}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {generating ? "图片生成中…" : failed ? alt : (generatePrompt ? "准备生成图片…" : alt)}
        </p>
      </div>
    </div>
  );
}
