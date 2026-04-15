import { isChatResponsePayload } from "@/lib/ai/validators";
import type { ChatResponsePayload } from "@/types";
import type { ToolDefinition } from "@/lib/agent/tool-definitions";

// ---------------------------------------------------------------------------
// T2.1 — streamQwenWithTools：流式 tool_use 支持
// ---------------------------------------------------------------------------

export type QwenStreamChunk =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_delta"; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * 以 SSE 流方式调用 Qwen chat/completions，支持 tool_use。
 * 逐块 yield QwenStreamChunk，调用方负责累积 argumentsDelta 并在 done 时解析。
 */
export async function* streamQwenWithTools(
  messages: Array<{ role: string; content?: string; tool_calls?: unknown; tool_call_id?: string; name?: string }>,
  tools: ToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  },
): AsyncGenerator<QwenStreamChunk> {
  const baseUrl = getQwenBaseUrl();
  const model = getQwenModel();
  const apiKey = process.env.QWEN_API_KEY;

  if (!apiKey) {
    yield { type: "error", message: "QWEN_API_KEY is not set" };
    return;
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
        temperature: options?.temperature ?? 0.4,
        max_tokens: options?.maxTokens ?? 1500,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    yield { type: "error", message: err instanceof Error ? err.message : "fetch_failed" };
    return;
  }

  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[qwen-chat] HTTP ${response.status}:`, body.slice(0, 300));
    yield { type: "error", message: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    return;
  }

  if (!response.body) {
    yield { type: "error", message: "response body is null" };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          if (trimmed === "data: [DONE]") {
            yield { type: "done" };
          }
          continue;
        }

        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);

        let chunk: unknown;
        try {
          chunk = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        // 检测 Qwen 流式 error 响应（如 400 invalid_parameter_error）
        const errorInfo = (chunk as { error?: { message?: string; code?: string } })?.error;
        if (errorInfo) {
          console.error(`[qwen-chat] stream error: ${errorInfo.code ?? "unknown"}: ${(errorInfo.message ?? "").slice(0, 200)}`);
          yield { type: "error", message: errorInfo.message ?? "qwen stream error" };
          return;
        }

        const delta = (chunk as { choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> })?.choices?.[0]?.delta;
        if (!delta) continue;

        // 文本增量
        if (typeof delta.content === "string" && delta.content.length > 0) {
          yield { type: "text_delta", content: delta.content };
        }

        // tool_call 增量
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            if (process.env.NODE_ENV === "development") {
              console.debug(`[qwen-chat] tool_call_delta index=${tc.index} name=${tc.function?.name ?? ""} args=${(tc.function?.arguments ?? "").slice(0, 30)}`);
            }
            yield {
              type: "tool_call_delta",
              index: tc.index ?? 0,
              id: tc.id,
              name: tc.function?.name,
              argumentsDelta: tc.function?.arguments,
            };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: "done" };
}

type QwenMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type QwenChoice = {
  message?: {
    content?: string | null;
  };
};

type QwenChatResponse = {
  choices?: QwenChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export interface QwenDirectChatResult {
  payload: ChatResponsePayload | null;
  debug: Record<string, unknown>;
}

function getQwenBaseUrl() {
  return (
    process.env.QWEN_BASE_URL?.replace(/\/+$/, "") ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  );
}

function getQwenModel() {
  return process.env.QWEN_MODEL ?? "qwen3.6-plus";
}

export function isQwenDirectEnabled() {
  return Boolean(process.env.QWEN_API_KEY);
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function readMode(runtimePayload: unknown) {
  if (!runtimePayload || typeof runtimePayload !== "object") {
    return "story";
  }

  const mode = (runtimePayload as Record<string, unknown>).mode;
  return typeof mode === "string" ? mode : "story";
}

function readResponseRules(runtimePayload: unknown) {
  if (!runtimePayload || typeof runtimePayload !== "object") {
    return [];
  }

  const runtimeContext = (runtimePayload as Record<string, unknown>).runtimeContext;
  if (!runtimeContext || typeof runtimeContext !== "object") {
    return [];
  }

  const responseRules = (runtimeContext as Record<string, unknown>).responseRules;
  return Array.isArray(responseRules)
    ? responseRules.filter((rule): rule is string => typeof rule === "string")
    : [];
}

function buildModeDirectives(mode: string) {
  switch (mode) {
    case "opponent":
      return [
        "Mode: opponent.",
        "Act like a smart live opponent who also nudges strategy.",
        "Keep the round focused on count change, remainders, and what the child should notice next.",
        "Do not turn this into a full lesson or a long explanation.",
      ];
    case "co-create":
      return [
        "Mode: co-create.",
        "Act like a playful partner who helps turn the child's idea into a clear playable rule.",
        "Always push the child toward conditions, order, fairness, or consequences.",
        "Do not accept vague rules without refining them.",
      ];
    case "story":
    default:
      return [
        "Mode: story.",
        "Act as director, challenger, and world simulator inside the current story shell.",
        "Push the child to compare, explain why, predict, or eliminate.",
        "Do not drift into general storytelling or moral teaching.",
      ];
  }
}

function buildSystemPrompt(runtimePayload: unknown) {
  const mode = readMode(runtimePayload);
  const responseRules = readResponseRules(runtimePayload);

  return [
    "You are the runtime brain for a children's math-thinking story game.",
    "The story is only a shell. The real goal is to train math thinking.",
    "You must stay inside the provided runtime context and keep the interaction child-facing, short, and actionable.",
    ...buildModeDirectives(mode),
    "You must stay inside the provided scene, current frame, and allowed choices.",
    "Use the child's latest move to produce the next challenge or consequence.",
    "When possible, ask for compare / explain why / predict / eliminate reasoning, not recall.",
    ...(responseRules.length > 0 ? ["Runtime response rules:", ...responseRules] : []),
    "Return only valid JSON matching this exact shape:",
    JSON.stringify(
      {
        messages: [
          {
            id: "assistant-id",
            role: "assistant",
            content: "short child-facing line",
            intent: "storybeat",
            hints: ["short hint"],
            nextAction: "choose",
            speakerName: "Narrator",
            voiceRole: "storyteller",
            speakableText: "short spoken line",
            autoSpeak: true,
          },
        ],
        sessionPatch: {
          stage: 1,
          status: "active",
          progress: 40,
          completion: "short summary",
          meta: {
            frameIndex: 1,
            sceneId: "scene-id",
            kernelId: "kernel-id",
            lastChoice: "child choice",
            lastMathMove: "math move",
            currentChoices: [
              {
                id: "choice-id",
                label: "child-facing label",
                description: "child-facing description",
                mathMove: "math move",
              },
            ],
          },
        },
        worldPatch: {
          statusText: "short world reaction",
          recentChanges: ["short change"],
        },
        rewardSignals: [
          {
            type: "instant",
            title: "short title",
            detail: "short detail",
          },
        ],
      },
      null,
      2,
    ),
    "Rules:",
    "- Keep lines short enough for a 7-year-old and for TTS.",
    "- Do not become a worksheet or a formal teacher.",
    "- Do not invent unrelated plot twists.",
    "- Do not add extra top-level keys.",
    "- Do not return markdown, comments, or code fences.",
    "- Return 1 or 2 assistant messages only, never a long conversation transcript.",
    "- Push the child to compare, explain why, predict, or eliminate.",
    "- Keep choices aligned with the allowed math moves in the runtime context.",
    "- If the current frame is final, complete the session with progress 100.",
  ].join("\n");
}

function buildUserPrompt(runtimePayload: unknown) {
  return [
    "Use this runtime context to continue the interactive story round.",
    "Return JSON only.",
    JSON.stringify(runtimePayload, null, 2),
  ].join("\n\n");
}

function summarizeRuntimePayload(runtimePayload: unknown) {
  if (!runtimePayload || typeof runtimePayload !== "object") {
    return {};
  }

  const payload = runtimePayload as Record<string, unknown>;
  const runtimeContext =
    typeof payload.runtimeContext === "object" && payload.runtimeContext !== null
      ? (payload.runtimeContext as Record<string, unknown>)
      : null;
  const scene =
    runtimeContext &&
    typeof runtimeContext.scene === "object" &&
    runtimeContext.scene !== null
      ? (runtimeContext.scene as Record<string, unknown>)
      : null;
  const frame =
    runtimeContext &&
    typeof runtimeContext.currentFrame === "object" &&
    runtimeContext.currentFrame !== null
      ? (runtimeContext.currentFrame as Record<string, unknown>)
      : null;
  const childState =
    runtimeContext &&
    typeof runtimeContext.childState === "object" &&
    runtimeContext.childState !== null
      ? (runtimeContext.childState as Record<string, unknown>)
      : null;
  const allowedChoices = Array.isArray(runtimeContext?.allowedChoices)
    ? runtimeContext.allowedChoices
    : [];

  return {
    sceneId: typeof scene?.id === "string" ? scene.id : undefined,
    frameId: typeof frame?.id === "string" ? frame.id : undefined,
    progress: typeof childState?.progress === "number" ? childState.progress : undefined,
    allowedChoiceIds: allowedChoices
      .map((choice) =>
        typeof choice === "object" && choice !== null && "id" in choice
          ? (choice as Record<string, unknown>).id
          : undefined,
      )
      .filter((choiceId): choiceId is unknown => Boolean(choiceId)),
    latestUserInput: typeof childState?.latestUserInput === "string"
      ? childState.latestUserInput
      : undefined,
  };
}

export async function runQwenDirectChat(
  runtimePayload: unknown,
): Promise<QwenDirectChatResult> {
  if (!isQwenDirectEnabled()) {
    return {
      payload: null,
      debug: {
        enabled: false,
        reason: "qwen_api_key_missing",
      },
    };
  }

  const messages: QwenMessage[] = [
    { role: "system", content: buildSystemPrompt(runtimePayload) },
    { role: "user", content: buildUserPrompt(runtimePayload) },
  ];

  const response = await fetch(`${getQwenBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: getQwenModel(),
      messages,
      temperature: 0.25,
      max_tokens: 900,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return {
      payload: null,
      debug: {
        enabled: true,
        reason: "http_error",
        status: response?.status ?? null,
        model: getQwenModel(),
        runtime: summarizeRuntimePayload(runtimePayload),
      },
    };
  }

  const json = (await response.json().catch(() => null)) as QwenChatResponse | null;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return {
      payload: null,
      debug: {
        enabled: true,
        reason: "empty_content",
        model: getQwenModel(),
        usage: json?.usage ?? null,
        runtime: summarizeRuntimePayload(runtimePayload),
      },
    };
  }

  const jsonText = extractJsonObject(content);
  if (!jsonText) {
    return {
      payload: null,
      debug: {
        enabled: true,
        reason: "json_not_found",
        model: getQwenModel(),
        preview: content.slice(0, 320),
        usage: json?.usage ?? null,
        runtime: summarizeRuntimePayload(runtimePayload),
      },
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;

    if (isChatResponsePayload(parsed)) {
      const payload = parsed as ChatResponsePayload;
      return {
        payload,
        debug: {
          enabled: true,
          reason: "ok",
          model: getQwenModel(),
          usage: json?.usage ?? null,
          runtime: summarizeRuntimePayload(runtimePayload),
          responseSummary: {
            messageCount: payload.messages.length,
            progress: payload.sessionPatch.progress ?? null,
            rewardCount: payload.rewardSignals.length,
          },
        },
      };
    }

    return {
      payload: null,
      debug: {
        enabled: true,
        reason: "schema_invalid",
        model: getQwenModel(),
        usage: json?.usage ?? null,
        runtime: summarizeRuntimePayload(runtimePayload),
        preview: jsonText.slice(0, 320),
      },
    };
  } catch (error) {
    return {
      payload: null,
      debug: {
        enabled: true,
        reason: "json_parse_error",
        model: getQwenModel(),
        error: error instanceof Error ? error.message : "unknown_parse_error",
        preview: jsonText.slice(0, 320),
        usage: json?.usage ?? null,
        runtime: summarizeRuntimePayload(runtimePayload),
      },
    };
  }
}
