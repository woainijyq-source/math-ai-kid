# 数学思维 Progression 路线图

## 这份文档解决什么问题

当前项目已经有：

- `math-thinking` 目标树
- `mastery-engine` 掌握度判断
- `daily theme playbook`
- 一批数学思维场景种子

但如果只问“孩子已经达到了吗？能不能进下一个？”

还需要一份更清楚的路线图，把下面 4 件事写死：

1. 一开始从哪里起步
2. 每一阶段的明确目标是什么
3. 达标的判断逻辑是什么
4. 达标后进入下一个什么阶段

这份文档就是 `math-ai-kid` 当前版本的数学思维 progression 说明。

## 总体结构

当前数学思维按 4 个阶段理解：

1. 观察与比较
2. 规律与下一步
3. 策略与选择
4. 规则与迁移

这 4 个阶段和项目里已有内容的关系：

- `content/math-progression.ts` 提供阶段名称与总体叙事
- `content/goals/goal-tree-part1.ts` 提供 `math-thinking` 的核心子目标
- `lib/training/mastery-engine.ts` 提供最近证据的判断逻辑
- `content/daily/daily-question-bank.ts` 提供前台可聊的生活化场景种子

## 谁来主导

### 1. 你来主导

你主导：

- 数学思维总体方向
- 阶段顺序
- 达标门槛
- 什么时候可以进入下一个阶段

也就是说：

> 你决定“数学思维怎么长”。

### 2. 系统来主导

系统主导：

- 当前属于哪个 `goalId / subGoalId`
- 最近证据是不是足够稳定
- 是该继续、补证据、降一级，还是往前走

当前主要由这些模块实现：

- `lib/daily/theme-goal-mapping.ts`
- `app/api/agent/start/route.ts`
- `lib/training/mastery-engine.ts`

也就是说：

> 系统决定“现在更适合练什么”。

### 3. AI 来主导

AI 主导：

- 这一轮怎么开口
- 怎么接住孩子的话
- 怎么追问
- 怎么给两个思路方向

也就是说：

> AI 决定“这一轮怎么聊”。

### 4. 孩子来主导

孩子主导：

- 她先看到什么
- 她先想到什么
- 她愿意说多少
- 她对哪个方向更敏感

也就是说：

> 孩子决定“这一步往哪边长”。

## 起步点

### 当前默认起步

当前项目里，孩子从前台点进 `数学思维` 时，默认映射到：

- `goalId = math-thinking`
- 但 `subGoalId` 不再永远固定为同一个

当前逻辑改成：

- 如果没有最近数学表现记录
  - 默认视为 `foundation-observe`
  - 优先映射到 `quantity-comparison`
- 如果最近已经表现得很轻松
  - 先推断当前数学阶段
  - 再按阶段映射更合适的 `subGoalId`

见：

- `lib/daily/theme-goal-mapping.ts`
- `lib/daily/math-adaptation.ts`

所以现在的默认起步规则是：

> 先按最近几次数学表现推断阶段，再用阶段映射决定当前更适合的数学子目标；如果还没有历史，就从数量关系类的小场景起步。

这符合 MLIF：

- 先具体
- 先从能看见、能比较、能分一分的场景开始

### 当前适合作为起步的 daily 场景

优先起步场景：

- `math-fruit-share-1`：8 块水果怎么分
- `math-shop-change-1`：买两样东西要带多少钱
- `math-many-ways-1`：7 可以拆成几种
- `math-seat-rows-1`：12 个座位怎么排

这些都属于：

- 数量
- 分配
- 比较
- 轻空间排布

### 当前阶段映射

当前 `math` 主题的后台映射建议是：

- `foundation-observe` -> `quantity-comparison`
- `strategy-pattern` -> `pattern-recognition`
- `rules-expression` -> `strategy-planning`（优先）
- `story-reasoning` -> `strategy-planning / spatial-reasoning`（优先）

其中：

- 阶段决定“现在更适合练哪一类数学思维”
- 具体 question seed 再从这一阶段下的场景池里选
- 当前 `app/api/agent/start/route.ts` 已经开始按最近数学阶段读取这份映射，而不是永远用同一个默认 `subGoalId`

## 阶段 1：观察与比较

### 阶段目标

孩子能：

- 看见“多/少/一样多”
- 用自己的方式分一分、比一比
- 愿意说出“为什么我这样分/这样比”

### 当前对应子目标

- `quantity-comparison`
- `spatial-reasoning`（轻量）

### 典型场景

- 分水果
- 买东西
- 拆数字
- 摆椅子

### 这一阶段 AI 的主动作

- `open_question`
- `clarify_reasoning`
- `scaffold_with_choices`

### 达标判断

达到下面 4 条中的 3 条，视为本阶段达标：

1. 最近 4-6 次数学思维互动中，至少有 3 次在 `quantity-comparison / spatial-reasoning` 上留下清楚证据。
2. 至少有 2 次不是只给答案，而是留下了简短理由。
3. `avgHintCount <= 1`。
4. 没有连续 2 次进入明显 fallback 状态。

### 当前可对齐的系统信号

参考当前 `mastery-engine`：

- `recentCorrectStreak`
- `avgHintCount`
- `selfExplainRate`
- `nextAction`

### 达标后进入

进入：**阶段 2：规律与下一步**

## 阶段 2：规律与下一步

### 阶段目标

孩子能：

- 看出重复或变化
- 预测“下一步”
- 开始说出“它是怎么变的”

### 当前对应子目标

- `pattern-recognition`

### 典型场景

- 围巾花纹
- 脚印顺序
- 积木塔变化
- 拍手节奏
- 亮灯顺序
- 箭头转向

### 这一阶段 AI 的主动作

- `open_question`
- `compare_options`
- `clarify_reasoning`
- `push_half_step`

### 达标判断

达到下面 4 条中的 3 条，视为本阶段达标：

1. 最近 4-6 次相关互动中，至少 2 次能正确预测下一步。
2. 至少 2 次能说出“重复/变化/轮流/每次怎么变”的一种表达。
3. 至少 1 次能说明另一个答案为什么不像。
4. `selfExplainRate >= 0.45`，并且没有明显 evidence thin 残留。

### 当前可对齐的系统信号

`mastery-engine` 里最接近的条件是：

- `recentCorrectStreak >= 2`
- `selfExplainRate >= 0.45`
- `avgHintCount <= 1`

### 达标后进入

进入：**阶段 3：策略与选择**

## 阶段 3：策略与选择

### 阶段目标

孩子能：

- 说出哪种办法更省劲或更稳
- 预想下一步会怎样
- 不是只说“我选这个”，而是能补一句理由

### 当前对应子目标

- `strategy-planning`
- 部分 `quantity-comparison` 的变式策略题

### 典型场景

- 哪种数法更省劲
- 上台阶怎么走
- 先分还是先算
- 简单 take-away / 预测下一步
- 把排法说成一句规则
- 摆椅子先定什么规则
- 上楼梯怎么说成办法

### 这一阶段 AI 的主动作

- `compare_options`
- `push_half_step`
- `clarify_reasoning`

### 达标判断

达到下面 4 条中的 3 条，视为本阶段达标：

1. 最近 4-6 次相关互动里，至少 2 次能说出“我选这个，因为……”。
2. 至少 2 次能比较两个办法里哪个更快、更稳、更公平或更省劲。
3. `avgHintCount <= 1`。
4. 在 changed-condition 问题里，没有一换条件就完全失去方向。

### 当前可对齐的系统信号

当前 `strategy-planning` 在 `goal-tree-part1.ts` 中的完成判据本身就要求：

- `correctnessRate`
- `selfExplained`

`mastery-engine` 中可参考：

- `recentCorrectStreak >= 2`
- `selfExplainRate >= 0.45`
- `nextAction = advance / transfer`

### 达标后进入

进入：**阶段 4：规则与迁移**

## 阶段 4：规则与迁移

### 阶段目标

孩子能：

- 把自己的模糊想法说成简单规则
- 换一个条件后还能调整原来的想法
- 把同一个结构迁移到新表面故事里

### 当前对应子目标

- `pattern-recognition` 高阶
- `strategy-planning` 高阶
- `spatial-reasoning` 高阶
- 后续可扩到 `number-composition / equation-thinking`

### 典型场景

- 同一种规则换个表面故事
- 多一个人 / 少一个条件 / 换一种摆法
- “原来这样想，现在要不要改”
- 过小桥先让谁走
- 换成大小不同的点心还怎么分
- 送书路线要不要改

### 这一阶段 AI 的主动作

- `push_half_step`
- `compare_options`
- `wrap_up`

### 达标判断

达到下面 4 条中的 3 条，视为当前数学思维主线达到可迁移状态：

1. 最近至少 3 次完整互动都能留下清楚的理由证据。
2. 至少 2 个数学子目标进入 `stable` 或更高。
3. 至少 1 次在换条件、换场景后，孩子还能保持原来的思路结构。
4. `selfExplainRate >= 0.65`，且 `avgHintCount <= 1`。

### 当前可对齐的系统信号

`mastery-engine` 中最接近的是：

- `recentCorrectStreak >= 3`
- `selfExplainRate >= 0.65`
- `avgHintCount <= 1`
- `nextAction = transfer`

这就是当前系统里“可以进入迁移”的最清晰机器信号。

## 什么时候进入下一个

### 当前建议规则

按阶段推进时，不建议“做对一次就升”。

建议采用：

- **至少 2-3 次稳定表现**
- **理由证据不是薄的**
- **提示依赖不高**

如果满足：

- 结果稳定
- 理由能说出来
- 提示不多

就进入下一个。

如果只是：

- 答对了
- 但说不清为什么

那就**不升阶段，只补证据**。

这一点和当前 `mastery-engine` 的 `repair_evidence` 设计一致。

## 当前项目里的现实状态

### 已经具备的部分

- 有数学思维目标树
- 有掌握度判断逻辑
- 有 daily 场景种子
- 有部分明确门槛

### 还没有完全自动化的部分

当前系统**还没有把这份 progression 作为唯一强制路径写死到 runtime**。

也就是说：

- 文档上的 progression 已经清楚
- 系统判断信号已经部分具备
- 但“达标后自动切到下一阶段”还不是完全显式的 runtime 状态机

## 推荐的执行原则

如果你现在要按这条路线实际推进产品，建议这样理解：

1. 新孩子默认从“观察与比较”开始
2. 达到稳定后进入“规律与下一步”
3. 再进入“策略与选择”
4. 最后进入“规则与迁移”

并且始终坚持：

- 先看最近 4-6 次证据
- 不看单次发挥
- 不看单次答对
- 必须看理由
- 必须看提示依赖

## 对应到当前文件

- 阶段名：`content/math-progression.ts`
- 数学目标树：`content/goals/goal-tree-part1.ts`
- 场景种子：`content/daily/daily-question-bank.ts`
- 默认起点映射：`lib/daily/theme-goal-mapping.ts`
- 启动当前会话：`app/api/agent/start/route.ts`
- 掌握度判断：`lib/training/mastery-engine.ts`

## 一句话总结

当前项目里的数学思维主线可以这样理解：

> 从“看见和比较”起步，经过“找规律”和“想下一步”，再进入“比较办法”和“规则迁移”；是否进入下一阶段，不看一次答对，而看最近几次是否稳定、是否能说理由、是否不再依赖太多提示。

## 当前种子覆盖情况

当前 daily 数学种子已经覆盖：

### 阶段 1：foundation-observe

- `math-fruit-share-1`
- `math-shop-change-1`
- `math-many-ways-1`
- `math-seat-rows-1`

### 阶段 2：strategy-pattern

- `math-shortcut-1`
- `math-stairs-1`

### 阶段 3：rules-expression

- `math-rule-sentence-1`
- `math-seat-rule-1`
- `math-stair-rule-1`

### 阶段 4：story-reasoning

- `math-bridge-order-1`
- `math-snack-transfer-1`
- `math-map-route-1`

下一步把这条路线真正接进 runtime 的设计稿见：

- [adaptive-math-runtime-design.md](../docs/adaptive-math-runtime-design.md)
