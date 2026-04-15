/**
 * T2.4 — 快速路径
 * 当前策略：全部走完整 Qwen loop，保证 AI 真正参与每一轮对话。
 * Fast path 暂时禁用，后续如有性能需求可按需开启。
 */

import type { AgentTurnRequest, AgentStreamEvent, ConversationMessage, ToolCall, ToolCallResult } from "../../types/agent";

/**
 * 判断是否应该走快速路径。
 * 当前：始终返回 false，所有输入都走完整 Qwen loop。
 */
export function shouldUseFastPath(
  input: AgentTurnRequest,
  lastToolCalls: ToolCall[],
): boolean {
  void input;
  void lastToolCalls;
  return false;
}

/**
 * 快速路径执行（当前不会被调用）。
 */
export async function runFastPath(
  input: AgentTurnRequest,
  conversation: ConversationMessage[],
  context: unknown,
): Promise<AgentStreamEvent[]> {
  void input;
  void context;
  const turnIndex = Math.floor(conversation.length / 2);

  const narrate: ToolCallResult = {
    id: `fast-narrate-${Date.now()}`,
    name: "narrate",
    arguments: {
      text: "好！我们接着来～",
      voiceRole: "guide",
      autoSpeak: true,
    },
    status: "pending",
  };

  return [
    { type: "tool_call", toolCall: narrate, turnIndex },
    {
      type: "turn_end",
      turnIndex,
      toolCallCount: 1,
      usedFastPath: true,
      elapsedMs: 30,
    },
  ];
}
