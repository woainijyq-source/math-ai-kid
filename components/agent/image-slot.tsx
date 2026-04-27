"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildGeneratedImageCacheKey,
  forgetGeneratedImage,
  getCachedGeneratedImage,
  requestGeneratedImage,
} from "./generated-image-client";

interface ImageSlotProps {
  alt: string;
  imageUrl?: string;
  generatePrompt?: string;
  onImageReady?: (imageUrl: string | null) => void;
}

export function ImageSlot({ alt, imageUrl, generatePrompt, onImageReady }: ImageSlotProps) {
  const cacheKey = useMemo(() => buildGeneratedImageCacheKey(alt, generatePrompt), [alt, generatePrompt]);
  const cachedUrl = useMemo(() => getCachedGeneratedImage(cacheKey), [cacheKey]);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(() => getCachedGeneratedImage(cacheKey));
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const reportedReadyRef = useRef<string | null>(null);

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

  useEffect(() => {
    reportedReadyRef.current = null;
  }, [cacheKey]);

  const reportReady = useCallback((readyUrl: string | null) => {
    const signature = `${cacheKey}:${readyUrl ?? "none"}`;
    if (reportedReadyRef.current === signature) return;
    reportedReadyRef.current = signature;
    onImageReady?.(readyUrl);
  }, [cacheKey, onImageReady]);

  useEffect(() => {
    if (src || generating) return;
    reportReady(null);
  }, [generating, reportReady, src]);

  if (src) {
    return (
      <div className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-white/70 bg-white/78 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block aspect-[16/10] w-full object-cover"
          loading="eager"
          onLoad={() => reportReady(src)}
          onError={() => {
            forgetGeneratedImage(cacheKey);
            setBrokenUrl(src);
            setGeneratedUrl(null);
            setFailed(true);
            reportReady(null);
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
