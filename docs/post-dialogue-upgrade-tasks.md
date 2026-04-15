# 对话升级后下一阶段任务计划 — 闭合 MVP 验证环

> 前置：`dialogue-upgrade-task-breakdown.md`（打字机 + 气泡 + 聚焦）完成后执行本计划。
> 目标：让产品达到可内部验证（Playtest）的状态，闭合 Stage 1 MVP Gate。

---

## 当前项目状态摘要

**已完成（80%+）**：类型系统、12 个 API 路由、Agent 循环、Qwen 流式集成、8 个工具定义与验证、编排约束、内容过滤、3 层降级、SSE 解析、36 个前端组件、6 个 Zustand Store、TTS 完整管线

**关键缺口**：
1. 孩子年龄→难度适配未接入（birthday 采集了但没用）
2. 多轮对话未做实际压力测试（10+ 轮可能退化）
3. 活动内容库薄（模板有但 prompt 变体少）
4. 脑脑表情未联动对话内容（mood 系统有但不触发）
5. 家长报告数据流为空壳
6. 零次实际 Playtest

---

## 任务拆分

### Task A1：年龄→难度适配接入

**优先级**：P0（产品定位是给7岁孩子，难度不对等于无效）
**对应里程碑**：Milestone C — TC.2

**目标**：根据孩子生日计算年龄，动态调整 system prompt 中的难度参数和内容风格。

**涉及文件**：
- `prompts/modules/age-adapter.ts` — 已有 `calcAge()` 函数，需扩展为完整的年龄适配模块
- `prompts/agent-system-prompt.ts` — 注入年龄适配信息
- `prompts/goal-context-builder.ts` — 根据年龄调整目标上下文
- `lib/agent/agent-loop.ts` — 确保 profile.birthday 传递到 prompt builder

**实现要点**：
1. `calcAge(birthday)` 计算精确年龄（年+月）
2. 定义 3 个年龄段的适配策略：
   - 5-6 岁：简单数字（1-10）、大量图片、短句、更多鼓励
   - 6-7 岁：基础运算、故事引导、适中挑战
   - 7-8 岁：进阶思维题、推理链、适当抽象
3. 在 system prompt 中注入：`你正在和一个 {age}岁{months}个月的孩子对话。难度等级：{level}。请...`
4. 在 goal-context-builder 中根据年龄过滤/排序推荐的子目标

**验收标准**：
- 设置 birthday 为 2019-07-01 → system prompt 包含 "6岁8个月"（当前日期 2026-03-28）
- 设置 birthday 为 2021-01-01 → system prompt 难度明显降低
- AI 实际输出的数学题难度随年龄变化
- `npx tsc --noEmit` 通过

---

### Task A2：多轮对话稳定性加固

**优先级**：P0
**对应里程碑**：Milestone B — TB.1

**目标**：确保 10+ 轮对话不退化，context window 合理管理。

**涉及文件**：
- `lib/agent/agent-loop.ts` — sliding window 逻辑
- `lib/agent/agent-loop.ts` — `toQwenMessages()` 转换
- `scripts/test-qwen-stability.mjs` — 已有，需执行并根据结果调整

**实现要点**：

1. **执行稳定性测试**：运行 `node scripts/test-qwen-stability.mjs`，记录：
   - 每轮响应时间
   - tool_calls 成功率
   - 是否降级到 mock
   - context 消息数量变化

2. **sliding window 优化**：
   - 当前限制 10 轮（20 条消息），检查是否足够
   - 确保 window 裁剪不会丢失关键上下文（如活动开始信息）
   - 考虑保留首轮 system+assistant 消息（活动开场白）即使 window 滑动

3. **token 计数日志**（TC.1）：
   - 在 agent-loop 中添加粗略 token 估算（中文约 2 char/token）
   - 日志输出：`[agent-loop] estimated tokens: {n}, messages: {m}`
   - 当接近模型 context 上限时预警

4. **对话质量防退化**：
   - 检测 AI 是否开始重复自己（连续两轮 narrate 内容相似度 > 80%）
   - 如果检测到重复，在下一轮 system prompt 中注入提示："请切换话题或尝试新的互动方式"

**验收标准**：
- 10 轮对话测试无 400 错误
- 响应时间稳定（不随轮数线性增长）
- 日志输出 token 计数
- 无 mock 降级（纯 Qwen 完成）

---

### Task A3：活动内容库扩充

**优先级**：P1
**对应里程碑**：Milestone C

**目标**：为每个训练目标提供至少 3 个活动变体，AI 有足够素材生成有趣内容。

**涉及文件**：
- `content/activities/activity-templates.ts` — 扩充模板
- `content/goals/goal-tree.ts` + `goal-tree-part1.ts` — 检查子目标覆盖
- `prompts/modules/` — 可能需要新增活动特定的 prompt 模块

**实现要点**：

1. 盘点当前活动模板数量和覆盖的目标
2. 为 6 个训练目标各补充至少 3 个活动：
   - **数学思维**：数字拆分游戏、买东西找钱、魔法数字谜题
   - **逻辑推理**：谁是凶手推理、规律发现、逻辑迷宫
   - **创意思维**：造句接龙、物品新用途、故事续写
   - **语言思维**：反义词对对碰、绕口令、看图说话
   - **策略思维**：取石子博弈（Nim）、井字棋分析、策略卡牌
   - **观察归纳**：找不同、规律数列、分类游戏
3. 每个活动模板包含：
   - `systemPromptFragment`：给 AI 的活动指令（200-400 字）
   - `ageRange`：适用年龄范围
   - `estimatedMinutes`：预估时长
   - `toolHints`：推荐使用的工具组合

**验收标准**：
- 每个目标至少 3 个活动模板
- `selectActivity()` 能根据 goalFocus 返回不同活动
- system prompt 包含活动指令
- `npx tsc --noEmit` 通过

---

### Task A4：脑脑表情联动对话

**优先级**：P1
**对应里程碑**：Milestone E — TE.2/TE.3

**目标**：脑脑的表情根据对话内容实时变化，增强互动感。

**涉及文件**：
- `components/agent/use-robot-mood.ts` — mood hook，需接入实际数据
- `components/agent/robot-character.tsx` — 已有 mood→表情映射
- `store/agent-store.ts` — 需要暴露当前对话状态给 mood hook
- `types/agent.ts` 或 `types/index.ts` — RobotMood 类型

**实现要点**：

1. **mood 触发规则**：
   - `happy`：AI 发出鼓励/表扬（narrate 文本包含 "棒"、"厉害"、"对了" 等）
   - `thinking`：AI 正在处理（isStreaming = true）
   - `surprised`：孩子给出意外答案（可选，较复杂）
   - `speaking`：TTS 正在播放
   - `idle`：等待输入

2. **在 `use-robot-mood.ts` 中**：
   - 监听 `isStreaming`、`activeToolCalls`、TTS 状态
   - 从最新 narrate 的文本中分析情感关键词
   - 输出 `{ mood, isSpeaking }`

3. **表情切换动画**：`robot-character.tsx` 已有 AnimatePresence mood 切换，确保 transition 流畅

**验收标准**：
- AI 回复时脑脑变为 thinking 表情
- TTS 播放时脑脑变为 speaking 表情
- 鼓励性内容时脑脑变为 happy 表情
- 表情切换有平滑过渡

---

### Task A5：家长报告数据流

**优先级**：P2
**对应里程碑**：不在原计划中，但 Stage 1 Gate 需要

**目标**：家长能看到孩子本次学习了什么、表现如何。

**涉及文件**：
- `app/api/parent/report/route.ts` — 报告 API
- `lib/agent/agent-loop.ts` — 收集 `log_observation` 工具的输出
- `store/parent-store.ts` — 家长端状态
- `app/parent/page.tsx` — 家长看板页面
- `app/api/progress/log/route.ts` — 进度记录

**实现要点**：

1. **在 agent-loop 中收集观察**：
   - 当 AI 调用 `log_observation` 工具时，将内容写入数据库
   - 字段：`sessionId`, `profileId`, `timestamp`, `category`, `content`, `confidence`

2. **Session 结束时生成摘要**：
   - 当 AI 调用 `end_activity` 时，收集本次所有 observations
   - 调用 Qwen（非流式）生成一段家长可读的摘要
   - 存入数据库

3. **家长报告 API**：
   - 查询指定 profileId 的最近 N 次 session 摘要
   - 返回结构化数据

4. **家长看板 UI**：
   - 显示最近 5 次学习记录
   - 每条包含：日期、活动类型、AI 观察摘要、用时

**验收标准**：
- 完成一次完整 session 后，`/parent` 页面能显示学习记录
- 记录包含有意义的观察内容（不是空的）
- `npx tsc --noEmit` 通过

---

### Task A6：Playtest 准备 + 执行

**优先级**：P0（Stage 1 Gate 关键）
**对应里程碑**：Milestone D

**目标**：完成至少 1 次内部 Playtest，记录数据。

**涉及文件**：
- `docs/playtest-checklist.md` — 已有检查清单
- `docs/stage1-closeout-and-mvp-gate.md` — Gate 标准

**实现要点**（非代码任务）：

1. 确保以上 Task A1-A4 完成
2. 部署到可访问环境（localhost 或 Vercel preview）
3. 按 playtest-checklist.md 执行：
   - 受试者：目标用户（2019年7月出生的孩子）
   - 观察项：注意力持续时间、互动频率、情绪反应、主动提问次数
   - 记录：录屏 + 观察笔记
4. 分析结果，补充 Stage 1 Gate 文档

**验收标准**：
- 至少 1 份完整的 Playtest 记录
- 包含 5 分钟连续使用数据
- 识别出至少 3 个需改进的点

---

## 执行顺序

```
优先级排序：

第一批（并行，各 1-2 天）：
├── Task A1：年龄→难度适配（P0，直接影响内容质量）
├── Task A2：多轮对话稳定性（P0，基础保障）
└── Task A3：活动内容库扩充（P1，可同时进行）

第二批（并行，各 1-2 天）：
├── Task A4：脑脑表情联动（P1，体验提升）
└── Task A5：家长报告数据（P2，MVP Gate 需要但优先级低）

第三批（依赖第一、二批完成）：
└── Task A6：Playtest（P0，最终验证）
```

**预估总工时**：2-3 周（含 Playtest 执行时间）

---

## 全局验收 — Stage 1 MVP Gate 检查

引用自 `stage1-closeout-and-mvp-gate.md`：

- [ ] **原型环**：AI agent 能完成完整的一次活动循环（开场→互动→总结→结束）
- [ ] **体验环**：孩子能持续 5 分钟以上的有效互动
- [ ] **内容环**：至少覆盖 2 个训练目标，每个目标 2+ 活动
- [ ] **记录环**：家长能看到学习摘要
- [ ] 年龄适配生效（7 岁内容 vs 5 岁内容有明显差异）
- [ ] 多轮对话稳定（10 轮无退化）
- [ ] 脑脑表情随对话变化
- [ ] 至少 1 份 Playtest 记录
