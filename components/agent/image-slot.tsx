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
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
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

  const candidateSrc = imageUrl ?? generatedUrl ?? cachedUrl;
  const src = candidateSrc && candidateSrc !== brokenUrl ? candidateSrc : null;
  const generating = !src && !failed && Boolean(generatePrompt);

  if (src) {
    return (
      <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-white/70 bg-white/78 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block aspect-[16/10] w-full object-cover"
          loading="eager"
          onError={() => {
            generatedImageCache.delete(cacheKey);
            setBrokenUrl(src);
            setGeneratedUrl(null);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[180px] w-full max-w-[560px] items-center justify-center rounded-[24px] border-2 border-dashed border-accent/20 bg-white/58 px-4 py-6">
      <div className="text-center">
        <p className="text-2xl">{generating ? "⏳" : failed ? "😵" : "🖼️"}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {generating ? "图片生成中…" : failed ? alt : (generatePrompt ? "准备生成图片…" : alt)}
        </p>
      </div>
    </div>
  );
}
