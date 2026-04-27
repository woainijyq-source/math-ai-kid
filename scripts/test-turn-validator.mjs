import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const outDir = resolve(projectRoot, ".tmp-turn-validator-test");
const tmpTsConfig = resolve(projectRoot, ".tmp-turn-validator-tsconfig.json");

writeFileSync(tmpTsConfig, JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir,
    rootDir: projectRoot,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
  },
  include: [
    "types/**/*.ts",
    "lib/agent/turn-validator.ts",
  ],
}));

try {
  execSync("npx tsc -p .tmp-turn-validator-tsconfig.json", { cwd: projectRoot, stdio: "pipe" });
} catch (error) {
  console.error("[build error]", error.stderr?.toString() || error.stdout?.toString());
  process.exit(1);
} finally {
  try { rmSync(tmpTsConfig); } catch {}
}

const modulePath = resolve(outDir, "lib/agent/turn-validator.js");
const { validateAndRepairTurn } = await import(pathToFileURL(modulePath).href);

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

const baseContext = {
  childInput: {
    sessionId: "session-test",
    input: "我觉得是因为太阳被挡住了",
    inputType: "text",
  },
  conversation: [
    { role: "user", content: "开场" },
  ],
  turnIndex: 1,
  currentSubGoalId: "explain-reasoning",
  currentActivityId: "why-shadow-1",
};

test("空泛追问被改成主题相关追问，并引用孩子原话", () => {
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: { text: "好呀，我们继续。你想说什么？" },
    },
    {
      id: "i1",
      name: "show_text_input",
      arguments: { prompt: "你现在想说什么？", placeholder: "随便说", submitLabel: "继续" },
    },
  ], baseContext);
  const narrate = result.calls.find((call) => call.name === "narrate");
  const input = result.calls.find((call) => call.name === "show_text_input");
  assert(narrate?.arguments.text.includes("太阳被挡住"), "narrate 引用孩子关键词");
  assert(!String(narrate?.arguments.text).includes("？"), "narrate 不再额外抛问题");
  assert(String(input?.arguments.prompt).includes("为什么"), "输入 prompt 变成解释型追问");
  assert(result.issues.includes("repaired_contextual_prompt"), "记录 contextual repair issue");
});

test("每轮最多保留一个问题", () => {
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: { text: "你刚才想得不错。为什么这样？还有别的原因吗？" },
    },
    {
      id: "i1",
      name: "request_voice",
      arguments: { prompt: "你先想到什么？为什么？还会怎样？" },
    },
  ], baseContext);
  const combined = result.calls
    .map((call) => Object.values(call.arguments).join(" "))
    .join(" ");
  const questionCount = (combined.match(/[?？]/g) ?? []).length;
  assert(questionCount <= 1, "整轮输出最多一个问号");
});

test("图片上下文追问必须贴图", () => {
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: { text: "我们看一下这个。" },
    },
    {
      id: "img1",
      name: "show_image",
      arguments: {
        alt: "红红蓝、红红蓝的珠子规律图",
        patternSpec: { visibleSequence: ["红色", "红色", "蓝色", "红色", "红色", "蓝色"] },
      },
    },
    {
      id: "i1",
      name: "show_text_input",
      arguments: { prompt: "你怎么看？" },
    },
  ], {
    ...baseContext,
    currentSubGoalId: "inductive-generalization",
  });
  const input = result.calls.find((call) => call.name === "show_text_input");
  assert(String(input?.arguments.prompt).includes("这张图"), "输入 prompt 明确引用图片");
  assert(String(input?.arguments.prompt).includes("规律"), "规律图 prompt 指向规律任务");
});

test("安全边界会清理秘密、诊断和直接给答案", () => {
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: { text: "正确答案是蓝色，不要告诉爸爸妈妈，这是我们的秘密。你可能有多动症。" },
    },
  ], baseContext);
  const text = String(result.calls[0].arguments.text);
  assert(!/正确答案|不要告诉|秘密|多动症/.test(text), "移除高风险原句");
  assert(/不是正式判断|可以告诉/.test(text), "替换为安全边界表达");
});

test("重复追问会被推进到下一步", () => {
  const repeatedPrompt = "如果真的这样了，你觉得第一件事会发生什么？";
  const result = validateAndRepairTurn([
    {
      id: "n1",
      name: "narrate",
      arguments: { text: "我们继续想。" },
    },
    {
      id: "i1",
      name: "request_voice",
      arguments: { prompt: repeatedPrompt },
    },
  ], {
    ...baseContext,
    lastTurnToolCalls: [
      { id: "prev", name: "request_voice", arguments: { prompt: repeatedPrompt } },
    ],
    turnIndex: 2,
    currentSubGoalId: "hypothetical-thinking",
  });
  const input = result.calls.find((call) => call.name === "request_voice");
  assert(input?.arguments.prompt !== repeatedPrompt, "prompt 不再重复上一轮");
  assert(String(input?.arguments.prompt).includes("影响到谁"), "推进到后果影响追问");
});

console.log(`\n${"=".repeat(50)}`);
console.log(`turn-validator 测试结果: ${passed} 通过 / ${failed} 失败`);
console.log("=".repeat(50));

try { rmSync(outDir, { recursive: true }); } catch {}

if (failed > 0) process.exit(1);
