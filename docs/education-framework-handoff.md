# BrainPlay 教育框架与主要功能交接说明

这份文档用于交接当前项目的教育设计、AI 对话逻辑、家长端进度呈现和主要代码入口。当前项目不是单纯的“儿童聊天机器人”，而是一个围绕儿童思维成长路径组织的 AI 陪聊系统。

## 1. 产品定位

BrainPlay 的核心目标是：每天用 5 分钟左右的低压力对话，陪孩子在生活化场景里练习思考，而不是刷题、讲课或做标准测评。

当前系统强调三件事：

1. 让孩子愿意开口，说出自己的第一反应。
2. 让 AI 像玩伴一样接住孩子的话，再轻轻往前推半步。
3. 让家长看到这不是随机聊天，而是有路径、有证据、有下一步安排的成长系统。

## 2. 当前教育框架总览

项目目前按 5 个儿童主题组织，每个主题对应一个思维项目：

| 前台主题 | 内部能力方向 | 对应能力 |
| --- | --- | --- |
| 数学 | 数学思维 | 数量关系、空间关系、策略比较、规则表达 |
| 规律 | 观察归纳 | 系统观察、归纳、规则检验、迁移 |
| 为什么 | 语言解释 | 原因猜想、证据支持、解释修正、行动建议 |
| 公平 | 规则与社会推理 | 规则意识、视角转换、权衡、负责任选择 |
| 如果 | 假设与预测 | 假设进入、后果预测、系统变化、创造性改进 |

这 5 个项目统一使用 4 层成长路径：

1. L1 观察进入：先看见、说出来、愿意进入场景。
2. L2 理由比较：不只给答案，开始说为什么、比较两种办法。
3. L3 迁移调整：条件变化后，能调整规则、解释或策略。
4. L4 总结创造：能把想法总结成规则、办法、解释或新方案。

核心配置文件：

- `content/daily/thinking-growth-paths.ts`

这里定义了每个项目的：

- `scientificBasis`：面向家长展示的简短科学依据
- `levels`：4 层成长路径
- `evidenceExamples`：每层需要观察的儿童表现
- `nextStep`：下一次系统应该怎么安排
- `goalId / subGoalIds`：和内部训练目标的映射

## 3. 当前采用的教育依据

家长端展示的是简短中文说明，不直接堆长引用。当前框架主要借鉴这些方向：

- Common Core 数学实践：理解问题、构造理由、寻找结构、发现重复推理。
- 新加坡小学数学框架：问题解决为中心，连接概念、技能、过程与元认知。
- Project Zero 可视化思维：先看见，再解释，再提出疑问。
- NGSS 科学实践：提出问题、构建解释、用证据比较观点。
- CASEL 社会情绪学习：社会觉察、关系技能、负责任决策。
- OECD Learning Compass / PISA 创造性思维：预想、行动、反思，生成并改进想法。

需要注意：这些依据目前用于“产品框架设计”和“家长解释”，还没有做严格的学术测评验证。

## 4. AI 陪聊方法：MLIF 微跃迁启思

当前 prompt 中使用 MLIF 作为对话原则：

- 先接住：先回应孩子刚才说了什么。
- 先具体：所有问题都落到具体小场景，避免空泛提问。
- 只推半步：一次只追一个小问题，不连续抛多层。
- 问题先于答案：不要急着讲知识点或给标准答案。
- 支架要轻：孩子卡住时给具体选项，不直接替孩子想完。
- 收尾要迁移：适当总结孩子的想法，再轻轻换条件。

主要代码入口：

- `lib/daily/select-daily-question.ts`
- `lib/daily/dynamic-conversation.ts`
- `content/daily/theme-playbooks.ts`
- `content/daily/brainy-voice-guide.ts`

每个主题都有独立 playbook，包含：

- 常用生活场景
- 对话锚点
- 教练动作
- 鼓励语气
- 避免事项

当前教练动作包括：

- `open_question`：具体开场
- `clarify_reasoning`：追问理由
- `compare_options`：比较两个办法
- `push_half_step`：只加一个条件
- `scaffold_with_choices`：卡住时给选项
- `gentle_rehook`：跑题后温和拉回
- `wrap_up`：短总结收尾

## 5. 两套活动模式

### 5.1 Daily Theme Playbook

这是孩子端当前最主要的体验：进入某个主题后，系统选择一个合适的小问题，或在没有固定题时动态生成新对话。

适合：

- 数学、规律、为什么、公平、如果这些主题化陪聊
- 图片生成
- 选择卡片
- 语音/文字回答
- 轻量成长记录

关键文件：

- `content/daily/daily-question-bank.ts`
- `lib/daily/theme-adaptation.ts`
- `lib/daily/math-adaptation.ts`
- `lib/daily/select-daily-question.ts`
- `lib/daily/dynamic-conversation.ts`

### 5.2 Formal Scored Training

这是更结构化的训练与评价系统，目前主要围绕数学思维里的子目标展开，尤其是规律识别、数量比较、策略规划。

它包含：

- activity session
- observation summary
- evidence slot
- mastery profile
- thin evidence repair
- formal evaluator

适合后续发展成更严肃的测评闭环。

关键文件：

- `content/goals/subgoal-playbooks.ts`
- `content/activities/activity-templates.ts`
- `lib/training/mastery-engine.ts`
- `lib/training/training-intent.ts`
- `lib/training/evaluator-agent.ts`
- `lib/training/parent-report.ts`

## 6. 成长路径与选题逻辑

孩子端和家长端现在共用同一份成长路径配置，避免“家长端显示一套，孩子端执行另一套”。

当前逻辑：

1. 从 `session_logs.math_evidence_json`、observations、activity sessions 中读取最近表现。
2. 判断当前主题的目标层级。
3. 根据 `too_easy / fit / too_hard` 调整下一步。
4. 避免重复最近已经做过的题。
5. 如果固定题库没有对应层级，例如部分主题进入 L4，就走动态生成，而不是退回低层重复题。

关键文件：

- `lib/daily/thinking-growth-progress.ts`
- `lib/daily/theme-adaptation.ts`
- `lib/daily/math-adaptation.ts`
- `lib/data/session-log.ts`

核心信号：

- `difficultySignal`: `too_easy | fit | too_hard`
- `supportLevel`: `light | medium | heavy`
- `reasoningShown`: 是否说出理由
- `transferAttempted`: 是否尝试迁移或继续想
- `nextSuggestedLevel`: 下一次建议层级

## 7. 家长端框架

家长端现在的定位是“科学路径 + 当前进度”的入口，而不是单纯聊天记录。

`/api/parent/report` 返回：

- `projectPlans`：5 个项目的科学路径与当前进度
- `dailyBrief`：最近一次互动摘要
- `skills`：最近观察到的能力方向
- `recent`：观察记录
- `report`：结构化训练报告
- `activitySessions`：正式评分片段
- `experimentalActivitySessions`：探索式陪聊片段

家长页首屏展示：

- 5 个项目卡片
- 当前层级
- 进度条
- 最近证据
- 下一次系统为什么这样安排
- 展开后看到 4 层完整路径和科学依据

关键文件：

- `app/api/parent/report/route.ts`
- `app/parent/page.tsx`
- `lib/daily/thinking-growth-progress.ts`
- `lib/training/parent-report.ts`

无记录时仍会展示完整 5 项路径，状态为“准备开始”，避免家长看到空页面。

## 8. 孩子端主要功能

孩子端当前支持：

- 首页选择主题
- 每日推荐主题
- 会话页 AI 陪聊
- 林老师动画形象
- 语音优先输入
- 文字输入作为二级入口
- 录音实时识别字幕
- AI 图片生成
- 选项卡图片生成
- 选择卡片
- 历史回看
- 自动记录 session log
- 结束后写入成长证据

关键文件：

- `components/home/home-page.tsx`
- `components/agent/session-page.tsx`
- `components/agent/universal-renderer.tsx`
- `components/agent/choice-grid.tsx`
- `components/agent/image-slot.tsx`
- `components/agent/input-bar.tsx`
- `components/game/text-input-slot.tsx`
- `components/agent/teacher-character.tsx`
- `components/agent/lottie-character.tsx`
- `hooks/use-voice-recorder.ts`
- `store/agent-store.ts`

## 9. AI 工具与渲染

AI 不是直接返回整段 UI，而是通过 tool calls 驱动前端渲染。

常见工具：

- `narrate`：林老师说话气泡
- `show_image`：展示或生成图片
- `show_choices`：展示选择卡片
- `show_text_input`：文字/语音输入
- `request_voice`：语音回答
- `award_badge`：奖励信号
- `end_activity`：结束本轮
- `log_observation`：记录观察

前端 `UniversalRenderer` 会按工具类型渲染：

- display tools：旁白、图片
- interactive tools：选择、文字、语音、拍照、画图等

当前做了一个重要兜底：如果 AI 给出空泛 prompt，比如“你现在想说什么”，前端会根据上一张图片自动替换成具体问题，例如分水果图会改成“你觉得第一步怎么分才公平”。

## 10. 数据记录与证据来源

当前没有为科学路径新增复杂数据库表，而是从已有数据推导。

主要来源：

- `session_logs`
  - `math_evidence_json`
  - `task_id`
  - `highlights_json`
  - `reward_signals_json`
- observations
  - goal / subGoal
  - confidence
  - evidence
  - difficultyLevel
- activity sessions
  - completedEvidenceSlots
  - missingEvidenceSlots
  - status
  - scoringMode

重要提醒：之前已修复 `listRecentSessionLogs(profileId)` 的行为，现在传入 profileId 时只返回这个孩子自己的记录，不再用全局历史兜底。

## 11. 当前主要优势

1. 已经有“主题-能力-路径-证据-下一步”的完整骨架。
2. 家长端和孩子端已经开始共用同一份成长路径配置。
3. AI 对话不是纯聊天，有 playbook、教练动作和难度信号。
4. 已经支持图片、选项卡、语音优先输入，体验更接近儿童互动产品。
5. 已经有 formal scored training 的雏形，后续可以扩展成更科学的测评闭环。

## 12. 当前明显短板

1. 科学依据目前是产品化引用，还没有做严格的文献级标注和验证。
2. 5 个项目的 L4 固定题库不完整，部分依赖动态生成。
3. 非数学主题的证据评价还偏粗，需要更明确的 rubric。
4. AI 仍可能生成不够自然或不够聚焦的话，虽然前端已有部分兜底。
5. 家长端进度是推导式进度，不是正式量表分数，不能过度解释为能力测评。
6. Formal scored training 与 daily theme playbook 还没有完全统一。

## 13. 建议下一阶段优化方向

### 13.1 教育框架升级

为每个主题补一份更严谨的 rubric：

- L1-L4 的具体行为指标
- 每层需要几条证据才算稳定
- 哪些表现表示可以升半步
- 哪些表现表示需要降难度
- 哪些表现只是“开口了”，不能算能力证据

### 13.2 题库与动态生成统一

当前固定题库与动态生成并存。建议后续把题库升级为“场景模板 + 变量 + 目标证据”的形式。

例如公平主题可以拆成：

- 分东西
- 排队
- 轮流
- 规则冲突
- 新人加入

每个场景模板都绑定：

- 目标层级
- 目标证据
- 推荐图片 prompt
- 推荐选项 scaffold
- 收尾总结模板

### 13.3 对话质量控制

需要更强的输出审查：

- 是否每轮只有一个问题
- 是否引用了孩子原话
- 是否和当前图片一致
- 是否避免空泛陪聊
- 是否完成了总结
- 是否正确进入下一层或同层变式

可以在 `runAgentTurn` 后增加 validator / repair pass。

### 13.4 家长端解释能力

家长页现在能展示路径和进度，但还可以升级：

- 本周每个项目走了哪些层
- 哪些证据真实出现过
- 哪些只是系统正在观察
- 下次为什么不升难度
- 家长在家可以怎么接一句

### 13.5 测评边界

建议明确产品语言：

- 对家长说“现在大概在”“最近看见了”“下一步会这样接”
- 避免说“孩子已经达到某能力水平”
- 避免把推导进度包装成正式测评分数

这点非常重要，能降低教育产品的误导风险。

## 14. 关键文件地图

教育路径：

- `content/daily/thinking-growth-paths.ts`
- `content/daily/theme-definitions.ts`
- `content/daily/theme-playbooks.ts`
- `content/daily/daily-question-bank.ts`

选题与适配：

- `lib/daily/thinking-growth-progress.ts`
- `lib/daily/theme-adaptation.ts`
- `lib/daily/math-adaptation.ts`
- `lib/daily/select-daily-question.ts`
- `lib/daily/dynamic-conversation.ts`

AI 会话：

- `app/api/agent/start/route.ts`
- `app/api/agent/turn/route.ts`
- `lib/agent/agent-loop.ts`
- `lib/agent/tool-definitions.ts`
- `store/agent-store.ts`

家长端：

- `app/api/parent/report/route.ts`
- `app/parent/page.tsx`
- `lib/training/parent-report.ts`
- `lib/training/mastery-engine.ts`

孩子端 UI：

- `components/home/home-page.tsx`
- `components/agent/session-page.tsx`
- `components/agent/universal-renderer.tsx`
- `components/agent/choice-grid.tsx`
- `components/agent/image-slot.tsx`
- `components/agent/input-bar.tsx`
- `components/game/text-input-slot.tsx`

语音与图片：

- `hooks/use-voice-recorder.ts`
- `app/api/ai/stt/route.ts`
- `app/api/ai/generate-image/route.ts`
- `components/agent/generated-image-client.ts`

结构化训练：

- `content/goals/subgoal-playbooks.ts`
- `content/activities/activity-templates.ts`
- `lib/training/evaluator-agent.ts`
- `lib/training/training-intent.ts`
- `lib/training/activity-session-manager.ts`

## 15. 一句话交接总结

当前 BrainPlay 已经形成了一个“儿童主题陪聊 + 思维成长路径 + AI 半步追问 + 家长端证据解释”的产品骨架。下一位接手的人最值得继续优化的，不是单点 UI，而是把 5 个主题的 rubric、题库模板、动态生成质量控制和证据评价统一起来，让系统从“好玩的 AI 陪聊”进一步变成“可信、可持续、可解释的思维成长产品”。
