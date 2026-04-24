import { extractChildMirrorPhrase } from "@/lib/daily/child-language";
import type { DailyCoachMove, DailyQuestion } from "@/types/daily";

export interface DailyChoiceOption {
  id: string;
  label: string;
  desc: string;
  badge?: string;
}

export interface DailyChoiceScaffold {
  prompt: string;
  choices: DailyChoiceOption[];
}

function buildMathOpenChoiceScaffold(question: DailyQuestion): DailyChoiceScaffold {
  switch (question.id) {
    case "math-rule-sentence-1":
      return {
        prompt: "我们先从哪个方向，把这个排法说成一句小规则？",
        choices: [
          { id: "math-rule-repeat", label: "先说重复块", desc: "先说哪一小段在一直重复", badge: "说规律" },
          { id: "math-rule-order", label: "先说顺序", desc: "先说它是按什么顺序轮到下一个", badge: "说顺序" },
        ],
      };
    case "math-seat-rule-1":
      return {
        prompt: "你想先定哪一类小规则，让摆椅子更顺？",
        choices: [
          { id: "math-seat-space", label: "先留走路位置", desc: "先想大家怎么走不会挤住", badge: "留空位" },
          { id: "math-seat-neat", label: "先定排法整齐", desc: "先想每排怎么摆更整齐", badge: "排整齐" },
        ],
      };
    case "math-stair-rule-1":
      return {
        prompt: "你想先把哪一部分说清楚，教别人这个办法？",
        choices: [
          { id: "math-stair-step", label: "先说怎么迈步", desc: "先说是一格一格还是有时候跨两格", badge: "怎么走" },
          { id: "math-stair-why", label: "先说为什么这样走", desc: "先说这样更快还是更稳", badge: "为什么" },
        ],
      };
    case "math-bridge-order-1":
      return {
        prompt: "过桥这件事，你想先从哪个方向想？",
        choices: [
          { id: "math-bridge-fast", label: "先想快一点", desc: "先看怎样能更快把大家送过去", badge: "快一点" },
          { id: "math-bridge-steady", label: "先想稳一点", desc: "先看谁先走会更稳当", badge: "稳一点" },
        ],
      };
    case "math-snack-transfer-1":
      return {
        prompt: "换成大小不一样的点心后，你想先从哪里看？",
        choices: [
          { id: "math-snack-same", label: "先看哪里还一样", desc: "先想昨天那个办法还留下了什么", badge: "先看一样" },
          { id: "math-snack-different", label: "先看哪里变了", desc: "先想大点心和小点心让什么不同了", badge: "先看变化" },
        ],
      };
    case "math-map-route-1":
      return {
        prompt: "路线突然变了，你想先从哪边重新想？",
        choices: [
          { id: "math-map-short", label: "先想少走路", desc: "先看看哪条路总共更短", badge: "少走路" },
          { id: "math-map-smooth", label: "先想少绕弯", desc: "先看看哪条路不容易来回折返", badge: "少绕弯" },
        ],
      };
    default:
      return {
        prompt: "我们先从哪个方向开始想，会更顺一点？",
        choices: [
          { id: "math-share", label: "先分一分", desc: "先让每个人手里都有一点", badge: "分一分" },
          { id: "math-count", label: "先算一算", desc: "先看看一共多少、还差多少", badge: "算一算" },
        ],
      };
  }
}

function buildMathCompareChoiceScaffold(question: DailyQuestion, childInput: string): DailyChoiceScaffold {
  const mirrorPhrase = extractChildMirrorPhrase(childInput);

  switch (question.id) {
    case "math-rule-sentence-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像想把哪部分说清楚？`,
        choices: [
          { id: "math-rule-repeat-idea", label: "更像在说重复", desc: "我想先说哪一段一直在重复", badge: "说重复" },
          { id: "math-rule-order-idea", label: "更像在说顺序", desc: "我想先说它是怎么轮到下一个", badge: "说顺序" },
        ],
      };
    case "math-seat-rule-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在先照顾哪一边？`,
        choices: [
          { id: "math-seat-space-idea", label: "更像先留空位", desc: "我先让大家走动更顺", badge: "留空位" },
          { id: "math-seat-neat-idea", label: "更像先摆整齐", desc: "我先让椅子排得更整齐", badge: "排整齐" },
        ],
      };
    case "math-stair-rule-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更想把哪一边教清楚？`,
        choices: [
          { id: "math-stair-step-idea", label: "更像先教怎么走", desc: "我先说脚步怎么迈", badge: "怎么走" },
          { id: "math-stair-why-idea", label: "更像先教为什么", desc: "我先说为什么这样更好", badge: "为什么" },
        ],
      };
    case "math-bridge-order-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在替大家想哪一边？`,
        choices: [
          { id: "math-bridge-fast-idea", label: "更像先想速度", desc: "我想让大家快一点过去", badge: "快一点" },
          { id: "math-bridge-steady-idea", label: "更像先想稳当", desc: "我想让桥上更稳一点", badge: "稳一点" },
        ],
      };
    case "math-snack-transfer-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在盯着哪一边？`,
        choices: [
          { id: "math-snack-same-idea", label: "更像在看哪里还一样", desc: "我在想昨天那个办法还能留下什么", badge: "看一样" },
          { id: "math-snack-different-idea", label: "更像在看哪里变了", desc: "我在想大小不同让什么不一样", badge: "看变化" },
        ],
      };
    case "math-map-route-1":
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在改哪一种路线？`,
        choices: [
          { id: "math-map-short-idea", label: "更像走更短的路", desc: "我先想怎样少走一点", badge: "少走路" },
          { id: "math-map-smooth-idea", label: "更像走更顺的路", desc: "我先想怎样少绕来绕去", badge: "少绕弯" },
        ],
      };
    default:
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像是在往哪边想？`,
        choices: [
          { id: "math-share-idea", label: "更像在分", desc: "我在想怎么让每个人手里都有一些", badge: "分一分" },
          { id: "math-count-idea", label: "更像在算", desc: "我在想剩多少、差多少", badge: "算一算" },
        ],
      };
  }
}

function buildOpenChoiceScaffold(question: DailyQuestion): DailyChoiceScaffold {
  switch (question.themeId) {
    case "math":
      return buildMathOpenChoiceScaffold(question);
    case "pattern":
      return {
        prompt: "我们先从哪里看，会更容易发现规律？",
        choices: [
          { id: "pattern-repeat", label: "先看重复", desc: "看看哪一小段一直在反复", badge: "找重复" },
          { id: "pattern-change", label: "先看变化", desc: "看看每次到底哪里不一样", badge: "看变化" },
        ],
      };
    case "why":
      return {
        prompt: "你想先从哪个方向开始猜？",
        choices: [
          { id: "why-cause", label: "先猜原因", desc: "先说一个最像的原因", badge: "找原因" },
          { id: "why-switch", label: "换个情况", desc: "想想条件变了会不会不一样", badge: "换一下" },
        ],
      };
    case "fairness":
      return {
        prompt: "我们先从哪个方向想“公平”？",
        choices: [
          { id: "fair-same", label: "先想一样多", desc: "先看看每个人拿到的是不是差不多", badge: "一样多" },
          { id: "fair-need", label: "先看情况", desc: "想想是不是有人更需要被照顾", badge: "看情况" },
        ],
      };
    case "what-if":
    default:
      return {
        prompt: "我们先从哪一步开始想“如果会怎样”？",
        choices: [
          { id: "whatif-result", label: "先猜变化", desc: "先说第一件会发生什么", badge: "先发生" },
          { id: "whatif-fix", label: "先想办法", desc: "先想要不要改规则或想新办法", badge: "想办法" },
        ],
      };
  }
}

function buildCompareChoiceScaffold(question: DailyQuestion, childInput: string): DailyChoiceScaffold {
  switch (question.themeId) {
    case "math":
      return buildMathCompareChoiceScaffold(question, childInput);
    case "pattern":
      {
        const mirrorPhrase = extractChildMirrorPhrase(childInput);
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你更像是在看哪一种？`,
        choices: [
          { id: "pattern-repeat-idea", label: "更像在看重复", desc: "我在想哪一小段一直一样", badge: "找重复" },
          { id: "pattern-change-idea", label: "更像在看变化", desc: "我在想每次哪里变了", badge: "看变化" },
        ],
      };
      }
    case "why":
      {
        const mirrorPhrase = extractChildMirrorPhrase(childInput);
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更偏向哪种想法？`,
        choices: [
          { id: "why-cause-idea", label: "更像在猜原因", desc: "我在想它为什么会这样", badge: "找原因" },
          { id: "why-switch-idea", label: "更像在换情况", desc: "我在想换一下会不会不同", badge: "换一下" },
        ],
      };
      }
    case "fairness":
      {
        const mirrorPhrase = extractChildMirrorPhrase(childInput);
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在照顾哪一边？`,
        choices: [
          { id: "fair-same-idea", label: "更像一样多", desc: "我先看分到的是不是一样", badge: "一样多" },
          { id: "fair-need-idea", label: "更像看情况", desc: "我在想谁更需要被照顾", badge: "看情况" },
        ],
      };
      }
    case "what-if":
    default:
      {
        const mirrorPhrase = extractChildMirrorPhrase(childInput);
      return {
        prompt: `你刚才提到“${mirrorPhrase}”。你现在更像在想哪一步？`,
        choices: [
          { id: "whatif-result-idea", label: "更像在猜结果", desc: "我先想第一件会发生什么", badge: "先发生" },
          { id: "whatif-fix-idea", label: "更像在想办法", desc: "我在想怎么改规则或处理", badge: "想办法" },
        ],
      };
      }
  }
}

export function buildDailyChoiceScaffold(options: {
  question: DailyQuestion;
  move: DailyCoachMove;
  childInput?: string;
}) {
  if (options.move === "compare_options" && options.childInput) {
    return buildCompareChoiceScaffold(options.question, options.childInput);
  }

  return buildOpenChoiceScaffold(options.question);
}
