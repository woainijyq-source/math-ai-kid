/**
 * T1.4 验证测试 — tool-validators 单元测试（5 个用例）
 * 用法: node scripts/test-tool-validators.mjs
 * 先用 tsc 编译到 .tmp-test/ 再 import
 */

import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const outDir = resolve(projectRoot, ".tmp-test");

// 写一个临时 tsconfig，只编译需要的文件
const tmpTsConfig = resolve(projectRoot, ".tmp-tsconfig.json");
writeFileSync(tmpTsConfig, JSON.stringify({
  compilerOptions: {
    target: "ES2020",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: outDir,
    rootDir: projectRoot,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
  },
  include: [
    "types/agent.ts",
    "lib/agent/tool-definitions.ts",
    "lib/agent/tool-validators.ts",
  ],
}));

try {
  execSync(`npx tsc -p .tmp-tsconfig.json`, { cwd: projectRoot, stdio: "pipe" });
} catch (e) {
  console.error("[build error]", e.stderr?.toString() || e.stdout?.toString());
  process.exit(1);
} finally {
  try { rmSync(tmpTsConfig); } catch {}
}

// import 编译后的 JS
const validatorsPath = resolve(outDir, "lib/agent/tool-validators.js");
const { validateToolCall, isKnownTool } = await import(pathToFileURL(validatorsPath).href);

// ---------------------------------------------------------------------------
// 测试框架（极简）
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function test(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

// ---------------------------------------------------------------------------
// 用例 1：正确调用 narrate
// ---------------------------------------------------------------------------
test("用例1: narrate 正确调用", () => {
  const result = validateToolCall({
    id: "tc-1",
    name: "narrate",
    arguments: { text: "你好，小探险家！", voiceRole: "guide" },
  });
  assert(result.valid === true, "valid 为 true");
  assert(result.errors === undefined, "无错误");
  assert(result.fixed?.arguments?.autoSpeak === true, "自动补全 autoSpeak=true");
});

// ---------------------------------------------------------------------------
// 用例 2：缺少必填参数
// ---------------------------------------------------------------------------
test("用例2: show_choices 缺少 choices 字段", () => {
  const result = validateToolCall({
    id: "tc-2",
    name: "show_choices",
    arguments: { prompt: "选一个" },
  });
  assert(result.valid === false, "valid 为 false");
  assert(Array.isArray(result.errors) && result.errors.length > 0, "有错误信息");
  assert(
    result.errors.some((e) => e.includes("choices")),
    "错误信息包含 choices"
  );
});

// ---------------------------------------------------------------------------
// 用例 3：类型错误 — completionRate 传了字符串，自动修复
// ---------------------------------------------------------------------------
test("用例3: end_activity completionRate 传字符串，自动修复为数字", () => {
  const result = validateToolCall({
    id: "tc-3",
    name: "end_activity",
    arguments: { summary: "完成了本次活动", completionRate: "85" },
  });
  assert(result.valid === true, "修复后 valid 为 true");
  assert(result.fixed?.arguments?.completionRate === 85, "completionRate 被修复为数字 85");
});

// ---------------------------------------------------------------------------
// 用例 4：未知工具名
// ---------------------------------------------------------------------------
test("用例4: 未知工具名返回 valid=false", () => {
  const result = validateToolCall({
    id: "tc-4",
    name: "fly_to_moon",
    arguments: { destination: "moon" },
  });
  assert(result.valid === false, "valid 为 false");
  assert(
    result.errors?.some((e) => e.includes("未知工具名")),
    "错误信息包含未知工具名"
  );
  assert(result.fixed === undefined, "没有 fixed 字段");
});

// ---------------------------------------------------------------------------
// 用例 5：可修复场景 — show_choices.choices 不是数组
// ---------------------------------------------------------------------------
test("用例5: show_choices choices 不是数组，自动包装成数组", () => {
  const singleChoice = { id: "a", label: "选项A" };
  const result = validateToolCall({
    id: "tc-5",
    name: "show_choices",
    arguments: { prompt: "选一个", choices: singleChoice },
  });
  const fixedChoices = result.fixed?.arguments?.choices;
  assert(Array.isArray(fixedChoices), "choices 被包装成数组");
  assert(fixedChoices?.[0] === singleChoice, "原始对象保留为第一个元素");
});

// ---------------------------------------------------------------------------
// isKnownTool 测试
// ---------------------------------------------------------------------------
test("isKnownTool: 已知/未知工具", () => {
  assert(isKnownTool("narrate") === true, "narrate 是已知工具");
  assert(isKnownTool("award_badge") === true, "award_badge 是已知工具");
  assert(isKnownTool("log_observation") === true, "log_observation 是已知工具");
  assert(isKnownTool("fly_to_moon") === false, "fly_to_moon 不是已知工具");
});

// ---------------------------------------------------------------------------
// 结果汇总
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`);
console.log(`T1.4 单元测试结果: ${passed} 通过 / ${failed} 失败`);
console.log('='.repeat(50));

// 清理编译产物
try { rmSync(outDir, { recursive: true }); } catch {}

if (failed > 0) process.exit(1);
