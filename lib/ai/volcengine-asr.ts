import WebSocket from "ws";
import { gzipSync, gunzipSync } from "node:zlib";
import { readLocalEnvValue } from "@/lib/server/local-env";
import type { SttResponsePayload } from "@/types";

const defaultAsrUrl = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
const defaultResourceId = "volc.seedasr.sauc.duration";
const defaultSampleRate = 16000;
const audioChunkSize = 32 * 1024;

const PROTOCOL_VERSION = 0x1;
const HEADER_SIZE = 0x1;
const MESSAGE_TYPE_FULL_CLIENT_REQUEST = 0x1;
const MESSAGE_TYPE_AUDIO_ONLY_REQUEST = 0x2;
const MESSAGE_TYPE_FULL_SERVER_RESPONSE = 0x9;
const MESSAGE_TYPE_SERVER_ACK = 0xb;
const MESSAGE_TYPE_ERROR_RESPONSE = 0xf;
const FLAG_NO_SEQUENCE = 0x0;
const FLAG_POS_SEQUENCE = 0x1;
const FLAG_NEG_SEQUENCE = 0x2;
const SERIALIZATION_NONE = 0x0;
const SERIALIZATION_JSON = 0x1;
const COMPRESSION_GZIP = 0x1;

function getAppId() {
  return (
    readLocalEnvValue("VOLCENGINE_ASR_APP_ID") ||
    readLocalEnvValue("VOLCENGINE_ASR_APPID")
  );
}

function getApiKey() {
  return (
    readLocalEnvValue("VOLCENGINE_ASR_API_KEY") ||
    readLocalEnvValue("VOLCENGINE_API_KEY") ||
    readLocalEnvValue("DOUBAO_API_KEY")
  );
}

function getAccessToken() {
  return (
    readLocalEnvValue("VOLCENGINE_ASR_ACCESS_TOKEN") ||
    readLocalEnvValue("VOLCENGINE_ASR_TOKEN")
  );
}

function getCluster() {
  return readLocalEnvValue("VOLCENGINE_ASR_CLUSTER");
}

function getResourceId() {
  return readLocalEnvValue("VOLCENGINE_ASR_RESOURCE_ID") || defaultResourceId;
}

function getAsrUrl() {
  return readLocalEnvValue("VOLCENGINE_ASR_URL") || defaultAsrUrl;
}

function getSampleRate() {
  const raw = Number(readLocalEnvValue("VOLCENGINE_ASR_SAMPLE_RATE") || defaultSampleRate);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultSampleRate;
}

function getTimeoutMs() {
  const raw = Number(readLocalEnvValue("VOLCENGINE_ASR_TIMEOUT_MS") || 16000);
  return Number.isFinite(raw) && raw > 0 ? raw : 16000;
}

function buildHeader(messageType: number, flags: number, serialization: number, compression: number) {
  return Buffer.from([
    (PROTOCOL_VERSION << 4) | HEADER_SIZE,
    (messageType << 4) | flags,
    (serialization << 4) | compression,
    0,
  ]);
}

function writeInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function buildFullClientRequest(payload: Record<string, unknown>) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  return Buffer.concat([
    buildHeader(
      MESSAGE_TYPE_FULL_CLIENT_REQUEST,
      FLAG_NO_SEQUENCE,
      SERIALIZATION_JSON,
      COMPRESSION_GZIP,
    ),
    writeInt32(compressed.length),
    compressed,
  ]);
}

function buildAudioRequest(sequence: number, audio: Buffer, final: boolean) {
  const compressed = gzipSync(audio);
  return Buffer.concat([
    buildHeader(
      MESSAGE_TYPE_AUDIO_ONLY_REQUEST,
      final ? FLAG_NEG_SEQUENCE : FLAG_POS_SEQUENCE,
      SERIALIZATION_NONE,
      COMPRESSION_GZIP,
    ),
    writeInt32(final ? -sequence : sequence),
    writeInt32(compressed.length),
    compressed,
  ]);
}

function buildApiKeyAudioRequest(audio: Buffer, final: boolean) {
  const compressed = gzipSync(audio);
  return Buffer.concat([
    buildHeader(
      MESSAGE_TYPE_AUDIO_ONLY_REQUEST,
      final ? FLAG_NEG_SEQUENCE : FLAG_NO_SEQUENCE,
      SERIALIZATION_NONE,
      COMPRESSION_GZIP,
    ),
    writeInt32(compressed.length),
    compressed,
  ]);
}

function inferAudioFormat(audio: File) {
  const name = audio.name.toLowerCase();
  const type = audio.type.toLowerCase();
  if (type.includes("wav") || name.endsWith(".wav")) return "wav";
  if (type.includes("webm") || name.endsWith(".webm")) return "webm";
  if (type.includes("ogg") || name.endsWith(".ogg")) return "ogg";
  if (type.includes("mp3") || name.endsWith(".mp3")) return "mp3";
  if (type.includes("m4a") || name.endsWith(".m4a")) return "m4a";
  return "wav";
}

function buildAsrPayload(audio: File) {
  const appId = getAppId();
  const token = getAccessToken();
  const cluster = getCluster();

  return {
    app: {
      appid: appId,
      token,
      cluster,
    },
    user: {
      uid: "math-ai-kid",
    },
    request: {
      reqid: crypto.randomUUID(),
      nbest: 1,
      workflow: "audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate",
      result_type: "single",
      show_utterances: true,
    },
    audio: {
      format: inferAudioFormat(audio),
      rate: getSampleRate(),
      bits: 16,
      channel: 1,
      language: "zh-CN",
    },
  };
}

function buildApiKeyAsrPayload(audio: File) {
  return {
    user: {
      uid: "math-ai-kid",
    },
    audio: {
      format: inferAudioFormat(audio),
      rate: getSampleRate(),
      bits: 16,
      channel: 1,
      language: "zh-CN",
    },
    request: {
      model_name: readLocalEnvValue("VOLCENGINE_ASR_MODEL") || "bigmodel",
      result_type: "full",
      show_utterances: true,
      enable_itn: true,
      enable_punc: true,
    },
  };
}

function decodePayload(payload: Buffer, compression: number, serialization: number) {
  const body = compression === COMPRESSION_GZIP ? gunzipSync(payload) : payload;
  if (serialization !== SERIALIZATION_JSON) return null;

  try {
    const parsed = JSON.parse(body.toString("utf8"));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function parseAsrResponse(raw: WebSocket.RawData) {
  const buffer = Buffer.isBuffer(raw)
    ? raw
    : Array.isArray(raw)
      ? Buffer.concat(raw)
      : Buffer.from(raw as ArrayBuffer);
  if (buffer.length < 8) return null;

  const headerSize = (buffer[0] & 0x0f) * 4;
  const messageType = buffer[1] >> 4;
  const flags = buffer[1] & 0x0f;
  const serialization = buffer[2] >> 4;
  const compression = buffer[2] & 0x0f;
  let offset = headerSize;

  if (messageType === MESSAGE_TYPE_ERROR_RESPONSE) {
    if (offset + 8 > buffer.length) {
      return { type: "error" as const, error: "volcengine asr failed" };
    }

    const errorCode = buffer.readInt32BE(offset);
    offset += 4;
    const payloadSize = buffer.readInt32BE(offset);
    offset += 4;
    const payload = payloadSize > 0 && offset + payloadSize <= buffer.length
      ? buffer.subarray(offset, offset + payloadSize)
      : Buffer.alloc(0);
    const parsed = decodePayload(payload, compression, serialization);
    const errorMessage =
      typeof parsed?.error === "string"
        ? parsed.error
        : JSON.stringify(parsed ?? payload.toString("utf8"));
    return {
      type: "error" as const,
      error: errorMessage || `volcengine asr failed (${errorCode})`,
    };
  }

  if (flags !== FLAG_NO_SEQUENCE) {
    offset += 4;
  }

  if (messageType === MESSAGE_TYPE_SERVER_ACK) {
    return { type: "ack" as const };
  }

  if (offset + 4 > buffer.length) {
    return null;
  }

  const payloadSize = buffer.readInt32BE(offset);
  offset += 4;
  const payload = payloadSize > 0 && offset + payloadSize <= buffer.length
    ? buffer.subarray(offset, offset + payloadSize)
    : Buffer.alloc(0);

  if (messageType === MESSAGE_TYPE_FULL_SERVER_RESPONSE) {
    return {
      type: "response" as const,
      payload: decodePayload(payload, compression, serialization),
    };
  }

  return null;
}

function findTranscript(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const transcript = findTranscript(item);
      if (transcript) return transcript;
    }
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["text", "utterance", "transcript"]) {
    const transcript = findTranscript(record[key]);
    if (transcript) return transcript;
  }

  for (const key of ["result", "results", "utterances", "nbest"]) {
    const transcript = findTranscript(record[key]);
    if (transcript) return transcript;
  }

  return undefined;
}

export function canUseVolcengineAsr() {
  return Boolean(getApiKey() || (getAppId() && getAccessToken() && getCluster()));
}

export async function runVolcengineAsr(audio: File): Promise<SttResponsePayload> {
  const apiKey = getApiKey();
  const token = getAccessToken();

  if (!apiKey && (!canUseVolcengineAsr() || !token)) {
    throw new Error("volcengine asr is not configured");
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());

  return new Promise<SttResponsePayload>((resolve, reject) => {
    let settled = false;
    let sequence = 1;
    let latestTranscript = "";

    const socket = new WebSocket(getAsrUrl(), {
      headers: apiKey
        ? {
            "X-Api-Key": apiKey,
            "X-Api-Resource-Id": getResourceId(),
            "X-Api-Connect-Id": crypto.randomUUID(),
          }
        : {
            Authorization: `Bearer ${token}`,
          },
    });

    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeAllListeners();
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // Ignore close errors.
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        transcript: latestTranscript.trim(),
        confidence: latestTranscript ? 0.9 : 0,
        fallbackUsed: false,
      });
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timeout = setTimeout(() => {
      fail(new Error("volcengine asr timed out"));
    }, getTimeoutMs());

    socket.on("open", () => {
      socket.send(buildFullClientRequest(apiKey ? buildApiKeyAsrPayload(audio) : buildAsrPayload(audio)));

      if (apiKey) {
        socket.send(buildApiKeyAudioRequest(audioBuffer, true));
      } else {
        for (let offset = 0; offset < audioBuffer.length; offset += audioChunkSize) {
          const chunk = audioBuffer.subarray(offset, Math.min(offset + audioChunkSize, audioBuffer.length));
          const final = offset + audioChunkSize >= audioBuffer.length;
          socket.send(buildAudioRequest(sequence, chunk, final));
          sequence += 1;
        }
      }
    });

    socket.on("message", (raw) => {
      try {
        const parsed = parseAsrResponse(raw);
        if (!parsed) return;

        if (parsed.type === "error") {
          fail(new Error(parsed.error || "volcengine asr failed"));
          return;
        }

        if (parsed.type === "response") {
          const transcript = findTranscript(parsed.payload);
          if (transcript) {
            latestTranscript = transcript;
          }

          const payload = parsed.payload as Record<string, unknown> | null;
          const isFinal =
            (apiKey && Boolean(transcript)) ||
            payload?.is_final === true ||
            payload?.final === true ||
            String(payload?.status ?? "").toLowerCase() === "done";

          if (latestTranscript && isFinal) {
            finish();
          }
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error("invalid volcengine asr response"));
      }
    });

    socket.on("close", () => {
      if (!settled) {
        finish();
      }
    });

    socket.on("error", (error) => {
      fail(error instanceof Error ? error : new Error("volcengine asr socket error"));
    });
  });
}
