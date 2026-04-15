/**
 * T2.9 — SSE 流解析器
 * encodeSSE / parseSSE 互为逆操作。
 */

import type { AgentStreamEvent } from "../../types/agent";

/**
 * 将 AgentStreamEvent 编码为 SSE 格式字符串。
 * 格式: `event: {type}\ndata: {json}\n\n`
 */
export function encodeSSE(event: AgentStreamEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

/**
 * 将一段 SSE 文本（可能包含多个事件）解析为 AgentStreamEvent 数组。
 * 忽略格式不合法的行。
 */
export function parseSSE(chunk: string): AgentStreamEvent[] {
  const events: AgentStreamEvent[] = [];

  // 按双换行分割事件块
  const blocks = chunk.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let dataLine: string | undefined;

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        dataLine = line.slice(6);
      }
      // event: 行可以忽略，类型从 data JSON 中读取
    }

    if (!dataLine) continue;

    try {
      const parsed = JSON.parse(dataLine) as AgentStreamEvent;
      if (parsed && typeof parsed.type === "string") {
        events.push(parsed);
      }
    } catch {
      // 忽略解析失败的行
    }
  }

  return events;
}
