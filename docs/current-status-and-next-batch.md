# 当前状态与下一批 Todo

## 用途

这份文档用来解决一个实际问题：

> 当前项目已经改了很多，但如果不把“已经做到哪、还差哪、下一批该做什么”写清楚，后续就容易一边做一边散。

这份文档按 3 层来整理：

1. 当前已经完成的部分
2. 当前还没闭环的部分
3. 下一批最值得做的 todo

## 一句话状态

当前项目已经从“多入口原型 + 训练面板”收束成：

- 一个以 `/session` 为核心的孩子互动主入口
- 一个以 `MLIF` 为方法论的 daily chat 系统
- 一个有家长简报、有思路提示、有软收尾的陪聊式产品雏形

但它还没有完全闭环成：

- 跨会话自动升级的主题成长系统
- 稳定持久的“变化痕迹”系统
- 完整去掉旧双栈历史包袱的最终形态

## 已完成

### 1. 方法论层

已完成：

- `MLIF` 正式文档
  - `docs/micro-leap-inquiry-framework.md`
- `MLIF` 项目内执行清单
  - `docs/mlif-implementation-checklist.md`
- `MLIF` 已接入运行时 prompt
  - `prompts/agent-system-prompt.ts`
  - `lib/daily/select-daily-question.ts`

当前效果：

- AI 被明确约束成启思同伴，而不是题库或老师
- 系统里已经明确禁止题库腔、讲课腔、工作纸感

### 2. 产品入口与孩子端体验

已完成：

- 首页收口为单入口产品
  - `components/home/home-page.tsx`
- `/session` 入口支持 `theme / question`
  - `app/session/page.tsx`
- 会话顶部、预览卡、结束弹层都已去题库化
  - `components/agent/session-page.tsx`

当前效果：

- 首页更像“去找脑脑聊 5 分钟”
- 会话更像一段小聊天，不像答题流程

### 3. Daily 系统

已完成：

- 5 个孩子端主题
  - 数学思维
  - 观察规律
  - 为什么与解释
  - 公平与选择
  - 假设与预测
- daily 种子库
  - `content/daily/daily-question-bank.ts`
- 主题策略
  - `content/daily/theme-playbooks.ts`
- child signal
  - `lib/daily/child-signal.ts`
- 孩子语言镜像
  - `lib/daily/child-language.ts`
- 两条思路 choices
  - `lib/daily/choice-scaffold.ts`
- Brainy 人格指南
  - `content/daily/brainy-voice-guide.ts`
  - `lib/daily/brainy-voice.ts`
- 通用主题自适应
  - `lib/daily/theme-adaptation.ts`

当前效果：

- daily 已不是固定题库执行
- 已变成“主题 playbook + 场景种子 + child signal + 动态追问动作”
- local fallback 也遵守同一套逻辑

### 4. 家长端

已完成：

- 家长页改成“今日简报优先”
  - `app/parent/page.tsx`
- `/api/parent/report` 新增 `dailyBrief`
  - `app/api/parent/report/route.ts`
- session log 支持 `profileId`
  - `lib/data/session-log.ts`

当前效果：

- 家长首屏能直接看到：
  - 今天聊了什么
  - 她是怎么想的
  - 明天怎么接着问

### 5. 收尾与奖励

已完成：

- session 结束弹层改成柔和收尾
  - `components/agent/session-page.tsx`
- 奖励页改成“今天留下的小变化”
  - `app/rewards/page.tsx`
- 持久化奖励摘要与时间线
  - `lib/data/session-log.ts`
  - `app/api/rewards/summary/route.ts`
- 连续徽章 / 世界变化 / 轻量成长地图
  - `lib/data/session-log.ts`
  - `components/reward/progress-map.tsx`
  - `components/reward/identity-badge.tsx`

当前效果：

- 不再像任务结算
- 更像“今天聊完后留下了一点东西”
- 最近几天的变化已经能跨天保留
- 奖励页已经能看到连续天数、世界变化和轻量成长地图

### 6. 基础验证

已完成：

- `npm run lint`
- `npm run build`
- `npm run smoke`

这些链路已经多次通过。

## 当前还没闭环

### 1. 旧链路仍然存在

现状：

- 新主链路已经是 `/api/agent/*`
- 但旧 `/api/ai/*`、旧历史文档和部分旧结构还在

这不影响当前原型继续推进，但长期会增加维护成本。

### 2. Daily 场景虽然增厚，但仍有继续打磨空间

现状：

- 30 条种子已经从“问题列表”变成“有画面的场景种子”

但仍可继续增强：

- 更强的脑脑人格连续性
- 更稳定的情绪节奏
- 更明显的“昨天和今天连起来”的关系感

## 下一批最值得做的 Todo

### A. 用 MLIF checklist 做一次偏差审查

目标：

- 把当前项目中仍残留的题库感、讲课感、系统味找出来

建议 Todo：

1. 逐项按 `docs/mlif-implementation-checklist.md` 审核
2. 列出偏差点
3. 生成针对性的修正批次

优先级：中高

### B. 清理旧双栈包袱

目标：

- 降低维护成本，让新主链路更清爽

建议 Todo：

1. 梳理旧 `/api/ai/*` 的保留范围
2. 标记真正废弃的旧模块
3. 清理无关文档和历史残留结构

优先级：中

## 当前最推荐的下一步

如果只做一件事，我建议优先做：

> 用 MLIF checklist 做一次偏差审查

因为现在方法论、成长分层、自适应、家长解释、奖励痕迹都已经有了，下一步最值钱的是系统性找出还残留的“题库感 / 讲课感 / 结算感 / 系统味”。

## 备注

后续每开一批新 todo，都建议先把它补进这份文档，再进入实现。这样可以避免“中途切题”和“做了一半就散掉”。
