import WebSocket from "ws";
import type { TtsRequestPayload, VoiceRole } from "@/types";

const defaultRealtimeUrl = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime";
const defaultRealtimeModel = "qwen3-tts-instruct-flash-realtime";
const defaultRealtimeFallbackModel = "qwen3-tts-flash-realtime";
const defaultSampleRate = 24000;

export interface RealtimeTtsStreamHandlers {
  onStart?: (meta: {
    model: string;
    sampleRate: number;
    responseFormat: "pcm";
    voice: string;
  }) => void;
  onAudioChunk: (chunkBase64: string) => void;
  onComplete?: () => void;
  onDebugEvent?: (event: { type: string; raw: Record<string, unknown> }) => void;
  signal?: AbortSignal;
}

interface RealtimeVoiceConfig {
  voice: string;
  instructions: string;
  speechRate?: number;
  pitchRate?: number;
}

function getRealtimeApiKey() {
  return process.env.QWEN_API_KEY ?? "";
}

function getRealtimeUrl() {
  return process.env.QWEN_TTS_REALTIME_URL ?? defaultRealtimeUrl;
}

function getRealtimeModel() {
  return process.env.QWEN_TTS_MODEL ?? defaultRealtimeModel;
}

function getRealtimeFallbackModel() {
  return process.env.QWEN_TTS_FALLBACK_MODEL ?? defaultRealtimeFallbackModel;
}

function getSampleRate() {
  const raw = Number(process.env.QWEN_TTS_SAMPLE_RATE ?? defaultSampleRate);

  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return defaultSampleRate;
}

function buildRealtimeVoiceConfig(
  voiceRole: VoiceRole,
  speakerName?: string,
): RealtimeVoiceConfig {
  const speakerHint = speakerName ? `角色名是${speakerName}。` : "";

  // 全局音色覆盖（家长端可配置，开发期锁定一个音色）
  const voiceOverride = process.env.QWEN_TTS_VOICE_OVERRIDE?.trim();

  switch (voiceRole) {
    case "guide":
      return {
        voice: voiceOverride ?? "Mia",
        instructions: `${speakerHint}像儿童动画里的引导姐姐，亲切、耐心、清楚，每句都短一点，鼓励孩子继续判断。`,
        speechRate: 0.96,
        pitchRate: 1.08,
      };
    case "opponent":
      return {
        voice: voiceOverride ?? "Moon",
        instructions: `${speakerHint}像有点调皮但不凶的挑战者，带一点悬念和挑衅感，让孩子想继续思考。`,
        speechRate: 1.02,
        pitchRate: 0.94,
      };
    case "maker":
      return {
        voice: voiceOverride ?? "Mochi",
        instructions: `${speakerHint}像聪明活泼的小搭档，语气俏皮，节奏轻快，适合共创和灵感碰撞。`,
        speechRate: 1,
        pitchRate: 1.1,
      };
    case "parent":
      return {
        voice: voiceOverride ?? "Maia",
        instructions: `${speakerHint}像温和可靠的大人，平静、清楚、不过度夸张。`,
        speechRate: 0.94,
        pitchRate: 1,
      };
    case "storyteller":
    default:
      return {
        voice: voiceOverride ?? "Cherry",
        instructions: `${speakerHint}像儿童动画里的讲故事角色，温暖、灵动、有画面感，停顿自然，让台词像在对孩子说话。`,
        speechRate: 0.98,
        pitchRate: 1.06,
      };
  }
}

function buildRealtimeUrlWithModel(model: string) {
  const baseUrl = getRealtimeUrl();
  const encodedModel = encodeURIComponent(model);
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}model=${encodedModel}`;
}

function createEvent(type: string, extra?: Record<string, unknown>) {
  return {
    event_id: crypto.randomUUID(),
    type,
    ...extra,
  };
}

export function canUseQwenRealtimeTts() {
  return Boolean(getRealtimeApiKey());
}

export async function streamQwenRealtimeTts(
  payload: TtsRequestPayload,
  handlers: RealtimeTtsStreamHandlers,
) {
  const apiKey = getRealtimeApiKey();

  if (!apiKey) {
    throw new Error("qwen realtime tts is not configured");
  }

  const sampleRate = getSampleRate();
  const voiceConfig = buildRealtimeVoiceConfig(payload.voiceRole, payload.speakerName);
  const primaryModel = getRealtimeModel();
  const fallbackModel = getRealtimeFallbackModel();

  const streamAttempt = async (model: string, allowInstructions: boolean) =>
    new Promise<void>((resolve, reject) => {
    let settled = false;
    let sessionCreated = false;
    let sessionUpdated = false;
    let textSent = false;
    let finishSent = false;
    let receivedAudio = false;
    let responseCreated = false;
    let completionNotified = false;
    const firstAudioTimeoutMs = Number(process.env.QWEN_TTS_FIRST_BYTE_TIMEOUT_MS ?? 12000);
    const completionTimeoutMs = Number(process.env.QWEN_TTS_COMPLETION_TIMEOUT_MS ?? 30000);
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const socket = new WebSocket(buildRealtimeUrlWithModel(model), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-DataInspection": "disable",
      },
    });

    const cleanup = () => {
      socket.removeAllListeners();
      handlers.signal?.removeEventListener("abort", abortListener);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // Ignore close errors on failure path.
      }

      reject(error);
    };

    const sendText = () => {
      if (textSent || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      textSent = true;
      socket.send(
        JSON.stringify(
          createEvent("input_text_buffer.append", {
            text: payload.text,
          }),
        ),
      );
      socket.send(JSON.stringify(createEvent("input_text_buffer.commit")));
    };

    const scheduleTimeout = (ms: number, reason: string) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      timeoutHandle = setTimeout(() => {
        fail(new Error(reason));
      }, ms);
    };

    const sendFinish = () => {
      if (finishSent || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      finishSent = true;
      socket.send(JSON.stringify(createEvent("session.finish")));
    };

    const abortListener = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      try {
        socket.close();
      } catch {
        // Ignore close errors on abort path.
      }

      reject(new DOMException("The realtime TTS request was aborted.", "AbortError"));
    };

    handlers.signal?.addEventListener("abort", abortListener, { once: true });
    scheduleTimeout(firstAudioTimeoutMs, "qwen realtime tts did not return audio in time");

    socket.on("open", () => {
      const sessionConfig: Record<string, unknown> = {
        voice: voiceConfig.voice,
        mode: "server_commit",
        language_type: "Chinese",
        response_format: "pcm",
        sample_rate: sampleRate,
        speech_rate: voiceConfig.speechRate,
        pitch_rate: voiceConfig.pitchRate,
      };

      if (allowInstructions) {
        sessionConfig.instructions = voiceConfig.instructions;
        sessionConfig.optimize_instructions = true;
      }

      socket.send(
        JSON.stringify(
          createEvent("session.update", {
            session: sessionConfig,
          }),
        ),
      );
    });

    socket.on("message", (rawMessage) => {
      try {
        const parsed =
          typeof rawMessage === "string"
            ? JSON.parse(rawMessage)
            : JSON.parse(rawMessage.toString("utf8"));
        const eventType = parsed.type as string | undefined;

        if (eventType) {
          handlers.onDebugEvent?.({
            type: eventType,
            raw:
              typeof parsed === "object" && parsed !== null
                ? (parsed as Record<string, unknown>)
                : {},
          });
        }

        if (eventType === "session.created" && !sessionCreated) {
          sessionCreated = true;
          return;
        }

        if (eventType === "session.updated" && !sessionUpdated) {
          sessionUpdated = true;
          handlers.onStart?.({
            model,
            sampleRate,
            responseFormat: "pcm",
            voice: voiceConfig.voice,
          });
          sendText();
          return;
        }

        if (eventType === "response.created") {
          responseCreated = true;
          return;
        }

        if (eventType === "response.audio.delta" && typeof parsed.delta === "string") {
          if (!receivedAudio) {
            receivedAudio = true;
            scheduleTimeout(
              completionTimeoutMs,
              "qwen realtime tts timed out before completion",
            );
          }
          handlers.onAudioChunk(parsed.delta);
          return;
        }

        if (
          eventType === "response.audio.done" ||
          eventType === "audio.done" ||
          eventType === "response.done"
        ) {
          if (!completionNotified) {
            completionNotified = true;
            handlers.onComplete?.();
          }
          sendFinish();
          return;
        }

        if (eventType === "session.finished") {
          finish();
          return;
        }

        if (eventType === "error") {
          const errorMessage =
            parsed.error?.message ??
            parsed.message ??
            parsed.error?.code ??
            "qwen realtime tts failed";
          fail(new Error(errorMessage));
          return;
        }

        if (eventType === "response.completed" && responseCreated && !receivedAudio) {
          fail(new Error("qwen realtime tts completed without audio"));
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error("invalid realtime tts event"));
      }
    });

    socket.on("error", (error) => {
      fail(error instanceof Error ? error : new Error("qwen realtime tts socket error"));
    });

    socket.on("close", () => {
      if (!settled) {
        if (receivedAudio || finishSent || responseCreated) {
          finish();
          return;
        }

        fail(new Error("qwen realtime tts socket closed before audio"));
      }
    });
    });

  try {
    await streamAttempt(primaryModel, primaryModel.includes("instruct"));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "qwen realtime tts failed";

    if (
      fallbackModel &&
      fallbackModel !== primaryModel &&
      /invalid audio/i.test(errorMessage)
    ) {
      await streamAttempt(fallbackModel, false);
      return;
    }

    throw error;
  }
}
