import type { TtsRequestPayload, TtsResponsePayload } from "@/types";

const defaultTtsUrl = "https://nls-gateway-cn-beijing.aliyuncs.com/stream/v1/tts";

function getNlsAppKey() {
  return process.env.ALIYUN_NLS_APPKEY ?? "";
}

function getNlsToken() {
  return process.env.ALIYUN_NLS_TOKEN ?? "";
}

function getNlsUrl() {
  return process.env.ALIYUN_NLS_TTS_URL ?? defaultTtsUrl;
}

function getNlsTimeoutMs() {
  const raw = Number(process.env.ALIYUN_NLS_TTS_TIMEOUT_MS ?? 12000);
  return Number.isFinite(raw) && raw > 0 ? raw : 12000;
}

function mapVoiceRoleToNlsVoice(payload: TtsRequestPayload) {
  const configured = process.env[`ALIYUN_NLS_VOICE_${payload.voiceRole.toUpperCase()}`]?.trim();

  if (configured) {
    return configured;
  }

  const globalConfigured = process.env.ALIYUN_NLS_VOICE?.trim();

  if (globalConfigured) {
    return globalConfigured;
  }

  switch (payload.voiceRole) {
    case "opponent":
      return "xiaogang";
    case "maker":
      return "aida";
    case "parent":
      return "xiaoyun";
    case "guide":
      return "xiaoyun";
    case "storyteller":
    default:
      return "xiaoyun";
  }
}

async function requestNlsTts(payload: TtsRequestPayload, voice: string) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), getNlsTimeoutMs());

  try {
    return await fetch(getNlsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NLS-Token": getNlsToken(),
      },
      body: JSON.stringify({
        appkey: getNlsAppKey(),
        token: getNlsToken(),
        text: payload.text,
        format: "mp3",
        sample_rate: 16000,
        voice,
        volume: 50,
        speech_rate: 0,
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
  return Boolean(getNlsAppKey() && getNlsToken());
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
