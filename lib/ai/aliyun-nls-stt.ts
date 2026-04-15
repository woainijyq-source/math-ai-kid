import type { SttResponsePayload } from "@/types";

const defaultSttUrl = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr";
const defaultSampleRate = 16000;

function getNlsAppKey() {
  return process.env.ALIYUN_NLS_APPKEY ?? "";
}

function getNlsToken() {
  return process.env.ALIYUN_NLS_TOKEN ?? "";
}

function getNlsSttUrl() {
  return process.env.ALIYUN_NLS_STT_URL ?? defaultSttUrl;
}

function getNlsSttSampleRate() {
  const raw = Number(process.env.ALIYUN_NLS_STT_SAMPLE_RATE ?? defaultSampleRate);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultSampleRate;
}

function inferAudioFormat(audio: File) {
  if (audio.type.includes("wav") || audio.name.endsWith(".wav")) return "wav";
  if (audio.type.includes("ogg") || audio.name.endsWith(".ogg")) return "ogg-opus";
  if (audio.type.includes("opus") || audio.name.endsWith(".opus")) return "opus";
  if (audio.type.includes("mp3") || audio.name.endsWith(".mp3")) return "mp3";
  if (audio.type.includes("m4a") || audio.name.endsWith(".m4a")) return "mp4";
  return "wav";
}

export function canUseAliyunNlsStt() {
  return Boolean(getNlsAppKey() && getNlsToken());
}

export async function runAliyunNlsStt(audio: File): Promise<SttResponsePayload> {
  const format = inferAudioFormat(audio);
  const sampleRate = getNlsSttSampleRate();
  const url = new URL(getNlsSttUrl());
  url.searchParams.set("appkey", getNlsAppKey());
  url.searchParams.set("format", format);
  url.searchParams.set("sample_rate", String(sampleRate));
  url.searchParams.set("enable_punctuation_prediction", "true");
  url.searchParams.set("enable_inverse_text_normalization", "true");
  url.searchParams.set("enable_voice_detection", "true");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "X-NLS-Token": getNlsToken(),
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(await audio.arrayBuffer()),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { result?: string; message?: string; status?: number }
    | null;

  if (!response.ok) {
    throw new Error(data?.message || `aliyun_nls_stt_http_${response.status}`);
  }

  const transcript = typeof data?.result === "string" ? data.result.trim() : "";

  return {
    transcript,
    confidence: transcript ? 0.9 : 0,
    fallbackUsed: false,
  };
}
