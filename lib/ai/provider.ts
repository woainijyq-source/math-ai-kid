export type ProviderMode = "mock" | "real";

const defaultPaths = {
  chat: "/chat",
  stt: "/stt",
  summary: "/summary",
  tts: "/tts",
  vision: "/vision",
} as const;

export function resolveProviderMode() {
  if (process.env.AI_PROVIDER_MODE === "real" && process.env.AI_GATEWAY_URL) {
    return "real" satisfies ProviderMode;
  }

  return "mock" satisfies ProviderMode;
}

export function isRealProviderEnabled() {
  return resolveProviderMode() === "real";
}

export function getGatewayTimeoutMs() {
  const raw = Number(process.env.AI_GATEWAY_TIMEOUT_MS ?? 15000);

  if (Number.isFinite(raw) && raw >= 1000) {
    return raw;
  }

  return 15000;
}

export function buildGatewayUrl(capability: keyof typeof defaultPaths) {
  const baseUrl = (process.env.AI_GATEWAY_URL ?? "").replace(/\/+$/, "");
  const overrideKey = `AI_GATEWAY_${capability.toUpperCase()}_PATH` as const;
  const pathValue = process.env[overrideKey] ?? defaultPaths[capability];
  const normalizedPath = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;

  return `${baseUrl}${normalizedPath}`;
}

export function buildGatewayHeaders(
  capability: keyof typeof defaultPaths,
  extraHeaders?: Record<string, string>,
) {
  const headers: Record<string, string> = {
    "X-BrainPlay-Source": "brainplay-web-prototype",
    "X-BrainPlay-Capability": capability,
    ...extraHeaders,
  };

  if (process.env.AI_GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${process.env.AI_GATEWAY_TOKEN}`;
  }

  return headers;
}
