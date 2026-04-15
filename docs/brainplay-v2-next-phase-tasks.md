# BrainPlay v2 — 精确任务拆解清单

> 基于代码库实际探索（2026-03-27），每个任务可直接交给编码 AI 执行。
> 包含：5 个里程碑、26 个任务、依赖图、验收标准。

---

## Milestone A：本地冒烟测试（Mock 模式端到端跑通）

### TA.1 — 修复 `/api/agent/start` 中硬编码的 Profile

**文件**：`app/api/agent/start/route.ts`、`types/agent.ts`

**依赖**：无

**做什么**：
1. 删除 `getMockProfile()` 函数（返回硬编码 birthday=2017-06-01, nickname="小探险家"）。
2. 在 `types/agent.ts` 的 `AgentStartRequest` 接口（约第 94 行）中添加可选字段：
   ```ts
   profile?: ChildProfile;
   ```
   同时在 `types/agent.ts` 顶部添加 `import type { ChildProfile } from "./goals";`
3. 在 `app/api/agent/start/route.ts` 中，从 request body 解构 `profile`，替换原来的 `getMockProfile(profileId)` 调用：
   ```ts
   const profile: ChildProfile = body.profile ?? {
     id: profileId,
     nickname: "小朋友",
     birthday: "2018-01-01",
     goalPreferences: goalFocus,
   };
   ```

**不做什么**：
- 不删除 `profileId` 字段，sessionId 生成仍需要它。
- 不从数据库读取 profile。Profile 数据从前端 localStorage (profile-store) 通过 API 传入。

**验收**：
- `AgentStartRequest` 类型包含可选 `profile` 字段。
- 提供 `body.profile` 时传递真实 profile 给 `runAgentTurn()` 的 context。
- 不提供时用合理的默认值。
- `npx tsc --noEmit` 零错误。

---

### TA.2 — 修复 `/api/agent/turn` 中硬编码的 Profile

**文件**：`app/api/agent/turn/route.ts`

**依赖**：TA.1

**做什么**：
1. 删除 `getMockProfile()` 函数。
2. 在 body 类型中添加 `profile?: ChildProfile`。
3. 解构 `profile` 时注意避免变量名遮蔽（如用 `reqProfile`）。
4. 替换 `getMockProfile()` 调用：
   ```ts
   const resolvedProfile: ChildProfile = reqProfile ?? {
     id: "anonymous",
     nickname: "小朋友",
     birthday: "2018-01-01",
     goalPreferences: goalFocus,
   };
   ```

**不做什么**：
- 不改动 `enforceOrchestration` 或 `filterAIOutput` 调用。
- 不改动 mock 模式分支。

**验收**：文件中不再有 `getMockProfile()`，`npx tsc --noEmit` 零错误。

---

### TA.3 — 前端 Store 向 API 传递真实 Profile

**文件**：`store/agent-store.ts`

**依赖**：TA.1、TA.2

**做什么**：
1. 在 `AgentState` 接口中添加 `currentProfile: ChildProfile | null;`。
2. 修改 `startSession` 签名：
   ```ts
   startSession: (profileId: string, goalFocus?: string[], profile?: ChildProfile) => Promise<void>;
   ```
3. 在 `startSession` 实现中：
   - 将 `profile` 存入 state：`set({ ..., currentProfile: profile ?? null })`
   - 在 request 对象中添加 `profile`：`{ profileId, goalFocus, profile }`
4. 在 `sendTurn` 实现中：
   - 从 `get()` 读取 `currentProfile`
   - 在 request body 中添加 `profile: currentProfile`
5. 导入 `ChildProfile` 类型：`import type { ChildProfile } from "@/types/goals";`

**不做什么**：
- 不在 zustand store 内使用 React hooks（`useProfileStore`）。Store 是纯 JS，不是组件。
- 不持久化 `currentProfile` 到 localStorage。`partialize` 已有排除机制。

**验收**：`/api/agent/start` 和 `/api/agent/turn` 都能收到前端传来的真实 profile。

---

### TA.4 — SessionPage 传递完整 Profile 给 startSession

**文件**：`components/agent/session-page.tsx`

**依赖**：TA.3

**做什么**：
1. 在 `useEffect`（约第 149 行）中，将 `startSession` 调用改为传递完整 profile：
   ```ts
   startSession(activeProfile.id, activeProfile.goalPreferences, activeProfile);
   ```

**不做什么**：
- 不重构组件布局（那是 Milestone E 的任务）。
- 不修改 `CreateProfileForm`。

**验收**：API 请求中 nickname 和 birthday 来自 profile-store 真实数据，而非硬编码的 "小探险家"。

---

### TA.5 — 修复首页 URL Goal 参数被忽略

**文件**：`app/session/page.tsx`、`components/agent/session-page.tsx`

**依赖**：无（可与 TA.1-TA.4 并行）

**做什么**：
1. `app/session/page.tsx`（当前约 8 行）改为读取 `searchParams`：
   ```tsx
   import { SessionPage } from "@/components/agent/session-page";

   export default async function SessionRoute({
     searchParams,
   }: {
     searchParams: Promise<{ goal?: string }>;
   }) {
     const params = await searchParams;
     return <SessionPage initialGoal={params.goal} />;
   }
   ```
   注意：Next.js 16 中 server component 的 `searchParams` 是 Promise。

2. `components/agent/session-page.tsx` 添加 `initialGoal` prop：
   ```ts
   export function SessionPage({ initialGoal }: { initialGoal?: string }) {
   ```
3. 在调用 `startSession` 的 `useEffect` 中使用 `initialGoal`：
   ```ts
   const goals = initialGoal ? [initialGoal] : activeProfile.goalPreferences;
   startSession(activeProfile.id, goals, activeProfile);
   ```
4. 更新 `goalFocus` 变量（影响背景图）：
   ```ts
   const goalFocus = initialGoal ? [initialGoal] : (activeProfile?.goalPreferences ?? []);
   ```

**不做什么**：
- 不在客户端组件中使用 `useSearchParams()` hook。通过 server page 的 prop 传入。
- 不将 URL 参数写入 profile-store。URL 参数仅本次 session 有效。

**验收**：
- 点击首页 "数学思维" → `/session?goal=math-thinking` → session 使用 math-thinking 目标。
- 背景图匹配 URL 中的目标。
- 无参数直接访问 `/session` 仍使用 profile 的 goalPreferences。

---

### TA.6 — 修复 Fast Path 从未被调用

**文件**：`app/api/agent/turn/route.ts`

**依赖**：TA.2

**做什么**：
1. 在文件顶部导入：
   ```ts
   import { shouldUseFastPath, runFastPath } from "@/lib/agent/fast-path";
   ```
2. 在 Qwen 模式分支中，`runAgentTurn` 调用**之前**，添加 fast path 检查：
   ```ts
   if (shouldUseFastPath(turnRequest, lastTurnToolCalls ?? [])) {
     const fastEvents = await runFastPath(turnRequest, conversation, context);
     for (const event of fastEvents) {
       controller.enqueue(encoder.encode(encodeSSE(event)));
     }
   } else {
     // 现有的 runAgentTurn 逻辑
   }
   ```
3. 将现有的 `runAgentTurn` + orchestration + filter 逻辑移入 `else` 块。

**不做什么**：
- 不在 mock 模式添加 fast path。
- 不修改 `shouldUseFastPath()` 或 `runFastPath()` 的函数签名。

**验收**：
- 孩子选择 choice 且上一轮有 show_choices → 走 fast path（无 Qwen API 调用）。
- 孩子输入 "好的" → 走 fast path。
- 开放式语音/文字输入 → 走 `runAgentTurn()`。

---

### TA.7 — 扩展 Mock 支持多轮对话（>2 轮）

**文件**：`lib/ai/mock.ts`、`app/api/agent/turn/route.ts`

**依赖**：无

**做什么**：
1. 当前 `buildMockAgentTurn()` 始终使用 turnIndex=1，text/voice 输入直接触发 `end_activity`。
2. 修改函数签名，接受 turnIndex：
   ```ts
   export function buildMockAgentTurn(input: AgentTurnRequest, turnIndex?: number): AgentStreamEvent[]
   ```
3. 实现多轮逻辑：
   - `turnIndex >= 5` → narrate 总结 + end_activity
   - 偶数轮 → narrate + show_choices
   - 奇数轮 → narrate + show_text_input
4. 在 `app/api/agent/turn/route.ts` mock 模式分支中传入 `turnIndex`：
   ```ts
   const events = buildMockAgentTurn(turnRequest, turnIndex);
   ```

**不做什么**：
- 不修改 `buildMockAgentStart()`，它已正确。
- Mock 必须完全离线，不调用 Qwen。

**验收**：
- Mock 模式下 session 可运行 5+ 轮而不会提前结束。
- 不同轮次出现不同的工具组合（choices 与 text_input 交替）。
- 第 5 轮以后 `end_activity` 触发。

---

### TA.8 — 补充 `.env.example` 文档注释

**文件**：`.env.example`（已存在，约 26 行）

**依赖**：无

**做什么**：
1. 为每组环境变量添加分组注释：
   ```
   # === 核心模式 ===
   # mock = 离线测试, qwen = 真实 AI
   AI_PROVIDER_MODE=mock

   # === Qwen (DashScope) Chat API ===
   QWEN_API_KEY=
QWEN_MODEL=qwen3.6-plus
   QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

   # === Qwen TTS (文字转语音) ===
   QWEN_TTS_MODEL=qwen3-tts-instruct-flash-realtime
   QWEN_TTS_FALLBACK_MODEL=qwen3-tts-flash-realtime
   QWEN_TTS_REALTIME_URL=wss://dashscope.aliyuncs.com/api-ws/v1/realtime
   QWEN_TTS_SAMPLE_RATE=24000

   # === Aliyun NLS (legacy TTS/STT) ===
   ALIYUN_NLS_APPKEY=
   ALIYUN_NLS_TOKEN=
   ALIYUN_NLS_TTS_URL=https://nls-gateway-cn-beijing.aliyuncs.com/stream/v1/tts
   ALIYUN_NLS_VOICE=xiaoyun
   ...

   # === AI Gateway (v2 未使用, 兼容保留) ===
   AI_GATEWAY_URL=
   AI_GATEWAY_TOKEN=
   ...
   ```

**不做什么**：不放真实 API Key。不修改 `.env.local`。

**验收**：新开发者可以从 `.env.example` 复制到 `.env.local` 并清楚知道该填哪些 Key。

---

### TA.9 — 冒烟测试验证（手动）

**文件**：无代码修改

**依赖**：TA.1 至 TA.8 全部完成

**做什么**：
1. `.env.local` 设置 `AI_PROVIDER_MODE=mock`，运行 `npm run dev`。
2. 浏览器打开 `http://localhost:3000`，验证完整流程：
   - 首页 6 个能力域卡片可见。
   - 点击 "数学思维" → `/session?goal=math-thinking`。
   - 无 profile 时出现 CreateProfileForm，输入昵称+生日，点击 "开始冒险"。
   - Session 开始：narrate 气泡 + TTS + show_choices 3 个选项。
   - 选择一个 → narrate 回应 + 新交互工具。
   - 持续 5 轮 → `end_activity` 触发。
   - 访问 `/parent` → profile 信息展示。
3. 检查浏览器 console 和终端无报错。

**验收**：
- 完整流程无 JS 错误或服务端 500。
- Header 中显示用户填写的真实昵称（非 "小探险家"）。
- 背景图匹配 math 目标。
- Mock 响应在不同轮次有变化。

---

## Milestone B：真实 Qwen API 接入验证

### TB.1 — 运行 Qwen Tool-Use 稳定性测试

**文件**：无代码修改（运行已有脚本）

**依赖**：Milestone A 完成，`.env.local` 中有有效 `QWEN_API_KEY`

**做什么**：
1. 设置 `AI_PROVIDER_MODE=qwen`，填入真实 `QWEN_API_KEY`。
2. 运行 `node scripts/test-qwen-stability.mjs`。
3. 记录结果：tool_call 返回率、格式正确率、参数完整率、工具选择合理率。
4. 格式正确率 < 90% → 执行 TB.2；≥ 90% → 跳过 TB.2。

**验收**：20 组测试用例跑完，结果有记录。

---

### TB.2 — 调优 Tool Definitions 以提高 Qwen 合规率（条件执行）

**文件**：`lib/agent/tool-definitions.ts`、`prompts/modules/tools-description.ts`

**依赖**：TB.1（仅 tool_call 正确率 < 90% 时执行）

**做什么**：
1. 在 `tool-definitions.ts` 中，检查每个工具的 `description` 字段：
   - 确保以动词开头："朗读叙述文本…"、"展示选择卡片…"
   - 明确区分 required 和 optional 参数。
   - `narrate` 的 description 强调：**每轮必须首先调用**。
2. 在 `tools-description.ts` 中添加正确/错误的工具调用示例：
   ```
   正确示例：先 narrate("好问题！") → 再 show_choices(...)
   错误示例：直接 show_choices 不加 narrate
   ```
3. 修改后重新运行 `node scripts/test-qwen-stability.mjs`。

**不做什么**：
- 不改工具名。只改 `description` 文本和 schema 注解。
- 不添加新工具。不改 `KNOWN_TOOL_NAMES` Set。

**验收**：tool_call 格式正确率 ≥ 90%，narrate 作为首工具的比率 ≥ 95%。

---

### TB.3 — 浏览器真实 Qwen 集成测试（手动）

**文件**：无代码修改

**依赖**：TB.1 或 TB.2

**做什么**：
1. `AI_PROVIDER_MODE=qwen`，`npm run dev`，浏览器测试。
2. 验证：
   - SSE 流式渲染逐个到达（非一次性全部）。
   - 首轮响应 < 3 秒。
   - 编排约束生效（≤2 展示工具 + ≤1 输入工具）。
   - 连续 10 轮无崩溃。
3. 测试降级：设无效 `QWEN_API_KEY` → mock 兜底激活。
4. 测试超时：设不存在的 `QWEN_BASE_URL` → 20s 内恢复。

**验收**：真实 Qwen 连续 10 轮成功，降级到 mock 正常工作。

---

### TB.4 — 修复 SSE 流式粒度（条件执行）

**文件**：`app/api/agent/turn/route.ts`

**依赖**：TB.3（仅当观察到 SSE 批量发送时执行）

**做什么**：
1. 当前实现在 Qwen 模式下先收集所有 tool_call 事件，再一次性发送。
2. 重构为逐个流式发送：
   ```ts
   let displayCount = 0;
   let inputCount = 0;
   for await (const event of runAgentTurn(conversation, turnRequest, context)) {
     if (event.type === "tool_call") {
       // 内联计数和过滤
       controller.enqueue(encoder.encode(encodeSSE(event)));
     } else {
       controller.enqueue(encoder.encode(encodeSSE(event)));
     }
   }
   ```
3. 保留 orchestration 的计数限制逻辑，但从批处理改为流式。

**不做什么**：不移除 `enforceOrchestration`。不移除 `filterAIOutput`。

**验收**：浏览器 DevTools Network 中 SSE 事件逐个到达，narrate 气泡先于 show_choices 出现。

---

## Milestone C：Prompt 调优 + 年龄适配

### TC.1 — 添加 Prompt Token 计数日志

**文件**：`prompts/agent-system-prompt.ts`

**依赖**：无

**做什么**：
1. 在 `buildSystemPrompt()` 的 return 之前添加开发环境日志：
   ```ts
   if (process.env.NODE_ENV === "development") {
     console.debug(`[system-prompt] estimated tokens: ${estimateTokens(prompt)}, chars: ${prompt.length}`);
   }
   ```
   `estimateTokens()` 已存在于该文件中。

**不做什么**：不在生产环境输出日志（用 NODE_ENV 守卫）。不改 prompt 拼装顺序。

**验收**：dev 模式下每次 agent turn 终端显示 token 估算，保持 < 2500。

---

### TC.2 — 强化 7 岁年龄适配规则

**文件**：`prompts/modules/age-adapter.ts`

**依赖**：无

**做什么**：
1. 在 `<=7` 岁的规则段（约第 22-25 行）中，添加：
   - `- 每个 show_choices 最多 2-3 个选项，文字简短`
   - `- 数学题只用 10 以内加减法`
   - `- 使用大量表情符号增加趣味`
2. 将原有的 "每句不超过 10 个字" 改为 "每句不超过 15 个字"。
3. 确认 `calcAge("2019-07-01")` 在 2026-03-27 返回 6（生日前），属 `<=7` 组。正确。

**不做什么**：不改 `calcAge()` 的计算逻辑。不改 8-9 或 >=10 岁分段。

**验收**：`ageAdapterModule("2019-07-01")` 输出包含新规则，模块 token 数 < 200。

---

### TC.3 — 在编排规则中添加工具多样性引导

**文件**：`prompts/modules/orchestration-rules.ts`

**依赖**：无

**做什么**：
1. 在 "对话节奏" 小节之后添加新小节：
   ```
   ### 工具多样性
   - 不要连续 2 轮使用完全相同的工具组合
   - 如果上一轮用了 show_choices，这一轮优先用 show_text_input 或 request_voice
   - 如果上一轮用了 show_text_input，这一轮优先用 show_choices 或 show_image
   - 每 3 轮至少使用一次不同类型的输入工具
   ```

**不做什么**：不改 max 2 display + max 1 input 的限制。模块总 token < 400。

**验收**：orchestration-rules 模块包含多样性引导，token 估算 < 400。

---

### TC.4 — 强化身份模块的自适应行为规则

**文件**：`prompts/modules/identity.ts`

**依赖**：无

**做什么**：
1. 在身份模块中添加自适应行为规则：
   ```
   - 孩子说"不会"或"太难了"时：降低一级难度，给一个具体的提示（不是答案）
   - 孩子连续答对 2 次：说"越来越厉害了！"然后升级难度
   - 孩子沉默（简单回复如"嗯""好"）：用更有趣的问题重新吸引注意力
   ```

**不做什么**：不改角色名 "脑脑" 或狐狸身份。模块 token < 300。

**验收**：identity 模块包含自适应规则，角色保持一致。

---

### TC.5 — Prompt 对比验证测试（手动）

**文件**：无代码修改（运行 `node scripts/test-qwen-tools.mjs`）

**依赖**：TC.1-TC.4

**做什么**：
1. 交互式运行测试脚本，逐个验证场景：
   - 输入 "我不会" → AI 给提示而非答案 ✓/✗
   - 连续答对 2 次 → AI 升级难度 ✓/✗
   - 输入 "好" → AI 提出更有趣的问题 ✓/✗
   - birthday=2019-07-01 → 语言简单化 ✓/✗
   - birthday=2016-01-01 → 语言复杂化 ✓/✗
2. 记录每个场景的 AI 实际表现。

**验收**：7 岁 prompt 产出比 10 岁明显简单的语言，AI 工具使用多样化。

---

## Milestone D：真实孩子内测

### TD.1 — 准备测试环境

**文件**：无代码修改

**依赖**：Milestone A + B + C 完成

**做什么**：
1. `AI_PROVIDER_MODE=qwen`，有效 API Key。
2. `npm run build && npm start`（生产模式更快）。
3. Chrome 全屏模式（F11），打开 `http://localhost:3000`。
4. 开启录屏（OBS 或 Windows 自带）。
5. 用孩子真实信息创建 profile（昵称 + 生日 2019-07-01）。

**验收**：生产模式加载无错误，录屏已启动。

---

### TD.2 — 执行 3 个测试场景

**文件**：无代码修改

**依赖**：TD.1

**做什么**：
1. **场景 1 — 数学（5 分钟）**：选 "数学思维"，观察：孩子能否理解选择卡片、点击是否正确、AI 响应速度是否可接受（< 3s）、TTS 发音是否清晰。
2. **场景 2 — 自由玩（5 分钟）**：直接进入 /session，观察：AI 是否选择多样化活动、孩子是否保持兴趣。
3. **场景 3 — 语音（5 分钟）**：如出现 request_voice，观察：孩子能否使用麦克风、STT 转写是否准确。
4. 记录：参与度（1-5）、困惑点、UI 问题、崩溃。

**不做什么**：不帮孩子操作 UI（观察其能否自行理解）。

**验收**：孩子独立完成至少 1 个完整活动（5 轮），过程无崩溃。

---

### TD.3 — 测后修复和调整

**文件**：根据发现决定

**依赖**：TD.2

**做什么**：
1. 回顾录屏和观察笔记。
2. 分类：P0（阻断性）立即修复、P1（重要）记录待修、P2（次要）后续迭代。

**验收**：所有 P0 问题已修复，P1 问题有复现步骤。

---

## Milestone E：机器人脑脑（Step 1：CSS/Framer Motion 快速版）

### TE.1 — 生成机器人角色素材

**文件**：`public/illustrations/character/robot-happy.png`、`robot-thinking.png`、`robot-surprised.png`、`robot-encouraging.png`、`robot-playful.png`

**依赖**：无（可与 Milestone A 并行）

**做什么**：
1. 使用 Gemini 图片生成创建 5 个机器人表情变体：
   - `robot-happy.png` — 微笑，眼睛明亮，手臂放松
   - `robot-thinking.png` — 头部微倾，头顶有问号或齿轮
   - `robot-surprised.png` — 眼睛睁大，手臂抬起
   - `robot-encouraging.png` — 竖大拇指，温暖光晕
   - `robot-playful.png` — 眨眼，俏皮姿势
2. 每张要求：
   - 512×512 像素，PNG 透明背景。
   - 5 张设计一致（同一个机器人，不同表情）。
   - 儿童友好，圆润可爱，不吓人不工业。
   - 配色：teal (#1f6659) 主色调，warm orange (#dd7d4a) 点缀。
3. 放入 `public/illustrations/character/`。

**不做什么**：
- 不删除现有 `brainy-*.png` 文件（作为 fallback 保留）。
- 不使用 SVG（图片切换方案需要 PNG）。

**验收**：5 个 `robot-*.png` 文件存在，透明背景，风格统一。

---

### TE.2 — 创建 RobotCharacter 组件

**文件**：`components/agent/robot-character.tsx`（新建）

**依赖**：TE.1

**做什么**：
1. 创建组件，导出类型和组件：
   ```tsx
   "use client";
   import { motion, AnimatePresence } from "framer-motion";
   import Image from "next/image";

   export type RobotMood = "happy" | "thinking" | "surprised" | "encouraging" | "playful";
   export type RobotSize = "small" | "medium" | "large";

   interface RobotCharacterProps {
     mood: RobotMood;
     isSpeaking: boolean;
     size?: RobotSize;
   }
   ```
2. SIZE_MAP 映射：small=80px(w-20 h-20)、medium=160px(w-40 h-40)、large=240px(w-60 h-60)。
3. 动画效果（全部用 Framer Motion）：
   - **待机浮动**：`animate={{ y: [0, -6, 0] }}`，duration 3s, infinite
   - **表情切换**：`AnimatePresence mode="wait"` 交叉淡入（opacity + scale 0.95→1，300ms）
   - **说话指示**：isSpeaking 时底部脉冲椭圆（`scaleX: [1, 1.3, 1]`，600ms）
   - **思考**：mood=thinking 时头顶浮动问号（`y: [0, -4, 0]`，1.5s）
   - **开心说话**：mood=happy + isSpeaking 时 3 个 ✨ 粒子飘上消失
   - **眨眼**：全局 opacity 闪烁（`[1,1,0,1,1]` 配 times `[0,0.45,0.47,0.49,1]`，4s）
4. 图片加载失败时 fallback 到 `brainy-happy.png`：
   ```tsx
   onError={(e) => {
     (e.currentTarget as HTMLImageElement).src = "/illustrations/character/brainy-happy.png";
   }}
   ```

**不做什么**：
- 不用 CSS `@keyframes`（globals.css 中的动画给其他组件用）。全部用 Framer Motion。
- 不在此组件中导入 `agent-store`。Mood 通过 props 传入。
- 不添加音效。

**验收**：
- 任何 mood 值都能正确渲染，无报错。
- 浮动动画可见（机器人缓缓上下起伏）。
- 切换 mood prop 时平滑交叉淡入。
- isSpeaking=true 显示脉冲指示器。
- `npx tsc --noEmit` 零错误。

---

### TE.3 — 创建机器人 Mood 推导 Hook

**文件**：`components/agent/use-robot-mood.ts`（新建）

**依赖**：TE.2

**做什么**：
1. 创建自定义 hook，从 agent-store 状态推导 `RobotMood` 和 `isSpeaking`：
   ```ts
   "use client";
   import { useMemo } from "react";
   import { useAgentStore } from "@/store/agent-store";
   import type { RobotMood } from "./robot-character";

   export function useRobotMood(): { mood: RobotMood; isSpeaking: boolean } {
     const isStreaming = useAgentStore((s) => s.isStreaming);
     const error = useAgentStore((s) => s.error);
     const activeToolCalls = useAgentStore((s) => s.activeToolCalls);

     return useMemo(() => {
       if (error) return { mood: "surprised" as const, isSpeaking: false };
       if (isStreaming && activeToolCalls.length === 0)
         return { mood: "thinking" as const, isSpeaking: false };

       const lastTool = activeToolCalls[activeToolCalls.length - 1];
       if (!lastTool) return { mood: "happy" as const, isSpeaking: false };

       if (lastTool.name === "narrate")
         return { mood: "happy" as const, isSpeaking: true };
       if (lastTool.name === "award_badge")
         return { mood: "encouraging" as const, isSpeaking: false };
       if (lastTool.name === "end_activity")
         return { mood: "encouraging" as const, isSpeaking: false };
       if (lastTool.name === "show_choices" || lastTool.name === "show_text_input")
         return { mood: "playful" as const, isSpeaking: false };

       return { mood: "happy" as const, isSpeaking: false };
     }, [isStreaming, error, activeToolCalls]);
   }
   ```

**不做什么**：
- 不在 `agent-store.ts` 中添加 `mood` 字段。Mood 是推导值，不存储。
- 不连接 Web Speech API 的 onstart/onend 事件（那是未来优化）。

**验收**：hook 对各状态返回正确 mood：streaming→thinking, error→surprised, narrate→happy+speaking, award_badge→encouraging。

---

### TE.4 — 重构 SessionPage 布局集成机器人

**文件**：`components/agent/session-page.tsx`

**依赖**：TE.2、TE.3

**做什么**：
1. 导入新组件：
   ```ts
   import { RobotCharacter } from "@/components/agent/robot-character";
   import { useRobotMood } from "@/components/agent/use-robot-mood";
   ```
2. 在 `SessionPage` 函数中添加 mood hook：`const { mood, isSpeaking } = useRobotMood();`

3. **布局重构**（叠加式）：
   - 外层容器从 `max-w-2xl` 改为 `max-w-4xl`。
   - 添加机器人固定定位层：
     ```tsx
     {/* 桌面端：左侧大机器人 */}
     <div className="pointer-events-none fixed bottom-24 left-4 z-20 hidden lg:block drop-shadow-lg">
       <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="large" />
     </div>
     {/* 移动端：左下角小机器人 */}
     <div className="pointer-events-none fixed bottom-20 left-2 z-20 lg:hidden">
       <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="small" />
     </div>
     ```
   - 内容区添加桌面端左偏移：`<div className="lg:ml-64">` 包裹原有 `max-w-2xl` 内容。

4. **移除 ThinkingIndicator 中的狐狸头像**：只保留弹跳圆点，删除 `<Image src="brainy-thinking.png">` 元素。

5. **更新 CreateProfileForm**：`brainy-happy.png` → `robot-happy.png`（约第 46 行）。

6. **更新顶部栏 header**：`brainy-happy.png` → `robot-happy.png`（约第 183 行），保留文字 "脑脑"。

7. 响应式断点：
   - `lg:`（1024px+）：Robot 240px 在左，内容右移 `lg:ml-64`（256px）。
   - `lg` 以下：Robot 80px 在左下角，内容全宽。
   - Robot 设 `pointer-events-none` 不阻挡内容点击。
   - Robot 设 `z-20` 在内容之上但在弹窗之下。
   - `bottom-24`（96px）确保机器人在 InputBar（fixed bottom-0, h~56px）之上。

**不做什么**：
- 不移除 InputBar 或改变其定位。
- 不修改 `universal-renderer.tsx`。
- 不添加 feature flag（TE.7 做）。
- 不改 content 容器内的 `max-w-2xl`，只在外面加 `lg:ml-64` 包裹。
- 不让机器人可交互（点击等）。Step 1 纯展示。

**验收**：
- 桌面端：机器人在左侧可见，内容在右侧，不重叠。
- 移动端：机器人小图在左下角，内容全宽。
- AI streaming 时机器人切换为思考表情。
- narrate 时机器人开心 + 说话指示器。
- 原有功能（工具渲染、输入、错误）不受影响。
- mood 切换时无布局跳动。

---

### TE.5 — 更新 AgentNarrator 移除头像

**文件**：`components/agent/agent-narrator.tsx`

**依赖**：TE.4

**做什么**：
1. 删除头像区域（约第 59-75 行）：包括 `<div className="relative flex h-10 w-10">` 容器、`<img>` 元素、emoji fallback `<div>`。
2. 删除外层 `<div className="flex items-start gap-3">` 包裹。
3. 保留对话气泡本体：
   ```tsx
   return (
     <div className="rounded-[20px] border border-border bg-white/90 px-4 py-3 shadow-sm">
       {speakerName && (
         <p className={`mb-1 text-[11px] font-semibold uppercase tracking-widest ${roleColors[voiceRole] ?? "text-accent"}`}>
           {speakerName}
         </p>
       )}
       <p className="text-sm leading-6 text-foreground">{text}</p>
     </div>
   );
   ```

**不做什么**：
- 不改 TTS 逻辑（第 27-48 行的 Web Speech API 保留）。
- 不移除 `roleColors` 映射。
- 不改组件 props 接口。

**验收**：narrate 气泡无左侧狐狸头像，TTS 照常自动播放，视觉样式（圆角、边框、阴影）不变。

---

### TE.6 — 响应式测试和视觉打磨

**文件**：`components/agent/session-page.tsx`

**依赖**：TE.4、TE.5

**做什么**：
1. 在以下视口测试：
   - 桌面 1440×900：Robot large 在左，内容在右。
   - iPad 竖屏 768×1024：Robot small 在左下角。
   - iPhone 375×812：Robot small 在左下角，内容不被裁切。
2. 如机器人遮挡 InputBar，调整 `bottom` 值（bottom-16 / bottom-20 / bottom-24）。
3. 为机器人添加投影增强层次感：`drop-shadow-lg`。
4. 可选：添加光晕效果，使用已有 globals.css 中的 `halo-pulse` keyframe：
   ```tsx
   <div className="absolute inset-0 -z-10 animate-[halo-pulse_3s_ease-in-out_infinite] rounded-full bg-accent/10" />
   ```

**不做什么**：
- 不在 globals.css 中添加新 `@keyframes`。使用已有的或 Framer Motion。
- 不随意改断点值（`lg:` = 1024px）除非测试确认需要。

**验收**：3 个视口尺寸下机器人和内容无重叠，InputBar 在移动端完全可用，无水平滚动条。

---

### TE.7 — 预留 Live2D 集成点（Step 2 准备）

**文件**：`components/agent/session-page.tsx`

**依赖**：TE.4

**做什么**：
1. 在文件顶部添加 feature flag：
   ```ts
   const USE_LIVE2D = false; // Live2D 模型就绪后改为 true
   ```
2. 添加注释占位的 lazy import：
   ```ts
   // Live2D 组件就绪后取消注释：
   // const RobotLive2D = dynamic(() => import("./robot-live2d").then(m => ({ default: m.RobotLive2D })), { ssr: false });
   ```
3. 在机器人渲染区添加条件分支（目前两个分支都渲染 RobotCharacter）：
   ```tsx
   {USE_LIVE2D ? (
     <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="large" />
     // 上面这行在 Live2D 就绪后替换为 <RobotLive2D ... />
   ) : (
     <RobotCharacter mood={mood} isSpeaking={isSpeaking} size="large" />
   )}
   ```

**不做什么**：
- 不安装 `pixi.js` 或 `pixi-live2d-display`。
- 不创建 `robot-live2d.tsx`（那是未来独立任务）。
- 不设 `USE_LIVE2D = true`。

**验收**：flag 存在且为 false，注释清晰说明如何切换，行为与 TE.4 无变化。

---

## 依赖图

```
TA.1 ──→ TA.2 ──→ TA.3 ──→ TA.4 ──→ TA.9
                     │
TA.5 ───────────────────────────────→ TA.9
TA.6（依赖 TA.2）─────────────────→ TA.9
TA.7 ──────────────────────────────→ TA.9
TA.8 ──────────────────────────────→ TA.9

TA.9 ──→ TB.1 ──→ TB.2（条件）──→ TB.3 ──→ TB.4（条件）

TC.1 ─┐
TC.2 ─┼──→ TC.5
TC.3 ─┤
TC.4 ─┘

TB.3 + TC.5 ──→ TD.1 ──→ TD.2 ──→ TD.3

TE.1 ──→ TE.2 ──→ TE.3 ──→ TE.4 ──→ TE.5 ──→ TE.6
                                  └──→ TE.7
```

**可并行任务组**：
- TA.5、TA.7、TA.8 互相独立，可并行
- TC.1、TC.2、TC.3、TC.4 互相独立，可并行
- **TE.1-TE.7 整体可与 A、B 并行开发**
- D 需要 A + B + C + E-Step1 全部完成

---

## 任务总表

| ID | 标题 | 关键文件 | 依赖 |
|----|------|----------|------|
| TA.1 | 修复 /api/agent/start 硬编码 profile | `app/api/agent/start/route.ts`, `types/agent.ts` | — |
| TA.2 | 修复 /api/agent/turn 硬编码 profile | `app/api/agent/turn/route.ts` | TA.1 |
| TA.3 | 前端 store 向 API 传递真实 profile | `store/agent-store.ts` | TA.1, TA.2 |
| TA.4 | SessionPage 传递完整 profile | `components/agent/session-page.tsx` | TA.3 |
| TA.5 | 修复 URL goal 参数被忽略 | `app/session/page.tsx`, `components/agent/session-page.tsx` | — |
| TA.6 | 修复 fast path 从未调用 | `app/api/agent/turn/route.ts` | TA.2 |
| TA.7 | 扩展 mock 支持多轮对话 | `lib/ai/mock.ts`, `app/api/agent/turn/route.ts` | — |
| TA.8 | 补充 .env.example 注释 | `.env.example` | — |
| TA.9 | 冒烟测试验证（手动） | — | TA.1-TA.8 |
| TB.1 | 运行 Qwen 稳定性测试 | — | Milestone A |
| TB.2 | 调优 tool definitions（条件） | `lib/agent/tool-definitions.ts`, `prompts/modules/tools-description.ts` | TB.1 |
| TB.3 | 浏览器 Qwen 集成测试 | — | TB.1/TB.2 |
| TB.4 | 修复 SSE 流式粒度（条件） | `app/api/agent/turn/route.ts` | TB.3 |
| TC.1 | 添加 prompt token 计数日志 | `prompts/agent-system-prompt.ts` | — |
| TC.2 | 强化 7 岁年龄适配 | `prompts/modules/age-adapter.ts` | — |
| TC.3 | 添加工具多样性规则 | `prompts/modules/orchestration-rules.ts` | — |
| TC.4 | 强化身份模块自适应规则 | `prompts/modules/identity.ts` | — |
| TC.5 | Prompt 对比验证（手动） | — | TC.1-TC.4 |
| TD.1 | 准备测试环境 | — | A+B+C |
| TD.2 | 执行 3 个测试场景 | — | TD.1 |
| TD.3 | 测后修复 | varies | TD.2 |
| TE.1 | 生成机器人角色素材 | `public/illustrations/character/robot-*.png` | — |
| TE.2 | 创建 RobotCharacter 组件 | `components/agent/robot-character.tsx` | TE.1 |
| TE.3 | 创建 mood 推导 hook | `components/agent/use-robot-mood.ts` | TE.2 |
| TE.4 | 重构 SessionPage 集成机器人 | `components/agent/session-page.tsx` | TE.2, TE.3 |
| TE.5 | 更新 AgentNarrator 移除头像 | `components/agent/agent-narrator.tsx` | TE.4 |
| TE.6 | 响应式测试和打磨 | `components/agent/session-page.tsx` | TE.4, TE.5 |
| TE.7 | 预留 Live2D 集成点 | `components/agent/session-page.tsx` | TE.4 |
