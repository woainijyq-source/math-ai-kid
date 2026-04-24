import { buildBrainyVoiceGuideText } from "@/content/daily/brainy-voice-guide";
import { DAILY_QUESTION_BANK } from "@/content/daily/daily-question-bank";
import { getDailyThemeDefinition } from "@/content/daily/theme-definitions";
import { getThemeLevelDefinition } from "@/content/daily/theme-level-definitions";
import { getDailyThemePlaybook } from "@/content/daily/theme-playbooks";
import { buildBrainySceneReason, buildBrainySceneSetup, buildBrainySceneVoice } from "@/lib/daily/brainy-voice";
import type { ContinuitySnapshot } from "@/lib/data/session-log";
import { inferLiveMathTurnAdaptation } from "@/lib/daily/math-adaptation";
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
    return requested;
  }

  const resolvedTheme = options.themeId ?? getDefaultDailyThemeId();
  const pool = getQuestionsForTheme(resolvedTheme);
  if (pool.length === 0) {
    return undefined;
  }

  const seed = typeof options.rotationSeed === "number"
    ? options.rotationSeed
    : hashSeed(String(options.rotationSeed ?? new Date().toISOString().slice(0, 10)));

  return pool[Math.abs(seed) % pool.length];
}

function buildInputHint(question: DailyQuestion, shouldOfferChoices: boolean) {
  if (shouldOfferChoices) {
    return "孩子这轮偏犹豫，优先用 show_choices 给两个容易开口的方向，再顺着她的选择追问。";
  }

  switch (question.suggestedInput) {
    case "choice":
      return "优先用 show_choices 给 2-3 个童趣选项，再根据孩子选择追一句更细的问题。";
    case "text":
      return "优先用 show_text_input，输入框提示要短，像是在请孩子补一句。";
    case "voice":
    default:
      return "优先用 request_voice 或 show_choices，让孩子先自然开口，再顺着她的话继续聊。";
  }
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
    "MLIF 核心：先接住，先具体，只推半步，问题先于答案，支架要轻，收尾要迁移。",
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
    `脑脑开场语气：${buildBrainySceneVoice(question)}`,
    `脑脑为什么会想聊这个：${buildBrainySceneReason(question)}`,
    `开场种子问题：${question.mainQuestion}`,
    `可参考追问种子 1：${question.firstFollowUp}`,
    `可参考追问种子 2：${question.twistFollowUp}`,
    `教练焦点：${question.coachFocus}`,
    "重要：上面这些是 scene seed，不是死脚本。",
    "- 你不是题库，不要把它说成“现在进入下一题”。",
    "- 你不是老师，不要长篇解释概念或做知识点总结。",
    "- 你可以改写、缩短、重组问题。",
    "- 你必须顺着孩子刚才的话来接，而不是机械进入固定下一问。",
    "- 你的目标不是把三个固定问题问完，而是让孩子觉得你真的在听。",
    "- 每轮最多只抛一个新问题。",
    "- 引用孩子刚才说的关键词，再往前推半步。",
    "- 优先引用孩子的一小段想法，不要机械整句复读。",
    "- 复述后立刻接一个最自然的问题，不要堆两三个追问。",
    "- 语言要像在陪孩子聊，不要像在发题、讲题或批改。",
    "- 不要跳成新的题目、工作纸或小游戏。",
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
          `如果要轻轻接上昨天/上次，可以这样开口：${options.continuitySnapshot.gentleOpen}`,
          "连续记忆只轻轻提一句就够，不要一直重复，也不要像在复盘作业。",
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
          `如果你要用 show_choices，优先像这样给两个思路：${choiceScaffold.prompt}`,
          ...choiceScaffold.choices.map((choice) =>
            `- ${choice.label}: ${choice.desc}${choice.badge ? `（${choice.badge}）` : ""}`,
          ),
          "不要给通用按钮，比如“继续”“再说一个”“给我提示”。要给真正能帮助孩子往前想的两个方向。",
        ]
      : []),
    effectiveMove === "wrap_up"
      ? "如果孩子已经围绕当前话题连续想了几轮，就先用一句短总结收住，再 end_activity。"
      : "如果孩子还愿意继续，就只追一个最自然的点，不要贪多。",
    `输入偏好：${buildInputHint(question, childSignal?.shouldOfferChoices ?? false)}`,
  ].join("\n");
}
