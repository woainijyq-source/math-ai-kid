# Math AI Kid 前端交接说明书

## 1. 文档用途

这份文档是给新的前端设计师/前端开发者看的。

目标不是介绍整个项目的所有实现细节，而是让新前端能快速理解：

1. 这个产品到底要做什么
2. 现在项目已经做到哪一步
3. 哪些能力已经可用，不要推倒重来
4. 现有前端为什么不合格
5. 新前端应该重做什么，不应该偏到哪里去

---

## 2. 项目初心

这个项目不是题库，不是练习册，不是“换皮数学题”。

项目初心是：

- 面向 7 岁左右孩子
- 用 AI 互动，把数学思维训练“藏”进体验里
- 让孩子觉得自己在玩、在选择、在参与剧情
- 而不是被迫读很多字、做很多题

一句话定义：

> 这是一个以 AI 为互动核心、以剧情/角色/语音为体验外壳、以数学思维训练为底层目标的儿童产品。

---

## 3. 当前产品方向

### 3.1 三条互动线

产品最初设计了三条互动线：

- `AI 剧情型`
- `AI 对手型`
- `AI 共创型`

### 3.2 当前主线决策

现阶段已经明确：

- **主线：`AI 剧情型`**
- 辅线：`AI 对手型`
- 辅线：`AI 共创型`

这意味着：

- 首页默认继续入口应优先指向剧情主线
- 前端重做的优先对象是 `AI 剧情型`
- 后续角色演出、语音、动画、世界变化，都优先服务剧情主线

---

## 4. 当前项目阶段

项目当前处于：

- **阶段 1：Web 原型验证版**
- 更准确地说，是 **阶段 1 后半段**

这意味着：

- 核心产品结构已经搭起来了
- 内容层和 AI 层已经具备可继续迭代的基础
- 主要短板已经不是后端或 AI，而是**前端体验表现层**

当前不是：

- 正式 iOS 开发阶段
- 完整 MVP 产品化阶段
- 大规模内容生产阶段

一句话：

> 现在最需要重做的是前端舞台交互，不是推翻项目定义，也不是重写 AI/内容结构。

---

## 5. 已完成的真实进度

下面这些能力已经存在，而且是现阶段最有价值的资产。

### 5.1 产品与信息架构已经明确

已经形成稳定的信息架构和页面闭环：

- 首页
- `AI 对手型`
- `AI 共创型`
- `AI 剧情型`
- 结果页
- 奖励页
- 家长页
- 家长设置页
- 试玩记录页

### 5.2 数学思维内容结构已经建立

当前内容不是散落在页面里的死文案，而是已经抽成结构化内容层：

- 数学进阶主线
- 剧情章节壳
- 数学思维任务核
- AI 可扩写边界

核心文件：

- [math-progression.ts](../content/math-progression.ts)
- [math-story-kernels.ts](../content/math-story-kernels.ts)
- [story-episodes.ts](../content/story-episodes.ts)
- [tasks.ts](../content/tasks.ts)
- [types/index.ts](../types/index.ts)

### 5.3 AI Chat 已接通

剧情主线已经不是纯本地 mock。

当前 `story/chat` 已接入千问：

- 支持真实 AI 剧情推进
- 支持把数学思维任务核、当前场景、可选思路、孩子最近判断一起发给 AI
- 支持结构化响应

核心文件：

- [chat.ts](../lib/ai/chat.ts)
- [qwen-chat.ts](../lib/ai/qwen-chat.ts)
- [chat-gateway-payload.ts](../lib/ai/chat-gateway-payload.ts)
- [app/api/ai/chat/route.ts](../app/api/ai/chat/route.ts)

### 5.4 TTS 已接通

当前语音链路不是空的，已经有两层：

- **百炼 realtime TTS**
- **阿里云 NLS 真语音兜底**

真实情况：

- 百炼 realtime TTS 已经打通，能返回 `start -> audio -> done`
- NLS 也已经可用
- 当前项目具备真实语音播报能力，不再只是浏览器假声

核心文件：

- [qwen-tts-realtime.ts](../lib/ai/qwen-tts-realtime.ts)
- [aliyun-nls-tts.ts](../lib/ai/aliyun-nls-tts.ts)
- [tts.ts](../lib/ai/tts.ts)
- [app/api/ai/tts/route.ts](../app/api/ai/tts/route.ts)
- [app/api/ai/tts/realtime/route.ts](../app/api/ai/tts/realtime/route.ts)

### 5.5 数据记录与家长摘要已具备

当前试玩记录、完成记录、数学思维证据、家长摘要链路已存在：

- 支持试玩结果落库
- 支持记录 `scene_id`
- 支持记录数学思维证据 `mathEvidence`
- 家长页可以读最近摘要

核心文件：

- [db.ts](../lib/data/db.ts)
- [session-log.ts](../lib/data/session-log.ts)
- [app/api/progress/log/route.ts](../app/api/progress/log/route.ts)
- [app/api/ai/summary/route.ts](../app/api/ai/summary/route.ts)

---

## 6. 当前前端状态判断

前端是当前最差的一层，这一点需要明确。

### 6.1 现有问题

当前前端的主要问题不是“风格不好看”，而是**交互范式不对**：

- 页面仍然带有明显的网页模块感
- 主焦点不够单一
- 角色、语音、台词、选择没有收成一条“演出时间线”
- 孩子在关键时刻仍然需要理解页面结构
- 体验像“网页组件切换”，不像“动画舞台互动”

### 6.2 用户已明确否定的方向

以下方向已经被明确否定，不能继续：

- 滚动式页面交互
- 上下分块式信息架构继续修补
- 靠很多信息卡来组织主玩法
- 把“选项区”做成页面下方的另一个版块
- 让孩子自己在屏幕里找焦点

一句话：

> 现有前端不是小修小补能救的，需要按单舞台交互重做。

---

## 7. 新前端必须遵守的体验目标

这是当前最重要的交接部分。

### 7.1 核心交互范式

剧情主线必须改成：

- **单舞台**
- **单屏**
- **单焦点**

而不是页面式布局。

### 7.2 角色行为

AI 角色行为要求：

- 角色从**左侧进场**
- 停在左侧讲话
- 台词气泡和语音同步
- 讲话结束后，角色**从左侧退场**
- 动画要自然，不是机械位移

### 7.3 作答时的用户焦点

一旦轮到孩子作答：

- 选项必须**立刻弹出在屏幕正中间**
- 屏幕其他区域必须**统一虚化**
- 用户目光应该只剩一个焦点：**中间选项弹层**

### 7.4 选项设计

选项不是普通按钮。

必须做成：

- 卡通样式卡片
- 具备儿童产品感
- 有明显点击引导
- 一眼能看出“点这个继续”

### 7.5 语音与舞台同步

前端需要围绕 realtime TTS 做表现：

- 角色讲话时，人物动作要同步
- 台词气泡要同步
- 字幕要同步
- 讲话结束后再切到选择态

目标不是“会播语音”，而是：

> 让语音、气泡、角色、选择四者组成同一条体验时间线。

---

## 8. 新前端不要碰的部分

新前端设计师/开发者接手时，不要随便重做以下内容：

### 8.1 不要推翻产品定义

不要把项目改成：

- 数学题应用
- 固定剧情播放器
- 儿童故事机
- 大量文字阅读产品

### 8.2 不要推翻内容结构

不要把下面这些结构重新写散到组件里：

- 数学任务核
- 剧情章节壳
- AI 扩写边界
- 思维训练目标

### 8.3 不要推翻 AI 层

当前 AI 层已经能工作，不应重写为完全新方案：

- 千问 chat
- 百炼 realtime TTS
- NLS TTS 兜底
- AI route handlers

### 8.4 不要把儿童主界面做成家长界面风格

孩子主场景不能做成：

- 运营后台感
- 仪表盘感
- 模块列表感
- 表单感

---

## 9. 新前端最合理的接手方式

### 9.1 优先接手范围

第一优先只重做：

- `AI 剧情型` 主舞台

不要一上来重做整个网站。

### 9.2 前端接手目标

第一阶段前端重做目标应当是：

1. 单舞台布局
2. 左侧角色进退场
3. 中央台词气泡
4. 中央视觉聚焦的卡通选项弹层
5. 其他区域虚化
6. 与 realtime TTS 配合

### 9.3 建议技术方向

如果原工具做不出足够流畅的演出感，建议前端工具或方案支持：

- React / Next.js
- Framer Motion
- Lottie 或 Rive（若要更高级人物动画）
- 可控的状态切换与单舞台时间线

当前项目已安装：

- `next`
- `react`
- `framer-motion`
- `zustand`

---

## 10. 当前代码里最值得复用的文件

### 产品/文档

- [产品规划书.md](../产品规划书.md)
- [任务书.md](../任务书.md)
- [技术路线决策建议（Web原型 vs iOS App）.md](../技术路线决策建议（Web原型%20vs%20iOS%20App）.md)
- [技术选型建议.md](../技术选型建议.md)
- [信息架构与页面清单.md](../信息架构与页面清单.md)
- [stage1-closeout-and-mvp-gate.md](../docs/stage1-closeout-and-mvp-gate.md)

### 内容层

- [math-story-kernels.ts](../content/math-story-kernels.ts)
- [story-episodes.ts](../content/story-episodes.ts)
- [math-progression.ts](../content/math-progression.ts)
- [tasks.ts](../content/tasks.ts)

### 类型

- [index.ts](../types/index.ts)

### AI 层

- [chat.ts](../lib/ai/chat.ts)
- [qwen-chat.ts](../lib/ai/qwen-chat.ts)
- [chat-gateway-payload.ts](../lib/ai/chat-gateway-payload.ts)
- [qwen-tts-realtime.ts](../lib/ai/qwen-tts-realtime.ts)
- [aliyun-nls-tts.ts](../lib/ai/aliyun-nls-tts.ts)
- [tts.ts](../lib/ai/tts.ts)

### API 路由

- [chat route](../app/api/ai/chat/route.ts)
- [tts route](../app/api/ai/tts/route.ts)
- [realtime tts route](../app/api/ai/tts/realtime/route.ts)

### 数据

- [db.ts](../lib/data/db.ts)
- [session-log.ts](../lib/data/session-log.ts)

---

## 11. 当前可运行状态

当前项目可构建，可运行，核心 AI/数据层可用。

已验证：

- `npm run lint`
- `npm run build`

当前最应该替换的是：

- `AI 剧情型` 的前端舞台表现层

当前最不应该推翻的是：

- AI 接口层
- 数学任务核
- 剧情章节壳
- 数据记录层

---

## 12. 给新前端设计师的一句话要求

> 不要继续修网页页面，而是把剧情主线重做成一个儿童动画舞台：左侧角色进退场讲话，中间弹出卡通选项框，作答时全屏聚焦选项，其他区域虚化，语音/字幕/气泡/角色动作组成同一条时间线。

