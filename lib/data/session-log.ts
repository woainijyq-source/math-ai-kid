import { db } from "@/lib/data/db";
import { DAILY_THEME_DEFINITIONS } from "@/content/daily/theme-definitions";
import { getThemeLevelDefinition } from "@/content/daily/theme-level-definitions";
import { mathProgressionStages } from "@/content/math-progression";
import type { DailyThemeId } from "@/types/daily";
import type {
  CompletedSessionPayload,
  MathEvidence,
  ParentSummary,
  RewardSignal,
} from "@/types";

type SessionLogRow = {
  id: number;
  profile_id: string | null;
  mode: string;
  task_id: string;
  scene_id: string | null;
  title: string;
  completion: string;
  highlights_json: string;
  reward_signals_json: string;
  math_evidence_json: string | null;
  created_at: string;
};

function isBusyLogError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("database is locked") || message.includes("SQLITE_BUSY");
}

export type SessionLogItem = {
  id: number;
  profileId?: string;
  mode: string;
  taskId: string;
  sceneId?: string;
  title: string;
  completion: string;
  highlights: string[];
  rewardSignals: RewardSignal[];
  mathEvidence?: MathEvidence;
  createdAt: string;
};

export interface ParentDailyBrief {
  questionTitle: string;
  summary: string;
  childThinking: string;
  adaptationSummary?: string;
  adaptationDetail?: string;
  nextPrompt: string;
  recentTopics: string[];
  generatedAt: string;
}

export interface ContinuitySnapshot {
  label: string;
  questionTitle: string;
  themeLabel?: string;
  childThinking?: string;
  memoryLine: string;
  gentleOpen: string;
  createdAt: string;
}

export interface RewardTimelineEntry {
  dateKey: string;
  dateLabel: string;
  questionTitle: string;
  themeLabel?: string;
  changeTitle: string;
  changeDetail: string;
  childThinking?: string;
  adaptationSummary?: string;
}

export interface RewardMilestoneBadge {
  id: string;
  label: string;
  detail: string;
}

export interface RewardWorldTrace {
  id: string;
  title: string;
  detail: string;
}

export interface RewardGrowthNode {
  id: string;
  title: string;
  detail: string;
  status: "done" | "active" | "locked";
}

export interface RewardSummary {
  streakDays: number;
  activeDaysLast7: number;
  totalSessions: number;
  currentIdentity: string;
  recentDays: RewardTimelineEntry[];
  lastingTraces: string[];
  milestoneBadges: RewardMilestoneBadge[];
  worldTraces: RewardWorldTrace[];
  growthMap: RewardGrowthNode[];
}

function parseLogDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateKey(value: string) {
  const date = parseLogDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value: string) {
  const date = parseLogDate(value);
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function diffDaysFromToday(value: string) {
  const target = parseLogDate(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);
}

function normalizeHighlights(highlights: string[]) {
  return highlights
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function insertSessionLog(payload: CompletedSessionPayload) {
  const statement = db.prepare(`
    INSERT INTO session_logs (
      profile_id,
      mode,
      task_id,
      scene_id,
      title,
      completion,
      highlights_json,
      reward_signals_json,
      math_evidence_json
    )
    VALUES (
      @profileId,
      @mode,
      @taskId,
      @sceneId,
      @title,
      @completion,
      @highlightsJson,
      @rewardSignalsJson,
      @mathEvidenceJson
    )
  `);

  statement.run({
    profileId: payload.profileId ?? null,
    mode: payload.mode,
    taskId: payload.taskId,
    sceneId: payload.sceneId ?? null,
    title: payload.title,
    completion: payload.completion,
    highlightsJson: JSON.stringify(normalizeHighlights(payload.highlights)),
    rewardSignalsJson: JSON.stringify(payload.rewardSignals),
    mathEvidenceJson: payload.mathEvidence
      ? JSON.stringify(payload.mathEvidence)
      : null,
  });
}

function mapSessionLogRow(row: SessionLogRow): SessionLogItem {
  return {
    id: row.id,
    profileId: row.profile_id ?? undefined,
    mode: row.mode,
    taskId: row.task_id,
    sceneId: row.scene_id ?? undefined,
    title: row.title,
    completion: row.completion,
    highlights: JSON.parse(row.highlights_json) as string[],
    rewardSignals: JSON.parse(row.reward_signals_json) as RewardSignal[],
    mathEvidence: row.math_evidence_json
      ? (JSON.parse(row.math_evidence_json) as MathEvidence)
      : undefined,
    createdAt: row.created_at,
  };
}

export function listRecentSessionLogs(limit = 5, profileId?: string): SessionLogItem[] {
  try {
    if (profileId) {
      const profileRows = db.prepare(`
        SELECT
          id,
          profile_id,
          mode,
          task_id,
          scene_id,
          title,
          completion,
          highlights_json,
          reward_signals_json,
          math_evidence_json,
          created_at
        FROM session_logs
        WHERE profile_id = ?
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT ?
      `).all(profileId, limit) as SessionLogRow[];

      if (profileRows.length > 0) {
        return profileRows.map(mapSessionLogRow);
      }
    }

    const statement = db.prepare(`
      SELECT
        id,
        profile_id,
        mode,
        task_id,
        scene_id,
        title,
        completion,
        highlights_json,
        reward_signals_json,
        math_evidence_json,
        created_at
      FROM session_logs
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `);

    const rows = statement.all(limit) as SessionLogRow[];
    return rows.map(mapSessionLogRow);
  } catch (error) {
    if (isBusyLogError(error)) {
      return [];
    }
    throw error;
  }
}

export function hasSessionLogs(profileId?: string) {
  try {
    if (profileId) {
      const profileRow = db.prepare(`
        SELECT COUNT(*) as count
        FROM session_logs
        WHERE profile_id = ?
      `).get(profileId) as { count: number };

      if (profileRow.count > 0) {
        return true;
      }
    }

    const statement = db.prepare(`
      SELECT COUNT(*) as count
      FROM session_logs
    `);

    const row = statement.get() as { count: number };
    return row.count > 0;
  } catch (error) {
    if (isBusyLogError(error)) {
      return false;
    }
    throw error;
  }
}

function getModeLabel(mode: string) {
  if (mode === "opponent") {
    return "AI 对手";
  }

  if (mode === "co-create") {
    return "AI 共创";
  }

  return "AI 剧情";
}

function getMathSignalLabel(signal: MathEvidence["difficultySignal"]) {
  switch (signal) {
    case "too_easy":
      return "偏轻松";
    case "too_hard":
      return "稍微吃力";
    case "fit":
    default:
      return "刚刚好";
  }
}

function getMathSupportLabel(level: MathEvidence["supportLevel"]) {
  switch (level) {
    case "heavy":
      return "需要比较多支架";
    case "medium":
      return "需要一点点支架";
    case "light":
    default:
      return "基本能自己往前想";
  }
}

function getMathStageLabel(stageId: MathEvidence["progressionStageId"]) {
  if (!stageId) {
    return "当前这一级";
  }
  return mathProgressionStages[stageId]?.title ?? stageId;
}

function getThemeLabel(themeId: MathEvidence["themeId"]) {
  return DAILY_THEME_DEFINITIONS.find((theme) => theme.id === themeId)?.label;
}

function getThemeLevelLabel(themeId: MathEvidence["themeId"], level?: number) {
  const definition = getThemeLevelDefinition(themeId, level ?? 1);
  return definition ? `L${definition.level} / ${definition.title}` : undefined;
}

function buildAdaptationSummary(evidence: MathEvidence | undefined) {
  if (!evidence?.difficultySignal) {
    return undefined;
  }

  return `这次对她来说：${getMathSignalLabel(evidence.difficultySignal)}`;
}

function buildAdaptationDetail(evidence: MathEvidence | undefined) {
  if (!evidence) {
    return undefined;
  }

  const supportLabel = getMathSupportLabel(evidence.supportLevel);

  if (evidence.goalId === "math-thinking") {
    const stageLabel = getMathStageLabel(evidence.progressionStageId);

    if (evidence.difficultySignal === "too_easy") {
      return `这次主要在“${stageLabel}”这一层，她已经能比较自然地往前想，${supportLabel}。林老师下次会更愿意多加半步。`;
    }

    if (evidence.difficultySignal === "too_hard") {
      return `这次主要在“${stageLabel}”这一层，她有一点点吃力，${supportLabel}。林老师下次会先把范围缩小一点，再把她带回来。`;
    }

    return `这次主要在“${stageLabel}”这一层，整体难度基本合适，${supportLabel}。林老师会先把这一层继续做稳。`;
  }

  const themeLabel = getThemeLabel(evidence.themeId) ?? "这个方向";
  const themeLevelLabel = getThemeLevelLabel(evidence.themeId, evidence.adaptationLevel);
  const levelPrefix = themeLevelLabel ? `主要在“${themeLevelLabel}”这一层，` : "";

  if (evidence.difficultySignal === "too_easy") {
    return `这次在“${themeLabel}”这条线上，${levelPrefix}她已经能比较自然地往前想，${supportLabel}。林老师下次会更愿意把问题再拧高半步。`;
  }

  if (evidence.difficultySignal === "too_hard") {
    return `这次在“${themeLabel}”这条线上，${levelPrefix}她有一点点吃力，${supportLabel}。林老师下次会先把范围缩小一点，再把问题说得更轻一点。`;
  }

  return `这次在“${themeLabel}”这条线上，${levelPrefix}整体难度基本合适，${supportLabel}。林老师会先沿着这一层继续聊稳。`;
}

function buildNextPrompt(taskId: string, title: string, evidence?: MathEvidence) {
  if (taskId.startsWith("math-") && evidence?.nextSuggestedStageId) {
    const nextStage = getMathStageLabel(evidence.nextSuggestedStageId);

    if (evidence.difficultySignal === "too_easy") {
      return `下次林老师会更愿意把聊天往“${nextStage}”那一层推半步，比如多一个条件、换一种说法，看看她是不是还能继续跟上。`;
    }

    if (evidence.difficultySignal === "too_hard") {
      return `下次林老师会先留在更稳的范围里，把问题缩小一点，再看看她什么时候愿意自己往前迈一步。`;
    }

    return `下次林老师大概率还会先留在“${nextStage}”附近，继续把这一层慢慢聊稳。`;
  }

  if (evidence?.themeId && evidence.nextSuggestedLevel) {
    const themeLabel = getThemeLabel(evidence.themeId) ?? "这个方向";

    if (evidence.difficultySignal === "too_easy") {
      return `下次林老师会继续围着“${themeLabel}”往前拧半步，比如多加一点条件、换一个角度，看看她是不是还能轻松跟上。`;
    }

    if (evidence.difficultySignal === "too_hard") {
      return `下次林老师会继续留在“${themeLabel}”附近，但会先把问题说得更小、更轻一点，再慢慢把她带回来。`;
    }

    return `下次林老师大概率还会先留在“${themeLabel}”这条线上，把这一层聊稳，再决定要不要往前推。`;
  }

  if (taskId.startsWith("math-")) {
    return "明天可以接着问：如果人数变多一点，或者少一个条件，你还会怎么分、怎么比？";
  }
  if (taskId.startsWith("pattern-")) {
    return "明天可以接着问：你是从哪里看出它在重复，另一个答案又错在哪里？";
  }
  if (taskId.startsWith("why-")) {
    return "明天可以接着问：除了这个原因，还有没有别的可能？如果换个情况，答案会不会变？";
  }
  if (taskId.startsWith("fairness-")) {
    return "明天可以接着问：一样多就一定公平吗？如果情境变了，规则要不要跟着变？";
  }
  if (taskId.startsWith("whatif-")) {
    return "明天可以接着问：如果真的这样发生了，第一个变化会是什么？你想先改哪一条规则？";
  }
  return `明天可以围绕“${title}”继续追问：为什么这样想？如果换一个条件，会不会有不同办法？`;
}

function pickChildThinking(log: SessionLogItem) {
  const quoted = log.highlights.find((item) => item.startsWith("她说：") || item.startsWith("孩子说："));
  if (quoted) return quoted;

  const nonBadgeHighlight = log.highlights.find((item) => !item.includes("徽章") && !item.includes("小火花") && !item.includes("小达人") && !item.includes("小设计师") && !item.includes("小发明家") && !item.includes("小侦探"));
  if (nonBadgeHighlight) return nonBadgeHighlight;

  return `今天她围绕“${log.title}”说了自己的想法，也愿意继续往下想。`;
}

function buildContinuityLabel(createdAt: string) {
  const diff = diffDaysFromToday(createdAt);
  if (diff <= 0) return "刚才";
  if (diff === 1) return "昨天";
  if (diff <= 6) return `前${diff}天`;
  return "前几天";
}

export function buildContinuitySnapshot(profileId?: string, themeId?: DailyThemeId): ContinuitySnapshot | null {
  const logs = listRecentSessionLogs(8, profileId);
  const matched = themeId
    ? logs.find((log) => log.mathEvidence?.themeId === themeId)
    : undefined;
  const latest = matched ?? logs[0];

  if (!latest) {
    return null;
  }

  const label = buildContinuityLabel(latest.createdAt);
  const themeLabel = getThemeLabel(latest.mathEvidence?.themeId);
  const childThinking = pickChildThinking(latest);
  const memoryLine = `${label}你们聊到“${latest.title}”时，林老师还记得她当时说过：${childThinking}`;
  const gentleOpen = themeLabel
    ? `${label}我们聊过“${latest.title}”这件事。林老师还记得你那时提到：${childThinking}。今天我想从“${themeLabel}”这个方向再轻轻接一下。`
    : `${label}我们聊到“${latest.title}”时，林老师记住了你当时的想法。今天想再轻轻接一下。`;

  return {
    label,
    questionTitle: latest.title,
    themeLabel,
    childThinking,
    memoryLine,
    gentleOpen,
    createdAt: latest.createdAt,
  };
}

function buildRewardChangeTitle(log: SessionLogItem) {
  const rewardTitle = log.rewardSignals.find((signal) => signal.title.trim())?.title;
  if (rewardTitle) {
    return rewardTitle;
  }

  const themeLabel = getThemeLabel(log.mathEvidence?.themeId);
  if (themeLabel) {
    return `${themeLabel}的小变化`;
  }

  return log.title;
}

function buildRewardChangeDetail(log: SessionLogItem) {
  const rewardDetail = log.rewardSignals.find((signal) => signal.detail.trim())?.detail;
  if (rewardDetail) {
    return rewardDetail;
  }

  const adaptationDetail = buildAdaptationDetail(log.mathEvidence);
  if (adaptationDetail) {
    return adaptationDetail;
  }

  return log.completion;
}

function buildRewardTimelineEntry(log: SessionLogItem): RewardTimelineEntry {
  return {
    dateKey: toDateKey(log.createdAt),
    dateLabel: formatDayLabel(log.createdAt),
    questionTitle: log.title,
    themeLabel: getThemeLabel(log.mathEvidence?.themeId),
    changeTitle: buildRewardChangeTitle(log),
    changeDetail: buildRewardChangeDetail(log),
    childThinking: pickChildThinking(log),
    adaptationSummary: buildAdaptationSummary(log.mathEvidence),
  };
}

function countStreakDays(logs: SessionLogItem[]) {
  const uniqueDays = [...new Set(logs.map((log) => toDateKey(log.createdAt)))];
  if (uniqueDays.length === 0) {
    return 0;
  }

  let streak = 1;
  let previous = parseLogDate(uniqueDays[0]);

  for (let index = 1; index < uniqueDays.length; index += 1) {
    const current = parseLogDate(uniqueDays[index]);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / 86400000);
    if (diffDays !== 1) {
      break;
    }
    streak += 1;
    previous = current;
  }

  return streak;
}

function countActiveDaysLast7(logs: SessionLogItem[]) {
  const today = new Date();
  const lowerBound = new Date(today);
  lowerBound.setDate(today.getDate() - 6);

  return new Set(
    logs
      .filter((log) => parseLogDate(log.createdAt).getTime() >= lowerBound.getTime())
      .map((log) => toDateKey(log.createdAt)),
  ).size;
}

function buildLastingTraces(logs: SessionLogItem[]) {
  return logs
    .flatMap((log) => {
      const traces = [
        getThemeLabel(log.mathEvidence?.themeId),
        log.rewardSignals[0]?.title,
        log.mathEvidence?.publicTitle,
      ];

      return traces.filter((value): value is string => Boolean(value?.trim()));
    })
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 8);
}

function countReasoningSessions(logs: SessionLogItem[]) {
  return logs.filter((log) => log.mathEvidence?.reasoningShown).length;
}

function countTransferSessions(logs: SessionLogItem[]) {
  return logs.filter((log) => log.mathEvidence?.transferAttempted).length;
}

function countThemeVariety(logs: SessionLogItem[]) {
  return new Set(
    logs
      .map((log) => log.mathEvidence?.themeId)
      .filter((themeId): themeId is DailyThemeId => Boolean(themeId)),
  ).size;
}

function buildCurrentIdentity(logs: SessionLogItem[], streakDays: number) {
  const reasoningCount = countReasoningSessions(logs);
  const themeVariety = countThemeVariety(logs);

  if (streakDays >= 5) {
    return "会回来找林老师的小伙伴";
  }
  if (reasoningCount >= 4) {
    return "会把理由说清的小思考家";
  }
  if (themeVariety >= 3) {
    return "敢从不同方向想的小探索家";
  }
  return "今天的小变化收藏家";
}

function buildMilestoneBadges(logs: SessionLogItem[], streakDays: number, activeDaysLast7: number) {
  const badges: RewardMilestoneBadge[] = [];
  const reasoningCount = countReasoningSessions(logs);
  const transferCount = countTransferSessions(logs);
  const themeVariety = countThemeVariety(logs);

  if (logs.length >= 1) {
    badges.push({
      id: "first-chat",
      label: "开口小火花",
      detail: "已经留下第一段会被林老师记住的小聊天。",
    });
  }
  if (streakDays >= 2) {
    badges.push({
      id: "steady-return",
      label: "连续来聊",
      detail: `已经连续 ${streakDays} 天留下小变化。`,
    });
  }
  if (reasoningCount >= 3) {
    badges.push({
      id: "reason-builder",
      label: "理由慢慢长出来",
      detail: "最近几次里，孩子已经多次愿意把“为什么”说出来。",
    });
  }
  if (themeVariety >= 3) {
    badges.push({
      id: "wide-explorer",
      label: "多方向探索",
      detail: "最近已经在多个主题上留下了变化痕迹。",
    });
  }
  if (transferCount >= 2 || activeDaysLast7 >= 4) {
    badges.push({
      id: "half-step-grower",
      label: "会往前多想半步",
      detail: "不只是答一句，而是开始跟着林老师多走半步。",
    });
  }

  return badges.slice(0, 5);
}

function buildWorldTraces(logs: SessionLogItem[]) {
  return logs
    .map((log) => {
      const themeLabel = getThemeLabel(log.mathEvidence?.themeId);
      if (!themeLabel) {
        return null;
      }
      return {
        id: `${themeLabel}-${log.id}`,
        title: `${themeLabel}的小角落亮了一点`,
        detail: buildRewardChangeDetail(log),
      };
    })
    .filter((trace): trace is RewardWorldTrace => Boolean(trace))
    .filter((trace, index, list) => list.findIndex((item) => item.title === trace.title) === index)
    .slice(0, 4);
}

function buildGrowthMap(logs: SessionLogItem[], streakDays: number, activeDaysLast7: number): RewardGrowthNode[] {
  const reasoningCount = countReasoningSessions(logs);
  const transferCount = countTransferSessions(logs);
  const themeVariety = countThemeVariety(logs);

  return [
    {
      id: "open-up",
      title: "愿意开口",
      detail: "先把自己的想法说出来，让林老师能接住。",
      status: logs.length >= 1 ? "done" : "locked",
    },
    {
      id: "say-why",
      title: "会说理由",
      detail: "不只是给答案，还开始补一句为什么。",
      status: reasoningCount >= 2 ? "done" : logs.length >= 1 ? "active" : "locked",
    },
    {
      id: "change-angle",
      title: "换个角度",
      detail: "一旦条件变一点，也愿意继续跟着往前想。",
      status: transferCount >= 1 || themeVariety >= 2 ? "done" : reasoningCount >= 1 ? "active" : "locked",
    },
    {
      id: "keep-growing",
      title: "慢慢形成习惯",
      detail: "不只今天聊一轮，而是最近几天都在一点点亮起来。",
      status: streakDays >= 3 || activeDaysLast7 >= 4 ? "done" : logs.length >= 3 ? "active" : "locked",
    },
  ];
}

export function buildRewardSummaryFromLogs(profileId?: string): RewardSummary | null {
  const logs = listRecentSessionLogs(14, profileId);
  if (logs.length === 0) {
    return null;
  }

  const streakDays = countStreakDays(logs);
  const activeDaysLast7 = countActiveDaysLast7(logs);

  const seenDays = new Set<string>();
  const recentDays = logs
    .filter((log) => {
      const key = toDateKey(log.createdAt);
      if (seenDays.has(key)) {
        return false;
      }
      seenDays.add(key);
      return true;
    })
    .slice(0, 7)
    .map(buildRewardTimelineEntry);

  return {
    streakDays,
    activeDaysLast7,
    totalSessions: logs.length,
    currentIdentity: buildCurrentIdentity(logs, streakDays),
    recentDays,
    lastingTraces: buildLastingTraces(logs),
    milestoneBadges: buildMilestoneBadges(logs, streakDays, activeDaysLast7),
    worldTraces: buildWorldTraces(logs),
    growthMap: buildGrowthMap(logs, streakDays, activeDaysLast7),
  };
}

export function buildParentDailyBrief(profileId?: string): ParentDailyBrief | null {
  const logs = listRecentSessionLogs(3, profileId);
  const latest = logs[0];

  if (!latest) {
    return null;
  }

  return {
    questionTitle: latest.title,
    summary: `最近一次，林老师和孩子围绕“${latest.title}”聊了一小段。${latest.completion}`,
    childThinking: pickChildThinking(latest),
    adaptationSummary: buildAdaptationSummary(latest.mathEvidence),
    adaptationDetail: buildAdaptationDetail(latest.mathEvidence),
    nextPrompt: buildNextPrompt(latest.taskId, latest.title, latest.mathEvidence),
    recentTopics: logs.map((log) => log.title).filter((title, index, list) => list.indexOf(title) === index).slice(0, 3),
    generatedAt: latest.createdAt,
  };
}

export function buildParentSummaryFromLogs(profileId?: string): ParentSummary {
  const logs = listRecentSessionLogs(3, profileId);

  if (logs.length === 0) {
    return {
      dailySummary: "今天还没有试玩记录。",
      strengthSignals: ["等待第一条真实试玩记录。"],
      stuckSignals: ["暂时还没有明显卡点。"],
      nextSuggestion: "先让孩子完成一个完整回合，观察最愿意继续的是哪种玩法。",
      recentHighlights: ["尚未形成新的观察结论。"],
      observedMoves: [],
      aiFocus: [],
    };
  }

  const latest = logs[0];
  const latestEvidence = latest.mathEvidence;
  const allHighlights = logs.flatMap((log) => log.highlights).slice(0, 4);
  const worldSignals = logs
    .flatMap((log) => log.rewardSignals)
    .filter((signal) => signal.type === "world")
    .map((signal) => signal.title);
  const observedMoves = logs
    .flatMap((log) => log.mathEvidence?.observedMoves ?? [])
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3);
  const skillFocus = logs
    .flatMap((log) => log.mathEvidence?.skillFocus ?? [])
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3);

  return {
    dailySummary: latestEvidence
      ? `最近一次完成的是 ${getModeLabel(latest.mode)} 试玩，重点练的是“${latestEvidence.publicTitle}”。${latest.completion}`
      : `最近一次完成的是 ${getModeLabel(latest.mode)} 试玩。${latest.completion}`,
    strengthSignals: [
      latestEvidence
        ? `这轮主要在练：${latestEvidence.skillFocus.slice(0, 2).join("、")}`
        : "孩子愿意在有明确回应的回合里继续推进。",
      observedMoves.length > 0
        ? `孩子实际用到的思路：${observedMoves[0]}`
        : "会对世界变化和角色回应做出反应。",
      worldSignals.length > 0
        ? `对世界变化有明确反应：${worldSignals[0]}`
        : "会留意结果反馈和角色回应。",
    ],
    stuckSignals: [
      "长文本输入仍然偏慢，短句、语音和选项式互动更自然。",
      skillFocus.length > 0
        ? `后续可以继续围绕 ${skillFocus.join("、")} 做短回合验证。`
        : "继续观察孩子更容易进入状态的玩法节奏。",
    ],
    nextSuggestion: latestEvidence
      ? `下一轮继续围绕“${latestEvidence.publicTitle}”追问“为什么这样想”，看孩子会不会主动解释。`
      : "继续观察孩子会不会主动要求再来一轮，并记录最自然的反馈语气。",
    recentHighlights: allHighlights.length > 0 ? allHighlights : ["已完成一次有效试玩。"],
    latestMathFocus: latestEvidence?.publicTitle,
    observedMoves,
    aiFocus: latestEvidence?.aiFocus ?? [],
  };
}
