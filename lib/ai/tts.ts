import { canUseAliyunNlsTts, runAliyunNlsTts } from "@/lib/ai/aliyun-nls-tts";
import { canUseQwenRealtimeTts, streamQwenRealtimeTts } from "@/lib/ai/qwen-tts-realtime";
import { canUseVolcengineTtsV3, runVolcengineTtsV3 } from "@/lib/ai/volcengine-tts-v3";
import { postGatewayJson } from "@/lib/ai/gateway";
import { getCachedTtsResponse, setCachedTtsResponse } from "@/lib/ai/tts-cache";
import { isTtsResponsePayload } from "@/lib/ai/validators";
import { readLocalEnvValue } from "@/lib/server/local-env";
import type { TtsRequestPayload, TtsResponsePayload } from "@/types";

export interface TtsRunResult {
  response: TtsResponsePayload;
  source: "cache" | "volcengine-tts-v3" | "qwen-realtime" | "aliyun-nls" | "gateway" | "mock";
}

/**
 * 将 PCM chunks（base64 数组）拼成 WAV base64。
 * Qwen Realtime TTS 返回 raw PCM，需要加 WAV 头才能在浏览器播放。
 */
function pcmChunksToWavBase64(chunks: string[], sampleRate = 24000): string {
  const pcmBuffers = chunks.map((c) => Buffer.from(c, "base64"));
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
  wavHeader.writeUInt16LE(1, 20);         // PCM
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(dataSize, 40);
  return Buffer.concat([wavHeader, pcmData]).toString("base64");
}

function getTtsProviderOrder() {
  const configured = readLocalEnvValue("TTS_PROVIDER_ORDER")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : ["volcengine-tts-v3", "aliyun-nls", "qwen-realtime"];
}

async function tryQwenRealtimeTts(payload: TtsRequestPayload) {
  if (!canUseQwenRealtimeTts()) {
    return null;
  }

  const sampleRate = Number(readLocalEnvValue("QWEN_TTS_SAMPLE_RATE") || 24000);
  const chunks: string[] = [];
  await streamQwenRealtimeTts(payload, {
    onAudioChunk: (chunk) => chunks.push(chunk),
  });

  if (chunks.length === 0) {
    return null;
  }

  const response: TtsResponsePayload = {
    text: payload.text,
    voiceRole: payload.voiceRole,
    speakerName: payload.speakerName,
    fallbackUsed: false,
    audioBase64: pcmChunksToWavBase64(chunks, sampleRate),
    mimeType: "audio/wav",
  };

  return {
    response,
    source: "qwen-realtime" as const,
  };
}

async function tryAliyunNlsTts(payload: TtsRequestPayload) {
  if (!canUseAliyunNlsTts()) {
    return null;
  }

  const response = await runAliyunNlsTts(payload);
  return {
    response,
    source: "aliyun-nls" as const,
  };
}

async function tryVolcengineTtsV3(payload: TtsRequestPayload) {
  if (!canUseVolcengineTtsV3()) {
    return null;
  }

  const response = await runVolcengineTtsV3(payload);
  return {
    response,
    source: "volcengine-tts-v3" as const,
  };
}

export async function runTts(
  payload: TtsRequestPayload,
): Promise<TtsRunResult> {
  const cachedResponse = getCachedTtsResponse(payload);
  if (cachedResponse) {
    return { response: cachedResponse, source: "cache" };
  }

  for (const provider of getTtsProviderOrder()) {
    try {
      const result =
        provider === "volcengine-tts-v3"
          ? await tryVolcengineTtsV3(payload)
          : provider === "aliyun-nls"
            ? await tryAliyunNlsTts(payload)
            : provider === "qwen-realtime"
              ? await tryQwenRealtimeTts(payload)
              : null;

      if (result) {
        setCachedTtsResponse(payload, result.response);
        return result;
      }
    } catch (err) {
      console.warn("[tts] provider failed", {
        provider,
        message: err instanceof Error ? err.message : err,
      });
    }
  }

  // 三选：Gateway
  const response = await postGatewayJson<TtsResponsePayload>("tts", payload);
  if (response && isTtsResponsePayload(response)) {
    setCachedTtsResponse(payload, response);
    return { response, source: "gateway" };
  }

  // 兜底
  return {
    response: {
      text: payload.text,
      voiceRole: payload.voiceRole,
      speakerName: payload.speakerName,
      fallbackUsed: true,
    },
    source: "mock",
  };
}
