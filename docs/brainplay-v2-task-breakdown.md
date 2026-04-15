# BrainPlay v2 任务拆解清单

> 每个任务是一个独立的、可分配给编码 AI 执行的最小单元。
> 标注了依赖关系、输入/输出、验收标准。

---

## Step 0：Qwen tool_use 可行性验证

### T0.1 编写 Qwen tool_use 测试脚本

- **文件**：`scripts/test-qwen-tools.mjs`
- **输入**：需要读取 `.env.local` 中的 `QWEN_API_KEY`、`QWEN_BASE_URL`、`QWEN_MODEL`
- **做什么**：
  - 硬编码一个简化版 System Prompt（身份+工具说明，约 800 tokens）
  - 硬编码 8 个首发工具的 JSON Schema（narrate、show_choices、show_text_input、show_image、request_voice、think、award_badge、end_activity）
  - 调用 Qwen 的 `/chat/completions` 接口，传入 `tools` 参数和 `tool_choice: "auto"`
  - 支持在终端交互式输入（模拟孩子的话），打印 AI 返回的 tool_calls 原始 JSON
  - 支持连续多轮对话（维护 messages 数组）
  - 每轮打印：tool 名称、参数、是否格式正确、耗时
- **不做什么**：不需要 streaming，不需要前端，不需要 mock
- **验收**：运行 `node scripts/test-qwen-tools.mjs`，能交互式对话 10 轮，输出清晰可读

### T0.2 编写 tool_use 稳定性统计脚本

- **文件**：`scripts/test-qwen-stability.mjs`
- **依赖**：T0.1
- **做什么**：
  - 预设 20 组测试输入（覆盖：首轮打招呼、选择题点击、开放式提问、要求换活动、说"我不会"、说英语、答对、答错等场景）
  - 自动批量跑，统计：tool_call 格式正确率、工具选择合理率、参数完整率
  - 输出统计报告到终端
- **验收**：能自动跑完 20 组输入，输出正确率统计

---

## Step 1：定义协议

### T1.1 创建 Agent 类型定义

- **文件**：`types/agent.ts`
- **做什么**：定义以下类型（纯类型，无实现代码）
  - `ToolCallId`：string
  - `ToolName`：联合类型，首发 8 个工具名 + 延后工具名
  - `ToolCall`：`{ id: ToolCallId, name: ToolName, arguments: Record<string, unknown> }`
  - `ToolCallResult`：`ToolCall & { renderedAt?: number, status: "pending" | "rendered" | "responded" }`
  - `InputType`：`"choice" | "text" | "voice" | "drag" | "photo" | "camera" | "number" | "drawing" | "emotion"`
  - `InputMeta`：`{ choiceId?: string, fragments?: string[], photoBase64?: string, numberValue?: number, emotionId?: string }`
  - `ConversationMessage`：`{ role: "system" | "user" | "assistant" | "tool", content?: string, toolCalls?: ToolCall[], name?: string }`
  - `AgentTurnRequest`：`{ sessionId: string, input: string, inputType: InputType, inputMeta?: InputMeta }`
  - `AgentStartRequest`：`{ profileId: string, goalFocus?: string[] }`
  - `AgentStreamEvent`：联合类型 `SessionStartEvent | ToolCallEvent | SystemEffectEvent | TurnEndEvent | ErrorEvent`
  - 每个 Event 类型的具体字段
- **验收**：`npx tsc --noEmit` 通过

### T1.2 创建 Goals 类型定义

- **文件**：`types/goals.ts`
- **做什么**：定义以下类型
  - `TrainingGoal`：`{ id, label, description, subGoals: SubGoal[] }`
  - `SubGoal`：`{ id, label, parentGoalId, observableBehaviors: string[], difficultyLevels: DifficultyLevel[], completionCriteria: CompletionCriteria, activityTemplates?: ActivityTemplate[] }`
  - `DifficultyLevel`：`{ level: "L1" | "L2" | "L3" | "L4", label, description }`
  - `CompletionCriteria`：`{ correctnessRate?, maxHintCount?, selfExplained? }`
  - `ActivityTemplate`：`{ id, label, goalId, subGoalId, description, suggestedTools: ToolName[], ageRange: [number, number], durationMinutes, systemPromptFragment, exampleFlow? }`
  - `ChildProfile`：`{ id, nickname, birthday, goalPreferences: string[], recentObservations?: ObservationSummary[] }`
  - `ObservationSummary`：`{ goalId, subGoalId, skill, observation, confidence, difficultyLevel, createdAt }`
- **验收**：`npx tsc --noEmit` 通过

### T1.3 创建工具 JSON Schema 定义

- **文件**：`lib/agent/tool-definitions.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `TOOL_DEFINITIONS` 数组，格式为 Qwen/OpenAI 兼容的 `tools` 参数格式
  - 每个工具：`{ type: "function", function: { name, description, parameters: { type: "object", properties: {...}, required: [...] }, strict: true } }`
  - 覆盖 8 个首发工具，每个工具的参数严格定义
  - 导出 `FIRST_LAUNCH_TOOLS`（首发 8 个）和 `ALL_TOOLS`（含延后工具的占位）
  - `think` 工具的 `nextToolSuggestion` 参数为 `string[]`（可选）
- **参考**：方案文档第二节"AI 工具定义"
- **验收**：导出的数组能直接作为 Qwen API 的 `tools` 参数传入

### T1.4 创建工具参数校验器

- **文件**：`lib/agent/tool-validators.ts`
- **依赖**：T1.1、T1.3
- **做什么**：
  - 导出 `validateToolCall(call: ToolCall): { valid: boolean, fixed?: ToolCall, errors?: string[] }`
  - 对每个工具名，校验 arguments 是否符合 Schema
  - **自动修复逻辑**：
    - `narrate` 缺少 `autoSpeak` → 补默认 `true`
    - `show_choices` 的 `choices` 不是数组 → 尝试包装成数组
    - 数字字段传了字符串 → 尝试 `Number()` 转换
    - 工具名不在注册表中 → 返回 `{ valid: false }`
  - 导出 `isKnownTool(name: string): boolean`
- **验收**：编写 5 个单元测试用例（正确调用、缺参数、类型错误、未知工具名、可修复场景），全部通过

---

## Step 2：Agent 后端

### T2.1 Qwen 客户端添加 tool_use 支持

- **文件**：`lib/ai/qwen-chat.ts`
- **依赖**：T1.3
- **做什么**：
  - 保留现有 `runQwenDirectChat()` 不动
  - 新增 `async function* streamQwenWithTools(messages, tools, options?): AsyncGenerator<QwenStreamChunk>`
  - QwenStreamChunk 类型：`{ type: "text_delta", content: string } | { type: "tool_call_delta", index: number, id?: string, name?: string, argumentsDelta?: string } | { type: "done" } | { type: "error", message: string }`
  - 内部实现：调用 `QWEN_BASE_URL/chat/completions`，`stream: true`，`tools` 参数，`tool_choice: "auto"`
  - 解析 SSE 流中的 `delta.content` 和 `delta.tool_calls`
  - temperature 默认 0.4，max_tokens 默认 1500
  - 超时 20 秒
- **不做什么**：不改动现有函数，不涉及 gateway 或 mock
- **验收**：能调用并流式返回 tool_calls

### T2.2 创建 Agent Loop 核心

- **文件**：`lib/agent/agent-loop.ts`
- **依赖**：T2.1、T1.4、T2.5（prompt）
- **做什么**：
  - 导出 `async function* runAgentTurn(conversation, childInput, context): AsyncGenerator<AgentStreamEvent>`
  - 内部流程：
    1. 调用 `buildSystemPrompt(context)` 生成 system prompt
    2. 拼装 messages 数组：`[system, ...conversation, newUserMessage]`
    3. 对话历史滑动窗口：只保留最近 10 轮（20 条 messages）
    4. 调用 `streamQwenWithTools(messages, FIRST_LAUNCH_TOOLS)`
    5. 累积 tool_call 参数，完整后调用 `validateToolCall()` 校验
    6. 校验通过 → yield `ToolCallEvent`
    7. 系统工具（think/award_badge/end_activity）→ 调用 `executeSystemTool()` → yield `SystemEffectEvent`
    8. 全部完成 → yield `TurnEndEvent`
  - 错误处理：Qwen 调用失败 → 调用 mock fallback → yield mock 的 tool calls
  - 3 层降级：qwen-direct → gateway（如果配置了）→ mock
- **验收**：传入 mock 的 conversation 和 childInput，能 yield 出合法的 AgentStreamEvent 序列

### T2.3 创建服务端编排约束层

- **文件**：`lib/agent/orchestration-guard.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `function enforceOrchestration(toolCalls: ToolCall[], lastTurnToolCalls?: ToolCall[]): ToolCall[]`
  - 规则实现：
    1. 展示型工具最多 2 个，超出截断
    2. 输入请求工具最多 1 个，超出截断
    3. 如果上一轮有输入请求且未收到回复，移除本轮的输入请求工具
    4. `narrate` 调到最前面（排序）
    5. 如果没有 `narrate` 且有交互工具 → 自动补一个 `narrate`（文本："好的，我们来试试这个！"）
  - 导出 `function checkActivityStructure(turnIndex: number, toolCalls: ToolCall[]): ToolCall[]`
    - turnIndex === 0 且没有 narrate → 自动补开场白
- **验收**：编写测试用例覆盖所有规则

### T2.4 创建快速路径

- **文件**：`lib/agent/fast-path.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `function shouldUseFastPath(input: AgentTurnRequest, lastToolCalls: ToolCall[]): boolean`
    - 返回 true 的条件：inputType 是 "choice" 且 lastToolCalls 中有 show_choices
    - 或 input.input 匹配简单回复模式（"好的"、"嗯"、"继续"、"下一个"等，中英文）
  - 导出 `async function runFastPath(input, conversation, context): Promise<AgentStreamEvent[]>`
    - 用一个精简的 prompt（只含最近 2 轮对话 + 选择结果 + 简短指令）调用 Qwen
    - 或直接用轻量逻辑生成下一步（如选择题后的反馈）
- **验收**：choice 输入走快速路径，开放式语音输入不走

### T2.5 创建 System Prompt 模块化构建器

- **文件**：`prompts/agent-system-prompt.ts` + `prompts/modules/*.ts`（7 个文件）
- **依赖**：T1.1、T1.2
- **做什么**：
  - `prompts/modules/identity.ts` — 导出 `identityModule(): string`，返回身份描述（~200 tokens）
  - `prompts/modules/tools-description.ts` — 导出 `toolsDescriptionModule(): string`，返回 8 个首发工具的使用说明和示例（~500 tokens）
  - `prompts/modules/age-adapter.ts` — 导出 `ageAdapterModule(birthday: string): string`，根据生日计算年龄，返回对应年龄段的适配规则（~150 tokens）
  - `prompts/modules/safety-rules.ts` — 导出 `safetyRulesModule(): string`，返回三层安全规则：内容+视觉+关系（~200 tokens）
  - `prompts/modules/goal-context.ts` — 导出 `goalContextModule(goals: string[]): string`，返回当前目标方向描述（~300 tokens）
  - `prompts/modules/child-profile.ts` — 导出 `childProfileModule(profile: ChildProfile): string`，返回孩子信息（~150 tokens）
  - `prompts/modules/orchestration-rules.ts` — 导出 `orchestrationRulesModule(): string`，返回输出格式和编排规则（~200 tokens）
  - `prompts/agent-system-prompt.ts` — 导出 `buildSystemPrompt(profile, goals, currentActivity?): string`，组装所有模块
- **参考**：方案文档第七节完整内容
- **验收**：`buildSystemPrompt()` 输出总 token 数 < 2500（用字数估算：1 中文字 ≈ 1.5 tokens）

### T2.6 创建兜底工具生成器

- **文件**：`lib/agent/fallback.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `function buildFallbackToolCalls(): ToolCall[]`
    - 返回一个安全的兜底响应：1 个 narrate（"哎呀我有点迷糊了…"）+ 1 个 show_choices（2 个简单选项）
  - 导出 `function buildErrorRecoveryToolCalls(error: string): ToolCall[]`
    - 根据错误类型返回不同的恢复 tool calls
- **验收**：返回的 ToolCall 数组能通过 validateToolCall 校验

### T2.7 创建内容安全过滤器

- **文件**：`lib/agent/content-filter.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `function filterChildInput(input: string): { filtered: string, flagged: boolean, reason?: string }`
    - 检测手机号（11 位数字）、邮箱、地址关键词 → 替换为 [已隐藏] 并标记 flagged
  - 导出 `function filterAIOutput(toolCalls: ToolCall[]): ToolCall[]`
    - 扫描所有 narrate 的 text 内容
    - 检测暴力/恐怖关键词 → 替换为安全表达
    - 检测依赖性语言（"你只需要我"等模式）→ 移除
- **验收**：输入 "我家住在北京市朝阳区xxx路" → 输出中地址被替换

### T2.8 重写 Mock Agent

- **文件**：`lib/ai/mock.ts`
- **依赖**：T1.1
- **做什么**：
  - 保留现有 `buildMockChatResponse` 等函数（向后兼容，Step 7 才删）
  - 新增 `function buildMockAgentStart(): AgentStreamEvent[]`
    - 返回：narrate（"你好呀！我是脑脑…"）+ show_choices（3 个能力域选择）
  - 新增 `function buildMockAgentTurn(input: AgentTurnRequest): AgentStreamEvent[]`
    - 根据 inputType 返回不同的 mock 响应
    - choice → narrate 反馈 + 下一个 show_choices
    - text/voice → narrate 回应 + show_choices 或 end_activity
- **验收**：`buildMockAgentStart()` 和 `buildMockAgentTurn()` 返回的事件序列结构正确

### T2.9 创建 SSE 流解析器

- **文件**：`lib/agent/stream-parser.ts`
- **做什么**：
  - 导出 `function encodeSSE(event: AgentStreamEvent): string`
    - 将 AgentStreamEvent 编码为 SSE 格式字符串：`event: {type}\ndata: {json}\n\n`
  - 导出 `function parseSSE(chunk: string): AgentStreamEvent[]`
    - 解析 SSE 格式字符串为 AgentStreamEvent 数组
- **验收**：encode → parse 往返测试通过

### T2.10 创建系统工具执行器

- **文件**：`lib/agent/tool-executor.ts`
- **依赖**：T1.1
- **做什么**：
  - 导出 `function executeSystemTool(call: ToolCall): SystemEffect | null`
  - `think` → 返回 null（不产生效果，仅日志）
  - `award_badge` → 返回 `{ type: "award_badge", data: call.arguments }`
  - `end_activity` → 返回 `{ type: "end_activity", data: call.arguments }`
  - 其他非系统工具 → 返回 null
  - 导出 `function isSystemTool(name: string): boolean`
- **验收**：system tool 正确返回 effect，非 system tool 返回 null

### T2.11 创建 API 路由 — agent/start

- **文件**：`app/api/agent/start/route.ts`
- **依赖**：T2.2、T2.8、T2.9
- **做什么**：
  - POST handler
  - 解析 body 为 `AgentStartRequest`
  - 生成 sessionId（UUID）
  - 调用 `runAgentTurn()` 或 mock（根据 provider mode）
  - 将 AgentStreamEvent 序列编码为 SSE 流返回
  - 设置 headers：`Content-Type: text/event-stream`、`Cache-Control: no-cache`
  - 先 yield `session_start` 事件，再 yield tool_call 事件
- **验收**：`curl -N -X POST localhost:3000/api/agent/start -H "Content-Type: application/json" -d '{"profileId":"test"}'` 返回 SSE 流

### T2.12 创建 API 路由 — agent/turn

- **文件**：`app/api/agent/turn/route.ts`
- **依赖**：T2.2、T2.3、T2.4、T2.9
- **做什么**：
  - POST handler
  - 解析 body 为 `AgentTurnRequest`
  - 检查 `shouldUseFastPath()` → 是则走 `runFastPath()`，否则走 `runAgentTurn()`
  - 对 tool calls 执行 `enforceOrchestration()`
  - 对 tool calls 执行 `filterAIOutput()`
  - 编码为 SSE 流返回
  - `turn_end` 事件包含 `usedFastPath: boolean`
- **验收**：curl 发送 choice 输入 → 返回 SSE 流；发送 voice 输入 → 返回 SSE 流

---

## Step 3：最小前端渲染器

### T3.1 创建 Agent Store

- **文件**：`store/agent-store.ts`
- **依赖**：T1.1
- **做什么**：
  - Zustand store，persist 到 localStorage（key: "brainplay-agent-store"）
  - 状态：sessionId, conversation, activeToolCalls, pendingInputType, isStreaming, currentGoalFocus, error
  - Actions：
    - `startSession(profileId, goalFocus?)` — 调用 client 的 sendAgentStart，解析 SSE，更新状态
    - `sendTurn(input, inputType, inputMeta?)` — 调用 client 的 streamAgentTurn，解析 SSE，累积 toolCalls
    - `reset()` — 清空所有状态
  - `pendingInputType` 的计算逻辑：从 activeToolCalls 中找最后一个输入请求工具的类型
- **验收**：在 React 组件中调用 startSession()，状态正确更新

### T3.2 创建 Profile Store

- **文件**：`store/profile-store.ts`
- **依赖**：T1.2
- **做什么**：
  - Zustand store，persist 到 localStorage（key: "brainplay-profile-store"）
  - 状态：profiles: ChildProfile[], activeProfileId: string | null
  - Actions：
    - `createProfile(nickname, birthday)` — 生成 ID，添加到 profiles
    - `setActiveProfile(id)` — 切换当前孩子
    - `updateGoalPreferences(id, goals)` — 更新目标偏好
    - `getActiveProfile()` — 返回当前活跃的 profile
- **验收**：创建 profile，切换 profile，数据持久化到 localStorage

### T3.3 重写 AI Client

- **文件**：`lib/ai/client.ts`
- **依赖**：T1.1、T2.9
- **做什么**：
  - 保留现有函数（sendChat、sendTts 等，Step 7 才删）
  - 新增 `async function sendAgentStart(request: AgentStartRequest, onEvent: (event: AgentStreamEvent) => void): Promise<void>`
    - fetch `/api/agent/start`
    - 读取 SSE 流，逐事件调用 onEvent
  - 新增 `async function streamAgentTurn(request: AgentTurnRequest, onEvent: (event: AgentStreamEvent) => void, signal?: AbortSignal): Promise<void>`
    - fetch `/api/agent/turn`
    - 读取 SSE 流，逐事件调用 onEvent
    - 支持 AbortSignal 取消
- **验收**：前端调用 sendAgentStart，onEvent 被正确触发

### T3.4 创建 Universal Renderer

- **文件**：`components/agent/universal-renderer.tsx`
- **依赖**：T1.1、T3.7（agent-narrator）
- **做什么**：
  - Props：`{ toolCalls: ToolCallResult[], onUserInput: (input, type, meta?) => void }`
  - 内部维护 `TOOL_REGISTRY` 映射：工具名 → React 组件
  - 首发注册：narrate → AgentNarrator, show_choices → ChoiceGrid, show_text_input → TextInputSlot, show_image → ImageSlot, request_voice → VoiceInputSlot
  - 渲染逻辑：
    1. 先渲染所有 narrate（合并连续的）
    2. 再渲染展示型工具
    3. 最后渲染输入请求工具
  - 未知工具 → 渲染 FallbackSlot（"点击继续"按钮）
  - 每个组件通过 onUserInput 回调提交用户输入
- **验收**：传入 mock 的 toolCalls 数组，正确渲染对应组件

### T3.5 创建 Tool Slot 容器

- **文件**：`components/agent/tool-slot.tsx`
- **做什么**：
  - 通用容器组件，包裹每个工具渲染的组件
  - Props：`{ toolCall: ToolCallResult, children: ReactNode }`
  - 提供：淡入动画（Framer Motion）、错误边界（ErrorBoundary）
  - 如果子组件渲染出错 → 显示 FallbackSlot
- **验收**：包裹任意子组件，动画正常，错误时显示 fallback

### T3.6 创建 ChoiceGrid 组件

- **文件**：`components/agent/choice-grid.tsx`
- **依赖**：现有 `components/game/choice-card.tsx`
- **做什么**：
  - Props：`{ prompt: string, choices: {id, label, desc?, badge?}[], onSubmit: (input, type, meta) => void }`
  - 渲染 prompt 文本 + 一排 ChoiceCard
  - 点击某个 choice → 调用 `onSubmit(choice.label, "choice", { choiceId: choice.id })`
  - 点击后所有 choice 禁用（防重复点击）
- **验收**：显示 3 个选择卡片，点击一个后其他禁用，onSubmit 被正确调用

### T3.7 创建 Agent Narrator

- **文件**：`components/agent/agent-narrator.tsx`
- **依赖**：现有 `components/chat/dialogue-bubble.tsx`、`components/audio/narration-controls.tsx`
- **做什么**：
  - Props：`{ text: string, speakerName?: string, voiceRole?: string, autoSpeak?: boolean }`
  - 渲染：DialogueBubble（显示文本）+ 如果 autoSpeak 为 true，自动调用 TTS
  - 多个连续 AgentNarrator 的 TTS 应该排队播放而不是同时播放
  - 显示角色头像占位（后续替换为"脑脑"图片）
- **验收**：文本正确显示，autoSpeak 时 TTS 自动播放

### T3.8 创建 TextInputSlot

- **文件**：`components/game/text-input-slot.tsx`
- **做什么**：
  - Props：`{ prompt: string, placeholder?: string, submitLabel?: string, onSubmit: (input, type) => void }`
  - 渲染：prompt 文本 + 输入框 + 提交按钮
  - 提交后清空输入框，调用 `onSubmit(value, "text")`
  - 支持按 Enter 提交
- **验收**：输入文字，按 Enter 或点按钮，onSubmit 触发

### T3.9 创建 ImageSlot

- **文件**：`components/agent/image-slot.tsx`
- **做什么**：
  - Props：`{ alt: string, imageUrl?: string, generatePrompt?: string }`
  - 如果有 imageUrl → 直接显示 `<img>`
  - 如果有 generatePrompt 但没有 imageUrl → 显示占位符 + "图片生成中…"（后续接入 Gemini）
  - 图片加载失败 → 显示 alt 文本
- **验收**：传入 imageUrl 显示图片；无 url 显示占位符

### T3.10 创建 VoiceInputSlot

- **文件**：`components/agent/voice-input-slot.tsx`
- **依赖**：现有 `components/chat/voice-input-button.tsx` 的逻辑
- **做什么**：
  - Props：`{ prompt: string, language?: string, onSubmit: (input, type) => void }`
  - 渲染：prompt 文本 + 大的麦克风按钮
  - 按住录音 → 松开 → 调用 STT → 结果传入 `onSubmit(transcript, "voice")`
  - 录音中显示动画反馈
  - STT 失败 → 自动切换为文字输入模式
- **验收**：按住录音，松开后 STT 结果正确回调；STT 失败时显示文字输入

### T3.11 创建 Input Bar

- **文件**：`components/agent/input-bar.tsx`
- **依赖**：T3.1（pendingInputType）
- **做什么**：
  - Props：`{ pendingInputType: InputType | null, onSubmit: (input, type, meta?) => void }`
  - **情境化显示**（状态机驱动）：
    - `null`（默认）→ 显示文字输入框 + 语音按钮
    - `"choice"` → 隐藏（选择卡片自己处理输入）
    - `"text"` → 隐藏（TextInputSlot 自己处理）
    - `"voice"` → 隐藏（VoiceInputSlot 自己处理）
    - 只在没有专门输入工具时显示默认输入栏
  - 底部固定定位
- **验收**：pendingInputType 变化时，正确切换显示状态

### T3.12 创建 Session Page

- **文件**：`components/agent/session-page.tsx` + `app/session/page.tsx`
- **依赖**：T3.1、T3.4、T3.11
- **做什么**：
  - `app/session/page.tsx`：Next.js 页面，渲染 SessionPage 组件
  - `session-page.tsx`：
    - 读取 agent-store 和 profile-store
    - 如果没有 activeProfile → 显示简单的"创建档案"表单（昵称+生日）
    - 如果有 profile 但没有 session → 调用 `startSession()`
    - 有 session → 渲染 `<UniversalRenderer>` + `<InputBar>`
    - isStreaming 时显示加载状态
    - 错误时显示错误提示 + 重试按钮
- **验收**：浏览器打开 `/session`，创建档案后自动开始对话，能完成 3 轮互动

---

## Step 3.5：真实孩子内测

### T3.5.1 准备内测环境

- **做什么**（非编码任务）：
  - 确保 mock 模式可用（`AI_PROVIDER_MODE=mock`）
  - 准备 3 个测试场景：数学选择题、英语简单对话、自由聊天
  - 准备录屏工具
  - 找 1-2 个 6-8 岁孩子测试
- **产出**：内测问题列表

---

## Step 4：Prompt 调优 + 目标体系

### T4.1 创建目标树

- **文件**：`content/goals/goal-tree.ts`
- **依赖**：T1.2
- **做什么**：
  - 导出 `TRAINING_GOALS: TrainingGoal[]`
  - 6 个大目标，每个包含 3-5 个 SubGoal
  - 每个 SubGoal 包含：可观测行为（2-3 条）、难度分级（L1-L4 描述）、完成判据
  - 内容参考方案文档第六节
- **验收**：类型正确，内容覆盖 6 大目标

### T4.2 创建目标上下文构建器

- **文件**：`prompts/goal-context-builder.ts`
- **依赖**：T4.1、T1.2
- **做什么**：
  - 导出 `function buildGoalContext(goalFocus: string[], profile: ChildProfile): string`
  - 从 TRAINING_GOALS 中筛选 goalFocus 指定的目标
  - 根据孩子年龄选择对应难度级别的 SubGoal 描述
  - 拼装成 prompt 片段（< 300 tokens）
- **验收**：输入 ["math-thinking", "english"]，输出对应的 prompt 片段

### T4.3 扩展数据库 — observations 表

- **文件**：`lib/data/db.ts`
- **依赖**：无
- **做什么**：
  - 在数据库初始化中新增 `observations` 表
  - 字段：id, session_id, profile_id, goal_id, sub_goal_id, skill, observation, evidence, difficulty_level, confidence, hint_count, self_explained, created_at
  - 导出 `insertObservation(data)` 和 `getObservationsByProfile(profileId, limit?)` 函数
- **验收**：能插入和查询 observations

### T4.4 实现 log_observation 工具执行

- **文件**：更新 `lib/agent/tool-executor.ts`
- **依赖**：T2.10、T4.3
- **做什么**：
  - 在 executeSystemTool 中添加 `log_observation` 处理
  - 将 AI 提供的 skill、observation、evidence 等参数写入 observations 表
- **验收**：AI 调用 log_observation 后，数据库中能查到记录

### T4.5 Prompt 迭代调优

- **做什么**（半自动任务）：
  - 用 test-qwen-tools.mjs 脚本测试不同场景
  - 调整 prompt 模块内容直到满足：
    - 7 岁和 10 岁孩子内容难度明显不同
    - AI 能在不同能力域之间自然切换
    - AI 不会连续 3 轮用同一种工具
    - AI 在孩子说"我不会"时给提示而非答案
- **产出**：优化后的 prompt 模块文件

---

## Step 5：扩展工具 + 视觉素材

### T5.1 创建 NumberInputSlot

- **文件**：`components/game/number-input-slot.tsx`
- **做什么**：
  - Props：`{ prompt, min?, max?, step?, onSubmit }`
  - 渲染：prompt + 数字选择器（+/- 按钮或滑块）+ 确认按钮
- **验收**：能选择数字并提交

### T5.2 创建 PhotoCapture

- **文件**：`components/game/photo-capture.tsx`
- **做什么**：
  - Props：`{ prompt, hints?, onSubmit }`
  - 渲染：prompt + 拍照按钮 / 选择相册
  - 拍照后 base64 编码，调用 onSubmit
- **验收**：能拍照或选图并提交

### T5.3 创建 EmotionCheckin

- **文件**：`components/game/emotion-checkin.tsx`
- **做什么**：
  - Props：`{ onSubmit }`
  - 渲染 3 个表情按钮：😊开心 / 😕困惑 / 🔄想换个玩法
  - 点击后调用 onSubmit
- **验收**：点击表情，onSubmit 正确触发

### T5.4 适配 DragBoard 为工具渲染器

- **文件**：更新 `components/game/drag-board.tsx`
- **做什么**：
  - 添加 `onSubmit` prop，选择完成后回调
  - 确保 Props 兼容 show_drag_board 工具的参数格式
- **验收**：作为 universal-renderer 的工具渲染器正常工作

### T5.5 注册所有新工具到 Registry

- **文件**：更新 `components/agent/universal-renderer.tsx`
- **依赖**：T5.1-T5.4
- **做什么**：
  - 在 TOOL_REGISTRY 中注册：show_number_input、request_photo、show_emotion_checkin、show_drag_board
- **验收**：所有新工具在 session 中可渲染

### T5.6 生成视觉素材 — 角色"脑脑"

- **做什么**（使用 Gemini API）：
  - 生成小狐狸"脑脑"角色：5 个表情（开心、思考、惊讶、鼓励、调皮）
  - 512×512 PNG，透明背景，扁平卡通风格
  - 存入 `public/illustrations/character/`
- **产出**：5 张角色图片

### T5.7 生成视觉素材 — 场景背景

- **做什么**（使用 Gemini API）：
  - 5 张背景：数学/推理/创作/英语/通用
  - 1920×1080，柔和色调
  - 存入 `public/illustrations/backgrounds/`
- **产出**：5 张背景图片

### T5.8 生成视觉素材 — UI 图标

- **做什么**（使用 Gemini API）：
  - 12 个图标：6 能力域 + 3 交互 + 3 奖励
  - 128×128 PNG，透明背景
  - 存入 `public/illustrations/icons/`
- **产出**：12 张图标

### T5.9 集成素材到组件

- **依赖**：T5.6-T5.8
- **做什么**：
  - AgentNarrator 中加入"脑脑"头像
  - session-page 背景根据当前活动切换
  - 首页能力域选择卡片加图标
- **验收**：视觉效果完整

---

## Step 6：摄像头 + Vision + 画板（Beta）

### T6.1 创建 CameraView

- **文件**：`components/agent/camera-view.tsx`
- **做什么**：
  - Props：`{ prompt, hints?, duration?, onSubmit }`
  - 开启 MediaStream，显示实时画面
  - 每 3 秒截取一帧，base64 编码
  - 发送到 `/api/ai/vision` 获取描述
  - 描述通过 onSubmit 回传
  - 有"结束摄像头"按钮
  - 首次使用显示家长授权提示
- **验收**：摄像头画面显示，截帧发送后获得描述

### T6.2 升级 Vision API

- **文件**：`lib/ai/vision.ts` + `app/api/ai/vision/route.ts`
- **做什么**：
  - 将 stub 实现替换为真实的 Qwen VL API 调用
  - 接收 base64 图片，返回任务相关的描述（过滤环境细节）
  - 保留 mock fallback
- **验收**：发送积木照片，返回"画面中有 3 块红色积木和 2 块蓝色积木"

### T6.3 创建 DrawingCanvas

- **文件**：`components/game/drawing-canvas.tsx`
- **做什么**：
  - Props：`{ prompt, onSubmit }`
  - 简单画板（Canvas 2D），支持画线、选颜色、清除
  - "完成"按钮 → 将画布导出为 base64 → onSubmit
- **验收**：能画画并提交

### T6.4 注册 Beta 工具

- **文件**：更新 `universal-renderer.tsx` + `tool-definitions.ts`
- **做什么**：
  - 注册 request_camera → CameraView
  - 注册 show_drawing_canvas → DrawingCanvas
  - 在 tool-definitions 中添加这两个工具的 Schema
- **验收**：AI 调用 request_camera 时渲染摄像头组件

---

## Step 7：清理 + 家长端 + 打磨

### T7.1 删除旧代码

- **做什么**：
  - 删除：`content/scenes.ts`, `tasks.ts`, `story-episodes.ts`, `world.ts`
  - 删除：`components/prototypes/*`（5 个文件）
  - 删除：`app/play/*`（所有旧路由页面）
  - 删除：`lib/ai/chat.ts`, `lib/ai/chat-gateway-payload.ts`
  - 删除：`prompts/chat.ts`
  - 删除：`store/session-store.ts`, `store/playtest-log-store.ts`
  - 清理 `lib/ai/mock.ts` 中的旧函数
  - 移动 `content/math-progression.ts`, `math-story-kernels.ts` 到 `content/reference/`
- **验收**：`npm run build` 无报错，`npm run lint` 通过

### T7.2 重写首页

- **文件**：`app/page.tsx` + `components/home/home-page.tsx`
- **做什么**：
  - 如果没有 profile → 显示欢迎页 + 创建档案入口
  - 如果有 profile → 显示：
    - "脑脑"角色打招呼
    - 6 个能力域卡片（带图标）
    - 最近的活动记录
    - "开始玩"按钮 → 跳转 /session
  - 设置入口（切换档案、家长入口）
- **验收**：首页显示正确，跳转 /session 正常

### T7.3 适配家长端

- **文件**：更新 `app/parent/page.tsx` + `components/parent/*`
- **做什么**：
  - 从 observations 表读取数据
  - 展示：
    - 孩子最近练习的能力域 Top 3
    - 每个能力域的观察记录（带置信度）
    - 进步最明显的 SubGoal
    - 提示次数趋势
    - "有帮助吗？"反馈按钮
- **验收**：家长端能看到结构化的学习报告

### T7.4 视觉打磨

- **做什么**：
  - Framer Motion 动画：工具渲染淡入、选择卡片弹出、奖励 toast 飞入
  - 配色统一：主色调、圆角、阴影
  - 响应式布局：电脑宽屏（内容居中 max-width）+ iPad 竖屏适配
  - "脑脑"角色在对话中有微动画（呼吸、眨眼——CSS 动画即可）
- **验收**：视觉体验流畅一致

### T7.5 端到端测试

- **做什么**：
  - mock 模式：完整流程（创建档案→选目标→互动 5 轮→结束→家长查看报告）
  - 真实 Qwen API：同样流程，检查 tool call 稳定性
  - 电脑 Chrome + iPad Safari 兼容测试
  - 性能检查：首轮响应 < 3 秒，SSE 流无卡顿
- **验收**：所有流程跑通，无阻断性 bug

---

## 任务依赖图（简化）

```
T0.1 → T0.2
T1.1 → T1.3 → T1.4
T1.2
         ↘
T1.1 + T1.3 → T2.1 → T2.2
T1.1 → T2.3, T2.4, T2.6, T2.7, T2.8, T2.10
T1.1 + T1.2 → T2.5
T2.2 + T2.8 + T2.9 → T2.11, T2.12
T1.1 → T3.1 → T3.12
T1.2 → T3.2
T3.4 ← T3.6, T3.7, T3.8, T3.9, T3.10
T3.4 + T3.11 → T3.12
T4.1 → T4.2
T4.3 → T4.4
T5.1-T5.4 → T5.5
T5.6-T5.8 → T5.9
T6.1 + T6.2 + T6.3 → T6.4
T7.1 → T7.2 → T7.5
```

**可并行的任务组**：
- T1.1 和 T1.2 可并行
- T2.3、T2.4、T2.6、T2.7、T2.8 只依赖 T1.1，可并行
- T3.6、T3.7、T3.8、T3.9、T3.10 互相独立，可并行
- T5.1、T5.2、T5.3 互相独立，可并行
- T5.6、T5.7、T5.8（素材生成）互相独立，可并行
