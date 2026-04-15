import type { TtsRequestPayload, TtsResponsePayload } from "@/types";

interface TtsCacheEntry {
  value: TtsResponsePayload;
  expiresAt: number;
  lastAccessAt: number;
}

const cache = new Map<string, TtsCacheEntry>();

function getTtlMs() {
  const raw = Number(process.env.TTS_CACHE_TTL_MS ?? 10 * 60 * 1000);
  return Number.isFinite(raw) && raw > 0 ? raw : 10 * 60 * 1000;
}

function getMaxEntries() {
  const raw = Number(process.env.TTS_CACHE_MAX_ENTRIES ?? 80);
  return Number.isFinite(raw) && raw > 0 ? raw : 80;
}

function cloneResponse(response: TtsResponsePayload): TtsResponsePayload {
  return {
    text: response.text,
    voiceRole: response.voiceRole,
    speakerName: response.speakerName,
    fallbackUsed: response.fallbackUsed,
    audioBase64: response.audioBase64,
    mimeType: response.mimeType,
  };
}

function buildCacheKey(payload: TtsRequestPayload) {
  return [
    payload.voiceRole,
    payload.speakerName?.trim() ?? "",
    payload.text.trim(),
  ].join("::");
}

function pruneExpired(now: number) {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function evictIfNeeded() {
  const maxEntries = getMaxEntries();

  if (cache.size < maxEntries) {
    return;
  }

  let oldestKey: string | null = null;
  let oldestAccess = Number.POSITIVE_INFINITY;

  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessAt < oldestAccess) {
      oldestAccess = entry.lastAccessAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

export function getCachedTtsResponse(
  payload: TtsRequestPayload,
): TtsResponsePayload | null {
  const now = Date.now();
  pruneExpired(now);

  const key = buildCacheKey(payload);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  entry.lastAccessAt = now;
  return cloneResponse(entry.value);
}

export function setCachedTtsResponse(
  payload: TtsRequestPayload,
  response: TtsResponsePayload,
) {
  if (!response.audioBase64 || !response.mimeType) {
    return;
  }

  const now = Date.now();
  pruneExpired(now);
  evictIfNeeded();

  cache.set(buildCacheKey(payload), {
    value: cloneResponse(response),
    expiresAt: now + getTtlMs(),
    lastAccessAt: now,
  });
}
