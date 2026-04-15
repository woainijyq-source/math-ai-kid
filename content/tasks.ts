import type { TaskConfig } from "@/types";

export const taskConfigs: Record<string, TaskConfig> = {
  opponent: {
    id: "opponent",
    mode: "opponent",
    title: "AI 对手试炼",
    subtitle: "轮流拿走月石，猜出让自己更稳的办法。",
    goal: "在短回合对抗里先观察数量变化，再决定自己的下一步。",
    inputModes: ["choice", "voice", "text"],
    steps: [
      { id: "observe", label: "观察局面", description: "先看剩余数量和 AI 提示。" },
      { id: "act", label: "轮到你行动", description: "每次可以拿 1 颗或 2 颗。" },
      { id: "reflect", label: "复盘总结", description: "听 AI 解释你这一步为什么有效。" },
    ],
    completionRule: "完成一局对抗并看到复盘反馈。",
    rewardHooks: ["instant", "identity", "world"],
  },
  "co-create": {
    id: "co-create",
    mode: "co-create",
    title: "AI 共创工坊",
    subtitle: "和 AI 一起发明规则，再让它反过来挑战你。",
    goal: "把一个想法说成真的能玩的规则，并看见规则怎样改变玩法。",
    inputModes: ["text", "touch"],
    steps: [
      { id: "invent", label: "发明规则", description: "先用一句话说出你想加入的新规则。" },
      { id: "compose", label: "搭规则草图", description: "用碎片把规则说得更清楚。" },
      { id: "challenge", label: "接受回问", description: "AI 会顺着你的规则反向出题。" },
    ],
    completionRule: "输入一条规则并完成一次 AI 反向挑战。",
    rewardHooks: ["instant", "world"],
  },
  story: {
    id: "story",
    mode: "story",
    title: "AI 剧情探险",
    subtitle: "在迷雾小镇里做出关键选择，看世界如何改变。",
    goal: "完成 2 到 3 次关键决策，并看见自己的选择带来的后果。",
    inputModes: ["choice", "text"],
    steps: [
      { id: "arrive", label: "进入小镇", description: "先听角色描述当前发生了什么。" },
      { id: "decide", label: "做出选择", description: "每次选择都会改变后面的局面。" },
      { id: "impact", label: "看见结果", description: "结果页会告诉你改变了什么。" },
    ],
    completionRule: "走完一段剧情分支并进入结果页。",
    rewardHooks: ["instant", "world"],
  },
};

export const primaryTaskId = "story" as const;
export const secondaryTaskIds = ["opponent", "co-create"] as const;
export const taskOrder = [primaryTaskId, ...secondaryTaskIds] as const;
