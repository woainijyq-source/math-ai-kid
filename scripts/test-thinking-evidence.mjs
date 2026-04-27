import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const Module = require("node:module");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      skipLibCheck: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

Module._resolveFilename = function resolvePathAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      resolve(projectRoot, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const {
  DAILY_SCENARIO_TEMPLATES,
  applyScenarioTemplateVariablesToText,
  scenarioTemplateToDailyQuestion,
} = require("../content/daily/scenario-templates.ts");
const {
  buildThinkingEvidenceFromConversation,
} = require("../lib/daily/thinking-evidence.ts");
const {
  buildParentProjectPlans,
} = require("../lib/daily/thinking-growth-progress.ts");
const {
  validateAndRepairTurn,
} = require("../lib/agent/turn-validator.ts");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${message}`);
    failed += 1;
  }
}

function test(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

const mathTemplate = DAILY_SCENARIO_TEMPLATES.find((template) => template.id === "math-fruit-share-1");
if (!mathTemplate) {
  throw new Error("missing math-fruit-share-1 template");
}
const mathQuestion = scenarioTemplateToDailyQuestion(mathTemplate);

test("证据抽取按儿童表达质量分层", () => {
  const choiceEvidence = buildThinkingEvidenceFromConversation({
    question: mathQuestion,
    supportLevel: "light",
    conversation: [
      {
        role: "assistant",
        toolCalls: [
          {
            id: "choices-1",
            name: "show_choices",
            arguments: {
              prompt: "你会先怎么分？",
              choices: [
                { id: "a", label: "先看能不能一样多" },
                { id: "b", label: "先一人一块" },
              ],
            },
          },
        ],
      },
      { role: "user", content: "先一人一块" },
    ],
  })[0];

  assert(choiceEvidence.level === 1, "只点选项只算 L1 薄线索");
  assert(choiceEvidence.childInitiated === false, "只点选项不算孩子主动发起");
  assert(choiceEvidence.supportLevel === "heavy", "只点选项被标记为 heavy support");

  const reasonedEvidence = buildThinkingEvidenceFromConversation({
    question: mathQuestion,
    supportLevel: "light",
    conversation: [
      { role: "user", content: "因为先数清楚，才能知道一共够不够" },
    ],
  })[0];
  assert(reasonedEvidence.level === 2, "孩子主动说理由计入 L2");
  assert(reasonedEvidence.childInitiated === true, "主动理由被识别为 childInitiated");

  const conditionEvidence = buildThinkingEvidenceFromConversation({
    question: mathQuestion,
    supportLevel: "light",
    conversation: [
      { role: "user", content: "如果又来了一个人，就重新数人数再分" },
    ],
  })[0];
  assert(conditionEvidence.level === 3, "处理条件变化计入 L3");

  const reflectionEvidence = buildThinkingEvidenceFromConversation({
    question: mathQuestion,
    supportLevel: "light",
    conversation: [
      { role: "user", content: "我的办法是先数人数，因为人数换了就要改成新的分法" },
    ],
  })[0];
  assert(reflectionEvidence.level === 4, "孩子自己总结办法并修正条件计入 L4");
});

test("稳定证据规则驱动家长项目升层", () => {
  const stableEvidence = [
    {
      themeId: "math",
      scenarioId: "share-a",
      scenarioTitle: "分水果 A",
      thinkingMove: "compare",
      level: 2,
      childInitiated: true,
      supportLevel: "light",
      confidence: 0.8,
      childUtterance: "因为先看人数，再比较每个人拿到的是不是差不多",
      createdAt: "2026-04-26T10:00:00.000Z",
    },
    {
      themeId: "math",
      scenarioId: "share-b",
      scenarioTitle: "分点心 B",
      thinkingMove: "compare",
      level: 2,
      childInitiated: true,
      supportLevel: "medium",
      confidence: 0.78,
      childUtterance: "我会比较两种分法，哪种更容易让大家点头",
      createdAt: "2026-04-25T10:00:00.000Z",
    },
  ];

  const plans = buildParentProjectPlans({
    logs: [],
    observations: [],
    thinkingEvidence: stableEvidence,
  });
  const mathPlan = plans.find((plan) => plan.themeId === "math");
  const compareMove = mathPlan.targetThinkingMoves.find((move) => move.move === "compare");

  assert(plans.length === 5, "家长项目仍返回 5 个主题");
  assert(mathPlan.currentLevel === 2, "最近 5 条中 2 条同类证据、跨 2 场景且含 light support 时升到 L2");
  assert(compareMove.evidenceCount === 2, "Thinking Move summary 使用独立证据计数");
  assert(mathPlan.recentEvidence[0]?.includes("证据"), "真实证据进入家长端最近观察");

  const thinPlans = buildParentProjectPlans({
    logs: [],
    observations: [],
    thinkingEvidence: [
      {
        ...stableEvidence[0],
        scenarioId: "share-a",
        supportLevel: "heavy",
      },
      {
        ...stableEvidence[1],
        scenarioId: "share-a",
        supportLevel: "medium",
      },
    ],
  });
  const thinMathPlan = thinPlans.find((plan) => plan.themeId === "math");
  assert(thinMathPlan.currentLevel === 1, "heavy support 或同一场景不足以触发稳定升层");
});

test("ScenarioTemplate 变量只做模板内替换", () => {
  const shopTemplate = DAILY_SCENARIO_TEMPLATES.find((template) => template.id === "math-shop-change-1");
  if (!shopTemplate) throw new Error("missing math-shop-change-1 template");

  const rendered = applyScenarioTemplateVariablesToText(
    "一个面包 6 元，一盒牛奶 4 元。",
    shopTemplate,
    { firstPrice: "5 元", secondPrice: "3 元" },
  );
  const variantQuestion = scenarioTemplateToDailyQuestion(shopTemplate, "profile-a:2026-04-26");

  assert(rendered.includes("5 元") && rendered.includes("3 元"), "变量替换使用模板声明的默认值位置");
  assert(Boolean(variantQuestion.scenarioVariantKey), "模板变体带有稳定 variant key");
  assert(Object.keys(variantQuestion.scenarioVariables ?? {}).length === shopTemplate.variables.length, "模板变体记录本轮变量取值");
});

test("对话安全修复仍覆盖核心风险", () => {
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: {
        text: "正确答案是蓝色，这是我们的秘密。你可能有多动症。",
      },
    },
  ], {
    childInput: {
      sessionId: "safety-test",
      input: "我选蓝色",
      inputType: "text",
    },
    conversation: [{ role: "user", content: "开场" }],
    turnIndex: 1,
    currentSubGoalId: "explain-reasoning",
  });
  const text = String(result.calls[0].arguments.text);
  assert(!/正确答案|秘密|多动症/.test(text), "安全修复移除答案、秘密和诊断措辞");
  assert(/不是正式判断|可以告诉/.test(text), "安全修复保留非正式观察和可告知大人的边界");
});

console.log(`\n${"=".repeat(50)}`);
console.log(`thinking-evidence 测试结果: ${passed} 通过 / ${failed} 失败`);
console.log("=".repeat(50));

if (failed > 0) process.exit(1);
