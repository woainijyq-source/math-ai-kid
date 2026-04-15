import type {
  AgentStreamEvent,
  AgentTurnRequest,
  ConversationMessage,
  ToolCall,
  ToolCallResult,
} from "../../types/agent";
import type {
  ChildProfile,
  ScoringMode,
} from "../../types/goals";
import type { MasteryProfile } from "../training/mastery-engine";
import type { TrainingIntent } from "../training/training-intent";
import { streamQwenWithTools } from "../ai/qwen-chat";
import { buildMockAgentTurn } from "../ai/mock";
import { FIRST_LAUNCH_TOOLS } from "./tool-definitions";
import { validateToolCall } from "./tool-validators";
import { enforceOrchestration, checkActivityStructure } from "./orchestration-guard";
import { executeSystemTool, isSystemTool } from "./tool-executor";
import { buildErrorRecoveryToolCalls, buildFallbackToolCalls } from "./fallback";
import { updateActivitySessionRuntime } from "../data/db";
import { buildPromptAssembly, type PromptAssemblyRuntime } from "../training/prompt-builder";
import {
  buildPatternRecognitionStructuredToolCalls,
} from "../training/pattern-activity-runtime";
import { getAgeInteractionBand } from "@/prompts/modules/age-adapter";

export interface AgentLoopContext {
  profile: ChildProfile;
  goalFocus: string[];
  turnIndex: number;
  lastTurnToolCalls?: ToolCall[];
  currentActivity?: string;
  currentActivityId?: string;
  activitySessionId?: string;
  currentGoalId?: string;
  currentSubGoalId?: string;
  masteryProfile?: MasteryProfile;
  trainingIntent?: TrainingIntent;
  scoringMode?: ScoringMode;
}

function slidingWindow(conversation: ConversationMessage[], maxMessages = 20): ConversationMessage[] {
  if (conversation.length <= maxMessages) return conversation;
  // 始终保留前 2 条消息（第一个 user + 第一个 assistant 开场白），防止开场白被截断
  const head = conversation.slice(0, 2);
  const tail = conversation.slice(-(maxMessages - 2));
  return [...head, ...tail];
}

type QwenMessage = {
  role: string;
  content?: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

function toQwenMessages(messages: ConversationMessage[]): QwenMessage[] {
  return messages.map((message) => {
    const converted: QwenMessage = { role: message.role };
    if (message.content !== undefined) converted.content = message.content;
    if (message.tool_call_id !== undefined) converted.tool_call_id = message.tool_call_id;
    if (message.name !== undefined) converted.name = message.name;
    if (message.toolCalls?.length) {
      converted.tool_calls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      }));
    }
    return converted;
  });
}

function buildToolResultContent(tc: {
  id: string;
  function?: { name?: string; arguments?: string };
}): string {
  const name = tc.function?.name ?? "";
  if (name === "show_choices") {
    try {
      const args = JSON.parse(tc.function?.arguments ?? "{}");
      const labels = (args.choices ?? []).map((choice: { label?: string }) => choice.label).filter(Boolean);
      return JSON.stringify({ status: "displayed", choices: labels });
    } catch {
      return JSON.stringify({ status: "displayed" });
    }
  }
  if (name === "show_text_input" || name === "request_voice") {
    return JSON.stringify({ status: "waiting_for_user_input" });
  }
  if (name === "narrate") {
    return JSON.stringify({ status: "spoken" });
  }
  if (name === "show_image") {
    return JSON.stringify({ status: "displayed" });
  }
  return JSON.stringify({ status: "ok" });
}

function injectToolResults(messages: QwenMessage[]): QwenMessage[] {
  const result: QwenMessage[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    result.push(msg);
    if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) continue;

    const toolCalls = msg.tool_calls as Array<{
      id: string;
      function?: { name?: string; arguments?: string };
    }>;

    const existingIds = new Set<string>();
    for (let j = i + 1; j < messages.length; j += 1) {
      if (messages[j].role === "tool" && messages[j].tool_call_id) {
        existingIds.add(messages[j].tool_call_id!);
      } else {
        break;
      }
    }

    for (const toolCall of toolCalls) {
      if (existingIds.has(toolCall.id)) continue;
      result.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: buildToolResultContent(toolCall),
      });
    }
  }
  return result;
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  argumentsStr: string;
}

function normalizeObservationCorrectness(value: unknown): "correct" | "partial" | "incorrect" | "unknown" {
  return value === "correct" || value === "partial" || value === "incorrect" ? value : "unknown";
}

function normalizeDifficultyLevel(value: unknown): "L1" | "L2" | "L3" | "L4" {
  return value === "L2" || value === "L3" || value === "L4" ? value : "L1";
}

function inferEvidenceType(
  args: Record<string, unknown>,
  childInput: AgentTurnRequest,
  calls: ToolCall[],
): string {
  const explicit = args.evidence_type ?? args.evidenceType;
  if (
    explicit === "answer" ||
    explicit === "self_explanation" ||
    explicit === "activity_summary" ||
    explicit === "strategy_prediction" ||
    explicit === "transfer_check" ||
    explicit === "general"
  ) {
    return explicit;
  }
  if (args.self_explained === true || args.selfExplained === true) {
    return "self_explanation";
  }
  if (calls.some((call) => call.name === "end_activity")) {
    return "activity_summary";
  }
  if (childInput.inputType === "voice") {
    return "self_explanation";
  }
  return "answer";
}

function buildObservationToolContext(context: AgentLoopContext): string[] {
  const toolContext: string[] = [];
  if (context.currentActivityId) toolContext.push(`activity:${context.currentActivityId}`);
  if (context.currentSubGoalId) toolContext.push(`subGoal:${context.currentSubGoalId}`);
  if (context.currentGoalId) toolContext.push(`goal:${context.currentGoalId}`);
  if (context.activitySessionId) toolContext.push(`activitySession:${context.activitySessionId}`);
  return toolContext;
}

function enrichObservationCall(
  call: ToolCall,
  childInput: AgentTurnRequest,
  context: AgentLoopContext,
  calls: ToolCall[],
): ToolCall {
  const args = { ...(call.arguments ?? {}) };
  const hintCountRaw = Number(args.hint_count ?? args.hintCount ?? 0);
  const hintCount = Number.isFinite(hintCountRaw) ? Math.max(0, Math.round(hintCountRaw)) : 0;
  const evidenceType = inferEvidenceType(args, childInput, calls);
  const evidenceSlot = evidenceType === "general" ? "answer" : evidenceType;

  const evidenceJson =
    typeof args.evidence_json === "string"
      ? args.evidence_json
      : {
          child_input: childInput.input,
          tool_context: buildObservationToolContext(context),
          hint_used: hintCount > 0,
          answer_quality:
            typeof args.answer_quality === "string"
              ? args.answer_quality
              : typeof args.observation === "string"
                ? args.observation
                : undefined,
          evidence_type: evidenceType,
          raw_evidence: typeof args.evidence === "string" ? args.evidence : childInput.input,
        };

  return {
    ...call,
    arguments: {
      ...args,
      profile_id: context.profile.id,
      session_id: childInput.sessionId,
      activity_session_id:
        args.activity_session_id ??
        args.activitySessionId ??
        context.activitySessionId,
      turn_index: context.turnIndex,
      goal_id: args.goal_id ?? args.goalId ?? context.currentGoalId ?? context.goalFocus[0] ?? "math-thinking",
      sub_goal_id: args.sub_goal_id ?? args.subGoalId ?? context.currentSubGoalId ?? "unknown-subgoal",
      skill: args.skill ?? args.sub_goal_id ?? args.subGoalId ?? context.currentSubGoalId ?? "general-observation",
      observation:
        typeof args.observation === "string" && args.observation.trim()
          ? args.observation
          : `记录孩子在 ${context.currentSubGoalId ?? "当前训练点"} 上的一次${childInput.inputType}回答`,
      confidence:
        typeof args.confidence === "number" && Number.isFinite(args.confidence)
          ? Math.max(0, Math.min(1, args.confidence))
          : 0.5,
      difficulty_level: normalizeDifficultyLevel(args.difficulty_level ?? args.difficultyLevel),
      hint_count: hintCount,
      self_explained: args.self_explained ?? args.selfExplained ?? (evidenceType === "self_explanation"),
      correctness: normalizeObservationCorrectness(args.correctness),
      task_id: args.task_id ?? args.taskId ?? context.currentActivityId,
      activity_id: args.activity_id ?? args.activityId ?? context.currentActivityId,
      evidence_type: evidenceType,
      evidence_slot: args.evidence_slot ?? args.evidenceSlot ?? evidenceSlot,
      mastery_delta:
        typeof args.mastery_delta === "number" && Number.isFinite(args.mastery_delta)
          ? args.mastery_delta
          : typeof args.masteryDelta === "number" && Number.isFinite(args.masteryDelta)
            ? args.masteryDelta
            : undefined,
      scoring_mode: context.scoringMode ?? "experimental_unscored",
      child_input: args.child_input ?? args.childInput ?? childInput.input,
      tool_context: args.tool_context ?? args.toolContext ?? buildObservationToolContext(context),
      evidence_json: evidenceJson,
    },
  };
}

function buildFallbackObservationCall(
  childInput: AgentTurnRequest,
  context: AgentLoopContext,
): ToolCall {
  return enrichObservationCall(
    {
      id: `obs-${context.turnIndex}-${Date.now()}`,
      name: "log_observation",
      arguments: {
        observation: `记录孩子在 ${context.currentSubGoalId ?? "当前训练点"} 上的一次${childInput.inputType}回答`,
        confidence: 0.5,
        correctness: "unknown",
        evidence_type: "general",
        answer_quality: childInput.input.slice(0, 120),
        evidence: childInput.input,
      },
    },
    childInput,
    context,
    [],
  );
}

function appendObservationCallIfNeeded(
  calls: ToolCall[],
  childInput: AgentTurnRequest,
  context: AgentLoopContext,
  assemblyState: PromptAssemblyRuntime["assemblyState"],
): ToolCall[] {
  if ((context.scoringMode ?? "experimental_unscored") !== "formal_scored" || assemblyState === "force_abandon") {
    return calls;
  }

  const normalizedCalls = calls.map((call) =>
    call.name === "log_observation"
      ? enrichObservationCall(call, childInput, context, calls)
      : call,
  );

  const shouldCaptureTurn =
    context.turnIndex > 0 &&
    typeof childInput.input === "string" &&
    childInput.input.trim().length > 0;

  if (!shouldCaptureTurn) {
    return normalizedCalls;
  }
  if (normalizedCalls.some((call) => call.name === "log_observation")) {
    return normalizedCalls;
  }
  return [...normalizedCalls, buildFallbackObservationCall(childInput, context)];
}

function buildAutoInputPrompt(
  context: AgentLoopContext,
  trainingIntent?: TrainingIntent,
): {
  prompt: string;
  placeholder: string;
  submitLabel: string;
} {
  return buildAgeAwareAutoInputPrompt(context, trainingIntent);

  if ((context.scoringMode ?? "experimental_unscored") !== "formal_scored") {
    return {
      prompt: "脑脑在这里陪你。你现在最想说什么？",
      placeholder: "比如：我想聊今天的事 / 我想问一个问题……",
      submitLabel: "继续聊天",
    };
  }

  const target = trainingIntent?.evidenceSlotTarget;
  const repairStrategy = trainingIntent?.repairStrategy;
  const goalId = context.currentGoalId;
  if (
    context.currentSubGoalId === "pattern-recognition" &&
    target === "self_explanation" &&
    repairStrategy
  ) {
    const handoff = (trainingIntent as TrainingIntent).handoffTemplate ?? "说到刚才那一题，脑脑还想追问一下。"; /*
    const handoff = trainingIntent.handoffTemplate ?? "说到刚才那一题，脑脑还想追问一下。";
    */ switch (repairStrategy) {
      case "contrastive_rebuttal":
        return {
          prompt: `${handoff} 你来告诉脑脑：为什么不能是另一个答案呢？`,
          placeholder: "比如：因为它没有像前面那样……",
          submitLabel: "挡住错答案",
        };
      case "feynman_teach_me":
        return {
          prompt: `${handoff} 你像小老师一样，带脑脑看一遍它是怎么变的。`,
          placeholder: "比如：它前面是……后面是……所以……",
          submitLabel: "教教脑脑",
        };
      case "attention_recovery":
        return {
          prompt: `${handoff} 脑脑想再跟上你刚才那一步。`,
          placeholder: "比如：我是看到……才选它的",
          submitLabel: "再说一遍",
        };
      case "sentence_frame":
        return {
          prompt: `${handoff} 我们一起把这句话补完整：它是不是每次都在___？`,
          placeholder: "比如：每次加2 / 红黄重复 / 越来越小",
          submitLabel: "补完整",
        };
    }
  }

  switch (target) {
    case "self_explanation":
      if (goalId === "logical-reasoning") {
        return {
          prompt: "先别只说答案。告诉脑脑你先排除了什么、为什么排除。",
          placeholder: "比如：我先排除……因为……",
          submitLabel: "说出推理",
        };
      }
      if (goalId === "language-thinking") {
        return {
          prompt: "用一句完整的话告诉脑脑你的理由，最好把“因为”也说出来。",
          placeholder: "比如：我觉得……因为……",
          submitLabel: "说完整",
        };
      }
      if (goalId === "strategy-thinking") {
        return {
          prompt: "告诉脑脑你为什么选这一步，它比别的办法好在哪里？",
          placeholder: "比如：我选……因为这样会……",
          submitLabel: "解释策略",
        };
      }
      return {
        prompt: "用一句话告诉脑脑：你为什么这样想？",
        placeholder: "比如：因为我发现……",
        submitLabel: "告诉脑脑",
      };
    case "strategy_prediction":
      return {
        prompt: "下一步你会怎么做？顺便说说为什么。",
        placeholder: "比如：我会先……因为……",
        submitLabel: "提交策略",
      };
    case "describe_observation":
      return {
        prompt: "你先观察到了什么？用一句话告诉脑脑。",
        placeholder: "比如：我看到……",
        submitLabel: "说出观察",
      };
    case "idea_improvement":
      return {
        prompt: "你想怎么改一改这个想法，让它更有趣或更合理？",
        placeholder: "比如：我想把它改成……",
        submitLabel: "改一改",
      };
    case "transfer_check":
      return {
        prompt: "如果换一个新情况，你觉得还可以这样想吗？",
        placeholder: "比如：如果换成……我还是会……",
        submitLabel: "继续想",
      };
    case "answer":
    default:
      return {
        prompt: "把你的答案告诉脑脑，再顺便说说你的想法。",
        placeholder: "比如：我觉得是……因为……",
        submitLabel: "发送",
      };
  }
}

function buildAgeAwareAutoInputPrompt(
  context: AgentLoopContext,
  trainingIntent?: TrainingIntent,
): {
  prompt: string;
  placeholder: string;
  submitLabel: string;
} {
  const ageBand = getAgeInteractionBand(context.profile.birthday);

  const ageCopy = {
    early_child: {
      casualPrompt: "脑脑在这里陪你。你现在想说什么？",
      casualPlaceholder: "比如：我想聊今天的事……",
      casualSubmit: "继续聊",
      explainPrompt: "用一句短短的话告诉脑脑，你为什么这样想？",
      explainPlaceholder: "比如：因为它一直在变……",
      explainSubmit: "告诉脑脑",
    },
    younger_kid: {
      casualPrompt: "脑脑在这里陪你。你现在最想说什么？",
      casualPlaceholder: "比如：我想聊今天的事 / 我想问一个问题……",
      casualSubmit: "继续聊天",
      explainPrompt: "用一句话告诉脑脑：你为什么这样想？",
      explainPlaceholder: "比如：因为我发现……",
      explainSubmit: "告诉脑脑",
    },
    middle_kid: {
      casualPrompt: "如果你想继续，我们可以直接接着聊。",
      casualPlaceholder: "比如：我想换个话题 / 我有个问题……",
      casualSubmit: "继续",
      explainPrompt: "直接说出你的理由就行，不用很长。",
      explainPlaceholder: "比如：因为它每次都……",
      explainSubmit: "说理由",
    },
    older_kid: {
      casualPrompt: "如果你想继续，就直接说你现在要聊什么。",
      casualPlaceholder: "比如：换个话题 / 我想问这个……",
      casualSubmit: "继续",
      explainPrompt: "直接给出你的判断理由。",
      explainPlaceholder: "比如：因为它是在……之间轮换",
      explainSubmit: "提交理由",
    },
  }[ageBand];

  if ((context.scoringMode ?? "experimental_unscored") !== "formal_scored") {
    return {
      prompt: ageCopy.casualPrompt,
      placeholder: ageCopy.casualPlaceholder,
      submitLabel: ageCopy.casualSubmit,
    };
  }

  const target = trainingIntent?.evidenceSlotTarget;
  const goalId = context.currentGoalId;

  if (
    context.currentSubGoalId === "pattern-recognition" &&
    target === "self_explanation" &&
    trainingIntent?.repairStrategy
  ) {
    const handoff = trainingIntent.handoffTemplate ?? "说到刚才那一题，我还想追问一下。";

    switch (trainingIntent.repairStrategy) {
      case "contrastive_rebuttal":
        if (ageBand === "middle_kid" || ageBand === "older_kid") {
          return {
            prompt: `${handoff} 直接说一下：为什么另一个答案不成立？`,
            placeholder: "比如：因为它破坏了前面的轮换 / 增量不对",
            submitLabel: "说清原因",
          };
        }
        return {
          prompt: `${handoff} 你来告诉脑脑：为什么不能是另一个答案呢？`,
          placeholder: "比如：因为它没有像前面那样……",
          submitLabel: "挡住错答案",
        };
      case "feynman_teach_me":
        if (ageBand === "middle_kid" || ageBand === "older_kid") {
          return {
            prompt: `${handoff} 直接把规律说出来就行。`,
            placeholder: "比如：它每次加4 / 三个一组循环 / 每次转90度",
            submitLabel: "说出规律",
          };
        }
        return {
          prompt: `${handoff} 你像小老师一样，带脑脑看一遍它是怎么变的。`,
          placeholder: "比如：它前面是……后面是……所以……",
          submitLabel: "教教脑脑",
        };
      case "attention_recovery":
        if (ageBand === "middle_kid" || ageBand === "older_kid") {
          return {
            prompt: `${handoff} 把你刚才的想法补完整一点。`,
            placeholder: "比如：我是根据前面的变化选的",
            submitLabel: "补充一下",
          };
        }
        return {
          prompt: `${handoff} 脑脑想再跟上你刚才那一步。`,
          placeholder: "比如：我是看到……才选它的",
          submitLabel: "再说一遍",
        };
      case "sentence_frame":
        if (ageBand === "older_kid") {
          return {
            prompt: `${handoff} 用一个短句把规律补完整。`,
            placeholder: "比如：加3、加4轮流 / 三个一组循环",
            submitLabel: "补完整",
          };
        }
        return {
          prompt: `${handoff} 我们一起把这句话补完整：它是不是每次都在___？`,
          placeholder: "比如：每次加2 / 红黄重复 / 越来越小",
          submitLabel: "补完整",
        };
    }
  }

  switch (target) {
    case "self_explanation":
      if (goalId === "logical-reasoning") {
        return {
          prompt: ageBand === "older_kid" ? "先说你排除了什么，再说为什么。" : "先别只说答案。告诉脑脑你先排除了什么、为什么排除。",
          placeholder: "比如：我先排除……因为……",
          submitLabel: ageBand === "older_kid" ? "提交推理" : "说出推理",
        };
      }
      if (goalId === "language-thinking") {
        return {
          prompt: ageBand === "older_kid" ? "用完整一句话说出理由。" : "用一句完整的话告诉脑脑你的理由，最好把“因为”也说出来。",
          placeholder: "比如：我觉得……因为……",
          submitLabel: ageBand === "older_kid" ? "提交句子" : "说完整",
        };
      }
      if (goalId === "strategy-thinking") {
        return {
          prompt: ageBand === "older_kid" ? "说清你为什么选这一步，它比别的走法好在哪里。" : "告诉脑脑你为什么选这一步，它比别的办法好在哪里？",
          placeholder: "比如：我选……因为这样会……",
          submitLabel: "解释策略",
        };
      }
      return {
        prompt: ageCopy.explainPrompt,
        placeholder: ageCopy.explainPlaceholder,
        submitLabel: ageCopy.explainSubmit,
      };
    case "strategy_prediction":
      return {
        prompt: ageBand === "older_kid" ? "下一步你会怎么做？顺手说一下理由。" : "下一步你会怎么做？顺便说说为什么。",
        placeholder: "比如：我会先……因为……",
        submitLabel: "提交策略",
      };
    case "describe_observation":
      return {
        prompt: ageBand === "older_kid" ? "先说你观察到了什么。" : "你先观察到了什么？用一句话告诉脑脑。",
        placeholder: "比如：我看到……",
        submitLabel: "说出观察",
      };
    case "idea_improvement":
      return {
        prompt: ageBand === "older_kid" ? "你会怎么把这个想法改得更好？" : "你想怎么改一改这个想法，让它更有趣或更合理？",
        placeholder: "比如：我想把它改成……",
        submitLabel: "改一改",
      };
    case "transfer_check":
      return {
        prompt: ageBand === "older_kid" ? "如果换一个新情况，你还会这样想吗？" : "如果换一个新情况，你觉得还可以这样想吗？",
        placeholder: "比如：如果换成……我还是会……",
        submitLabel: "继续想",
      };
    case "answer":
    default:
      return {
        prompt: ageBand === "older_kid" ? "先给答案，再补一句你的想法。" : "把你的答案告诉脑脑，再顺便说说你的想法。",
        placeholder: "比如：我觉得是……因为……",
        submitLabel: "发送",
      };
  }
}

function appendInputToolIfNeeded(
  calls: ToolCall[],
  context: AgentLoopContext,
  assemblyState: PromptAssemblyRuntime["assemblyState"],
  trainingIntent?: TrainingIntent,
): ToolCall[] {
  if (assemblyState === "force_abandon") {
    return calls;
  }

  const hasInteractiveTool = calls.some((call) =>
    [
      "show_choices",
      "show_text_input",
      "request_voice",
      "show_number_input",
      "request_photo",
      "show_emotion_checkin",
      "request_camera",
      "show_drawing_canvas",
      "show_drag_board",
    ].includes(call.name),
  );

  if (hasInteractiveTool) {
    return calls;
  }

  const autoInput = buildAutoInputPrompt(context, trainingIntent);
  return [
    ...calls,
    {
      id: `auto-input-${context.turnIndex}-${Date.now()}`,
      name: "show_text_input",
      arguments: autoInput,
    },
  ];
}

const INTERACTIVE_TOOL_NAMES = new Set<ToolCall["name"]>([
  "show_choices",
  "show_text_input",
  "request_voice",
  "show_number_input",
  "request_photo",
  "show_emotion_checkin",
  "request_camera",
  "show_drawing_canvas",
  "show_drag_board",
]);

function collapseInteractiveTools(calls: ToolCall[]): ToolCall[] {
  const interactiveIndexes = calls
    .map((call, index) => (INTERACTIVE_TOOL_NAMES.has(call.name) ? index : -1))
    .filter((index) => index >= 0);

  if (interactiveIndexes.length <= 1) {
    return calls;
  }

  const keepIndex = interactiveIndexes[interactiveIndexes.length - 1];
  return calls.filter((call, index) => !INTERACTIVE_TOOL_NAMES.has(call.name) || index === keepIndex);
}

function buildForceAbandonToolCalls(
  context: AgentLoopContext,
  childInput: AgentTurnRequest,
  turnIndex: number,
): ToolCall[] {
  return [
    {
      id: `force-abandon-narrate-${turnIndex}-${Date.now()}`,
      name: "narrate",
      arguments: {
        text: "看来你现在更想聊点别的，我们的找规律游戏下次再玩。你想跟脑脑随便聊聊吗？",
        speakerName: "脑脑",
        voiceRole: "guide",
        autoSpeak: true,
      },
    },
    {
      id: `force-abandon-end-${turnIndex}-${Date.now()}`,
      name: "end_activity",
      arguments: {
        summary: "Child disengaged from the formal pattern-recognition activity, so the session switched to companion chat.",
        completionRate: 0,
        abandoned: true,
        activity_session_id: context.activitySessionId,
        session_id: childInput.sessionId,
        turn_index: turnIndex,
        scoring_mode: context.scoringMode ?? "formal_scored",
      },
    },
    {
      id: `force-abandon-input-${turnIndex}-${Date.now()}`,
      name: "show_text_input",
      arguments: {
        prompt: "那我们先不做题。你现在最想说什么？",
        placeholder: "比如：我想聊晚饭 / 我今天开心的事……",
        submitLabel: "和脑脑聊天",
      },
    },
  ];
}

function maybePersistPromptAssemblyRuntime(
  context: AgentLoopContext,
  runtime: PromptAssemblyRuntime,
  effectiveTrainingIntent?: TrainingIntent,
) {
  if (!context.activitySessionId || (context.scoringMode ?? "experimental_unscored") !== "formal_scored") {
    return;
  }

  if (runtime.assemblyState === "force_abandon") {
    updateActivitySessionRuntime(context.activitySessionId, {
      status: "abandoned",
      redirectCount: runtime.currentTurnRedirectCount,
      noiseTurnCount: runtime.currentTurnNoise ? runtime.noiseTurnCount + 1 : 0,
      evaluatorStatus: "evaluated",
      completedAt: new Date().toISOString(),
    });
    return;
  }

  updateActivitySessionRuntime(context.activitySessionId, {
    redirectCount: runtime.currentTurnNoise ? runtime.currentTurnRedirectCount : 0,
    noiseTurnCount: runtime.currentTurnNoise ? runtime.noiseTurnCount + 1 : 0,
    thinEvidenceType: effectiveTrainingIntent?.thinEvidenceType,
    repairStrategy: effectiveTrainingIntent?.repairStrategy,
    handoffTemplate: effectiveTrainingIntent?.handoffTemplate,
    challengeId: runtime.challengeId,
    challengeSpec: runtime.challengeSpec,
    challengeGenerationStatus: runtime.challengeGenerationStatus,
    challengeSource: runtime.challengeSource,
  });
}

export async function* runAgentTurn(
  conversation: ConversationMessage[],
  childInput: AgentTurnRequest,
  context: AgentLoopContext,
): AsyncGenerator<AgentStreamEvent> {
  const startMs = Date.now();
  const { turnIndex, lastTurnToolCalls } = context;
  const assembly = buildPromptAssembly(childInput, context);
  const promptRuntime = assembly.runtime;
  const effectiveTrainingIntent = assembly.effectiveTrainingIntent;
  maybePersistPromptAssemblyRuntime(context, promptRuntime, effectiveTrainingIntent);

  if (process.env.NODE_ENV === "development") {
    console.debug("[prompt-builder]", assembly.debug);
  }

  if (promptRuntime.assemblyState === "force_abandon") {
    const forcedCalls = buildForceAbandonToolCalls(context, childInput, turnIndex);
    for (const call of forcedCalls) {
      const result: ToolCallResult = { ...call, status: "pending" };
      yield { type: "tool_call", toolCall: result, turnIndex };
      if (isSystemTool(call.name)) {
        const effect = executeSystemTool(call);
        if (effect) {
          yield { type: "system_effect", effect, turnIndex };
        }
      }
    }

    yield {
      type: "turn_end",
      turnIndex,
      toolCallCount: forcedCalls.length,
      usedFastPath: false,
      elapsedMs: Date.now() - startMs,
    };
    return;
  }

  const frozenPatternChallenge =
    context.currentSubGoalId === "pattern-recognition" &&
    (context.scoringMode ?? "experimental_unscored") === "formal_scored"
      ? promptRuntime.challengeSpec
      : undefined;

  if (frozenPatternChallenge) {
    const shouldUseFrozenPatternTurn =
      turnIndex === 0 || effectiveTrainingIntent?.evidenceSlotTarget === "answer";

    let structuredCalls = shouldUseFrozenPatternTurn
      ? buildPatternRecognitionStructuredToolCalls({
          turnIndex,
          spec: frozenPatternChallenge,
          childInput: childInput.input,
          assemblyState: promptRuntime.assemblyState,
          activitySessionId: context.activitySessionId,
          sessionId: childInput.sessionId,
          scoringMode: context.scoringMode,
        })
      : undefined;

    if (structuredCalls && structuredCalls.length > 0) {
      structuredCalls = appendInputToolIfNeeded(
        structuredCalls,
        context,
        promptRuntime.assemblyState,
        effectiveTrainingIntent,
      );
      structuredCalls = appendObservationCallIfNeeded(
        structuredCalls,
        childInput,
        context,
        promptRuntime.assemblyState,
      );
      structuredCalls = collapseInteractiveTools(structuredCalls);

      for (const call of structuredCalls) {
        const result: ToolCallResult = { ...call, status: "pending" };
        yield { type: "tool_call", toolCall: result, turnIndex };
        if (isSystemTool(call.name)) {
          const effect = executeSystemTool(call);
          if (effect) {
            yield { type: "system_effect", effect, turnIndex };
          }
        }
      }

        yield {
          type: "turn_end",
          turnIndex,
          toolCallCount: structuredCalls.length,
          usedFastPath: false,
          elapsedMs: Date.now() - startMs,
        };
      return;
    }
  }

  const allMessages: ConversationMessage[] = [
    { role: "system", content: assembly.prompt },
    ...slidingWindow(conversation),
  ];

  // Token 估算（开发环境日志）
  function estimateMessageTokens(content: string): number {
    const chineseCount = (content.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    const otherCount = content.length - chineseCount;
    return Math.ceil(chineseCount * 1.5 + otherCount * 0.75);
  }
  const totalTokens = allMessages.reduce(
    (sum, msg) =>
      sum + estimateMessageTokens(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "")),
    0,
  );
  if (process.env.NODE_ENV === "development") {
    console.debug(`[agent-loop] estimated tokens: ${totalTokens}, messages: ${allMessages.length}`);
  }

  const qwenMessages = injectToolResults(toQwenMessages(allMessages));
  const accumulated = new Map<number, AccumulatedToolCall>();
  let qwenFailed = false;
  let qwenError = "";

  try {
    const stream = streamQwenWithTools(qwenMessages, FIRST_LAUNCH_TOOLS, {
      temperature: 0.4,
      maxTokens: 1500,
      timeoutMs: 20000,
    });

    for await (const chunk of stream) {
      if (chunk.type === "error") {
        qwenFailed = true;
        qwenError = chunk.message;
        break;
      }
      if (chunk.type === "tool_call_delta") {
        const { index, id, name, argumentsDelta } = chunk;
        if (!accumulated.has(index)) {
          accumulated.set(index, { id: id ?? `tc-${index}`, name: name ?? "", argumentsStr: "" });
        }
        const entry = accumulated.get(index)!;
        if (id) entry.id = id;
        if (name) entry.name = name;
        if (argumentsDelta) entry.argumentsStr += argumentsDelta;
      }
      if (chunk.type === "done") break;
    }
  } catch (error) {
    qwenFailed = true;
    qwenError = error instanceof Error ? error.message : "unknown_stream_error";
  }

  if (qwenFailed || accumulated.size === 0) {
    let mockEvents: AgentStreamEvent[];
    try {
      mockEvents = buildMockAgentTurn(childInput, turnIndex);
    } catch {
      const fallbackCalls = qwenFailed
        ? buildErrorRecoveryToolCalls(qwenError)
        : buildFallbackToolCalls();
      for (const call of fallbackCalls) {
        yield {
          type: "tool_call",
          toolCall: { ...call, status: "pending" },
          turnIndex,
        };
      }
      yield {
        type: "turn_end",
        turnIndex,
        toolCallCount: fallbackCalls.length,
        usedFastPath: false,
        elapsedMs: Date.now() - startMs,
      };
      return;
    }

    for (const event of mockEvents) {
      yield event;
    }
    return;
  }

  const rawCalls: ToolCall[] = [];
  for (const [, entry] of [...accumulated.entries()].sort(([a], [b]) => a - b)) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(entry.argumentsStr || "{}");
    } catch {
      continue;
    }
    rawCalls.push({
      id: entry.id,
      name: entry.name as ToolCall["name"],
      arguments: args,
    });
  }

  const validCalls: ToolCall[] = [];
  for (const call of rawCalls) {
    const result = validateToolCall(call);
    if (result.valid || result.fixed) {
      validCalls.push(result.fixed ?? call);
    }
  }

  let orchestrated = enforceOrchestration(validCalls, lastTurnToolCalls);
  orchestrated = checkActivityStructure(turnIndex, orchestrated);
  orchestrated = appendInputToolIfNeeded(
    orchestrated,
    context,
    promptRuntime.assemblyState,
    effectiveTrainingIntent,
  );
  orchestrated = appendObservationCallIfNeeded(
    orchestrated,
    childInput,
    context,
    promptRuntime.assemblyState,
  );
  orchestrated = collapseInteractiveTools(orchestrated);

  if (orchestrated.length === 0) {
    orchestrated = buildFallbackToolCalls();
  }

  for (const call of orchestrated) {
    const result: ToolCallResult = { ...call, status: "pending" };
    yield { type: "tool_call", toolCall: result, turnIndex };
    if (isSystemTool(call.name)) {
      const effect = executeSystemTool(call);
      if (effect) {
        yield { type: "system_effect", effect, turnIndex };
      }
    }
  }

  yield {
    type: "turn_end",
    turnIndex,
    toolCallCount: orchestrated.length,
    usedFastPath: false,
    elapsedMs: Date.now() - startMs,
  };
}
