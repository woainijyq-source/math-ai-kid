import { DAILY_QUESTION_BANK } from "@/content/daily/daily-question-bank";
import {
  buildScenarioQuestionVariant,
  getScenarioTemplateForQuestion,
} from "@/content/daily/scenario-templates";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import { assessMathConversation, getMathQuestionStage, getMathStageLevel, selectAdaptiveMathQuestion } from "@/lib/daily/math-adaptation";
import { inferProjectTargetLevel, pickLeastRepeatedQuestion } from "@/lib/daily/thinking-growth-progress";
import { buildThinkingEvidenceFromConversation } from "@/lib/daily/thinking-evidence";
import type { ConversationMessage } from "@/types/agent";
import type { MathDifficultySignal, MathSupportLevel } from "@/types";
import type { DailyQuestion, DailyThemeId } from "@/types/daily";
import type { SessionLogItem } from "@/lib/data/session-log";

export function getThemeQuestionLevel(question: DailyQuestion): number {
  if (question.themeId === "math") {
    return getMathStageLevel(getMathQuestionStage(question));
  }
  return getScenarioTemplateForQuestion(question)?.levelRange[0] ?? question.adaptationLevel ?? 1;
}

function questionSupportsThemeLevel(question: DailyQuestion, targetLevel: number) {
  const template = getScenarioTemplateForQuestion(question);
  if (template) {
    return targetLevel >= template.levelRange[0] && targetLevel <= template.levelRange[1];
  }
  return getThemeQuestionLevel(question) === targetLevel;
}

function listThemeQuestions(themeId: DailyThemeId) {
  return DAILY_QUESTION_BANK.filter((question) => question.themeId === themeId);
}

function inferThemeSupportLevel(question: DailyQuestion, conversation: ConversationMessage[]): MathSupportLevel {
  const childSignals = conversation
    .filter((message) => message.role === "user")
    .map((message) => classifyDailyChildSignal(question, message.content?.trim() ?? "", 1))
    .filter(Boolean);
  const uncertainCount = childSignals.filter((signal) => signal.type === "uncertain").length;
  const hardCount = childSignals.filter((signal) => signal.type === "off_topic" || signal.type === "resistant").length;
  const choiceCount = conversation.flatMap((message) => message.toolCalls ?? []).filter((toolCall) => toolCall.name === "show_choices").length;

  if (uncertainCount >= 2 || hardCount >= 1 || choiceCount >= 2) {
    return "heavy";
  }
  if (uncertainCount >= 1 || choiceCount >= 1) {
    return "medium";
  }
  return "light";
}

function inferThemeDifficultySignal(question: DailyQuestion, conversation: ConversationMessage[]): MathDifficultySignal {
  const childSignals = conversation
    .filter((message) => message.role === "user")
    .map((message) => classifyDailyChildSignal(question, message.content?.trim() ?? "", 1));
  const supportLevel = inferThemeSupportLevel(question, conversation);
  const reasoningShown = childSignals.some((signal) => signal.type === "reasoned_answer" || signal.type === "imaginative_answer");
  const lastTwo = childSignals.slice(-2);

  if (supportLevel === "heavy" || lastTwo.filter((signal) => signal.type === "uncertain" || signal.type === "off_topic" || signal.type === "resistant").length >= 2) {
    return "too_hard";
  }

  if (
    supportLevel === "light" &&
    reasoningShown &&
    lastTwo.length > 0 &&
    lastTwo.every((signal) => signal.type === "reasoned_answer" || signal.type === "imaginative_answer" || signal.type === "brief_answer")
  ) {
    return "too_easy";
  }

  return "fit";
}

export function assessAdaptiveConversation(question: DailyQuestion, conversation: ConversationMessage[]) {
  if (question.themeId === "math") {
    return assessMathConversation({ question, conversation });
  }

  const supportLevel = inferThemeSupportLevel(question, conversation);
  const difficultySignal = inferThemeDifficultySignal(question, conversation);
  const currentLevel = getThemeQuestionLevel(question);
  const nextSuggestedLevel = difficultySignal === "too_easy"
    ? currentLevel + 1
    : difficultySignal === "too_hard"
      ? Math.max(1, currentLevel - 1)
      : currentLevel;
  const childSignals = conversation
    .filter((message) => message.role === "user")
    .map((message) => classifyDailyChildSignal(question, message.content?.trim() ?? "", 1));

  return {
    themeId: question.themeId,
    publicTitle: question.title,
    skillFocus: [question.title, question.subGoalId],
    observedMoves: childSignals.map((signal) => signal.suggestedMove).filter((value, index, list) => list.indexOf(value) === index),
    aiFocus: [
      `当前层级：L${currentLevel}`,
      `难度判断：${difficultySignal}`,
      `支架水平：${supportLevel}`,
    ],
    goalId: question.goalId,
    subGoalId: question.subGoalId,
    reasoningShown: childSignals.some((signal) => signal.type === "reasoned_answer" || signal.type === "imaginative_answer"),
    transferAttempted: conversation.filter((message) => message.role === "user").length >= 3,
    supportLevel,
    difficultySignal,
    adaptationLevel: currentLevel,
    nextSuggestedLevel,
    thinkingEvidence: buildThinkingEvidenceFromConversation({
      question,
      conversation,
      supportLevel,
    }),
  };
}

export function inferThemeLevelFromRecentLogs(themeId: DailyThemeId, logs: SessionLogItem[]) {
  return inferProjectTargetLevel(themeId, logs);
}

export function selectAdaptiveQuestion(input: {
  themeId: DailyThemeId;
  questionId?: string;
  recentLogs: SessionLogItem[];
  rotationSeed?: number | string;
}) {
  if (input.themeId === "math") {
    return selectAdaptiveMathQuestion({
      questionId: input.questionId,
      recentLogs: input.recentLogs,
      rotationSeed: input.rotationSeed,
    });
  }

  const requested = input.questionId
    ? DAILY_QUESTION_BANK.find((question) => question.id === input.questionId)
    : undefined;
  const targetLevel = inferThemeLevelFromRecentLogs(input.themeId, input.recentLogs);

  if (requested && questionSupportsThemeLevel(requested, targetLevel)) {
    return buildScenarioQuestionVariant(requested, input.rotationSeed);
  }

  const themeQuestions = listThemeQuestions(input.themeId);
  const levelPool = themeQuestions.filter((question) => questionSupportsThemeLevel(question, targetLevel));
  if (levelPool.length === 0 && themeQuestions.some((question) => getThemeQuestionLevel(question) < targetLevel)) {
    return undefined;
  }

  const pool = levelPool.length > 0 ? levelPool : themeQuestions;
  const selected = pickLeastRepeatedQuestion({
    questions: pool,
    themeId: input.themeId,
    recentLogs: input.recentLogs,
    rotationSeed: input.rotationSeed,
  });
  return selected
    ? buildScenarioQuestionVariant(selected, input.rotationSeed)
    : undefined;
}
