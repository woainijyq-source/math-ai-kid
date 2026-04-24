import assert from "node:assert/strict";
import {
  appendActivitySessionEvent,
  db,
  deleteActivitySessionCascade,
  getActivitySession,
  getRecentObservationSummaries,
  updateActivitySessionRuntime,
  upsertActivitySession,
} from "../lib/data/db";
import { evaluateActivitySession } from "../lib/training/evaluator-agent";
import { buildMasteryProfile } from "../lib/training/mastery-engine";
import {
  buildPatternRecognitionActivityRuntime,
  ensurePatternRecognitionChallengeSpec,
} from "../lib/training/pattern-activity-runtime";
import { buildPromptAssembly } from "../lib/training/prompt-builder";
import type { AgentTurnRequest } from "../types/agent";
import type { ChildProfile, ScoringMode } from "../types/goals";
import type { TrainingIntent } from "../lib/training/training-intent";

const profile: ChildProfile = {
  id: "stage2-pattern-profile",
  nickname: "TestKid",
  birthday: "2018-01-01",
  goalPreferences: ["math-thinking"],
};

const createdSessionIds: string[] = [];

function createFormalSession(
  suffix: string,
  scoringMode: ScoringMode = "formal_scored",
) {
  const sessionId = `stage2-session-${suffix}`;
  const activitySessionId = `stage2-activity-${suffix}`;
  createdSessionIds.push(activitySessionId);

  upsertActivitySession({
    id: activitySessionId,
    sessionId,
    profileId: profile.id,
    goalId: "math-thinking",
    subGoalId: "pattern-recognition",
    activityId: "number-pattern-hunt",
    scoringMode,
    requiredEvidenceSlots: ["answer", "self_explanation", "activity_summary"],
    latestDifficultyLevel: "L1",
  });

  return { sessionId, activitySessionId };
}

async function createFrozenPatternSession(
  suffix: string,
  options?: {
    birthday?: string;
    difficultyLevel?: "L1" | "L2" | "L3" | "L4";
  },
) {
  const { activitySessionId } = createFormalSession(suffix);
  const resolution = await ensurePatternRecognitionChallengeSpec({
    activitySessionId,
    birthday: options?.birthday ?? profile.birthday,
    difficultyLevel: options?.difficultyLevel,
  });

  return {
    activitySessionId,
    spec: resolution.spec,
  };
}

function addTurnEvent(
  activitySessionId: string,
  sessionId: string,
  turnIndex: number,
  input: string,
  scoringMode: ScoringMode = "formal_scored",
) {
  appendActivitySessionEvent({
    id: `child-turn-${activitySessionId}-${turnIndex}-${Date.now()}`,
    activitySessionId,
    sessionId,
    turnIndex,
    eventType: "child_turn_submitted",
    source: "interaction_agent",
    scoringMode,
    payload: {
      input,
      inputType: "text",
      goalId: "math-thinking",
      subGoalId: "pattern-recognition",
      activityId: "number-pattern-hunt",
      expectedEvidence: ["answer", "self_explanation", "activity_summary"],
    },
  });
}

function getSessionObservations(activitySessionId: string) {
  return getRecentObservationSummaries(profile.id, {
    limit: 500,
    scoringMode: "formal_scored",
  }).filter((observation) => observation.activitySessionId === activitySessionId);
}

function getExplanationObservation(activitySessionId: string) {
  return getSessionObservations(activitySessionId).find(
    (observation) => observation.evidenceSlot === "self_explanation",
  );
}

function getSummaryObservation(activitySessionId: string) {
  return getSessionObservations(activitySessionId).find(
    (observation) => observation.evidenceSlot === "activity_summary",
  );
}

function evaluateInput(
  suffix: string,
  input: string,
  options?: {
    scoringMode?: ScoringMode;
    silentStreak?: number;
  },
) {
  const { sessionId, activitySessionId } = createFormalSession(
    suffix,
    options?.scoringMode ?? "formal_scored",
  );

  if (options?.silentStreak !== undefined) {
    updateActivitySessionRuntime(activitySessionId, {
      silentStreak: options.silentStreak,
    });
  }

  addTurnEvent(activitySessionId, sessionId, 1, input, options?.scoringMode ?? "formal_scored");

  const row = getActivitySession(activitySessionId)!;
  const status = evaluateActivitySession(row);

  return {
    status,
    activitySessionId,
    explanation: getExplanationObservation(activitySessionId),
    summary: getSummaryObservation(activitySessionId),
  };
}

function buildIntent(partial: Partial<TrainingIntent>): TrainingIntent {
  return {
    goalId: "math-thinking",
    subGoalId: "pattern-recognition",
    scoringMode: "formal_scored",
    difficultyLevel: "L1",
    pedagogyModel: "mastery-learning+cpa",
    teachingMove: "ask_to_explain",
    expectedEvidence: ["answer", "self_explanation", "activity_summary"],
    evidenceSlotTarget: "self_explanation",
    allowedActivityScope: ["number-pattern-hunt"],
    activityId: "number-pattern-hunt",
    masteryStage: "practicing",
    nextAction: "repair_evidence",
    reason: "test",
    trainingFocus: "test focus",
    commonMistakes: ["只给答案，不说规律。"],
    hintLadder: [
      { level: 1, label: "先看哪里在变", guidance: "先盯住局部变化。" },
      { level: 2, label: "并排看两步", guidance: "比较前后两步发生了什么变化。" },
      { level: 3, label: "在两个规则里选", guidance: "通过对比错误选项说出规则。" },
    ],
    allowedTeachingMoves: ["probe", "hint", "contrast", "ask_to_explain", "wrap_up"],
    nextIfMastered: "transfer",
    nextIfStuck: "repair",
    ageBand: "younger_kid",
    ageInteractionRules: ["Keep the tone clear, playful, and age-appropriate."],
    ...partial,
  };
}

function assertPromptState(
  suffix: string,
  input: string,
  contextPatch: Partial<Parameters<typeof buildPromptAssembly>[1]> & {
    runtimePatch?: Parameters<typeof updateActivitySessionRuntime>[1];
  },
) {
  const { sessionId, activitySessionId } = createFormalSession(suffix);
  if (contextPatch.runtimePatch) {
    updateActivitySessionRuntime(activitySessionId, contextPatch.runtimePatch);
  }

  const context = {
    profile,
    goalFocus: ["math-thinking"],
    turnIndex: 1,
    currentActivity: "Current activity: pattern recognition.",
    currentActivityId: "number-pattern-hunt",
    activitySessionId,
    currentGoalId: "math-thinking",
    currentSubGoalId: "pattern-recognition",
    scoringMode: "formal_scored" as const,
    trainingIntent: buildIntent({}),
    ...contextPatch,
  };

  delete (context as { runtimePatch?: unknown }).runtimePatch;

  const childInput: AgentTurnRequest = {
    sessionId,
    input,
    inputType: "text",
  };

  return buildPromptAssembly(childInput, context);
}

async function main() {
  try {
    const evaluatorCases = [
      ["每次多三个", "rule_statement", "passed_complete"],
      ["红的黄的红的黄的", "rule_statement", "passed_complete"],
      ["转面了", "rule_statement", "passed_complete"],
      ["放蓝的就不一样了，跟前面不一样", "contrastive_rebuttal", "passed_complete"],
      ["下一个是红色，因为前面是红黄红黄", "rule_statement", "passed_complete"],
      ["越来越小", "rule_statement", "passed_complete"],
      ["方块圆圈方块圆圈", "rule_statement", "passed_complete"],
      ["那个不对，少了", "contrastive_rebuttal", "passed_complete"],
      ["倒过来了", "rule_statement", "passed_complete"],
      ["每次加四", "rule_statement", "passed_complete"],
      ["因为放黄色就跟前面不一样了", "contrastive_rebuttal", "passed_complete"],
      ["每次都在变大", "rule_statement", "passed_complete"],
    ] as const;

    let passedThinCount = 0;
    let passCount = 0;

    evaluatorCases.forEach(([input, expectedKind, expectedStatus], index) => {
      const result = evaluateInput(`eval-${index}`, input);
      assert.equal(result.explanation?.recognizedEvidenceKind, expectedKind);
      assert.equal(result.status, expectedStatus);
      passCount += 1;
    });

    const intuition = evaluateInput("intuition", "感觉对");
    assert.equal(intuition.explanation?.thinEvidenceType, "intuition_only");
    assert.equal(intuition.explanation?.repairRecommended, "contrastive_rebuttal");
    assert.equal(intuition.status, "passed_evidence_thin");
    passCount += 1;
    passedThinCount += 1;

    const answerOnly = evaluateInput("answer-only", "10");
    assert.equal(answerOnly.explanation?.thinEvidenceType, "energetic_but_unfocused");
    assert.equal(answerOnly.explanation?.repairRecommended, "feynman_teach_me");
    assert.equal(answerOnly.status, "passed_evidence_thin");
    passCount += 1;
    passedThinCount += 1;

    const firstSilent = evaluateInput("silent-1", "");
    assert.equal(firstSilent.explanation?.thinEvidenceType, "silent_or_blank_first");
    assert.equal(firstSilent.explanation?.repairRecommended, "attention_recovery");

    const secondSilent = evaluateInput("silent-2", "", { silentStreak: 1 });
    assert.equal(secondSilent.explanation?.thinEvidenceType, "silent_or_blank_repeat");
    assert.equal(secondSilent.explanation?.repairRecommended, "sentence_frame");

    const offTask = evaluateInput("off-task", "我想看动画片");
    assert.equal(offTask.explanation?.recognizedEvidenceKind, "empty_evidence");
    assert.equal(offTask.explanation?.repairRecommended, "attention_recovery");

    const coldStart = assertPromptState("cold-start", "你好", {
      turnIndex: 0,
      trainingIntent: buildIntent({
        nextAction: "repair_evidence",
        thinEvidenceType: "intuition_only",
        repairStrategy: "contrastive_rebuttal",
      }),
    });
    assert.equal(coldStart.runtime.assemblyState, "initial_probe");
    assert.equal(coldStart.runtime.isColdStart, true);

    const evidenceRepair = assertPromptState("repair-intuition", "继续吧", {
      trainingIntent: buildIntent({
        thinEvidenceType: "intuition_only",
        repairStrategy: "contrastive_rebuttal",
        handoffTemplate: "说到刚才那一题，你选了 8，那为什么不能是 7 呢？",
      }),
      runtimePatch: {
        thinEvidenceType: "intuition_only",
        repairStrategy: "contrastive_rebuttal",
        handoffTemplate: "说到刚才那一题，你选了 8，那为什么不能是 7 呢？",
      },
    });
    assert.equal(evidenceRepair.runtime.assemblyState, "evidence_repair");
    assert.equal(evidenceRepair.effectiveTrainingIntent?.repairStrategy, "contrastive_rebuttal");
    assert.match(evidenceRepair.effectiveTrainingIntent?.handoffTemplate ?? "", /说到刚才那一题|欢迎回来/);

    const { activitySessionId: expiredSessionId } = createFormalSession("handoff-expired");
    updateActivitySessionRuntime(expiredSessionId, {
      thinEvidenceType: "intuition_only",
      repairStrategy: "contrastive_rebuttal",
      handoffTemplate: "说到刚才那一题，你选了 8，那为什么不能是 7 呢？",
    });
    db.prepare("UPDATE activity_sessions SET updated_at = ? WHERE id = ?").run(
      new Date(Date.now() - 16 * 60_000).toISOString(),
      expiredSessionId,
    );
    const expiredPrompt = buildPromptAssembly(
      { sessionId: "stage2-session-handoff-expired", input: "继续", inputType: "text" },
      {
        profile,
        goalFocus: ["math-thinking"],
        turnIndex: 1,
        currentActivity: "Current activity: pattern recognition.",
        currentActivityId: "number-pattern-hunt",
        activitySessionId: expiredSessionId,
        currentGoalId: "math-thinking",
        currentSubGoalId: "pattern-recognition",
        scoringMode: "formal_scored",
        trainingIntent: buildIntent({
          thinEvidenceType: "intuition_only",
          repairStrategy: "contrastive_rebuttal",
          handoffTemplate: "说到刚才那一题，你选了 8，那为什么不能是 7 呢？",
        }),
      },
    );
    assert.equal(expiredPrompt.runtime.handoffExpired, true);
    assert.match(expiredPrompt.effectiveTrainingIntent?.handoffTemplate ?? "", /欢迎回来/);

    const experimentalPrompt = buildPromptAssembly(
      { sessionId: "stage2-session-experimental", input: "我想聊天", inputType: "text" },
      {
        profile,
        goalFocus: ["creative-thinking"],
        turnIndex: 1,
        currentActivity: "Current activity: free chat.",
        currentActivityId: "many-ways-there",
        activitySessionId: undefined,
        currentGoalId: "creative-thinking",
        currentSubGoalId: "divergent-thinking",
        scoringMode: "experimental_unscored",
      },
    );
    assert.equal(experimentalPrompt.runtime.assemblyState, "experimental_chat");

    const authoredSession = await createFrozenPatternSession("authored-card", {
      birthday: "2018-01-01",
      difficultyLevel: "L2",
    });
    const authoredActivity = buildPatternRecognitionActivityRuntime({
      activitySessionId: authoredSession.activitySessionId,
      challengeSpec: authoredSession.spec,
      difficultyLevel: "L2",
      birthday: "2018-01-01",
      assemblyState: "initial_probe",
    });
    assert.ok(authoredActivity.challengeSpec);
    assert.match(authoredActivity.activityText, /session 唯一事实源/i);
    assert.match(authoredActivity.activityText, /正确答案：/);

    const age7Profile = buildMasteryProfile("age7", [], "math-thinking", "2018-01-01");
    assert.equal(age7Profile.states["pattern-recognition"]?.recommendedDifficulty, "L2");

    const age10Profile = buildMasteryProfile("age10", [], "math-thinking", "2016-01-01");
    assert.equal(age10Profile.states["pattern-recognition"]?.recommendedDifficulty, "L3");

    const age11Session = await createFrozenPatternSession("authored-card-11", {
      birthday: "2014-01-01",
    });
    const age11Card = buildPatternRecognitionActivityRuntime({
      activitySessionId: age11Session.activitySessionId,
      challengeSpec: age11Session.spec,
      birthday: "2014-01-01",
      assemblyState: "initial_probe",
    });
    assert.equal(age11Card.challengeSpec?.difficultyLevel, "L4");

    const { activitySessionId: breakerId, sessionId: breakerSessionId } = createFormalSession("breaker");
    updateActivitySessionRuntime(breakerId, { redirectCount: 2, noiseTurnCount: 2 });
    const breakerPrompt = buildPromptAssembly(
      { sessionId: breakerSessionId, input: "我不想做数学，我想唱歌", inputType: "text" },
      {
        profile,
        goalFocus: ["math-thinking"],
        turnIndex: 3,
        currentActivity: "Current activity: pattern recognition.",
        currentActivityId: "number-pattern-hunt",
        activitySessionId: breakerId,
        currentGoalId: "math-thinking",
        currentSubGoalId: "pattern-recognition",
        scoringMode: "formal_scored",
        trainingIntent: buildIntent({}),
      },
    );
    assert.equal(breakerPrompt.runtime.assemblyState, "force_abandon");
    assert.equal(breakerPrompt.runtime.circuitBreakerTriggered, true);

    const thinRatio = passedThinCount / passCount;
    assert.ok(thinRatio < 0.15, `passed_evidence_thin ratio too high: ${thinRatio}`);

    console.log("stage2 pattern-recognition checks passed");
    console.log(JSON.stringify({
      passCount,
      passedThinCount,
      thinRatio,
      checkedCases: 27,
    }, null, 2));
  } finally {
    for (const activitySessionId of createdSessionIds) {
      deleteActivitySessionCascade(activitySessionId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
