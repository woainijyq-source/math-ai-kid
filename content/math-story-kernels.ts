import type { MathKernelId, MathTaskKernel, StoryOptionSeed } from "@/types";

function option(
  id: string,
  label: string,
  description: string,
  mathMove: string,
): StoryOptionSeed {
  return { id, label, description, mathMove };
}

export const mathStoryKernels: Record<MathKernelId, MathTaskKernel> = {
  "quantity-allocation": {
    id: "quantity-allocation",
    title: "数量分配",
    publicTitle: "怎么分更公平",
    mathGoal: "在有限资源下比较不同分配方案，权衡公平与效率。",
    childFacingHook: "不是随便选，而是先想谁需要多少、怎么分才更合理。",
    skillFocus: ["数量关系与分配", "因果推理", "策略规划"],
    variables: [
      { key: "resource", label: "可分配资源", description: "本轮可以分给不同角色的物品数量。" },
      { key: "roles", label: "受影响角色", description: "谁会因为你的分配而得到帮助或吃亏。" },
    ],
    constraints: [
      { key: "limited_supply", label: "资源有限", description: "所有人都想要，但手上不够全部满足。" },
      { key: "tradeoff", label: "必须取舍", description: "顾到一个人，就可能暂时顾不到另一个人。" },
    ],
    aiDirectorPrompt:
      "把资源分配问题包装成剧情冲突。AI 要追问孩子为什么这样分，而不是立刻给对错。",
    aiEvaluationFocus: ["是否先比较数量", "是否考虑公平", "是否能解释取舍理由"],
    successSignal: "孩子开始主动比较不同分法的后果，而不是凭感觉挑一个。",
    frames: [
      {
        id: "observe-demand",
        childPrompt: "先看谁需要什么，再决定第一步帮谁。",
        directorNote: "第一轮先让孩子观察与比较，不直接进入答案。",
        optionSeeds: [
          option("compare-needs", "先比谁更急", "先看看谁现在最需要帮助。", "比较需求大小"),
          option("count-supplies", "先数手里够不够", "先确认手上的东西够分几次。", "估计资源总量"),
          option("ask-roles", "先问每个人要多少", "先把不同角色的需求听清楚。", "收集约束条件"),
        ],
        followUpQuestion: "如果你先帮这一边，另一边会发生什么？",
      },
      {
        id: "test-allocation",
        childPrompt: "选一种分法，让世界先往前动一下。",
        directorNote: "第二轮让 AI 根据孩子的分法放大后果。",
        optionSeeds: [
          option("split-evenly", "平均分一分", "先把资源尽量平均分给大家。", "尝试公平分配"),
          option("prioritise-risk", "先救最危险的", "先把资源给最容易出问题的人。", "优先级排序"),
          option("hold-one-back", "留一部分备用", "先分一部分，留一点应对后面变化。", "保留缓冲量"),
        ],
        followUpQuestion: "这种分法有没有让某个人一直被忽略？",
      },
      {
        id: "explain-tradeoff",
        childPrompt: "说清楚你为什么觉得这次分法更合理。",
        directorNote: "第三轮重点是解释，不是答案。",
        optionSeeds: [
          option("justify-fairness", "因为这样更公平", "说说你觉得公平体现在哪里。", "解释公平标准"),
          option("justify-efficiency", "因为这样更快解决问题", "说说为什么这样能更快推进。", "解释效率理由"),
          option("justify-balance", "因为这样两边都顾到了", "说说你怎么平衡了不同角色。", "解释平衡策略"),
        ],
        followUpQuestion: "如果资源再少一点，你还会坚持同样的分法吗？",
      },
    ],
  },
  "pattern-routing": {
    id: "pattern-routing",
    title: "规律找路",
    publicTitle: "顺着规律找路线",
    mathGoal: "从重复信号里找规律，并用规律判断下一步方向。",
    childFacingHook: "不是乱走，而是先看灯、声音、标记到底在重复什么。",
    skillFocus: ["规律识别", "因果推理", "多步推演"],
    variables: [
      { key: "signals", label: "线索信号", description: "灯光、钟声、脚印等重复出现的信息。" },
      { key: "route", label: "路线变化", description: "不同路径会通向不同的结果。" },
    ],
    constraints: [
      { key: "partial_info", label: "信息不完整", description: "每次只能看到一部分线索，必须边走边判断。" },
      { key: "pattern_hidden", label: "规律被藏起来", description: "需要比较多次出现的信号才能发现规律。" },
    ],
    aiDirectorPrompt:
      "把规律识别变成寻路剧情。AI 要通过追问引导孩子说出看到了什么重复信号。",
    aiEvaluationFocus: ["是否观察重复", "是否用规律预测下一步", "是否能说出判断依据"],
    successSignal: "孩子开始主动说“我发现它一直这样出现”。",
    frames: [
      {
        id: "spot-pattern",
        childPrompt: "先找出哪种信号在重复出现。",
        directorNote: "先让孩子看模式，不急着选方向。",
        optionSeeds: [
          option("follow-light", "看灯光顺序", "先看灯是一亮一暗，还是一直同样闪。", "识别视觉规律"),
          option("follow-sound", "听钟声节奏", "先听声音有没有固定节奏。", "识别听觉规律"),
          option("check-footprints", "比一比脚印间隔", "先看留下的痕迹是不是等距出现。", "比较间隔模式"),
        ],
        followUpQuestion: "你发现的规律，下一步最可能把你带去哪里？",
      },
      {
        id: "predict-route",
        childPrompt: "根据你刚发现的规律，预测下一步路线。",
        directorNote: "第二轮重点是从规律走向预测。",
        optionSeeds: [
          option("predict-next-light", "顺着下一盏灯走", "按你看到的顺序预测下一盏会亮在哪。", "用规律预测位置"),
          option("predict-turn", "在该转弯的地方转", "按节奏推测下一次该转弯的时机。", "用规律预测动作"),
          option("test-alternative", "先验证另一条路", "先用另一条路确认你的规律有没有猜错。", "用反例验证规律"),
        ],
        followUpQuestion: "如果这一步猜错了，说明刚才看到的规律哪里不够稳？",
      },
      {
        id: "explain-pattern",
        childPrompt: "说说你为什么觉得这条路更对。",
        directorNote: "第三轮把模式观察变成可表达的理由。",
        optionSeeds: [
          option("because-repeat", "因为它一直重复", "把你看到的重复点说出来。", "表达规律"),
          option("because-match", "因为它和前面都对上了", "说说新线索怎样和旧线索对上。", "对照验证"),
          option("because-eliminate", "因为别的路更不像", "说说你是怎么排除其他路的。", "排除法表达"),
        ],
        followUpQuestion: "下次遇到新的信号，你会先观察哪一类规律？",
      },
    ],
  },
  "constraint-elimination": {
    id: "constraint-elimination",
    title: "条件排除",
    publicTitle: "排掉不可能的答案",
    mathGoal: "同时看多个条件，逐步排除不合理选项。",
    childFacingHook: "不是凭直觉猜，而是先把不可能的路一条条排掉。",
    skillFocus: ["逻辑推理", "条件约束", "多步推演"],
    variables: [
      { key: "clues", label: "线索条件", description: "每一轮都会出现新的限制条件。" },
      { key: "options", label: "可选方案", description: "有的方案看起来很像，但并不都满足条件。" },
    ],
    constraints: [
      { key: "must-satisfy-all", label: "必须同时满足", description: "不是只符合一个条件就可以。" },
      { key: "false-leads", label: "会有干扰项", description: "有些选项看起来明显，但其实违反别的条件。" },
    ],
    aiDirectorPrompt:
      "把排除法做成侦探式剧情。AI 要不断加条件，并让孩子说明为什么某个选项不行。",
    aiEvaluationFocus: ["是否主动排除", "是否检查多个条件", "是否能说明不选的理由"],
    successSignal: "孩子开始主动说“这个不行，因为它不满足前面那个条件”。",
    frames: [
      {
        id: "collect-clues",
        childPrompt: "先把条件听清楚，不急着选。",
        directorNote: "第一轮强调收集限制条件。",
        optionSeeds: [
          option("repeat-clues", "先重复一遍条件", "先把听到的条件整理清楚。", "整理约束"),
          option("mark-impossible", "先划掉明显不可能的", "先排除最不符合条件的那条。", "快速排除"),
          option("compare-two", "先比最像的两条", "先看哪两个最需要仔细比较。", "缩小候选范围"),
        ],
        followUpQuestion: "哪一个条件最先帮你排掉了一个选项？",
      },
      {
        id: "narrow-options",
        childPrompt: "把剩下的选项继续缩小。",
        directorNote: "第二轮让 AI 根据孩子选择追加一条条件。",
        optionSeeds: [
          option("use-new-clue", "用新条件再排一次", "把新出现的限制加进去再看。", "迭代排除"),
          option("test-one-option", "专门检查一个选项", "看这一条是不是同时满足全部条件。", "逐项验证"),
          option("switch-focus", "换一个角度比较", "从位置、顺序或数量换一个维度看。", "切换比较维度"),
        ],
        followUpQuestion: "如果再多一个条件，你觉得哪条会最先被排掉？",
      },
      {
        id: "state-proof",
        childPrompt: "说清楚为什么留下这一条。",
        directorNote: "第三轮要求孩子表达证据链。",
        optionSeeds: [
          option("because-all-fit", "因为它全都符合", "说说它怎样同时满足每个条件。", "完整验证"),
          option("because-others-fail", "因为另外两条都不行", "说说别的选项分别卡在哪里。", "反证表达"),
          option("because-last-clue", "因为最后那条线索把它定住了", "说说哪条线索最关键。", "关键证据识别"),
        ],
        followUpQuestion: "下次碰到更多条件时，你会先排哪一种？",
      },
    ],
  },
  "multi-step-planning": {
    id: "multi-step-planning",
    title: "多步计划",
    publicTitle: "先想两步再行动",
    mathGoal: "在连续行动中提前规划顺序，判断哪一步该先做。",
    childFacingHook: "不是只看眼前这一步，而是想一想后面还会发生什么。",
    skillFocus: ["策略规划", "多步推演", "因果推理"],
    variables: [
      { key: "sequence", label: "行动顺序", description: "先做哪一步会影响后面还能不能继续。" },
      { key: "time", label: "时间或回合", description: "每轮机会有限，必须安排先后顺序。" },
    ],
    constraints: [
      { key: "order-matters", label: "顺序重要", description: "动作调换后，结果会完全不同。" },
      { key: "limited-turns", label: "机会有限", description: "不能每一步都试一遍，必须提前想。 " },
    ],
    aiDirectorPrompt:
      "把多步规划放进救援或行动顺序的剧情里。AI 要追问孩子下一步之后还会发生什么。",
    aiEvaluationFocus: ["是否提前想两步", "是否注意顺序变化", "是否能说明为什么先做这一步"],
    successSignal: "孩子开始主动说“如果先做这个，后面就能……”",
    frames: [
      {
        id: "plan-first-step",
        childPrompt: "先决定第一步，但要想到后面会连着发生什么。",
        directorNote: "第一轮让孩子先讲顺序，不急着执行。",
        optionSeeds: [
          option("secure-path", "先把路铺好", "先处理最会影响后面的那一步。", "优先处理关键前置"),
          option("check-tools", "先确认工具够不够", "先看后面需要的东西是不是都准备好了。", "检查前置条件"),
          option("signal-others", "先告诉其他角色配合", "先让别人知道后面该怎么接。", "安排协同行动"),
        ],
        followUpQuestion: "如果你把第一步和第二步交换，会出什么问题？",
      },
      {
        id: "anticipate-second-step",
        childPrompt: "现在把第二步也一起想进去。",
        directorNote: "第二轮要求孩子说出连续两步。",
        optionSeeds: [
          option("sequence-two", "先做这个，再做那个", "明确说出两个动作的先后。", "构建两步计划"),
          option("leave-buffer", "中间留一个缓冲", "先留出一步应对可能变化。", "为变化预留空间"),
          option("test-risk", "先试最容易失败的地方", "先检查最可能出问题的一步。", "识别风险节点"),
        ],
        followUpQuestion: "你刚才这两步里，哪一步最不能晚做？",
      },
      {
        id: "explain-plan",
        childPrompt: "说清楚你的计划为什么这样排。",
        directorNote: "第三轮让孩子解释顺序背后的原因。",
        optionSeeds: [
          option("because-open-route", "因为这样能先打开后面的路", "说明先后顺序怎样影响后续。", "解释前后因果"),
          option("because-save-turn", "因为这样不会浪费回合", "说明怎样节省机会。", "解释效率"),
          option("because-avoid-risk", "因为这样更不容易出错", "说明怎样降低后面失误。", "解释风险控制"),
        ],
        followUpQuestion: "如果只剩一步机会了，你会删掉哪一步，为什么？",
      },
    ],
  },
};

export function getMathStoryKernel(kernelId: MathKernelId) {
  return mathStoryKernels[kernelId];
}
