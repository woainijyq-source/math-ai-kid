import {
  buildGatewayHeaders,
  buildGatewayUrl,
  getGatewayTimeoutMs,
  isRealProviderEnabled,
} from "@/lib/ai/provider";

export type GatewayCapability = "chat" | "stt" | "summary" | "tts" | "vision";

async function performGatewayRequest(
  capability: GatewayCapability,
  init: RequestInit,
) {
  if (!isRealProviderEnabled()) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getGatewayTimeoutMs());

  try {
    const response = await fetch(buildGatewayUrl(capability), {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[ai.gateway]", {
        capability,
        status: response.status,
      });
      return null;
    }

    return response;
  } catch (error) {
    console.warn("[ai.gateway]", {
      capability,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function postGatewayJson<T>(
  capability: GatewayCapability,
  payload: unknown,
): Promise<T | null> {
  const response = await performGatewayRequest(capability, {
    method: "POST",
    headers: buildGatewayHeaders(capability, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response) {
    return null;
  }

  return (await response.json()) as T;
}

export async function postGatewayForm<T>(
  capability: GatewayCapability,
  formData: FormData,
): Promise<T | null> {
  const response = await performGatewayRequest(capability, {
    method: "POST",
    headers: buildGatewayHeaders(capability),
    body: formData,
  });

  if (!response) {
    return null;
  }

  return (await response.json()) as T;
}
