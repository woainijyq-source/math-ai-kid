# AI 训练系统化升级路线图

> 适用项目：`math-ai-kid`
>  
> 文档目的：把当前项目从“有训练骨架的 AI 互动产品”升级为“有明确训练目标、结构化证据采集、掌握度调节和家长可解释反馈”的训练系统。

---

## 1. 这份路线图解决什么问题

当前项目已经不是纯随机 AI 聊天：

- 已有训练目标树、子目标、难度分级和完成判据。
- 已有活动模板，把玩法绑定到 `goalId` 和 `subGoalId`。
- 已有 observation 数据表、写入接口和家长报告入口。

但它还不是一个完整的训练系统，原因是：

- `goal -> evidence -> mastery -> next task` 这条闭环还没有真正落地。
- AI 仍然承担了过多“决定训练方向”的职责。
- observation 还不是每个关键训练节点的刚性产物。
- 难度调整还主要依赖 prompt 推断，而不是规则明确的掌握度引擎。
- 家长报告目前更接近观察汇总，不够像训练解释。

这份路线图的核心原则是：

- 模型负责表达、承接、追问和提示。
- 系统负责目标、证据、难度、阶段推进和解释。

---

## 2. 当前代码基线

### 2.1 已经具备的训练系统骨架

#### 训练目标树

当前项目已定义：

- `TrainingGoal`
- `SubGoal`
- `DifficultyLevel`
- `CompletionCriteria`
- `ActivityTemplate`

对应文件：

- `content/goals/goal-tree.ts`
- `content/goals/goal-tree-part1.ts`
- `types/goals.ts`

当前数学主线已有 4 个 `SubGoal`：

- `pattern-recognition`
- `quantity-comparison`
- `strategy-planning`
- `spatial-reasoning`

这意味着训练系统已经有“训练点”的结构，不是空的。

#### 活动模板

当前活动模板已经将玩法绑定到训练点，代表项目已经具备“活动不是随便玩”的基础。

对应文件：

- `content/activities/activity-templates.ts`

例如：

- `number-pattern-hunt` -> `pattern-recognition`
- `strategy-nim` -> `strategy-planning`
- `shape-spy` -> `spatial-reasoning`

#### 观察记录与家长报告

当前项目已具备 observation 存储和基础汇总：

- `lib/data/db.ts`
- `lib/agent/tool-executor.ts`
- `app/api/parent/report/route.ts`

已存在 `observations` 表字段：

- `profile_id`
- `session_id`
- `skill`
- `sub_goal_id`
- `goal_id`
- `observation`
- `confidence`
- `evidence_json`
- `turn_index`

#### Prompt 侧的目标上下文

当前 `goal-context-builder` 已能根据最近 observation 生成目标上下文，并推断推荐难度。

对应文件：

- `prompts/goal-context-builder.ts`

这一步已经在做“基于表现影响下一轮 prompt”，但还不是正式的教学决策引擎。

### 2.2 当前主要缺口

#### 缺口 A：训练范围过宽

项目当前同时定义了 6 大能力域：

- `math-thinking`
- `logical-reasoning`
- `creative-thinking`
- `language-thinking`
- `strategy-thinking`
- `observation-induction`

问题不是“定义多了”，而是当前闭环还没做完。  
如果一开始把所有能力域都当作等优先级，会把训练质量和验证效率一起稀释。

#### 缺口 B：observation 不是强制训练证据

虽然已有 `log_observation`，但还没有被定义为：

- 孩子作答后必须产出
- 孩子解释后必须产出
- 活动收尾时必须产出

因此当前 observation 仍然偏“可选记录”，不是训练系统的刚性证据。

#### 缺口 C：没有掌握度状态机

现在系统能“看最近 observation 并推一个推荐难度”，但还没有正式的：

- 掌握阶段
- 升难规则
- 降难规则
- 复练规则
- 迁移规则

这意味着系统还不能稳定回答：

- 为什么现在给 L1？
- 为什么这次不升难？
- 为什么应该换同级变式，而不是继续出同一题？

#### 缺口 D：AI 还没被限制在本轮微目标里

当前 AI 已经被 `goalFocus`、`currentActivity` 和活动模板约束，但还缺一个更细颗粒的运行时对象：

- 当前轮次到底训练哪个 `subGoal`
- 当前轮次允许哪种教学动作
- 当前轮次预期采到什么证据

没有这层 `TrainingIntent`，AI 还是容易“承接得很好，但训练点发散”。

#### 缺口 E：家长报告还没有训练解释结构

当前家长报告是：

- skill 汇总
- recent observation 列表

这还不足以支撑“系统科学性”的对外解释。  
家长需要看到的是：

- 本次主要训练点
- 当前掌握阶段
- 强证据
- 卡住点
- 下一步建议及其理由

---

## 3. 推荐采用的训练系统骨架

本项目不适合泛泛套用大而全的教育理论。  
建议采用 4 层、足够实用且容易落地的骨架。

### 3.1 总框架：Mastery Learning

用途：决定“什么时候升难、降难、复练、迁移”。

在本项目中的作用：

- 每个 `SubGoal` 都定义掌握标准。
- 掌握不是看一次答对，而是看连续表现。
- 没达到标准就复练或降难，不随便跳主题。

### 3.2 回合逻辑：ZPD / Scaffolding

用途：决定“这一轮给多难、提示给多少”。

在本项目中的作用：

- 孩子不会时，系统只给脚手架，不直接给答案。
- 提示分层，不同层次对应不同难度状态。
- AI 的提示是有梯度的，不是自由发挥。

### 3.3 系统设计：Evidence-Centered Design

用途：决定“每轮到底采什么证据”。

在本项目中的作用：

- 每个 `SubGoal` 明确：
  - 训练什么
  - 看什么行为
  - 什么行为算证据
  - 这些证据如何影响下轮决策

### 3.4 数学表达路径：Concrete -> Pictorial -> Abstract

用途：让低龄孩子从具体进入抽象。

在本项目中的作用：

- 先故事/实物/取子/卡片
- 再图像/数列/结构示意
- 最后进入语言解释和抽象规律

这对 `math-thinking` 的前两阶段尤其重要。

---

## 4. 本项目的阶段性总策略

### 4.1 当前版本的训练范围收缩原则

首个“科学闭环版本”建议只围绕以下能力域展开：

- 主域：`math-thinking`
- 支撑域：`logical-reasoning`
- 支撑域：`language-thinking`

其他能力域：

- 保留结构
- 保留入口和内容资产
- 不纳入首版训练系统的正式掌握评估

这样做的原因：

- 数学主线训练点最清晰。
- 当前活动模板里数学相关活动最接近可验证闭环。
- 逻辑与语言可以作为数学解释和推理过程的支撑维度，而不是平行主轴。

### 4.2 首批闭环试点 SubGoal

按当前代码现状，建议首批只做 3 个：

1. `pattern-recognition`
2. `quantity-comparison`
3. `strategy-planning`

说明：

- 原始提纲中的 `quantity-allocation`，在当前代码里最接近的现成实现是 `quantity-comparison`。
- `spatial-reasoning` 保留为第二批，不放在首轮闭环试点中。

---

## 5. 分阶段实施方案

## Phase 0：收紧训练范围，建立可验证闭环

### 目标

先把系统做成“窄而深”，让训练点、证据和升级路径都能说清楚。

### 做什么

#### 5.0.1 锁定首版训练域

- 首版训练闭环只对 `math-thinking` 生效。
- `logical-reasoning` 和 `language-thinking` 作为支持维度写入 prompt 和报告，但不作为平行 mastery 主状态。

#### 5.0.2 为 3 个试点 SubGoal 建立训练卡

新增建议文件：

- `content/goals/subgoal-playbooks.ts`

每个试点子目标至少补齐以下字段：

- `trainingIntent`
- `observableBehaviors`
- `commonMistakes`
- `hintLadder`
- `advanceRules`
- `fallbackRules`
- `exitRules`
- `evidenceSpec`

建议的 3 个训练卡：

##### A. pattern-recognition

- 训练意图：识别规律、预测下一项、解释规则
- 可观测行为：
  - 能指出变化模式
  - 能用语言说出“每次加几/怎样变化”
- 典型错误：
  - 只猜答案，不说明原因
  - 看单个数字，不看序列关系
- 提示梯度：
  - 第 1 层：提醒看前后变化
  - 第 2 层：提示“每次都变一样吗”
  - 第 3 层：缩小成两个候选规律
- 升难条件：
  - 连续 2 次正确
  - 提示不超过 1 次
  - 能简短解释
- 降难条件：
  - 连续 2 次错误
  - 或解释明显脱离规律
- 退出条件：
  - 达到 `stable`
  - 或当前 session 内已完成迁移题

##### B. quantity-comparison

- 训练意图：比较数量关系、理解增减变化、用加减解释
- 可观测行为：
  - 能比较多少
  - 能解释“为什么多/少了多少”
- 典型错误：
  - 只报结论，不会说变化过程
  - 混淆“总数”和“变化量”
- 提示梯度：
  - 第 1 层：先看两边各有多少
  - 第 2 层：问“拿走/增加后变了多少”
  - 第 3 层：给出结构化比较框架
- 升难条件：
  - 正确率达到阈值
  - 至少一次能解释变化
- 降难条件：
  - 需要多次提示仍不能比较
- 退出条件：
  - 能稳定比较并解释数量变化

##### C. strategy-planning

- 训练意图：预判结果、选择策略、解释原因
- 可观测行为：
  - 能预测 1-2 步后的局面
  - 能说出“为什么这个策略更安全/更稳”
- 典型错误：
  - 只看当前一步
  - 无法考虑对手或后果
- 提示梯度：
  - 第 1 层：先看做完这一手后剩多少
  - 第 2 层：再看对方会怎么选
  - 第 3 层：用“如果你是对手”引导逆推
- 升难条件：
  - 连续两次能预判后果
  - 能自解释
- 降难条件：
  - 只能碰运气选
  - 无法完成最基本后果预测
- 退出条件：
  - 达到可迁移状态，进入相似博弈变式

#### 5.0.3 形成统一的训练作战手册

新增建议文档：

- `docs/ai-training-system-playbook.md`

内容包括：

- 首版训练范围
- 3 个试点 SubGoal 训练卡
- 教学动作定义
- 提示梯度规范
- observation 记录规范
- mastery 判定规则摘要

### 本阶段涉及文件

- `content/goals/subgoal-playbooks.ts`（新增）
- `docs/ai-training-system-playbook.md`（新增）
- `prompts/agent-system-prompt.ts`
- `prompts/goal-context-builder.ts`

### 验收标准

- 首版闭环只围绕 3 个数学子目标运行。
- 每个子目标都能明确回答“这一轮到底在练什么”。
- AI 不能在这 3 个试点里随意越界切题。

---

## Phase 1：把 observation 升级为训练证据

### 目标

让每个关键回合都能留下可以驱动教学决策的结构化证据。

### 做什么

#### 5.1.1 扩展 observations 表

在现有 `observations` 基础上补齐字段：

- `difficulty_level`
- `hint_count`
- `self_explained`
- `correctness`
- `task_id`
- `activity_id`
- `evidence_type`
- `mastery_delta`

推荐 `evidence_type` 枚举：

- `attempt`
- `explanation`
- `hint_response`
- `wrap_up`

推荐 `mastery_delta` 枚举：

- `up`
- `hold`
- `down`
- `transfer`

对应文件：

- `lib/data/db.ts`

#### 5.1.2 让 log_observation 成为训练节点刚需

将 `log_observation` 从“系统工具可用项”升级为“关键训练节点必出工具”。

至少要求以下节点必产出 observation：

- 孩子做出选择或回答之后
- 孩子解释原因之后
- 活动结束时

这里不要求每个 UI 轮次都写库，但必须保证一个完整活动至少产出 2-3 条 observation。

涉及文件：

- `lib/agent/agent-loop.ts`
- `lib/agent/tool-executor.ts`
- `prompts/modules/tools-description.ts`
- `prompts/modules/orchestration-rules.ts`

#### 5.1.3 统一 evidence_json 的结构

推荐标准结构：

```json
{
  "child_input": "孩子原话或选择",
  "tool_context": {
    "activity_id": "number-pattern-hunt",
    "teaching_move": "ask_to_explain",
    "difficulty_level": "L2"
  },
  "hint_used": 1,
  "answer_quality": "partial",
  "explained": true,
  "expected_evidence": "rule verbalization"
}
```

要求：

- 不再把 `evidence_json` 当成任意字符串。
- 必须能被后续 mastery engine 稳定读取。

#### 5.1.4 把 recentObservations 接回训练链路

当前 `ChildProfile` 已支持 `recentObservations`，但还需要形成稳定回流：

- profile 加载时，从 observations 表查询最近记录
- 写回 `recentObservations`
- 再供 `child-profile` prompt 和 `goal-context-builder` 使用

涉及文件：

- `types/goals.ts`
- `store/profile-store.ts`
- `app/api/parent/report/route.ts`
- 可能新增 `app/api/profile/...` 或在现有 profile 流程中接入

### 本阶段涉及文件

- `lib/data/db.ts`
- `lib/agent/tool-executor.ts`
- `store/profile-store.ts`
- `types/goals.ts`
- `app/api/parent/report/route.ts`

### 验收标准

- 每次完整训练活动至少产出 2-3 条结构化 observation。
- `recentObservations` 能稳定进入 prompt，而不是只依赖本地临时状态。
- 家长报告和 prompt 读取的是同一份 evidence 数据。

---

## Phase 2：新增 Mastery Engine，接管升难/降难/复练

### 目标

不让 AI 凭感觉决定下一题，而让系统按规则生成下一步训练建议。

### 做什么

#### 5.2.1 新增 mastery-engine 模块

新增建议文件：

- `lib/training/mastery-engine.ts`

定义掌握阶段：

- `emerging`
- `practicing`
- `stable`
- `ready_to_transfer`

输入：

- 最近 N 次 `correctness`
- `hint_count`
- `self_explained`
- `confidence`
- 当前 `difficulty_level`

输出：

- `stage`
- `recommendedDifficulty`
- `nextAction`
- `recentEvidenceSummary`

#### 5.2.2 明确掌握度规则

推荐第一版规则：

- 连续 2 次正确，且 `self_explained = true`，且 `hint_count <= 1`
  - `nextAction = advance`
  - `difficulty + 1`
- 正确但解释弱，或提示偏多
  - `nextAction = reinforce`
  - 保持当前难度
- 连续 2 次错误
  - `nextAction = fallback`
  - 同级变式或降一级
- 某子目标达到 `stable`
  - `nextAction = transfer`
  - 切到相邻活动或迁移题

第一版不要做复杂机器学习推断，优先做可解释规则系统。

#### 5.2.3 改造 goal-context-builder

当前 `goal-context-builder.ts` 主要根据 recent observation 的 confidence 推难度。  
Phase 2 后改为：

- 优先读 `MasteryState`
- recent observation 只作为证据摘要输入
- prompt 中展示“为什么当前推荐这个难度”

#### 5.2.4 改造 activity-selector

当前推荐逻辑偏“先选活动，再让 AI 去发挥”。  
调整为：

1. 先确定本轮 `subGoal`
2. 再根据 `subGoal + recommendedDifficulty + ageRange` 选 activity

这样活动切换是服务于 mastery，而不是服务于新鲜感。

涉及文件：

- `lib/agent/activity-selector.ts`
- `content/activities/activity-templates.ts`
- `prompts/goal-context-builder.ts`

### 本阶段涉及文件

- `lib/training/mastery-engine.ts`（新增）
- `lib/agent/activity-selector.ts`
- `prompts/goal-context-builder.ts`
- `content/activities/activity-templates.ts`

### 验收标准

- 同一孩子在同一子目标上连续多轮互动时，难度变化有明确理由。
- 系统能解释“为什么现在给 L1 / L2 / 迁移题”。
- 活动切换逻辑可以被复盘，而不是随机换题。

---

## Phase 3：把 AI 限定为训练导演

### 目标

让 AI 负责表达和互动承接，系统负责训练意图和边界。

### 做什么

#### 5.3.1 新增 TrainingIntent

新增建议文件：

- `lib/training/training-intent.ts`

定义：

```ts
interface TrainingIntent {
  goalId: string;
  subGoalId: string;
  difficultyLevel: "L1" | "L2" | "L3" | "L4";
  teachingMove:
    | "probe"
    | "hint"
    | "contrast"
    | "ask_to_explain"
    | "ask_to_predict"
    | "transfer_check"
    | "wrap_up";
  expectedEvidence: string;
  activityId: string;
  allowedActivityScope: string[];
}
```

每轮生成一个明确 `TrainingIntent`，交给 prompt builder 和 agent loop 使用。

#### 5.3.2 Prompt 改为三层

建议分三层：

- 系统层：训练哲学、教学动作约束、输出规则
- 会话层：当前 `subGoal`、当前难度、最近 evidence、mastery state
- 活动层：当前 activity 的提问边界、提示方式、常见误区

这样 AI 仍然可以自然对话，但不会越出本轮微目标。

涉及文件：

- `prompts/agent-system-prompt.ts`
- `prompts/modules/identity.ts`
- `prompts/modules/orchestration-rules.ts`
- `prompts/modules/tools-description.ts`

#### 5.3.3 限定教学动作集合

第一版只允许以下教学动作：

- `probe`
- `hint`
- `contrast`
- `ask_to_explain`
- `ask_to_predict`
- `transfer_check`
- `wrap_up`

不允许 AI 自己临场发明新的训练逻辑。

#### 5.3.4 为试点子目标定义提示梯度

每个试点子目标在 `subgoal-playbooks.ts` 中明确：

- 第一层提示：提醒观察点
- 第二层提示：给局部结构
- 第三层提示：缩小选项
- 禁止直接泄露答案

#### 5.3.5 为活动模板补充误区与对症追问

当前模板已有基础的 `systemPromptFragment`。  
需要补强：

- `commonMistakes`
- `followUpPrompts`
- `hintLadder`
- `transferPrompts`

这一步会直接提升 AI 追问的训练价值。

### 本阶段涉及文件

- `lib/training/training-intent.ts`（新增）
- `content/goals/subgoal-playbooks.ts`
- `prompts/agent-system-prompt.ts`
- `prompts/modules/orchestration-rules.ts`
- `content/activities/activity-templates.ts`

### 验收标准

- 任何一轮都能追溯到明确的 `TrainingIntent`。
- AI 输出可以丰富，但不能跳出当前子目标与允许的教学动作。
- 追问和提示都能对回训练卡，不再是随机好聊。

---

## Phase 4：把家长报告升级为训练解释

### 目标

让家长报告能够解释“孩子练了什么、现在在哪一级、下一步为什么这样安排”。

### 做什么

#### 5.4.1 改造家长报告结构

将当前报告从：

- 技能列表
- recent observation 列表

升级为：

- 本次主训练点
- 对应 `goal -> subGoal`
- strongest evidence
- stuck point
- 当前 mastery stage
- 下一步建议

#### 5.4.2 报告建议来自 mastery engine

报告中的“下一步建议”必须来源于：

- `MasteryState`
- `nextAction`

而不是由模型即兴生成。

#### 5.4.3 报告文案层与依据层分离

建议结构：

- `data layer`
  - mastery state
  - evidence summary
  - next action
- `presentation layer`
  - 面向家长的温和中文说明

这样既儿童友好，也保证底层依据一致。

### 本阶段涉及文件

- `app/api/parent/report/route.ts`
- 可能新增 `lib/training/report-builder.ts`
- `store/parent-store.ts`

### 验收标准

- 家长能看懂“今天在练什么、孩子表现在哪一级、下一步为什么这样安排”。
- 报告内容与 observation/mastery state 一致。
- 不出现“写得很好看，但证据对不上”的情况。

---

## 6. 核心接口与数据增量

### 6.1 建议新增接口

#### TrainingIntent

```ts
interface TrainingIntent {
  goalId: string;
  subGoalId: string;
  difficultyLevel: "L1" | "L2" | "L3" | "L4";
  teachingMove:
    | "probe"
    | "hint"
    | "contrast"
    | "ask_to_explain"
    | "ask_to_predict"
    | "transfer_check"
    | "wrap_up";
  expectedEvidence: string;
  activityId: string;
  allowedActivityScope: string[];
}
```

#### MasteryState

```ts
interface MasteryState {
  profileId: string;
  subGoalId: string;
  stage: "emerging" | "practicing" | "stable" | "ready_to_transfer";
  recommendedDifficulty: "L1" | "L2" | "L3" | "L4";
  recentEvidenceSummary: string;
  nextAction: "advance" | "reinforce" | "fallback" | "transfer";
}
```

#### StructuredObservation

```ts
interface StructuredObservation {
  profile_id: string;
  session_id: string;
  goal_id: string;
  sub_goal_id: string;
  skill: string;
  observation: string;
  confidence: number;
  difficulty_level: "L1" | "L2" | "L3" | "L4";
  hint_count: number;
  self_explained: boolean;
  correctness: "correct" | "partial" | "incorrect";
  task_id?: string;
  activity_id?: string;
  evidence_type: "attempt" | "explanation" | "hint_response" | "wrap_up";
  mastery_delta: "up" | "hold" | "down" | "transfer";
  evidence_json: string;
}
```

### 6.2 建议新增模块

- `lib/training/mastery-engine.ts`
- `lib/training/training-intent.ts`
- `content/goals/subgoal-playbooks.ts`
- `lib/training/report-builder.ts`

---

## 7. 验证标准

系统完成后，不以“AI 看起来聪明”为核心标准，而以以下 5 项为标准：

1. 每轮是否能明确映射到一个训练点。
2. 每轮是否采到了结构化证据。
3. 难度变化是否有明确规则依据。
4. 活动切换是否服务于 mastery，而不是服务于随机新鲜感。
5. 家长报告是否能从 evidence 倒推回训练过程。

---

## 8. 建议的落地顺序

1. 先完成 `math-thinking` 单域 3 个子目标闭环。
2. 再完成 observation 结构化和 profile 回流。
3. 再接 mastery engine 和 TrainingIntent。
4. 再改 activity selector 和 prompt 三层结构。
5. 最后升级 parent report。

不建议一开始就同时推进：

- 全能力域闭环
- 全量报告改造
- 全模态复杂互动

优先把数学主线做成一个能验证、能复盘、能解释的训练系统。

---

## 9. 设计边界与默认假设

- 当前阶段不追求“全学科、全能力域同时科学化”。
- 首版训练系统以 `math-thinking` 为唯一主轴。
- AI 的职责被收紧为“承接、表达、追问、提示”，而不是“自己定义训练目标”。
- 当前已有 goal tree、activity templates、observation DAO、parent report API 均保留升级，不推倒重来。
- 第一版 mastery engine 优先做规则系统，不做黑盒评分模型。

---

## 10. 项目层面的最终判断

这个项目现在已经有训练系统的结构基础，但还没有形成真正的教学闭环。  
下一步最重要的不是“继续把 AI 接得更自然”，而是把以下链路做硬：

`SubGoal -> TrainingIntent -> Activity -> Evidence -> Mastery -> Next Task`

只要这条链打通，AI 才会从“会聊天的互动层”变成“有训练目标的系统层”。
