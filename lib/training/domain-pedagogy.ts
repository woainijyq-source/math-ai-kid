import { ALL_ACTIVITIES } from "@/content/activities/activity-templates";
import { GOAL_MAP, TRAINING_GOALS } from "@/content/goals/goal-tree";
import { SUBGOAL_PLAYBOOKS as AUTHORED_PILOT_PLAYBOOKS } from "@/content/goals/subgoal-playbooks";
import type {
  DomainPedagogyConfig,
  EvidenceSlot,
  GoalId,
  ScoringMode,
  SubGoalPlaybook,
} from "@/types/goals";

const DOMAIN_PEDAGOGY_CONFIGS: Record<GoalId, DomainPedagogyConfig> = {
  "math-thinking": {
    goalId: "math-thinking",
    methodologyModel: "mastery-learning+cpa",
    readiness: "pilot",
    reportNarrativeStyle: "warm_coach",
    coreTeachingMoves: ["probe", "hint", "contrast", "ask_to_explain", "ask_to_predict", "transfer_check", "wrap_up"],
    requiredEvidenceSlots: ["answer", "self_explanation", "activity_summary"],
    defaultScaffoldLadder: [
      { level: 1, label: "Look again", guidance: "Point the child back to the changing quantities, pattern, or shape relation." },
      { level: 2, label: "Compare two cases", guidance: "Show two local examples side by side and ask what changed." },
      { level: 3, label: "Narrow the choices", guidance: "Offer two candidate rules or moves and ask which one fits better." },
    ],
    masteryPromotionRules: [
      "Two complete passes with explanation and low hint usage allow difficulty increase.",
      "Answer-only success stays in practice until explanation evidence is repaired.",
    ],
    evidenceThinFallback: "Switch to a lower-pressure explanation task before increasing difficulty.",
  },
  "logical-reasoning": {
    goalId: "logical-reasoning",
    methodologyModel: "explicit-reasoning+think-aloud",
    readiness: "building",
    reportNarrativeStyle: "warm_coach",
    coreTeachingMoves: ["probe", "hint", "contrast", "ask_to_explain", "ask_to_predict", "wrap_up"],
    requiredEvidenceSlots: ["answer", "self_explanation", "activity_summary"],
    defaultScaffoldLadder: [
      { level: 1, label: "Restate conditions", guidance: "Restate the known clues one by one before asking for the answer." },
      { level: 2, label: "Eliminate one option", guidance: "Ask which option can be ruled out first and why." },
      { level: 3, label: "Complete the chain", guidance: "Give the first step in the reasoning chain and ask the child to finish it." },
    ],
    masteryPromotionRules: [
      "Promotion requires both correct conclusion and visible elimination or chain explanation.",
      "Guessing without explanation triggers evidence repair, not advancement.",
    ],
    evidenceThinFallback: "Convert the next task into an explain-why or eliminate-why variant.",
  },
  "creative-thinking": {
    goalId: "creative-thinking",
    methodologyModel: "oecd-creative-thinking+design-thinking",
    readiness: "building",
    reportNarrativeStyle: "playful",
    coreTeachingMoves: ["probe", "contrast", "ask_to_explain", "ask_to_improve", "wrap_up"],
    requiredEvidenceSlots: ["answer", "idea_improvement", "activity_summary"],
    defaultScaffoldLadder: [
      { level: 1, label: "Generate more", guidance: "Ask for one more different idea before judging quality." },
      { level: 2, label: "Compare ideas", guidance: "Compare two ideas on fun, fairness, or usefulness." },
      { level: 3, label: "Improve one idea", guidance: "Choose one idea and improve it with one clear constraint." },
    ],
    masteryPromotionRules: [
      "Promotion requires both idea generation and idea revision, not just one-off novelty.",
      "If ideas repeat with no refinement, keep the difficulty stable.",
    ],
    evidenceThinFallback: "Use a lighter compare-and-improve task instead of asking for more novelty.",
  },
  "language-thinking": {
    goalId: "language-thinking",
    methodologyModel: "dialogic-reading+reciprocal-teaching",
    readiness: "building",
    reportNarrativeStyle: "warm_coach",
    coreTeachingMoves: ["probe", "hint", "ask_to_explain", "ask_to_predict", "wrap_up"],
    requiredEvidenceSlots: ["answer", "self_explanation", "describe_observation"],
    defaultScaffoldLadder: [
      { level: 1, label: "Say it in one sentence", guidance: "Ask for one complete sentence first." },
      { level: 2, label: "Add because", guidance: "Prompt the child to add a reason with because." },
      { level: 3, label: "Rephrase clearly", guidance: "Offer a partial sentence frame and let the child complete it." },
    ],
    masteryPromotionRules: [
      "Promotion requires clearer expression, not only correct content.",
      "Thin answers move to a guided restatement round before advancement.",
    ],
    evidenceThinFallback: "Use a sentence-frame or rephrase task to repair expression evidence.",
  },
  "strategy-thinking": {
    goalId: "strategy-thinking",
    methodologyModel: "metacognition+self-regulation",
    readiness: "building",
    reportNarrativeStyle: "warm_coach",
    coreTeachingMoves: ["probe", "contrast", "ask_to_predict", "ask_to_explain", "transfer_check", "wrap_up"],
    requiredEvidenceSlots: ["strategy_prediction", "self_explanation", "activity_summary"],
    defaultScaffoldLadder: [
      { level: 1, label: "Predict one move", guidance: "Ask what happens after one move." },
      { level: 2, label: "Compare two plans", guidance: "Compare two options and their likely outcomes." },
      { level: 3, label: "Review the failure", guidance: "Use the last failed plan to explain what to avoid next." },
    ],
    masteryPromotionRules: [
      "Promotion requires prediction plus explanation, not only a lucky winning move.",
      "Repeated guess-and-check keeps the child in practice.",
    ],
    evidenceThinFallback: "Switch to a shorter predict-then-review round.",
  },
  "observation-induction": {
    goalId: "observation-induction",
    methodologyModel: "visible-thinking+claim-evidence-reasoning",
    readiness: "building",
    reportNarrativeStyle: "warm_coach",
    coreTeachingMoves: ["probe", "hint", "contrast", "ask_to_explain", "transfer_check", "wrap_up"],
    requiredEvidenceSlots: ["describe_observation", "self_explanation", "transfer_check"],
    defaultScaffoldLadder: [
      { level: 1, label: "Notice more", guidance: "Ask the child to name what they see before naming the rule." },
      { level: 2, label: "Group evidence", guidance: "Ask which items belong together and why." },
      { level: 3, label: "Test the rule", guidance: "Offer a possible exception and ask if the rule still works." },
    ],
    masteryPromotionRules: [
      "Promotion requires both observation detail and a transferable rule.",
      "A guessed rule without evidence stays in practice.",
    ],
    evidenceThinFallback: "Return to observation and grouping before asking for a broader rule.",
  },
};

const SUBGOAL_ACTIVITY_OVERRIDES: Record<string, string[]> = {
  "pattern-recognition": ["number-pattern-hunt"],
  "quantity-comparison": ["marble-compare"],
  "strategy-planning": ["strategy-nim"],
  "spatial-reasoning": ["shape-spy"],
  "conditional-thinking": ["if-then-chain"],
  "elimination-method": ["who-is-lying"],
  "multi-step-reasoning": ["logic-ladder"],
  "rule-creation": ["rule-inventor"],
  "divergent-thinking": ["many-ways-there"],
  "hypothetical-thinking": ["what-if-world"],
  "explain-reasoning": ["explain-it"],
  "describe-observation": ["describe-the-scene"],
  "opponent-modeling": ["predict-the-move"],
  "optimal-strategy": ["best-move-lab"],
  "risk-assessment": ["safe-or-risky"],
  "systematic-observation": ["detail-detective"],
  "inductive-generalization": ["spot-the-rule"],
  "analogy-transfer": ["same-shape-new-world"],
};

const SUBGOAL_FOLLOW_UPS: Record<string, string[]> = {
  "pattern-recognition": ["Ask what changes each step.", "Ask which wrong option almost works and why."],
  "quantity-comparison": ["Ask how many more or fewer.", "Ask what changes after adding or taking away one."],
  "strategy-planning": ["Ask what happens next.", "Ask which move is safer and why."],
  "spatial-reasoning": ["Ask which part moved.", "Ask how the shape would look after a turn or flip."],
  "conditional-thinking": ["Ask which clue mattered first.", "Ask what must be true if the condition holds."],
  "elimination-method": ["Ask which option can be ruled out first.", "Ask why the remaining option fits."],
  "multi-step-reasoning": ["Ask for the first step.", "Ask what changes after each step."],
  "rule-creation": ["Ask who benefits from the new rule.", "Ask whether the rule is fair."],
  "divergent-thinking": ["Ask for one very different idea.", "Ask which idea is more surprising and why."],
  "hypothetical-thinking": ["Ask what happens next.", "Ask what stays the same in the imagined world."],
  "explain-reasoning": ["Ask the child to use because.", "Ask for the reason in a complete sentence."],
  "describe-observation": ["Ask what they notice first.", "Ask for one more detail before the conclusion."],
  "opponent-modeling": ["Ask what the other player wants.", "Ask how to respond to that move."],
  "optimal-strategy": ["Ask which plan works best every time.", "Ask why another plan is weaker."],
  "risk-assessment": ["Ask which choice is safer.", "Ask what could go wrong with the risky plan."],
  "systematic-observation": ["Ask the child to scan left to right.", "Ask what detail was easy to miss."],
  "inductive-generalization": ["Ask which examples belong together.", "Ask what rule explains all of them."],
  "analogy-transfer": ["Ask what is the same in the new case.", "Ask what changed but still follows the old rule."],
};

const SUBGOAL_TRANSFER_PATTERNS: Record<string, string[]> = {
  "pattern-recognition": ["Move from number sequences to shape or color patterns."],
  "quantity-comparison": ["Move from direct comparison to change-over-time comparison."],
  "strategy-planning": ["Move from one-step planning to opponent-aware planning."],
  "spatial-reasoning": ["Move from flat shapes to transformed or composed shapes."],
  "conditional-thinking": ["Move from one if-then clue to linked conditions."],
  "elimination-method": ["Move from obvious elimination to hidden contradictions."],
  "multi-step-reasoning": ["Move from fixed chains to branch-like reasoning."],
  "rule-creation": ["Apply a created rule to a fresh game."],
  "divergent-thinking": ["Transfer one creative idea into a different context."],
  "hypothetical-thinking": ["Transfer a what-if consequence into a new setting."],
  "explain-reasoning": ["Explain the same answer in a clearer way."],
  "describe-observation": ["Describe a new scene with the same structure."],
  "opponent-modeling": ["Predict a stronger opponent after a weaker one."],
  "optimal-strategy": ["Use the same winning structure in a new board state."],
  "risk-assessment": ["Judge a new risk with similar tradeoffs."],
  "systematic-observation": ["Apply the same scanning routine to a busier scene."],
  "inductive-generalization": ["Test the same rule against a new example."],
  "analogy-transfer": ["Map a known pattern into a different surface story."],
};

const SLOT_OVERRIDES: Partial<Record<string, EvidenceSlot[]>> = {
  "opponent-modeling": ["strategy_prediction", "self_explanation", "activity_summary"],
  "optimal-strategy": ["strategy_prediction", "self_explanation", "activity_summary"],
  "risk-assessment": ["strategy_prediction", "self_explanation", "activity_summary"],
  "describe-observation": ["describe_observation", "self_explanation", "activity_summary"],
  "systematic-observation": ["describe_observation", "self_explanation", "activity_summary"],
  "inductive-generalization": ["describe_observation", "self_explanation", "transfer_check"],
  "analogy-transfer": ["describe_observation", "self_explanation", "transfer_check"],
  "rule-creation": ["answer", "idea_improvement", "activity_summary"],
  "divergent-thinking": ["answer", "idea_improvement", "activity_summary"],
  "hypothetical-thinking": ["answer", "idea_improvement", "activity_summary"],
};

function activityIdsForSubGoal(subGoalId: string): string[] {
  const overrideIds = SUBGOAL_ACTIVITY_OVERRIDES[subGoalId];
  if (overrideIds?.length) return overrideIds;
  return ALL_ACTIVITIES.filter((activity) => activity.subGoalId === subGoalId).map((activity) => activity.id);
}

function buildDefaultPlaybook(goalId: GoalId, subGoalId: string): SubGoalPlaybook {
  const goal = GOAL_MAP.get(goalId);
  const subGoal = goal?.subGoals.find((item) => item.id === subGoalId);
  const domainConfig = DOMAIN_PEDAGOGY_CONFIGS[goalId];
  const requiredEvidenceSlots = SLOT_OVERRIDES[subGoalId] ?? domainConfig.requiredEvidenceSlots;
  const observableBehaviors = subGoal?.observableBehaviors ?? [];

  return {
    goalId,
    subGoalId,
    label: subGoal?.label ?? subGoalId,
    trainingIntent: goal?.description ?? `Train ${subGoalId} with guided interactive practice.`,
    commonMisconceptions: [
      "Guesses the answer without explaining the reason.",
      "Loses the rule when the surface context changes.",
      "Needs repeated prompting before describing the key evidence.",
    ],
    hintLadder: domainConfig.defaultScaffoldLadder,
    evidenceRubric: {
      requiredEvidenceSlots,
      successSignals: observableBehaviors.slice(0, 3),
      warningSignals: [
        "Answer appears lucky or unexplained.",
        "Child stops after the first idea or first clue.",
        "Surface changes break the performance immediately.",
      ],
    },
    followUpPatterns: SUBGOAL_FOLLOW_UPS[subGoalId] ?? ["Ask what the child noticed first.", "Ask why the answer makes sense."],
    transferPatterns: SUBGOAL_TRANSFER_PATTERNS[subGoalId] ?? ["Move the same structure into a new story context."],
    promptDos: [
      "Keep the task inside the current sub-goal.",
      "Collect evidence before changing difficulty.",
      "Prefer one clear follow-up instead of several unrelated questions.",
    ],
    promptDonts: [
      "Do not switch domains for novelty.",
      "Do not advance on answer-only evidence when explanation is required.",
      "Do not reveal the full solution before the child has tried.",
    ],
    allowedTeachingMoves: domainConfig.coreTeachingMoves,
    activityIds: activityIdsForSubGoal(subGoalId),
  };
}

const SUBGOAL_PLAYBOOKS: Record<string, SubGoalPlaybook> = Object.fromEntries(
  TRAINING_GOALS.flatMap((goal) =>
    goal.subGoals.map((subGoal) => [
      subGoal.id,
      buildDefaultPlaybook(goal.id, subGoal.id),
    ]),
  ),
);

const FORMAL_RUNTIME_SUBGOALS = new Set<string>(["pattern-recognition"]);

export const GOAL_READINESS = Object.fromEntries(
  (Object.keys(DOMAIN_PEDAGOGY_CONFIGS) as GoalId[]).map((goalId) => [
    goalId,
    DOMAIN_PEDAGOGY_CONFIGS[goalId].readiness,
  ]),
) as Record<GoalId, DomainPedagogyConfig["readiness"]>;

export function getDomainPedagogyConfig(goalId: string): DomainPedagogyConfig {
  return DOMAIN_PEDAGOGY_CONFIGS[(goalId as GoalId) || "math-thinking"] ?? DOMAIN_PEDAGOGY_CONFIGS["math-thinking"];
}

export function resolveScoringMode(goalId: string, subGoalId?: string): ScoringMode {
  if (goalId === "math-thinking" && subGoalId === "pattern-recognition") {
    return "formal_scored";
  }
  return "experimental_unscored";
}

export function isFormalScoredRuntime(goalId: string, subGoalId?: string): boolean {
  return resolveScoringMode(goalId, subGoalId) === "formal_scored";
}

export function getFormalScoredSubGoalForGoal(goalId: GoalId): string | undefined {
  return goalId === "math-thinking" ? "pattern-recognition" : undefined;
}

export function getSubGoalPlaybook(subGoalId: string): SubGoalPlaybook {
  if (FORMAL_RUNTIME_SUBGOALS.has(subGoalId) && subGoalId in AUTHORED_PILOT_PLAYBOOKS) {
    const authored = AUTHORED_PILOT_PLAYBOOKS[subGoalId as keyof typeof AUTHORED_PILOT_PLAYBOOKS];
    return {
      goalId: authored.goalId,
      subGoalId: authored.subGoalId,
      label: authored.label,
      trainingIntent: authored.trainingIntent,
      commonMisconceptions: authored.commonMistakes,
      hintLadder: authored.hintLadder,
      evidenceRubric: {
        requiredEvidenceSlots: ["answer", "self_explanation", "activity_summary"],
        successSignals: authored.evidenceSpec.successSignals,
        warningSignals: authored.evidenceSpec.warningSignals,
      },
      followUpPatterns: authored.fallbackRules.map((rule) => rule.action),
      transferPatterns: authored.advanceRules.map((rule) => rule.action),
      promptDos: [
        "Follow the authored hint ladder and common misconceptions before improvising.",
        "Keep the child inside pattern-recognition unless the activity is explicitly abandoned.",
        "Collect answer and explanation evidence before claiming stable mastery.",
      ],
      promptDonts: [
        "Do not invent a new sub-goal or new difficulty rule mid-turn.",
        "Do not skip from light guidance to full solution reveal.",
        "Do not advance mastery on answer-only evidence.",
      ],
      allowedTeachingMoves: authored.allowedTeachingMoves,
      activityIds: authored.activityIds,
      thinEvidenceRoutes: authored.thinEvidenceRoutes,
      repairPrompts: authored.repairPrompts,
      handoffPrompts: authored.handoffPrompts,
      attentionRecoveryPrompts: authored.attentionRecoveryPrompts,
      ruleFragments: authored.ruleFragments,
      handoffExpiryMinutes: authored.handoffExpiryMinutes,
      contrastTargets: authored.contrastTargets,
      evaluatorFewShotMatrix: authored.evaluatorFewShotMatrix,
      challengeBank: authored.challengeBank,
    };
  }

  return SUBGOAL_PLAYBOOKS[subGoalId] ?? buildDefaultPlaybook("math-thinking", "pattern-recognition");
}

export function getGoalReadiness(goalId: GoalId): DomainPedagogyConfig["readiness"] {
  return GOAL_READINESS[goalId] ?? "building";
}

export function isGoalReady(goalId: GoalId): boolean {
  return getGoalReadiness(goalId) === "ready";
}
