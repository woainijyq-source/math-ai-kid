/**
 * T1.4 — 工具参数校验器
 * 对每个工具的 arguments 进行校验，并尝试自动修复常见问题。
 */

import type { ToolCall, ToolName } from "../../types/agent";
import { KNOWN_TOOL_NAMES } from "./tool-definitions";

// ---------------------------------------------------------------------------
// 校验结果类型
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  fixed?: ToolCall;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function err(errors: string[], msg: string) {
  errors.push(msg);
}

function hasField(args: Record<string, unknown>, field: string): boolean {
  return field in args && args[field] !== undefined && args[field] !== null;
}

/** 尝试把字符串转为数字，失败返回 undefined */
function coerceNumber(val: unknown): number | undefined {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

/** 尝试把非数组值包装成数组 */
function coerceArray(val: unknown): unknown[] | undefined {
  if (Array.isArray(val)) return val;
  if (val !== undefined && val !== null) return [val];
  return undefined;
}

// ---------------------------------------------------------------------------
// 各工具的校验 + 自动修复逻辑
// ---------------------------------------------------------------------------

function validateNarrate(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  const fixed = { ...args };

  if (!hasField(args, "text") || typeof args["text"] !== "string") {
    err(errors, "narrate: 缺少必填字段 text（string）");
  }

  // 自动修复：缺少 autoSpeak → 补默认 true
  if (!("autoSpeak" in fixed)) {
    fixed["autoSpeak"] = true;
  }

  // voiceRole 枚举校验
  const validRoles = ["guide", "opponent", "maker", "storyteller"];
  if (hasField(fixed, "voiceRole") && !validRoles.includes(fixed["voiceRole"] as string)) {
    err(errors, `narrate: voiceRole 值无效，期望 ${validRoles.join(" | ")}`);
    fixed["voiceRole"] = "guide"; // 修复为默认值
  }

  return fixed;
}

function validateShowChoices(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  const fixed = { ...args };

  if (!hasField(args, "prompt") || typeof args["prompt"] !== "string") {
    err(errors, "show_choices: 缺少必填字段 prompt（string）");
  }

  // 自动修复：choices 不是数组 → 尝试包装
  if (!hasField(args, "choices")) {
    err(errors, "show_choices: 缺少必填字段 choices（array）");
  } else if (!Array.isArray(args["choices"])) {
    const wrapped = coerceArray(args["choices"]);
    if (wrapped) {
      fixed["choices"] = wrapped;
    } else {
      err(errors, "show_choices: choices 不是数组且无法修复");
    }
  } else {
    // 校验每个 choice 是否有 id 和 label
    const choices = args["choices"] as unknown[];
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i] as Record<string, unknown>;
      if (!hasField(c, "id")) err(errors, `show_choices: choices[${i}] 缺少 id`);
      if (!hasField(c, "label")) err(errors, `show_choices: choices[${i}] 缺少 label`);
    }
  }

  return fixed;
}

function validateShowTextInput(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  if (!hasField(args, "prompt") || typeof args["prompt"] !== "string") {
    err(errors, "show_text_input: 缺少必填字段 prompt（string）");
  }
  return { ...args };
}

function validateShowImage(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  if (!hasField(args, "alt") || typeof args["alt"] !== "string") {
    err(errors, "show_image: 缺少必填字段 alt（string）");
  }
  return { ...args };
}

function validateRequestVoice(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  if (!hasField(args, "prompt") || typeof args["prompt"] !== "string") {
    err(errors, "request_voice: 缺少必填字段 prompt（string）");
  }
  return { ...args };
}

function validateThink(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  if (!hasField(args, "reasoning") || typeof args["reasoning"] !== "string") {
    err(errors, "think: 缺少必填字段 reasoning（string）");
  }
  return { ...args };
}

function validateAwardBadge(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  const required = ["badgeId", "title", "detail"];
  for (const f of required) {
    if (!hasField(args, f) || typeof args[f] !== "string") {
      err(errors, `award_badge: 缺少必填字段 ${f}（string）`);
    }
  }
  return { ...args };
}

function validateEndActivity(
  args: Record<string, unknown>,
  errors: string[]
): Record<string, unknown> {
  const fixed = { ...args };

  if (!hasField(args, "summary") || typeof args["summary"] !== "string") {
    err(errors, "end_activity: 缺少必填字段 summary（string）");
  }

  // 自动修复：数字字段传了字符串 → 尝试转换
  if (!hasField(args, "completionRate")) {
    err(errors, "end_activity: 缺少必填字段 completionRate（number）");
  } else {
    const coerced = coerceNumber(args["completionRate"]);
    if (coerced === undefined) {
      err(errors, "end_activity: completionRate 不是有效数字");
    } else {
      fixed["completionRate"] = coerced;
    }
  }

  return fixed;
}

// ---------------------------------------------------------------------------
// 主校验函数
// ---------------------------------------------------------------------------

/**
 * 校验一个 ToolCall 的格式和参数完整性。
 * 如果可以自动修复，返回修复后的 ToolCall 在 fixed 字段。
 */
export function validateToolCall(call: ToolCall): ValidationResult {
  const errors: string[] = [];

  // 工具名校验
  if (!isKnownTool(call.name)) {
    return {
      valid: false,
      errors: [`未知工具名: ${call.name}`],
    };
  }

  const args = call.arguments ?? {};
  let fixedArgs: Record<string, unknown> = args;

  switch (call.name as ToolName) {
    case "narrate":
      fixedArgs = validateNarrate(args, errors);
      break;
    case "show_choices":
      fixedArgs = validateShowChoices(args, errors);
      break;
    case "show_text_input":
      fixedArgs = validateShowTextInput(args, errors);
      break;
    case "show_image":
      fixedArgs = validateShowImage(args, errors);
      break;
    case "request_voice":
      fixedArgs = validateRequestVoice(args, errors);
      break;
    case "think":
      fixedArgs = validateThink(args, errors);
      break;
    case "award_badge":
      fixedArgs = validateAwardBadge(args, errors);
      break;
    case "end_activity":
      fixedArgs = validateEndActivity(args, errors);
      break;
    default:
      // 延后工具：只校验工具名已知，参数宽松
      break;
  }

  const valid = errors.length === 0;
  const fixed: ToolCall = { ...call, arguments: fixedArgs };

  return {
    valid,
    fixed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 判断工具名是否已注册。
 */
export function isKnownTool(name: string): boolean {
  return KNOWN_TOOL_NAMES.has(name as ToolName);
}
