import { buildBrainyVoiceGuideText } from "@/content/daily/brainy-voice-guide";
import { DAILY_QUESTION_BANK } from "@/content/daily/daily-question-bank";
import {
  applyScenarioTemplateVariablesToText,
  buildScenarioQuestionVariant,
  getScenarioTemplateForQuestion,
} from "@/content/daily/scenario-templates";
import { getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { getThemeLevelDefinition } from "@/content/daily/theme-level-definitions";
import { getDailyThemePlaybook } from "@/content/daily/theme-playbooks";
import { getThinkingMoveLabel } from "@/content/daily/thinking-evidence-rubric";
import { buildBrainySceneReason, buildBrainySceneSetup, buildBrainySceneVoice } from "@/lib/daily/brainy-voice";
import { buildThinkingGrowthPromptLines } from "@/content/daily/thinking-growth-paths";
import type { ContinuitySnapshot } from "@/lib/data/session-log";
import { inferLiveMathTurnAdaptation } from "@/lib/daily/math-adaptation";
import { getThemeQuestionLevel } from "@/lib/daily/theme-adaptation";
import { buildDailyChoiceScaffold } from "@/lib/daily/choice-scaffold";
import { buildDailyHumanLikeHints } from "@/lib/daily/child-language";
import { classifyDailyChildSignal } from "@/lib/daily/child-signal";
import { getThemeGoalMapping } from "@/lib/daily/theme-goal-mapping";
import type { DailyQuestion, DailyThemeId } from "@/types/daily";

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const THEME_ORDER: DailyThemeId[] = ["math", "pattern", "why", "fairness", "what-if"];

export function getDefaultDailyThemeId(seed = new Date().toISOString().slice(0, 10)): DailyThemeId {
  return THEME_ORDER[hashSeed(seed) % THEME_ORDER.length] ?? "math";
}

export function getDailyQuestion(questionId: string | undefined) {
  return questionId
    ? DAILY_QUESTION_BANK.find((question) => question.id === questionId)
    : undefined;
}

export function getQuestionsForTheme(themeId: DailyThemeId) {
  return DAILY_QUESTION_BANK.filter((question) => question.themeId === themeId);
}

export function selectDailyQuestion(options: {
  themeId?: DailyThemeId;
  questionId?: string;
  rotationSeed?: number | string;
}) {
  const requested = getDailyQuestion(options.questionId);
  if (requested) {
    return buildScenarioQuestionVariant(requested, options.rotationSeed);
  }

  const resolvedTheme = options.themeId ?? getDefaultDailyThemeId();
  const pool = getQuestionsForTheme(resolvedTheme);
  if (pool.length === 0) {
    return undefined;
  }

  const seed = typeof options.rotationSeed === "number"
    ? options.rotationSeed
    : hashSeed(String(options.rotationSeed ?? new Date().toISOString().slice(0, 10)));

  const selected = pool[Math.abs(seed) % pool.length];
  return selected
    ? buildScenarioQuestionVariant(selected, options.rotationSeed ?? seed)
    : undefined;
}

function buildInputHint(question: DailyQuestion, shouldOfferChoices: boolean) {
  if (shouldOfferChoices) {
    return "孩子这轮偏犹豫，优先用 show_choices 给 3 个容易开口的方向，再顺着她的选择追问。";
  }

  switch (question.suggestedInput) {
    case "choice":
      return "优先用 show_choices 给 3 个童趣选项，再根据孩子选择追一句更细的问题。";
    case "text":
      return "优先用 show_text_input，输入框提示要短，像是在请孩子补一句。";
    case "voice":
    default:
      return "优先用 request_voice 或 show_choices，让孩子先自然开口，再顺着她的话继续聊。";
  }
}

function buildScenarioTemplatePromptLines(question: DailyQuestion, turnIndex: number) {
  const template = getScenarioTemplateForQuestion(question);
  if (!template) return [];
  const render = (value: string) =>
    applyScenarioTemplateVariablesToText(value, template, question.scenarioVariables);
  const renderList = (values: string[]) => values.map(render);
  const selectedVariables = question.scenarioVariables
    ? Object.entries(question.scenarioVariables).map(([key, value]) => `${key}=${value}`).join("；")
    : "";
  const scaffoldOptions = renderList(template.scaffoldOptions);
  const conditionChanges = renderList(template.conditionChanges);
  const evidenceTargets = renderList(template.evidenceTargets);
  const currentStep = turnIndex <= 0
    ? `本轮只做开场：围绕“${render(template.openingQuestion)}”让孩子先给一个想法。`
    : turnIndex === 1
      ? `本轮只追证据：接孩子上一句，用“${scaffoldOptions[0] ?? "你为什么这样想？"}”或证据目标来听理由，不换新题。`
      : turnIndex === 2
        ? `本轮只做条件变化：用“${conditionChanges[0] ?? "如果情况变了，你会怎么改？"}”检查孩子会不会调整想法。`
        : `本轮准备收束：用“${render(template.wrapUpQuestion)}”请孩子总结规则、办法或修正；如果已经说清楚，可以 end_activity。`;

  return [
    "ScenarioTemplate 控制：",
    `模板ID：${template.id}`,
    ...(question.scenarioVariantKey ? [`变量变体：${question.scenarioVariantKey}`] : []),
    `场景类型：${template.scenarioType}`,
    `层级范围：L${template.levelRange[0]}-L${template.levelRange[1]}`,
    `目标 Thinking Moves：${template.targetThinkingMoves.map(getThinkingMoveLabel).join(" / ")}`,
    `允许替换变量：${template.variables.map((item) => `${item.label}=${item.examples.join("|")}`).join("；")}`,
    ...(selectedVariables ? [`本轮变量取值：${selectedVariables}`] : []),
    `图片 prompt：${render(template.imagePrompt)}`,
    `开场问题：${render(template.openingQuestion)}`,
    `支架选项：${scaffoldOptions.join(" / ")}`,
    `条件变化：${conditionChanges.join(" / ")}`,
    `证据目标：${evidenceTargets.join(" / ")}`,
    `收尾问题：${render(template.wrapUpQuestion)}`,
    `本题引导结论：孩子能围绕“${evidenceTargets.join(" / ")}”说出自己的理由、调整或小规则；不是换题，也不是追标准答案。`,
    `当前推进步骤：${currentStep}`,
    "连续性硬规则：一轮只推进路线中的一步；不要开新场景、不要突然换目标、不要把开场问题/支架/条件变化混在同一句里。",
    "动态生成边界：不要自由换成无关题；只能基于模板填变量、换相近生活场景、生成图片描述或轻微改写问题。",
  ];
}

export function buildDailyQuestionActivity(
  question: DailyQuestion,
  options?: {
    childInput?: string;
    turnIndex?: number;
    continuitySnapshot?: ContinuitySnapshot | null;
  },
) {
  const theme = getDailyThemeDefinition(question.themeId);
  const themeLevel = getThemeLevelDefinition(question.themeId, question.adaptationLevel ?? 1);
  const growthLevel = getThemeQuestionLevel(question);
  const playbook = getDailyThemePlaybook(question.themeId);
  const fallbackGoalMapping = getThemeGoalMapping(question.themeId, {
    progressionStageId: question.progressionStageId,
  });
  const turnIndex = options?.turnIndex ?? 0;
  const childSignal = options?.childInput
    ? classifyDailyChildSignal(question, options.childInput, turnIndex)
    : undefined;
  const mathTurnAdaptation = inferLiveMathTurnAdaptation({
    question,
    childInput: options?.childInput,
    turnIndex,
  });
  const effectiveMove = mathTurnAdaptation?.recommendedMove ?? childSignal?.suggestedMove ?? "open_question";
  const shouldDescribeChoices = Boolean(
    mathTurnAdaptation?.shouldOfferChoices ||
    childSignal?.shouldOfferChoices ||
    question.suggestedInput === "choice",
  );
  const choiceScaffold = shouldDescribeChoices
    ? buildDailyChoiceScaffold({
        question,
        move: effectiveMove,
        childInput: options?.childInput,
      })
    : undefined;

  const injectedBehavior = childSignal
    ? [
        `孩子这一轮的最新原话：${options?.childInput}`,
        `信号判断：${childSignal.type}`,
        `信号解释：${childSignal.summary}`,
        `建议动作：${effectiveMove}`,
        ...(mathTurnAdaptation
          ? [
              `数学即时难度判断：${mathTurnAdaptation.liveSignal}`,
              `数学即时解释：${mathTurnAdaptation.summary}`,
              `数学即时规则：${mathTurnAdaptation.promptRule}`,
            ]
          : []),
        ...buildDailyHumanLikeHints({
          question,
          childInput: options?.childInput,
          signal: childSignal,
        }),
      ]
    : [
        "当前还是开场轮。先把孩子拉进场景，不要急着像老师一样追问。",
        "优先用 question seed 开场，但你可以自然改写，不要像在念题库。",
        ...buildDailyHumanLikeHints({ question }),
      ];

  return [
    "当前模式：daily theme playbook。",
    buildBrainyVoiceGuideText(),
    "框架：MLIF（微跃迁启思框架）。",
    "MLIF 核心：先接住，先具体，只推半步，问题先于答案；但得到部分答案后，要先小结和儿童化讲解，再决定是否继续问。",
    ...buildThinkingGrowthPromptLines(question.themeId, growthLevel),
    ...buildScenarioTemplatePromptLines(question, turnIndex),
    `今日主题：${theme?.label ?? question.themeId}`,
    `主题简介：${theme?.summary ?? "和孩子一起想一想。"}`,
    ...(themeLevel
      ? [
          `当前主题层级：L${themeLevel.level} / ${themeLevel.title}`,
          `这一层想练：${themeLevel.childGoal}`,
          `往上走的信号：${themeLevel.signsOfReadiness.join(" / ")}`,
        ]
      : []),
    `后台映射：goal=${question.goalId} subGoal=${question.subGoalId} fallbackGoal=${fallbackGoalMapping?.goalId ?? question.goalId}`,
    `题目种子标题：${question.title}`,
    `场景画面：${buildBrainySceneSetup(question)}`,
    `林老师开场语气：${buildBrainySceneVoice(question)}`,
    `林老师为什么会想聊这个：${buildBrainySceneReason(question)}`,
    `开场种子问题：${question.mainQuestion}`,
    `可参考追问种子 1：${question.firstFollowUp}`,
    `可参考追问种子 2：${question.twistFollowUp}`,
    `教练焦点：${question.coachFocus}`,
    "重要：上面这些是 scene seed，不是死脚本。",
    "- 你不是题库，不要把它说成“现在进入下一题”。",
    "- 你不是讲课老师，不要长篇灌输；但孩子已经给出部分答案或理由后，必须用短句做小结和科普讲解。",
    "- 你可以改写、缩短、重组问题。",
    "- 你必须顺着孩子刚才的话来接，而不是机械进入固定下一问。",
    "- 你的目标不是把三个固定问题问完，而是沿着“开场想法 -> 理由证据 -> 林老师小结和讲解 -> 条件变化或自然收住”的路线往前走。",
    "- 每轮最多只抛一个新问题。",
    "- 每个问题必须让家长看得出你在收集哪一种证据：观察、理由、比较、预测、迁移或总结。",
    "- 引用孩子刚才说的关键词，再往前推半步。",
    "- 优先引用孩子的一小段想法，不要机械整句复读。",
    "- 如果孩子还没给答案，复述后接一个最自然的问题；如果孩子已经给出部分答案，复述后先讲清楚一个小概念，不要马上继续追问。",
    "- 语言要像在陪孩子聊，不要像在发题或批改；短讲解可以像讲一个小发现。",
    "- 不要跳成新的题目、工作纸或小游戏。",
    "- 禁止空泛接话：不要写“林老师在这里陪你”“好，我们先轻轻接住这一小步”“你现在想说什么”这类没有题意的话。",
    "- 如果刚调用 show_image，下一步输入工具的 prompt 必须直接问图里的任务，不能只让孩子随便说。",
    `主题目标：${playbook.childFacingGoal}`,
    `主题常用场景：${playbook.sceneLenses.join(" / ")}`,
    `主题锚点：${playbook.anchorMoves.join(" / ")}`,
    "主题动作说明：",
    ...Object.entries(playbook.moveGuidance).map(([move, guidance]) => `- ${move}: ${guidance}`),
    `鼓励语气：${playbook.warmPhrases.join(" / ")}`,
    `避免事项：${playbook.avoid.join(" / ")}`,
    `当前轮次：${turnIndex}`,
    ...(options?.continuitySnapshot
      ? [
          `连续记忆：${options.continuitySnapshot.memoryLine}`,
          "连续记忆只作为内部参考：不要照抄这段记忆，不要开场复盘上次内容。",
          "如果非常自然，最多用半句轻轻接上；如果会显得重复，就完全不提。",
        ]
      : []),
    ...injectedBehavior,
    ...(mathTurnAdaptation
      ? [
          `当前数学会话建议：${mathTurnAdaptation.summary}`,
          `当前数学会话执行规则：${mathTurnAdaptation.promptRule}`,
        ]
      : []),
    ...(choiceScaffold
      ? [
          `如果你要用 show_choices，优先像这样给具体思路：${choiceScaffold.prompt}`,
          ...choiceScaffold.choices.map((choice) =>
            `- ${choice.label}: ${choice.desc}${choice.badge ? `（${choice.badge}）` : ""}`,
          ),
          "不要给通用按钮，比如“继续”“再说一个”“给我提示”。要给真正能帮助孩子往前想的具体方向；视觉选项默认给 3 个。",
        ]
      : []),
    effectiveMove === "wrap_up"
      ? "如果孩子已经围绕当前话题连续想了几轮，就先用短总结 + 一句小科普收住，再 end_activity。"
      : "如果孩子还愿意继续，先判断是否该做阶段讲解；讲解后再只追一个最自然的点，不要贪多。",
    `输入偏好：${buildInputHint(question, childSignal?.shouldOfferChoices ?? false)}`,
  ].join("\n");
}
