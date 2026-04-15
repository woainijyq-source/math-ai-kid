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
 * Mock 开场：narrate 打招呼 + show_choices 展示 3 个能力域选择。
 */
export function buildMockAgentStart(): AgentStreamEvent[] {
  const narrate = mockToolCall("narrate", {
    text: "你好呀！我是脑脑，今天想和你玩什么思维游戏？",
    voiceRole: "guide",
    autoSpeak: true,
  });

  const choices = mockToolCall("show_choices", {
    prompt: "选一个你今天想挑战的方向！",
    choices: [
      { id: "math", label: "数学探险", desc: "发现数字里的秘密" },
      { id: "logic", label: "逻辑推理", desc: "用消去法找到答案" },
      { id: "creative", label: "创意发明", desc: "一起设计新规则" },
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
 * - turnIndex >= 5 → narrate 总结 + end_activity
 * - 偶数轮 → narrate + show_choices
 * - 奇数轮 → narrate + show_text_input
 */
export function buildMockAgentTurn(input: AgentTurnRequest, turnIndex = 1): AgentStreamEvent[] {
  // 第 5 轮之后结束活动
  if (turnIndex >= 5) {
    const narrate = mockToolCall("narrate", {
      text: "太棒了！今天的探索完成了，你表现得超级棒！🎉",
      voiceRole: "guide",
      autoSpeak: true,
    });
    const endActivity = mockToolCall("end_activity", {
      summary: "今天的思维挑战完成了，你表现得非常棒！",
      completionRate: 100,
    });
    return [
      toolCallEvent(narrate, turnIndex),
      toolCallEvent(endActivity, turnIndex),
      {
        type: "system_effect",
        effect: { type: "end_activity", data: { summary: "思维挑战完成", completionRate: 100 } },
        turnIndex,
      },
      { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 80 },
    ];
  }

  // 偶数轮：narrate + show_choices
  if (turnIndex % 2 === 0) {
    const narrate = mockToolCall("narrate", {
      text: `第 ${turnIndex + 1} 关来了！选一个你想试的方向 🤔`,
      voiceRole: "guide",
      autoSpeak: true,
    });
    const choices = mockToolCall("show_choices", {
      prompt: "你想怎么做？",
      choices: [
        { id: "a", label: "继续挑战" },
        { id: "b", label: "换个方向" },
        { id: "c", label: "给我提示" },
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
    placeholder: "在这里输入...",
  });
  return [
    toolCallEvent(narrate, turnIndex),
    toolCallEvent(textInput, turnIndex),
    { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 70 },
  ];
}
