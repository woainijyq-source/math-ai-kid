/**
 * T0.2 — Qwen tool_use 稳定性统计脚本
 *
 * 用法：
 *   node scripts/test-qwen-stability.mjs
 *
 * 自动跑 20 组预设输入，统计 tool_call 格式正确率、工具选择合理率、参数完整率。
 */

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
    // ignore
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

console.log(`[config] model=${MODEL}  base=${BASE_URL}\n`);

// ---------------------------------------------------------------------------
// 2. 工具定义（与 T0.1 相同）
// ---------------------------------------------------------------------------
const TOOL_NAMES = ["narrate", "show_choices", "show_text_input", "show_image", "request_voice", "think", "award_badge", "end_activity"];

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "narrate",
      description: "向孩子朗读一段叙述文本，可以是开场白、反馈或过渡语。",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          speakerName: { type: "string" },
          voiceRole: { type: "string", enum: ["guide", "opponent", "maker", "storyteller"] },
          autoSpeak: { type: "boolean" },
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
          prompt: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, label: { type: "string" }, desc: { type: "string" } },
              required: ["id", "label"],
            },
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
          prompt: { type: "string" },
          placeholder: { type: "string" },
          submitLabel: { type: "string" },
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
      description: "在对话中插入一张图片。",
      parameters: {
        type: "object",
        properties: {
          alt: { type: "string" },
          imageUrl: { type: "string" },
          generatePrompt: { type: "string" },
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
          prompt: { type: "string" },
          language: { type: "string" },
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
      description: "AI 内部思考步骤，不向孩子展示。",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string" },
          nextToolSuggestion: { type: "array", items: { type: "string" } },
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
          badgeId: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
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
          summary: { type: "string" },
          completionRate: { type: "number" },
        },
        required: ["summary", "completionRate"],
      },
      strict: true,
    },
  },
];

// 每个工具的必填字段，用于参数完整率校验
const REQUIRED_FIELDS = {
  narrate: ["text"],
  show_choices: ["prompt", "choices"],
  show_text_input: ["prompt"],
  show_image: ["alt"],
  request_voice: ["prompt"],
  think: ["reasoning"],
  award_badge: ["badgeId", "title", "detail"],
  end_activity: ["summary", "completionRate"],
};

// 合理工具：根据场景期望至少出现的工具（不强制，只统计）
const EXPECTED_TOOLS = {
  narrate: ["narrate"],
  show_choices: ["narrate", "show_choices"],
  open_question: ["narrate", "show_text_input"],
  stuck: ["narrate"],
  change_activity: ["narrate", "show_choices"],
  correct_answer: ["narrate"],
  wrong_answer: ["narrate"],
  voice_request: ["narrate", "request_voice"],
};

const SYSTEM_PROMPT = `你是"脑脑"，一个陪伴 6-12 岁孩子做思维训练的 AI 伙伴。

你的工作方式：
- 不直接讲课，而是用游戏、问题、选择、故事推动孩子思考。
- 每次只说 1-2 句话，语言活泼，适合孩子年龄。
- 通过工具调用来驱动交互，不要直接回复纯文本。

编排规则：
- 每次响应 1-3 个工具调用（先 narrate，再展示/输入工具）
- 展示型工具最多 2 个，输入请求工具最多 1 个
- 不允许同时出现多个输入请求工具
- 如果孩子卡住，给提示而不是直接给答案

当前目标方向：数学思维训练（观察、归纳、推理、策略）`;

// ---------------------------------------------------------------------------
// 3. 20 组测试输入
// ---------------------------------------------------------------------------
const TEST_CASES = [
  // 首轮打招呼
  { id: 1, category: "greeting", input: "你好，开始吧！", expectedCategory: "narrate" },
  { id: 2, category: "greeting", input: "Hi，我准备好了", expectedCategory: "narrate" },

  // 选择题点击
  { id: 3, category: "show_choices", input: "我选 A", expectedCategory: "show_choices" },
  { id: 4, category: "show_choices", input: "选第二个", expectedCategory: "show_choices" },
  { id: 5, category: "show_choices", input: "我觉得是选项 3", expectedCategory: "show_choices" },

  // 开放式提问
  { id: 6, category: "open_question", input: "为什么这样排列？", expectedCategory: "open_question" },
  { id: 7, category: "open_question", input: "你能给我出一道难题吗", expectedCategory: "open_question" },

  // 说不会
  { id: 8, category: "stuck", input: "我不会", expectedCategory: "stuck" },
  { id: 9, category: "stuck", input: "这个我不知道怎么做", expectedCategory: "stuck" },
  { id: 10, category: "stuck", input: "太难了，我想要提示", expectedCategory: "stuck" },

  // 要求换活动
  { id: 11, category: "change_activity", input: "换一个游戏吧", expectedCategory: "change_activity" },
  { id: 12, category: "change_activity", input: "我不想玩这个了", expectedCategory: "change_activity" },

  // 说英语
  { id: 13, category: "english", input: "I don't understand, can you help me?", expectedCategory: "narrate" },
  { id: 14, category: "english", input: "What should I do next?", expectedCategory: "narrate" },

  // 答对
  { id: 15, category: "correct_answer", input: "答案是 7！", expectedCategory: "correct_answer" },
  { id: 16, category: "correct_answer", input: "我觉得规律是每次加 3", expectedCategory: "correct_answer" },

  // 答错
  { id: 17, category: "wrong_answer", input: "答案是 100", expectedCategory: "wrong_answer" },
  { id: 18, category: "wrong_answer", input: "我猜是随机的", expectedCategory: "wrong_answer" },

  // 语音相关
  { id: 19, category: "voice_request", input: "我想用说话回答", expectedCategory: "voice_request" },
  { id: 20, category: "voice_request", input: "可以语音吗", expectedCategory: "voice_request" },
];

// ---------------------------------------------------------------------------
// 4. Qwen API 调用（单次，无历史）
// ---------------------------------------------------------------------------
async function callQwen(userInput) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ];

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
      max_tokens: 1000,
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
// 5. 解析和校验 tool_calls
// ---------------------------------------------------------------------------
function analyzeToolCalls(data) {
  const choice = data?.choices?.[0];
  if (!choice) return { toolCalls: [], hasAny: false };

  const rawCalls = choice.message?.tool_calls ?? [];

  const toolCalls = rawCalls.map((tc) => {
    const name = tc.function?.name ?? "";
    const nameValid = TOOL_NAMES.includes(name);

    let args = {};
    let parseOk = true;
    try {
      args = typeof tc.function?.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments ?? {};
    } catch {
      parseOk = false;
    }

    // 参数完整性：必填字段是否都存在
    const requiredFields = REQUIRED_FIELDS[name] ?? [];
    const argsComplete = parseOk && requiredFields.every((f) => f in args);

    return { id: tc.id, name, args, nameValid, parseOk, argsComplete, formatOk: nameValid && parseOk && argsComplete };
  });

  return { toolCalls, hasAny: toolCalls.length > 0 };
}

// ---------------------------------------------------------------------------
// 6. 主流程
// ---------------------------------------------------------------------------
async function main() {
  const results = [];
  let totalFormatOk = 0;
  let totalWithToolCalls = 0;
  let totalArgsComplete = 0;
  let totalCalls = 0;
  let totalErrors = 0;
  let totalElapsedMs = 0;

  console.log(`开始批量测试，共 ${TEST_CASES.length} 组输入...\n`);

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}/20] 测试: "${tc.input}" ... `);

    let toolCalls = [];
    let hasAny = false;
    let error = null;
    let elapsedMs = 0;

    try {
      const { data, elapsedMs: ms } = await callQwen(tc.input);
      elapsedMs = ms;
      const analysis = analyzeToolCalls(data);
      toolCalls = analysis.toolCalls;
      hasAny = analysis.hasAny;
    } catch (err) {
      error = err.message;
      totalErrors++;
    }

    // 统计
    const callCount = toolCalls.length;
    const formatOkCount = toolCalls.filter((c) => c.formatOk).length;
    const argsCompleteCount = toolCalls.filter((c) => c.argsComplete).length;

    totalCalls += callCount;
    totalWithToolCalls += hasAny ? 1 : 0;
    totalFormatOk += formatOkCount;
    totalArgsComplete += argsCompleteCount;
    totalElapsedMs += elapsedMs;

    // 工具选择合理率：返回的工具名列表中是否包含 expectedCategory 对应的期望工具
    const expectedTools = EXPECTED_TOOLS[tc.expectedCategory] ?? [];
    const returnedNames = toolCalls.map((c) => c.name);
    const toolChoiceOk = expectedTools.length === 0 || expectedTools.some((t) => returnedNames.includes(t));

    const statusIcon = error ? "✗ ERR" : hasAny ? (formatOkCount === callCount ? "✓" : "~") : "✗ NONE";
    console.log(`${statusIcon}  [${returnedNames.join(", ") || "—"}]  ${elapsedMs}ms`);

    results.push({
      id: tc.id,
      category: tc.category,
      input: tc.input,
      error,
      hasAny,
      callCount,
      formatOkCount,
      argsCompleteCount,
      toolChoiceOk,
      elapsedMs,
      returnedNames,
    });

    // 避免 rate limit，间隔 300ms
    await new Promise((r) => setTimeout(r, 300));
  }

  // ---------------------------------------------------------------------------
  // 7. 输出统计报告
  // ---------------------------------------------------------------------------
  const tested = TEST_CASES.length - totalErrors;
  const withToolCallsRate = ((totalWithToolCalls / TEST_CASES.length) * 100).toFixed(1);
  const formatOkRate = totalCalls > 0 ? ((totalFormatOk / totalCalls) * 100).toFixed(1) : "N/A";
  const argsCompleteRate = totalCalls > 0 ? ((totalArgsComplete / totalCalls) * 100).toFixed(1) : "N/A";
  const toolChoiceOkCount = results.filter((r) => r.toolChoiceOk).length;
  const toolChoiceRate = ((toolChoiceOkCount / TEST_CASES.length) * 100).toFixed(1);
  const avgElapsed = tested > 0 ? Math.round(totalElapsedMs / tested) : 0;

  console.log(`
${'='.repeat(60)}`);
  console.log(`T0.2 Qwen tool_use 稳定性统计报告`);
  console.log(`${'='.repeat(60)}`);
  console.log(`模型        : ${MODEL}`);
  console.log(`测试用例    : ${TEST_CASES.length} 组`);
  console.log(`API 错误    : ${totalErrors} 次`);
  console.log(`平均耗时    : ${avgElapsed}ms`);
  console.log(``);
  console.log(`【指标】`);
  console.log(`  有 tool_call 返回率 : ${withToolCallsRate}%  (${totalWithToolCalls}/${TEST_CASES.length})`);
  console.log(`  tool_call 格式正确率: ${formatOkRate}%  (${totalFormatOk}/${totalCalls} 个调用)`);
  console.log(`  参数完整率          : ${argsCompleteRate}%  (${totalArgsComplete}/${totalCalls} 个调用)`);
  console.log(`  工具选择合理率      : ${toolChoiceRate}%  (${toolChoiceOkCount}/${TEST_CASES.length})`);
  console.log(``);

  // 按分类统计
  const categories = [...new Set(TEST_CASES.map((t) => t.category))];
  console.log(`【分类统计】`);
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catOk = catResults.filter((r) => r.hasAny && r.formatOkCount === r.callCount).length;
    console.log(`  ${cat.padEnd(20)} ${catOk}/${catResults.length} 格式正确`);
  }

  // 失败用例列表
  const failed = results.filter((r) => r.error || !r.hasAny || r.formatOkCount < r.callCount);
  if (failed.length > 0) {
    console.log(``);
    console.log(`【失败/异常用例】`);
    for (const r of failed) {
      const reason = r.error ? `错误: ${r.error}` : !r.hasAny ? `无 tool_call 返回` : `格式错误 (${r.formatOkCount}/${r.callCount} 正确)`;
      console.log(`  #${r.id} [${r.category}] "${r.input}" → ${reason}`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

main().catch((err) => {
  console.error("[fatal]", err.message);
  process.exit(1);
});
