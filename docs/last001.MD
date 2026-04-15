# BrainPlay 剩余任务执行书（Cursor 交付版）

> **目标**：闭合 Stage 1 → MVP 验证环  
> **项目路径**：`C:\Users\Administrator\.openclaw\workspace\math-ai-kid`  
> **规划依据**：`docs/stage2-prep-task-breakdown.md`、`docs/ai-training-system-playbook.md`、`docs/stage1-closeout-and-mvp-gate.md`  
> **主线决议**：AI 剧情型（story 模式）  
> **验证工具**：每个任务完成后执行 `npx tsc --noEmit` 必须零错误

---

## 第 0 章 — 当前代码状态速查表（只读）

### 0.1 已完成且已验证

| 模块 | 关键文件 | 说明 |
|------|----------|------|
| 对话呈现 | `components/agent/typewriter-text.tsx` | 打字机效果完成 |
| 对话呈现 | `components/agent/agent-narrator.tsx` | 气泡 + TTS 同步完成 |
| 对话呈现 | `hooks/use-tts.ts` | TTS 队列 + 浏览器降级 |
| 训练系统 | `lib/training/domain-pedagogy.ts` | 6 大目标教学法定义 |
| 训练系统 | `lib/training/evaluator-agent.ts` | 证据评估 + SQLite 事件日志 |
| 训练系统 | `lib/training/mastery-engine.ts` | 掌握度引擎 |
| 训练系统 | `lib/training/training-intent.ts` | 训练意图层 |
| 训练系统 | `lib/training/prompt-builder.ts` | 动态 Prompt 组装 |
| 主链路接入 | `app/api/agent/turn/route.ts` | **每一轮都调用**以上 5 个训练模块 |
| Agent 协议 | `lib/agent/agent-loop.ts` | end_activity 已识别并返回 SystemEffect |
| 数据持久化 | `app/api/progress/log/route.ts` + `.data/brainplay.sqlite` | WAL 模式，interaction events 每轮写入 |
| 家长端 | `app/parent/page.tsx` + `app/api/parent/report/route.ts` | 显示真实 DB 数据，含 observations |
| 子目标 playbook | `content/goals/subgoal-playbooks.ts` | pattern-recognition/quantity-comparison/strategy-planning 已写完 |

### 0.2 当前活动模板清单（`content/activities/activity-templates.ts`）

**共 18 个**，分布如下：

```
MATH_ACTIVITIES (4):
  - number-pattern-hunt
  - marble-compare
  - strategy-nim
  - shape-spy

LOGIC_ACTIVITIES (3):
  - who-is-lying
  - if-then-chain
  - logic-ladder

CREATIVE_ACTIVITIES (3):
  - rule-inventor
  - many-ways-there
  - what-if-world

LANGUAGE_ACTIVITIES (2):
  - explain-it
  - describe-the-scene

STRATEGY_ACTIVITIES (3):
  - predict-the-move
  - best-move-lab
  - safe-or-risky

OBSERVATION_ACTIVITIES (3):
  - detail-detective
  - spot-the-rule
  - same-shape-new-world
```

### 0.3 已确认存在的 Bug / 未完成点

| 问题 | 证据 | 影响 |
|------|------|------|
| `slidingWindow` 纯尾部截断 | `lib/agent/agent-loop.ts` 第 40-42 行 | 15 轮后丢失首轮开场上下文 |
| `agent-store.sendTurn` 忽略 system_effect | 回调只 `console.debug` | 前端不知道会话已结束 |
| `session-page` 无会话结束 UI | 组件未检查 sessionComplete | 孩子玩完没有完成反馈 |
| `components/result/result-page-client.tsx` 是孤儿 | 无路由引用 | 无效代码，实际走 session-page 内完成卡 |
| `logCompletedSession` 定义但无人调用 | `lib/data/client.ts` | `session_logs` 表永远为空 |
| `calcAge` 只返回整年 | `prompts/modules/age-adapter.ts` | 6岁2月 vs 6岁11月差异无法传达 |
| `activity-selector` 的 `recentActivityIds` 永远空数组 | 无前后端传递链路 | 连续刷出同一活动 |
| `use-robot-mood` 是静态推断 | 基于 narrate 工具调用，不订阅 TTS 真实状态 | TTS 队列延迟/降级时不同步 |
| Token 估算和日志缺失 | `agent-loop.ts` 无 token 统计 | 无法监控 context 增长 |

### 0.4 规划要求但缺失的活动模板

以下 7 个模板**文件中不存在**（全局 grep 仅在 docs 中出现）：

```
money-counter, number-split, magic-equation,
opposite-bounce, picture-story, tic-tac-think, category-sort
```

---

## 第 1 章 — Milestone F：会话完整性（P0，必须先完成）

### ▶ Task TF.4 — slidingWindow 首轮保护

**优先级**：P0  
**预估**：15 分钟  
**依赖**：无  
**文件**：`lib/agent/agent-loop.ts`

**当前实现**（第 40-42 行左右）：
```typescript
function slidingWindow(conversation: ConversationMessage[], maxMessages = 20): ConversationMessage[] {
  if (conversation.length <= maxMessages) return conversation;
  return conversation.slice(conversation.length - maxMessages);
}
```

**改成**：
```typescript
function slidingWindow(conversation: ConversationMessage[], maxMessages = 20): ConversationMessage[] {
  if (conversation.length <= maxMessages) return conversation;
  // 始终保留前 2 条消息（第一个 user + 第一个 assistant 开场白）
  const head = conversation.slice(0, 2);
  const tail = conversation.slice(-(maxMessages - 2));
  return [...head, ...tail];
}
```

**验收**：
- [ ] 模拟 25 条消息，结果首 2 条仍在
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TF.1 — agent-store 接入 end_activity 完成状态

**优先级**：P0  
**预估**：30 分钟  
**依赖**：无  
**文件**：`store/agent-store.ts`

**要做**：
1. 在 `AgentState` 接口添加：
   ```typescript
   sessionComplete: boolean;
   sessionSummary: { summary: string; completionRate?: number; parentNote?: string } | null;
   ```
2. 在 `startSession` 和 `reset` 中初始化：
   ```typescript
   sessionComplete: false,
   sessionSummary: null,
   ```
3. 在 `sendTurn` 的 SSE 回调中处理 `system_effect` 事件：
   ```typescript
   case "system_effect": {
     if (event.effect?.type === "end_activity") {
       set({
         sessionComplete: true,
         sessionSummary: {
           summary: event.effect.summary ?? "",
           completionRate: event.effect.completionRate,
         },
         isStreaming: false,
       });
     }
     break;
   }
   ```
4. 在 `partialize` 中排除这两个字段（不持久化到 localStorage）

**验收**：
- [ ] AI 调用 `end_activity` 后 `sessionComplete === true`
- [ ] `sessionSummary.summary` 含 AI 的总结文本
- [ ] 刷新页面后 `sessionComplete` 重置为 false（未持久化）
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TF.5 — session-page 会话结束 UI

**优先级**：P0  
**预估**：45 分钟  
**依赖**：TF.1  
**文件**：`components/agent/session-page.tsx`

**要做**：
1. 从 `useAgentStore` 中读取 `sessionComplete` 和 `sessionSummary`
2. 当 `sessionComplete === true` 时：
   - 隐藏 `InputBar`（或替换为完成卡片）
   - 渲染完成卡片：
     ```tsx
     <div className="complete-card">
       <div className="text-6xl">🎉</div>
       <h2>这一局结束啦！</h2>
       <p>{sessionSummary?.summary}</p>
       {typeof sessionSummary?.completionRate === "number" && (
         <div>完成度：{Math.round(sessionSummary.completionRate * 100)}%</div>
       )}
       <div className="buttons">
         <button onClick={handleRestart}>再来一局</button>
         <Link href="/">回到首页</Link>
       </div>
     </div>
     ```
3. `handleRestart` 调用 store 的 `reset()` 然后 `startSession()`

**验收**：
- [ ] AI 调用 end_activity 后完成卡片出现
- [ ] InputBar 消失
- [ ] "再来一局" 能重新启动 session
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TF.2 — logCompletedSession 写入

**优先级**：P0  
**预估**：30 分钟  
**依赖**：TF.1  
**文件**：`components/agent/session-page.tsx`（或新建一个 hook）

**背景**：`lib/data/client.ts` 已导出 `logCompletedSession(payload)`，向 `/api/progress/log` POST 数据，后端写入 `session_logs` 表。当前无人调用。

**要做**：
1. 在 `session-page.tsx` 中添加 `useEffect`：
   ```typescript
   useEffect(() => {
     if (!sessionComplete || !sessionSummary) return;
     // 防重入：用一个 ref 确保只写一次
     if (loggedRef.current) return;
     loggedRef.current = true;

     const highlights = conversation
       .flatMap((msg) => msg.toolCalls ?? [])
       .filter((call) => call.name === "award_badge")
       .map((call) => call.arguments?.label ?? "");

     logCompletedSession({
       profileId: profile.id,
       mode: "story", // 或根据 goal 判断
       taskId: currentActivityId ?? "unknown",
       sceneId: currentSceneId ?? "unknown",
       title: sessionSummary.summary.slice(0, 30),
       completion: sessionSummary.completionRate ?? 1,
       highlights,
       rewardSignals: [],
       mathEvidence: [],
     }).catch(console.error);
   }, [sessionComplete, sessionSummary]);
   ```
2. 确保 `CompletedSessionPayload` 类型对齐（参考 `lib/data/session-log.ts`）

**验收**：
- [ ] 玩完一局后 `sqlite3 .data/brainplay.sqlite "SELECT * FROM session_logs"` 有 1 条
- [ ] `/parent` 页面"最近学习记录"显示此次
- [ ] 重复触发不会重复写入
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TF.3 — token 估算与日志

**优先级**：P0  
**预估**：20 分钟  
**依赖**：无  
**文件**：`lib/agent/agent-loop.ts`

**要做**：
1. 添加辅助函数：
   ```typescript
   function estimateMessageTokens(content: string): number {
     // 中文字符按 1.5 算，其他按 0.75 算
     const chineseCount = (content.match(/[\u4e00-\u9fa5]/g) ?? []).length;
     const otherCount = content.length - chineseCount;
     return Math.ceil(chineseCount * 1.5 + otherCount * 0.75);
   }
   ```
2. 在调用 Qwen 前加日志：
   ```typescript
   const totalTokens = allMessages.reduce(
     (sum, msg) => sum + estimateMessageTokens(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)),
     0
   );
   console.log(`[agent-loop] estimated tokens: ${totalTokens}, messages: ${allMessages.length}`);
   ```
3. （可选）如果 `totalTokens > 6000`，在 `slidingWindow` 基础上再裁剪一次

**验收**：
- [ ] 跑 15 轮对话，终端能看到每轮的 token 估算日志
- [ ] `npx tsc --noEmit` 零错误

---

## 第 2 章 — Milestone G：内容丰富度（P1）

### ▶ Task TG.1 — 新增 3 个数学活动模板

**优先级**：P1  
**预估**：90 分钟  
**依赖**：无  
**文件**：`content/activities/activity-templates.ts`

**参考现有模板结构**（仿照 `number-pattern-hunt` 写）：

**1. money-counter（买东西找钱）**
```typescript
{
  templateId: "money-counter",
  title: "买东西找钱",
  goalId: "math-thinking",
  subGoalId: "arithmetic-fluency",
  ageRange: [6, 9],
  durationMinutes: 7,
  difficultyBands: {
    L1: "总价 < 10 元，单件付款",
    L2: "总价 10-20 元，需要借位",
    L3: "多件商品，连续加减",
  },
  recommendedTools: ["narrate", "show_choices", "show_text_input"],
  systemPromptFragment: `
【活动：买东西找钱】
你是一家魔法小铺的店长。孩子是来买糖果的顾客。
- L1: 糖果单价 1-5 元，付 5 或 10 元，问找多少钱
- L2: 买 2-3 样，总价 10-20 元，付 20 元
- L3: 多买多还，中间可能退一件
目标：让孩子说出"为什么是这个数"，采到算术推理证据。
  `.trim(),
  commonMistakes: ["直接猜答案", "忽略退货", "不会倒着算"],
  hintLadder: ["先算总共多少钱", "再想给了多少", "最后算差"],
}
```

**2. number-split（数字拆分家）**
```typescript
{
  templateId: "number-split",
  title: "数字拆分家",
  goalId: "math-thinking",
  subGoalId: "number-composition",
  ageRange: [5, 8],
  durationMinutes: 6,
  difficultyBands: {
    L1: "目标数 5-8，拆成 2 个数",
    L2: "目标数 10-15，拆成 2 个数",
    L3: "目标数 10-20，拆成 3 个数",
  },
  recommendedTools: ["narrate", "show_choices", "show_text_input"],
  systemPromptFragment: `
【活动：数字拆分家】
和孩子玩"数字拆家家"：给一个数，问"能拆成哪两个（三个）数的和"。
- L1: 目标数 5-8，鼓励列出所有可能
- L2: 目标数 10-15，让孩子说出至少 2 种
- L3: 目标数 10-20，拆成 3 个正整数
目标：训练数字组合感觉和系统枚举能力。
  `.trim(),
  commonMistakes: ["只会拆一种", "重复相同组合", "用了 0"],
  hintLadder: ["从最小的数开始试", "把大数往小拆一点", "能不能用三个数？"],
}
```

**3. magic-equation（魔法等式）**
```typescript
{
  templateId: "magic-equation",
  title: "魔法等式",
  goalId: "math-thinking",
  subGoalId: "equation-thinking",
  ageRange: [6, 10],
  durationMinutes: 7,
  difficultyBands: {
    L1: "□ + a = b",
    L2: "a + □ = b 或 a - □ = c",
    L3: "□ + □ = b（多解）",
  },
  recommendedTools: ["narrate", "show_text_input", "show_choices"],
  systemPromptFragment: `
【活动：魔法等式】
AI 是一位魔法师，缺失的数字藏在魔法盒里。
- L1: 直接求和项，□ + 3 = 7
- L2: 逆向运算，8 - □ = 3
- L3: 给出一个和，让孩子填两个未知数
目标：培养"等号两边相等"的代数直觉。
  `.trim(),
  commonMistakes: ["把等号当'得到'", "只试最大数", "混淆加减"],
  hintLadder: ["想：两边要一样多", "问自己：还差几？", "如果从小数开始试呢？"],
}
```

**验收**：
- [ ] `getActivitiesForGoal("math-thinking")` 返回 7 条（原 4 + 新 3）
- [ ] 每个新模板包含完整字段（同其他模板）
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TG.2 — 新增 4 个跨领域活动模板

**优先级**：P1  
**预估**：120 分钟  
**依赖**：无  
**文件**：`content/activities/activity-templates.ts`

**要新增**：

**1. opposite-bounce（反义词弹弹球）** — LANGUAGE
```typescript
{
  templateId: "opposite-bounce",
  title: "反义词弹弹球",
  goalId: "language-thinking",
  subGoalId: "vocabulary-expansion",
  ageRange: [5, 9],
  durationMinutes: 5,
  difficultyBands: {
    L1: "简单形容词（大/小、高/低）",
    L2: "动词和状态词（前进/后退、开心/难过）",
    L3: "抽象词（勇敢/胆小、慷慨/吝啬）",
  },
  recommendedTools: ["narrate", "show_choices", "show_text_input"],
  // ... 完整填充
}
```

**2. picture-story（看图说故事）** — LANGUAGE
**3. tic-tac-think（井字棋大师）** — STRATEGY
**4. category-sort（分类大王）** — OBSERVATION

（每个都按上面 TG.1 的 money-counter 模板结构填写，内容要具体可执行，不要空字段）

**验收**：
- [ ] `ALL_ACTIVITIES.length >= 25`（原 18 + 新 3 + 新 4）
- [ ] 每个 goalId 至少有 2 个活动
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TG.4 — 活动选择去重

**优先级**：P1  
**预估**：30 分钟  
**依赖**：TG.1 + TG.2  
**文件**：`store/agent-store.ts`、`app/api/agent/start/route.ts`、`app/api/agent/turn/route.ts`

**要做**：
1. **agent-store.ts**：
   ```typescript
   interface AgentState {
     // ...
     recentActivityIds: string[]; // 保留最近 5 个
   }

   // startSession 里：发出请求时带上 recentActivityIds
   // 在 session_start 事件处理中：
   case "session_start": {
     if (event.activityId) {
       set((state) => ({
         recentActivityIds: [
           event.activityId,
           ...state.recentActivityIds.filter((id) => id !== event.activityId),
         ].slice(0, 5),
       }));
     }
     break;
   }
   ```
2. **partialize** 里保留 `recentActivityIds`（持久化到 localStorage）
3. **/start/route.ts** 和 **/turn/route.ts**：
   - 从 request body 接收 `recentActivityIds: string[]`
   - 传入 `selectActivity({ ..., recentActivityIds })`
   - 在 `session_start` SSE 事件里带 `activityId` 字段
4. **activity-selector.ts** 中确认过滤逻辑已实现（如未实现则添加：从候选池中剔除最近 N 个）

**验收**：
- [ ] 连续启动 3 次 session，拿到 3 个不同 `activityId`
- [ ] localStorage 中 `recentActivityIds` 长度 ≤ 5
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TG.3 — 年龄精度到月份

**优先级**：P2  
**预估**：30 分钟  
**依赖**：无  
**文件**：`prompts/modules/age-adapter.ts`、`prompts/modules/child-profile.ts`

**要做**：
1. 新增函数（不改原 `calcAge`）：
   ```typescript
   export function calcAgeDetailed(birthday: string): { years: number; months: number } {
     const birth = new Date(birthday);
     const now = new Date();
     let years = now.getFullYear() - birth.getFullYear();
     let months = now.getMonth() - birth.getMonth();
     if (now.getDate() < birth.getDate()) {
       months -= 1;
     }
     if (months < 0) {
       years -= 1;
       months += 12;
     }
     return { years: Math.max(0, years), months: Math.max(0, months) };
   }
   ```
2. 在 `ageAdapterModule` 和 `childProfileModule` 中使用：
   ```typescript
   const { years, months } = calcAgeDetailed(profile.birthday);
   const ageText = months > 0 ? `${years}岁${months}个月` : `${years}岁`;
   ```

**验收**：
- [ ] birthday=2019-07-01，当前日期 2026-04-10，返回 `{ years: 6, months: 9 }`
- [ ] system prompt 含"6岁9个月"
- [ ] `npx tsc --noEmit` 零错误

---

## 第 3 章 — Milestone H：体验完善

### ▶ Task TH.1 — Mood 订阅真实 TTS 播放状态

**优先级**：P2  
**预估**：60 分钟  
**依赖**：无  
**文件**：`hooks/use-tts.ts`、`components/agent/use-robot-mood.ts`

**要做**：
1. **hooks/use-tts.ts**：在模块作用域添加全局信号：
   ```typescript
   let isSpeakingNow = false;
   const listeners = new Set<() => void>();

   function setSpeaking(value: boolean) {
     if (isSpeakingNow === value) return;
     isSpeakingNow = value;
     listeners.forEach((fn) => fn());
   }

   export function getIsSpeaking(): boolean {
     return isSpeakingNow;
   }

   export function subscribeIsSpeaking(callback: () => void): () => void {
     listeners.add(callback);
     return () => listeners.delete(callback);
   }
   ```
   在 TTS 播放开始/结束的位置调用 `setSpeaking(true/false)`
2. **use-robot-mood.ts**：
   ```typescript
   import { useSyncExternalStore } from "react";
   import { getIsSpeaking, subscribeIsSpeaking } from "@/hooks/use-tts";

   const isSpeaking = useSyncExternalStore(
     subscribeIsSpeaking,
     getIsSpeaking,
     () => false // SSR fallback
   );
   ```
3. 返回值中 `isSpeaking` 改用这个订阅值（原来的 narrate 推断可保留为 fallback）

**验收**：
- [ ] TTS 真实播放时脑脑表情切到 speaking
- [ ] TTS 结束后立刻退出 speaking
- [ ] TTS 降级到 SpeechSynthesis 时也能同步
- [ ] `npx tsc --noEmit` 零错误

---

### ▶ Task TH.3 — Qwen 稳定性手动测试

**优先级**：P3  
**预估**：45 分钟  
**依赖**：Milestone F 全部完成  
**操作**：
1. `.env.local` 设置 `AI_PROVIDER_MODE=qwen`
2. 运行 `node scripts/test-qwen-stability.mjs`
3. 记录：
   - tool_call 返回率 ≥ 95%
   - 格式正确率 ≥ 90%
   - narrate 首位率 ≥ 95%
   - 平均响应时间 < 3 秒
4. 异常则调整 `lib/agent/tool-definitions.ts` 或 prompt

**输出**：测试报告粘贴到 `docs/playtest-notes.md`

---

### ▶ Task TH.4 — 浏览器端到端回归

**优先级**：P3  
**预估**：45 分钟  
**依赖**：所有代码任务完成  
**操作**：按 `docs/playtest-checklist.md` 逐项检查：
- [ ] 首页 → 选"数学思维" → /session?goal=math-thinking
- [ ] 创建 profile（昵称 + birthday=2019-07-01）
- [ ] AI 首轮：打字机出字 + 选择卡片延迟入场
- [ ] AI 气泡聚焦 + TTS 播放 + 脑脑 speaking 动画
- [ ] 选一个选项 → 用户气泡 → AI 新回复
- [ ] 5 轮对话内容有变化
- [ ] 追问场景：show_text_input 前有 narrate
- [ ] 对话历史 dim 态
- [ ] 完成卡片出现 + InputBar 消失
- [ ] "再来一局" 正常工作
- [ ] `/parent` 显示学习记录
- [ ] Chrome DevTools iPad 模拟正常

---

### ▶ Task TH.5 — 真实儿童 Playtest

**优先级**：P3（Stage 1 Gate 硬性门槛）  
**依赖**：TH.4 通过  
**操作**：
1. `npm run build && npm start`
2. Chrome 全屏 + 开屏录屏
3. 真实 7 岁孩子测试 2 个场景各 5 分钟
4. 记录到 `docs/playtest-notes.md`：
   - 主动继续意愿（1-5）
   - AI 互动自然度（1-5）
   - 操作困难点
   - 情绪变化
   - 至少 3 个改进点

---

## 第 4 章 — 执行顺序与依赖图

```
Day 1（Milestone F 打通闭环，约 2.5h）
├─ TF.4  slidingWindow 首轮保护       (15m)
├─ TF.1  agent-store sessionComplete  (30m)
├─ TF.5  会话结束 UI                  (45m)  ← 依赖 TF.1
├─ TF.2  logCompletedSession          (30m)  ← 依赖 TF.1
└─ TF.3  token 估算日志               (20m)

Day 2（Milestone G 内容扩充，约 4.5h）
├─ TG.1  数学模板 ×3                  (90m)
├─ TG.2  跨域模板 ×4                  (120m)
├─ TG.4  活动去重                     (30m)  ← 依赖 TG.1+TG.2
└─ TG.3  年龄到月份                   (30m)

Day 3（Milestone H 体验与测试，约 2.5h 代码 + 1.5h 人工）
├─ TH.1  Mood 订阅 TTS                (60m)
├─ TH.3  Qwen 稳定性测试              (45m)
└─ TH.4  E2E 回归                     (45m)

Day 4-5（线下 Playtest）
└─ TH.5  真实儿童测试
```

---

## 第 5 章 — 全局验收清单

完成所有代码任务后，必须满足：

- [ ] `npx tsc --noEmit` 全项目零错误
- [ ] 完整玩一局剧情：进入 → 互动 → end_activity → 完成卡片 → 再来一局
- [ ] `.data/brainplay.sqlite` 的 `session_logs` 表有记录
- [ ] `.data/brainplay.sqlite` 的 `observations` / `activity_session_events` 表有每轮数据
- [ ] `/parent` 页面显示最近会话摘要 + 观察列表
- [ ] 连续启动 3 次 session 拿到 3 个不同 activityId
- [ ] system prompt 中年龄显示精确到月份
- [ ] TTS 播放时脑脑 speaking 动画同步
- [ ] 15+ 轮对话后首轮开场白仍在 sliding window 内
- [ ] 终端日志能看到每轮 token 估算
- [ ] `scripts/test-qwen-stability.mjs` 全部指标达标

---

## 附录 A — 关键文件引用

**必改文件清单**：
```
lib/agent/agent-loop.ts                         (TF.3, TF.4)
store/agent-store.ts                            (TF.1, TG.4)
components/agent/session-page.tsx               (TF.2, TF.5)
content/activities/activity-templates.ts        (TG.1, TG.2)
app/api/agent/start/route.ts                    (TG.4)
app/api/agent/turn/route.ts                     (TG.4)
prompts/modules/age-adapter.ts                  (TG.3)
prompts/modules/child-profile.ts                (TG.3)
hooks/use-tts.ts                                (TH.1)
components/agent/use-robot-mood.ts              (TH.1)
```

**只读参考**：
```
docs/stage2-prep-task-breakdown.md              ← 权威任务规格
docs/ai-training-system-playbook.md             ← Phase 0 训练边界
docs/ai-training-system-roadmap.md              ← 长期路线
docs/stage1-closeout-and-mvp-gate.md            ← Closeout 标准
docs/playtest-checklist.md                      ← Playtest 执行
lib/training/domain-pedagogy.ts                 ← 已完成，理解接口
lib/training/evaluator-agent.ts                 ← 已完成，理解接口
lib/training/mastery-engine.ts                  ← 已完成，理解接口
lib/training/training-intent.ts                 ← 已完成，理解接口
lib/data/session-log.ts                         ← CompletedSessionPayload 类型
lib/data/client.ts                              ← logCompletedSession 接口
```

---

## 附录 B — 给 Cursor 的执行建议

1. **严格按 Day1 → Day2 → Day3 顺序执行**，不要并行开始（多个 task 改同一文件会冲突）
2. **每个 Task 完成后立刻跑 `npx tsc --noEmit`**，有错就停下修
3. **不要擅自重构**：只做任务书里写的事，规划外的改动一律不动
4. **不要改 `docs/` 下的规划文档**，只读
5. **不要改 `lib/training/` 下的代码**（除非任务里明确提到），这些是已经完成的
6. **遇到类型不对齐**：先读对应类型定义文件，不要随便 `as any`
7. **每完成一个 Milestone** 做一次完整浏览器手测，确认闭环不断
8. 进入 Day 3 前，务必确认 Day 1 的闭环全部跑通
