import { TRAINING_GOALS } from "@/content/goals/goal-tree";
import { getSubGoalPlaybook } from "@/lib/training/domain-pedagogy";
import type { ActivitySessionSummary, GoalId, ObservationSummary } from "@/types/goals";
import { buildMasteryProfile, type MasteryState } from "./mastery-engine";

export interface ParentTrainingReportItem {
  goalId: GoalId;
  goalLabel: string;
  subGoalId: string;
  label: string;
  trainingFocus: string;
  strongestEvidence: string;
  stuckPoint: string;
  stage: MasteryState["stage"];
  recommendedDifficulty: MasteryState["recommendedDifficulty"];
  nextSuggestion: string;
  recentEvidence: string[];
  evidenceHealth: "complete" | "thin" | "early";
}

export interface ParentExperimentalItem {
  goalId: GoalId;
  subGoalId: string;
  activityId: string;
  summary: string;
  updatedAt: string;
}

export interface ParentTrainingReport {
  profileId: string;
  primaryFocus: string;
  generatedAt: string;
  items: ParentTrainingReportItem[];
  experimentalItems: ParentExperimentalItem[];
}

function shorten(text: string, maxLength = 32): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function preferredEvidenceKind(observation: ObservationSummary) {
  return observation.evidenceType === "rule_statement" || observation.evidenceType === "contrastive_rebuttal"
    ? observation.evidenceType
    : observation.evidenceSlot ?? observation.evidenceType;
}

function evidenceSnippet(observation: ObservationSummary): string {
  return shorten(
    observation.evidence?.rawEvidence ??
      observation.evidence?.childInput ??
      observation.observation,
  );
}

function describeEvidence(observation: ObservationSummary): string {
  const kind = preferredEvidenceKind(observation);
  const snippet = evidenceSnippet(observation);

  if (observation.status === "filled") {
    if (kind === "rule_statement") {
      return snippet
        ? `孩子已经能把规律短短说出来了：“${snippet}”`
        : "孩子已经能把规律短短说出来了。";
    }
    if (kind === "contrastive_rebuttal") {
      return snippet
        ? `孩子已经会挡住错误答案了：“${snippet}”`
        : "孩子已经会挡住错误答案了。";
    }
    if (kind === "answer" && observation.correctness === "correct") {
      return snippet
        ? `孩子已经能给出答案：“${snippet}”`
        : "孩子已经能给出答案了。";
    }
    if (kind === "self_explanation") {
      return snippet
        ? `孩子开始把自己的理由说出来了：“${snippet}”`
        : "孩子开始把自己的理由说出来了。";
    }
    if (kind === "describe_observation") {
      return snippet
        ? `孩子能先说出自己看到了什么：“${snippet}”`
        : "孩子能先说出自己看到了什么。";
    }
    if (kind === "strategy_prediction") {
      return snippet
        ? `孩子开始提前想下一步了：“${snippet}”`
        : "孩子开始提前想下一步了。";
    }
    if (kind === "idea_improvement") {
      return snippet
        ? `孩子会比较并改一改自己的想法：“${snippet}”`
        : "孩子会比较并改一改自己的想法。";
    }
    if (kind === "transfer_check") {
      return snippet
        ? `孩子开始把方法迁移到新情境：“${snippet}”`
        : "孩子开始把方法迁移到新情境。";
    }
    return snippet ? `孩子这次留下了更清楚的证据：“${snippet}”` : "孩子这次留下了更清楚的证据。";
  }

  if (observation.status === "low_confidence") {
    if (observation.repairRecommended === "attention_recovery") {
      return "这次更像是注意力没接上，不急着把它当成不会。";
    }
    if (observation.repairRecommended === "sentence_frame") {
      return "孩子已经能答对，但还需要一点句子脚手架来把规律说完整。";
    }
    if (kind === "self_explanation") {
      return "孩子愿意开始说理由了，但表达还比较短。";
    }
    return "这次证据还偏薄，脑脑下一轮会用更低压的方式继续追问。";
  }

  if (observation.status === "missing") {
    if (observation.repairRecommended === "attention_recovery") {
      return "这次更像是没及时接上题目，系统会先把注意力轻轻拉回来。";
    }
    if (observation.repairRecommended === "sentence_frame") {
      return "孩子已经能答对，但还需要通过填空式句架把规律说完整。";
    }
    if (kind === "self_explanation") {
      return "这一步还缺一句“为什么”的表达。";
    }
    if (kind === "activity_summary") {
      return "这一轮还缺一次收尾复盘，暂时还不急着下结论。";
    }
    return "这次还没留下足够清楚的证据。";
  }

  return "系统还在收集更直接的表现证据。";
}

function describeStateReason(state: MasteryState): string {
  switch (state.nextAction) {
    case "diagnose":
      return "先用一轮轻诊断看看孩子当前最自然的起点。";
    case "advance":
      return "最近几轮已经比较稳，可以往上试一小步。";
    case "fallback":
      return "最近支持依赖偏多，先回到更稳的难度带。";
    case "transfer":
      return "可以换一个轻微变化的情境，确认孩子不是只会做原题。";
    case "repair_evidence":
      return "结果先算通过，但“为什么”证据还偏薄，下一轮先补说理。";
    case "repeat":
    default:
      return "表现还在形成中，先用同级变式把证据补完整。";
  }
}

function buildNextSuggestion(state: MasteryState): string {
  switch (state.nextAction) {
    case "diagnose":
      return `先从 ${state.recommendedDifficulty} 的轻量任务开始。`;
    case "advance":
      return "再做一轮稳定练习后，可以试着升一点点难度。";
    case "fallback":
      return `先回到 ${state.recommendedDifficulty}，把提示压力降下来。`;
    case "transfer":
      return "安排一题轻迁移，看看换个表面故事后还能不能继续用上这个规律。";
    case "repair_evidence":
      return "先保留这次答对的结果，下一轮优先补“说出规律”或“挡住错答案”的证据。";
    case "repeat":
    default:
      return `先留在 ${state.recommendedDifficulty}，用同级变式把证据做厚。`;
  }
}

function pickStrongestEvidence(observations: ObservationSummary[]): string {
  const evidencePriority = (observation: ObservationSummary): number => {
    switch (observation.evidenceType) {
      case "rule_statement":
        return 3;
      case "contrastive_rebuttal":
        return 2.5;
      case "self_explanation":
        return 2;
      case "answer":
        return 1;
      default:
        return 0.5;
    }
  };

  const strongest = [...observations]
    .filter((observation) =>
      observation.evidenceType !== "activity_summary" &&
      (observation.status === "filled" || observation.status === "low_confidence"),
    )
    .sort((left, right) => {
      const leftScore =
        (left.status === "filled" ? 1 : 0) +
        (left.correctness === "correct" ? 1 : 0) +
        (left.selfExplained ? 1 : 0) +
        evidencePriority(left) +
        left.confidence;
      const rightScore =
        (right.status === "filled" ? 1 : 0) +
        (right.correctness === "correct" ? 1 : 0) +
        (right.selfExplained ? 1 : 0) +
        evidencePriority(right) +
        right.confidence;
      return rightScore - leftScore;
    })[0];

  return strongest ? describeEvidence(strongest) : "这一项还在收集更直接的证据。";
}

function pickStuckPoint(observations: ObservationSummary[]): string {
  const stuck = observations.find(
    (observation) =>
      observation.activityStatus === "passed_evidence_thin" ||
      observation.activityStatus === "not_yet_mastered" ||
      observation.status === "missing" ||
      observation.status === "low_confidence" ||
      observation.correctness === "incorrect",
  );
  return stuck ? describeEvidence(stuck) : "当前没有明显卡点，重点是把表现继续做稳。";
}

function inferEvidenceHealth(
  observations: ObservationSummary[],
  state: MasteryState,
): ParentTrainingReportItem["evidenceHealth"] {
  if (state.evidenceThinCount > 0 || observations.some((observation) => observation.activityStatus === "passed_evidence_thin")) {
    return "thin";
  }
  if (observations.some((observation) => observation.status === "filled")) {
    return "complete";
  }
  return "early";
}

export function buildParentTrainingReport(
  profileId: string,
  observations: ObservationSummary[],
  experimentalSessions: ActivitySessionSummary[] = [],
): ParentTrainingReport {
  const items: ParentTrainingReportItem[] = [];

  for (const goal of TRAINING_GOALS) {
    const goalObservations = observations.filter((observation) => observation.goalId === goal.id);
    if (goalObservations.length === 0) continue;

    const masteryProfile = buildMasteryProfile(profileId, observations, goal.id);
    const topSubGoals = masteryProfile.recommendedSubGoalIds.slice(0, 2);

    for (const subGoalId of topSubGoals) {
      const playbook = getSubGoalPlaybook(subGoalId);
      const state = masteryProfile.states[subGoalId];
      const subGoalObservations = goalObservations
        .filter((observation) => observation.subGoalId === subGoalId)
        .slice(0, 6);

      if (subGoalObservations.length === 0 && state.recentObservationCount === 0) continue;

      items.push({
        goalId: goal.id,
        goalLabel: goal.label,
        subGoalId,
        label: playbook.label,
        trainingFocus: playbook.trainingIntent,
        strongestEvidence: pickStrongestEvidence(subGoalObservations),
        stuckPoint: pickStuckPoint(subGoalObservations),
        stage: state.stage,
        recommendedDifficulty: state.recommendedDifficulty,
        nextSuggestion: `${buildNextSuggestion(state)}${describeStateReason(state)}`,
        recentEvidence: subGoalObservations.map((observation) => describeEvidence(observation)).slice(0, 3),
        evidenceHealth: inferEvidenceHealth(subGoalObservations, state),
      });
    }
  }

  const primaryItem = items[0];
  const primaryFocus = primaryItem
    ? `${primaryItem.goalLabel} / ${primaryItem.label}`
    : "还没有形成稳定训练重点";

  return {
    profileId,
    primaryFocus,
    generatedAt: new Date().toISOString(),
    items,
    experimentalItems: experimentalSessions.slice(0, 6).map((session) => ({
      goalId: session.goalId as GoalId,
      subGoalId: session.subGoalId,
      activityId: session.activityId,
      summary: session.status === "abandoned"
        ? "这次正式训练先停下来了，后面主要是陪伴式聊天，不计正式训练进度。"
        : `最近玩过 ${session.goalId} / ${session.activityId}，这部分仍属于实验互动，不计正式训练进度。`,
      updatedAt: session.updatedAt,
    })),
  };
}
