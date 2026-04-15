import { GOAL_MAP, TRAINING_GOALS } from "@/content/goals/goal-tree";
import type { MasteryState } from "@/lib/training/mastery-engine";
import type { SubGoal, TrainingGoal } from "@/types/goals";

export interface SkillObservation {
  skill: string;
  subGoalId?: string;
  goalId?: string;
  observation: string;
  confidence: number;
  difficultyLevel?: "L1" | "L2" | "L3" | "L4";
  hintCount?: number;
  selfExplained?: boolean;
  correctness?: "correct" | "partial" | "incorrect" | "unknown";
  evidenceType?: string;
  status?: string;
  activityStatus?: string;
}

export interface GoalContextInput {
  goalFocus: string[];
  recentObservations?: SkillObservation[];
  masteryStates?: Record<string, MasteryState>;
  preferredSubGoalIds?: string[];
  maxSubGoalsPerGoal?: number;
}

function inferDifficultyLevel(subGoal: SubGoal, confidence: number): string {
  const levels = subGoal.difficultyLevels;
  if (!levels.length) return "L1";
  if (confidence >= 0.8) return levels[Math.min(2, levels.length - 1)].level;
  if (confidence <= 0.4) return levels[0].level;
  return levels[Math.min(1, levels.length - 1)].level;
}

function getActiveGoals(goalFocus: string[]): TrainingGoal[] {
  const goals = goalFocus.length > 0
    ? goalFocus.map((id) => GOAL_MAP.get(id)).filter(Boolean)
    : TRAINING_GOALS.slice(0, 2);
  return goals as TrainingGoal[];
}

function sortSubGoalsForGoal(goal: TrainingGoal, preferredSubGoalIds: string[]): SubGoal[] {
  if (preferredSubGoalIds.length === 0) return goal.subGoals;
  return [...goal.subGoals].sort((left, right) => {
    const leftIndex = preferredSubGoalIds.indexOf(left.id);
    const rightIndex = preferredSubGoalIds.indexOf(right.id);
    const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return goal.subGoals.indexOf(left) - goal.subGoals.indexOf(right);
  });
}

function stageLabel(stage: MasteryState["stage"]): string {
  switch (stage) {
    case "ready_to_transfer":
      return "可迁移";
    case "stable":
      return "较稳定";
    case "practicing":
      return "练习中";
    default:
      return "起步中";
  }
}

function actionLabel(action: MasteryState["nextAction"]): string {
  switch (action) {
    case "repair_evidence":
      return "补证据";
    case "advance":
      return "升难";
    case "fallback":
      return "降难";
    case "transfer":
      return "迁移";
    case "diagnose":
      return "诊断";
    default:
      return "复练";
  }
}

export function buildGoalContextPrompt(input: GoalContextInput): string {
  const {
    goalFocus,
    recentObservations = [],
    masteryStates = {},
    preferredSubGoalIds = [],
    maxSubGoalsPerGoal = 2,
  } = input;

  const latestBySkill = new Map<string, SkillObservation>();
  for (const observation of recentObservations) {
    if (!latestBySkill.has(observation.subGoalId ?? observation.skill)) {
      latestBySkill.set(observation.subGoalId ?? observation.skill, observation);
    }
  }

  const activeGoals = getActiveGoals(goalFocus);
  if (activeGoals.length === 0) {
    return "## 当前训练方向\n综合思维训练：根据孩子的回应灵活选择最合适的挑战。";
  }

  const sections = [`## 当前训练方向（共 ${activeGoals.length} 个目标）`];

  for (const goal of activeGoals) {
    const lines: string[] = [
      `### ${goal.label}（${goal.id}）`,
      goal.description,
      "",
    ];
    const orderedSubGoals = sortSubGoalsForGoal(goal, preferredSubGoalIds).slice(0, maxSubGoalsPerGoal);

    for (const subGoal of orderedSubGoals) {
      const masteryState = masteryStates[subGoal.id];
      const latestObservation = latestBySkill.get(subGoal.id);
      const confidence = latestObservation?.confidence ?? 0.55;
      const recommendedLevel = masteryState?.recommendedDifficulty ?? inferDifficultyLevel(subGoal, confidence);
      lines.push(`- ${subGoal.label}: 推荐难度 ${recommendedLevel}`);
      lines.push(`  可观察行为: ${subGoal.observableBehaviors.slice(0, 2).join("；")}`);

      if (masteryState) {
        lines.push(`  掌握阶段: ${stageLabel(masteryState.stage)}，建议动作: ${actionLabel(masteryState.nextAction)}`);
        lines.push(`  决策依据: ${masteryState.reason}`);
      } else if (latestObservation) {
        lines.push(`  最近信号: ${latestObservation.observation}`);
      }

      if (latestObservation?.activityStatus === "passed_evidence_thin") {
        lines.push("  风险提示: 孩子可能答对了，但解释证据还不够。");
      }
      if ((latestObservation?.hintCount ?? 0) >= 2) {
        lines.push("  风险提示: 最近提示依赖偏高，优先脚手架，不要直接升难。");
      }
    }

    sections.push(lines.join("\n"));
  }

  sections.push("> 难度、活动切换和追问都要服从 mastery 和证据覆盖，不为新鲜感随机换题。");
  return sections.join("\n\n");
}

export function buildGoalSummary(goalFocus: string[]): string {
  const labels = goalFocus
    .map((id) => GOAL_MAP.get(id)?.label)
    .filter(Boolean)
    .join("、");
  return labels ? `当前训练重点：${labels}` : "综合思维训练";
}
