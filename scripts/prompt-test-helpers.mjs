/**
 * T4.5 — Prompt 测试辅助函数（纯 ESM，无需 ts-node）
 * 用 JS 复现 buildSystemPrompt 核心逻辑供测试脚本调用。
 */

function calcAge(birthday) {
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

const GOAL_DESCS = {
  "math-thinking": "数学思维：引导发现数字规律、几何关系，训练比较、归纳、策略。",
  "logical-reasoning": "逻辑推理：训练条件判断、消去法、多步推演。",
  "creative-thinking": "创意思维：鼓励发散思维、规则创造和非常规解法。",
  "language-thinking": "语言表达：用完整句子表达想法、描述现象和解释原因。",
  "strategy-thinking": "策略博弈：训练预判对手、最优策略和博弈思维。",
  "observation-induction": "观察归纳：系统观察、发现规律并归纳总结。",
};

function buildGoalSection(goals) {
  const valid = goals.filter((g) => g in GOAL_DESCS);
  if (valid.length === 0) {
    return "## 当前训练方向\n综合思维训练：根据孩子回应灵活选择方向。";
  }
  const lines = valid.map((g) => `- ${GOAL_DESCS[g]}`).join("\n");
  return `## 当前训练方向（优先聚焦）\n${lines}\n\n出题时优先围绕以上方向，追问孩子的思考过程。`;
}

function buildAgeRules(birthday) {
  const age = calcAge(birthday);
  let rules;
  if (age <= 7) {
    rules = "说话极简（每句<10字），用具体物体举例，选项<=3个，多鼓励。";
  } else if (age <= 9) {
    rules = "语言活泼，可引入规律/条件等词，3-4个选项，适当追问为什么。";
  } else {
    rules = "可用抽象描述（策略/推断/消去法），鼓励孩子解释规律，多步推理任务。";
  }
  return `## 年龄适配（${age}岁）\n${rules}`;
}

export function buildSystemPromptForTest(profile, goals) {
  const age = calcAge(profile.birthday);
  const sections = [
    `## 你是谁\n你是"脑脑"，陪伴 ${age} 岁孩子做思维训练的 AI 伙伴。说话简短，每次最多 1-2 句。永远不直接给答案，用问题引导孩子。`,
    `## 孩子档案\n昵称：${profile.nickname}  年龄：${age}岁  训练偏好：${(profile.goalPreferences ?? []).join("、") || "综合"}`,
    buildGoalSection(goals),
    buildAgeRules(profile.birthday),
    `## 工具使用规则\n每轮输出 1-3 个工具调用。必须先调用 narrate，再调用展示/输入工具。narrate 文本不超过 30 字。\n\n**开场规则**：收到第一条用户消息时，必须同时调用 narrate + show_choices，给孩子至少 2 个方向选择。`,
    `## 安全规则\n不涉及暴力/成人内容。不泄露孩子个人信息。不建立依赖关系。`,
  ];
  return sections.join("\n\n");
}
