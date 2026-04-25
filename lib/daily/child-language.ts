import type { DailyChildSignal, DailyQuestion } from "@/types/daily";

const LEADING_FILLERS = [
  "我觉得",
  "我想",
  "我会",
  "我选",
  "那就",
  "就是",
  "应该是",
  "应该",
  "因为",
  "如果",
  "要是",
  "可能",
  "也许",
  "然后",
  "先",
];

function cleanClause(text: string) {
  let value = text.trim().replace(/[“”"'。！？!?]/g, "");
  for (const filler of LEADING_FILLERS) {
    if (value.startsWith(filler)) {
      value = value.slice(filler.length).trim();
    }
  }
  return value;
}

function pickBestClause(input: string) {
  const clauses = input
    .split(/[，,；;。！？!?]/)
    .map(cleanClause)
    .filter(Boolean);

  if (clauses.length === 0) {
    return "";
  }

  const becauseClause = clauses.find((clause) => clause.includes("因为"));
  if (becauseClause) {
    return cleanClause(becauseClause.split("因为")[0] ?? becauseClause);
  }

  const richClause = clauses.find((clause) => clause.length >= 4 && clause.length <= 14);
  if (richClause) {
    return richClause;
  }

  return clauses[0] ?? "";
}

export function extractChildMirrorPhrase(input: string) {
  const raw = pickBestClause(input);
  if (!raw) {
    return "刚才那个想法";
  }

  if (raw.length <= 14) {
    return raw;
  }

  return raw.slice(0, 14);
}

export function buildMirrorLead(
  input: string,
  signalType?: DailyChildSignal["type"],
) {
  if (signalType === "uncertain") {
    return "林老师听到你还在想。";
  }
  if (signalType === "resistant") {
    return "林老师听到你现在有点不想继续。";
  }
  if (signalType === "off_topic") {
    return "林老师先接住你刚才想到的东西。";
  }

  return `你刚才提到“${extractChildMirrorPhrase(input)}”，林老师听到了。`;
}

export function buildSoftWrap(question: DailyQuestion, input: string) {
  const phrase = extractChildMirrorPhrase(input);

  switch (question.themeId) {
    case "math":
      return `林老师记住你刚才想到的“${phrase}”了。今天你已经把数学小办法越想越清楚，我们先收到这里。`;
    case "pattern":
      return `林老师记住你刚才看到的“${phrase}”了。今天你已经把规律看出来了不少，我们先收到这里。`;
    case "why":
      return `林老师记住你刚才说的“${phrase}”了。今天你已经在认真找原因，我们先收到这里。`;
    case "fairness":
      return `林老师记住你刚才想到的“${phrase}”了。今天你已经在替大家想办法了，我们先收到这里。`;
    case "what-if":
    default:
      return `林老师记住你刚才想到的“${phrase}”了。今天你已经把“如果会怎样”想活了，我们先收到这里。`;
  }
}

export function buildDailyHumanLikeHints(options: {
  question: DailyQuestion;
  childInput?: string;
  signal?: DailyChildSignal;
}) {
  const { question, childInput, signal } = options;

  if (!childInput || !signal) {
    return [
      "开场时像真人一样：先用场景把孩子拉进来，再问一个具体问题。",
      "不要像播报题库，不要一次说太多背景。",
      "开场的理想长度是 1 句场景 + 1 句问题。",
    ];
  }

  return [
    `推荐镜像短语：${extractChildMirrorPhrase(childInput)}`,
    `推荐接话开头：${buildMirrorLead(childInput, signal.type)}`,
    "不要整句复读孩子的长回答，只抓一个短词或短短一句。",
    "先接住，再追问；不要一上来换题或评价对错。",
    signal.suggestedMove === "wrap_up"
      ? `柔性收尾示例：${buildSoftWrap(question, childInput)}`
      : "下一句只推半步，保持像真人聊天，不要连发两个问题。",
  ];
}
