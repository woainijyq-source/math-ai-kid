import { getDailyThemePlaybook } from "@/content/daily/theme-playbooks";
import { buildDailyChoiceScaffold, type DailyChoiceScaffold } from "@/lib/daily/choice-scaffold";
import { buildMirrorLead, buildSoftWrap, extractChildMirrorPhrase } from "@/lib/daily/child-language";
import type { ContinuitySnapshot } from "@/lib/data/session-log";
import { inferLiveMathTurnAdaptation } from "@/lib/daily/math-adaptation";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import { AI_TEACHER_NAME } from "@/lib/agent/persona";
import type { AgentStreamEvent, AgentTurnRequest, ToolCallResult } from "@/types/agent";
import type { DailyQuestion } from "@/types/daily";

function mockToolCall(
  name: ToolCallResult["name"],
  args: Record<string, unknown>,
): ToolCallResult {
  return {
    id: `daily-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    arguments: args,
    status: "pending",
  };
}

function toolCallEvent(toolCall: ToolCallResult, turnIndex: number): AgentStreamEvent {
  return { type: "tool_call", toolCall, turnIndex };
}

function buildInputTool(
  question: DailyQuestion,
  prompt: string,
  forceChoices = false,
  choiceScaffold?: DailyChoiceScaffold,
) {
  if (forceChoices || question.suggestedInput === "choice") {
    const scaffold = choiceScaffold ?? buildDailyChoiceScaffold({
      question,
      move: "open_question",
    });

    return mockToolCall("show_choices", {
      prompt: scaffold.prompt,
      choices: scaffold.choices,
    });
  }

  if (question.suggestedInput === "voice") {
    return mockToolCall("request_voice", { prompt, language: "zh-CN" });
  }

  return mockToolCall("show_text_input", {
    prompt,
    placeholder: "先说说你的想法也可以。",
    submitLabel: "告诉林老师",
  });
}

function buildClosingBadge(question: DailyQuestion) {
  switch (question.themeId) {
    case "math":
      return {
        badgeId: "daily-math-thinker",
        title: "数学小火花",
        detail: "今天你认真比较了数量和办法。",
      };
    case "pattern":
      return {
        badgeId: "daily-pattern-watcher",
        title: "规律小侦探",
        detail: "今天你认真发现了重复和变化。",
      };
    case "why":
      return {
        badgeId: "daily-why-asker",
        title: "为什么小达人",
        detail: "今天你试着把“为什么”说清楚了。",
      };
    case "fairness":
      return {
        badgeId: "daily-fairness-thinker",
        title: "公平小设计师",
        detail: "今天你认真想了怎样才更公平。",
      };
    case "what-if":
    default:
      return {
        badgeId: "daily-what-if-dreamer",
        title: "如果小发明家",
        detail: "今天你大胆想了“如果会怎样”。",
      };
  }
}

function buildTeachingWrapText(question: DailyQuestion, childInput: string) {
  const mirrorPhrase = extractChildMirrorPhrase(childInput);
  switch (question.themeId) {
    case "math":
      return `林老师先把刚才的问题收一下：我们在想怎样比较数量或办法。你提到“${mirrorPhrase}”，这就是在找一个分配规则。小科普一下，数学里先定规则，再按规则一步步做，大家就更容易觉得公平。`;
    case "pattern":
      return `林老师先小结一下：我们在找哪里重复、哪里变化。你刚才说到“${mirrorPhrase}”，已经是在抓线索了。小科普一下，找规律时可以先圈出最小的重复块，再用它猜下一格。`;
    case "why":
      return `林老师先把这个为什么收一下：你给了一个可能原因“${mirrorPhrase}”。小科普一下，猜原因时可以先说“可能因为……”，再想一个能不能验证的小线索。`;
    case "fairness":
      return `林老师先小结：我们在想怎样才更公平。你提到“${mirrorPhrase}”，说明你已经在考虑别人的感受。小科普一下，公平常常不是每个人都一样多，而是先说清楚用哪条规则。`;
    case "what-if":
    default:
      return `林老师先把这个如果收一下：你想到“${mirrorPhrase}”会发生变化。小科普一下，想如果题时可以按顺序看：第一件变化、影响到谁、要不要改规则。`;
  }
}

function buildDynamicFollowUp(question: DailyQuestion, request: AgentTurnRequest, turnIndex: number) {
  const signal = classifyDailyChildSignal(question, request.input, turnIndex);
  const mathTurnAdaptation = inferLiveMathTurnAdaptation({
    question,
    childInput: request.input,
    turnIndex,
  });
  const effectiveMove = mathTurnAdaptation?.recommendedMove ?? signal.suggestedMove;
  const playbook = getDailyThemePlaybook(question.themeId);
  const mirrorLead = buildMirrorLead(request.input, signal.type);
  const mirrorPhrase = extractChildMirrorPhrase(request.input);
  const choiceScaffold = mathTurnAdaptation?.shouldOfferChoices || signal.shouldOfferChoices || question.suggestedInput === "choice"
    ? buildDailyChoiceScaffold({
        question,
        move: effectiveMove,
        childInput: request.input,
      })
    : undefined;

  switch (effectiveMove) {
    case "gentle_rehook":
      return {
        narrate: `${playbook.warmPhrases[0]}。${mirrorLead} ${mathTurnAdaptation?.shouldShrinkScope ? "我们先把这件事缩小一点点，再回到刚才那个场景。" : "不过我们先回到刚才那个场景。"} ${question.mainQuestion}`,
        inputPrompt: mathTurnAdaptation?.shouldShrinkScope ? "先挑一个更容易开口的小方向。" : "先给林老师一个小想法就行。",
        offerChoices: Boolean(mathTurnAdaptation?.shouldOfferChoices),
        choiceScaffold,
      };
    case "scaffold_with_choices":
      return {
        narrate: `${playbook.warmPhrases[1] ?? playbook.warmPhrases[0]}。${mirrorLead} ${mathTurnAdaptation?.shouldShrinkScope ? "这一步先不用一下想太多，我们挑一个更小的方向。" : "如果一下子想不到也没关系，我们先挑一个方向。"}`,
        inputPrompt: choiceScaffold?.prompt ?? "你想先从哪一个方向开始想？",
        offerChoices: true,
        choiceScaffold,
      };
    case "clarify_reasoning":
      return {
        narrate: `${mirrorLead} ${question.firstFollowUp}`,
        inputPrompt: "再说一点点，告诉林老师你为什么这样想。",
        offerChoices: false,
        choiceScaffold,
      };
    case "compare_options":
      {
        const offerChoices = question.suggestedInput === "choice";
      return {
        narrate: `${mirrorLead} 那我们来比一比。${question.firstFollowUp}`,
        inputPrompt: offerChoices
          ? (choiceScaffold?.prompt ?? "你先选一个更像你的想法。")
          : "再说一句，告诉林老师你现在更偏向哪种想法。",
        offerChoices,
        choiceScaffold,
      };
      }
    case "push_half_step":
      return {
        narrate: `林老师已经跟上你说的“${mirrorPhrase}”了。${mathTurnAdaptation?.liveSignal === "too_easy" ? "这一轮你看起来挺轻松，那我们把它轻轻拧高半步。" : "那我们再往前走半步。"} ${question.twistFollowUp}`,
        inputPrompt: "把你刚想到的新一步告诉林老师。",
        offerChoices: false,
        choiceScaffold,
      };
    case "wrap_up":
    default:
      return {
        narrate: buildSoftWrap(question, request.input),
        inputPrompt: "",
        offerChoices: false,
        choiceScaffold,
      };
  }
}

export function buildDailyQuestionMockStart(question: DailyQuestion, continuitySnapshot?: ContinuitySnapshot | null): AgentStreamEvent[] {
  const continuityHint = continuitySnapshot
    ? `上次你提到过一个办法，林老师记住了。`
    : "";
  const narrate = mockToolCall("narrate", {
    text: `${continuityHint}${question.sceneSetup} ${question.sceneDetail} ${question.mainQuestion}`,
    speakerName: AI_TEACHER_NAME,
    voiceRole: "guide",
    autoSpeak: true,
  });
  const openingChoiceScaffold = question.suggestedInput === "choice"
    ? buildDailyChoiceScaffold({ question, move: "open_question" })
    : undefined;
  const inputTool = buildInputTool(
    question,
    "先说说你的想法，林老师会顺着你的话继续聊。",
    false,
    openingChoiceScaffold,
  );

  return [
    toolCallEvent(narrate, 0),
    toolCallEvent(inputTool, 0),
    { type: "turn_end", turnIndex: 0, toolCallCount: 2, usedFastPath: false, elapsedMs: 40 },
  ];
}

export function buildDailyQuestionMockTurn(
  question: DailyQuestion,
  request: AgentTurnRequest,
  turnIndex: number,
): AgentStreamEvent[] {
  if (turnIndex >= 2) {
    const narrate = mockToolCall("narrate", {
      text: buildTeachingWrapText(question, request.input),
      speakerName: AI_TEACHER_NAME,
      voiceRole: "guide",
      autoSpeak: true,
    });
    const badge = mockToolCall("award_badge", buildClosingBadge(question));
    const endActivity = mockToolCall("end_activity", {
      summary: `今天你围绕“${question.title}”认真想了几轮，还把自己的想法慢慢说清楚了。`,
      completionRate: 1,
    });

    return [
      toolCallEvent(narrate, turnIndex),
      toolCallEvent(badge, turnIndex),
      toolCallEvent(endActivity, turnIndex),
      {
        type: "system_effect",
        effect: {
          type: "end_activity",
          data: {
            summary: `今天你围绕“${question.title}”认真想了几轮，还把自己的想法慢慢说清楚了。`,
            completionRate: 1,
          },
        },
        turnIndex,
      },
      { type: "turn_end", turnIndex, toolCallCount: 3, usedFastPath: false, elapsedMs: 50 },
    ];
  }

  const followUp = buildDynamicFollowUp(question, request, turnIndex);
  const narrate = mockToolCall("narrate", {
    text: followUp.narrate,
    speakerName: AI_TEACHER_NAME,
    voiceRole: "guide",
    autoSpeak: true,
  });
  const inputTool = buildInputTool(
    question,
    followUp.inputPrompt,
    followUp.offerChoices,
    followUp.choiceScaffold,
  );

  return [
    toolCallEvent(narrate, turnIndex),
    toolCallEvent(inputTool, turnIndex),
    { type: "turn_end", turnIndex, toolCallCount: 2, usedFastPath: false, elapsedMs: 45 },
  ];
}
