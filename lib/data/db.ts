import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  ActivitySessionStatus,
  ChallengeGenerationStatus,
  DifficultyLevelName,
  EvidenceSlot,
  GeneratedPatternChallengeSpec,
  ObservationCorrectness,
  ObservationEvidenceType,
  ObservationSource,
  ObservationStatus,
  ObservationSummary,
  PatternChallengeSource,
  RepairStrategy,
  ScoringMode,
  ThinEvidenceType,
} from "@/types/goals";

const dataDir = path.join(process.cwd(), ".data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function isBusySchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("database is locked") || message.includes("SQLITE_BUSY");
}

const dbPath = path.join(dataDir, "brainplay.sqlite");
export const db = new Database(dbPath);
function safePragma(sql: string) {
  try {
    db.pragma(sql);
  } catch (error) {
    if (!isBusySchemaError(error)) {
      throw error;
    }
  }
}

safePragma("journal_mode = WAL");
safePragma("busy_timeout = 5000");

function safeSchemaExec(sql: string) {
  try {
    db.exec(sql);
  } catch (error) {
    if (!isBusySchemaError(error)) {
      throw error;
    }
  }
}

safeSchemaExec(`
  CREATE TABLE IF NOT EXISTS session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completion TEXT NOT NULL,
    highlights_json TEXT NOT NULL,
    reward_signals_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  const getRows = () => {
    try {
      return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    } catch (error) {
      if (isBusySchemaError(error)) {
        return [];
      }
      throw error;
    }
  };
  const rows = getRows();
  if (rows.some((row) => row.name === column)) {
    return;
  }

  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (isBusySchemaError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate column name")) {
      throw error;
    }
  }
}

ensureColumn("session_logs", "scene_id", "TEXT");
ensureColumn("session_logs", "math_evidence_json", "TEXT");
ensureColumn("session_logs", "profile_id", "TEXT");

safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_session_logs_profile
    ON session_logs(profile_id, created_at DESC);
`);

safeSchemaExec(`
  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    sub_goal_id TEXT,
    goal_id TEXT,
    observation TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    evidence_json TEXT,
    turn_index INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

ensureColumn("observations", "difficulty_level", "TEXT");
ensureColumn("observations", "hint_count", "INTEGER");
ensureColumn("observations", "self_explained", "INTEGER");
ensureColumn("observations", "correctness", "TEXT");
ensureColumn("observations", "task_id", "TEXT");
ensureColumn("observations", "activity_id", "TEXT");
ensureColumn("observations", "evidence_type", "TEXT");
ensureColumn("observations", "mastery_delta", "REAL");
ensureColumn("observations", "activity_session_id", "TEXT");
ensureColumn("observations", "evidence_slot", "TEXT");
ensureColumn("observations", "source", "TEXT");
ensureColumn("observations", "status", "TEXT");
ensureColumn("observations", "misconception_tag", "TEXT");
ensureColumn("observations", "rubric_score", "REAL");
ensureColumn("observations", "is_required", "INTEGER");
ensureColumn("observations", "is_auto_inferred", "INTEGER");
ensureColumn("observations", "activity_status", "TEXT");
ensureColumn("observations", "scoring_mode", "TEXT");
ensureColumn("observations", "thin_evidence_type", "TEXT");
ensureColumn("observations", "recognized_evidence_kind", "TEXT");
ensureColumn("observations", "repair_recommended", "TEXT");
ensureColumn("observations", "silent_streak", "INTEGER");

safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_observations_profile
    ON observations(profile_id, created_at DESC);
`);
safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_observations_skill
    ON observations(profile_id, skill, created_at DESC);
`);
safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_observations_activity_session
    ON observations(activity_session_id, created_at DESC);
`);

safeSchemaExec(`
  CREATE TABLE IF NOT EXISTS activity_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    sub_goal_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    status TEXT NOT NULL,
    required_evidence_slots_json TEXT NOT NULL,
    completed_evidence_slots_json TEXT NOT NULL DEFAULT '[]',
    missing_evidence_slots_json TEXT NOT NULL DEFAULT '[]',
    latest_difficulty_level TEXT,
    hint_count INTEGER NOT NULL DEFAULT 0,
    evidence_thin_count INTEGER NOT NULL DEFAULT 0,
    evaluator_status TEXT NOT NULL DEFAULT 'waiting',
    last_evaluated_at TEXT,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
`);

safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_activity_sessions_profile
    ON activity_sessions(profile_id, updated_at DESC);
`);
safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_activity_sessions_session
    ON activity_sessions(session_id, updated_at DESC);
`);
safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_activity_sessions_pending
    ON activity_sessions(evaluator_status, updated_at DESC);
`);

safeSchemaExec(`
  CREATE TABLE IF NOT EXISTS activity_session_events (
    id TEXT PRIMARY KEY,
    activity_session_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    turn_index INTEGER,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

ensureColumn("activity_sessions", "scoring_mode", "TEXT");
ensureColumn("activity_sessions", "redirect_count", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("activity_sessions", "noise_turn_count", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("activity_sessions", "empty_evidence_streak", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("activity_sessions", "thin_evidence_type", "TEXT");
ensureColumn("activity_sessions", "repair_strategy", "TEXT");
ensureColumn("activity_sessions", "handoff_template", "TEXT");
ensureColumn("activity_sessions", "silent_streak", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("activity_sessions", "recognized_evidence_kind", "TEXT");
ensureColumn("activity_sessions", "challenge_id", "TEXT");
ensureColumn("activity_sessions", "challenge_spec_json", "TEXT");
ensureColumn("activity_sessions", "challenge_generation_status", "TEXT");
ensureColumn("activity_sessions", "challenge_source", "TEXT");
ensureColumn("activity_session_events", "scoring_mode", "TEXT");

safeSchemaExec(`
  CREATE INDEX IF NOT EXISTS idx_activity_session_events_session
    ON activity_session_events(activity_session_id, created_at ASC);
`);

export interface ObservationRow {
  id?: number;
  profile_id: string;
  session_id: string;
  skill: string;
  sub_goal_id?: string;
  goal_id?: string;
  observation: string;
  confidence: number;
  difficulty_level?: DifficultyLevelName;
  hint_count?: number;
  self_explained?: number;
  correctness?: ObservationCorrectness;
  task_id?: string;
  activity_id?: string;
  evidence_type?: ObservationEvidenceType;
  mastery_delta?: number;
  evidence_json?: string;
  turn_index?: number;
  activity_session_id?: string;
  evidence_slot?: EvidenceSlot;
  source?: ObservationSource;
  status?: ObservationStatus;
  misconception_tag?: string;
  rubric_score?: number;
  is_required?: number;
  is_auto_inferred?: number;
  activity_status?: ActivitySessionStatus;
  scoring_mode?: ScoringMode;
  thin_evidence_type?: ThinEvidenceType;
  recognized_evidence_kind?: ObservationEvidenceType | "empty_evidence";
  repair_recommended?: RepairStrategy;
  silent_streak?: number;
  created_at?: string;
}

export interface ActivitySessionRow {
  id: string;
  session_id: string;
  profile_id: string;
  goal_id: string;
  sub_goal_id: string;
  activity_id: string;
  status: ActivitySessionStatus;
  required_evidence_slots_json: string;
  completed_evidence_slots_json: string;
  missing_evidence_slots_json: string;
  latest_difficulty_level?: DifficultyLevelName;
  hint_count: number;
  evidence_thin_count: number;
  scoring_mode: ScoringMode;
  redirect_count: number;
  noise_turn_count: number;
  empty_evidence_streak: number;
  thin_evidence_type?: ThinEvidenceType;
  repair_strategy?: RepairStrategy;
  handoff_template?: string;
  silent_streak: number;
  recognized_evidence_kind?: ObservationEvidenceType | "empty_evidence";
  challenge_id?: string;
  challenge_spec_json?: string;
  challenge_generation_status?: ChallengeGenerationStatus;
  challenge_source?: PatternChallengeSource;
  evaluator_status: "waiting" | "pending" | "processing" | "evaluated";
  last_evaluated_at?: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ActivitySessionEventRow {
  id: string;
  activity_session_id: string;
  session_id: string;
  turn_index?: number;
  event_type: string;
  source: string;
  scoring_mode?: ScoringMode;
  payload_json: string;
  created_at: string;
}

interface ParsedObservationEvidence {
  child_input?: string;
  tool_context?: string[];
  hint_used?: boolean;
  answer_quality?: string;
  evidence_type?: ObservationEvidenceType;
  raw_evidence?: string;
  thin_evidence_type?: ThinEvidenceType;
  recognized_evidence_kind?: ObservationEvidenceType | "empty_evidence";
  repair_recommended?: RepairStrategy;
  silent_streak?: number;
}

function parseJsonArray<T extends string>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is T => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeDifficultyLevel(value: unknown): DifficultyLevelName {
  return value === "L2" || value === "L3" || value === "L4" ? value : "L1";
}

function normalizeCorrectness(value: unknown): ObservationCorrectness | undefined {
  return value === "correct" || value === "partial" || value === "incorrect" || value === "unknown"
    ? value
    : undefined;
}

function normalizeEvidenceType(value: unknown): ObservationEvidenceType | undefined {
  return value === "answer" ||
    value === "self_explanation" ||
    value === "rule_statement" ||
    value === "contrastive_rebuttal" ||
    value === "activity_summary" ||
    value === "strategy_prediction" ||
    value === "transfer_check" ||
    value === "idea_improvement" ||
    value === "describe_observation" ||
    value === "general"
    ? value
    : undefined;
}

function normalizeThinEvidenceType(value: unknown): ThinEvidenceType | undefined {
  return value === "intuition_only" ||
    value === "energetic_but_unfocused" ||
    value === "silent_or_blank_first" ||
    value === "silent_or_blank_repeat" ||
    value === "empty_evidence"
    ? value
    : undefined;
}

function normalizeRepairStrategy(value: unknown): RepairStrategy | undefined {
  return value === "contrastive_rebuttal" ||
    value === "feynman_teach_me" ||
    value === "attention_recovery" ||
    value === "sentence_frame"
    ? value
    : undefined;
}

function normalizeObservationSource(value: unknown): ObservationSource | undefined {
  return value === "child_text" ||
    value === "child_voice_stt" ||
    value === "evaluator_inferred" ||
    value === "system_event"
    ? value
    : undefined;
}

function normalizeObservationStatus(value: unknown): ObservationStatus | undefined {
  return value === "filled" ||
    value === "missing" ||
    value === "low_confidence" ||
    value === "auto_inferred"
    ? value
    : undefined;
}

function normalizeEvidenceSlot(value: unknown): EvidenceSlot | undefined {
  return value === "answer" ||
    value === "self_explanation" ||
    value === "activity_summary" ||
    value === "strategy_prediction" ||
    value === "transfer_check" ||
    value === "idea_improvement" ||
    value === "describe_observation"
    ? value
    : undefined;
}

function normalizeActivityStatus(value: unknown): ActivitySessionStatus | undefined {
  return value === "in_progress" ||
    value === "passed_complete" ||
    value === "passed_evidence_thin" ||
    value === "not_yet_mastered" ||
    value === "abandoned"
    ? value
    : undefined;
}

function normalizeScoringMode(value: unknown): ScoringMode {
  return value === "formal_scored" ? "formal_scored" : "experimental_unscored";
}

function normalizeChallengeGenerationStatus(
  value: unknown,
): ChallengeGenerationStatus | undefined {
  return value === "ready" ||
    value === "retrying" ||
    value === "fallback_ready" ||
    value === "failed"
    ? value
    : undefined;
}

function normalizeChallengeSource(value: unknown): PatternChallengeSource | undefined {
  return value === "ai_generated" || value === "authored_fallback" ? value : undefined;
}

function parseChallengeSpec(
  value: string | undefined,
): GeneratedPatternChallengeSpec | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as GeneratedPatternChallengeSpec | null;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function parseObservationEvidence(
  evidenceJson?: string,
): ParsedObservationEvidence | undefined {
  if (!evidenceJson) return undefined;
  try {
    const parsed = JSON.parse(evidenceJson) as ParsedObservationEvidence | null;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function toObservationSummary(row: ObservationRow): ObservationSummary {
  const evidence = parseObservationEvidence(row.evidence_json);

  return {
    goalId: row.goal_id ?? "unknown-goal",
    subGoalId: row.sub_goal_id ?? "unknown-subgoal",
    skill: row.skill,
    observation: row.observation,
    confidence: row.confidence,
    difficultyLevel: normalizeDifficultyLevel(row.difficulty_level),
    hintCount: row.hint_count,
    selfExplained: row.self_explained === undefined ? undefined : row.self_explained > 0,
    correctness: normalizeCorrectness(row.correctness),
    taskId: row.task_id,
    activityId: row.activity_id,
    evidenceType: normalizeEvidenceType(row.evidence_type),
    masteryDelta: row.mastery_delta,
    evidence: evidence
      ? {
          childInput: evidence.child_input,
          toolContext: evidence.tool_context,
          hintUsed: evidence.hint_used,
          answerQuality: evidence.answer_quality,
          evidenceType: normalizeEvidenceType(evidence.evidence_type),
          rawEvidence: evidence.raw_evidence,
          thinEvidenceType: normalizeThinEvidenceType(evidence.thin_evidence_type),
          recognizedEvidenceKind: normalizeEvidenceType(evidence.recognized_evidence_kind) ?? (evidence.recognized_evidence_kind === "empty_evidence" ? "empty_evidence" : undefined),
          repairRecommended: normalizeRepairStrategy(evidence.repair_recommended),
          silentStreak: typeof evidence.silent_streak === "number" ? evidence.silent_streak : undefined,
        }
      : undefined,
    activitySessionId: row.activity_session_id,
    evidenceSlot: normalizeEvidenceSlot(row.evidence_slot),
    source: normalizeObservationSource(row.source),
    status: normalizeObservationStatus(row.status),
    misconceptionTag: row.misconception_tag,
    rubricScore: row.rubric_score,
    isRequired: row.is_required === undefined ? undefined : row.is_required > 0,
    isAutoInferred: row.is_auto_inferred === undefined ? undefined : row.is_auto_inferred > 0,
    activityStatus: normalizeActivityStatus(row.activity_status),
    scoringMode: normalizeScoringMode(row.scoring_mode),
    thinEvidenceType: normalizeThinEvidenceType(row.thin_evidence_type),
    recognizedEvidenceKind: normalizeEvidenceType(row.recognized_evidence_kind) ?? (row.recognized_evidence_kind === "empty_evidence" ? "empty_evidence" : undefined),
    repairRecommended: normalizeRepairStrategy(row.repair_recommended),
    silentStreak: row.silent_streak,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function insertObservation(row: ObservationRow): number {
  const stmt = db.prepare(`
    INSERT INTO observations (
      profile_id,
      session_id,
      skill,
      sub_goal_id,
      goal_id,
      observation,
      confidence,
      difficulty_level,
      hint_count,
      self_explained,
      correctness,
      task_id,
      activity_id,
      evidence_type,
      mastery_delta,
      evidence_json,
      turn_index,
      activity_session_id,
      evidence_slot,
      source,
      status,
      misconception_tag,
      rubric_score,
      is_required,
      is_auto_inferred,
      activity_status,
      scoring_mode,
      thin_evidence_type,
      recognized_evidence_kind,
      repair_recommended,
      silent_streak
    ) VALUES (
      @profile_id,
      @session_id,
      @skill,
      @sub_goal_id,
      @goal_id,
      @observation,
      @confidence,
      @difficulty_level,
      @hint_count,
      @self_explained,
      @correctness,
      @task_id,
      @activity_id,
      @evidence_type,
      @mastery_delta,
      @evidence_json,
      @turn_index,
      @activity_session_id,
      @evidence_slot,
      @source,
      @status,
      @misconception_tag,
      @rubric_score,
      @is_required,
      @is_auto_inferred,
      @activity_status,
      @scoring_mode,
      @thin_evidence_type,
      @recognized_evidence_kind,
      @repair_recommended,
      @silent_streak
    )
  `);
  const result = stmt.run({
    profile_id: row.profile_id,
    session_id: row.session_id,
    skill: row.skill,
    sub_goal_id: row.sub_goal_id ?? null,
    goal_id: row.goal_id ?? null,
    observation: row.observation,
    confidence: row.confidence,
    difficulty_level: row.difficulty_level ?? null,
    hint_count: row.hint_count ?? 0,
    self_explained: row.self_explained ?? 0,
    correctness: row.correctness ?? "unknown",
    task_id: row.task_id ?? null,
    activity_id: row.activity_id ?? null,
    evidence_type: row.evidence_type ?? "general",
    mastery_delta: row.mastery_delta ?? null,
    evidence_json: row.evidence_json ?? null,
    turn_index: row.turn_index ?? null,
    activity_session_id: row.activity_session_id ?? null,
    evidence_slot: row.evidence_slot ?? null,
    source: row.source ?? null,
    status: row.status ?? null,
    misconception_tag: row.misconception_tag ?? null,
    rubric_score: row.rubric_score ?? null,
    is_required: row.is_required ?? 0,
    is_auto_inferred: row.is_auto_inferred ?? 0,
    activity_status: row.activity_status ?? null,
    scoring_mode: row.scoring_mode ?? "formal_scored",
    thin_evidence_type: normalizeThinEvidenceType(row.thin_evidence_type) ?? null,
    recognized_evidence_kind: row.recognized_evidence_kind ?? null,
    repair_recommended: normalizeRepairStrategy(row.repair_recommended) ?? null,
    silent_streak: Number.isFinite(Number(row.silent_streak)) ? Number(row.silent_streak) : null,
  });
  return result.lastInsertRowid as number;
}

export function deleteObservationsByActivitySession(activitySessionId: string) {
  db.prepare(`DELETE FROM observations WHERE activity_session_id = ?`).run(activitySessionId);
}

export function deleteActivitySessionCascade(activitySessionId: string) {
  deleteObservationsByActivitySession(activitySessionId);
  db.prepare(`DELETE FROM activity_session_events WHERE activity_session_id = ?`).run(activitySessionId);
  db.prepare(`DELETE FROM activity_sessions WHERE id = ?`).run(activitySessionId);
}

export function getRecentObservations(
  profileId: string,
  options: { skill?: string; limit?: number; goalId?: string; scoringMode?: ScoringMode } = {},
): ObservationRow[] {
  const { skill, limit = 20, goalId, scoringMode } = options;
  if (skill && goalId && scoringMode) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND skill = ? AND goal_id = ? AND scoring_mode = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, skill, goalId, scoringMode, limit) as ObservationRow[];
  }
  if (skill && goalId) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND skill = ? AND goal_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, skill, goalId, limit) as ObservationRow[];
  }
  if (skill && scoringMode) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND skill = ? AND scoring_mode = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, skill, scoringMode, limit) as ObservationRow[];
  }
  if (skill) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND skill = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, skill, limit) as ObservationRow[];
  }
  if (goalId && scoringMode) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND goal_id = ? AND scoring_mode = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, goalId, scoringMode, limit) as ObservationRow[];
  }
  if (goalId) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND goal_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, goalId, limit) as ObservationRow[];
  }
  if (scoringMode) {
    return db.prepare(
      `SELECT * FROM observations
       WHERE profile_id = ? AND scoring_mode = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(profileId, scoringMode, limit) as ObservationRow[];
  }
  return db.prepare(
    `SELECT * FROM observations
     WHERE profile_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  ).all(profileId, limit) as ObservationRow[];
}

export function getRecentObservationSummaries(
  profileId: string,
  options: { skill?: string; limit?: number; goalId?: string; scoringMode?: ScoringMode } = {},
): ObservationSummary[] {
  return getRecentObservations(profileId, options).map(toObservationSummary);
}

export function getSkillSummary(
  profileId: string,
  topN = 5,
  scoringMode?: ScoringMode,
): Array<{ skill: string; avg_confidence: number; count: number }> {
  if (scoringMode) {
    return db.prepare(
      `SELECT skill, AVG(confidence) as avg_confidence, COUNT(*) as count
       FROM observations WHERE profile_id = ? AND scoring_mode = ?
       GROUP BY skill ORDER BY avg_confidence DESC LIMIT ?`,
    ).all(profileId, scoringMode, topN) as Array<{ skill: string; avg_confidence: number; count: number }>;
  }
  return db.prepare(
    `SELECT skill, AVG(confidence) as avg_confidence, COUNT(*) as count
     FROM observations WHERE profile_id = ?
     GROUP BY skill ORDER BY avg_confidence DESC LIMIT ?`,
  ).all(profileId, topN) as Array<{ skill: string; avg_confidence: number; count: number }>;
}

export function getActivitySession(activitySessionId: string): ActivitySessionRow | undefined {
  return db.prepare(`SELECT * FROM activity_sessions WHERE id = ?`).get(activitySessionId) as ActivitySessionRow | undefined;
}

export function getLatestActivitySessionForSession(sessionId: string): ActivitySessionRow | undefined {
  return db.prepare(
    `SELECT * FROM activity_sessions
     WHERE session_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
  ).get(sessionId) as ActivitySessionRow | undefined;
}

export function getRecentActivitySessionsForProfile(
  profileId: string,
  limit = 12,
  scoringMode?: ScoringMode,
): ActivitySessionRow[] {
  if (scoringMode) {
    return db.prepare(
      `SELECT * FROM activity_sessions
       WHERE profile_id = ? AND scoring_mode = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
    ).all(profileId, scoringMode, limit) as ActivitySessionRow[];
  }
  return db.prepare(
    `SELECT * FROM activity_sessions
     WHERE profile_id = ?
     ORDER BY updated_at DESC
     LIMIT ?`,
  ).all(profileId, limit) as ActivitySessionRow[];
}

export function upsertActivitySession(row: {
  id: string;
  sessionId: string;
  profileId: string;
  goalId: string;
  subGoalId: string;
  activityId: string;
  scoringMode: ScoringMode;
  status?: ActivitySessionStatus;
  requiredEvidenceSlots: EvidenceSlot[];
  latestDifficultyLevel?: DifficultyLevelName;
  thinEvidenceType?: ThinEvidenceType;
  repairStrategy?: RepairStrategy;
  handoffTemplate?: string;
  silentStreak?: number;
  recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
  challengeId?: string;
  challengeSpec?: GeneratedPatternChallengeSpec;
  challengeGenerationStatus?: ChallengeGenerationStatus;
  challengeSource?: PatternChallengeSource;
}) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_sessions (
      id,
      session_id,
      profile_id,
      goal_id,
      sub_goal_id,
      activity_id,
      status,
      required_evidence_slots_json,
      completed_evidence_slots_json,
      missing_evidence_slots_json,
      latest_difficulty_level,
      hint_count,
      evidence_thin_count,
      scoring_mode,
      redirect_count,
      noise_turn_count,
      empty_evidence_streak,
      thin_evidence_type,
      repair_strategy,
      handoff_template,
      silent_streak,
      recognized_evidence_kind,
      challenge_id,
      challenge_spec_json,
      challenge_generation_status,
      challenge_source,
      evaluator_status,
      started_at,
      updated_at
    ) VALUES (
      @id,
      @session_id,
      @profile_id,
      @goal_id,
      @sub_goal_id,
      @activity_id,
      @status,
      @required_evidence_slots_json,
      '[]',
      '[]',
      @latest_difficulty_level,
      0,
      0,
      @scoring_mode,
      0,
      0,
      0,
      @thin_evidence_type,
      @repair_strategy,
      @handoff_template,
      @silent_streak,
      @recognized_evidence_kind,
      @challenge_id,
      @challenge_spec_json,
      @challenge_generation_status,
      @challenge_source,
      @evaluator_status,
      @started_at,
      @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      goal_id = excluded.goal_id,
      sub_goal_id = excluded.sub_goal_id,
      activity_id = excluded.activity_id,
      scoring_mode = excluded.scoring_mode,
      latest_difficulty_level = excluded.latest_difficulty_level,
      thin_evidence_type = COALESCE(excluded.thin_evidence_type, activity_sessions.thin_evidence_type),
      repair_strategy = COALESCE(excluded.repair_strategy, activity_sessions.repair_strategy),
      handoff_template = COALESCE(excluded.handoff_template, activity_sessions.handoff_template),
      silent_streak = COALESCE(excluded.silent_streak, activity_sessions.silent_streak),
      recognized_evidence_kind = COALESCE(excluded.recognized_evidence_kind, activity_sessions.recognized_evidence_kind),
      challenge_id = COALESCE(excluded.challenge_id, activity_sessions.challenge_id),
      challenge_spec_json = COALESCE(excluded.challenge_spec_json, activity_sessions.challenge_spec_json),
      challenge_generation_status = COALESCE(excluded.challenge_generation_status, activity_sessions.challenge_generation_status),
      challenge_source = COALESCE(excluded.challenge_source, activity_sessions.challenge_source),
      updated_at = excluded.updated_at
  `).run({
    id: row.id,
    session_id: row.sessionId,
    profile_id: row.profileId,
    goal_id: row.goalId,
    sub_goal_id: row.subGoalId,
    activity_id: row.activityId,
    scoring_mode: row.scoringMode,
    status: row.status ?? "in_progress",
    required_evidence_slots_json: JSON.stringify(row.requiredEvidenceSlots),
    latest_difficulty_level: row.latestDifficultyLevel,
    thin_evidence_type: normalizeThinEvidenceType(row.thinEvidenceType) ?? null,
    repair_strategy: normalizeRepairStrategy(row.repairStrategy) ?? null,
    handoff_template: row.handoffTemplate ?? null,
    silent_streak: Number.isFinite(Number(row.silentStreak)) ? Number(row.silentStreak) : 0,
    recognized_evidence_kind: row.recognizedEvidenceKind ?? null,
    challenge_id: row.challengeId ?? null,
    challenge_spec_json: row.challengeSpec ? JSON.stringify(row.challengeSpec) : null,
    challenge_generation_status: normalizeChallengeGenerationStatus(row.challengeGenerationStatus) ?? null,
    challenge_source: normalizeChallengeSource(row.challengeSource) ?? null,
    evaluator_status: row.scoringMode === "formal_scored" ? "waiting" : "evaluated",
    started_at: now,
    updated_at: now,
  });
}

export function markActivitySessionPending(activitySessionId: string) {
  db.prepare(`
    UPDATE activity_sessions
    SET evaluator_status = 'pending', updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), activitySessionId);
}

export function updateActivitySessionEvaluation(
  activitySessionId: string,
  patch: {
    status: ActivitySessionStatus;
    completedEvidenceSlots: EvidenceSlot[];
    missingEvidenceSlots: EvidenceSlot[];
    latestDifficultyLevel?: DifficultyLevelName;
    hintCount?: number;
    evidenceThinCount?: number;
    emptyEvidenceStreak?: number;
    thinEvidenceType?: ThinEvidenceType;
    repairStrategy?: RepairStrategy;
    handoffTemplate?: string;
    silentStreak?: number;
    recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
    completedAt?: string;
  },
) {
  db.prepare(`
    UPDATE activity_sessions
    SET status = @status,
        completed_evidence_slots_json = @completed,
        missing_evidence_slots_json = @missing,
        latest_difficulty_level = COALESCE(@latest_difficulty_level, latest_difficulty_level),
        hint_count = COALESCE(@hint_count, hint_count),
        evidence_thin_count = COALESCE(@evidence_thin_count, evidence_thin_count),
        empty_evidence_streak = COALESCE(@empty_evidence_streak, empty_evidence_streak),
        thin_evidence_type = COALESCE(@thin_evidence_type, thin_evidence_type),
        repair_strategy = COALESCE(@repair_strategy, repair_strategy),
        handoff_template = COALESCE(@handoff_template, handoff_template),
        silent_streak = COALESCE(@silent_streak, silent_streak),
        recognized_evidence_kind = COALESCE(@recognized_evidence_kind, recognized_evidence_kind),
        evaluator_status = 'evaluated',
        last_evaluated_at = @evaluated_at,
        updated_at = @updated_at,
        completed_at = COALESCE(@completed_at, completed_at)
    WHERE id = @id
  `).run({
    id: activitySessionId,
    status: patch.status,
    completed: JSON.stringify(patch.completedEvidenceSlots),
    missing: JSON.stringify(patch.missingEvidenceSlots),
    latest_difficulty_level: patch.latestDifficultyLevel,
    hint_count: patch.hintCount,
    evidence_thin_count: patch.evidenceThinCount,
    empty_evidence_streak: patch.emptyEvidenceStreak,
    thin_evidence_type: normalizeThinEvidenceType(patch.thinEvidenceType) ?? null,
    repair_strategy: normalizeRepairStrategy(patch.repairStrategy) ?? null,
    handoff_template: patch.handoffTemplate ?? null,
    silent_streak: Number.isFinite(Number(patch.silentStreak)) ? Number(patch.silentStreak) : null,
    recognized_evidence_kind: patch.recognizedEvidenceKind ?? null,
    evaluated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: patch.completedAt,
  });
}

export function updateActivitySessionRuntime(
  activitySessionId: string,
  patch: {
    status?: ActivitySessionStatus;
    redirectCount?: number;
    noiseTurnCount?: number;
    emptyEvidenceStreak?: number;
    thinEvidenceType?: ThinEvidenceType;
    repairStrategy?: RepairStrategy;
    handoffTemplate?: string;
    silentStreak?: number;
    recognizedEvidenceKind?: ObservationEvidenceType | "empty_evidence";
    challengeId?: string;
    challengeSpec?: GeneratedPatternChallengeSpec;
    challengeGenerationStatus?: ChallengeGenerationStatus;
    challengeSource?: PatternChallengeSource;
    evaluatorStatus?: ActivitySessionRow["evaluator_status"];
    completedAt?: string | null;
  },
) {
  db.prepare(`
    UPDATE activity_sessions
    SET status = COALESCE(@status, status),
        redirect_count = COALESCE(@redirect_count, redirect_count),
        noise_turn_count = COALESCE(@noise_turn_count, noise_turn_count),
        empty_evidence_streak = COALESCE(@empty_evidence_streak, empty_evidence_streak),
        thin_evidence_type = COALESCE(@thin_evidence_type, thin_evidence_type),
        repair_strategy = COALESCE(@repair_strategy, repair_strategy),
        handoff_template = COALESCE(@handoff_template, handoff_template),
        silent_streak = COALESCE(@silent_streak, silent_streak),
        recognized_evidence_kind = COALESCE(@recognized_evidence_kind, recognized_evidence_kind),
        challenge_id = COALESCE(@challenge_id, challenge_id),
        challenge_spec_json = COALESCE(@challenge_spec_json, challenge_spec_json),
        challenge_generation_status = COALESCE(@challenge_generation_status, challenge_generation_status),
        challenge_source = COALESCE(@challenge_source, challenge_source),
        evaluator_status = COALESCE(@evaluator_status, evaluator_status),
        updated_at = @updated_at,
        completed_at = CASE
          WHEN @completed_at IS NULL THEN completed_at
          ELSE @completed_at
        END
    WHERE id = @id
  `).run({
    id: activitySessionId,
    status: patch.status ?? null,
    redirect_count: patch.redirectCount ?? null,
    noise_turn_count: patch.noiseTurnCount ?? null,
    empty_evidence_streak: patch.emptyEvidenceStreak ?? null,
    thin_evidence_type: normalizeThinEvidenceType(patch.thinEvidenceType) ?? null,
    repair_strategy: normalizeRepairStrategy(patch.repairStrategy) ?? null,
    handoff_template: patch.handoffTemplate ?? null,
    silent_streak: Number.isFinite(Number(patch.silentStreak)) ? Number(patch.silentStreak) : null,
    recognized_evidence_kind: patch.recognizedEvidenceKind ?? null,
    challenge_id: patch.challengeId ?? null,
    challenge_spec_json: patch.challengeSpec ? JSON.stringify(patch.challengeSpec) : null,
    challenge_generation_status: normalizeChallengeGenerationStatus(patch.challengeGenerationStatus) ?? null,
    challenge_source: normalizeChallengeSource(patch.challengeSource) ?? null,
    evaluator_status: patch.evaluatorStatus ?? null,
    updated_at: new Date().toISOString(),
    completed_at: patch.completedAt ?? null,
  });
}

export function appendActivitySessionEvent(row: {
  id: string;
  activitySessionId: string;
  sessionId: string;
  turnIndex?: number;
  eventType: string;
  source: string;
  scoringMode?: ScoringMode;
  payload: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_session_events (
      id,
      activity_session_id,
      session_id,
      turn_index,
      event_type,
      source,
      scoring_mode,
      payload_json,
      created_at
    ) VALUES (
      @id,
      @activity_session_id,
      @session_id,
      @turn_index,
      @event_type,
      @source,
      @scoring_mode,
      @payload_json,
      @created_at
    )
  `).run({
    id: row.id,
    activity_session_id: row.activitySessionId,
    session_id: row.sessionId,
    turn_index: row.turnIndex,
    event_type: row.eventType,
    source: row.source,
    scoring_mode: row.scoringMode ?? "experimental_unscored",
    payload_json: JSON.stringify(row.payload),
    created_at: now,
  });

  if (
    (row.scoringMode ?? "experimental_unscored") === "formal_scored" &&
    row.eventType !== "activity_abandoned"
  ) {
    markActivitySessionPending(row.activitySessionId);
  }
}

export function getActivitySessionEvents(activitySessionId: string): ActivitySessionEventRow[] {
  return db.prepare(
    `SELECT * FROM activity_session_events
     WHERE activity_session_id = ?
     ORDER BY created_at ASC`,
  ).all(activitySessionId) as ActivitySessionEventRow[];
}

export function getPendingActivitySessions(options: {
  profileId?: string;
  sessionId?: string;
  limit?: number;
} = {}): ActivitySessionRow[] {
  const { profileId, sessionId, limit = 12 } = options;
  if (profileId && sessionId) {
    return db.prepare(
      `SELECT * FROM activity_sessions
       WHERE evaluator_status = 'pending' AND scoring_mode = 'formal_scored' AND profile_id = ? AND session_id = ?
       ORDER BY updated_at ASC LIMIT ?`,
    ).all(profileId, sessionId, limit) as ActivitySessionRow[];
  }
  if (profileId) {
    return db.prepare(
      `SELECT * FROM activity_sessions
       WHERE evaluator_status = 'pending' AND scoring_mode = 'formal_scored' AND profile_id = ?
       ORDER BY updated_at ASC LIMIT ?`,
    ).all(profileId, limit) as ActivitySessionRow[];
  }
  if (sessionId) {
    return db.prepare(
      `SELECT * FROM activity_sessions
       WHERE evaluator_status = 'pending' AND scoring_mode = 'formal_scored' AND session_id = ?
       ORDER BY updated_at ASC LIMIT ?`,
    ).all(sessionId, limit) as ActivitySessionRow[];
  }
  return db.prepare(
    `SELECT * FROM activity_sessions
     WHERE evaluator_status = 'pending' AND scoring_mode = 'formal_scored'
     ORDER BY updated_at ASC LIMIT ?`,
  ).all(limit) as ActivitySessionRow[];
}

export function getIdleActivitySessions(options: {
  profileId?: string;
  limit?: number;
} = {}): ActivitySessionRow[] {
  const { profileId, limit = 20 } = options;
  if (profileId) {
    return db.prepare(
      `SELECT s.* FROM activity_sessions s
       LEFT JOIN activity_session_events e ON e.activity_session_id = s.id
       WHERE s.profile_id = ? AND e.id IS NULL
       ORDER BY s.updated_at ASC
       LIMIT ?`,
    ).all(profileId, limit) as ActivitySessionRow[];
  }
  return db.prepare(
    `SELECT s.* FROM activity_sessions s
     LEFT JOIN activity_session_events e ON e.activity_session_id = s.id
     WHERE e.id IS NULL
     ORDER BY s.updated_at ASC
     LIMIT ?`,
  ).all(limit) as ActivitySessionRow[];
}

export function toActivitySessionSummary(row: ActivitySessionRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id,
    goalId: row.goal_id,
    subGoalId: row.sub_goal_id,
    activityId: row.activity_id,
    status: row.status,
    scoringMode: normalizeScoringMode(row.scoring_mode),
    requiredEvidenceSlots: parseJsonArray<EvidenceSlot>(row.required_evidence_slots_json),
    completedEvidenceSlots: parseJsonArray<EvidenceSlot>(row.completed_evidence_slots_json),
    missingEvidenceSlots: parseJsonArray<EvidenceSlot>(row.missing_evidence_slots_json),
    latestDifficultyLevel: row.latest_difficulty_level,
    hintCount: row.hint_count,
    evidenceThinCount: row.evidence_thin_count,
    redirectCount: row.redirect_count,
    noiseTurnCount: row.noise_turn_count,
    emptyEvidenceStreak: row.empty_evidence_streak,
    thinEvidenceType: normalizeThinEvidenceType(row.thin_evidence_type),
    repairStrategy: normalizeRepairStrategy(row.repair_strategy),
    handoffTemplate: row.handoff_template ?? undefined,
    silentStreak: row.silent_streak ?? undefined,
    recognizedEvidenceKind: row.recognized_evidence_kind ?? undefined,
    challengeId: row.challenge_id ?? undefined,
    challengeSpec: parseChallengeSpec(row.challenge_spec_json),
    challengeSource: normalizeChallengeSource(row.challenge_source),
    challengeGenerationStatus: normalizeChallengeGenerationStatus(row.challenge_generation_status),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
