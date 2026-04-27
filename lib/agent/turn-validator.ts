import type { AgentTurnRequest, ConversationMessage, ToolCall } from "../../types/agent";

const PROMPT_TOOL_NAMES = new Set([
  "show_choices",
  "show_text_input",
  "request_voice",
  "show_number_input",
  "request_photo",
  "request_camera",
  "show_drawing_canvas",
  "show_drag_board",
]);

const QUESTION_MARK_RE = /[?？]/g;
const QUESTION_SENTENCE_RE = /[^。！？!?]*[?？]/g;
const VAGUE_PROMPT_PATTERNS = [
  "你现在想说什么",
  "你现在最想说什么",
  "想说什么都可以",
  "随便说说",
  "继续聊聊",
  "说说你的想法",
  "你有什么想法",
];

const DEPENDENCY_PATTERNS = [
  /你只需要我/g,
  /只有我能帮你/g,
  /没有我你就/g,
  /你最好的朋友只有我/g,
];

const SECRET_PATTERNS = [
  /不要告诉(爸爸|妈妈|家长|父母|老师|大人)/g,
  /别告诉(爸爸|妈妈|家长|父母|老师|大人)/g,
  /这是(我们)?的秘密/g,
  /我们的小秘密/g,
];

const DIAGNOSIS_PATTERNS = [
  /你(可能|一定|肯定)?(有|是)(自闭症|多动症|抑郁症|焦虑症)/g,
  /(我来|我可以|让我)诊断/g,
  /正式诊断/g,
];

const DIRECT_ANSWER_PATTERNS = [
  /正确答案是[^。！？!?，,]*/g,
  /标准答案是[^。！？!?，,]*/g,
  /答案就是[^。！？!?，,]*/g,
  /你应该选[^。！？!?，,]*/g,
  /直接选[^。！？!?，,]*/g,
];

const HIGH_RISK_PATTERNS = [
  /跑到马路(中间|上)/g,
  /自己过马路/g,
  /摸插座/g,
  /玩火/g,
  /藏起来不要让大人知道/g,
];

interface MinimalTurnContext {
  currentSubGoalId?: string;
  currentActivityId?: string;
  turnIndex: number;
}

export interface TurnValidationContext extends MinimalTurnContext {
  childInput: AgentTurnRequest;
  conversation: ConversationMessage[];
  lastTurnToolCalls?: ToolCall[];
}

export interface TurnValidationResult {
  calls: ToolCall[];
  issues: string[];
}

export function buildContextualInputPrompt(
  context: MinimalTurnContext,
): {
  prompt: string;
  placeholder: string;
  submitLabel: string;
} {
  const pickByTurn = (
    variants: Array<{ prompt: string; placeholder: string; submitLabel: string }>,
  ) => variants[Math.max(0, context.turnIndex - 1) % variants.length];

  switch (context.currentSubGoalId) {
    case "explain-reasoning":
      return pickByTurn([
        {
          prompt: "你先说一个你想到的“为什么”，林老师接着听。",
          placeholder: "比如：我觉得可能是因为……",
          submitLabel: "说说原因",
        },
        {
          prompt: "顺着刚才那个想法，再补一句原因。",
          placeholder: "比如：因为它刚才……所以……",
          submitLabel: "补一句",
        },
        {
          prompt: "换个角度想：还有没有另一个可能的原因？",
          placeholder: "比如：也可能是因为……",
          submitLabel: "再猜一个",
        },
      ]);
    case "inductive-generalization":
    case "systematic-observation":
    case "analogy-transfer":
      return pickByTurn([
        {
          prompt: "你先说说你发现哪里在重复，或者哪里在变化。",
          placeholder: "比如：我看到它一直在……",
          submitLabel: "告诉林老师",
        },
        {
          prompt: "再往前看一步：下一次最可能会变成什么？",
          placeholder: "比如：下一个可能是……",
          submitLabel: "猜下一步",
        },
        {
          prompt: "把你看到的规律说成一句短短的话。",
          placeholder: "比如：它每次都会……",
          submitLabel: "说成规则",
        },
      ]);
    case "rule-creation":
    case "risk-assessment":
      return pickByTurn([
        {
          prompt: "如果你来定规则，你会先怎么安排？",
          placeholder: "比如：我会让大家先……",
          submitLabel: "定个规则",
        },
        {
          prompt: "这条规则执行以后，谁会先受到影响？",
          placeholder: "比如：第一个受影响的是……",
          submitLabel: "说影响",
        },
        {
          prompt: "如果这条规则不够好，你想先改哪里？",
          placeholder: "比如：我想把……改成……",
          submitLabel: "改一改",
        },
      ]);
    case "hypothetical-thinking":
    case "divergent-thinking":
    case "multi-step-reasoning":
      return pickByTurn([
        {
          prompt: "如果真的这样了，你觉得第一件事会发生什么？",
          placeholder: "比如：可能会先……",
          submitLabel: "接着想",
        },
        {
          prompt: "接着刚才那件事，再往后会影响到谁？",
          placeholder: "比如：然后可能会让……",
          submitLabel: "往后想",
        },
        {
          prompt: "如果想让结果更好，你会先改哪一步？",
          placeholder: "比如：我会先把……改一下",
          submitLabel: "想办法",
        },
      ]);
    default:
      return pickByTurn([
        {
          prompt: "你先说一个办法，林老师听你怎么想。",
          placeholder: "比如：我会先……因为……",
          submitLabel: "告诉林老师",
        },
        {
          prompt: "顺着这个办法，下一步你会怎么做？",
          placeholder: "比如：下一步我会……",
          submitLabel: "说下一步",
        },
        {
          prompt: "如果换一个情况，这个办法还管用吗？",
          placeholder: "比如：如果换成……我会……",
          submitLabel: "换个想法",
        },
      ]);
  }
}

function isPromptTool(call: ToolCall) {
  return PROMPT_TOOL_NAMES.has(call.name);
}

function getTextArg(call: ToolCall | undefined, key: string) {
  const value = call?.arguments?.[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function getPromptText(call: ToolCall | undefined) {
  return getTextArg(call, "prompt");
}

function normalizePromptText(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, "");
}

function isRepeatedPrompt(current: string | undefined, previous: string | undefined) {
  const normalizedCurrent = normalizePromptText(current);
  const normalizedPrevious = normalizePromptText(previous);
  if (!normalizedCurrent || !normalizedPrevious) return false;
  return normalizedCurrent === normalizedPrevious;
}

function isVagueInputPrompt(prompt: string | undefined) {
  const normalized = normalizePromptText(prompt);
  if (!normalized) return true;
  return VAGUE_PROMPT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function countQuestionMarks(value: string | undefined) {
  return value?.match(QUESTION_MARK_RE)?.length ?? 0;
}

function keepFirstQuestion(value: string) {
  const firstQuestion = value.match(QUESTION_SENTENCE_RE)?.[0]?.trim();
  if (!firstQuestion) return value;
  return firstQuestion;
}

function removeQuestions(value: string) {
  const stripped = value.replace(QUESTION_SENTENCE_RE, "").replace(/\s+/g, " ").trim();
  return stripped || "我听见你刚才的想法了，我们接着看这一小步。";
}

function sanitizeSafetyText(value: string) {
  let next = value;

  for (const pattern of DEPENDENCY_PATTERNS) {
    next = next.replace(pattern, "你也可以和家人一起聊聊这个发现");
    pattern.lastIndex = 0;
  }
  for (const pattern of SECRET_PATTERNS) {
    next = next.replace(pattern, "可以告诉爸爸妈妈或照顾你的大人");
    pattern.lastIndex = 0;
  }
  for (const pattern of DIAGNOSIS_PATTERNS) {
    next = next.replace(pattern, "这不是正式判断，我们只是在观察今天的想法");
    pattern.lastIndex = 0;
  }
  for (const pattern of DIRECT_ANSWER_PATTERNS) {
    next = next.replace(pattern, "先别急着定答案");
    pattern.lastIndex = 0;
  }
  for (const pattern of HIGH_RISK_PATTERNS) {
    next = next.replace(pattern, "先停下来找大人一起确认安全");
    pattern.lastIndex = 0;
  }

  return next.replace(/\s+/g, " ").trim();
}

function sanitizeToolText(call: ToolCall): ToolCall {
  const nextArgs = { ...call.arguments };
  for (const key of ["text", "prompt", "placeholder", "submitLabel", "alt", "generatePrompt"]) {
    const value = nextArgs[key];
    if (typeof value === "string") {
      nextArgs[key] = sanitizeSafetyText(value);
    }
  }

  const choices = nextArgs.choices;
  if (Array.isArray(choices)) {
    nextArgs.choices = choices.map((choice) => {
      if (typeof choice !== "object" || choice === null || Array.isArray(choice)) return choice;
      const nextChoice = { ...choice } as Record<string, unknown>;
      for (const key of ["label", "desc", "imageAlt", "generatePrompt"]) {
        const value = nextChoice[key];
        if (typeof value === "string") {
          nextChoice[key] = sanitizeSafetyText(value);
        }
      }
      return nextChoice;
    });
  }

  return { ...call, arguments: nextArgs };
}

function getPreviousInteractivePrompt(lastTurnToolCalls?: ToolCall[]) {
  const previousInteractive = [...(lastTurnToolCalls ?? [])]
    .reverse()
    .find((call) => isPromptTool(call));
  return getPromptText(previousInteractive);
}

function findLatestImageCall(
  calls: ToolCall[],
  conversation: ConversationMessage[],
  lastTurnToolCalls?: ToolCall[],
) {
  const allCalls = [
    ...conversation.flatMap((message) => message.toolCalls ?? []),
    ...(lastTurnToolCalls ?? []),
    ...calls,
  ];

  for (let index = allCalls.length - 1; index >= 0; index -= 1) {
    const call = allCalls[index];
    if (call.name === "show_image") return call;
  }
  return undefined;
}

function promptMentionsImage(prompt: string | undefined) {
  return /图|画面|这张|看着|颜色|顺序|空格|图片/.test(prompt ?? "");
}

function getImageSceneText(imageCall: ToolCall | undefined) {
  return [
    getTextArg(imageCall, "alt"),
    getTextArg(imageCall, "generatePrompt"),
  ].filter(Boolean).join(" ");
}

function buildImageAwarePrompt(imageCall: ToolCall | undefined) {
  const patternSpec = imageCall?.arguments?.patternSpec;
  if (typeof patternSpec === "object" && patternSpec !== null) {
    return {
      prompt: "看着这张图里的规律顺序，你觉得空格里更像什么？",
      placeholder: "比如：我看到它一直在……所以下一个像……",
      submitLabel: "说说规律",
    };
  }

  const sceneText = getImageSceneText(imageCall);
  if (/水果|苹果|梨|香蕉|橙|饼干|点心|分|公平|分享|小朋友/.test(sceneText)) {
    return {
      prompt: "看着这盘东西，你觉得先按什么规则分，大家会更容易接受？",
      placeholder: "比如：我会先……因为……",
      submitLabel: "说说分法",
    };
  }
  if (/规律|排序|颜色|红|黄|蓝|形状|下一|空格|重复/.test(sceneText)) {
    return {
      prompt: "看着图里的顺序，你觉得它在重复哪一小段？",
      placeholder: "比如：我看到它一直在重复……",
      submitLabel: "说说规律",
    };
  }
  if (/如果|假设|变成|突然|两个月亮|没有规则|会发生/.test(sceneText)) {
    return {
      prompt: "看着这个如果场景，你觉得第一件会变的事是什么？",
      placeholder: "比如：可能会先……",
      submitLabel: "说一个变化",
    };
  }
  if (/为什么|原因|影子|云|天气|植物|现象/.test(sceneText)) {
    return {
      prompt: "看着这个现象，你先猜一个可能的原因是什么？",
      placeholder: "比如：我觉得可能是因为……",
      submitLabel: "说说原因",
    };
  }

  return {
    prompt: "看着这张图，你先说一个最关键的线索。",
    placeholder: "比如：我觉得关键是……因为……",
    submitLabel: "说线索",
  };
}

function childSnippet(input: string) {
  return input
    .trim()
    .replace(/^我选[：:]\s*/, "")
    .replace(/[。！？!?，,\s]+$/g, "")
    .slice(0, 18);
}

function narrateReferencesChild(narrateText: string | undefined, input: string) {
  const snippet = childSnippet(input);
  if (!snippet) return true;
  if (narrateText?.includes(snippet)) return true;
  const keywords = snippet
    .split(/[，。！？!?、\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return keywords.some((keyword) => narrateText?.includes(keyword));
}

function maybeReferenceChildInput(call: ToolCall, context: TurnValidationContext) {
  if (call.name !== "narrate" || context.turnIndex <= 0) return call;
  const input = context.childInput.input?.trim() ?? "";
  if (!input || input.startsWith("系统启动")) return call;

  const text = getTextArg(call, "text") ?? "";
  if (narrateReferencesChild(text, input)) return call;

  const snippet = childSnippet(input);
  if (!snippet) return call;

  return {
    ...call,
    arguments: {
      ...call.arguments,
      text: `你刚才说“${snippet}”。${text}`,
    },
  };
}

function repairPromptTool(
  call: ToolCall,
  context: TurnValidationContext,
  imageCall: ToolCall | undefined,
  previousPrompt: string | undefined,
  issues: string[],
) {
  if (!isPromptTool(call)) return call;

  const currentPrompt = getPromptText(call);
  const repeatsPrevious = isRepeatedPrompt(currentPrompt, previousPrompt);
  const repeatsOpening =
    context.turnIndex > 1 &&
    normalizePromptText(currentPrompt).includes("第一件事会发生什么");
  const shouldUseContextual = isVagueInputPrompt(currentPrompt) || repeatsPrevious || repeatsOpening;
  const shouldUseImagePrompt = Boolean(imageCall && !promptMentionsImage(currentPrompt));

  if (!shouldUseContextual && !shouldUseImagePrompt && countQuestionMarks(currentPrompt) <= 1) {
    return call;
  }

  if (shouldUseContextual) issues.push("repaired_contextual_prompt");
  if (shouldUseImagePrompt) issues.push("repaired_image_prompt");
  if (countQuestionMarks(currentPrompt) > 1) issues.push("trimmed_multiple_questions");

  const repair = shouldUseImagePrompt
    ? buildImageAwarePrompt(imageCall)
    : buildContextualInputPrompt(context);
  const prompt = keepFirstQuestion(repair.prompt);

  return {
    ...call,
    arguments: {
      ...call.arguments,
      ...repair,
      prompt,
    },
  };
}

function enforceSingleQuestionPerTurn(calls: ToolCall[], issues: string[]) {
  const promptIndex = calls.findIndex((call) => isPromptTool(call));
  if (promptIndex === -1) {
    let questionSeen = false;
    return calls.map((call) => {
      if (call.name !== "narrate") return call;
      const text = getTextArg(call, "text");
      if (!text) return call;
      if (questionSeen || countQuestionMarks(text) > 1) {
        issues.push("trimmed_multiple_questions");
        return {
          ...call,
          arguments: {
            ...call.arguments,
            text: questionSeen ? removeQuestions(text) : keepFirstQuestion(text),
          },
        };
      }
      questionSeen = countQuestionMarks(text) > 0;
      return call;
    });
  }

  return calls.map((call, index) => {
    if (call.name === "narrate") {
      const text = getTextArg(call, "text");
      if (text && countQuestionMarks(text) > 0) {
        issues.push("moved_question_to_input_tool");
        return {
          ...call,
          arguments: {
            ...call.arguments,
            text: removeQuestions(text),
          },
        };
      }
    }

    if (index === promptIndex) {
      const prompt = getPromptText(call);
      if (prompt && countQuestionMarks(prompt) > 1) {
        issues.push("trimmed_multiple_questions");
        return {
          ...call,
          arguments: {
            ...call.arguments,
            prompt: keepFirstQuestion(prompt),
          },
        };
      }
    }
    return call;
  });
}

export function validateAndRepairTurn(
  calls: ToolCall[],
  context: TurnValidationContext,
): TurnValidationResult {
  const issues: string[] = [];
  const previousPrompt = getPreviousInteractivePrompt(context.lastTurnToolCalls);
  const imageCall = findLatestImageCall(calls, context.conversation, context.lastTurnToolCalls);

  let repaired = calls
    .map((call) => sanitizeToolText(call))
    .map((call) => repairPromptTool(call, context, imageCall, previousPrompt, issues))
    .map((call) => maybeReferenceChildInput(call, context))
    .map((call) => sanitizeToolText(call));

  repaired = enforceSingleQuestionPerTurn(repaired, issues);
  repaired = repaired.map((call) => sanitizeToolText(call));

  return {
    calls: repaired,
    issues: [...new Set(issues)],
  };
}
