import { canUseAliyunNlsTts, runAliyunNlsTts } from "@/lib/ai/aliyun-nls-tts";
import { canUseQwenRealtimeTts, streamQwenRealtimeTts } from "@/lib/ai/qwen-tts-realtime";
import { postGatewayJson } from "@/lib/ai/gateway";
import { getCachedTtsResponse, setCachedTtsResponse } from "@/lib/ai/tts-cache";
import { isTtsResponsePayload } from "@/lib/ai/validators";
import type { TtsRequestPayload, TtsResponsePayload } from "@/types";

export interface TtsRunResult {
  response: TtsResponsePayload;
  source: "cache" | "qwen-realtime" | "aliyun-nls" | "gateway" | "mock";
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

export async function runTts(
  payload: TtsRequestPayload,
): Promise<TtsRunResult> {
  const cachedResponse = getCachedTtsResponse(payload);
  if (cachedResponse) {
    return { response: cachedResponse, source: "cache" };
  }

  // 优先：Qwen Realtime TTS（真人 AI 语音，QWEN_API_KEY）
  if (canUseQwenRealtimeTts()) {
    try {
      const sampleRate = Number(process.env.QWEN_TTS_SAMPLE_RATE ?? 24000);
      const chunks: string[] = [];
      await streamQwenRealtimeTts(payload, {
        onAudioChunk: (chunk) => chunks.push(chunk),
      });
      if (chunks.length > 0) {
        const audioBase64 = pcmChunksToWavBase64(chunks, sampleRate);
        const response: TtsResponsePayload = {
          text: payload.text,
          voiceRole: payload.voiceRole,
          speakerName: payload.speakerName,
          fallbackUsed: false,
          audioBase64,
          mimeType: "audio/wav",
        };
        setCachedTtsResponse(payload, response);
        return { response, source: "qwen-realtime" };
      }
    } catch (err) {
      console.warn("[tts] qwen-realtime failed, trying aliyun-nls", err instanceof Error ? err.message : err);
    }
  }

  // 次选：Aliyun NLS TTS（ALIYUN_NLS_APPKEY + TOKEN）
  if (canUseAliyunNlsTts()) {
    try {
      const response = await runAliyunNlsTts(payload);
      setCachedTtsResponse(payload, response);
      return { response, source: "aliyun-nls" };
    } catch (err) {
      console.warn("[tts] aliyun-nls failed, trying gateway", err instanceof Error ? err.message : err);
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
