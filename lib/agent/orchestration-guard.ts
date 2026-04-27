/**
 * T2.3 — 服务端编排约束层
 * 对 AI 返回的 tool_calls 执行编排规则，截断/排序/补全。
 */

import type { ToolCall } from "../../types/agent";

// 展示型工具（不等待用户输入）
const DISPLAY_TOOLS = new Set(["narrate", "show_image", "show_choices", "show_drag_board"]);

// 输入请求工具（等待用户输入）
const INPUT_REQUEST_TOOLS = new Set([
  "show_text_input",
  "request_voice",
  "show_number_input",
  "request_photo",
  "show_emotion_checkin",
  "request_camera",
  "show_drawing_canvas",
]);

function isDisplay(name: string): boolean {
  return DISPLAY_TOOLS.has(name);
}

function isInputRequest(name: string): boolean {
  return INPUT_REQUEST_TOOLS.has(name);
}

/**
 * 对一轮 tool_calls 执行编排约束：
 * 1. 展示型工具最多 2 个（超出截断）
 * 2. 输入请求工具最多 1 个（超出截断）
 * 3. 如果上一轮有输入请求且未收到回复，移除本轮的输入请求工具
 * 4. narrate 调到最前面
 * 5. 如果没有 narrate 且有交互工具 → 自动补一个 narrate
 */
export function enforceOrchestration(
  toolCalls: ToolCall[],
  lastTurnToolCalls?: ToolCall[],
): ToolCall[] {
  if (toolCalls.length === 0) return toolCalls;

  let calls = [...toolCalls];

  // 规则 3：如果上一轮有未回复的输入请求，移除本轮的输入请求工具
  const lastHadInputRequest = lastTurnToolCalls?.some((tc) => isInputRequest(tc.name)) ?? false;
  if (lastHadInputRequest) {
    calls = calls.filter((tc) => !isInputRequest(tc.name));
  }

  // 规则 1：展示型工具最多 2 个
  let displayCount = 0;
  calls = calls.filter((tc) => {
    if (isDisplay(tc.name)) {
      if (displayCount >= 2) return false;
      displayCount++;
    }
    return true;
  });

  // 规则 2：输入请求工具最多 1 个
  let inputCount = 0;
  calls = calls.filter((tc) => {
    if (isInputRequest(tc.name)) {
      if (inputCount >= 1) return false;
      inputCount++;
    }
    return true;
  });

  // 规则 4：narrate 排到最前
  const narrates = calls.filter((tc) => tc.name === "narrate");
  const others = calls.filter((tc) => tc.name !== "narrate");
  calls = [...narrates, ...others];

  // 规则 5：没有 narrate 且有交互工具 → 自动补开场白
  const hasNarrate = calls.some((tc) => tc.name === "narrate");
  const hasInteractive = calls.some(
    (tc) => isDisplay(tc.name) || isInputRequest(tc.name),
  );
  if (!hasNarrate && hasInteractive) {
    const fallbackNarrate: ToolCall = {
      id: `auto-narrate-${Date.now()}`,
      name: "narrate",
      arguments: { text: "好，我们先轻轻接住这一小步。", autoSpeak: true },
    };
    calls = [fallbackNarrate, ...calls];
  }

  // 规则 6：包含输入工具时，narrate 只做短承接，真正问题留在输入工具里。
  const inputTool = calls.find((tc) => isInputRequest(tc.name));
  const narrateTool = calls.find((tc) => tc.name === "narrate");
  if (inputTool && narrateTool) {
    const narrateText = (narrateTool.arguments as Record<string, unknown>)?.text;
    const isGenericNarrate =
      typeof narrateText === "string" &&
      (narrateText === "好，我们先轻轻接住这一小步。" || narrateText.length < 5);
    if (isGenericNarrate) {
      narrateTool.arguments = {
        ...(narrateTool.arguments as Record<string, unknown>),
        text: "我听见了，我们接着看这一小步。",
        autoSpeak: false,
      };
    }
  }

  return calls;
}

/**
 * 活动结构检查：首轮没有 narrate 时自动补开场白。
 */
export function checkActivityStructure(
  turnIndex: number,
  toolCalls: ToolCall[],
): ToolCall[] {
  if (turnIndex !== 0) return toolCalls;

  const hasNarrate = toolCalls.some((tc) => tc.name === "narrate");
  if (!hasNarrate) {
    const openingNarrate: ToolCall = {
      id: `auto-opening-${Date.now()}`,
      name: "narrate",
      arguments: {
        text: "嗨，我是林老师。今天我们先聊一个小问题。",
        voiceRole: "guide",
        autoSpeak: true,
      },
    };
    return [openingNarrate, ...toolCalls];
  }

  return toolCalls;
}
