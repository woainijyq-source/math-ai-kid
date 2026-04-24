import { getDailyThemePlaybook } from "@/content/daily/theme-playbooks";
import type { DailyChildSignal, DailyCoachMove, DailyQuestion } from "@/types/daily";

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function looksOffTopic(normalized: string) {
  return /(动画片|吃饭|晚饭|肚子饿|玩具|唱歌|随便聊|skip|hungry|dinner|toy|song)/i.test(normalized);
}

function looksResistant(normalized: string) {
  return /(不想|不要|不聊|不玩|不做|不说|烦|无聊)/i.test(normalized);
}

function looksUncertain(normalized: string) {
  return /^(不知道|不会|想不到|忘了|随便|嗯+)$|不知道|不会|想不出来/.test(normalized);
}

function looksReasoned(normalized: string) {
  return /(因为|所以|这样|先.*再|要是|如果|会|应该|比较|更)/.test(normalized);
}

function looksImaginative(normalized: string) {
  return /(也可以|或者|还可以|不然|我会|我想|也许|可能|可以先|可以把)/.test(normalized);
}

function moveForSignal(type: DailyChildSignal["type"], turnIndex: number): DailyCoachMove {
  if (turnIndex >= 3) {
    return "wrap_up";
  }

  switch (type) {
    case "resistant":
    case "off_topic":
      return "gentle_rehook";
    case "uncertain":
      return "scaffold_with_choices";
    case "brief_answer":
      return "clarify_reasoning";
    case "imaginative_answer":
      return turnIndex >= 2 ? "push_half_step" : "compare_options";
    case "reasoned_answer":
    default:
      return turnIndex >= 2 ? "push_half_step" : "compare_options";
  }
}

export function classifyDailyChildSignal(
  question: DailyQuestion,
  input: string,
  turnIndex: number,
): DailyChildSignal {
  const normalized = normalize(input);
  const playbook = getDailyThemePlaybook(question.themeId);

  let type: DailyChildSignal["type"] = "brief_answer";
  if (!normalized || normalized.length <= 2) {
    type = "brief_answer";
  } else if (looksResistant(normalized)) {
    type = "resistant";
  } else if (looksOffTopic(normalized)) {
    type = "off_topic";
  } else if (looksUncertain(normalized)) {
    type = "uncertain";
  } else if (looksReasoned(normalized) && looksImaginative(normalized)) {
    type = "imaginative_answer";
  } else if (looksReasoned(normalized) || normalized.length >= 18) {
    type = "reasoned_answer";
  } else if (looksImaginative(normalized)) {
    type = "imaginative_answer";
  }

  const suggestedMove = moveForSignal(type, turnIndex);

  const summaryMap: Record<DailyChildSignal["type"], string> = {
    brief_answer: "孩子给出了一个短回答，需要顺着她的话再追一个“为什么”或“怎么看出来”。",
    reasoned_answer: "孩子已经开始说理由，可以往前推半步，做比较或换条件。",
    imaginative_answer: "孩子在主动生成办法或新想法，适合比较两个可能，或换一个条件继续推。",
    uncertain: "孩子现在还没有把想法说出来，适合降压力、给两个简单方向帮助她开口。",
    off_topic: "孩子的话题偏离了当前问题，先接住，再轻轻拉回原来的场景。",
    resistant: "孩子现在不太想继续，需要先降低压力，再温柔重连，而不是继续追问。",
  };

  return {
    type,
    summary: `${summaryMap[type]} 当前主题提醒：${playbook.childFacingGoal}`,
    suggestedMove,
    shouldOfferChoices: suggestedMove === "scaffold_with_choices",
  };
}
