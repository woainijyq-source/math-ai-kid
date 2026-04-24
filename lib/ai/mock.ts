/**
 * T7.1 + TA.7 — mock.ts（多轮对话支持）
 * 删除依赖旧 content/scenes、content/tasks、content/story-episodes 的旧函数。
 * 只保留新 agent 协议的 mock 函数，支持 5+ 轮多轮对话。
 */

import type { AgentStreamEvent, AgentTurnRequest, ToolCallResult } from "@/types/agent";

function mockToolCall(
  name: ToolCallResult["name"],
  args: Record<string, unknown>,
): ToolCallResult {
  return {
    id: `mock-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    arguments: args,
    status: "pending",
  };
}

function toolCallEvent(tc: ToolCallResult, turnIndex = 0): AgentStreamEvent {
  return { type: "tool_call", toolCall: tc, turnIndex };
}

/**
  * Mock 开场：narrate 打招呼 + show_choices 展示 3 个聊天方向。
 */
export function buildMockAgentStart(): AgentStreamEvent[] {
  const narrate = mockToolCall("narrate", {
    text: "你好呀！我是脑脑，今天想和你聊一个小问题。",
    voiceRole: "guide",
    autoSpeak: true,
  });

  const choices = mockToolCall("show_choices", {
    prompt: "你今天想先从哪个方向轻轻聊起？",
    choices: [
      { id: "math", label: "分一分比一比", desc: "一起看看数量和办法" },
      { id: "logic", label: "先排除一点", desc: "一起找找哪里说得通" },
      { id: "creative", label: "想个新办法", desc: "一起把想法变有趣" },
    ],
  });

  return [
    { type: "session_start", sessionId: `mock-session-${Date.now()}`, profileId: "mock", timestamp: Date.now() },
    toolCallEvent(narrate, 0),
    toolCallEvent(choices, 0),
    { type: "turn_end", turnIndex: 0, toolCallCount: 2, usedFastPath: false, elapsedMs: 100 },
  ];
}

/**
 * Mock 对话轮次：支持多轮，turnIndex 决定不同工具组合。
   * - turnIndex >= 5 → narrate 柔和收住 + end_activity
 * - 偶数轮 → narrate + show_choices
 * - 奇数轮 → narrate + show_text_input
 */
export function buildMockAgentTurn(input: AgentTurnRequest, turnIndex = 1): AgentStreamEvent[] {
  // 第 5 轮之后结束活动
  if (turnIndex >= 5) {
    const narrate = mockToolCall("narrate", {
      text: "脑脑把你刚才的小想法记住了，我们今天先聊到这里。",
      voiceRole: "guide",
      autoSpeak: true,
    });
    const endActivity = mockToolCall("end_activity", {
      summary: "今天你愿意把自己的想法说出来，脑脑先把这一点小变化收好。",
      completionRate: 1,
    });
    return [
      toolCallEvent(narrate, turnIndex),
      toolCallEvent(endActivity, turnIndex),
      {
        type: "system_effect",
        effect: { type: "end_activity", data: { summary: "今天的小聊天先收住，脑脑记住了你的想法。", completionRate: 1 } },
        turnIndex,
      },
      { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 80 },
    ];
  }

  // 偶数轮：narrate + show_choices
  if (turnIndex % 2 === 0) {
    const narrate = mockToolCall("narrate", {
      text: `脑脑听到你刚才那句了。我们再轻轻往前看一点。`,
      voiceRole: "guide",
      autoSpeak: true,
    });
    const choices = mockToolCall("show_choices", {
      prompt: "你想先从哪边继续想？",
      choices: [
        { id: "a", label: "先说看到的" },
        { id: "b", label: "先说为什么" },
        { id: "c", label: "先换小一点" },
      ],
    });
    return [
      toolCallEvent(narrate, turnIndex),
      toolCallEvent(choices, turnIndex),
      { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 90 },
    ];
  }

  // 奇数轮：narrate + show_text_input
  const narrate = mockToolCall("narrate", {
    text: `嗯……「${input.input.slice(0, 15)}」，说说你的想法吧！`,
    voiceRole: "guide",
    autoSpeak: true,
  });
  const textInput = mockToolCall("show_text_input", {
    prompt: "用你自己的话说说看～",
    placeholder: "先说一句也可以...",
  });
  return [
    toolCallEvent(narrate, turnIndex),
    toolCallEvent(textInput, turnIndex),
    { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 70 },
  ];
}
