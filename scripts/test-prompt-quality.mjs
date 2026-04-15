/**
 * T4.5 — Prompt 质量自动评估脚本
 * 向 Qwen 发送 3 组测试输入，检查 tool_call 格式和质量。
 * 运行：node --env-file=.env.local scripts/test-prompt-quality.mjs
 */

import { buildSystemPromptForTest } from "./prompt-test-helpers.mjs";

const QWEN_API_KEY = process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY;
const QWEN_BASE_URL = process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.QWEN_MODEL ?? "qwen3.6-plus";

if (!QWEN_API_KEY) {
  console.error("❌ 缺少 QWEN_API_KEY / DASHSCOPE_API_KEY");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 工具定义（与 lib/agent/tool-definitions.ts 保持一致）
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: "function",
    function: {
      name: "narrate",
      description: "朗读一段话给孩子听，用于开场白、反馈、过渡语",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "要朗读的文本，不超过 30 字" },
          voiceRole: { type: "string", enum: ["guide", "opponent", "maker", "storyteller"] },
          autoSpeak: { type: "boolean" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_choices",
      description: "展示 2-4 个选择卡片",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                desc: { type: "string" },
              },
              required: ["id", "label"],
            },
          },
        },
        required: ["prompt", "choices"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_text_input",
      description: "显示文字输入框，请孩子输入回答",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          placeholder: { type: "string" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description: "内部思考，不展示给孩子，用于规划下一步",
      parameters: {
        type: "object",
        properties: { reasoning: { type: "string" } },
        required: ["reasoning"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

const TEST_CASES = [
  {
    name: "7岁开场（math-thinking）",
    profile: { nickname: "小明", birthday: "2019-03-15", goalPreferences: ["math-thinking"] },
    goals: ["math-thinking"],
    userInput: "你好！",
    expectations: {
      hasNarrate: true,
      hasChoicesOrInput: true,
      narrateMaxChars: 30,
      minToolCalls: 1,
      maxToolCalls: 3,
    },
  },
  {
    name: "10岁数列追问（logical-reasoning）",
    profile: { nickname: "小红", birthday: "2016-07-20", goalPreferences: ["logical-reasoning"] },
    goals: ["logical-reasoning"],
    userInput: "我觉得下一个数是 9",
    expectations: {
      hasNarrate: true,
      hasChoicesOrInput: false,
      narrateMaxChars: 40,
      minToolCalls: 1,
      maxToolCalls: 3,
    },
  },
  {
    name: "孩子卡住（creative-thinking）",
    profile: { nickname: "小华", birthday: "2017-11-01", goalPreferences: ["creative-thinking"] },
    goals: ["creative-thinking"],
    userInput: "不知道怎么回答",
    expectations: {
      hasNarrate: true,
      hasChoicesOrInput: true,
      narrateMaxChars: 30,
      minToolCalls: 1,
      maxToolCalls: 3,
    },
  },
];

// ---------------------------------------------------------------------------
// 核心调用
// ---------------------------------------------------------------------------

async function callQwen(systemPrompt, userInput) {
  const resp = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${QWEN_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      tools: TOOLS,
      tool_choice: "required",
      temperature: 0.4,
      max_tokens: 1000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Qwen API ${resp.status}: ${err}`);
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// 评估单个用例
// ---------------------------------------------------------------------------

function evaluate(testCase, response) {
  const choice = response.choices?.[0];
  const toolCalls = choice?.message?.tool_calls ?? [];

  const results = [];
  const { expectations } = testCase;

  // 1. tool_call 数量
  const countOk =
    toolCalls.length >= expectations.minToolCalls &&
    toolCalls.length <= expectations.maxToolCalls;
  results.push({
    check: `tool_call 数量 [${toolCalls.length}]`,
    ok: countOk,
    detail: `期望 ${expectations.minToolCalls}-${expectations.maxToolCalls}`,
  });

  const names = toolCalls.map((tc) => tc.function?.name);

  // 2. 是否有 narrate
  if (expectations.hasNarrate) {
    const has = names.includes("narrate");
    const narText = toolCalls.find((tc) => tc.function?.name === "narrate");
    let args = {};
    try { args = JSON.parse(narText?.function?.arguments ?? "{}"); } catch { /**/ }
    const textLen = (args.text ?? "").length;
    const lenOk = textLen <= expectations.narrateMaxChars;
    results.push({ check: "narrate 存在", ok: has });
    results.push({
      check: `narrate 文本长度 [${textLen} 字]`,
      ok: lenOk,
      detail: `上限 ${expectations.narrateMaxChars} 字`,
    });
  }

  // 3. 是否有 show_choices 或 show_text_input
  if (expectations.hasChoicesOrInput) {
    const has = names.includes("show_choices") || names.includes("show_text_input");
    results.push({ check: "展示/输入工具 存在", ok: has });
  }

  // 4. JSON 格式全部可解析
  const allParseable = toolCalls.every((tc) => {
    try { JSON.parse(tc.function?.arguments ?? "{}"); return true; } catch { return false; }
  });
  results.push({ check: "所有 arguments 可 JSON 解析", ok: allParseable });

  return results;
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🔍 Prompt 质量评估 — 模型: ${MODEL}\n${"-".repeat(60)}`);

  let totalChecks = 0;
  let passedChecks = 0;

  for (const tc of TEST_CASES) {
    console.log(`\n📋 ${tc.name}`);

    // 构建 system prompt
    const systemPrompt = buildSystemPromptForTest(tc.profile, tc.goals);
    const tokenEstimate = Math.round(
      (systemPrompt.match(/[\u4e00-\u9fff]/g) ?? []).length * 1.5 +
      systemPrompt.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).length * 0.75
    );
    console.log(`   System prompt: ~${tokenEstimate} tokens`);

    let response;
    try {
      response = await callQwen(systemPrompt, tc.userInput);
    } catch (err) {
      console.log(`   ❌ API 调用失败: ${err.message}`);
      continue;
    }

    const toolCalls = response.choices?.[0]?.message?.tool_calls ?? [];
    console.log(`   Tool calls (${toolCalls.length}): ${toolCalls.map((tc) => tc.function?.name).join(", ")}`);

    const results = evaluate(tc, response);
    for (const r of results) {
      totalChecks++;
      if (r.ok) passedChecks++;
      const icon = r.ok ? "✅" : "❌";
      const detail = r.detail ? ` (${r.detail})` : "";
      console.log(`   ${icon} ${r.check}${detail}`);
    }

    // 等待 500ms 避免限速
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n${"-".repeat(60)}`);
  console.log(`📊 结果: ${passedChecks}/${totalChecks} 通过 (${Math.round(passedChecks/totalChecks*100)}%)`);

  if (passedChecks / totalChecks < 0.8) {
    console.log("⚠️  通过率低于 80%，需要调整 prompt");
    process.exit(1);
  } else {
    console.log("🎉 通过率 >= 80%，prompt 质量达标");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
