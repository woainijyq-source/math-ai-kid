"use client";

const generatedImageCache = new Map<string, string>();
const inFlightImageRequests = new Map<string, Promise<string | null>>();
const inFlightBatchRequests = new Map<string, Promise<Record<string, string | null>>>();

interface GeneratedImageBatchItem {
  cacheKey: string;
  prompt: string;
  alt: string;
  referenceImageUrl?: string;
}

export function buildGeneratedImageCacheKey(alt: string, generatePrompt?: string) {
  return `${alt}::${generatePrompt ?? ""}`;
}

export function getCachedGeneratedImage(cacheKey: string) {
  return generatedImageCache.get(cacheKey) ?? null;
}

export function forgetGeneratedImage(cacheKey: string) {
  generatedImageCache.delete(cacheKey);
}

export async function requestGeneratedImage(
  cacheKey: string,
  prompt: string,
  alt: string,
  referenceImageUrl?: string,
  options: { acceptFallback?: boolean } = {},
) {
  const existing = inFlightImageRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, alt, referenceImageUrl }),
      });
      const data = (await response.json()) as { imageUrl?: string | null; fallbackUsed?: boolean };
      const url = typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? data.imageUrl : null;
      if (url && data.fallbackUsed && options.acceptFallback === false) {
        return null;
      }
      if (url && !data.fallbackUsed) {
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

export async function requestGeneratedImagesBatch(items: GeneratedImageBatchItem[]) {
  const missingItems = items.filter((item) => !generatedImageCache.has(item.cacheKey));
  const cachedResults = Object.fromEntries(
    items
      .filter((item) => generatedImageCache.has(item.cacheKey))
      .map((item) => [item.cacheKey, generatedImageCache.get(item.cacheKey) ?? null]),
  ) as Record<string, string | null>;

  if (missingItems.length === 0) {
    return cachedResults;
  }

  const batchKey = missingItems.map((item) => item.cacheKey).sort().join("||");
  const existing = inFlightBatchRequests.get(batchKey);
  if (existing) {
    const batchResults = await existing;
    return { ...cachedResults, ...batchResults };
  }

  const request = (async () => {
    try {
      const sharedReferenceImageUrl = missingItems[0]?.referenceImageUrl;
      const canShareReference = missingItems.every(
        (item) => item.referenceImageUrl === sharedReferenceImageUrl,
      );
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrl: canShareReference ? sharedReferenceImageUrl : undefined,
          items: missingItems.map((item) => ({
            cacheKey: item.cacheKey,
            prompt: item.prompt,
            alt: item.alt,
            referenceImageUrl: canShareReference ? undefined : item.referenceImageUrl,
          })),
        }),
      });
      const data = (await response.json()) as {
        images?: Array<{ cacheKey?: string; imageUrl?: string | null; fallbackUsed?: boolean }>;
      };
      const results: Record<string, string | null> = {};

      for (const item of missingItems) {
        const match = data.images?.find((image) => image.cacheKey === item.cacheKey);
        const url = typeof match?.imageUrl === "string" && match.imageUrl.length > 0 ? match.imageUrl : null;
        results[item.cacheKey] = url;
        if (url && !match?.fallbackUsed) {
          generatedImageCache.set(item.cacheKey, url);
        }
      }

      return results;
    } finally {
      inFlightBatchRequests.delete(batchKey);
    }
  })();

  inFlightBatchRequests.set(batchKey, request);
  const batchResults = await request;
  return { ...cachedResults, ...batchResults };
}
