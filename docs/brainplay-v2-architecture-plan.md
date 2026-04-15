# BrainPlay v2：AI Agent + Tools 全新架构方案（v2 修订版）

## Context

当前 BrainPlay 是"代码驱动游戏 + AI 填充文本"架构——三个硬编码模式（opponent/co-create/story）定义了所有游戏流程和 UI，AI 只在固定框架内生成对话。用户希望彻底转变为 **AI 驱动一切** 的架构：AI 是核心引擎，通过调用"工具"来决定展示什么、怎么互动，前端只是一个通用渲染器。这样 AI 可以实时根据孩子的反应自由创造和调整玩法，像一个真人陪伴。

**关键决策**：
- 目标用户：**年龄可配置**（5-12 岁），孩子档案中填写生日，AI 根据年龄自动调整内容难度和表达方式
- 交互方式：语音 + 文字 + 点击选择 + 拖拽 + 拍照 + 实时摄像头（延后）
- AI 模型：继续用 Qwen（成本低，已有集成，tool_use 基本够用）
- 改造策略：**全新重写**，不保留旧的三个模式
- 六大能力域：数学思维、逻辑推理、语言理解、创造力、沟通表达、英语启蒙（**全部首发**）
- 内容策略：**先以 AI 即兴生成为主**，仅定义能力方向和子目标引导；后续可逐步补充活动模板升级为混合模式
- 前端风格：**卡通插画风**。用 Google AI Studio（Gemini）生成角色形象、场景背景和 UI 图标作为首版素材；代码结构预留主题切换能力
- 目标设备：**电脑浏览器优先 + iPad 兼容**，响应式布局
- 核心原则：**模型负责创意，服务端负责秩序**

---

## 一、目标架构

```
孩子输入（语音/文字/选择/拍照/摄像头）
    │
    ▼
┌─────────────────────┐
│   Universal Session  │  ← 单一页面 /session
│   Page (前端渲染器)   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐     ┌──────────────────┐
│  POST /api/agent/   │────▶│  Orchestration   │ ← 服务端编排约束层（新增）
│  turn               │     │  Guardrail       │
└─────────────────────┘     └────────┬─────────┘
                                     │
                              ┌──────┴──────┐
                              │ 快速路径？   │
                              │ (简单选择)   │
                              └──────┬──────┘
                                ┌────┴────┐
                              是│         │否
                                ▼         ▼
                          轻量处理    ┌──────────┐
                          (省API)    │ Agent Loop│
                                    │(Qwen+tools)│
                                    └─────┬────┘
                                          │
                                  ┌───────┴───────┐
                                  │  Tool Calls[] │
                                  └───────┬───────┘
                                          │
                               ┌──────────┴──────────┐
                               │                     │
                         展示型工具              系统型工具
                         → SSE 流回前端          → 服务端执行
                         → 渲染为 UI 组件        (award_badge 等)
```

---

## 二、AI 工具定义

### 首发工具（8 个）

**展示型工具**：

| 工具名 | 参数 | 渲染组件 |
|--------|------|----------|
| `narrate` | `{ text, speakerName?, voiceRole?, autoSpeak? }` | 对话气泡 + TTS |
| `show_choices` | `{ prompt, choices: [{id, label, desc?, badge?}] }` | 选择卡片网格 |
| `show_text_input` | `{ prompt, placeholder?, submitLabel? }` | 文本输入框 |
| `show_image` | `{ alt, imageUrl?, generatePrompt? }` | 图片展示 / AI 生图 |

**输入请求工具**：

| 工具名 | 参数 | 行为 |
|--------|------|------|
| `request_voice` | `{ prompt, language?: "zh"\|"en" }` | 弹出录音按钮 |

**系统工具**：

| 工具名 | 参数 | 行为 |
|--------|------|------|
| `think` | `{ reasoning, nextToolSuggestion?: string[] }` | AI 内部推理（不展示），可提前暗示下一轮可能用的工具 |
| `award_badge` | `{ title, detail, type }` | 触发奖励 toast |
| `end_activity` | `{ summary, parentNote? }` | 结束活动，展示总结 |

### 延后工具（Step 5-6 再加）

| 工具名 | 阶段 | 说明 |
|--------|------|------|
| `show_drag_board` | Step 5 | 拖拽选择板 |
| `show_number_input` | Step 5 | 数字选择器 |
| `show_drawing_canvas` | Step 6 | 画板 |
| `request_photo` | Step 5 | 拍照/相册 |
| `request_camera` | Beta | 实时摄像头（首发不做，风险高） |
| `show_emotion_checkin` | Step 5 | 表情选择：开心/困惑/想换玩法，收集孩子情绪 |
| `update_world` | Step 5 | 更新世界状态 |
| `set_progress` | Step 5 | 更新进度条 |
| `log_observation` | Step 4 | 记录孩子表现（给家长看） |

---

## 三、三层降级策略（关键新增）

AI 输出是非确定性的，必须有多层防线，绝不能让孩子的屏幕卡死。

### 第 1 层：Schema 校验 + 自动修复（代码级）

在 `tool-validators.ts` 中：
- 所有 JSON Schema 标 `strict: true`，所有字段标 `required`
- AI 漏传参数 → 自动补默认值（如 `autoSpeak` 缺失 → 默认 `true`）
- 参数类型错误 → 尝试类型转换（如数字传成字符串）
- 完全无法修复 → 丢弃该 tool call，继续处理后续的

### 第 2 层：服务端防火墙（架构级）

在 `agent-loop.ts` 和 `universal-renderer` 之间：
- tool 名不在 `TOOL_REGISTRY` 中 → 静默忽略
- 连续 2 次无效 tool call → 自动接管，下发兜底工具：
  ```json
  [
    { "name": "narrate", "arguments": { "text": "哎呀，我的脑袋有点转不过来了，我们来做个简单的吧！", "autoSpeak": true }},
    { "name": "show_choices", "arguments": { "prompt": "你想...", "choices": [{"id":"a","label":"听个小故事"},{"id":"b","label":"玩个猜数字"}] }}
  ]
  ```

### 第 3 层：链路级降级（每条通道）

| 链路 | 失败场景 | 降级方案 |
|------|----------|----------|
| Qwen API | 超时/报错 | fallback 到 mock agent |
| tool_call JSON | 格式破损 | 降级为 narrate + show_choices |
| STT | 语音识别失败 | 自动切换文字输入 |
| TTS | 语音合成失败 | 显示文字 + 浏览器 SpeechSynthesis |
| Vision | 图片识别失败 | 提示"我看不太清，你能描述一下吗？" |
| 模型 2 轮未推进目标 | AI 兜圈子 | 强制调用 end_activity 并总结 |

---

## 四、服务端编排约束层（关键新增）

不把行为控制完全交给模型。在 `agent-loop.ts` 输出后、返回前端前，加一层编排检查：

### 硬性规则

1. **每轮最多**：2 个展示型工具 + 1 个输入请求工具
2. **互斥**：上一轮已请求输入（request_voice 等）且未收到孩子回复 → 本轮禁止再请求新输入
3. **不重复**：同一输入模态不超过连续 2 次（不能连续 3 轮都 request_voice）
4. **活动结构**：每个活动至少有"开始 → 互动 → 收尾"3 段，AI 不能跳过开场直接出题
5. **渲染顺序**：`narrate` 永远先渲染，多个连续 `narrate` 合并成一段语音
6. **输入唯一**：同一时刻屏幕上只显示 1 个输入请求工具

### 违规处理

- 超出数量限制 → 截断多余的 tool calls
- 违反互斥 → 移除冲突的 tool call
- 缺少 narrate（AI 没说话直接出题）→ 自动补一个简短的过渡语

---

## 五、快速路径（省成本，关键新增）

不是每次交互都需要调完整的 Qwen Agent。

| 孩子的输入 | 处理方式 | 原因 |
|------------|----------|------|
| 点击 choice（选择题） | **快速路径**：轻量 prompt（只含上一轮 context + 选择结果），不加载完整 system prompt | 选择题结果是确定的，不需要完整推理 |
| 简单回复（"好的"、"嗯"、"继续"） | **快速路径**：触发下一个预设节点或简短 prompt | 无需唤醒满血 Agent |
| 语音输入（开放式） | **完整 Agent Loop** | 需要理解+推理 |
| 文字输入（开放式） | **完整 Agent Loop** | 需要理解+推理 |
| 拍照/摄像头 | **完整 Agent Loop** | 需要视觉理解 |

快速路径可以省 50%+ 的 API 调用，对成本控制极为重要。

---

## 六、训练目标体系

```
TrainingGoal（大目标）
  └── SubGoal（子目标）
       ├── 可观测行为（怎么判断孩子掌握了）
       ├── 难度分级（L1→L4）
       ├── 完成判据（量化指标）
       └── ActivityTemplate（活动模板）— 可选，AI 可即兴
```

### 六大训练目标（全部首发）

1. **推理能力** `reasoning` — 模式识别、因果推断、排除法、多步推理
2. **数学思维** `math-thinking` — 数量比较、分配、估算、空间推理
3. **理解能力** `comprehension` — 故事理解、指令跟随、信息提取
4. **创作能力** `creativity` — 规则发明、故事创作、开放问题
5. **沟通合作** `communication` — 解释推理过程、协作、论证
6. **英语口语** `english` — 情境词汇、简单对话、发音

### 评估体系（关键新增）

每个 SubGoal 必须定义：

**1. 可观测行为**（AI 观察什么）
- 例："能用自己的话解释为什么这样选"
- 例："能完成两步指令"
- 例："能用英语说出 3 个日常物品名称"

**2. 难度分级**
- L1 识别：能认出/指出（如"哪个更多？"）
- L2 比较：能比较两个选项（如"这两个方案哪个更好？为什么？"）
- L3 解释：能说出理由（如"你为什么选这个？"）
- L4 迁移：能把学到的方法用到新场景（如"如果换一种情况呢？"）

**3. 完成判据**（量化指标）
- 正确率
- 提示次数（AI 给了几次 hint）
- 回答时长
- 是否主动表达理由（未被问就自己解释）

### ActivityTemplate 结构

```typescript
interface ActivityTemplate {
  id: string;
  label: string;
  goalId: string;
  subGoalId: string;
  description: string;
  suggestedTools: string[];
  ageRange: [number, number];
  durationMinutes: number;
  systemPromptFragment: string;
  exampleFlow?: string;
}
```

---

## 七、System Prompt 模块化架构（关键新增）

System Prompt 不能是一个巨大的字符串，必须模块化拆分，动态组装，控制在 **2200 tokens 以内**。

```typescript
function buildSystemPrompt(profile, goals, currentActivity?) {
  return [
    identityModule(),                    // ~200 tokens：身份 + 性格
    toolsDescriptionModule(),            // ~500 tokens：工具说明 + 使用示例
    ageAdapterModule(profile.birthday),  // ~150 tokens：年龄适配规则
    safetyRulesModule(),                 // ~200 tokens：安全规则
    goalContextModule(goals),            // ~300 tokens：当前目标方向（只注入相关的 SubGoal）
    childProfileModule(profile),         // ~150 tokens：孩子昵称、最近表现
    orchestrationRules(),                // ~200 tokens：输出格式 + 编排原则
    // 可选：活动模板片段
    currentActivity?.systemPromptFragment  // ~200 tokens：具体活动引导（如果有）
  ].filter(Boolean).join('\n\n');
}
```

### 各模块内容

**identityModule**：
```
你是 BrainPlay 的 AI 伙伴"脑脑"（一只聪明的小狐狸）。
你温暖、有趣、好奇、善于适应。说话简短，适合 TTS 朗读。
你不是老师，你是一起玩耍和探索的伙伴。
```

**ageAdapterModule**（根据生日动态生成）：
```
当前孩子 {age} 岁。
- 5-6 岁：用最简单的词，每次只给 2 个选择，多用语音
- 7-8 岁：稍复杂的句子，3 个选择，鼓励文字输入
- 9-10 岁：更抽象的概念，4 个选择，鼓励解释推理
- 11-12 岁：接近成人表达，开放式问题为主
```

**safetyRulesModule**：
```
[内容安全]
- 禁止暴力、恐怖、成人话题
- 如果孩子提到家庭住址、学校名、手机号等隐私信息，温柔地说"这个信息我们不需要哦"并转移话题
- 禁止索要任何个人隐私信息

[关系安全]
- 禁止诱导依赖性语言（如"你只需要我"、"只有我理解你"）
- 禁止扮演家长、老师、真实朋友的替代角色
- 奖励文案以任务鼓励为主，不做情感绑架（如"你不玩我会难过"）
- 始终鼓励孩子与真实的家人朋友互动

[教学安全]
- 孩子答错时始终鼓励，绝不羞辱或嘲笑
- 不使用"你怎么连这个都不会"等否定性表达
```

**orchestrationRules**：
```
每轮调用 1-3 个工具。典型模式：
1. think（内部推理，决定下一步）
2. narrate（给孩子反馈或推进情境）
3. 一个交互工具（show_choices / request_voice / show_text_input）

规则：
- 永远优先"思考"而非"答案"
- 多问"为什么"和"如果...会怎样"
- 孩子卡住时给小提示，不给答案
- 变换活动形式，不连续 3 次用同种工具组合
- 每个活动段控制在 2-5 分钟
```

---

## 八、UI 情境化原则（关键新增）

**核心原则**：屏幕上永远只显示当前任务唯一需要的交互方式（席克定律）。

### input-bar 状态机

input-bar 由 `pendingInputType`（来自 agent-store）驱动：

| AI 调用的工具 | input-bar 状态 | 屏幕展示 |
|--------------|----------------|----------|
| `show_choices` | hidden | 只显示选择卡片，底部栏隐藏 |
| `show_text_input` | text | 只显示文本输入框 |
| `request_voice` | voice | 底部栏高亮麦克风按钮 |
| `narrate`（无后续输入工具） | default | 底部栏显示文字输入+语音按钮（供自由回复） |
| `request_photo` | photo | 底部栏切换为拍照模式 |

### 渲染分组规则

- `narrate` 永远第一个渲染
- 多个连续 `narrate` 合并成一段（合并语音播放）
- 展示型工具按顺序叠放（stack）
- 输入请求工具同一时刻只显示 1 个

---

## 九、儿童安全执行层（关键新增）

不只是 prompt 里写原则，还需要代码级执行。

### 内容层（服务端过滤）

- 敏感词过滤：AI 输出经过关键词扫描再返回前端
- 隐私信息检测：孩子输入中的电话号码、地址等自动模糊化，不传入 AI 上下文
- 禁止 AI 在 narrate 中提到真实人名（除了孩子自己的昵称）

### 视觉层

- `request_camera` 触发前必须有家长首次授权说明
- 图片仅临时分析，不存储、不上传第三方
- 视觉 API 返回只保留"任务相关描述"，过滤环境细节（房间布局、人脸等）

### 关系层（写进 System Prompt + 服务端检测）

- 禁止诱导依赖（"你只需要我"）
- 禁止扮演替代角色（"我是你的老师/妈妈"）
- 奖励以任务鼓励为主（"这道题你想得很深入！"而不是"我好喜欢你"）
- 每个 session 有时间上限提醒（30 分钟建议休息）

---

## 十、产品 KPI（关键新增）

### 体验指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 首轮响应时间 | < 3 秒 | 从点击开始到 AI 第一句话出现 |
| 每轮平均等待时间 | < 2 秒 | SSE 流式渲染后的体感时间 |
| 会话平均时长 | 5-15 分钟 | 太短说明没吸引力，太长可能是 AI 兜圈子 |
| 中途退出率 | < 30% | 孩子未完成活动就离开 |
| 单活动完成率 | > 70% | end_activity 被正常触发 |

### 教育指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 每次活动平均提示次数 | 1-3 次 | 0 次可能太简单，>5 次可能太难 |
| 孩子主动表达占比 | > 40% | 不是只点选择题 |
| 重复答题纠正成功率 | > 60% | 给了提示后孩子能改正 |
| 家长端"有帮助"反馈率 | > 50% | 家长认为报告有价值 |

### 系统指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 工具调用成功率 | > 95% | Schema 校验通过 |
| tool 参数校验失败率 | < 5% | 需要自动修复的比例 |
| fallback 触发率 | < 3% | 降级到 mock 或兜底工具 |
| 快速路径命中率 | 40-60% | 简单交互不走完整 Agent |

---

## 十一、新的文件结构

```
math-ai-kid/
  app/
    layout.tsx                          # 保留
    page.tsx                            # 重写：AI 驱动的首页
    session/
      page.tsx                          # 新：唯一的会话页面
    parent/
      page.tsx                          # 保留（适配新数据源）
    api/
      agent/
        start/route.ts                  # 新：开始会话
        turn/route.ts                   # 新：发送输入，返回工具调用（SSE）
      ai/
        tts/route.ts                    # 保留
        tts/realtime/route.ts           # 保留
        stt/route.ts                    # 保留
        vision/route.ts                 # 保留（升级为真实实现）

  lib/
    agent/
      agent-loop.ts                     # 新：核心 Agent 循环
      orchestration-guard.ts            # 新：服务端编排约束层
      fast-path.ts                      # 新：快速路径（简单选择不走完整 Agent）
      tool-definitions.ts               # 新：工具 JSON Schema（strict + required）
      tool-executor.ts                  # 新：系统工具服务端执行
      tool-validators.ts               # 新：工具参数校验 + 自动修复
      fallback.ts                       # 新：兜底工具生成器
      stream-parser.ts                  # 新：SSE 流解析
      content-filter.ts                 # 新：内容安全过滤（敏感词、隐私信息）
    ai/
      qwen-chat.ts                      # 重写：tools 参数 + streaming + tool_call 解析
      provider.ts                       # 保留
      gateway.ts                        # 保留
      tts.ts                            # 保留
      qwen-tts-realtime.ts             # 保留
      stt.ts                            # 保留
      vision.ts                         # 升级：接入真实视觉 API
      mock.ts                           # 重写：mock agent 响应
      client.ts                         # 重写：sendAgentStart(), streamAgentTurn()
      tts-cache.ts                      # 保留
      aliyun-nls-tts.ts               # 保留
      validators.ts                     # 扩展
    data/
      db.ts                             # 扩展：observations 表
      session-log.ts                    # 保留

  components/
    agent/
      universal-renderer.tsx            # 新：工具→组件映射渲染器（含分组逻辑）
      tool-slot.tsx                     # 新：单个工具渲染容器
      session-page.tsx                  # 新：会话页面主组件
      agent-narrator.tsx                # 新：narrate 渲染（气泡+TTS+多段合并）
      input-bar.tsx                     # 新：底部输入栏（状态机驱动，情境化显示）
      camera-view.tsx                   # 延后：实时摄像头
    game/
      choice-card.tsx                   # 保留
      drag-board.tsx                    # 保留（延后注册）
      outcome-card.tsx                  # 保留
      text-input-slot.tsx              # 新
      number-input-slot.tsx            # 延后
      drawing-canvas.tsx               # 延后
      photo-capture.tsx                # 延后
      emotion-checkin.tsx              # 延后：表情选择
    chat/
      dialogue-bubble.tsx              # 保留
    audio/
      narration-controls.tsx           # 保留
    layout/
      app-shell.tsx                    # 保留
    reward/
      reward-toast.tsx                 # 保留
      identity-badge.tsx               # 保留
    parent/
      ...                              # 保留，适配新数据

  store/
    agent-store.ts                     # 新：会话状态、对话历史、活跃工具调用、pendingInputType
    profile-store.ts                   # 新：孩子档案、目标偏好、历史
    reward-store.ts                    # 保留
    world-store.ts                     # 保留
    ui-store.ts                        # 保留
    parent-store.ts                    # 保留

  content/
    goals/
      goal-tree.ts                     # 新：目标层级 + 可观测行为 + 难度分级 + 完成判据
      goal-templates.ts                # 新：活动模板（初始可为空）
    reference/
      math-progression.ts             # 保留作参考
      math-story-kernels.ts           # 保留作参考

  prompts/
    modules/
      identity.ts                      # 新：身份模块（~200 tokens）
      tools-description.ts             # 新：工具说明模块（~500 tokens）
      age-adapter.ts                   # 新：年龄适配模块（~150 tokens）
      safety-rules.ts                  # 新：安全规则模块（~200 tokens）
      goal-context.ts                  # 新：目标上下文模块（~300 tokens）
      child-profile.ts                # 新：孩子信息模块（~150 tokens）
      orchestration-rules.ts           # 新：编排规则模块（~200 tokens）
    agent-system-prompt.ts             # 新：模块组装器（buildSystemPrompt）
    goal-context-builder.ts            # 新：根据活动动态注入

  types/
    index.ts                           # 重写
    agent.ts                           # 新：ToolCall, AgentTurn, ConversationMessage
    goals.ts                           # 新：Goal, SubGoal, ActivityTemplate

  scripts/
    test-qwen-tools.mjs               # 新：CLI 脚本，验证 Qwen tool_use 稳定性
```

**删除**（不再需要）：
- `content/scenes.ts`, `content/tasks.ts`, `content/story-episodes.ts`, `content/world.ts`
- `components/prototypes/*`（全部 5 个文件）
- `app/play/*`（旧路由）
- `lib/ai/chat.ts`, `lib/ai/chat-gateway-payload.ts`
- `prompts/chat.ts`
- `store/session-store.ts`, `store/playtest-log-store.ts`

---

## 十二、API 协议

### POST /api/agent/start

开始新会话。AI 打招呼，推荐活动。

**请求**：`{ profileId: string, goalFocus?: string[] }`

**响应**（SSE 流）：
```
event: session_start
data: {"sessionId": "..."}

event: tool_call
data: {"id": "tc_1", "name": "narrate", "arguments": {...}}

event: tool_call
data: {"id": "tc_2", "name": "show_choices", "arguments": {...}}

event: system_effect
data: {"type": "award_badge", "data": {...}}

event: turn_end
data: {"turnIndex": 0, "usedFastPath": false}
```

### POST /api/agent/turn

发送孩子输入，获取下一轮 AI 响应。

**请求**：
```typescript
{
  sessionId: string;
  input: string;
  inputType: "choice" | "text" | "voice" | "drag" | "photo" | "camera" | "number" | "drawing" | "emotion";
  inputMeta?: {
    choiceId?: string;
    fragments?: string[];
    photoBase64?: string;
    numberValue?: number;
    emotionId?: string;
  };
}
```

**响应**：同上 SSE 流格式。`turn_end` 中包含 `usedFastPath: boolean` 标识是否走了快速路径。

---

## 十三、数据库扩展

### observations 表

```sql
CREATE TABLE observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  sub_goal_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  observation TEXT NOT NULL,
  evidence TEXT,
  difficulty_level TEXT,        -- L1/L2/L3/L4
  confidence INTEGER,           -- 0-100, AI 对自己判断的置信度
  hint_count INTEGER DEFAULT 0, -- 此活动中给了几次提示
  self_explained BOOLEAN,       -- 孩子是否主动解释了理由
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 十四、分阶段实施

开发顺序：**验证 AI → 协议 → 后端 → 前端 → Prompt → 孩子内测 → 扩展 → 打磨**

### Step 0：Qwen tool_use 可行性验证（最优先）

**目标**：确认 Qwen 的 tool_use 能力能支撑 Agent 架构，不写任何正式代码。

1. 写一个 CLI 脚本 `scripts/test-qwen-tools.mjs`
2. 把 System Prompt 草稿 + 8 个工具的 Schema 发给 Qwen
3. 在终端模拟孩子输入（"我想玩数学游戏"、"选 A"、"为什么是 3？"等）
4. 观察 Qwen 返回的 tool_calls 是否：格式正确、工具选择合理、参数完整、多轮对话稳定
5. 记录问题：哪些场景 AI 选错工具？参数格式漂移？多工具组合是否稳定？
6. 如果 Qwen 不稳定 → 调整 Schema 设计 / 简化工具 / 考虑换模型

**验证标准**：10 轮连续对话中，tool_call 格式正确率 > 90%，工具选择合理率 > 80%。

### Step 1：定义协议（类型 + 工具定义）

1. 创建 `types/agent.ts`
2. 创建 `types/goals.ts`
3. 创建 `lib/agent/tool-definitions.ts`（strict + required）
4. 创建 `lib/agent/tool-validators.ts`（含自动修复逻辑）

**验证**：`npx tsc --noEmit` 通过。

### Step 2：Agent 后端（核心引擎）

1. 重写 `lib/ai/qwen-chat.ts` — `streamQwenWithTools()`
2. 创建 `lib/agent/agent-loop.ts`
3. 创建 `lib/agent/orchestration-guard.ts`（编排约束层）
4. 创建 `lib/agent/fast-path.ts`（快速路径）
5. 创建 `lib/agent/fallback.ts`（兜底工具生成器）
6. 创建 `lib/agent/tool-executor.ts`
7. 创建 `lib/agent/stream-parser.ts`
8. 创建 `lib/agent/content-filter.ts`（内容安全过滤）
9. 重写 `lib/ai/mock.ts`
10. 创建 `prompts/modules/*`（7 个模块）+ `prompts/agent-system-prompt.ts`
11. 创建 `app/api/agent/start/route.ts` + `turn/route.ts`

**验证**：curl 调用 `/api/agent/start` 返回 SSE tool calls 流；连续 5 轮对话 tool call 格式正确。

### Step 3：最小前端渲染器

1. 创建 `store/agent-store.ts`（含 pendingInputType）
2. 创建 `store/profile-store.ts`
3. 重写 `lib/ai/client.ts`
4. 创建 `components/agent/universal-renderer.tsx`（含分组逻辑）
5. 创建 `components/agent/tool-slot.tsx`
6. 创建 `components/agent/agent-narrator.tsx`（多段合并+TTS）
7. 创建 `components/agent/input-bar.tsx`（状态机驱动，情境化）
8. 创建 `components/agent/session-page.tsx`
9. 创建 `app/session/page.tsx`
10. 注册 5 个首发展示/输入工具的渲染组件

**验证**：浏览器打开 `/session`，完成"AI 打招呼→选择→互动 3 轮→结束"。

### Step 3.5：真实孩子内测（关键新增）

**目标**：用 mock 模式 + 真实 6-8 岁孩子测试 3 次。

1. 每次录屏 + 家长在旁观察反馈
2. 观察：选择卡片文字是否太多？语音识别体验如何？AI 回复是否太长？节奏是否合适？
3. 收集问题列表，调整 prompt 和 UI

### Step 4：Prompt 调优 + 目标体系 + 评估

1. 创建 `content/goals/goal-tree.ts`（6 大目标 + 子目标 + 可观测行为 + 难度分级 + 完成判据）
2. 创建 `content/goals/goal-templates.ts`
3. 创建 `prompts/goal-context-builder.ts`
4. 完善所有 prompt 模块
5. 扩展 `lib/data/db.ts` — observations 表
6. 实现 `log_observation` 工具
7. 反复测试：不同年龄 × 不同目标，调优 prompt

**验证**：7 岁孩子和 10 岁孩子体验到明显不同的内容难度。

### Step 5：扩展工具 + 视觉素材

1. 新增组件：`text-input-slot.tsx`、`number-input-slot.tsx`、`photo-capture.tsx`、`emotion-checkin.tsx`
2. 适配 `drag-board.tsx`
3. 注册所有新工具
4. **用 Google AI Studio（Gemini）生成视觉素材**：
   - AI 伙伴"脑脑"（小狐狸）：5 个表情变体，512×512 PNG 透明背景
   - 4-5 个场景背景：1920×1080
   - 10-15 个 UI 图标：128×128 PNG 透明背景
   - 对话气泡头像
   - 在 `.env.local` 配置 `GOOGLE_AI_STUDIO_API_KEY`
   - 素材存入 `public/illustrations/`
5. 集成素材到组件

**验证**：所有工具可用，界面有卡通视觉效果。

### Step 6：摄像头 + Vision + 画板（Beta）

1. `components/agent/camera-view.tsx`
2. 升级 `lib/ai/vision.ts`
3. `components/game/drawing-canvas.tsx`
4. `request_camera` 端到端流程
5. 全模态测试

**验证**：摄像头对着实物，AI 识别并互动。

### Step 7：清理 + 家长端 + 打磨

1. 删除旧代码（prototypes、play/*、旧 chat 等）
2. 重写首页
3. 家长端适配（每周 AI 陪伴报告：top3 能力域、最大进步、温馨小故事）
4. 视觉打磨（Framer Motion 动画、配色统一、响应式）
5. 端到端测试
6. 电脑 + iPad 兼容测试

---

## 十五、保留复用清单

| 文件 | 处理 |
|------|------|
| `lib/ai/qwen-tts-realtime.ts` | 保留 |
| `lib/ai/tts.ts`, `tts-cache.ts`, `aliyun-nls-tts.ts` | 保留 |
| `lib/ai/stt.ts` | 保留 |
| `lib/ai/gateway.ts`, `provider.ts` | 保留 |
| `lib/data/db.ts`, `session-log.ts` | 保留（扩展） |
| `store/reward-store.ts`, `world-store.ts`, `ui-store.ts`, `parent-store.ts` | 保留 |
| `components/game/choice-card.tsx`, `drag-board.tsx`, `outcome-card.tsx` | 保留 |
| `components/chat/dialogue-bubble.tsx` | 保留 |
| `components/audio/narration-controls.tsx` | 保留 |
| `components/layout/*`, `components/reward/*` | 保留 |
| `app/api/ai/tts/*`, `stt/*`, `vision/*` | 保留 |
| `content/math-progression.ts`, `math-story-kernels.ts` | 移入 `content/reference/` |

---

## 十六、风险与应对

| 风险 | 严重度 | 应对 |
|------|--------|------|
| Qwen tool_use 不稳定 | ★★★★ | Step 0 先验证；Schema strict 模式；三层降级；备选考虑 Claude API |
| System Prompt 过长 | ★★★ | 模块化拆分，控制 2200 tokens；只注入当前 SubGoal |
| 对话历史无限增长 | ★★★ | 滑动窗口（保留最近 10 轮）+ 摘要压缩 |
| API 成本 | ★★★ | 快速路径省 50%+ 调用；动态上下文裁剪 |
| 儿童安全 | ★★★ | 三层安全（内容+视觉+关系）+ 服务端过滤 |
| 摄像头隐私/兼容性 | ★★★ | 降为 Beta；首发用 request_photo；家长授权 |
| 视觉素材风格不统一 | ★★ | 固定 Gemini 种子+风格描述；统一角色"脑脑" |
| AI 兜圈子不推进 | ★★ | 编排约束：2 轮未推进 → 强制 end_activity |
