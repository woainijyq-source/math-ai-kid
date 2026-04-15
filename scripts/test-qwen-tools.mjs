/**
 * T0.1 — Qwen tool_use 可行性验证脚本
 *
 * 用法：
 *   node scripts/test-qwen-tools.mjs
 *
 * 需要 .env.local 中配置：
 *   QWEN_API_KEY  QWEN_BASE_URL  QWEN_MODEL
 */

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// 1. 加载 .env.local
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env.local");

function loadEnv(filePath) {
  try {
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore missing file
  }
}

loadEnv(envPath);

const API_KEY = process.env.QWEN_API_KEY;
const BASE_URL = (process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
const MODEL = process.env.QWEN_MODEL ?? "qwen3.6-plus";

if (!API_KEY) {
  console.error("[error] QWEN_API_KEY is not set in .env.local");
  process.exit(1);
}

console.log(`[config] model=${MODEL}  base=${BASE_URL}`);

// ---------------------------------------------------------------------------
// 2. 首发 8 个工具 JSON Schema
// ---------------------------------------------------------------------------
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "narrate",
      description: "向孩子朗读一段叙述文本，可以是开场白、反馈或过渡语。",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "要朗读的文本，面向孩子，简短" },
          speakerName: { type: "string", description: "说话角色名称" },
          voiceRole: { type: "string", enum: ["guide", "opponent", "maker", "storyteller"], description: "语音角色" },
          autoSpeak: { type: "boolean", description: "是否自动播放 TTS，默认 true" },
        },
        required: ["text"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_choices",
      description: "向孩子展示选择卡片，等待孩子点击选择一项。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "选择题问题文本" },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string", description: "选项简短标签" },
                desc: { type: "string", description: "可选的选项补充说明" },
              },
              required: ["id", "label"],
            },
            description: "选项列表，2-4 项",
          },
        },
        required: ["prompt", "choices"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_text_input",
      description: "显示一个文字输入框，让孩子用键盘输入回答。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "问题或指引文本" },
          placeholder: { type: "string", description: "输入框占位符" },
          submitLabel: { type: "string", description: "提交按钮文字，默认发送" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_image",
      description: "在对话中插入一张图片，可以是示意图或场景图。",
      parameters: {
        type: "object",
        properties: {
          alt: { type: "string", description: "图片文字描述（无障碍）" },
          imageUrl: { type: "string", description: "已有图片 URL（可选）" },
          generatePrompt: { type: "string", description: "若无 imageUrl，用于生成图片的提示词" },
        },
        required: ["alt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "request_voice",
      description: "请求孩子用语音回答，激活麦克风录音。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "语音题提示文本" },
          language: { type: "string", description: "识别语言，如 zh-CN、en-US" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description: "AI 内部思考步骤，不向孩子展示，用于规划下一步工具调用。",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "AI 的思考过程" },
          nextToolSuggestion: {
            type: "array",
            items: { type: "string" },
            description: "建议接下来调用的工具名列表",
          },
        },
        required: ["reasoning"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "award_badge",
      description: "给孩子颁发一枚成就徽章，触发奖励反馈。",
      parameters: {
        type: "object",
        properties: {
          badgeId: { type: "string", description: "徽章 ID" },
          title: { type: "string", description: "徽章名称" },
          detail: { type: "string", description: "获得原因说明" },
        },
        required: ["badgeId", "title", "detail"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "end_activity",
      description: "结束当前活动，触发结算页面跳转。",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "本次活动的简短总结" },
          completionRate: { type: "number", description: "完成度 0-100" },
        },
        required: ["summary", "completionRate"],
      },
      strict: true,
    },
  },
];

// ---------------------------------------------------------------------------
// 3. 系统 Prompt（约 800 tokens）
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `你是"脑脑"，一个陪伴 6-12 岁孩子做思维训练的 AI 伙伴。

你的工作方式：
- 不直接讲课，而是用游戏、问题、选择、故事推动孩子思考。
- 每次只说 1-2 句话，语言活泼，适合孩子年龄。
- 通过工具调用来驱动交互，不要直接回复纯文本。

首发工具说明：
1. narrate — 朗读一段话给孩子听
2. show_choices — 展示 2-4 个选择卡片
3. show_text_input — 显示文字输入框
4. show_image — 插入一张图片
5. request_voice — 请孩子用语音回答
6. think — 你的内部思考（不展示给孩子）
7. award_badge — 颁发徽章奖励
8. end_activity — 结束当前活动

编排规则：
- 每次响应 1-3 个工具调用（先 narrate，再展示/输入工具）
- 展示型工具最多 2 个，输入请求工具最多 1 个
- 不允许同时出现多个输入请求工具
- 如果孩子卡住，给提示而不是直接给答案

当前目标方向：数学思维训练（观察、归纳、推理、策略）`;

// ---------------------------------------------------------------------------
// 4. 调用 Qwen API（非流式）
// ---------------------------------------------------------------------------
async function callQwen(messages) {
  const startMs = Date.now();
  const url = `${BASE_URL}/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      temperature: 0.4,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(20000),
  });

  const elapsedMs = Date.now() - startMs;

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  return { data, elapsedMs };
}

// ---------------------------------------------------------------------------
// 5. 解析 tool_calls
// ---------------------------------------------------------------------------
function parseToolCalls(data) {
  const choice = data?.choices?.[0];
  if (!choice) return [];

  const toolCalls = choice.message?.tool_calls ?? [];

  return toolCalls.map((tc) => {
    let args = {};
    let parseOk = true;
    try {
      const raw = tc.function?.arguments;
      if (typeof raw === "string") {
        if (raw.trim() === "") {
          args = {};
          parseOk = false;
        } else {
          args = JSON.parse(raw);
        }
      } else {
        args = raw ?? {};
      }
    } catch {
      parseOk = false;
      // store raw for debug
      args = { __raw__: tc.function?.arguments };
    }

    const knownNames = TOOL_DEFINITIONS.map((t) => t.function.name);
    const nameValid = knownNames.includes(tc.function?.name);

    return {
      id: tc.id,
      name: tc.function?.name,
      arguments: args,
      nameValid,
      parseOk,
      formatOk: nameValid && parseOk,
    };
  });
}

// ---------------------------------------------------------------------------
// 6. 打印结果
// ---------------------------------------------------------------------------
function printTurn(turnIndex, input, toolCalls, elapsedMs) {
  console.log(`\n${"-".repeat(60)}`);
  console.log(`[turn ${turnIndex}] 孩子说: "${input}"  (耗时 ${elapsedMs}ms)`);
  if (toolCalls.length === 0) {
    console.log("  ⚠ 未返回任何 tool_call");
    return;
  }
  for (const tc of toolCalls) {
    const status = tc.formatOk ? "✓" : "✗";
    console.log(`  ${status} ${tc.name}`);
    if (!tc.nameValid) console.log(`    ✗ 工具名不合法: ${tc.name}`);
    if (!tc.parseOk) {
      console.log(`    ✗ arguments 无法解析为 JSON`);
      if (tc.arguments?.__raw__ !== undefined) console.log(`    raw: ${tc.arguments.__raw__}`);
    }
    const argStr = JSON.stringify(tc.arguments, null, 4).replace(/^/gm, "    ");
    console.log(`    参数:\n${argStr}`);
  }
}

// ---------------------------------------------------------------------------
// 7. 主循环
// ---------------------------------------------------------------------------
async function main() {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  let turnIndex = 0;

  // 第一轮：自动发送「开始活动」触发 AI 打招呼
  console.log("[脑脑 tool_use 验证] 输入 exit 退出，直接回车用上一条消息重试\n");
  console.log("[auto] 发送首轮消息: 你好，开始吧！");

  const firstInput = "你好，开始吧！";
  messages.push({ role: "user", content: firstInput });

  try {
    const { data, elapsedMs } = await callQwen(messages);
    const toolCalls = parseToolCalls(data);
    printTurn(turnIndex, firstInput, toolCalls, elapsedMs);

    // 把 assistant 回复加入历史
    const assistantMsg = data?.choices?.[0]?.message;
    if (assistantMsg) messages.push(assistantMsg);

    // tool 结果占位（简化：返回空确认）
    for (const tc of toolCalls) {
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify({ ok: true }),
      });
    }
  } catch (err) {
    console.error(`[error] ${err.message}`);
  }

  turnIndex++;

  // 后续轮次：交互式输入
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const askNext = () => {
    rl.question(`\n[turn ${turnIndex}] 你说: `, async (input) => {
      const trimmed = input.trim();
      if (trimmed === "exit" || trimmed === "quit") {
        console.log("\n[结束] 共完成", turnIndex, "轮对话");
        rl.close();
        return;
      }

      const userInput = trimmed || "继续";
      messages.push({ role: "user", content: userInput });

      try {
        const { data, elapsedMs } = await callQwen(messages);
        const toolCalls = parseToolCalls(data);
        printTurn(turnIndex, userInput, toolCalls, elapsedMs);

        const assistantMsg = data?.choices?.[0]?.message;
        if (assistantMsg) messages.push(assistantMsg);

        for (const tc of toolCalls) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true }),
          });
        }

        // 自动结束：AI 调用了 end_activity
        const hasEnd = toolCalls.some((tc) => tc.name === "end_activity");
        if (hasEnd) {
          console.log("\n[结束] AI 结束了本次活动。共完成", turnIndex + 1, "轮对话");
          rl.close();
          return;
        }
      } catch (err) {
        console.error(`[error] ${err.message}`);
      }

      turnIndex++;

      // 超过 10 轮自动退出
      if (turnIndex >= 10) {
        console.log("\n[结束] 已完成 10 轮验证对话。");
        rl.close();
        return;
      }

      if (!rl.closed) askNext();
    });
  };

  rl.on("close", () => {
    // stdin ended (piped input finished) — exit cleanly
    if (turnIndex > 0) {
      console.log("\n[结束] 输入结束，共完成", turnIndex, "轮对话。");
    }
  });

  askNext();
}

main().catch((err) => {
  console.error("[fatal]", err.message);
  process.exit(1);
});
  
