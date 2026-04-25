/**
 * T2.6 — 兜底工具生成器
 * 在 AI 调用失败或响应不可用时，返回安全的默认 tool_calls。
 */

import type { ToolCall } from "../../types/agent";

let fallbackCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++fallbackCounter}`;
}

/**
 * 通用兜底响应：1 个 narrate + 1 个 show_choices（2 个轻量方向）。
 * 适用于 AI 完全无响应或返回格式完全错误的情况。
 */
export function buildFallbackToolCalls(): ToolCall[] {
  return [
    {
      id: nextId("fallback-narrate"),
      name: "narrate",
      arguments: {
        text: "林老师刚才有点没跟上。我们换个更小的方向接一下。",
        voiceRole: "guide",
        autoSpeak: true,
      },
    },
    {
      id: nextId("fallback-choices"),
      name: "show_choices",
      arguments: {
        prompt: "你想先从哪边接着说？",
        choices: [
          { id: "say-more", label: "再说一点" },
          { id: "make-smaller", label: "换小一点" },
        ],
      },
    },
  ];
}

/**
 * 根据错误类型返回不同的恢复 tool_calls。
 */
export function buildErrorRecoveryToolCalls(error: string): ToolCall[] {
  // 网络/超时错误
  if (
    error.includes("timeout") ||
    error.includes("abort") ||
    error.includes("fetch") ||
    error.includes("network")
  ) {
    return [
      {
        id: nextId("recovery-narrate"),
        name: "narrate",
        arguments: {
          text: "网络好像有点慢。林老师先陪你把这一小步接住。",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
      {
        id: nextId("recovery-choices"),
        name: "show_choices",
        arguments: {
          prompt: "我们怎么轻轻接回来？",
          choices: [
            { id: "retry", label: "再说一次" },
            { id: "smaller", label: "换小一点" },
          ],
        },
      },
    ];
  }

  // API 限流错误
  if (error.includes("429") || error.includes("rate")) {
    return [
      {
        id: nextId("ratelimit-narrate"),
        name: "narrate",
        arguments: {
          text: "林老师需要休息一小下，马上回来陪你！",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
    ];
  }

  // 默认：通用兜底
  return buildFallbackToolCalls();
}
