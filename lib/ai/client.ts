"use client";

import type {
  ChatRequestPayload,
  ChatResponsePayload,
  SttResponsePayload,
  SummaryResponsePayload,
  TtsRequestPayload,
  TtsResponsePayload,
} from "@/types";

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`${url} request failed`);
  }

  return (await response.json()) as T;
}

export async function sendChat(payload: ChatRequestPayload) {
  return requestJson<ChatResponsePayload>("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function sendStt(blob: Blob, mode: string) {
  const formData = new FormData();
  const fileName = blob.type === "audio/wav" ? "voice.wav" : "voice.webm";
  formData.append("audio", blob, fileName);
  formData.append("mode", mode);

  return requestJson<SttResponsePayload>("/api/ai/stt", {
    method: "POST",
    body: formData,
  });
}

export async function sendVision(file: Blob, mode: string) {
  const formData = new FormData();
  formData.append("image", file, "image.jpg");
  formData.append("mode", mode);

  return requestJson<{ description: string; fallbackUsed?: boolean }>("/api/ai/vision", {
    method: "POST",
    body: formData,
  });
}

export async function fetchParentSummary() {
  return requestJson<SummaryResponsePayload>("/api/ai/summary", {
    method: "POST",
  });
}

export async function sendTts(payload: TtsRequestPayload) {
  return requestJson<TtsResponsePayload>("/api/ai/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type RealtimeTtsEvent =
  | {
      type: "start";
      model: string;
      sampleRate: number;
      responseFormat: "pcm";
      voice: string;
    }
  | {
      type: "audio";
      delta: string;
    }
  | {
      type: "done";
    }
  | {
      type: "error";
      message: string;
    };

function parseSseEventBlock(block: string) {
  const dataLines = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join("\n")) as RealtimeTtsEvent;
}

export async function streamRealtimeTts(
  payload: TtsRequestPayload,
  options: {
    signal?: AbortSignal;
    onEvent: (event: RealtimeTtsEvent) => void | Promise<void>;
  },
) {
  const response = await fetch("/api/ai/tts/realtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("realtime tts request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex >= 0) {
      const eventBlock = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const event = parseSseEventBlock(eventBlock);
      if (event) {
        await options.onEvent(event);
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }
}

export const aiClient = {
  chat: sendChat,
  stt: sendStt,
  vision: sendVision,
  summary: fetchParentSummary,
  tts: sendTts,
  realtimeTts: streamRealtimeTts,
};

// ---------------------------------------------------------------------------
// T3.3 — Agent 协议客户端（新增，保留旧函数向后兼容）
// ---------------------------------------------------------------------------

import type { AgentStartRequest, AgentTurnRequest, AgentStreamEvent } from "@/types/agent";
import { parseSSE } from "@/lib/agent/stream-parser";

async function readAgentSSE(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        for (const event of parseSSE(block + "\n\n")) onEvent(event);
      }
    }
    if (buffer.trim()) {
      for (const event of parseSSE(buffer)) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 启动新 agent session，通过 SSE 流接收事件。
 */
export async function sendAgentStart(
  request: AgentStartRequest,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const response = await fetch("/api/agent/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`agent/start HTTP ${response.status}`);
  await readAgentSSE(response, onEvent);
}

/**
 * 发送一轮孩子输入，通过 SSE 流接收事件。
 * 支持 AbortSignal 取消。
 */
export async function streamAgentTurn(
  request: AgentTurnRequest,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/agent/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error(`agent/turn HTTP ${response.status}`);
  await readAgentSSE(response, onEvent);
}
