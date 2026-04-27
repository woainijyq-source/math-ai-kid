import {
  THINKING_GROWTH_PATHS,
  clampThinkingLevel,
  getThinkingGrowthLevel,
  getThinkingGrowthPath,
  type ThinkingGrowthLevel,
  type ThinkingProjectStatus,
} from "@/content/daily/thinking-growth-paths";
import {
  getThinkingMoveLabel,
  getThinkingMoveParentPrompt,
} from "@/content/daily/thinking-evidence-rubric";
import type { SessionLogItem } from "@/lib/data/session-log";
import type { ConversationMessage } from "@/types/agent";
import type { DailyQuestion, DailyThemeId, ThinkingEvidence, ThinkingMove } from "@/types/daily";
import type { ActivitySessionSummary, ObservationSummary } from "@/types/goals";
import type { MathDifficultySignal } from "@/types";

export interface ParentProjectPlan {
  themeId: DailyThemeId;
  label: string;
  shortLabel: string;
  internalFocus: string;
  targetThinkingMoves: ParentThinkingMoveSummary[];
  whyThisMatters: string;
  scientificBasis: string[];
  levels: ThinkingGrowthLevel[];
  currentLevel: number;
  currentLevelTitle: string;
  progressPercent: number;
  status: ThinkingProjectStatus;
  statusLabel: string;
  statusDetail: string;
  recentEvidence: string[];
  nextStep: string;
  homePrompt: string;
  nonFormalObservationNote: string;
  lastPlayedAt?: string;
  completedSessionCount: number;
}

export interface ParentThinkingMoveSummary {
  move: ThinkingMove;
  label: string;
  status: "seen" | "watching";
  evidenceCount: number;
  bestLevel: number;
  latestEvidence?: string;
  homePrompt: string;
}

export interface StoredThinkingEvidence extends ThinkingEvidence {
  id?: number;
  profileId?: string;
  sessionLogId?: number;
  taskId?: string;
  createdAt?: string;
}

const NON_FORMAL_OBSERVATION_NOTE = "这些内容是形成性观察，用来帮助下一次陪聊更合适，不是正式测评、分数或诊断。";

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

function getLogThemeId(log: SessionLogItem): DailyThemeId | undefined {
  if (log.mathEvidence?.themeId) {
    return log.mathEvidence.themeId;
  }

  return THINKING_GROWTH_PATHS.find((path) =>
    log.taskId.startsWith(THEME_PREFIX[path.themeId]),
  )?.themeId;
}

export function listProjectSessionLogs(logs: SessionLogItem[], themeId: DailyThemeId) {
  return logs.filter((log) => getLogThemeId(log) === themeId);
}

function listProjectObservations(observations: ObservationSummary[], themeId: DailyThemeId) {
  const path = getThinkingGrowthPath(themeId);
  if (!path) return [];

  return observations.filter((observation) =>
    observation.goalId === path.goalId &&
    (path.subGoalIds.length === 0 || path.subGoalIds.includes(observation.subGoalId)),
  );
}

function listProjectActivitySessions(sessions: ActivitySessionSummary[], themeId: DailyThemeId) {
  const path = getThinkingGrowthPath(themeId);
  if (!path) return [];

  return sessions.filter((session) =>
    session.goalId === path.goalId &&
    (path.subGoalIds.length === 0 || path.subGoalIds.includes(session.subGoalId)),
  );
}

function normalizeSignal(value: unknown): MathDifficultySignal | undefined {
  return value === "too_easy" || value === "fit" || value === "too_hard" ? value : undefined;
}

function getObservationLevel(observation: ObservationSummary) {
  const raw = observation.difficultyLevel?.replace("L", "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function inferProjectTargetLevel(
  themeId: DailyThemeId,
  logs: SessionLogItem[],
  thinkingEvidence?: StoredThinkingEvidence[],
) {
  const projectLogs = listProjectSessionLogs(logs, themeId).slice(0, 5);
  const latestLevel = clampThinkingLevel(
    themeId,
    projectLogs[0]?.mathEvidence?.adaptationLevel ?? 1,
  );
  const projectEvidence = listThinkingEvidenceForTheme(projectLogs, themeId, thinkingEvidence).slice(0, 5);
  const stableEvidenceLevel = inferStableEvidenceLevel(themeId, projectEvidence);

  if (stableEvidenceLevel && stableEvidenceLevel >= latestLevel) {
    return clampThinkingLevel(themeId, latestLevel + 1);
  }

  return inferProjectTargetLevelByDifficulty(themeId, projectLogs, latestLevel);
}

function inferProjectTargetLevelByDifficulty(
  themeId: DailyThemeId,
  projectLogs: SessionLogItem[],
  latestLevel: number,
) {
  const recentSignals = projectLogs
    .map((log) => normalizeSignal(log.mathEvidence?.difficultySignal))
    .filter((signal): signal is MathDifficultySignal => Boolean(signal))
    .slice(0, 3);
  const tooEasyCount = recentSignals.filter((signal) => signal === "too_easy").length;
  const tooHardCount = recentSignals.filter((signal) => signal === "too_hard").length;

  if (tooEasyCount >= 2) {
    return clampThinkingLevel(themeId, latestLevel + 1);
  }
  if (tooHardCount >= 2) {
    return clampThinkingLevel(themeId, latestLevel - 1);
  }

  return clampThinkingLevel(
    themeId,
    projectLogs[0]?.mathEvidence?.nextSuggestedLevel ?? latestLevel,
  );
}

function listThinkingEvidenceFromSessionLogs(logs: SessionLogItem[], themeId: DailyThemeId) {
  return logs.flatMap((log) =>
    [...(log.mathEvidence?.thinkingEvidence ?? [])]
      .reverse()
      .filter((evidence) => evidence.themeId === themeId),
  );
}

function listThinkingEvidenceForTheme(
  logs: SessionLogItem[],
  themeId: DailyThemeId,
  thinkingEvidence?: StoredThinkingEvidence[],
) {
  const independentEvidence = (thinkingEvidence ?? [])
    .filter((evidence) => evidence.themeId === themeId)
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightTime - leftTime;
    });

  return independentEvidence.length > 0
    ? independentEvidence
    : listThinkingEvidenceFromSessionLogs(logs, themeId);
}

function isLightlySupported(evidence: ThinkingEvidence) {
  return evidence.supportLevel === "none" || evidence.supportLevel === "light";
}

function isProgressEvidence(evidence: ThinkingEvidence) {
  if (!evidence.childInitiated) return false;
  if (evidence.confidence < 0.48) return false;
  if (evidence.supportLevel === "heavy") return false;
  return true;
}

function inferStableEvidenceLevel(themeId: DailyThemeId, evidence: ThinkingEvidence[]) {
  const targetMoves = getThinkingGrowthPath(themeId)?.targetThinkingMoves ?? [];
  const progressEvidence = evidence.filter(isProgressEvidence);
  let stableLevel = 0;

  for (const move of targetMoves) {
    const moveEvidence = progressEvidence.filter((item) => item.thinkingMove === move);
    for (let level = 1; level <= 4; level += 1) {
      const levelEvidence = moveEvidence.filter((item) => item.level >= level);
      const scenarioCount = new Set(
        levelEvidence.map((item) => item.scenarioId ?? item.scenarioTitle ?? item.childUtterance),
      ).size;
      const hasLightSupport = levelEvidence.some(isLightlySupported);

      if (levelEvidence.length >= 2 && scenarioCount >= 2 && hasLightSupport) {
        stableLevel = Math.max(stableLevel, level);
      }
    }
  }

  return stableLevel > 0 ? clampThinkingLevel(themeId, stableLevel) : undefined;
}

function describeSessionEvidence(log: SessionLogItem) {
  const evidence = log.mathEvidence;
  const thinkingEvidence = evidence?.thinkingEvidence?.[0];
  if (thinkingEvidence) {
    return describeThinkingEvidence(thinkingEvidence);
  }
  const title = evidence?.publicTitle ?? log.title;
  const childLine = log.highlights.find((item) => item.startsWith("她说：") || item.startsWith("孩子说："));
  const childPart = childLine ? `，${childLine}` : "";

  if (evidence?.difficultySignal === "too_easy") {
    return `最近在“${title}”里比较轻松${childPart}。`;
  }
  if (evidence?.difficultySignal === "too_hard") {
    return `最近在“${title}”里稍微吃力，需要把问题说小一点${childPart}。`;
  }
  if (evidence?.reasoningShown) {
    return `最近在“${title}”里已经开始说理由${childPart}。`;
  }
  if (evidence?.transferAttempted) {
    return `最近在“${title}”里尝试把想法换到新情况${childPart}。`;
  }
  return `最近聊过“${title}”，系统正在继续观察这一项。`;
}

function snippet(value: string, maxLength = 36) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function describeThinkingEvidence(evidence: ThinkingEvidence) {
  const moveLabel = getThinkingMoveLabel(evidence.thinkingMove);
  const scenario = evidence.scenarioTitle ? `在“${evidence.scenarioTitle}”里` : "最近一次";
  return `${scenario}看见了“${moveLabel}”证据：孩子说“${snippet(evidence.childUtterance)}”。`;
}

function describeObservationEvidence(observation: ObservationSummary) {
  const raw = observation.evidence?.rawEvidence ?? observation.evidence?.childInput ?? observation.observation;
  const snippet = raw.trim().length > 32 ? `${raw.trim().slice(0, 32)}...` : raw.trim();

  if (observation.status === "filled") {
    return snippet ? `已看到一条较清楚的表现：“${snippet}”` : "已看到一条较清楚的表现。";
  }
  if (observation.status === "low_confidence") {
    return "这条线索还偏薄，下一次会用更轻的方式再听一听。";
  }
  return snippet ? `最近留下一条观察：“${snippet}”` : "最近留下一条观察。";
}

function buildRecentEvidence(
  logs: SessionLogItem[],
  observations: ObservationSummary[],
  sessions: ActivitySessionSummary[],
  themeId?: DailyThemeId,
  thinkingEvidence?: StoredThinkingEvidence[],
) {
  const thinkingEvidenceItems = themeId
    ? listThinkingEvidenceForTheme(logs, themeId, thinkingEvidence).slice(0, 3).map(describeThinkingEvidence)
    : [];
  const evidence = [
    ...thinkingEvidenceItems,
    ...logs.slice(0, 2).map(describeSessionEvidence),
    ...observations.slice(0, 2).map(describeObservationEvidence),
    ...sessions.slice(0, 1).map((session) =>
      session.completedEvidenceSlots.length > 0
        ? `结构化片段里已经听到：${session.completedEvidenceSlots.join("、")}。`
        : "结构化片段已经开始，但还在收集更清楚的表现。",
    ),
  ];

  return evidence.filter((value, index, list) => value && list.indexOf(value) === index).slice(0, 4);
}

function buildMoveSummaries(
  themeId: DailyThemeId,
  logs: SessionLogItem[],
  thinkingEvidence?: StoredThinkingEvidence[],
): ParentThinkingMoveSummary[] {
  const path = getThinkingGrowthPath(themeId);
  const evidence = listThinkingEvidenceForTheme(logs, themeId, thinkingEvidence);
  if (!path) return [];

  return path.targetThinkingMoves.map((move) => {
    const moveEvidence = evidence.filter((item) => item.thinkingMove === move);
    const latest = moveEvidence[0];
    const bestLevel = moveEvidence.reduce((max, item) => Math.max(max, item.level), 0);

    return {
      move,
      label: getThinkingMoveLabel(move),
      status: moveEvidence.length > 0 ? "seen" : "watching",
      evidenceCount: moveEvidence.length,
      bestLevel,
      latestEvidence: latest ? snippet(latest.childUtterance, 30) : undefined,
      homePrompt: getThinkingMoveParentPrompt(move),
    };
  });
}

function buildHomePrompt(themeId: DailyThemeId, currentLevel: number) {
  const path = getThinkingGrowthPath(themeId);
  const move = path?.targetThinkingMoves[Math.max(0, Math.min(path.targetThinkingMoves.length - 1, currentLevel - 1))];
  return move ? getThinkingMoveParentPrompt(move) : "你为什么会这样想？";
}

function inferStatus(input: {
  logCount: number;
  observationCount: number;
  evidenceCount: number;
  latestSignal?: MathDifficultySignal;
}): { status: ThinkingProjectStatus; statusLabel: string; statusDetail: string } {
  if (input.logCount === 0 && input.observationCount === 0 && input.evidenceCount === 0) {
    return {
      status: "ready",
      statusLabel: "准备开始",
      statusDetail: "还没有真实互动记录，先从 L1 轻量进入。",
    };
  }
  if (input.logCount + input.observationCount + input.evidenceCount < 2) {
    return {
      status: "observing",
      statusLabel: "正在观察",
      statusDetail: "已有一点线索，但还不急着下结论。",
    };
  }
  if (input.latestSignal === "too_hard") {
    return {
      status: "support",
      statusLabel: "先扶一把",
      statusDetail: "最近略吃力，下一次会把问题说小一点。",
    };
  }
  if (input.latestSignal === "too_easy") {
    return {
      status: "stretch",
      statusLabel: "可以升半步",
      statusDetail: "最近比较轻松，可以换条件或往上试一点。",
    };
  }
  return {
    status: "active",
    statusLabel: "稳稳推进",
    statusDetail: "当前难度基本合适，继续用变式把这一层做稳。",
  };
}

function buildNextStep(themeId: DailyThemeId, targetLevel: number, latestSignal?: MathDifficultySignal) {
  const level = getThinkingGrowthLevel(themeId, targetLevel);
  const levelLabel = level ? `L${level.level} / ${level.title}` : `L${targetLevel}`;

  if (!latestSignal) {
    return level?.nextStep ?? "下一次先用轻量小场景开始观察。";
  }
  if (latestSignal === "too_hard") {
    return `下一次先留在 ${levelLabel}，把范围缩小、选项说清，降低开口压力。`;
  }
  if (latestSignal === "too_easy") {
    return `下一次会试着接近 ${levelLabel}，多加一个条件或换一个新情境。`;
  }
  return `下一次继续在 ${levelLabel}，换一个不重复的生活场景，把证据做厚。`;
}

function buildProgressPercent(input: {
  currentLevel: number;
  logCount: number;
  observationCount: number;
  sessionCount: number;
  evidenceCount: number;
}) {
  if (
    input.logCount === 0 &&
    input.observationCount === 0 &&
    input.sessionCount === 0 &&
    input.evidenceCount === 0
  ) {
    return 0;
  }

  const baseByLevel = [0, 12, 38, 63, 86];
  const base = baseByLevel[input.currentLevel] ?? 12;
  const boost = Math.min(12, input.logCount * 4 + input.observationCount * 3 + input.sessionCount * 2 + input.evidenceCount);
  return Math.min(96, Math.round(base + boost));
}

export function buildParentProjectPlans(input: {
  logs: SessionLogItem[];
  observations: ObservationSummary[];
  thinkingEvidence?: StoredThinkingEvidence[];
  activitySessions?: ActivitySessionSummary[];
  experimentalSessions?: ActivitySessionSummary[];
}): ParentProjectPlan[] {
  const allSessions = [
    ...(input.activitySessions ?? []),
    ...(input.experimentalSessions ?? []),
  ];

  return THINKING_GROWTH_PATHS.map((path) => {
    const logs = listProjectSessionLogs(input.logs, path.themeId);
    const observations = listProjectObservations(input.observations, path.themeId);
    const sessions = listProjectActivitySessions(allSessions, path.themeId);
    const thinkingEvidence = listThinkingEvidenceForTheme(logs, path.themeId, input.thinkingEvidence);
    const observationLevel = observations.length > 0
      ? Math.max(...observations.map(getObservationLevel))
      : 1;
    const targetLevel = logs.length > 0 || thinkingEvidence.length > 0
      ? inferProjectTargetLevel(path.themeId, input.logs, thinkingEvidence)
      : clampThinkingLevel(path.themeId, observationLevel);
    const currentLevel = clampThinkingLevel(path.themeId, targetLevel);
    const level = getThinkingGrowthLevel(path.themeId, currentLevel) ?? path.levels[0];
    const latestSignal = normalizeSignal(logs[0]?.mathEvidence?.difficultySignal);
    const status = inferStatus({
      logCount: logs.length,
      observationCount: observations.length,
      evidenceCount: thinkingEvidence.length,
      latestSignal,
    });

    return {
      themeId: path.themeId,
      label: path.label,
      shortLabel: path.shortLabel,
      internalFocus: path.internalFocus,
      targetThinkingMoves: buildMoveSummaries(path.themeId, logs, thinkingEvidence),
      whyThisMatters: path.whyThisMatters,
      scientificBasis: path.scientificBasis,
      levels: path.levels,
      currentLevel,
      currentLevelTitle: level?.title ?? "准备开始",
      progressPercent: buildProgressPercent({
        currentLevel,
        logCount: logs.length,
        observationCount: observations.length,
        sessionCount: sessions.length,
        evidenceCount: thinkingEvidence.length,
      }),
      status: status.status,
      statusLabel: status.statusLabel,
      statusDetail: status.statusDetail,
      recentEvidence: buildRecentEvidence(logs, observations, sessions, path.themeId, thinkingEvidence),
      nextStep: buildNextStep(path.themeId, currentLevel, latestSignal),
      homePrompt: buildHomePrompt(path.themeId, currentLevel),
      nonFormalObservationNote: NON_FORMAL_OBSERVATION_NOTE,
      lastPlayedAt: logs[0]?.createdAt,
      completedSessionCount: logs.length,
    };
  });
}

export function pickLeastRepeatedQuestion(input: {
  questions: DailyQuestion[];
  themeId: DailyThemeId;
  recentLogs: SessionLogItem[];
  rotationSeed?: number | string;
}) {
  const recentProjectLogs = listProjectSessionLogs(input.recentLogs, input.themeId);
  const recentIds = recentProjectLogs.map((log) => log.taskId);
  const seed = String(input.rotationSeed ?? new Date().toISOString().slice(0, 10));

  return [...input.questions].sort((left, right) => {
    const leftRecentIndex = recentIds.indexOf(left.id);
    const rightRecentIndex = recentIds.indexOf(right.id);
    const leftPenalty = leftRecentIndex === -1 ? 0 : 100 + Math.max(0, 8 - leftRecentIndex);
    const rightPenalty = rightRecentIndex === -1 ? 0 : 100 + Math.max(0, 8 - rightRecentIndex);
    if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
    return hashSeed(`${seed}:${left.id}`) - hashSeed(`${seed}:${right.id}`);
  })[0];
}

export function describeProjectPathForPrompt(themeId: DailyThemeId, logs: SessionLogItem[]) {
  const targetLevel = inferProjectTargetLevel(themeId, logs);
  const path = getThinkingGrowthPath(themeId);
  const level = getThinkingGrowthLevel(themeId, targetLevel);
  if (!path || !level) return [];

  return [
    `科学路径项目：${path.label}`,
    `当前推荐层级：L${level.level} / ${level.title}`,
    `这一层要练：${level.childGoal}`,
    `这一层证据：${level.evidenceExamples.join(" / ")}`,
    `选题原则：避免重复最近题目；同一层换生活场景；完成后再升半步。`,
  ];
}

export function inferProjectProgressFromConversation(themeId: DailyThemeId, conversation: ConversationMessage[]) {
  const userTurns = conversation.filter((message) => message.role === "user").length;
  return clampThinkingLevel(themeId, userTurns >= 3 ? 2 : 1);
}
