# BrainPlay 下一阶段精确任务拆解 — 闭合 MVP 验证环

> 基于代码库实际探索（2026-03-28），对照已完成 / 未完成状态编写。
> 前置条件：`dialogue-upgrade-task-breakdown.md`（打字机 + 气泡 + 聚焦）已完成。
> 目标：让产品达到可给真实孩子 Playtest 的状态，闭合 Stage 1 MVP Gate。
> 包含：3 个里程碑、14 个任务、依赖图、逐个验收标准。

---

## 已完成任务状态确认

以下任务在代码中已实现，**本文档不再重复**：
- TA.1-TA.5：Profile 传递 + URL goal 参数 ✅
- TA.6：Fast Path ✅
- TA.7：Mock 多轮 ✅
- TC.1：Token 计数日志 ✅（`estimateTokens()` 在 `agent-system-prompt.ts:79`）
- TC.2：年龄适配规则 ✅（`age-adapter.ts` 三段规则）
- TC.3：工具多样性引导 ✅（`orchestration-rules.ts` 第 26-30 行）
- TC.4：身份自适应 ✅（`identity.ts` 第 16-19 行）
- TE.1-TE.4：机器人角色 + Mood Hook + Session 布局 ✅

---

## 依赖关系图

```
Milestone F：会话完整性
├── TF.1 — end_activity 完成流联通（独立）
├── TF.2 — 会话日志写入联通（依赖 TF.1）
├── TF.3 — 多轮对话稳定性加固（独立）
├── TF.4 — sliding window 首轮保护（独立）
└── TF.5 — 结果页数据展示（依赖 TF.1）

Milestone G：内容丰富度
├── TG.1 — 活动模板扩充：数学类（独立）
├── TG.2 — 活动模板扩充：跨领域（独立）
├── TG.3 — 年龄精细化到月份（独立）
└── TG.4 — 活动选择去重（依赖 TG.1/TG.2）

Milestone H：体验完善 + Playtest
├── TH.1 — 脑脑 Mood 联动 TTS 状态（独立）
├── TH.2 — 家长报告展示会话摘要（依赖 TF.2）
├── TH.3 — Qwen 稳定性验证测试（手动）
├── TH.4 — 浏览器端到端回归（手动，依赖全部代码任务）
└── TH.5 — 真实孩子 Playtest（依赖 TH.4）
```

**可并行的任务组**：
- 第一批：TF.1, TF.3, TF.4, TG.1, TG.2, TG.3, TH.1（全部独立）
- 第二批：TF.2, TF.5, TG.4（依赖第一批部分任务）
- 第三批：TH.2, TH.3, TH.4（依赖前两批）
- 第四批：TH.5（依赖一切）

---

## Milestone F：会话完整性（end_activity → 日志 → 结果展示）

### TF.1 — 联通 end_activity 完成流

**文件**：`store/agent-store.ts`

**依赖**：无

**问题**：当 AI 调用 `end_activity` 工具时，`tool-executor.ts` 正确 yield `SystemEffect`（type="system_effect", effect.type="end_activity"），但 `agent-store.ts` 的 `sendTurn` 回调（第 196-198 行）只做了 `console.debug`，没有任何状态更新。前端不知道会话已结束。

**做什么**：
1. 在 `AgentState` 接口中添加：
   ```ts
   sessionComplete: boolean;
   sessionSummary: { summary: string; parentNote?: string } | null;
   ```

2. 在 `sendTurn` 的 SSE 回调中，处理 `system_effect` 事件：
   ```ts
   } else if (event.type === "system_effect") {
     const effect = event.effect;
     if (effect?.type === "end_activity") {
       set({
         sessionComplete: true,
         sessionSummary: {
           summary: effect.summary ?? "活动完成",
           parentNote: effect.parentNote,
         },
       });
     }
     console.debug("[agent] system_effect", effect);
   }
   ```

3. 在 `startSession` 和 `reset` 中初始化：
   ```ts
   sessionComplete: false,
   sessionSummary: null,
   ```

4. 在 `partialize` 中排除 `sessionComplete` 和 `sessionSummary`（不持久化到 localStorage）。

**不做什么**：
- 不在 store 中导航到结果页。状态变化由 SessionPage 响应。
- 不修改 `tool-executor.ts`（它已正确工作）。

**验收**：
- AI 调用 `end_activity` 后，`sessionComplete` 变为 `true`
- `sessionSummary` 包含 AI 的总结文本
- `npx tsc --noEmit` 零错误

---

### TF.2 — 联通会话日志写入

**文件**：`store/agent-store.ts`、`components/agent/session-page.tsx`

**依赖**：TF.1

**问题**：`lib/data/client.ts` 中定义了 `logCompletedSession()` 函数（调用 `POST /api/progress/log`），但**没有任何代码调用它**。`session_logs` 表始终为空。

**做什么**：
1. 在 `components/agent/session-page.tsx` 中，添加 `useEffect` 监听 `sessionComplete`：
   ```ts
   import { logCompletedSession } from "@/lib/data/client";

   const sessionComplete = useAgentStore((s) => s.sessionComplete);
   const sessionSummary = useAgentStore((s) => s.sessionSummary);
   const conversation = useAgentStore((s) => s.conversation);

   useEffect(() => {
     if (!sessionComplete || !sessionId || !sessionSummary) return;

     // 从 conversation 提取 highlights
     const highlights: string[] = [];
     for (const msg of conversation) {
       if (msg.role === "assistant" && msg.toolCalls) {
         for (const tc of msg.toolCalls) {
           if (tc.name === "award_badge") {
             highlights.push((tc.arguments as { title?: string })?.title ?? "成就");
           }
         }
       }
     }

     logCompletedSession({
       mode: "story",
       taskId: sessionId,
       title: sessionSummary.summary,
       completion: 1.0,
       highlights,
       rewardSignals: [],
     }).catch((err) => console.warn("[session] log failed", err));
   }, [sessionComplete, sessionId, sessionSummary, conversation]);
   ```

2. 确保 `logCompletedSession` 的类型签名与 `CompletedSessionPayload` 匹配（检查 `lib/data/client.ts`）。

**不做什么**：
- 不重复写入（`useEffect` 只在 `sessionComplete` 变化时触发一次）
- 不阻塞 UI（`catch` 静默失败）

**验收**：
- 完成一次完整会话（AI 调用 `end_activity`）后，`session_logs` 表有一条记录
- `listRecentSessionLogs(5)` 返回该记录
- `npx tsc --noEmit` 零错误

---

### TF.3 — 多轮对话稳定性加固

**文件**：`lib/agent/agent-loop.ts`

**依赖**：无

**问题**：当前 `slidingWindow` 硬编码截取最近 10 轮（20 条消息），但没有 token 上限保护。如果某轮 tool_calls 参数很长（如 `show_choices` 带长描述），可能超出 Qwen context window。

**做什么**：
1. 在 `slidingWindow` 函数中增加 token 估算截断：
   ```ts
   function slidingWindow(conversation: ConversationMessage[], maxTurns = 10, maxTokens = 6000): ConversationMessage[] {
     // 从后往前取，直到达到 maxTurns 或 maxTokens
     const result: ConversationMessage[] = [];
     let tokenCount = 0;

     for (let i = conversation.length - 1; i >= 0 && result.length < maxTurns * 2; i--) {
       const msg = conversation[i];
       const msgTokens = estimateMessageTokens(msg);
       if (tokenCount + msgTokens > maxTokens && result.length > 0) break;
       result.unshift(msg);
       tokenCount += msgTokens;
     }
     return result;
   }
   ```

2. 添加 `estimateMessageTokens` 辅助函数：
   ```ts
   function estimateMessageTokens(msg: ConversationMessage): number {
     let text = msg.content ?? "";
     if (msg.toolCalls) {
       text += JSON.stringify(msg.toolCalls);
     }
     // 粗略估算：中文字 * 1.5 + 英文词 * 0.75
     const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
     const nonChinese = text.replace(/[\u4e00-\u9fff]/g, " ");
     const words = nonChinese.trim().split(/\s+/).filter(Boolean).length;
     return Math.round(chinese * 1.5 + words * 0.75);
   }
   ```

3. 在 Qwen 调用前添加日志：
   ```ts
   console.debug(`[agent-loop] sliding window: ${result.length} msgs, ~${tokenCount} tokens`);
   ```

**不做什么**：
- 不改变 `maxTurns` 默认值（10 轮足够 MVP）
- 不重构 `toQwenMessages` 函数

**验收**：
- 15 轮模拟对话中 token 数不超过 6000
- 日志输出 token 估算值
- `npx tsc --noEmit` 零错误

---

### TF.4 — sliding window 首轮保护

**文件**：`lib/agent/agent-loop.ts`

**依赖**：无

**问题**：当 sliding window 裁剪时，可能丢失首轮 assistant 消息（包含活动开场白和初始 choices）。AI 失去上下文后可能重新开场。

**做什么**：
1. 在 `slidingWindow` 函数中，始终保留前 2 条消息（第一个 user + 第一个 assistant）：
   ```ts
   function slidingWindow(conversation: ConversationMessage[], maxTurns = 10, maxTokens = 6000): ConversationMessage[] {
     if (conversation.length <= maxTurns * 2) return conversation;

     // 始终保留首轮（最多前 2 条：user + assistant）
     const first = conversation.slice(0, 2);
     const rest = conversation.slice(2);

     // 从 rest 的后面开始取，直到达到限制
     const recent: ConversationMessage[] = [];
     let tokenCount = first.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

     for (let i = rest.length - 1; i >= 0 && recent.length < (maxTurns - 1) * 2; i--) {
       const msg = rest[i];
       const msgTokens = estimateMessageTokens(msg);
       if (tokenCount + msgTokens > maxTokens && recent.length > 0) break;
       recent.unshift(msg);
       tokenCount += msgTokens;
     }

     return [...first, ...recent];
   }
   ```

**不做什么**：
- 不保留所有 assistant 消息（只保留首轮）
- 不在首轮消息中截断 toolCalls

**验收**：
- 15 轮对话后 slidingWindow 仍包含首轮的 user + assistant 消息
- 中间轮次被裁剪
- `npx tsc --noEmit` 零错误

---

### TF.5 — 结果页展示 + 会话结束 UI

**文件**：`components/agent/session-page.tsx`

**依赖**：TF.1

**问题**：会话结束后（`sessionComplete=true`），前端没有任何视觉变化。孩子不知道活动已完成。

**做什么**：
1. 在 SessionPage 中添加结束态 UI：
   ```tsx
   const sessionComplete = useAgentStore((s) => s.sessionComplete);
   const sessionSummary = useAgentStore((s) => s.sessionSummary);

   // 在 AnimatePresence 中添加完成卡片
   {sessionComplete && sessionSummary && (
     <motion.div
       key="complete"
       initial={{ opacity: 0, scale: 0.95 }}
       animate={{ opacity: 1, scale: 1 }}
       className="rounded-3xl border-2 border-accent bg-white/95 p-6 text-center shadow-xl"
     >
       <p className="text-3xl mb-2">🎉</p>
       <h2 className="text-lg font-bold text-foreground mb-2">太棒了！</h2>
       <p className="text-sm text-foreground/80 mb-4">{sessionSummary.summary}</p>
       <div className="flex gap-3 justify-center">
         <button
           onClick={() => {
             reset();
             const goals = initialGoal ? [initialGoal] : activeProfile?.goalPreferences ?? [];
             if (activeProfile) startSession(activeProfile.id, goals, activeProfile);
           }}
           className="rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-white"
         >
           再来一局 🚀
         </button>
         <Link
           href="/"
           className="rounded-2xl border border-border px-6 py-3 text-sm font-semibold text-foreground"
         >
           回到首页
         </Link>
       </div>
     </motion.div>
   )}
   ```

2. 当 `sessionComplete=true` 时隐藏 InputBar：
   ```tsx
   {!sessionComplete && (
     <InputBar pendingInputType={pendingInputType} onSubmit={handleUserInput} />
   )}
   ```

**不做什么**：
- 不导航到单独的结果页面（保持在 session 页面内展示）
- 不添加复杂的统计图表（MVP 只需要文字总结 + 重新开始）

**验收**：
- AI 调用 `end_activity` 后，出现完成卡片（有🎉、总结文字、两个按钮）
- InputBar 消失
- "再来一局" 按钮可重新开始
- `npx tsc --noEmit` 零错误

---

## Milestone G：内容丰富度

### TG.1 — 活动模板扩充：数学类

**文件**：`content/activities/activity-templates.ts`

**依赖**：无

**问题**：当前 `MATH_ACTIVITIES` 只有 3 个模板（数列猎人、形状侦探、取子博弈），同一目标重复进入后很快重复。

**做什么**：
1. 在 `MATH_ACTIVITIES` 数组中新增 3 个活动模板：

```ts
{
  id: "money-counter",
  label: "买东西找钱",
  goalId: "math-thinking",
  subGoalId: "arithmetic-fluency",
  description: "模拟购物场景，计算找零金额",
  suggestedTools: ["narrate", "show_choices", "show_text_input"],
  ageRange: [6, 9],
  durationMinutes: 7,
  systemPromptFragment: `当前活动：买东西找钱
设定一个小商店场景，每样东西有价格（1-20 元）。
孩子有一定金额的钱，选择买什么，然后算找回多少钱。
show_choices 列出可买的物品（带价格），show_text_input 让孩子算找零。
难度 L1：总价 < 10 元，不需要进位。
难度 L2：总价 10-20 元，需要借位。
难度 L3：买多件，需要连加再减。
追问："你是怎么算的？有没有更快的方法？"`,
  exampleFlow: "narrate(商店场景) → show_choices(选物品) → show_text_input(算找零) → narrate(追问)",
},
{
  id: "number-split",
  label: "数字拆分家",
  goalId: "math-thinking",
  subGoalId: "number-composition",
  description: "把一个数拆分成两个数的和，探索数的组合",
  suggestedTools: ["narrate", "show_text_input", "show_choices"],
  ageRange: [5, 8],
  durationMinutes: 6,
  systemPromptFragment: `当前活动：数字拆分家
给孩子一个目标数（如 8），让孩子想办法把它拆成两个数的和。
"8 可以拆成 ? + ?"  鼓励孩子找出多种拆法。
show_text_input 让孩子输入一种拆法，narrate 确认并追问还有没有其他拆法。
难度 L1：目标数 5-8。L2：目标数 10-15。L3：拆成三个数的和。
追问："一共能拆出几种？有没有规律？"`,
  exampleFlow: "narrate(目标数) → show_text_input(输入拆法) → narrate(确认+追问) → show_text_input(更多拆法)",
},
{
  id: "magic-equation",
  label: "魔法等式",
  goalId: "math-thinking",
  subGoalId: "equation-thinking",
  description: "用方框代替未知数，解简单的等式谜题",
  suggestedTools: ["narrate", "show_choices", "show_text_input"],
  ageRange: [6, 10],
  durationMinutes: 7,
  systemPromptFragment: `当前活动：魔法等式
出一道等式谜题，用 □ 代替未知数，如 "□ + 3 = 7"。
先用 show_choices 给出 3-4 个选项，孩子选完后追问推理过程。
难度 L1：□ + a = b，□ < 10。
难度 L2：a + □ = b，需要逆向思维。
难度 L3：□ + □ = b 或 a - □ = c。
追问："你是怎么想到这个答案的？可以反过来验证一下吗？"`,
  exampleFlow: "narrate(等式) → show_choices(选答案) → narrate(追问验证) → show_text_input(孩子解释)",
},
```

**不做什么**：
- 不修改已有的 3 个模板
- 不添加 ageRange 超过 [5, 12] 范围的模板

**验收**：
- `MATH_ACTIVITIES` 有 6 个模板
- `getActivitiesForGoal("math-thinking")` 返回 6 条
- 每个模板 `systemPromptFragment` 含难度分级
- `npx tsc --noEmit` 零错误

---

### TG.2 — 活动模板扩充：跨领域

**文件**：`content/activities/activity-templates.ts`

**依赖**：无

**问题**：语言、策略、观察各只有 1 个模板，容易重复。

**做什么**：
1. 为以下目标各新增 1-2 个模板：

**语言思维（LANGUAGE_ACTIVITIES）+2**：
```ts
{
  id: "opposite-bounce",
  label: "反义词弹弹球",
  goalId: "language-thinking",
  subGoalId: "vocabulary-expansion",
  description: "快速说出反义词，锻炼词汇储备和反应速度",
  suggestedTools: ["narrate", "show_text_input", "show_choices"],
  ageRange: [5, 9],
  durationMinutes: 5,
  systemPromptFragment: `当前活动：反义词弹弹球
说一个词（如"大"），让孩子说反义词（"小"）。连续出 5 轮，越来越快。
show_text_input 让孩子输入反义词。答对了 narrate 加速节奏。
难度 L1：简单形容词（大小、长短）。L2：动词和状态词。L3：抽象词（勇敢/胆小）。`,
  exampleFlow: "narrate(出词) → show_text_input(反义词) → narrate(加速) → show_text_input(下一个)",
},
{
  id: "picture-story",
  label: "看图说故事",
  goalId: "language-thinking",
  subGoalId: "narrative-expression",
  description: "根据图片编一个小故事，锻炼叙事能力",
  suggestedTools: ["narrate", "show_image", "show_text_input", "request_voice"],
  ageRange: [6, 12],
  durationMinutes: 8,
  systemPromptFragment: `当前活动：看图说故事
用 show_image 展示一张图片场景，让孩子根据图片编故事。
request_voice 或 show_text_input 让孩子表达。
追问引导："后来发生了什么？""这个角色的心情是什么？"`,
  exampleFlow: "narrate(引入) → show_image(场景图) → request_voice(孩子讲故事) → narrate(追问)",
},
```

**策略思维（STRATEGY_ACTIVITIES）+1**：
```ts
{
  id: "tic-tac-think",
  label: "井字棋大师",
  goalId: "strategy-thinking",
  subGoalId: "game-strategy",
  description: "分析井字棋局势，找到最佳下子位置",
  suggestedTools: ["narrate", "show_choices", "think"],
  ageRange: [6, 12],
  durationMinutes: 8,
  systemPromptFragment: `当前活动：井字棋大师
用 narrate 描述一个井字棋进行中的局面，show_choices 让孩子选下在哪个位置。
追问："你为什么选这里？""如果你下在别处，对手会怎么做？"
难度 L1：快赢了，选正确位置即可。L2：防守局面。L3：双重威胁。`,
  exampleFlow: "narrate(局面描述) → show_choices(选位置) → narrate(追问策略) → show_choices(对手的反应)",
},
```

**观察归纳（OBSERVATION_ACTIVITIES）+1**：
```ts
{
  id: "category-sort",
  label: "分类大王",
  goalId: "observation-induction",
  subGoalId: "classification",
  description: "把混在一起的物品按规则分类",
  suggestedTools: ["narrate", "show_choices", "show_text_input"],
  ageRange: [5, 10],
  durationMinutes: 6,
  systemPromptFragment: `当前活动：分类大王
列出 6-8 个物品（水果、动物、交通工具混在一起），让孩子分类。
show_choices 让孩子先选一个分类标准，然后 show_text_input 让孩子说出属于该类的所有物品。
追问："还有没有别的分法？""如果加一个新物品，它归哪类？"
难度 L1：明确分类。L2：有交叉类别。L3：孩子自己发明分类规则。`,
  exampleFlow: "narrate(列物品) → show_choices(选分类标准) → show_text_input(列出该类) → narrate(追问)",
},
```

**不做什么**：
- 不修改已有模板
- 不给创意思维加模板（已有 2 个，够用）

**验收**：
- `ALL_ACTIVITIES.length` ≥ 14（原 10 + 新 4）
- 每个目标至少 2 个活动
- `npx tsc --noEmit` 零错误

---

### TG.3 — 年龄精细化到月份

**文件**：`prompts/modules/age-adapter.ts`、`prompts/modules/child-profile.ts`

**依赖**：无

**问题**：当前 `calcAge()` 只返回整数岁，`childProfileModule` 显示 "6 岁"。但 6 岁 2 个月和 6 岁 11 个月差异很大。精确到月份能让 AI 更好地调整。

**做什么**：
1. 在 `age-adapter.ts` 新增：
   ```ts
   export function calcAgeDetailed(birthday: string): { years: number; months: number } {
     const birth = new Date(birthday);
     const now = new Date();
     let years = now.getFullYear() - birth.getFullYear();
     let months = now.getMonth() - birth.getMonth();
     if (now.getDate() < birth.getDate()) months--;
     if (months < 0) { years--; months += 12; }
     return { years: Math.max(0, years), months: Math.max(0, months) };
   }
   ```

2. 在 `ageAdapterModule` 中使用精确月份：
   ```ts
   export function ageAdapterModule(birthday: string): string {
     const { years, months } = calcAgeDetailed(birthday);
     const age = years; // 保持原逻辑不变
     // ... 原有 rules 逻辑 ...
     return `## 年龄适配规则（当前孩子 ${years} 岁 ${months} 个月）\n${rules}`;
   }
   ```

3. 在 `childProfileModule` 中也显示月份：
   ```ts
   const { years, months } = calcAgeDetailed(profile.birthday);
   return `## 孩子档案\n- 昵称：${profile.nickname}\n- 年龄：${years} 岁 ${months} 个月\n...`;
   ```

**不做什么**：
- 不改变年龄分段的阈值（7/9 岁分界不变）
- 不改 `calcAge()` 原函数（其他地方可能用到）

**验收**：
- `calcAgeDetailed("2019-07-01")` 在 2026-03-28 返回 `{ years: 6, months: 8 }`
- system prompt 显示 "6 岁 8 个月"
- `npx tsc --noEmit` 零错误

---

### TG.4 — 活动选择去重

**文件**：`lib/agent/activity-selector.ts`

**依赖**：TG.1, TG.2

**问题**：当前 `selectActivity` 接收 `recentActivityIds` 参数但始终传入空数组 `[]`。AI 可能连续选到同一个活动。

**做什么**：
1. 在 `store/agent-store.ts` 中添加：
   ```ts
   recentActivityIds: string[];  // 最近 3 次会话使用的活动 ID
   ```

2. 在 `startSession` 中：
   - 将 `recentActivityIds` 加入 request body
   - 在 session 结束时（`end_activity`），从 activeToolCalls 中提取 narrate 内容尝试匹配活动 ID，或直接在 start 响应中返回 `selectedActivityId`

3. 更简单的做法 —— 在 `start/route.ts` 中：
   - 在 `session_start` SSE 事件中添加 `activityId` 字段
   - 前端收到后追加到 `recentActivityIds`（保留最近 5 个，FIFO）

4. 在 `start/route.ts` 和 `turn/route.ts` 中，将 `recentActivityIds` 从前端传入 `selectActivity()`：
   ```ts
   const selectedActivity = selectActivity({
     profileId,
     birthday: profile.birthday,
     goalFocus,
     recentActivityIds: body.recentActivityIds ?? [],
     preferredSubGoalIds: [],
   });
   ```

**不做什么**：
- 不使用数据库存储（localStorage 足够 MVP）
- 不超过 5 个历史 ID（避免可选活动耗尽）

**验收**：
- 连续 3 次启动 session，选到的活动 ID 各不相同
- `recentActivityIds` 在 localStorage 中持久化
- `npx tsc --noEmit` 零错误

---

## Milestone H：体验完善 + Playtest

### TH.1 — 脑脑 Mood 联动 TTS 状态

**文件**：`components/agent/use-robot-mood.ts`

**依赖**：无

**问题**：当前 `useRobotMood` 根据 `activeToolCalls` 最后一个工具推断 mood，但 `isSpeaking` 是静态推断（有 narrate 就 true），不与实际 TTS 播放状态同步。

**做什么**：
1. 创建一个全局 TTS 状态 signal，在 `hooks/use-tts.ts`（对话升级任务创建的）中暴露：
   ```ts
   // hooks/use-tts.ts 中添加
   let globalIsSpeaking = false;
   const listeners = new Set<() => void>();

   export function getIsSpeaking() { return globalIsSpeaking; }
   export function subscribeIsSpeaking(fn: () => void) {
     listeners.add(fn);
     return () => listeners.delete(fn);
   }

   // 在 enqueueTts 中：
   globalIsSpeaking = true;
   listeners.forEach(fn => fn());
   // ... play audio ...
   globalIsSpeaking = false;
   listeners.forEach(fn => fn());
   ```

2. 在 `use-robot-mood.ts` 中订阅：
   ```ts
   import { useSyncExternalStore } from "react";
   import { getIsSpeaking, subscribeIsSpeaking } from "@/hooks/use-tts";

   const ttsIsSpeaking = useSyncExternalStore(subscribeIsSpeaking, getIsSpeaking, () => false);
   ```

3. 将 `isSpeaking` 改为基于实际 TTS 状态：
   ```ts
   return { mood, isSpeaking: ttsIsSpeaking };
   ```

**不做什么**：
- 不在 agent-store 中存储 TTS 状态
- 不修改 robot-character.tsx（它已正确响应 props）

**验收**：
- TTS 播放时脑脑显示 speaking 动画（脉冲 + 粒子）
- TTS 停止后 speaking 动画消失
- 多段 narrate 连续播放时持续显示 speaking
- `npx tsc --noEmit` 零错误

---

### TH.2 — 家长报告展示会话摘要

**文件**：`app/parent/page.tsx`

**依赖**：TF.2

**问题**：家长看板只展示原始 observations，没有会话级摘要（什么时候玩了什么活动，完成情况如何）。

**做什么**：
1. 在报告 API `/api/parent/report/route.ts` 中新增返回 `sessionLogs`：
   ```ts
   import { listRecentSessionLogs } from "@/lib/data/session-log";

   // 在 GET handler 中添加
   const logs = listRecentSessionLogs(5);
   return NextResponse.json({ skills, recent, sessionLogs: logs });
   ```

2. 在 `app/parent/page.tsx` 中新增会话历史区域：
   ```tsx
   {sessionLogs.length > 0 && (
     <section className="space-y-3">
       <h2 className="text-lg font-bold">最近学习记录</h2>
       {sessionLogs.map((log, i) => (
         <div key={i} className="rounded-2xl border border-border bg-white/90 p-4">
           <div className="flex justify-between text-sm">
             <span className="font-semibold">{log.title}</span>
             <span className="text-ink-soft">{new Date(log.created_at).toLocaleDateString("zh-CN")}</span>
           </div>
           {log.highlights.length > 0 && (
             <div className="mt-2 flex flex-wrap gap-1">
               {log.highlights.map((h, j) => (
                 <span key={j} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">🏆 {h}</span>
               ))}
             </div>
           )}
         </div>
       ))}
     </section>
   )}
   ```

**不做什么**：
- 不做复杂的图表可视化（MVP 用列表即可）
- 不添加筛选或分页

**验收**：
- 完成 2 次会话后，家长页显示 2 条学习记录
- 每条包含标题、日期、成就标签
- `npx tsc --noEmit` 零错误

---

### TH.3 — Qwen 稳定性验证测试（手动）

**文件**：无代码修改

**依赖**：Milestone F 代码任务完成

**做什么**：
1. `.env.local` 设置 `AI_PROVIDER_MODE=qwen`
2. 运行 `node scripts/test-qwen-stability.mjs`
3. 记录 20 组测试结果：
   - tool_call 返回率 ≥ 95%
   - 格式正确率 ≥ 90%
   - narrate 首位率 ≥ 95%
   - 平均响应时间 < 3 秒
4. 如有异常，回到代码调整 `tool-definitions.ts` 或 `prompts/`

**验收**：测试报告符合上述阈值。

---

### TH.4 — 浏览器端到端回归（手动）

**文件**：无代码修改

**依赖**：所有代码任务完成

**做什么**：
1. `AI_PROVIDER_MODE=qwen`，`npm run dev`
2. 完整流程测试（参照 `docs/playtest-checklist.md`）：
   - [ ] 首页→选择"数学思维"→/session?goal=math-thinking
   - [ ] 创建 profile：昵称 + birthday=2019-07-01
   - [ ] AI 首轮：打招呼（打字机出字） + 选择卡片（延迟入场）
   - [ ] AI 气泡聚焦高亮 + TTS 播放 + 脑脑 speaking 动画
   - [ ] 选择一个选项 → 用户消息右对齐气泡 → AI 新回复
   - [ ] 5 轮对话：每轮内容不同、工具组合有变化
   - [ ] 追问场景：show_text_input prompt 有语音
   - [ ] 对话历史：之前的消息以 dim 态显示
   - [ ] 10 轮后：AI 调用 end_activity → 完成卡片出现
   - [ ] "再来一局" → 重新开始新 session
   - [ ] 打开 /parent → 显示学习记录和观察
3. 移动端（Chrome DevTools 模拟 iPad）测试：
   - [ ] 布局不溢出
   - [ ] 触摸操作正常
   - [ ] 滚动流畅

**验收**：上述所有检查项通过。

---

### TH.5 — 真实孩子 Playtest

**文件**：无代码修改

**依赖**：TH.4

**做什么**：
1. `npm run build && npm start`（生产模式）
2. Chrome 全屏，开启录屏
3. 用真实孩子（2019 年 7 月出生）测试：
   - 场景 1：数学思维 5 分钟
   - 场景 2：自由选择 5 分钟
4. 观察并记录：
   - 主动继续意愿（1-5 分）
   - AI 互动自然度（1-5 分）
   - 操作困难点
   - 情绪变化
   - 是否需要大人帮助

**验收**：
- 孩子独立完成至少 1 个活动
- 录屏 + 观察笔记存档
- 记录 3 个需改进的点

---

## 执行顺序建议

| 批次 | 任务 | 预估工时 | 性质 |
|------|------|----------|------|
| 第一批（并行） | TF.1（end_activity 联通） | 1h | 代码 |
| 第一批 | TF.3（token 截断） | 1h | 代码 |
| 第一批 | TF.4（首轮保护） | 0.5h | 代码 |
| 第一批 | TG.1（数学活动 +3） | 1h | 内容 |
| 第一批 | TG.2（跨领域活动 +4） | 1.5h | 内容 |
| 第一批 | TG.3（年龄精细化） | 0.5h | 代码 |
| 第一批 | TH.1（Mood 联动 TTS） | 1h | 代码 |
| 第二批 | TF.2（日志写入） | 1h | 代码 |
| 第二批 | TF.5（结果页 UI） | 1h | 代码 |
| 第二批 | TG.4（活动去重） | 1.5h | 代码 |
| 第三批 | TH.2（家长报告摘要） | 1h | 代码 |
| 第三批 | TH.3（Qwen 测试） | 1h | 手动 |
| 第三批 | TH.4（端到端回归） | 2h | 手动 |
| 第四批 | TH.5（Playtest） | 4h | 手动 |

**总预估**：14-16 小时（代码 ~10h + 手动测试 ~6h）

---

## Stage 1 MVP Gate 对照

完成本计划后，对照 `stage1-closeout-and-mvp-gate.md` 的 4 组收口标准：

| 标准 | 状态 |
|------|------|
| 4.1 原型闭环：首页→活动→结果→状态变化→家长摘要 | ✅ TF.1+TF.2+TF.5+TH.2 覆盖 |
| 4.2 体验闭环：焦点明确、语音播报、操作简洁 | ✅ 对话升级任务 + TH.1 覆盖 |
| 4.3 内容闭环：每条原型 ≥ 2 场景、映射训练点 | ✅ TG.1+TG.2 覆盖 |
| 4.4 记录闭环：试玩记录写入、家长可读 | ✅ TF.2+TH.2 覆盖 |
