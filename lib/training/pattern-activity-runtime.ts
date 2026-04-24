import { PATTERN_RECOGNITION_CHALLENGE_BANK } from "@/content/goals/pattern-recognition-challenges";
import { resolveOpenAIChatProvider } from "@/lib/ai/qwen-chat";
import {
  getActivitySession,
  updateActivitySessionRuntime,
  type ActivitySessionRow,
} from "@/lib/data/db";
import { getSubGoalPlaybook } from "@/lib/training/domain-pedagogy";
import { calcAge } from "@/prompts/modules/age-adapter";
import type { ToolCall } from "@/types/agent";
import type {
  ChallengeGenerationStatus,
  DifficultyLevelName,
  GeneratedPatternChallengeSpec,
  GeneratedPatternVisualItem,
  GeneratedPatternVisualShape,
  PatternChallengeCard,
  PatternChallengeSource,
  PatternKind,
  PromptAssemblyState,
  RepairStrategy,
} from "@/types/goals";

const GENERATOR_RETRY_LIMIT = 2;

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  blue: "#60a5fa",
  green: "#34d399",
  purple: "#8b5cf6",
  orange: "#fb923c",
};

type GeneratedChallengeResolution = {
  spec: GeneratedPatternChallengeSpec;
  source: PatternChallengeSource;
  generationStatus: ChallengeGenerationStatus;
  fallbackCardId?: string;
};

type AnswerEvaluation = {
  correctness: "correct" | "incorrect";
  matchedAnswer?: string;
  hasReasoningSignal: boolean;
  reasoningKind?: "rule_statement" | "contrastive_rebuttal";
};

type GeneratorConstraints = {
  activitySessionId: string;
  birthday?: string;
  difficultyLevel?: DifficultyLevelName;
};

function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;:：；"'`~()（）]/g, "");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function difficultyToRank(level: DifficultyLevelName | undefined): number {
  switch (level) {
    case "L2":
      return 1;
    case "L3":
      return 2;
    case "L4":
      return 3;
    default:
      return 0;
  }
}

function ageDifficultyFloor(age?: number): DifficultyLevelName {
  if (age === undefined) return "L1";
  if (age >= 11) return "L4";
  if (age >= 9) return "L3";
  if (age >= 7) return "L2";
  return "L1";
}

function maxDifficulty(
  left: DifficultyLevelName | undefined,
  right: DifficultyLevelName | undefined,
): DifficultyLevelName {
  return difficultyToRank(left) >= difficultyToRank(right) ? left ?? "L1" : right ?? "L1";
}

function getAllowedPatternFamilies(level: DifficultyLevelName): string[] {
  switch (level) {
    case "L4":
      return ["quantity_alternating_delta", "attribute_triplet_cycle", "space_rotation_cycle"];
    case "L3":
      return ["quantity_repeat_step", "attribute_color_shape_cycle", "space_rotation_step"];
    case "L2":
      return ["quantity_step", "quantity_repeat_pairs", "attribute_alternating", "space_direction_alternating"];
    case "L1":
    default:
      return ["quantity_step", "attribute_alternating", "space_direction_alternating"];
  }
}

function inferPatternKindFromFamily(family: string): PatternKind {
  if (family.startsWith("quantity")) return "quantity";
  if (family.startsWith("space")) return "space";
  return "attribute";
}

function extractJsonObject(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
}

function sanitizeColor(color?: string): string {
  if (!color) return COLOR_MAP.purple;
  const normalized = color.trim().toLowerCase();
  return normalized.startsWith("#") ? normalized : COLOR_MAP[normalized] ?? color;
}

function sanitizeRotation(rotation?: number): 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315 {
  const allowed = [0, 45, 90, 135, 180, 225, 270, 315] as const;
  if (typeof rotation !== "number") return 0;
  return allowed.reduce((best, current) =>
    Math.abs(current - rotation) < Math.abs(best - rotation) ? current : best,
  );
}

function sanitizeVisualItem(input: GeneratedPatternVisualItem): GeneratedPatternVisualItem | null {
  if (!input || typeof input.label !== "string" || !input.label.trim()) return null;
  const shape =
    input.shape === "circle" ||
    input.shape === "square" ||
    input.shape === "triangle" ||
    input.shape === "diamond" ||
    input.shape === "arrow"
      ? input.shape
      : undefined;
  return {
    kind: input.kind === "shape" || input.kind === "symbol" ? input.kind : "number",
    label: input.label.trim(),
    text: typeof input.text === "string" ? input.text.trim() : undefined,
    shape,
    color: sanitizeColor(input.color),
    size: input.size === "small" || input.size === "large" ? input.size : "medium",
    rotation: sanitizeRotation(input.rotation),
  };
}

function numberItem(value: number | string): GeneratedPatternVisualItem {
  return { kind: "number", label: String(value), text: String(value) };
}

function shapeItem(
  label: string,
  shape: GeneratedPatternVisualShape,
  color: string,
  rotation: GeneratedPatternVisualItem["rotation"] = 0,
  size: GeneratedPatternVisualItem["size"] = "medium",
): GeneratedPatternVisualItem {
  return { kind: "shape", label, shape, color, rotation, size };
}

function buildGenericFallbackSpec(card: PatternChallengeCard): GeneratedPatternChallengeSpec {
  const base: Omit<GeneratedPatternChallengeSpec, "sessionChallengeId"> = (() => {
    if (card.patternKind === "quantity") {
      if (card.difficultyLevel === "L4") {
        return {
          subGoalId: "pattern-recognition",
          difficultyLevel: "L4",
          patternKind: "quantity",
          prompt: "这次不是一直加同一个数。你能找到轮流出现的跳法吗？",
          options: ["22", "23", "24"],
          correctAnswer: "23",
          acceptedAnswerAliases: ["23", "二十三"],
          visualSpec: {
            layout: "row",
            promptItems: [numberItem(6), numberItem(9), numberItem(13), numberItem(16), numberItem(20)],
            answerItem: numberItem(23),
            altText: "数字按加3、加4轮流变化",
          },
          ruleModel: {
            family: "quantity_alternating_delta",
            summary: "加3、加4轮流",
            explanationFrame: "我发现它在___和___之间轮流，所以后面应该是___。",
            expectedEvidencePhrases: ["加3再加4", "轮流加", "两个跳法轮流"],
            contrastTarget: "24",
          },
          contrastTarget: "24",
          explanationFrame: "我发现它在___和___之间轮流，所以后面应该是___。",
        };
      }
      if (card.difficultyLevel === "L3") {
        return {
          subGoalId: "pattern-recognition",
          difficultyLevel: "L3",
          patternKind: "quantity",
          prompt: "这排数字里，重复和增加是一起发生的。空格里应该是什么？",
          options: ["11", "12", "13"],
          correctAnswer: "11",
          acceptedAnswerAliases: ["11", "十一"],
          visualSpec: {
            layout: "row",
            promptItems: [numberItem(5), numberItem(7), numberItem(7), numberItem(9), numberItem(9), numberItem(11)],
            answerItem: numberItem(11),
            altText: "每个数字先重复一次，再加2",
          },
          ruleModel: {
            family: "quantity_repeat_step",
            summary: "每个数字先重复一次，再加2",
            explanationFrame: "我发现它是___，所以这一步应该是___。",
            expectedEvidencePhrases: ["重复一次再加2", "先重复", "7出现两次"],
            contrastTarget: "13",
          },
          contrastTarget: "13",
          explanationFrame: "我发现它是___，所以这一步应该是___。",
        };
      }
      return {
        subGoalId: "pattern-recognition",
        difficultyLevel: card.difficultyLevel === "L2" ? "L2" : "L1",
        patternKind: "quantity",
        prompt: "看看这排数字，每次怎么变？空格里应该填什么？",
        options: card.difficultyLevel === "L2" ? ["14", "16", "18"] : ["10", "12", "15"],
        correctAnswer: card.difficultyLevel === "L2" ? "16" : "12",
        acceptedAnswerAliases: card.difficultyLevel === "L2" ? ["16", "十六"] : ["12", "十二"],
        visualSpec: {
          layout: "row",
          promptItems: card.difficultyLevel === "L2"
            ? [numberItem(4), numberItem(8), numberItem(12)]
            : [numberItem(3), numberItem(6), numberItem(9)],
          answerItem: card.difficultyLevel === "L2" ? numberItem(16) : numberItem(12),
          altText: card.difficultyLevel === "L2" ? "数字按每次加4变化" : "数字按每次加3变化",
        },
        ruleModel: {
          family: "quantity_step",
          summary: card.difficultyLevel === "L2" ? "每次加4" : "每次加3",
          explanationFrame: "我发现它每次都___，所以后面应该是___。",
          expectedEvidencePhrases: card.difficultyLevel === "L2" ? ["每次加4", "多4"] : ["每次加3", "多3"],
          contrastTarget: card.difficultyLevel === "L2" ? "14" : "10",
        },
        contrastTarget: card.difficultyLevel === "L2" ? "14" : "10",
        explanationFrame: "我发现它每次都___，所以后面应该是___。",
      };
    }

    if (card.patternKind === "space") {
      if (card.difficultyLevel === "L4") {
        return {
          subGoalId: "pattern-recognition",
          difficultyLevel: "L4",
          patternKind: "space",
          prompt: "方向按固定顺序转圈。空格里应该朝哪边？",
          options: ["向右", "向上", "向左"],
          correctAnswer: "向右",
          acceptedAnswerAliases: ["向右", "右", "朝右"],
          visualSpec: {
            layout: "row",
            promptItems: [shapeItem("向上箭头", "arrow", "blue", 270), shapeItem("向右箭头", "arrow", "blue", 0), shapeItem("向下箭头", "arrow", "blue", 90), shapeItem("向左箭头", "arrow", "blue", 180), shapeItem("向上箭头", "arrow", "blue", 270)],
            answerItem: shapeItem("向右箭头", "arrow", "blue", 0),
            altText: "箭头按上右下左固定循环",
          },
          ruleModel: {
            family: "space_rotation_cycle",
            summary: "上右下左固定循环",
            explanationFrame: "它是按___在循环，所以后面会是___。",
            expectedEvidencePhrases: ["上右下左", "转一圈", "轮到右边"],
            contrastTarget: "向上",
          },
          contrastTarget: "向上",
          explanationFrame: "它是按___在循环，所以后面会是___。",
        };
      }
      if (card.difficultyLevel === "L3") {
        return {
          subGoalId: "pattern-recognition",
          difficultyLevel: "L3",
          patternKind: "space",
          prompt: "箭头一直在转。它下一步会转到哪里？",
          options: ["向上", "向右", "向左"],
          correctAnswer: "向上",
          acceptedAnswerAliases: ["向上", "上", "朝上"],
          visualSpec: {
            layout: "row",
            promptItems: [shapeItem("向上箭头", "arrow", "blue", 270), shapeItem("向右箭头", "arrow", "blue", 0), shapeItem("向下箭头", "arrow", "blue", 90), shapeItem("向左箭头", "arrow", "blue", 180)],
            answerItem: shapeItem("向上箭头", "arrow", "blue", 270),
            altText: "箭头每次顺时针转90度",
          },
          ruleModel: {
            family: "space_rotation_step",
            summary: "每次顺时针转90度",
            explanationFrame: "它每次都在___，所以后面会是___。",
            expectedEvidencePhrases: ["每次转90度", "一直在转", "顺时针转"],
            contrastTarget: "向右",
          },
          contrastTarget: "向右",
          explanationFrame: "它每次都在___，所以后面会是___。",
        };
      }
      return {
        subGoalId: "pattern-recognition",
        difficultyLevel: card.difficultyLevel === "L2" ? "L2" : "L1",
        patternKind: "space",
        prompt: "看看箭头朝向怎么轮流。空格里应该朝哪边？",
        options: card.difficultyLevel === "L2" ? ["右上", "左下", "向右"] : ["向右", "向下", "向左"],
        correctAnswer: card.difficultyLevel === "L2" ? "右上" : "向右",
        acceptedAnswerAliases: card.difficultyLevel === "L2" ? ["右上", "右上角", "朝右上"] : ["向右", "右", "朝右"],
        visualSpec: {
          layout: "row",
          promptItems: card.difficultyLevel === "L2"
            ? [shapeItem("右上箭头", "arrow", "blue", 315), shapeItem("左下箭头", "arrow", "blue", 135), shapeItem("右上箭头", "arrow", "blue", 315), shapeItem("左下箭头", "arrow", "blue", 135)]
            : [shapeItem("向右箭头", "arrow", "blue", 0), shapeItem("向下箭头", "arrow", "blue", 90), shapeItem("向右箭头", "arrow", "blue", 0), shapeItem("向下箭头", "arrow", "blue", 90)],
          answerItem: card.difficultyLevel === "L2" ? shapeItem("右上箭头", "arrow", "blue", 315) : shapeItem("向右箭头", "arrow", "blue", 0),
          altText: card.difficultyLevel === "L2" ? "箭头在右上和左下之间轮流" : "箭头在向右和向下之间轮流",
        },
        ruleModel: {
          family: "space_direction_alternating",
          summary: card.difficultyLevel === "L2" ? "右上和左下轮流" : "向右和向下轮流",
          explanationFrame: "它是在___和___之间轮流，所以后面是___。",
          expectedEvidencePhrases: card.difficultyLevel === "L2" ? ["右上左下", "斜着轮流"] : ["右下右下", "轮流转"],
          contrastTarget: card.difficultyLevel === "L2" ? "左下" : "向下",
        },
        contrastTarget: card.difficultyLevel === "L2" ? "左下" : "向下",
        explanationFrame: "它是在___和___之间轮流，所以后面是___。",
      };
    }

    if (card.difficultyLevel === "L4") {
      return {
        subGoalId: "pattern-recognition",
        difficultyLevel: "L4",
        patternKind: "attribute",
        prompt: "这次是三个一组在循环。空格里应该是什么？",
        options: ["蓝色三角形", "红色方形", "黄色圆形"],
        correctAnswer: "蓝色三角形",
        acceptedAnswerAliases: ["蓝色三角形", "蓝三角", "蓝色三角"],
        visualSpec: {
          layout: "row",
          promptItems: [shapeItem("红色圆形", "circle", "red"), shapeItem("黄色方形", "square", "yellow"), shapeItem("蓝色三角形", "triangle", "blue"), shapeItem("红色圆形", "circle", "red"), shapeItem("黄色方形", "square", "yellow")],
          answerItem: shapeItem("蓝色三角形", "triangle", "blue"),
          altText: "红圆、黄方、蓝三角三项循环",
        },
        ruleModel: {
          family: "attribute_triplet_cycle",
          summary: "三个图形一组循环",
          explanationFrame: "它是___、___、___在循环，所以后面是___。",
          expectedEvidencePhrases: ["三个一组", "红圆黄方蓝三角", "轮到蓝三角"],
          contrastTarget: "红色方形",
        },
        contrastTarget: "红色方形",
        explanationFrame: "它是___、___、___在循环，所以后面是___。",
      };
    }

    if (card.difficultyLevel === "L3") {
      return {
        subGoalId: "pattern-recognition",
        difficultyLevel: "L3",
        patternKind: "attribute",
        prompt: "颜色和形状要一起看。空格里应该放什么图形？",
        options: ["黄色圆形", "红色方形", "黄色方形"],
        correctAnswer: "红色方形",
        acceptedAnswerAliases: ["红色方形", "红方", "红方块"],
        visualSpec: {
          layout: "row",
          promptItems: [shapeItem("红色圆形", "circle", "red"), shapeItem("红色方形", "square", "red"), shapeItem("黄色圆形", "circle", "yellow"), shapeItem("黄色方形", "square", "yellow"), shapeItem("红色圆形", "circle", "red")],
          answerItem: shapeItem("红色方形", "square", "red"),
          altText: "红色一组圆方，黄色一组圆方，再回到红色",
        },
        ruleModel: {
          family: "attribute_color_shape_cycle",
          summary: "颜色成块，块内是圆方顺序",
          explanationFrame: "我发现它是___在循环，所以这一步应该是___。",
          expectedEvidencePhrases: ["红圆红方黄圆黄方", "颜色和形状一起重复", "圆方顺序"],
          contrastTarget: "黄色圆形",
        },
        contrastTarget: "黄色圆形",
        explanationFrame: "我发现它是___在循环，所以这一步应该是___。",
      };
    }

    return {
      subGoalId: "pattern-recognition",
      difficultyLevel: card.difficultyLevel === "L2" ? "L2" : "L1",
      patternKind: "attribute",
      prompt: "看看图形怎么排队。空格里应该是什么？",
      options: card.difficultyLevel === "L2" ? ["大红圆", "中红圆", "小红圆"] : ["红色圆形", "红色方形", "红色三角形"],
      correctAnswer: card.difficultyLevel === "L2" ? "大红圆" : "红色圆形",
      acceptedAnswerAliases: card.difficultyLevel === "L2" ? ["大红圆", "大圆", "大的"] : ["红色圆形", "圆形", "圆"],
      visualSpec: {
        layout: "row",
        promptItems: card.difficultyLevel === "L2"
          ? [shapeItem("大红圆", "circle", "red", 0, "large"), shapeItem("小红圆", "circle", "red", 0, "small"), shapeItem("大红圆", "circle", "red", 0, "large"), shapeItem("小红圆", "circle", "red", 0, "small")]
          : [shapeItem("红色圆形", "circle", "red"), shapeItem("红色方形", "square", "red"), shapeItem("红色圆形", "circle", "red"), shapeItem("红色方形", "square", "red")],
        answerItem: card.difficultyLevel === "L2" ? shapeItem("大红圆", "circle", "red", 0, "large") : shapeItem("红色圆形", "circle", "red"),
        altText: card.difficultyLevel === "L2" ? "大圆和小圆交替排列" : "圆形和方形交替排列",
      },
      ruleModel: {
        family: "attribute_alternating",
        summary: card.difficultyLevel === "L2" ? "大小交替" : "圆方交替",
        explanationFrame: "前面一直是___在重复，所以后面是___。",
        expectedEvidencePhrases: card.difficultyLevel === "L2" ? ["大小重复", "大圆小圆"] : ["圆方重复", "圆的方的"],
        contrastTarget: card.difficultyLevel === "L2" ? "小红圆" : "红色方形",
      },
      contrastTarget: card.difficultyLevel === "L2" ? "小红圆" : "红色方形",
      explanationFrame: "前面一直是___在重复，所以后面是___。",
    };
  })();

  return {
    ...base,
    sessionChallengeId: `pc-fallback-${card.id}`,
    acceptedAnswerAliases: uniqueStrings(base.acceptedAnswerAliases),
  };
}

function augmentAcceptedAnswerAliases(input: {
  patternKind: PatternKind;
  correctAnswer: string;
  aliases: string[];
  answerItem: GeneratedPatternVisualItem;
}): string[] {
  const aliases = [...input.aliases, input.correctAnswer, input.answerItem.label];
  if (input.patternKind === "space") {
    if (/右/.test(input.correctAnswer)) aliases.push("右", "向右", "朝右");
    if (/左/.test(input.correctAnswer)) aliases.push("左", "向左", "朝左");
    if (/上/.test(input.correctAnswer)) aliases.push("上", "向上", "朝上");
    if (/下/.test(input.correctAnswer)) aliases.push("下", "向下", "朝下");
  }
  if (input.patternKind === "attribute") {
    const label = input.answerItem.label;
    if (/圆/.test(label)) aliases.push("圆", "圆形");
    if (/方/.test(label)) aliases.push("方", "方形", "方块");
    if (/三角/.test(label)) aliases.push("三角", "三角形");
    if (/红/.test(label)) aliases.push("红色");
    if (/黄/.test(label)) aliases.push("黄色");
    if (/蓝/.test(label)) aliases.push("蓝色");
  }
  return uniqueStrings(aliases);
}

function validateGeneratedSpec(
  candidate: unknown,
  constraints: GeneratorConstraints,
): GeneratedPatternChallengeSpec | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;

  const record = candidate as Record<string, unknown>;
  const difficultyLevel = record.difficultyLevel;
  const patternKind = record.patternKind;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const options = Array.isArray(record.options)
    ? uniqueStrings(record.options.filter((value): value is string => typeof value === "string"))
    : [];
  const correctAnswer = typeof record.correctAnswer === "string" ? record.correctAnswer.trim() : "";
  const aliases = Array.isArray(record.acceptedAnswerAliases)
    ? uniqueStrings(
        record.acceptedAnswerAliases.filter((value): value is string => typeof value === "string"),
      )
    : [];
  const visualSpecRecord =
    record.visualSpec && typeof record.visualSpec === "object"
      ? (record.visualSpec as Record<string, unknown>)
      : null;
  const promptItems = Array.isArray(visualSpecRecord?.promptItems)
    ? visualSpecRecord.promptItems
        .map((item) => sanitizeVisualItem(item as GeneratedPatternVisualItem))
        .filter((item): item is GeneratedPatternVisualItem => Boolean(item))
    : [];
  const answerItem = visualSpecRecord?.answerItem
    ? sanitizeVisualItem(visualSpecRecord.answerItem as GeneratedPatternVisualItem)
    : null;
  const ruleModelRecord =
    record.ruleModel && typeof record.ruleModel === "object"
      ? (record.ruleModel as Record<string, unknown>)
      : null;
  const family = typeof ruleModelRecord?.family === "string" ? ruleModelRecord.family.trim() : "";
  const summary = typeof ruleModelRecord?.summary === "string" ? ruleModelRecord.summary.trim() : "";
  const explanationFrame = typeof record.explanationFrame === "string"
    ? record.explanationFrame.trim()
    : typeof ruleModelRecord?.explanationFrame === "string"
      ? ruleModelRecord.explanationFrame.trim()
      : "";
  const contrastTarget = typeof record.contrastTarget === "string"
    ? record.contrastTarget.trim()
    : typeof ruleModelRecord?.contrastTarget === "string"
      ? ruleModelRecord.contrastTarget.trim()
      : "";
  const expectedEvidencePhrases = Array.isArray(ruleModelRecord?.expectedEvidencePhrases)
    ? uniqueStrings(
        ruleModelRecord.expectedEvidencePhrases.filter(
          (value): value is string => typeof value === "string",
        ),
      )
    : [];

  if (
    (difficultyLevel !== "L1" && difficultyLevel !== "L2" && difficultyLevel !== "L3" && difficultyLevel !== "L4") ||
    (patternKind !== "quantity" && patternKind !== "attribute" && patternKind !== "space") ||
    !prompt ||
    options.length !== 3 ||
    !correctAnswer ||
    !options.some((option) => normalizeText(option) === normalizeText(correctAnswer)) ||
    promptItems.length < 4 ||
    promptItems.length > 6 ||
    !answerItem ||
    !family ||
    !summary ||
    !explanationFrame ||
    !contrastTarget
  ) {
    return undefined;
  }

  const effectiveDifficulty = maxDifficulty(
    constraints.difficultyLevel,
    ageDifficultyFloor(constraints.birthday ? calcAge(constraints.birthday) : undefined),
  );
  const allowedFamilies = getAllowedPatternFamilies(effectiveDifficulty);
  if (!allowedFamilies.includes(family)) return undefined;

  return {
    sessionChallengeId: `pc-${constraints.activitySessionId}`,
    subGoalId: "pattern-recognition",
    difficultyLevel,
    patternKind,
    prompt,
    options,
    correctAnswer,
    acceptedAnswerAliases: augmentAcceptedAnswerAliases({
      patternKind,
      correctAnswer,
      aliases: uniqueStrings([correctAnswer, ...aliases]),
      answerItem,
    }),
    visualSpec: {
      layout: "row",
      promptItems,
      answerItem,
      questionTileLabel:
        typeof visualSpecRecord?.questionTileLabel === "string"
          ? visualSpecRecord.questionTileLabel
          : "?",
      altText:
        typeof visualSpecRecord?.altText === "string"
          ? visualSpecRecord.altText.trim()
          : undefined,
    },
    ruleModel: {
      family,
      summary,
      explanationFrame,
      expectedEvidencePhrases,
      contrastTarget,
    },
    contrastTarget,
    explanationFrame,
  };
}

async function requestGeneratedPatternChallengeSpec(
  constraints: GeneratorConstraints,
): Promise<GeneratedPatternChallengeSpec | undefined> {
  const provider = resolveOpenAIChatProvider();
  if (!provider) return undefined;

  const age = constraints.birthday ? calcAge(constraints.birthday) : undefined;
  const effectiveDifficulty = maxDifficulty(
    constraints.difficultyLevel,
    ageDifficultyFloor(age),
  );
  const allowedFamilies = getAllowedPatternFamilies(effectiveDifficulty);
  const preferredFamily = allowedFamilies[
    hashString(constraints.activitySessionId) % allowedFamilies.length
  ];

  const systemPrompt = [
    "You generate one closed-form structured pattern-recognition challenge for a child.",
    "The app owns pedagogy, difficulty, scoring, evaluation, and session flow.",
    "You only generate one challenge spec in JSON.",
    "Stay inside subGoalId=pattern-recognition.",
    "Keep the answer closed and evaluable.",
    "The answer must appear in options.",
    "Only use renderable visual items and the allowed family list.",
    "Return JSON only. No markdown.",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      activitySessionId: constraints.activitySessionId,
      subGoalId: "pattern-recognition",
      childAge: age ?? null,
      difficultyLevel: effectiveDifficulty,
      allowedFamilies,
      preferredFamily,
      allowedPatternKinds: [...new Set(allowedFamilies.map(inferPatternKindFromFamily))],
      schemaHints: {
        visualItemKinds: ["number", "shape", "symbol"],
        shapes: ["circle", "square", "triangle", "diamond", "arrow"],
        rotations: [0, 45, 90, 135, 180, 225, 270, 315],
      },
    },
    null,
    2,
  );

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return undefined;
  const payload = (await response.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | null } }> }
    | null;
  const content = payload?.choices?.[0]?.message?.content;
  const jsonText = typeof content === "string" ? extractJsonObject(content) : null;
  if (!jsonText) return undefined;

  try {
    return validateGeneratedSpec(JSON.parse(jsonText), constraints);
  } catch {
    return undefined;
  }
}

function selectFallbackCard(constraints: GeneratorConstraints): PatternChallengeCard | undefined {
  const effectiveDifficulty = maxDifficulty(
    constraints.difficultyLevel,
    ageDifficultyFloor(constraints.birthday ? calcAge(constraints.birthday) : undefined),
  );
  const scoped = PATTERN_RECOGNITION_CHALLENGE_BANK.filter(
    (card) => card.difficultyLevel === effectiveDifficulty,
  );
  const pool = scoped.length > 0 ? scoped : PATTERN_RECOGNITION_CHALLENGE_BANK;
  if (pool.length === 0) return undefined;
  return pool[hashString(`${constraints.activitySessionId}:${effectiveDifficulty}`) % pool.length];
}

export function readPatternRecognitionChallengeSpec(
  sessionRow?: ActivitySessionRow,
): GeneratedPatternChallengeSpec | undefined {
  if (!sessionRow?.challenge_spec_json) return undefined;
  try {
    return JSON.parse(sessionRow.challenge_spec_json) as GeneratedPatternChallengeSpec;
  } catch {
    return undefined;
  }
}

export async function ensurePatternRecognitionChallengeSpec(
  constraints: GeneratorConstraints,
): Promise<GeneratedChallengeResolution> {
  const existingRow = getActivitySession(constraints.activitySessionId);
  const existingSpec = readPatternRecognitionChallengeSpec(existingRow);
  if (existingSpec && existingRow?.challenge_source) {
    return {
      spec: existingSpec,
      source: existingRow.challenge_source,
      generationStatus: existingRow.challenge_generation_status ?? "ready",
      fallbackCardId: existingRow.challenge_id ?? undefined,
    };
  }

  updateActivitySessionRuntime(constraints.activitySessionId, {
    challengeGenerationStatus: "retrying",
  });

  for (let attempt = 0; attempt <= GENERATOR_RETRY_LIMIT; attempt += 1) {
    const spec = await requestGeneratedPatternChallengeSpec(constraints);
    if (spec) {
      updateActivitySessionRuntime(constraints.activitySessionId, {
        challengeId: spec.sessionChallengeId,
        challengeSpec: spec,
        challengeGenerationStatus: "ready",
        challengeSource: "ai_generated",
      });
      return { spec, source: "ai_generated", generationStatus: "ready" };
    }
  }

  const fallbackCard = selectFallbackCard(constraints) ?? PATTERN_RECOGNITION_CHALLENGE_BANK[0];
  const spec = buildGenericFallbackSpec(fallbackCard);
  spec.sessionChallengeId = `pc-fallback-${constraints.activitySessionId}`;
  updateActivitySessionRuntime(constraints.activitySessionId, {
    challengeId: fallbackCard?.id ?? spec.sessionChallengeId,
    challengeSpec: spec,
    challengeGenerationStatus: "fallback_ready",
    challengeSource: "authored_fallback",
  });
  return {
    spec,
    source: "authored_fallback",
    generationStatus: "fallback_ready",
    fallbackCardId: fallbackCard?.id,
  };
}

function describeVisualItem(item: GeneratedPatternVisualItem): string {
  return item.label;
}

function buildVisibleSequenceText(spec: GeneratedPatternChallengeSpec): string {
  return spec.visualSpec.promptItems.map(describeVisualItem).join("，");
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getItemSize(item: GeneratedPatternVisualItem): { width: number; height: number } {
  switch (item.size) {
    case "small":
      return { width: 56, height: 56 };
    case "large":
      return { width: 84, height: 84 };
    default:
      return { width: 68, height: 68 };
  }
}

function renderItemSvg(item: GeneratedPatternVisualItem, x: number, y: number): string {
  const { width, height } = getItemSize(item);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const fill = sanitizeColor(item.color);
  const transform = item.rotation ? ` transform="rotate(${item.rotation}, ${cx}, ${cy})"` : "";

  if (item.kind === "number") {
    return `<g><rect x="${x}" y="${y}" rx="18" ry="18" width="${width}" height="${height}" fill="#fff7ed" stroke="#f59e0b" stroke-width="3"/><text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="34" font-family="Arial, sans-serif" fill="#1f2937">${item.text ?? item.label}</text></g>`;
  }

  switch (item.shape) {
    case "circle":
      return `<circle cx="${cx}" cy="${cy}" r="${Math.min(width, height) / 2 - 6}" fill="${fill}" stroke="#7c2d12" stroke-width="3"${transform}/>`;
    case "triangle":
      return `<polygon points="${cx},${y + 6} ${x + width - 6},${y + height - 6} ${x + 6},${y + height - 6}" fill="${fill}" stroke="#7c2d12" stroke-width="3"${transform}/>`;
    case "diamond":
      return `<polygon points="${cx},${y + 4} ${x + width - 4},${cy} ${cx},${y + height - 4} ${x + 4},${cy}" fill="${fill}" stroke="#7c2d12" stroke-width="3"${transform}/>`;
    case "arrow":
      return `<path d="M ${x + 8} ${cy - 10} H ${x + width - 24} V ${y + 8} L ${x + width - 6} ${cy} L ${x + width - 24} ${y + height - 8} V ${cy + 10} H ${x + 8} Z" fill="${fill}" stroke="#1d4ed8" stroke-width="3"${transform}/>`;
    case "square":
    default:
      return `<rect x="${x + 4}" y="${y + 4}" rx="14" ry="14" width="${width - 8}" height="${height - 8}" fill="${fill}" stroke="#7c2d12" stroke-width="3"${transform}/>`;
  }
}

export function buildPatternRecognitionImagePayload(
  spec: GeneratedPatternChallengeSpec,
): { alt: string; imageUrl: string } {
  const tileWidth = 110;
  const startX = 36;
  const startY = 44;
  const questionX = startX + spec.visualSpec.promptItems.length * tileWidth;
  const width = questionX + 118;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="280" viewBox="0 0 ${width} 280">
      <rect width="${width}" height="280" rx="28" fill="#ffffff"/>
      ${spec.visualSpec.promptItems
        .map((item, index) => renderItemSvg(item, startX + index * tileWidth, startY))
        .join("")}
      <rect x="${questionX}" y="${startY}" rx="16" ry="16" width="78" height="78" fill="#8b5cf6" stroke="#78350f" stroke-width="4"/>
      <rect x="${questionX + 6}" y="${startY + 6}" rx="12" ry="12" width="66" height="66" fill="#a78bfa" stroke="#fbbf24" stroke-width="3"/>
      <text x="${questionX + 39}" y="${startY + 52}" text-anchor="middle" font-size="42" font-family="Arial, sans-serif" fill="#22d3ee">${spec.visualSpec.questionTileLabel ?? "?"}</text>
    </svg>
  `.trim();

  return {
    alt: spec.visualSpec.altText ?? `${buildVisibleSequenceText(spec)}，然后是一个空格问号`,
    imageUrl: toDataUri(svg),
  };
}

function findMatchedAlias(childInput: string, aliases: string[]): string | undefined {
  const normalized = normalizeText(childInput);
  return aliases
    .map((alias) => alias.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .find((alias) => normalized.includes(normalizeText(alias)));
}

export function evaluatePatternRecognitionAnswer(
  childInput: string,
  spec: GeneratedPatternChallengeSpec,
): AnswerEvaluation {
  const matched = findMatchedAlias(childInput, spec.acceptedAnswerAliases);
  const correctness =
    matched && normalizeText(matched) === normalizeText(spec.correctAnswer)
      ? "correct"
      : "incorrect";
  const normalized = normalizeText(childInput);
  const hasContrastiveCue = /(不是|不对|少了|多了|不一样|不能是)/.test(childInput);
  const hasRuleCue =
    spec.ruleModel.expectedEvidencePhrases
      .map(normalizeText)
      .some((phrase) => phrase && normalized.includes(phrase)) ||
    /(因为|每次|重复|轮流|循环|转|加|减)/.test(childInput);

  return {
    correctness,
    matchedAnswer: matched,
    hasReasoningSignal: hasContrastiveCue || hasRuleCue,
    reasoningKind: hasContrastiveCue ? "contrastive_rebuttal" : hasRuleCue ? "rule_statement" : undefined,
  };
}

function buildIntroPlaceholder(spec: GeneratedPatternChallengeSpec): string {
  return `例如：我觉得是 ${spec.correctAnswer}，因为……`;
}

function buildReasoningPlaceholder(spec: GeneratedPatternChallengeSpec): string {
  return `例如：${spec.explanationFrame}`;
}

export function buildPatternRecognitionStructuredToolCalls(input: {
  turnIndex: number;
  spec: GeneratedPatternChallengeSpec;
  childInput: string;
  assemblyState: PromptAssemblyState;
  activitySessionId?: string;
  sessionId?: string;
  scoringMode?: string;
}): ToolCall[] | undefined {
  if (input.assemblyState === "evidence_repair" || input.assemblyState === "force_abandon") {
    return undefined;
  }

  const image = buildPatternRecognitionImagePayload(input.spec);
  if (input.turnIndex === 0) {
    return [
      {
        id: `pattern-narrate-${input.turnIndex}-${Date.now()}`,
        name: "narrate",
        arguments: { text: input.spec.prompt, speakerName: "脑脑", voiceRole: "guide", autoSpeak: true },
      },
      {
        id: `pattern-image-${input.turnIndex}-${Date.now()}`,
        name: "show_image",
        arguments: image,
      },
      {
        id: `pattern-input-${input.turnIndex}-${Date.now()}`,
        name: "show_text_input",
        arguments: {
          prompt: "先告诉脑脑，空格里你觉得更像什么；如果愿意，也说说你从哪儿看出来。",
          placeholder: buildIntroPlaceholder(input.spec),
          submitLabel: "告诉脑脑",
        },
      },
    ];
  }

  const result = evaluatePatternRecognitionAnswer(input.childInput, input.spec);
  if (result.correctness === "correct" && result.hasReasoningSignal) {
    return [
      {
        id: `pattern-win-${input.turnIndex}-${Date.now()}`,
        name: "narrate",
        arguments: {
          text: `脑脑看到你抓住了“${input.spec.ruleModel.summary}”。这里也正好是${input.spec.correctAnswer}，我们先把这段小发现收好。`,
          speakerName: "脑脑",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
      {
        id: `pattern-end-${input.turnIndex}-${Date.now()}`,
        name: "end_activity",
        arguments: {
          summary: `今天她看到了“${input.spec.ruleModel.summary}”这条小规律，也愿意把自己怎么看出来的说清楚一点。`,
          completionRate: 1,
          activity_session_id: input.activitySessionId,
          session_id: input.sessionId,
          turn_index: input.turnIndex,
          scoring_mode: input.scoringMode ?? "formal_scored",
        },
      },
    ];
  }

  if (result.correctness === "correct") {
    return [
      {
        id: `pattern-correct-${input.turnIndex}-${Date.now()}`,
        name: "narrate",
        arguments: {
          text: `脑脑看到你选了${input.spec.correctAnswer}。再帮脑脑看一眼：你是从哪里发现这个规律的？`,
          speakerName: "脑脑",
          voiceRole: "guide",
          autoSpeak: true,
        },
      },
      {
        id: `pattern-explain-${input.turnIndex}-${Date.now()}`,
        name: "show_text_input",
        arguments: {
          prompt: "把你发现的小规律告诉脑脑，不用很长，短短一句也可以。",
          placeholder: buildReasoningPlaceholder(input.spec),
          submitLabel: "告诉脑脑",
        },
      },
    ];
  }

  return [
    {
      id: `pattern-retry-${input.turnIndex}-${Date.now()}`,
      name: "narrate",
      arguments: {
        text: `脑脑觉得这里还可以再看一眼。我们先回到这排图形：${buildVisibleSequenceText(input.spec)}。也想想为什么不像${input.spec.contrastTarget}。`,
        speakerName: "脑脑",
        voiceRole: "guide",
        autoSpeak: true,
      },
    },
    {
      id: `pattern-image-retry-${input.turnIndex}-${Date.now()}`,
      name: "show_image",
      arguments: image,
    },
    {
      id: `pattern-retry-input-${input.turnIndex}-${Date.now()}`,
      name: "show_text_input",
      arguments: {
        prompt: "再看一眼：空格里更像什么？如果愿意，也可以顺便说说你看到的小规律。",
        placeholder: buildIntroPlaceholder(input.spec),
        submitLabel: "再看一眼",
      },
    },
  ];
}

export function buildPatternRecognitionActivityRuntime(input: {
  activitySessionId?: string;
  difficultyLevel?: DifficultyLevelName;
  birthday?: string;
  assemblyState: PromptAssemblyState;
  repairStrategy?: RepairStrategy;
  handoffTemplate?: string;
  challengeSpec?: GeneratedPatternChallengeSpec;
}): { activityText: string; challengeSpec?: GeneratedPatternChallengeSpec } {
  const sessionRow = input.activitySessionId ? getActivitySession(input.activitySessionId) : undefined;
  const spec = input.challengeSpec ?? readPatternRecognitionChallengeSpec(sessionRow);
  const playbook = getSubGoalPlaybook("pattern-recognition");

  if (!spec) {
    return {
      activityText: [
        "当前子目标：pattern-recognition。",
        `难度：${input.difficultyLevel ?? "L1"}`,
        "本轮还没有固定好的观察材料。",
        "只能先做开场，不要自己编造另一组材料。",
      ].join("\n"),
    };
  }

  const assemblyRule =
    input.assemblyState === "evidence_repair"
      ? `当前是补说想法的一轮，只能围绕这组材料继续追问。repairStrategy=${input.repairStrategy ?? "none"}`
      : input.assemblyState === "hint_repair"
        ? "当前是轻支架轮，只能围绕这组材料给方向，不得换材料。"
        : "当前观察材料已固定，同一次小片段内不得改材料。";

  return {
    activityText: [
      "当前结构化观察材料已固定为 session 唯一事实源。",
      `材料类型：${spec.patternKind}`,
      `难度：${spec.difficultyLevel}`,
      `可见序列：${buildVisibleSequenceText(spec)}`,
      `正确答案：${spec.correctAnswer}`,
      `可接受别名：${spec.acceptedAnswerAliases.join(" / ")}`,
      `规则摘要：${spec.ruleModel.summary}`,
      `解释句架：${spec.explanationFrame}`,
      `对比错项：${spec.contrastTarget}`,
      `允许的短规则证据：${spec.ruleModel.expectedEvidencePhrases.join(" / ")}`,
      assemblyRule,
      input.handoffTemplate && input.assemblyState === "evidence_repair"
        ? `承接语：${input.handoffTemplate}`
        : "如果需要追问，也必须承接刚才这组材料。",
      `Playbook 约束：${playbook.trainingIntent}`,
    ].join("\n"),
    challengeSpec: spec,
  };
}
