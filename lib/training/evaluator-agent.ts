import { getActivity } from "@/content/activities/activity-templates";
import { getSubGoalPlaybook } from "@/lib/training/domain-pedagogy";
import {
  evaluatePatternRecognitionAnswer,
  readPatternRecognitionChallengeSpec,
} from "@/lib/training/pattern-activity-runtime";
import {
  appendActivitySessionEvent,
  deleteActivitySessionCascade,
  deleteObservationsByActivitySession,
  getActivitySessionEvents,
  getIdleActivitySessions,
  getPendingActivitySessions,
  insertObservation,
  toActivitySessionSummary,
  updateActivitySessionEvaluation,
  updateActivitySessionRuntime,
  type ActivitySessionEventRow,
  type ActivitySessionRow,
} from "@/lib/data/db";
import type {
  ActivitySessionStatus,
  DifficultyLevelName,
  EvidenceSlot,
  ObservationCorrectness,
  ObservationEvidenceType,
  ObservationSource,
  ObservationStatus,
  RepairStrategy,
  ThinEvidenceType,
} from "@/types/goals";

type RecognizedEvidenceKind = ObservationEvidenceType | "empty_evidence";

type EvidenceDecision = {
  slot: EvidenceSlot;
  status: ObservationStatus;
  source: ObservationSource;
  confidence: number;
  observation: string;
  correctness?: ObservationCorrectness;
  selfExplained?: boolean;
  hintCount?: number;
  rubricScore?: number;
  evidenceType: ObservationEvidenceType;
  rawEvidence?: string;
  misconceptionTag?: string;
  isAutoInferred?: boolean;
  thinEvidenceType?: ThinEvidenceType;
  recognizedEvidenceKind?: RecognizedEvidenceKind;
  repairRecommended?: RepairStrategy;
  silentStreak?: number;
};

const PATTERN_RECOGNITION_FEW_SHOT_PROFILE = "pattern-recognition-matrix-v2";

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[，。！？；：、,.!?;:]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCorrectness(value: unknown): ObservationCorrectness | undefined {
  return value === "correct" || value === "partial" || value === "incorrect" || value === "unknown"
    ? value
    : undefined;
}

function normalizeDifficulty(value: unknown): DifficultyLevelName | undefined {
  return value === "L1" || value === "L2" || value === "L3" || value === "L4" ? value : undefined;
}

function scoreTextQuality(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (trimmed.length >= 18) return 3;
  if (trimmed.length >= 10) return 2;
  if (trimmed.length >= 4) return 1;
  return 0;
}

function safeParsePayload<T>(event: ActivitySessionEventRow): T | null {
  try {
    return JSON.parse(event.payload_json) as T;
  } catch {
    return null;
  }
}

function confidenceToNumber(confidence: "high" | "medium-high" | "medium" | "low"): number {
  switch (confidence) {
    case "high":
      return 0.9;
    case "medium-high":
      return 0.8;
    case "medium":
      return 0.68;
    default:
      return 0.32;
  }
}

function looksLikeShortAnswerOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (/^(红|黄|蓝|绿|圆|方块|三角形|正方形|8|7|6|5)$/.test(trimmed)) return true;
  return trimmed.length <= 2;
}

function detectPatternAnswerSignal(text: string): boolean {
  return /(下一个是|答案是|应该是|我选|我觉得是|就是|应该填)/i.test(text) || /^\d+$/.test(text.trim());
}

function detectOffTaskNoise(text: string): boolean {
  const normalized = normalizeText(text);
  return /(动画片|晚饭|肚子饿|吃饭|唱歌|玩具|skip|hungry|dinner|song|toy)/i.test(normalized);
}

function detectPatternEvidence(
  text: string,
  row: ActivitySessionRow,
): {
  status: ObservationStatus;
  confidence: number;
  observation: string;
  evidenceType: ObservationEvidenceType;
  selfExplained: boolean;
  rubricScore: number;
  misconceptionTag?: string;
  thinEvidenceType?: ThinEvidenceType;
  recognizedEvidenceKind?: RecognizedEvidenceKind;
  repairRecommended?: RepairStrategy;
  silentStreak?: number;
} {
  const playbook = getSubGoalPlaybook(row.sub_goal_id);
  const challengeSpec = readPatternRecognitionChallengeSpec(row);
  const normalized = normalizeText(text);
  const ruleFragments = [
    ...(playbook.ruleFragments ?? []),
    ...(challengeSpec?.ruleModel.expectedEvidencePhrases ?? []),
    challengeSpec?.ruleModel.summary ?? "",
    challengeSpec?.contrastTarget ?? "",
  ].map((fragment) => normalizeText(fragment));
  const silentStreak = row.silent_streak ?? 0;
  const nextSilentStreak = silentStreak + 1;
  const fewShot = playbook.evaluatorFewShotMatrix ?? [];
  const fewShotHit = fewShot.find((example) => {
    const sample = normalizeText(example.input);
    return sample && (normalized.includes(sample) || sample.includes(normalized));
  });

  const hasRuleFragment = ruleFragments.some((fragment) => fragment && normalized.includes(fragment));
  const isExplicitUnknown = /(不知道|忘了|没听清|不会说|说不出来)/i.test(text);
  const isIntuitionOnly = /(感觉对|感觉是|我猜|就是它|应该是这个)/i.test(text);
  const isContrastive = /(不是|不对|少了|多了|不一样|没跟前面一样|不好看|不像|不该|不能是)/i.test(text);
  const isSpacePattern = /(倒过来了|转面了|转过来了|翻过来了|换边了)/i.test(text);
  const isAttributePattern = /(红.*黄|黄.*红|方块.*圆圈|圆圈.*方块|重复|轮流)/i.test(text);
  const isQuantityPattern = /(每次.*加|每次.*多|每次.*大|每次.*减|每次.*少|越来越大|越来越小|\+|-)/i.test(text);
  const hasMixedAnswerAndRule = detectPatternAnswerSignal(text) && (hasRuleFragment || isQuantityPattern || isAttributePattern || isSpacePattern);

  if (!normalized) {
    const thinEvidenceType = nextSilentStreak >= 2 ? "silent_or_blank_repeat" : "silent_or_blank_first";
    return {
      status: "missing",
      confidence: 0.18,
      observation: "Child did not provide enough reasoning language yet.",
      evidenceType: "self_explanation",
      selfExplained: false,
      rubricScore: 0.15,
      thinEvidenceType,
      recognizedEvidenceKind: "empty_evidence",
      repairRecommended: nextSilentStreak >= 2 ? "sentence_frame" : "attention_recovery",
      silentStreak: nextSilentStreak,
      misconceptionTag: "reasoning_not_expressed",
    };
  }

  if (looksLikeShortAnswerOnly(text)) {
    return {
      status: "low_confidence",
      confidence: 0.36,
      observation: `Child gave the answer but not the rule yet: ${text.slice(0, 120)}`,
      evidenceType: "self_explanation",
      selfExplained: false,
      rubricScore: 0.3,
      thinEvidenceType: "energetic_but_unfocused",
      recognizedEvidenceKind: "empty_evidence",
      repairRecommended: "feynman_teach_me",
      silentStreak: 0,
      misconceptionTag: "answer_only_without_rule",
    };
  }

  if (detectOffTaskNoise(text)) {
    return {
      status: "missing",
      confidence: 0.1,
      observation: `Child went off task instead of giving pattern evidence: ${text.slice(0, 120)}`,
      evidenceType: "self_explanation",
      selfExplained: false,
      rubricScore: 0.08,
      recognizedEvidenceKind: "empty_evidence",
      thinEvidenceType: "empty_evidence",
      repairRecommended: "attention_recovery",
      silentStreak: nextSilentStreak,
      misconceptionTag: "off_task_noise",
    };
  }

  if (
    fewShotHit?.recognizedEvidenceKind === "rule_statement" ||
    hasMixedAnswerAndRule ||
    hasRuleFragment ||
    isQuantityPattern ||
    isAttributePattern ||
    isSpacePattern
  ) {
    const confidence = fewShotHit ? confidenceToNumber(fewShotHit.confidence) : isSpacePattern ? 0.78 : 0.86;
    return {
      status: "filled",
      confidence,
      observation: hasMixedAnswerAndRule
        ? `Child gave the answer and the rule in one sentence: ${text.slice(0, 120)}`
        : `Child stated the pattern rule: ${text.slice(0, 120)}`,
      evidenceType: "rule_statement",
      selfExplained: true,
      rubricScore: confidence,
      recognizedEvidenceKind: "rule_statement",
      silentStreak: 0,
    };
  }

  if (fewShotHit?.recognizedEvidenceKind === "contrastive_rebuttal" || isContrastive) {
    const confidence = fewShotHit ? confidenceToNumber(fewShotHit.confidence) : 0.76;
    return {
      status: "filled",
      confidence,
      observation: `Child defended the answer by rejecting an alternative: ${text.slice(0, 120)}`,
      evidenceType: "contrastive_rebuttal",
      selfExplained: true,
      rubricScore: confidence,
      recognizedEvidenceKind: "contrastive_rebuttal",
      silentStreak: 0,
    };
  }

  if (isExplicitUnknown) {
    const thinEvidenceType = nextSilentStreak >= 2 ? "silent_or_blank_repeat" : "silent_or_blank_first";
    return {
      status: "low_confidence",
      confidence: 0.28,
      observation: `Child did not yet provide usable rule evidence: ${text.slice(0, 120)}`,
      evidenceType: "self_explanation",
      selfExplained: false,
      rubricScore: 0.2,
      recognizedEvidenceKind: "empty_evidence",
      thinEvidenceType,
      repairRecommended: nextSilentStreak >= 2 ? "sentence_frame" : "attention_recovery",
      silentStreak: nextSilentStreak,
      misconceptionTag: "reasoning_not_expressed",
    };
  }

  if (fewShotHit?.thinEvidenceType === "intuition_only" || isIntuitionOnly) {
    return {
      status: "low_confidence",
      confidence: fewShotHit ? confidenceToNumber(fewShotHit.confidence) : 0.4,
      observation: `Child relied on intuition without naming the rule: ${text.slice(0, 120)}`,
      evidenceType: "self_explanation",
      selfExplained: false,
      rubricScore: 0.35,
      thinEvidenceType: "intuition_only",
      recognizedEvidenceKind: "empty_evidence",
      repairRecommended: "contrastive_rebuttal",
      silentStreak: 0,
      misconceptionTag: "intuition_only",
    };
  }

  const quality = scoreTextQuality(text);
  return {
    status: quality >= 2 ? "low_confidence" : "missing",
    confidence: quality >= 2 ? 0.44 : 0.2,
    observation: quality >= 2
      ? `Child talked around the pattern but did not name the rule clearly: ${text.slice(0, 120)}`
      : `Child attempted to explain, but the reasoning signal was still too thin: ${text.slice(0, 120)}`,
    evidenceType: "self_explanation",
    selfExplained: false,
    rubricScore: quality >= 2 ? 0.42 : 0.2,
    thinEvidenceType: "energetic_but_unfocused",
    recognizedEvidenceKind: quality >= 2 ? "self_explanation" : "empty_evidence",
    repairRecommended: "feynman_teach_me",
    silentStreak: 0,
    misconceptionTag: "rule_not_named",
  };
}

function buildMissingDecision(slot: EvidenceSlot): EvidenceDecision {
  return {
    slot,
    status: "missing",
    source: "system_event",
    confidence: 0,
    observation: `Missing evidence for ${slot}.`,
    evidenceType: slot === "describe_observation"
      ? "describe_observation"
      : slot === "idea_improvement"
        ? "idea_improvement"
        : slot,
    isAutoInferred: true,
  };
}

function pickExplanationCandidate(events: ActivitySessionEventRow[]): string {
  for (const event of [...events].reverse()) {
    const payload = safeParsePayload<Record<string, unknown>>(event);
    const childInput = typeof payload?.childInput === "string"
      ? payload.childInput
      : typeof payload?.input === "string"
        ? payload.input
        : typeof payload?.rawEvidence === "string"
          ? payload.rawEvidence
          : "";
    if (childInput.trim()) return childInput.trim();
  }
  return "";
}

function buildDecisionForSlot(
  slot: EvidenceSlot,
  row: ActivitySessionRow,
  events: ActivitySessionEventRow[],
): EvidenceDecision {
  const candidateObservation = [...events]
    .filter((event) => event.event_type === "candidate_observation")
    .map((event) => safeParsePayload<Record<string, unknown>>(event))
    .find((payload) => {
      const evidenceType = payload?.evidence_type ?? payload?.evidenceType;
      const evidenceSlot = payload?.evidence_slot ?? payload?.evidenceSlot;
      return evidenceType === slot || evidenceSlot === slot;
    });

  const latestTurn = [...events]
    .filter((event) => event.event_type === "child_turn_submitted")
    .map((event) => safeParsePayload<Record<string, unknown>>(event))
    .find(Boolean);

  const childInput = typeof candidateObservation?.child_input === "string"
    ? candidateObservation.child_input
    : typeof candidateObservation?.childInput === "string"
      ? candidateObservation.childInput
      : typeof latestTurn?.input === "string"
        ? latestTurn.input
        : pickExplanationCandidate(events);

  const correctness = normalizeCorrectness(candidateObservation?.correctness) ??
    normalizeCorrectness(latestTurn?.correctness) ??
    "unknown";
  const hintCountRaw = Number(candidateObservation?.hint_count ?? candidateObservation?.hintCount ?? 0);
  const hintCount = Number.isFinite(hintCountRaw) ? hintCountRaw : 0;

  if (slot === "answer") {
    if (!childInput.trim()) return buildMissingDecision(slot);
    if (row.goal_id === "math-thinking" && row.sub_goal_id === "pattern-recognition") {
      const challengeSpec = readPatternRecognitionChallengeSpec(row);
      if (challengeSpec) {
        const evaluation = evaluatePatternRecognitionAnswer(childInput.trim(), challengeSpec);
        return {
          slot,
          status: "filled",
          source: row.activity_id.includes("voice") ? "child_voice_stt" : "child_text",
          confidence: evaluation.correctness === "correct" ? 0.86 : 0.78,
          observation: `Child answered the frozen challenge: ${childInput.trim().slice(0, 120)}`,
          correctness: evaluation.correctness,
          selfExplained: false,
          hintCount,
          rubricScore: evaluation.correctness === "correct" ? 0.82 : 0.2,
          evidenceType: "answer",
          rawEvidence: childInput.trim(),
          misconceptionTag: evaluation.correctness === "incorrect" ? "answer_mismatch" : undefined,
        };
      }
    }
    const answerIsPresent = childInput.trim().length > 0;
    const answerStatus: ObservationStatus =
      correctness === "unknown"
        ? (row.goal_id === "math-thinking" && row.sub_goal_id === "pattern-recognition" && answerIsPresent
          ? "filled"
          : "low_confidence")
        : "filled";

    return {
      slot,
      status: answerStatus,
      source: row.activity_id.includes("voice") ? "child_voice_stt" : "child_text",
      confidence: correctness === "unknown" ? (answerStatus === "filled" ? 0.62 : 0.45) : 0.72,
      observation: `Child answered: ${childInput.trim().slice(0, 120)}`,
      correctness,
      selfExplained: false,
      hintCount,
      rubricScore: correctness === "correct"
        ? 0.8
        : correctness === "partial"
          ? 0.55
          : correctness === "incorrect"
            ? 0.2
            : answerStatus === "filled"
              ? 0.58
              : 0.35,
      evidenceType: "answer",
      rawEvidence: childInput.trim(),
      misconceptionTag: correctness === "incorrect" ? "answer_mismatch" : undefined,
    };
  }

  if (slot === "self_explanation") {
    const explanationText = childInput.trim();
    if (row.goal_id === "math-thinking" && row.sub_goal_id === "pattern-recognition") {
      const patternDecision = detectPatternEvidence(explanationText, row);
      return {
        slot,
        status: patternDecision.status,
        source: "child_text",
        confidence: patternDecision.confidence,
        observation: patternDecision.observation,
        correctness,
        selfExplained: patternDecision.selfExplained,
        hintCount,
        rubricScore: patternDecision.rubricScore,
        evidenceType: patternDecision.evidenceType,
        rawEvidence: explanationText,
        misconceptionTag: patternDecision.misconceptionTag,
        thinEvidenceType: patternDecision.thinEvidenceType,
        recognizedEvidenceKind: patternDecision.recognizedEvidenceKind,
        repairRecommended: patternDecision.repairRecommended,
        silentStreak: patternDecision.silentStreak,
      };
    }

    if (!explanationText) return buildMissingDecision(slot);
    const quality = scoreTextQuality(explanationText);
    return {
      slot,
      status: quality >= 2 ? "filled" : "low_confidence",
      source: "child_text",
      confidence: quality >= 2 ? 0.72 : 0.38,
      observation: quality >= 2
        ? `Child explained the reasoning: ${explanationText.slice(0, 120)}`
        : `Child attempted an explanation, but it was too thin: ${explanationText.slice(0, 120)}`,
      correctness,
      selfExplained: quality >= 2,
      hintCount,
      rubricScore: quality / 3,
      evidenceType: "self_explanation",
      rawEvidence: explanationText,
      misconceptionTag: quality >= 2 ? undefined : "explanation_too_thin",
    };
  }

  if (slot === "strategy_prediction") {
    const prediction = childInput.trim();
    if (!prediction) return buildMissingDecision(slot);
    const quality = scoreTextQuality(prediction);
    return {
      slot,
      status: quality >= 2 ? "filled" : "low_confidence",
      source: "child_text",
      confidence: quality >= 2 ? 0.7 : 0.42,
      observation: quality >= 2
        ? `Child predicted a move or consequence: ${prediction.slice(0, 120)}`
        : `Prediction evidence was too short: ${prediction.slice(0, 120)}`,
      correctness,
      selfExplained: quality >= 2,
      hintCount,
      rubricScore: quality / 3,
      evidenceType: "strategy_prediction",
      rawEvidence: prediction,
      misconceptionTag: quality >= 2 ? undefined : "prediction_too_thin",
    };
  }

  if (slot === "describe_observation") {
    const observationText = childInput.trim();
    if (!observationText) return buildMissingDecision(slot);
    const quality = scoreTextQuality(observationText);
    return {
      slot,
      status: quality >= 2 ? "filled" : "low_confidence",
      source: "child_text",
      confidence: quality >= 2 ? 0.68 : 0.4,
      observation: quality >= 2
        ? `Child described what was noticed: ${observationText.slice(0, 120)}`
        : `Observation description was too thin: ${observationText.slice(0, 120)}`,
      correctness,
      selfExplained: quality >= 2,
      hintCount,
      rubricScore: quality / 3,
      evidenceType: "describe_observation",
      rawEvidence: observationText,
      misconceptionTag: quality >= 2 ? undefined : "observation_too_thin",
    };
  }

  if (slot === "idea_improvement") {
    const ideaText = childInput.trim();
    if (!ideaText) return buildMissingDecision(slot);
    const quality = scoreTextQuality(ideaText);
    return {
      slot,
      status: quality >= 2 ? "filled" : "low_confidence",
      source: "child_text",
      confidence: quality >= 2 ? 0.66 : 0.4,
      observation: quality >= 2
        ? `Child improved or compared an idea: ${ideaText.slice(0, 120)}`
        : `Idea-improvement evidence was too thin: ${ideaText.slice(0, 120)}`,
      correctness: "unknown",
      selfExplained: quality >= 2,
      hintCount,
      rubricScore: quality / 3,
      evidenceType: "idea_improvement",
      rawEvidence: ideaText,
      misconceptionTag: quality >= 2 ? undefined : "no_revision_signal",
    };
  }

  if (slot === "transfer_check") {
    const transferText = childInput.trim();
    if (!transferText) return buildMissingDecision(slot);
    const quality = scoreTextQuality(transferText);
    return {
      slot,
      status: quality >= 2 ? "filled" : "low_confidence",
      source: "child_text",
      confidence: quality >= 2 ? 0.67 : 0.4,
      observation: quality >= 2
        ? `Child attempted to transfer the rule: ${transferText.slice(0, 120)}`
        : `Transfer evidence was too thin: ${transferText.slice(0, 120)}`,
      correctness,
      selfExplained: quality >= 2,
      hintCount,
      rubricScore: quality / 3,
      evidenceType: "transfer_check",
      rawEvidence: transferText,
      misconceptionTag: quality >= 2 ? undefined : "transfer_not_clear",
    };
  }

  const hasEndActivity = events.some((event) => event.event_type === "activity_completed");
  if (!hasEndActivity) {
    return buildMissingDecision(slot);
  }

  return {
    slot,
    status: "auto_inferred",
    source: "system_event",
    confidence: 0.4,
    observation: `Activity reached a wrap-up point for ${slot}.`,
    correctness,
    selfExplained: false,
    hintCount,
    rubricScore: 0.4,
    evidenceType: "activity_summary",
    rawEvidence: "",
    isAutoInferred: true,
  };
}

function deriveActivityStatus(
  requiredSlots: EvidenceSlot[],
  decisions: EvidenceDecision[],
  explicitAbandoned: boolean,
): ActivitySessionStatus {
  if (explicitAbandoned) return "abandoned";

  const answer = decisions.find((decision) => decision.slot === "answer" || decision.slot === "strategy_prediction");
  const hasIncorrect = decisions.some((decision) => decision.correctness === "incorrect");
  const substantiveDecisions = decisions.filter((decision) => decision.slot !== "activity_summary");
  const missing = substantiveDecisions.filter((decision) => decision.status === "missing");
  const lowConfidence = substantiveDecisions.filter((decision) => decision.status === "low_confidence");
  const explanationRequired = requiredSlots.includes("self_explanation");
  const explanationDecision = decisions.find((decision) => decision.slot === "self_explanation");

  if (hasIncorrect) return "not_yet_mastered";
  if (missing.length === 0 && lowConfidence.length === 0 && answer?.correctness !== "incorrect") {
    return "passed_complete";
  }
  if (
    answer &&
    (answer.correctness === "correct" || answer.correctness === "partial" || answer.correctness === "unknown") &&
    explanationRequired &&
    explanationDecision &&
    explanationDecision.status !== "filled"
  ) {
    return "passed_evidence_thin";
  }
  if (missing.length < requiredSlots.length && answer) {
    return "passed_evidence_thin";
  }
  return "not_yet_mastered";
}

function uniqueSlots(decisions: EvidenceDecision[], acceptedStatuses: ObservationStatus[]): EvidenceSlot[] {
  return [...new Set(
    decisions
      .filter((decision) => acceptedStatuses.includes(decision.status))
      .map((decision) => decision.slot),
  )];
}

function eventId(prefix: string, activitySessionId: string, index: number): string {
  return `${prefix}-${activitySessionId}-${index}`;
}

export function evaluateActivitySession(row: ActivitySessionRow): ActivitySessionStatus {
  if (row.scoring_mode !== "formal_scored") {
    updateActivitySessionRuntime(row.id, {
      evaluatorStatus: "evaluated",
    });
    return row.status;
  }

  const events = getActivitySessionEvents(row.id);
  const activity = getActivity(row.activity_id);
  const playbook = getSubGoalPlaybook(row.sub_goal_id);
  const requiredSlots = activity?.requiredEvidenceSlots ?? playbook.evidenceRubric.requiredEvidenceSlots;
  const decisions = requiredSlots.map((slot) => buildDecisionForSlot(slot, row, events));
  const explicitAbandoned = events.some((event) => event.event_type === "activity_abandoned");
  const status = deriveActivityStatus(requiredSlots, decisions, explicitAbandoned);
  const completedSlots = uniqueSlots(decisions, ["filled", "auto_inferred"]);
  const missingSlots = uniqueSlots(decisions, ["missing", "low_confidence"]);
  const latestDifficulty = [...events]
    .map((event) => safeParsePayload<Record<string, unknown>>(event))
    .map((payload) => normalizeDifficulty(payload?.difficultyLevel ?? payload?.difficulty_level))
    .find(Boolean);
  const hintCount = Math.max(
    0,
    ...events
      .map((event) => safeParsePayload<Record<string, unknown>>(event))
      .map((payload) => Number(payload?.hintCount ?? payload?.hint_count ?? 0))
      .filter((value) => Number.isFinite(value)),
  );
  const evidenceThinCount = status === "passed_evidence_thin" ? row.evidence_thin_count + 1 : row.evidence_thin_count;
  const meaningfulFilledSlots = decisions.filter(
    (decision) => decision.status === "filled" && decision.slot !== "activity_summary",
  );
  const emptyEvidenceStreak = meaningfulFilledSlots.length === 0
    ? row.empty_evidence_streak + 1
    : 0;
  const explanationDecision = decisions.find((decision) => decision.slot === "self_explanation");
  const thinEvidenceType = explanationDecision?.thinEvidenceType;
  const repairRecommended = explanationDecision?.repairRecommended;
  const silentStreak = explanationDecision?.silentStreak ?? 0;
  const recognizedEvidenceKind = explanationDecision?.recognizedEvidenceKind;
  const injectedFewShotProfile = row.goal_id === "math-thinking" && row.sub_goal_id === "pattern-recognition"
    ? PATTERN_RECOGNITION_FEW_SHOT_PROFILE
    : undefined;

  deleteObservationsByActivitySession(row.id);

  decisions.forEach((decision) => {
    insertObservation({
      profile_id: row.profile_id,
      session_id: row.session_id,
      skill: row.sub_goal_id,
      sub_goal_id: row.sub_goal_id,
      goal_id: row.goal_id,
      observation: decision.observation,
      confidence: decision.confidence,
      difficulty_level: latestDifficulty ?? "L1",
      hint_count: decision.hintCount ?? hintCount,
      self_explained: decision.selfExplained ? 1 : 0,
      correctness: decision.correctness,
      task_id: row.activity_id,
      activity_id: row.activity_id,
      evidence_type: decision.evidenceType,
      evidence_json: JSON.stringify({
        child_input: decision.rawEvidence,
        raw_evidence: decision.rawEvidence,
        hint_used: (decision.hintCount ?? hintCount) > 0,
        evidence_type: decision.evidenceType,
        thin_evidence_type: decision.thinEvidenceType,
        recognized_evidence_kind: decision.recognizedEvidenceKind,
        repair_recommended: decision.repairRecommended,
        silent_streak: decision.silentStreak,
        few_shot_profile: injectedFewShotProfile,
      }),
      turn_index: events.at(-1)?.turn_index,
      activity_session_id: row.id,
      evidence_slot: decision.slot,
      source: decision.source,
      status: decision.status,
      misconception_tag: decision.misconceptionTag,
      rubric_score: decision.rubricScore,
      is_required: 1,
      is_auto_inferred: decision.isAutoInferred ? 1 : 0,
      activity_status: status,
      scoring_mode: row.scoring_mode,
      thin_evidence_type: decision.thinEvidenceType,
      recognized_evidence_kind: decision.recognizedEvidenceKind,
      repair_recommended: decision.repairRecommended,
      silent_streak: decision.silentStreak,
    });
  });

  insertObservation({
    profile_id: row.profile_id,
    session_id: row.session_id,
    skill: row.sub_goal_id,
    sub_goal_id: row.sub_goal_id,
    goal_id: row.goal_id,
    observation: status === "passed_complete"
      ? "Activity completed with enough evidence."
      : status === "passed_evidence_thin"
        ? "Activity result passed, but explanation evidence is still thin."
        : status === "abandoned"
          ? "Activity was abandoned before enough evidence was collected."
          : "Activity still needs more evidence before mastery can advance.",
    confidence: status === "passed_complete" ? 0.8 : 0.55,
    difficulty_level: latestDifficulty ?? "L1",
    hint_count: hintCount,
    self_explained: completedSlots.includes("self_explanation") ? 1 : 0,
    correctness: decisions.find((decision) => decision.slot === "answer" || decision.slot === "strategy_prediction")?.correctness ?? "unknown",
    task_id: row.activity_id,
    activity_id: row.activity_id,
    evidence_type: "activity_summary",
    evidence_json: JSON.stringify({
      raw_evidence: decisions.map((decision) => `${decision.slot}:${decision.status}`).join(","),
      evidence_type: "activity_summary",
      thin_evidence_type: thinEvidenceType,
      recognized_evidence_kind: recognizedEvidenceKind,
      repair_recommended: repairRecommended,
      silent_streak: silentStreak,
      few_shot_profile: injectedFewShotProfile,
    }),
    turn_index: events.at(-1)?.turn_index,
    activity_session_id: row.id,
    evidence_slot: "activity_summary",
    source: "evaluator_inferred",
    status: status === "passed_complete" ? "filled" : status === "passed_evidence_thin" ? "low_confidence" : "auto_inferred",
    rubric_score: status === "passed_complete" ? 0.85 : status === "passed_evidence_thin" ? 0.55 : 0.35,
    is_required: 1,
    is_auto_inferred: 1,
    activity_status: status,
    scoring_mode: row.scoring_mode,
    thin_evidence_type: thinEvidenceType,
    recognized_evidence_kind: recognizedEvidenceKind,
    repair_recommended: repairRecommended,
    silent_streak: silentStreak,
  });

  updateActivitySessionEvaluation(row.id, {
    status,
    completedEvidenceSlots: completedSlots,
    missingEvidenceSlots: missingSlots,
    latestDifficultyLevel: latestDifficulty ?? "L1",
    hintCount,
    evidenceThinCount,
    emptyEvidenceStreak,
    thinEvidenceType,
    repairStrategy: repairRecommended,
    handoffTemplate: repairRecommended
      ? getSubGoalPlaybook(row.sub_goal_id).handoffPrompts?.[repairRecommended]?.[0]
      : undefined,
    silentStreak,
    recognizedEvidenceKind,
    completedAt: status === "in_progress" ? undefined : new Date().toISOString(),
  });

  return status;
}

export function evaluatePendingActivitySessions(options: {
  profileId?: string;
  sessionId?: string;
  limit?: number;
} = {}): number {
  const rows = getPendingActivitySessions(options);
  rows.forEach((row) => evaluateActivitySession(row));
  return rows.length;
}

export function cleanupIdleActivitySessions(options: {
  profileId?: string;
  limit?: number;
} = {}): number {
  const rows = getIdleActivitySessions(options);
  rows.forEach((row) => deleteActivitySessionCascade(row.id));
  return rows.length;
}

export function logInteractionEvent(input: {
  activitySessionId: string;
  sessionId: string;
  turnIndex?: number;
  eventType: string;
  source?: string;
  scoringMode?: "formal_scored" | "experimental_unscored";
  payload: Record<string, unknown>;
}) {
  appendActivitySessionEvent({
    id: eventId(input.eventType, input.activitySessionId, Date.now()),
    activitySessionId: input.activitySessionId,
    sessionId: input.sessionId,
    turnIndex: input.turnIndex,
    eventType: input.eventType,
    source: input.source ?? "interaction_agent",
    scoringMode: input.scoringMode,
    payload: input.payload,
  });
}

export function summarizeActivitySession(row: ActivitySessionRow) {
  return toActivitySessionSummary(row);
}
