import { getThinkingGrowthPath } from "@/content/daily/thinking-growth-paths";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import type { ConversationMessage, ToolCall } from "@/types/agent";
import type { MathSupportLevel } from "@/types";
import type {
  DailyQuestion,
  ThinkingEvidence,
  ThinkingMove,
  ThinkingSupportLevel,
} from "@/types/daily";

const INTERACTIVE_TOOL_NAMES = new Set([
  "show_choices",
  "show_text_input",
  "request_voice",
  "show_number_input",
]);

const REASON_WORDS = /(因为|所以|原因|我觉得|我发现|看出来|说明|这样想)/;
const CHANGE_WORDS = /(如果|要是|换成|换一个|变成|变了|改|下次|明天|还会|还能|不一样|条件)/;
const COMPARE_WORDS = /(比|一样|不同|哪里|哪个|哪种|更|还是|相比|另一)/;
const SUMMARY_WORDS = /(规则|办法|方法|总结|教给|可以这样|我会先|我想先|改成|保留|修正)/;
const NOTICE_WORDS = /(看到|看见|发现|有|没有|几个|多少|先|第一)/;

function clampConfidence(value: number) {
  return Math.max(0.2, Math.min(0.95, Math.round(value * 100) / 100));
}

function getPromptFromTool(call: ToolCall | undefined) {
  if (!call) return undefined;
  const prompt = call.arguments?.prompt;
  if (typeof prompt === "string" && prompt.trim()) return prompt.trim();

  const text = call.arguments?.text;
  if (typeof text === "string" && text.trim()) return text.trim();

  return undefined;
}

function getPreviousAssistantToolCalls(conversation: ConversationMessage[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const message = conversation[cursor];
    if (message.role === "assistant") return message.toolCalls ?? [];
  }
  return [];
}

function extractAiPrompt(toolCalls: ToolCall[]) {
  const interactive = [...toolCalls]
    .reverse()
    .find((call) => INTERACTIVE_TOOL_NAMES.has(call.name));
  const narrate = [...toolCalls].reverse().find((call) => call.name === "narrate");

  return getPromptFromTool(interactive) ?? getPromptFromTool(narrate);
}

function extractChoiceLabels(toolCalls: ToolCall[]) {
  return toolCalls
    .filter((call) => call.name === "show_choices")
    .flatMap((call) => {
      const choices = call.arguments?.choices;
      return Array.isArray(choices)
        ? choices
            .map((choice) =>
              typeof choice === "object" &&
              choice !== null &&
              "label" in choice &&
              typeof choice.label === "string"
                ? choice.label.trim()
                : "",
            )
            .filter(Boolean)
        : [];
    });
}

function normalizeSupportLevel(
  supportLevel: MathSupportLevel | undefined,
  childInitiated: boolean,
  choiceOnly: boolean,
  hadChoices: boolean,
): ThinkingSupportLevel {
  if (choiceOnly) return "heavy";
  if (hadChoices) return supportLevel === "heavy" ? "heavy" : "medium";
  if (supportLevel === "heavy" || supportLevel === "medium") return supportLevel;
  return childInitiated ? "none" : "light";
}

function isChoiceOnlyAnswer(text: string, choiceLabels: string[]) {
  const normalized = text.replace(/\s+/g, "");
  if (!normalized) return false;
  const matchedChoice = choiceLabels.some((label) =>
    normalized === label.replace(/\s+/g, "") || normalized.includes(label.replace(/\s+/g, "")),
  );
  return matchedChoice && text.length <= 12 && !REASON_WORDS.test(text) && !CHANGE_WORDS.test(text);
}

function isChildInitiated(text: string, choiceOnly: boolean) {
  if (choiceOnly) return false;
  if (REASON_WORDS.test(text) || CHANGE_WORDS.test(text) || SUMMARY_WORDS.test(text)) return true;
  return text.trim().length >= 10;
}

function preferMove(candidates: ThinkingMove[], targetMoves: ThinkingMove[]) {
  return candidates.find((move) => targetMoves.includes(move)) ?? candidates[0] ?? targetMoves[0] ?? "notice";
}

function inferThinkingMove(question: DailyQuestion, childText: string): ThinkingMove {
  const targetMoves = getThinkingGrowthPath(question.themeId)?.targetThinkingMoves ?? ["notice"];
  const joinedText = `${question.title} ${question.mainQuestion} ${question.coachFocus} ${childText}`;

  if (SUMMARY_WORDS.test(childText)) {
    return preferMove(["reflect", "transfer", "explain"], targetMoves);
  }
  if (CHANGE_WORDS.test(childText) || CHANGE_WORDS.test(joinedText)) {
    return preferMove(["transfer", "predict", "reflect"], targetMoves);
  }
  if (COMPARE_WORDS.test(childText) || COMPARE_WORDS.test(joinedText)) {
    return preferMove(["compare", "represent", "explain"], targetMoves);
  }
  if (REASON_WORDS.test(childText) || REASON_WORDS.test(joinedText)) {
    return preferMove(["explain", "compare"], targetMoves);
  }
  if (question.themeId === "what-if") return preferMove(["predict"], targetMoves);
  if (question.themeId === "why") return preferMove(["explain"], targetMoves);
  if (question.themeId === "fairness") return preferMove(["compare"], targetMoves);
  if (question.themeId === "pattern") return preferMove(["notice", "represent"], targetMoves);
  if (NOTICE_WORDS.test(childText)) return preferMove(["notice", "represent"], targetMoves);
  return preferMove(["represent", "notice"], targetMoves);
}

function inferEvidenceLevel(input: {
  childText: string;
  childInitiated: boolean;
  choiceOnly: boolean;
}): ThinkingEvidence["level"] {
  if (input.choiceOnly) return 1;
  if (input.childInitiated && SUMMARY_WORDS.test(input.childText) && (REASON_WORDS.test(input.childText) || CHANGE_WORDS.test(input.childText))) {
    return 4;
  }
  if (CHANGE_WORDS.test(input.childText) || COMPARE_WORDS.test(input.childText)) {
    return 3;
  }
  if (REASON_WORDS.test(input.childText) || input.childText.trim().length >= 12) {
    return 2;
  }
  return 1;
}

function inferConfidence(input: {
  level: ThinkingEvidence["level"];
  childInitiated: boolean;
  supportLevel: ThinkingSupportLevel;
  choiceOnly: boolean;
}) {
  let confidence = 0.28 + input.level * 0.12;
  if (input.childInitiated) confidence += 0.12;
  if (input.supportLevel === "none") confidence += 0.12;
  if (input.supportLevel === "light") confidence += 0.06;
  if (input.supportLevel === "medium") confidence -= 0.04;
  if (input.supportLevel === "heavy") confidence -= 0.12;
  if (input.choiceOnly) confidence -= 0.16;
  if (input.level === 4 && !input.childInitiated) confidence = Math.min(confidence, 0.55);
  return clampConfidence(confidence);
}

export function buildThinkingEvidenceFromConversation(input: {
  question: DailyQuestion;
  conversation: ConversationMessage[];
  supportLevel?: MathSupportLevel;
}): ThinkingEvidence[] {
  const evidence = input.conversation
    .map<ThinkingEvidence | null>((message, index) => {
      if (message.role !== "user") return null;

      const childText = message.content?.trim() ?? "";
      if (!childText || childText.startsWith("系统启动")) return null;

      const previousToolCalls = getPreviousAssistantToolCalls(input.conversation, index);
      const choiceLabels = extractChoiceLabels(previousToolCalls);
      const choiceOnly = isChoiceOnlyAnswer(childText, choiceLabels);
      const childSignal = classifyDailyChildSignal(input.question, childText, index);
      const childInitiated =
        isChildInitiated(childText, choiceOnly) &&
        childSignal.type !== "uncertain" &&
        childSignal.type !== "off_topic" &&
        childSignal.type !== "resistant";
      const supportLevel = normalizeSupportLevel(
        input.supportLevel,
        childInitiated,
        choiceOnly,
        choiceLabels.length > 0,
      );
      const level = inferEvidenceLevel({ childText, childInitiated, choiceOnly });

      return {
        themeId: input.question.themeId,
        scenarioId: input.question.id,
        scenarioTitle: input.question.title,
        thinkingMove: inferThinkingMove(input.question, childText),
        level,
        childInitiated,
        supportLevel,
        confidence: inferConfidence({ level, childInitiated, supportLevel, choiceOnly }),
        childUtterance: childText,
        aiPrompt: extractAiPrompt(previousToolCalls),
      };
    });

  return evidence
    .filter((item): item is ThinkingEvidence => item !== null)
    .slice(-8);
}
