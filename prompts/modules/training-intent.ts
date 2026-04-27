import type { TrainingIntent } from "@/lib/training/training-intent";
import type { PromptAssemblyState, ScoringMode } from "@/types/goals";

export interface TrainingIntentModuleOptions {
  scoringMode: ScoringMode;
  assemblyState: PromptAssemblyState;
}

function formatMove(move: TrainingIntent["teachingMove"]): string {
  switch (move) {
    case "ask_to_explain":
      return "ask_to_explain";
    case "ask_to_predict":
      return "ask_to_predict";
    case "transfer_check":
      return "transfer_check";
    case "contrast":
      return "contrast";
    case "hint":
      return "hint";
    case "wrap_up":
      return "wrap_up";
    default:
      return "probe";
  }
}

function pickHintWindow(intent: TrainingIntent, state: PromptAssemblyState) {
  if (state !== "hint_repair") {
    return [];
  }
  switch (intent.ageBand) {
    case "older_kid":
      return intent.hintLadder.slice(0, 1);
    case "middle_kid":
      return intent.hintLadder.slice(0, 1);
    default:
      return intent.hintLadder.slice(0, 2);
  }
}

function pickCommonMistakes(intent: TrainingIntent, state: PromptAssemblyState) {
  if (state === "hint_repair") {
    return intent.commonMistakes.slice(0, 2);
  }
  if (state === "evidence_repair") {
    return intent.commonMistakes.slice(0, 1);
  }
  return [];
}

function pickRepairPrompts(intent: TrainingIntent): string[] {
  if (!intent.repairStrategy) return [];
  if (intent.repairStrategy === "attention_recovery") {
    const prompts = intent.attentionRecoveryPrompts ?? intent.repairPrompts?.[intent.repairStrategy] ?? [];
    return intent.ageBand === "older_kid" ? prompts.slice(0, 1) : prompts;
  }
  const prompts = intent.repairPrompts?.[intent.repairStrategy] ?? [];
  return intent.ageBand === "older_kid" ? prompts.slice(0, 1) : prompts;
}

export function trainingIntentModule(
  intent: TrainingIntent,
  options: TrainingIntentModuleOptions,
): string {
  if (options.scoringMode !== "formal_scored") {
    return `## Experimental Interaction Mode
- This turn is exploratory chat only.
- Be playful and responsive, but do not pretend to run formal mastery evaluation.
- Do not claim the child advanced a level or finished a formal math objective.
- If the child wants to return to the original activity later, invite gently instead of pushing.`;
  }

  const hintLines = pickHintWindow(intent, options.assemblyState)
    .map((step) => `- L${step.level} ${step.label}: ${step.guidance}`)
    .join("\n");
  const mistakeLines = pickCommonMistakes(intent, options.assemblyState)
    .map((item) => `- ${item}`)
    .join("\n");
  const repairPromptLines = (options.assemblyState === "evidence_repair" ? pickRepairPrompts(intent) : [])
    .slice(0, 2)
    .map((item) => `- ${item}`)
    .join("\n");
  const ageRuleLines = intent.ageInteractionRules
    .map((item) => `- ${item}`)
    .join("\n");

  const stateSpecificBlock = (() => {
    switch (options.assemblyState) {
      case "hint_repair":
        return `### Current Repair Rule
- Stay inside the same sub-goal and repair with scaffolded guidance.
- Only use the current hint layer and the next hint layer.
- Do not skip to the final answer.`;
      case "evidence_repair":
        return `### Current Repair Rule
- The answer may already be acceptable, but explanation evidence is still thin.
- This repair happens on the next turn, so explicitly reconnect to the previous item first.
- Use only the assigned repair strategy and avoid dumping the whole hint ladder.`;
      case "stable_push":
        return `### Current Push Rule
- The child is relatively stable. Use one slightly richer variant or prediction step.
- Keep the question narrow and collect one more clean piece of evidence before celebrating mastery.`;
      case "wrap_or_transfer":
        return `### Current Wrap Rule
- Use a concise wrap-up first: summarize the child's answer, name the small idea behind it in child-friendly words, then only do a light transfer check if needed.
- Confirm the child can apply the same idea in a lightly changed situation.`;
      case "gentle_redirect_ready":
        return `### Current Redirect Rule
- If the child gives a clearly unrelated response, gently acknowledge it once and guide back to the current pattern task.
- Keep the redirect short and warm.
- Do not switch domains or act like the off-topic input solved the task.`;
      case "initial_probe":
      default:
        return `### Current Probe Rule
- Start with one narrow question inside the current sub-goal.
- Collect the first clear evidence before changing difficulty or topic.`;
    }
  })();

  return `## Formal TrainingIntent
- goalId: ${intent.goalId}
- subGoalId: ${intent.subGoalId}
- scoringMode: ${intent.scoringMode}
- difficultyLevel: ${intent.difficultyLevel}
- pedagogyModel: ${intent.pedagogyModel}
- masteryStage: ${intent.masteryStage}
- nextAction: ${intent.nextAction}
- teachingMove: ${formatMove(intent.teachingMove)}
- evidenceSlotTarget: ${intent.evidenceSlotTarget}
- assemblyState: ${options.assemblyState}
- thinEvidenceType: ${intent.thinEvidenceType ?? "none"}
- repairStrategy: ${intent.repairStrategy ?? "none"}
- handoffTemplate: ${intent.handoffTemplate ?? "none"}
- ageBand: ${intent.ageBand}

### Training Focus
${intent.trainingFocus}

### Required Evidence For This Turn
- Prioritize: ${intent.evidenceSlotTarget}
- Allowed evidence set: ${intent.expectedEvidence.join(", ")}

${ageRuleLines ? `### Age-Sensitive Delivery\n${ageRuleLines}\n` : ""}${mistakeLines ? `### Relevant Common Mistakes\n${mistakeLines}\n` : ""}${hintLines ? `### Active Hint Window\n${hintLines}\n` : ""}${options.assemblyState === "evidence_repair" && intent.handoffTemplate ? `### Async Handoff\n- Reconnect to the previous item before asking for more evidence.\n- Preferred opening: ${intent.handoffTemplate}\n\n` : ""}${repairPromptLines ? `### Active Repair Prompts\n${repairPromptLines}\n` : ""}${stateSpecificBlock}

### Behavior Boundaries
- Only use these activities: ${intent.allowedActivityScope.join(", ")}
- Only use these teaching moves: ${intent.allowedTeachingMoves.join(", ")}
- Do not switch to a new sub-goal on your own.
- Do not advance mastery on answer-only evidence.
- Do not chase evidence forever. After the child gives a partial answer plus any reason, generate a short explanation before asking again.
- Match the delivery tone to the age band instead of using one fixed child voice for everyone.

### Next Step Rules
- If the child stabilizes: ${intent.nextIfMastered}
- If the child is stuck: ${intent.nextIfStuck}

### Decision Reason
${intent.reason}`;
}
