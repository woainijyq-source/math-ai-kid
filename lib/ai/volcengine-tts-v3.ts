import { readLocalEnvValue } from "@/lib/server/local-env";
import type { TtsRequestPayload, TtsResponsePayload, VoiceRole } from "@/types";

const defaultTtsUrl = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const defaultResourceId = "seed-tts-2.0";
const defaultSampleRate = 24000;
const defaultVoice = "zh_female_xiaohe_uranus_bigtts";

export interface VolcengineTtsV3StreamHandlers {
  onStart?: (meta: {
    model: string;
    sampleRate: number;
    responseFormat: "pcm";
    voice: string;
  }) => void;
  onAudioChunk: (chunkBase64: string) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

function getAppId() {
  return (
    readLocalEnvValue("VOLCENGINE_TTS_APP_ID") ||
    readLocalEnvValue("VOLCENGINE_TTS_APPID")
  );
}

function getApiKey() {
  return (
    readLocalEnvValue("VOLCENGINE_TTS_API_KEY") ||
    readLocalEnvValue("VOLCENGINE_API_KEY") ||
    readLocalEnvValue("DOUBAO_API_KEY")
  );
}

function getAccessKey() {
  return (
    readLocalEnvValue("VOLCENGINE_TTS_ACCESS_KEY") ||
    readLocalEnvValue("VOLCENGINE_TTS_ACCESS_TOKEN") ||
    readLocalEnvValue("VOLCENGINE_TTS_TOKEN")
  );
}

function getAppKey() {
  return (
    readLocalEnvValue("VOLCENGINE_TTS_APP_KEY") ||
    readLocalEnvValue("VOLCENGINE_TTS_APPKEY") ||
    getAppId()
  );
}

function getResourceId() {
  return readLocalEnvValue("VOLCENGINE_TTS_RESOURCE_ID") || defaultResourceId;
}

function getTtsUrl() {
  return readLocalEnvValue("VOLCENGINE_TTS_V3_URL") || defaultTtsUrl;
}

function getSampleRate() {
  const raw = Number(readLocalEnvValue("VOLCENGINE_TTS_SAMPLE_RATE") || defaultSampleRate);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultSampleRate;
}

function getTimeoutMs() {
  const raw = Number(readLocalEnvValue("VOLCENGINE_TTS_TIMEOUT_MS") || 16000);
  return Number.isFinite(raw) && raw > 0 ? raw : 16000;
}

function getVoiceOverride(role: VoiceRole) {
  return readLocalEnvValue(`VOLCENGINE_TTS_VOICE_${role.toUpperCase()}`);
}

function normalizeVolcVoice(voice: string) {
  const trimmed = voice.trim();
  if (!trimmed) return defaultVoice;

  const legacyVoiceMap: Record<string, string> = {
    zh_female_kailangjiejie_moon_bigtts: "zh_female_xiaohe_uranus_bigtts",
    zh_female_linjianvhai_moon_bigtts: "zh_female_xiaohe_uranus_bigtts",
    zh_female_tianmeixiaoyuan_moon_bigtts: "zh_female_tianmeixiaoyuan_uranus_bigtts",
    zh_female_yuanqinvyou_moon_bigtts: "zh_female_vv_uranus_bigtts",
    zh_female_wanwanxiaohe_moon_bigtts: "zh_female_xiaohe_uranus_bigtts",
  };

  return legacyVoiceMap[trimmed] ?? trimmed;
}

function mapVoiceRoleToVolcVoice(role: VoiceRole) {
  const roleOverride = getVoiceOverride(role);
  if (roleOverride) return normalizeVolcVoice(roleOverride);

  const globalOverride = readLocalEnvValue("VOLCENGINE_TTS_VOICE");
  if (globalOverride) return normalizeVolcVoice(globalOverride);

  switch (role) {
    case "opponent":
      return "zh_female_vv_uranus_bigtts";
    case "maker":
      return "zh_female_tianmeixiaoyuan_uranus_bigtts";
    case "parent":
      return "zh_female_cancan_uranus_bigtts";
    case "storyteller":
      return "zh_female_shuangkuaisisi_uranus_bigtts";
    case "guide":
    default:
      return defaultVoice;
  }
}

function buildVolcPayload(payload: TtsRequestPayload, voice: string, sampleRate: number) {
  return {
    user: {
      uid: payload.speakerName || "math-ai-kid",
    },
    req_params: {
      text: payload.text,
      speaker: voice,
      audio_params: {
        format: "pcm",
        sample_rate: sampleRate,
      },
    },
  };
}

function decodeLineJson(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const jsonText = trimmed.startsWith("data:")
    ? trimmed.slice(5).trim()
    : trimmed;

  if (!jsonText || jsonText === "[DONE]") return null;

  try {
    const parsed = JSON.parse(jsonText);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readAudioDelta(event: Record<string, unknown>) {
  for (const key of ["data", "audio", "delta"]) {
    const value = event[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  const result = event.result;
  if (typeof result === "object" && result !== null) {
    const nested = result as Record<string, unknown>;
    if (typeof nested.data === "string" && nested.data.length > 0) return nested.data;
    if (typeof nested.audio === "string" && nested.audio.length > 0) return nested.audio;
  }

  return undefined;
}

function readErrorMessage(event: Record<string, unknown>) {
  const message =
    event.message ??
    event.error ??
    event.err_msg ??
    event.errMsg ??
    event.code;
  return typeof message === "string" && message ? message : undefined;
}

function createAbortController(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), getTimeoutMs());

  const abortListener = () => controller.abort();
  signal?.addEventListener("abort", abortListener, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", abortListener);
    },
  };
}

export function canUseVolcengineTtsV3() {
  return Boolean(getApiKey() || (getAppId() && getAccessKey()));
}

export async function streamVolcengineTtsV3(
  payload: TtsRequestPayload,
  handlers: VolcengineTtsV3StreamHandlers,
) {
  const appId = getAppId();
  const appKey = getAppKey();
  const accessKey = getAccessKey();
  const apiKey = getApiKey();

  if (!apiKey && (!appId || !appKey || !accessKey)) {
    throw new Error("volcengine tts v3 is not configured");
  }

  const sampleRate = getSampleRate();
  const voice = mapVoiceRoleToVolcVoice(payload.voiceRole);
  const abort = createAbortController(handlers.signal);

  try {
    handlers.onStart?.({
      model: getResourceId(),
      sampleRate,
      responseFormat: "pcm",
      voice,
    });

    const response = await fetch(getTtsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey
          ? { "X-Api-Key": apiKey }
          : {
              "X-Api-App-Id": appId,
              "X-Api-App-Key": appKey,
              "X-Api-Access-Key": accessKey,
            }),
        "X-Api-Resource-Id": getResourceId(),
        "X-Api-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify(buildVolcPayload(payload, voice, sampleRate)),
      cache: "no-store",
      signal: abort.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `volcengine_tts_v3_http_${response.status}`);
    }

    if (!response.body) {
      throw new Error("volcengine tts v3 response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedAudio = false;

    const handleLine = (line: string) => {
      const event = decodeLineJson(line);
      if (!event) return;

      const errorMessage = readErrorMessage(event);
      const status = event.status ?? event.code;
      if (
        errorMessage &&
        status !== undefined &&
        String(status) !== "0" &&
        String(status) !== "20000000" &&
        String(status).toLowerCase() !== "ok" &&
        String(status).toLowerCase() !== "success"
      ) {
        throw new Error(errorMessage);
      }

      const delta = readAudioDelta(event);
      if (delta) {
        receivedAudio = true;
        handlers.onAudioChunk(delta);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        handleLine(line);
        newlineIndex = buffer.indexOf("\n");
      }

      if (done) break;
    }

    if (buffer.trim()) {
      handleLine(buffer);
    }

    if (!receivedAudio) {
      throw new Error("volcengine tts v3 completed without audio");
    }

    handlers.onComplete?.();
  } finally {
    abort.cleanup();
  }
}

function pcmChunksToWavBase64(chunks: string[], sampleRate = defaultSampleRate): string {
  const pcmBuffers = chunks.map((chunk) => Buffer.from(chunk, "base64"));
  const pcmData = Buffer.concat(pcmBuffers);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const wavHeader = Buffer.alloc(44);
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + dataSize, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataSize, 40);
  return Buffer.concat([wavHeader, pcmData]).toString("base64");
}

export async function runVolcengineTtsV3(
  payload: TtsRequestPayload,
): Promise<TtsResponsePayload> {
  const chunks: string[] = [];
  let sampleRate = getSampleRate();

  await streamVolcengineTtsV3(payload, {
    onStart(meta) {
      sampleRate = meta.sampleRate;
    },
    onAudioChunk(chunk) {
      chunks.push(chunk);
    },
  });

  return {
    text: payload.text,
    voiceRole: payload.voiceRole,
    speakerName: payload.speakerName,
    fallbackUsed: false,
    audioBase64: pcmChunksToWavBase64(chunks, sampleRate),
    mimeType: "audio/wav",
  };
}
