import { DAILY_QUESTION_BANK } from "@/content/daily/daily-question-bank";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import { assessMathConversation, getMathQuestionStage, getMathStageLevel, selectAdaptiveMathQuestion } from "@/lib/daily/math-adaptation";
import type { ConversationMessage } from "@/types/agent";
import type { MathDifficultySignal, MathSupportLevel } from "@/types";
import type { DailyQuestion, DailyThemeId } from "@/types/daily";
import type { SessionLogItem } from "@/lib/data/session-log";

const THEME_PREFIX: Record<DailyThemeId, string> = {
  math: "math-",
  pattern: "pattern-",
  why: "why-",
  fairness: "fairness-",
  "what-if": "whatif-",
};

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getThemeQuestionLevel(question: DailyQuestion): number {
  if (question.themeId === "math") {
    return getMathStageLevel(getMathQuestionStage(question));
  }
  return question.adaptationLevel ?? 1;
}

function listThemeQuestions(themeId: DailyThemeId) {
  return DAILY_QUESTION_BANK.filter((question) => question.themeId === themeId);
}

function listRecentThemeSessionLogs(logs: SessionLogItem[], themeId: DailyThemeId) {
  const prefix = THEME_PREFIX[themeId];
  return logs.filter((log) =>
    log.mathEvidence?.themeId === themeId || log.taskId.startsWith(prefix),
  );
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
  };
}

export function inferThemeLevelFromRecentLogs(themeId: DailyThemeId, logs: SessionLogItem[]) {
  if (themeId === "math") {
    const latestMath = listRecentThemeSessionLogs(logs, themeId);
    return latestMath[0]?.mathEvidence?.adaptationLevel ?? 1;
  }

  const themeLogs = listRecentThemeSessionLogs(logs, themeId).slice(0, 5);
  const latestLevel = themeLogs[0]?.mathEvidence?.adaptationLevel ?? 1;
  const recentSignals = themeLogs
    .map((log) => log.mathEvidence?.difficultySignal)
    .filter((signal): signal is MathDifficultySignal => Boolean(signal))
    .slice(0, 3);

  const tooEasyCount = recentSignals.filter((signal) => signal === "too_easy").length;
  const tooHardCount = recentSignals.filter((signal) => signal === "too_hard").length;

  if (tooEasyCount >= 2) {
    return latestLevel + 1;
  }
  if (tooHardCount >= 2) {
    return Math.max(1, latestLevel - 1);
  }
  return themeLogs[0]?.mathEvidence?.nextSuggestedLevel ?? latestLevel;
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

  if (requested && getThemeQuestionLevel(requested) === targetLevel) {
    return requested;
  }

  const levelPool = listThemeQuestions(input.themeId).filter((question) => getThemeQuestionLevel(question) === targetLevel);
  const pool = levelPool.length > 0 ? levelPool : listThemeQuestions(input.themeId);
  const seed = typeof input.rotationSeed === "number"
    ? input.rotationSeed
    : hashSeed(String(input.rotationSeed ?? new Date().toISOString().slice(0, 10)));

  return pool[Math.abs(seed) % pool.length];
}
