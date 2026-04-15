/**
 * T2.7 — 内容安全过滤器
 * 过滤孩子输入和 AI 输出中的敏感内容。
 */

import type { ToolCall } from "../../types/agent";

// ---------------------------------------------------------------------------
// 孩子输入过滤
// ---------------------------------------------------------------------------

/** 手机号：11 位纯数字（宽松匹配） */
const PHONE_RE = /1[3-9]\d{9}/g;
/** 邮箱 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
/** 地址关键词 */
const ADDRESS_KEYWORDS = [
  "省", "市", "区", "县", "镇", "街道", "路", "号", "楼", "单元", "小区",
  "学校", "幼儿园", "住在", "家在", "地址",
];

function maskAddress(text: string): { result: string; flagged: boolean } {
  let flagged = false;
  let result = text;

  // 检测连续出现 2 个以上地址关键词
  let keywordCount = 0;
  for (const kw of ADDRESS_KEYWORDS) {
    if (text.includes(kw)) keywordCount++;
  }
  if (keywordCount >= 2) {
    // 替换掉包含地址关键词的词组（保守策略：替换整句）
    const sentences = result.split(/[，。！？,!?]/);
    result = sentences
      .map((s) => {
        let cnt = 0;
        for (const kw of ADDRESS_KEYWORDS) {
          if (s.includes(kw)) cnt++;
        }
        if (cnt >= 2) {
          flagged = true;
          return "[已隐藏]";
        }
        return s;
      })
      .join("，");
  }

  return { result, flagged };
}

export interface FilterInputResult {
  filtered: string;
  flagged: boolean;
  reason?: string;
}

/**
 * 过滤孩子输入中的个人信息。
 */
export function filterChildInput(input: string): FilterInputResult {
  let filtered = input;
  let flagged = false;
  const reasons: string[] = [];

  // 手机号
  if (PHONE_RE.test(filtered)) {
    filtered = filtered.replace(PHONE_RE, "[已隐藏]");
    flagged = true;
    reasons.push("phone");
  }
  PHONE_RE.lastIndex = 0;

  // 邮箱
  if (EMAIL_RE.test(filtered)) {
    filtered = filtered.replace(EMAIL_RE, "[已隐藏]");
    flagged = true;
    reasons.push("email");
  }
  EMAIL_RE.lastIndex = 0;

  // 地址
  const { result: addrResult, flagged: addrFlagged } = maskAddress(filtered);
  if (addrFlagged) {
    filtered = addrResult;
    flagged = true;
    reasons.push("address");
  }

  return {
    filtered,
    flagged,
    reason: reasons.length > 0 ? reasons.join(",") : undefined,
  };
}

// ---------------------------------------------------------------------------
// AI 输出过滤
// ---------------------------------------------------------------------------

/** 暴力/恐怖关键词 */
const VIOLENCE_KEYWORDS = ["杀", "死亡", "血", "打死", "爆炸", "炸弹", "恐怖", "鬼", "尸体"];

/** 依赖性语言模式 */
const DEPENDENCY_PATTERNS = [
  /你只需要我/g,
  /只有我能帮你/g,
  /不要告诉(爸爸|妈妈|家长|父母)/g,
  /我们的秘密/g,
];

function sanitizeNarrateText(text: string): string {
  let result = text;

  // 替换暴力关键词
  for (const kw of VIOLENCE_KEYWORDS) {
    result = result.replaceAll(kw, "✨");
  }

  // 移除依赖性语言
  for (const pattern of DEPENDENCY_PATTERNS) {
    result = result.replace(pattern, "");
    pattern.lastIndex = 0;
  }

  return result.trim();
}

/**
 * 过滤 AI 输出的 tool_calls，清理 narrate 文本中的不当内容。
 */
export function filterAIOutput(toolCalls: ToolCall[]): ToolCall[] {
  return toolCalls.map((tc) => {
    if (tc.name !== "narrate") return tc;

    const text = tc.arguments?.text;
    if (typeof text !== "string") return tc;

    const sanitized = sanitizeNarrateText(text);
    if (sanitized === text) return tc;

    return {
      ...tc,
      arguments: { ...tc.arguments, text: sanitized },
    };
  });
}
