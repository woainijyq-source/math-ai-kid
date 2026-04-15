import { mathProgressionStages } from "@/content/math-progression";
import type {
  CoCreateSceneConfig,
  OpponentSceneConfig,
  StorySceneConfig,
  TaskMode,
} from "@/types";

export const opponentScenes: Record<string, OpponentSceneConfig> = {
  moonstone_balance: {
    id: "moonstone_balance",
    mode: "opponent",
    title: "月石平衡局",
    intro:
      "桌上有 7 颗月石。你和我轮流拿，每次只能拿 1 颗或 2 颗。谁拿走最后一颗，谁就赢。",
    introSpeakable:
      "桌上有七颗月石。你和我轮流拿，每次只能拿一颗或两颗。谁拿走最后一颗，谁就赢。",
    hint: "先观察每一回合结束后，桌上还剩几颗。",
    actionLabels: {
      takeOne: {
        label: "拿 1 颗",
        description: "先稳稳地看局面变化。",
        userLine: "我这回合先拿 1 颗，想看看你会怎么应对。",
      },
      takeTwo: {
        label: "拿 2 颗",
        description: "更主动地把局面往前推。",
        userLine: "我这回合想先拿 2 颗，试试看会不会更接近稳赢。",
      },
    },
    voicePrompt: "可以直接说“我拿一颗”或“我拿两颗”。",
    learning: {
      stageId: "foundation-observe",
      childGoal: "先看剩下几颗，再决定拿几颗。",
      adultNote: "重点不是赢，而是能不能先观察数量变化，再行动。",
      aiExpansionPrompt:
        "围绕数量变化、剩余数量和下一步判断，扩写短句提示，不要引入复杂规则。",
      skills: ["观察与计数", "模式识别"],
    },
    completionHighlights: ["孩子完成了一整轮对抗。", "开始通过剩余数量判断局面。"],
  },
  lantern_steps: {
    id: "lantern_steps",
    mode: "opponent",
    title: "灯阶抢先局",
    intro:
      "台阶上有 8 盏小灯。你和我轮流点亮，每次只能点亮 1 盏或 2 盏。谁点亮最后一盏，谁就赢。",
    introSpeakable:
      "台阶上有八盏小灯。你和我轮流点亮，每次只能点亮一盏或两盏。谁点亮最后一盏，谁就赢。",
    hint: "注意每次点亮后，台阶上还空着多少盏。",
    actionLabels: {
      takeOne: {
        label: "点亮 1 盏",
        description: "慢一点看清变化。",
        userLine: "我这回合先点亮 1 盏，想看清接下来怎么走。",
      },
      takeTwo: {
        label: "点亮 2 盏",
        description: "更快推进节奏。",
        userLine: "我这回合先点亮 2 盏，看看能不能把节奏握在手里。",
      },
    },
    voicePrompt: "可以直接说“点一盏”或“点两盏”。",
    learning: {
      stageId: "strategy-pattern",
      childGoal: "试着让下一回合留下你想要的数量。",
      adultNote: "比起会不会赢，更看孩子有没有开始提前想下一步。",
      aiExpansionPrompt:
        "围绕提前规划和局面控制扩写短反馈，保持幼儿可理解的句子长度。",
      skills: ["模式识别", "策略规划", "多步推演"],
    },
    completionHighlights: ["孩子开始提前想下一步。", "对局面控制的意识更清楚了。"],
  },
};

export const coCreateScenes: Record<string, CoCreateSceneConfig> = {
  explain_before_move: {
    id: "explain_before_move",
    mode: "co-create",
    title: "先说理由再行动",
    intro: "今天我们一起发明一条新规则。规则越清楚，挑战就越有趣。",
    introSpeakable: "今天我们一起发明一条新规则。规则越清楚，挑战就越有趣。",
    hint: "先想想，你希望玩家每次行动前必须做到什么。",
    starterRules: [
      "每次行动前都要先说出理由。",
      "赢的人要反过来教对方一个办法。",
      "每一回合只能改变一条规则。",
    ],
    fragments: ["先说理由", "轮到对方也能追问", "输的人得到一次重来机会"],
    placeholder: "先说一句你想发明的规则...",
    submitLabel: "生成挑战",
    learning: {
      stageId: "rules-expression",
      childGoal: "把一个模糊想法说成真的能玩的规则。",
      adultNote: "观察孩子能否说清条件、顺序和限制，而不是只给出模糊点子。",
      aiExpansionPrompt:
        "沿着儿童提出的规则，扩写成一条清楚、可执行、带条件的短规则。",
      skills: ["规则表达", "条件约束"],
    },
    completionHighlights: ["孩子主动定义了一条新规则。", "开始用条件来约束玩法。"],
  },
  swap_the_winner: {
    id: "swap_the_winner",
    mode: "co-create",
    title: "赢家要反过来教人",
    intro:
      "如果一条规则不只是决定谁赢，还能决定赢了之后要做什么，会发生什么？",
    introSpeakable:
      "如果一条规则不只是决定谁赢，还能决定赢了之后要做什么，会发生什么？",
    hint: "试着想一种会改变游戏气氛的新规则。",
    starterRules: [
      "赢家要教对方一个办法。",
      "输了的人可以提出一个新条件。",
      "每回合结束都要换一种走法。",
    ],
    fragments: ["赢家要回应", "输的人也能提问", "下一轮规则要变化"],
    placeholder: "说说你想让输赢之后发生什么...",
    submitLabel: "试试这条规则",
    learning: {
      stageId: "rules-expression",
      childGoal: "理解一条规则会怎样改变整个游戏。",
      adultNote:
        "看孩子是否开始意识到，规则不是一句口号，而是会改变结果和互动方式。",
      aiExpansionPrompt:
        "把儿童提出的赢后规则扩写成结果明确、后续动作明确的挑战。",
      skills: ["规则表达", "条件约束", "策略规划"],
    },
    completionHighlights: ["孩子开始看到规则会改变互动方式。", "共创内容更接近可执行玩法。"],
  },
};

export const storyScenes: Record<string, StorySceneConfig> = {
  mist_town_route: {
    id: "mist_town_route",
    mode: "story",
    title: "迷雾小镇路线",
    intro:
      "你站在迷雾小镇入口，钟楼传来三段不同节奏的信号。你的每一次选择，都会让小镇变得不一样。",
    introSpeakable:
      "你站在迷雾小镇入口，钟楼传来三段不同节奏的信号。你的每一次选择，都会让小镇变得不一样。",
    hint: "先想想，谁会因为你的决定受到影响。",
    worldLineLabel: "路标世界线",
    worldLineSummary: "你在这条线里决定：小镇最终会留下怎样的安全路线。",
    choiceSets: [
      [
        {
          label: "先去桥边灯塔",
          description: "优先确认最远处的引导光。",
          value: "先去桥边灯塔",
          badge: "看远处",
        },
        {
          label: "借给旅人一盏灯",
          description: "先帮助眼前最需要帮助的人。",
          value: "借给旅人一盏灯",
          badge: "先帮人",
        },
        {
          label: "先回营地拿地图",
          description: "先补足信息，再决定往哪里走。",
          value: "先回营地拿地图",
          badge: "先补信息",
        },
      ],
      [
        {
          label: "追着钟声走",
          description: "先追最明显的新线索。",
          value: "追着钟声走",
          badge: "追线索",
        },
        {
          label: "停下来问路",
          description: "先向路边的人确认情况。",
          value: "停下来问路",
          badge: "先询问",
        },
        {
          label: "躲进屋檐观察",
          description: "先不暴露自己，看看周围变化。",
          value: "躲进屋檐观察",
          badge: "先观察",
        },
      ],
      [
        {
          label: "点亮路标",
          description: "把你看到的线索变成别人也能看见的路。",
          value: "点亮路标",
          badge: "留下路",
        },
        {
          label: "把灯交给旅人",
          description: "优先让另一个角色安全离开。",
          value: "把灯交给旅人",
          badge: "先护送",
        },
        {
          label: "带着地图回钟楼",
          description: "把收集到的信息重新带回中心。",
          value: "带着地图回钟楼",
          badge: "回中心",
        },
      ],
    ],
    learning: {
      stageId: "story-reasoning",
      childGoal: "连续做几次选择，并看懂它们带来的后果。",
      adultNote: "重点看孩子会不会开始推测选择的后果，而不是只挑看起来最热闹的按钮。",
      aiExpansionPrompt:
        "在固定剧情骨架内扩写短剧情细节，突出选择与后果的因果关系。",
      skills: ["因果推理", "多步推演"],
    },
    completionHighlights: ["孩子连续完成了多个剧情决策点。", "开始感觉到选择会改变结果。"],
  },
  clock_tower_signal: {
    id: "clock_tower_signal",
    mode: "story",
    title: "钟楼信号追踪",
    intro:
      "钟楼顶端亮起忽明忽暗的信号。你要决定先追光、先问人，还是先回去找线索。",
    introSpeakable:
      "钟楼顶端亮起忽明忽暗的信号。你要决定先追光、先问人，还是先回去找线索。",
    hint: "每次选之前，先猜猜下一步会发生什么。",
    worldLineLabel: "信号世界线",
    worldLineSummary: "你在这条线里决定：信号会变成慌乱，还是变成大家都看得懂的提示。",
    choiceSets: [
      [
        {
          label: "追着光跑",
          description: "用最快的方式靠近新线索。",
          value: "追着光跑",
          badge: "快速靠近",
        },
        {
          label: "先问守夜人",
          description: "先补信息，再决定追不追。",
          value: "先问守夜人",
          badge: "先打听",
        },
        {
          label: "回去看旧地图",
          description: "把旧线索和新信号放在一起看。",
          value: "回去看旧地图",
          badge: "对照线索",
        },
      ],
      [
        {
          label: "沿着河边走",
          description: "顺着最亮的反光前进。",
          value: "沿着河边走",
          badge: "跟着反光",
        },
        {
          label: "停下听声音",
          description: "用声音判断方向。",
          value: "停下听声音",
          badge: "先听",
        },
        {
          label: "回头确认脚印",
          description: "看看刚才有没有忽略信息。",
          value: "回头确认脚印",
          badge: "回看",
        },
      ],
      [
        {
          label: "把发现告诉大家",
          description: "让更多人能一起判断。",
          value: "把发现告诉大家",
          badge: "共享信息",
        },
        {
          label: "自己先去验证",
          description: "先确认再公布。",
          value: "自己先去验证",
          badge: "先验证",
        },
        {
          label: "留下一张提醒卡",
          description: "把线索变成别人也能用的信息。",
          value: "留下一张提醒卡",
          badge: "留下提示",
        },
      ],
    ],
    learning: {
      stageId: "story-reasoning",
      childGoal: "在故事里学会先猜后果，再做决定。",
      adultNote: "观察孩子是否开始把前后信息连起来，而不是只盯着当前画面。",
      aiExpansionPrompt:
        "围绕线索追踪和后果推理扩写剧情，不改变既定分支结构。",
      skills: ["因果推理", "多步推演", "策略规划"],
    },
    completionHighlights: ["孩子开始把前后线索连起来。", "剧情选择更有预判感了。"],
  },
  market_bridge_bargain: {
    id: "market_bridge_bargain",
    mode: "story",
    title: "桥市交换风向",
    intro:
      "桥市今天只开半边摊位。风铃一会儿响左边，一会儿响右边。你要决定先换东西、先问清规则，还是先观察谁最着急。",
    introSpeakable:
      "桥市今天只开半边摊位。风铃一会儿响左边，一会儿响右边。你要决定先换东西、先问清规则，还是先观察谁最着急。",
    hint: "想一想：如果你先帮了一个人，别的人会发生什么变化？",
    worldLineLabel: "交换世界线",
    worldLineSummary: "你在这条线里决定：桥市会变得更公平，还是更混乱。",
    choiceSets: [
      [
        {
          label: "先帮最着急的人",
          description: "先看谁马上就会卡住。",
          value: "先帮最着急的人",
          badge: "先救急",
        },
        {
          label: "先问今天的交换规则",
          description: "先弄清楚大家到底按什么顺序换。",
          value: "先问今天的交换规则",
          badge: "先问规则",
        },
        {
          label: "先数清摊位开了几个",
          description: "先看资源够不够，再决定要不要交换。",
          value: "先数清摊位开了几个",
          badge: "先数资源",
        },
      ],
      [
        {
          label: "把队伍分成两边",
          description: "试着让等待更短一点。",
          value: "把队伍分成两边",
          badge: "分流",
        },
        {
          label: "让每人先说要换什么",
          description: "先把信息说清楚，再行动。",
          value: "让每人先说要换什么",
          badge: "先说明",
        },
        {
          label: "先去找少掉的那件物品",
          description: "先补关键缺口。",
          value: "先去找少掉的那件物品",
          badge: "补缺口",
        },
      ],
      [
        {
          label: "画出新的交换顺序牌",
          description: "让后面的人也能照着走。",
          value: "画出新的交换顺序牌",
          badge: "留下顺序",
        },
        {
          label: "把最后一件让给最晚到的人",
          description: "先考虑整体公平。",
          value: "把最后一件让给最晚到的人",
          badge: "看公平",
        },
        {
          label: "请大家一起改规则",
          description: "让桥市下次不再乱。",
          value: "请大家一起改规则",
          badge: "改规则",
        },
      ],
    ],
    learning: {
      stageId: "story-reasoning",
      childGoal: "在多个人都受影响的情况下，判断怎样做会更公平、更顺。",
      adultNote: "重点看孩子会不会开始考虑多人影响，而不是只看自己眼前那一步。",
      aiExpansionPrompt:
        "围绕公平、顺序和资源分配扩写剧情细节，突出选择会怎样影响不同角色。",
      skills: ["因果推理", "多步推演", "策略规划"],
    },
    completionHighlights: ["孩子开始考虑不止一个人的后果。", "会把顺序和公平一起放进判断里。"],
  },
  river_boat_rescue: {
    id: "river_boat_rescue",
    mode: "story",
    title: "河湾小舟求援",
    intro:
      "河湾里有一条小舟被雾困住了。岸边的人都在喊，但每个人说的方向都不一样。你要先看水流、先听求救声，还是先找岸上的记号？",
    introSpeakable:
      "河湾里有一条小舟被雾困住了。岸边的人都在喊，但每个人说的方向都不一样。你要先看水流、先听求救声，还是先找岸上的记号？",
    hint: "先猜一猜：你优先看的那条线索，最可能把你带去哪里？",
    worldLineLabel: "河湾世界线",
    worldLineSummary: "你在这条线里决定：河湾会留下新的救援办法，还是继续靠碰运气。",
    choiceSets: [
      [
        {
          label: "先看水流方向",
          description: "先判断船可能会漂向哪里。",
          value: "先看水流方向",
          badge: "看流向",
        },
        {
          label: "先听求救声远近",
          description: "先用声音判断距离。",
          value: "先听求救声远近",
          badge: "听远近",
        },
        {
          label: "先找岸上的旧记号",
          description: "先看看以前有没有人留过办法。",
          value: "先找岸上的旧记号",
          badge: "找旧线索",
        },
      ],
      [
        {
          label: "沿着最缓的水边走",
          description: "先去最可能靠岸的地方。",
          value: "沿着最缓的水边走",
          badge: "找靠岸点",
        },
        {
          label: "让岸上的人同时挥灯",
          description: "先做一个更清楚的方向信号。",
          value: "让岸上的人同时挥灯",
          badge: "做信号",
        },
        {
          label: "回头核对两条线索",
          description: "不急着走，先把信息合起来。",
          value: "回头核对两条线索",
          badge: "先核对",
        },
      ],
      [
        {
          label: "留下河边救援标记",
          description: "让下次的人更快找到正确位置。",
          value: "留下河边救援标记",
          badge: "留下办法",
        },
        {
          label: "带船上的人回营地讲经过",
          description: "把这次判断过程带回去。",
          value: "带船上的人回营地讲经过",
          badge: "带回经验",
        },
        {
          label: "把三个线索画成地图",
          description: "让这次救援变成以后都能用的图。",
          value: "把三个线索画成地图",
          badge: "画地图",
        },
      ],
    ],
    learning: {
      stageId: "story-reasoning",
      childGoal: "把不同线索放在一起判断，再决定最有把握的行动。",
      adultNote: "观察孩子会不会先整合多条线索，而不是被最响亮的信息牵着走。",
      aiExpansionPrompt:
        "围绕线索整合和救援后果扩写剧情细节，突出信息之间如何互相验证。",
      skills: ["因果推理", "多步推演", "策略规划"],
    },
    completionHighlights: ["孩子开始把多条线索放在一起看。", "会把一次判断变成可以留下来的方法。"],
  },
};

export const storySceneOrder = [
  "mist_town_route",
  "clock_tower_signal",
  "market_bridge_bargain",
  "river_boat_rescue",
] as const;

export const defaultSceneByMode: Record<TaskMode, string> = {
  opponent: "moonstone_balance",
  "co-create": "explain_before_move",
  story: "mist_town_route",
};

export function getOpponentScene(sceneId?: string) {
  return (sceneId && opponentScenes[sceneId]) || opponentScenes[defaultSceneByMode.opponent];
}

export function getCoCreateScene(sceneId?: string) {
  return (
    (sceneId && coCreateScenes[sceneId]) ||
    coCreateScenes[defaultSceneByMode["co-create"]]
  );
}

export function getStoryScene(sceneId?: string) {
  return (sceneId && storyScenes[sceneId]) || storyScenes[defaultSceneByMode.story];
}

export function getNextStorySceneId(sceneId?: string) {
  const currentIndex = sceneId ? storySceneOrder.indexOf(sceneId as (typeof storySceneOrder)[number]) : -1;

  if (currentIndex === -1) {
    return storySceneOrder[0];
  }

  return storySceneOrder[(currentIndex + 1) % storySceneOrder.length];
}

export function getDefaultScene(mode: TaskMode) {
  switch (mode) {
    case "opponent":
      return getOpponentScene();
    case "co-create":
      return getCoCreateScene();
    case "story":
      return getStoryScene();
  }
}

export function getSceneByMode(mode: TaskMode, sceneId?: string) {
  switch (mode) {
    case "opponent":
      return getOpponentScene(sceneId);
    case "co-create":
      return getCoCreateScene(sceneId);
    case "story":
      return getStoryScene(sceneId);
  }
}

export function getSceneStageSummary(mode: TaskMode) {
  const scene = getDefaultScene(mode);
  return mathProgressionStages[scene.learning.stageId];
}

export function getSceneCountByMode(mode: TaskMode) {
  switch (mode) {
    case "opponent":
      return Object.keys(opponentScenes).length;
    case "co-create":
      return Object.keys(coCreateScenes).length;
    case "story":
      return Object.keys(storyScenes).length;
  }
}
