import { db } from "@/lib/data/db";
import type {
  CompletedSessionPayload,
  MathEvidence,
  ParentSummary,
  RewardSignal,
} from "@/types";

type SessionLogRow = {
  id: number;
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

type SessionLogItem = {
  id: number;
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

export function insertSessionLog(payload: CompletedSessionPayload) {
  const statement = db.prepare(`
    INSERT INTO session_logs (
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
    mode: payload.mode,
    taskId: payload.taskId,
    sceneId: payload.sceneId ?? null,
    title: payload.title,
    completion: payload.completion,
    highlightsJson: JSON.stringify(payload.highlights),
    rewardSignalsJson: JSON.stringify(payload.rewardSignals),
    mathEvidenceJson: payload.mathEvidence
      ? JSON.stringify(payload.mathEvidence)
      : null,
  });
}

export function listRecentSessionLogs(limit = 5): SessionLogItem[] {
  const statement = db.prepare(`
    SELECT
      id,
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

  return rows.map((row) => ({
    id: row.id,
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
  }));
}

export function hasSessionLogs() {
  const statement = db.prepare(`
    SELECT COUNT(*) as count
    FROM session_logs
  `);

  const row = statement.get() as { count: number };

  return row.count > 0;
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

export function buildParentSummaryFromLogs(): ParentSummary {
  const logs = listRecentSessionLogs(3);

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
