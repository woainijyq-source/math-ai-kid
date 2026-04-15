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
 * 通用兜底响应：1 个 narrate + 1 个 show_choices（2 个简单选项）。
 * 适用于 AI 完全无响应或返回格式完全错误的情况。
 */
export function buildFallbackToolCalls(): ToolCall[] {
  return [
    {
      id: nextId("fallback-narrate"),
      name: "narrate",
      arguments: {
        text: "哎呀我有点迷糊了……我们换个方式继续吧！",
        voiceRole: "guide",
        autoSpeak: true,
      },
    },
    {
      id: nextId("fallback-choices"),
      name: "show_choices",
      arguments: {
        prompt: "你想怎么继续？",
        choices: [
          { id: "continue", label: "继续挑战" },
          { id: "hint", label: "给我一个提示" },
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
          text: "网络好像有点慢，稍等一下，我们马上继续！",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
      {
        id: nextId("recovery-choices"),
        name: "show_choices",
        arguments: {
          prompt: "要重试吗？",
          choices: [
            { id: "retry", label: "重新试一次" },
            { id: "skip", label: "跳过这一步" },
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
          text: "脑脑需要休息一小下，马上回来陪你！",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
    ];
  }

  // 默认：通用兜底
  return buildFallbackToolCalls();
}
