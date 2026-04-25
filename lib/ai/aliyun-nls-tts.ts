import { readLocalEnvValue } from "@/lib/server/local-env";
import { hasAliyunNlsTokenConfig, resolveAliyunNlsToken } from "@/lib/ai/aliyun-nls-token";
import type { TtsRequestPayload, TtsResponsePayload } from "@/types";

const defaultTtsUrl = "https://nls-gateway-cn-beijing.aliyuncs.com/stream/v1/tts";

function getNlsAppKey() {
  return readLocalEnvValue("ALIYUN_NLS_APPKEY");
}

function getNlsUrl() {
  return readLocalEnvValue("ALIYUN_NLS_TTS_URL") || defaultTtsUrl;
}

function getNlsTimeoutMs() {
  const raw = Number(readLocalEnvValue("ALIYUN_NLS_TTS_TIMEOUT_MS") || 12000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12000;
}

function getNlsSampleRate() {
  const raw = Number(readLocalEnvValue("ALIYUN_NLS_TTS_SAMPLE_RATE") || 24000);
  return Number.isFinite(raw) && raw > 0 ? raw : 24000;
}

function mapVoiceRoleToNlsVoice(payload: TtsRequestPayload) {
  const configured = readLocalEnvValue(`ALIYUN_NLS_VOICE_${payload.voiceRole.toUpperCase()}`);

  if (configured) {
    return configured;
  }

  const globalConfigured = readLocalEnvValue("ALIYUN_NLS_VOICE");

  if (globalConfigured) {
    return globalConfigured;
  }

  switch (payload.voiceRole) {
    case "opponent":
      return "siqi";
    case "maker":
      return "siyue";
    case "parent":
      return "ruoxi";
    case "guide":
      return "ruoxi";
    case "storyteller":
    default:
      return "siqi";
  }
}

async function requestNlsTts(payload: TtsRequestPayload, voice: string) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), getNlsTimeoutMs());
  const token = await resolveAliyunNlsToken();

  try {
    return await fetch(getNlsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NLS-Token": token,
      },
      body: JSON.stringify({
        appkey: getNlsAppKey(),
        token,
        text: payload.text,
        format: "mp3",
        sample_rate: getNlsSampleRate(),
        voice,
        volume: 50,
        speech_rate: -40,
        pitch_rate: 0,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("aliyun nls tts timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function canUseAliyunNlsTts() {
  return Boolean(getNlsAppKey() && hasAliyunNlsTokenConfig());
}

export async function runAliyunNlsTts(
  payload: TtsRequestPayload,
): Promise<TtsResponsePayload> {
  const primaryVoice = mapVoiceRoleToNlsVoice(payload);
  let response = await requestNlsTts(payload, primaryVoice);
  let contentType = response.headers.get("content-type") ?? "";

  if ((!response.ok || !contentType.startsWith("audio/")) && primaryVoice !== "xiaoyun") {
    response = await requestNlsTts(payload, "xiaoyun");
    contentType = response.headers.get("content-type") ?? "";
  }

  if (!response.ok || !contentType.startsWith("audio/")) {
    const errorText = await response.text();
    throw new Error(errorText || "aliyun nls tts failed");
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return {
    text: payload.text,
    voiceRole: payload.voiceRole,
    speakerName: payload.speakerName,
    fallbackUsed: false,
    audioBase64: audioBuffer.toString("base64"),
    mimeType: contentType,
  };
}
