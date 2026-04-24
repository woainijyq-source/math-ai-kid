# 数学思维实时升级机制设计稿

## 目标

解决当前 daily 数学路线的一个核心缺口：

> 孩子如果连续几次都觉得很轻松，系统能不能稳定发现，并在下一次自动给她更高半级的数学内容？

当前项目已经具备：

- 数学思维目标树
- 掌握度引擎
- daily 场景种子
- 会话内动态追问

但还没有形成一个完整闭环：

- 每次数学互动结束后，系统没有稳定写入“这次太轻松 / 刚好 / 太难”
- 下一次数学主题开始时，也不会稳定依据最近几次表现自动换阶段

这份文档的作用，是把这条闭环写成一份可以直接开始编码的设计稿。

## 设计原则

这套机制必须同时满足两件事：

1. **保留 MLIF 的对话式体验**
   - 不能把产品拉回成“题库升级系统”
   - 升级逻辑应该是后台存在，前台仍然像陪聊

2. **升级判断足够清楚**
   - 不看单次发挥
   - 看最近几次
   - 看是否稳定、是否有理由、是否提示少

## 现状总结

当前项目里已有的关键模块：

- 阶段与目标：`content/math-progression.ts`
- 数学子目标：`content/goals/goal-tree-part1.ts`
- 掌握度引擎：`lib/training/mastery-engine.ts`
- daily 数学场景：`content/daily/daily-question-bank.ts`
- 数学主题映射：`lib/daily/theme-goal-mapping.ts`
- session log：`lib/data/session-log.ts`

当前缺口：

- daily 数学聊天没有稳定沉淀成“下一次要不要升”的 runtime 证据
- `mastery-engine` 更偏 observation / activity session 逻辑，daily 还没完全接进去

## 总体方案

引入一条**轻量数学适应闭环**：

1. 每次数学 daily 会话结束时
   - 计算这次是：`too_easy / fit / too_hard`
   - 计算是否有理由证据、提示依赖、迁移反应
   - 写入 `session_logs.math_evidence_json`

2. 下一次数学主题开始时
   - 读取最近若干条数学 session log
   - 推断当前数学阶段
   - 决定：升级 / 保持 / 回退
   - 再从对应阶段的场景池里选种子

3. AI 在当前会话内仍然继续做“半步推进”
   - 也就是：实时动态追问继续保留
   - 新机制只决定“下一次起点更适合哪里”

## 数据模型

### 1. 扩展 `MathEvidence`

当前文件：`types/index.ts`

建议新增字段：

```ts
export type MathDifficultySignal = "too_easy" | "fit" | "too_hard";

export type MathSupportLevel = "light" | "medium" | "heavy";

export interface MathEvidence {
  kernelId?: string;
  publicTitle: string;
  skillFocus: string[];
  observedMoves: string[];
  aiFocus: string[];

  progressionStageId?: ProgressionStageId;
  goalId?: string;
  subGoalId?: string;
  reasoningShown?: boolean;
  transferAttempted?: boolean;
  supportLevel?: MathSupportLevel;
  difficultySignal?: MathDifficultySignal;
  nextSuggestedStageId?: ProgressionStageId;
}
```

### 2. 新增运行时适应快照

建议新增文件：`lib/daily/math-adaptation.ts`

```ts
export interface MathAdaptationSnapshot {
  progressionStageId: ProgressionStageId;
  goalId: "math-thinking";
  subGoalId: string;
  reasoningShown: boolean;
  transferAttempted: boolean;
  supportLevel: "light" | "medium" | "heavy";
  difficultySignal: "too_easy" | "fit" | "too_hard";
  nextSuggestedStageId: ProgressionStageId;
}
```

## 分阶段运行模型

当前数学主线按 4 段理解：

1. `foundation-observe`
2. `strategy-pattern`
3. `rules-expression`
4. `story-reasoning`

为了和现有 `math-thinking` 子目标对齐，建议对应如下：

### 阶段 1：foundation-observe

主要子目标：

- `quantity-comparison`
- 轻量 `spatial-reasoning`

代表场景：

- `math-fruit-share-1`
- `math-shop-change-1`
- `math-many-ways-1`
- `math-seat-rows-1`

### 阶段 2：strategy-pattern

主要子目标：

- `pattern-recognition`
- `strategy-planning` 入门

代表场景：

- `math-shortcut-1`
- `math-stairs-1`
- 后续可补数学主题下的 pattern 种子

### 阶段 3：rules-expression

主要子目标：

- `strategy-planning`
- `number-composition`
- `equation-thinking`

代表场景：

- 未来建议新增：
  - 为什么这个办法更省劲
  - 怎样用一句规则说清这个数怎么拆
  - 为什么这个缺失数字必须是它

### 阶段 4：story-reasoning

主要子目标：

- 高阶 `strategy-planning`
- 高阶 `spatial-reasoning`
- 迁移与换条件

代表场景：

- 未来建议新增：
  - 多一步后会怎样
  - 换规则后还成不成立
  - 同一个结构换个表面故事还能不能用

## 每次会话结束后的判断逻辑

### 输入信号

使用这些来源：

- `conversation` 中孩子的 2-3 次回答
- `classifyDailyChildSignal()`
- 当前 `question`
- 当前 `theme / subGoalId`
- session 内 choices 和支架使用情况

### 输出三档

#### 1. too_easy

满足以下大部分条件：

- 最近一轮或两轮主要是 `reasoned_answer` / `imaginative_answer`
- 没有 `uncertain / resistant / off_topic`
- 孩子不是只给答案，而是补了简短理由
- 在换条件问题上还能继续往前想
- 没有大量 choices 支架依赖

#### 2. fit

满足以下情况：

- 孩子能进入
- 有时需要支架
- 有时能说出理由
- 整体没有明显太轻松，也没有明显太吃力

#### 3. too_hard

满足以下大部分条件：

- 多次 `uncertain`
- 高依赖 choices / 重支架
- 理由始终说不出来
- 换条件立刻丢失方向

### supportLevel 判定

#### light

- 基本靠开放对话就能继续

#### medium

- 需要 1 次 choices 或轻引导

#### heavy

- 多次卡住
- 明显依赖 scaffold

## 跨会话升级规则

### 升级

满足下面条件时，下一次数学主题自动升到下一阶段：

- 最近 `3` 条数学 session log 中
- 至少 `2` 条是 `difficultySignal = too_easy`
- 且至少 `2` 条 `reasoningShown = true`
- 且 `supportLevel` 没有 `heavy`

### 保持

满足下面条件时保持当前阶段：

- 最近 3 条主要是 `fit`
- 或者有 `too_easy` 但理由证据还不稳定

### 回退

满足下面条件时退回上一阶段：

- 最近 `2` 条都是 `too_hard`
- 或连续 `2` 条 `supportLevel = heavy`

## 和现有 `mastery-engine` 的关系

这套 daily 数学适应机制**不替代** `mastery-engine`。

关系如下：

- `mastery-engine`：更正式、更全局的掌握度判断
- `daily math adaptation`：更轻量、专门服务 daily 数学聊天的升级起点判断

建议做法：

1. daily 路线优先读 recent math session logs
2. 再参考 `masteryProfile.primarySubGoalId`
3. 如果两者冲突：
   - 先以“更保守的一方”为准

## 运行时选择逻辑

### 会话开始时

文件：`app/api/agent/start/route.ts`

建议流程：

1. 如果 `themeId !== math`：保持现状
2. 如果 `themeId === math`：
   - 读取最近 `N=5` 条数学 session log
   - 推断当前阶段
   - 推断目标 subGoal
   - 从该阶段允许的 question pool 中选 seed

### 会话结束时

文件：`components/agent/session-page.tsx`

建议流程：

1. 如果 `themeId !== math`：保持现状
2. 如果 `themeId === math`：
   - 从 conversation 生成 `MathAdaptationSnapshot`
   - 写入 `mathEvidence`
   - 一起落到 `session_logs`

## 文件级改动建议

### 第一批最小改动

1. `types/index.ts`
   - 扩展 `MathEvidence`

2. `lib/daily/math-adaptation.ts`
   - 新增：
     - `inferMathStageFromRecentLogs()`
     - `assessMathConversation()`
     - `selectAdaptiveMathQuestion()`

3. `lib/data/session-log.ts`
   - 新增：
     - 读取 profile 下最近数学 logs 的 helper

4. `components/agent/session-page.tsx`
   - 数学 daily 结束时写 `mathEvidence`

5. `app/api/agent/start/route.ts`
   - `themeId === math` 时，不再只按默认映射选 question
   - 而是读 recent logs 后做 adaptive selection

### 第二批增强改动

1. `content/daily/daily-question-bank.ts`
   - 给数学种子补 `progressionStageId`

2. `lib/daily/theme-goal-mapping.ts`
   - 从“单一默认 subGoal”升级成“按阶段映射”

3. `app/api/agent/turn/route.ts`
   - 允许在会话内根据 `too_easy` 信号做更明显的 half-step challenge

## 验收标准

当下面 4 条都满足，可以认为这套机制闭环：

1. 孩子连续 2-3 次在某阶段明显轻松时，下一次数学思维默认场景会自动升半级
2. 孩子只是答对但理由薄时，不会升级，只会补证据
3. 孩子连续 2 次明显吃力时，下一次数学场景会更保守
4. 前台体验仍然像脑脑在聊天，而不是系统在调题库难度

## 一句话总结

这套设计的目标不是让 AI “更会出题”，而是：

> 让系统把孩子最近几次数学聊天里的“太轻松 / 刚好 / 太难”稳定记住，并用它决定下一次数学思维该从哪里继续聊。
