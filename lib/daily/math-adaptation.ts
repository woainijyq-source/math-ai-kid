import { DAILY_QUESTION_BANK } from "@/content/daily/daily-question-bank";
import { buildScenarioQuestionVariant } from "@/content/daily/scenario-templates";
import { mathProgressionOrder } from "@/content/math-progression";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import { getMathStageGoalMapping } from "@/lib/daily/theme-goal-mapping";
import { pickLeastRepeatedQuestion } from "@/lib/daily/thinking-growth-progress";
import { buildThinkingEvidenceFromConversation } from "@/lib/daily/thinking-evidence";
import type { ConversationMessage } from "@/types/agent";
import type {
  MathDifficultySignal,
  MathEvidence,
  MathSupportLevel,
  ProgressionStageId,
} from "@/types";
import type { DailyCoachMove, DailyQuestion } from "@/types/daily";
import type { SessionLogItem } from "@/lib/data/session-log";

const DEFAULT_MATH_STAGE: ProgressionStageId = "foundation-observe";

export function getMathStageLevel(stage: ProgressionStageId): number {
  return Math.max(1, mathProgressionOrder.indexOf(stage) + 1);
}

export interface MathLiveTurnAdaptation {
  liveSignal: MathDifficultySignal;
  recommendedMove: DailyCoachMove;
  shouldOfferChoices: boolean;
  shouldAddHalfStepTwist: boolean;
  shouldShrinkScope: boolean;
  summary: string;
  promptRule: string;
}

function isMathQuestion(question: DailyQuestion | undefined) {
  return question?.themeId === "math" && question.goalId === "math-thinking";
}

export function getMathQuestionStage(question: DailyQuestion | undefined): ProgressionStageId {
  if (!question || !isMathQuestion(question)) {
    return DEFAULT_MATH_STAGE;
  }

  if (question.progressionStageId) {
    return question.progressionStageId;
  }

  switch (question.subGoalId) {
    case "pattern-recognition":
      return "strategy-pattern";
    case "strategy-planning":
      return "rules-expression";
    case "spatial-reasoning":
      return "foundation-observe";
    case "quantity-comparison":
    default:
      return "foundation-observe";
  }
}

function getAvailableMathStages() {
  return [...new Set(
    DAILY_QUESTION_BANK
      .filter((question) => isMathQuestion(question))
      .map((question) => getMathQuestionStage(question)),
  )] as ProgressionStageId[];
}

function clampStageToAvailable(targetStage: ProgressionStageId): ProgressionStageId {
  const availableStages = getAvailableMathStages();
  if (availableStages.includes(targetStage)) {
    return targetStage;
  }

  const targetIndex = mathProgressionOrder.indexOf(targetStage);
  for (let index = targetIndex; index >= 0; index -= 1) {
    const stage = mathProgressionOrder[index];
    if (availableStages.includes(stage)) {
      return stage;
    }
  }

  return DEFAULT_MATH_STAGE;
}

function advanceStage(currentStage: ProgressionStageId): ProgressionStageId {
  const currentIndex = mathProgressionOrder.indexOf(currentStage);
  const nextStage = mathProgressionOrder[Math.min(currentIndex + 1, mathProgressionOrder.length - 1)] ?? currentStage;
  return clampStageToAvailable(nextStage);
}

function retreatStage(currentStage: ProgressionStageId): ProgressionStageId {
  const currentIndex = mathProgressionOrder.indexOf(currentStage);
  const previousStage = mathProgressionOrder[Math.max(currentIndex - 1, 0)] ?? currentStage;
  return clampStageToAvailable(previousStage);
}

function extractChildMessages(conversation: ConversationMessage[]) {
  return conversation
    .filter((message) => message.role === "user")
    .map((message) => message.content?.trim() ?? "")
    .filter(Boolean);
}

function extractAssistantToolCalls(conversation: ConversationMessage[]) {
  return conversation.flatMap((message) => message.toolCalls ?? []);
}

function inferSupportLevel(input: {
  question: DailyQuestion;
  conversation: ConversationMessage[];
  childSignals: Array<ReturnType<typeof classifyDailyChildSignal>>;
}): MathSupportLevel {
  const uncertainCount = input.childSignals.filter((signal) => signal.type === "uncertain").length;
  const heavySignalCount = input.childSignals.filter((signal) => signal.type === "resistant" || signal.type === "off_topic").length;
  const scaffoldChoices = extractAssistantToolCalls(input.conversation)
    .filter((toolCall) => toolCall.name === "show_choices").length;

  if (uncertainCount >= 2 || heavySignalCount >= 1 || scaffoldChoices >= 2) {
    return "heavy";
  }

  if (uncertainCount >= 1 || (input.question.suggestedInput !== "choice" && scaffoldChoices >= 1)) {
    return "medium";
  }

  return "light";
}

function inferDifficultySignal(input: {
  reasoningShown: boolean;
  transferAttempted: boolean;
  supportLevel: MathSupportLevel;
  childSignals: Array<ReturnType<typeof classifyDailyChildSignal>>;
}): MathDifficultySignal {
  const lastTwo = input.childSignals.slice(-2);
  const hardish = lastTwo.filter((signal) =>
    signal.type === "uncertain" || signal.type === "off_topic" || signal.type === "resistant",
  ).length;

  if (input.supportLevel === "heavy" || hardish >= 2) {
    return "too_hard";
  }

  if (
    input.supportLevel === "light" &&
    input.reasoningShown &&
    input.transferAttempted &&
    lastTwo.every((signal) => signal.type === "reasoned_answer" || signal.type === "imaginative_answer" || signal.type === "brief_answer")
  ) {
    return "too_easy";
  }

  return "fit";
}

export function assessMathConversation(params: {
  question: DailyQuestion;
  conversation: ConversationMessage[];
}): MathEvidence {
  const childMessages = extractChildMessages(params.conversation);
  const childSignals = childMessages.map((line, index) =>
    classifyDailyChildSignal(params.question, line, index + 1),
  );
  const reasoningShown = childSignals.some((signal) =>
    signal.type === "reasoned_answer" || signal.type === "imaginative_answer",
  );
  const transferAttempted = childMessages.length >= 3;
  const supportLevel = inferSupportLevel({
    question: params.question,
    conversation: params.conversation,
    childSignals,
  });
  const difficultySignal = inferDifficultySignal({
    reasoningShown,
    transferAttempted,
    supportLevel,
    childSignals,
  });
  const progressionStageId = getMathQuestionStage(params.question);
  const nextSuggestedStageId = difficultySignal === "too_easy"
    ? advanceStage(progressionStageId)
    : difficultySignal === "too_hard"
      ? retreatStage(progressionStageId)
      : progressionStageId;

  return {
    themeId: params.question.themeId,
    publicTitle: params.question.title,
    skillFocus: [params.question.title, params.question.subGoalId],
    observedMoves: childSignals.map((signal) => signal.suggestedMove).filter((value, index, list) => list.indexOf(value) === index),
    aiFocus: [
      `当前阶段：${progressionStageId}`,
      `难度判断：${difficultySignal}`,
      `支架水平：${supportLevel}`,
    ],
    progressionStageId,
    goalId: params.question.goalId,
    subGoalId: params.question.subGoalId,
    reasoningShown,
    transferAttempted,
    supportLevel,
    difficultySignal,
    adaptationLevel: getMathStageLevel(progressionStageId),
    nextSuggestedLevel: getMathStageLevel(nextSuggestedStageId),
    nextSuggestedStageId,
    thinkingEvidence: buildThinkingEvidenceFromConversation({
      question: params.question,
      conversation: params.conversation,
      supportLevel,
    }),
  };
}

export function inferLiveMathTurnAdaptation(params: {
  question: DailyQuestion;
  childInput?: string;
  turnIndex: number;
}): MathLiveTurnAdaptation | undefined {
  if (!isMathQuestion(params.question) || !params.childInput?.trim()) {
    return undefined;
  }

  const signal = classifyDailyChildSignal(params.question, params.childInput, params.turnIndex);
  const stage = getMathQuestionStage(params.question);

  if (signal.type === "uncertain" || signal.type === "resistant" || signal.type === "off_topic") {
    return {
      liveSignal: "too_hard",
      recommendedMove: signal.type === "off_topic" || signal.type === "resistant"
        ? "gentle_rehook"
        : "scaffold_with_choices",
      shouldOfferChoices: true,
      shouldAddHalfStepTwist: false,
      shouldShrinkScope: true,
      summary: "这一步对孩子来说偏吃力，先缩小范围、减少变量，让她重新进入。",
      promptRule: "先把问题缩小一点：对象更少、条件更少、问题更短。优先给 3 个方向；只有极低压力接话才给两个方向，不要继续加难。",
    };
  }

  if (signal.type === "reasoned_answer" || signal.type === "imaginative_answer") {
    const easierStage = stage === "foundation-observe" || stage === "strategy-pattern";
    if (easierStage || params.turnIndex >= 2) {
      return {
        liveSignal: "too_easy",
        recommendedMove: "push_half_step",
        shouldOfferChoices: false,
        shouldAddHalfStepTwist: true,
        shouldShrinkScope: false,
        summary: "孩子这一轮显得比较轻松，可以立刻把问题往前拧半步。",
        promptRule: "减少支架，不要停留在原来的简单层级。直接换一个条件、比较一个更细的差别，或推进一步迁移。",
      };
    }
  }

  return {
    liveSignal: "fit",
    recommendedMove: signal.suggestedMove,
    shouldOfferChoices: signal.shouldOfferChoices,
    shouldAddHalfStepTwist: false,
    shouldShrinkScope: false,
    summary: "这一步难度基本合适，保持当前层级，只追一个最自然的理由或比较。",
    promptRule: "保持当前层级，不要突然讲解，也不要额外升级。先把这一步说清楚。",
  };
}

export function listRecentMathSessionLogs(logs: SessionLogItem[]) {
  return logs.filter((log) =>
    log.mathEvidence?.goalId === "math-thinking" || log.taskId.startsWith("math-"),
  );
}

export function inferMathStageFromRecentLogs(logs: SessionLogItem[]): ProgressionStageId {
  const mathLogs = listRecentMathSessionLogs(logs).slice(0, 5);
  const latestStage = mathLogs[0]?.mathEvidence?.progressionStageId ?? DEFAULT_MATH_STAGE;
  const recentSignals = mathLogs
    .map((log) => log.mathEvidence?.difficultySignal)
    .filter((signal): signal is MathDifficultySignal => Boolean(signal))
    .slice(0, 3);

  const tooEasyCount = recentSignals.filter((signal) => signal === "too_easy").length;
  const tooHardCount = recentSignals.filter((signal) => signal === "too_hard").length;

  if (tooEasyCount >= 2) {
    return advanceStage(latestStage);
  }
  if (tooHardCount >= 2) {
    return retreatStage(latestStage);
  }

  return clampStageToAvailable(mathLogs[0]?.mathEvidence?.nextSuggestedStageId ?? latestStage);
}

export function selectAdaptiveMathQuestion(input: {
  questionId?: string;
  recentLogs: SessionLogItem[];
  rotationSeed?: number | string;
}) {
  const requested = input.questionId
    ? DAILY_QUESTION_BANK.find((question) => question.id === input.questionId)
    : undefined;

  const targetStage = inferMathStageFromRecentLogs(input.recentLogs);
  const stageGoalMapping = getMathStageGoalMapping(targetStage);
  const preferredSubGoalIds = stageGoalMapping.preferredSubGoalIds ?? [stageGoalMapping.subGoalId];
  if (requested && getMathQuestionStage(requested) === targetStage) {
    return buildScenarioQuestionVariant(requested, input.rotationSeed);
  }
  const stagePool = DAILY_QUESTION_BANK.filter((question) =>
    isMathQuestion(question) && getMathQuestionStage(question) === targetStage,
  );
  const basePool = stagePool.length > 0
    ? stagePool
    : DAILY_QUESTION_BANK.filter((question) => isMathQuestion(question));
  const pool = [...basePool].sort((left, right) => {
    const leftIndex = preferredSubGoalIds.indexOf(left.subGoalId);
    const rightIndex = preferredSubGoalIds.indexOf(right.subGoalId);
    const normalizedLeft = leftIndex === -1 ? preferredSubGoalIds.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? preferredSubGoalIds.length : rightIndex;
    return normalizedLeft - normalizedRight;
  });

  const selected = pickLeastRepeatedQuestion({
    questions: pool,
    themeId: "math",
    recentLogs: input.recentLogs,
    rotationSeed: input.rotationSeed,
  });
  return selected
    ? buildScenarioQuestionVariant(selected, input.rotationSeed)
    : undefined;
}
