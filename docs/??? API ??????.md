# 前后端 API 现行规范说明

## 1. 文档目的

本文档用于约束当前阶段的新前端开发。

重点不是描述理想中的未来接口，而是明确：

- 当前项目已经存在的真实 API
- 前端必须遵守的请求方式和数据结构
- 前端可以依赖什么
- 前端不允许擅自假设什么

以当前代码实现为准，核心依据包括：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\types\index.ts](../types/index.ts)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\docs\ai-gateway-contract.md](../docs/ai-gateway-contract.md)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\chat\route.ts](../app/api/ai/chat/route.ts)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\stt\route.ts](../app/api/ai/stt/route.ts)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\tts\route.ts](../app/api/ai/tts/route.ts)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\summary\route.ts](../app/api/ai/summary/route.ts)
- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\progress\log\route.ts](../app/api/progress/log/route.ts)

---

## 2. 总体原则

### 2.1 当前接口风格

当前项目前后端通信采用：

- 同域 API
- JSON 为主
- `multipart/form-data` 仅用于音频/图片上传
- 路由统一位于 `app/api/...`

当前不是严格教条式 RESTful 设计，更准确地说是：

- 面向能力的服务接口
- 以交互回合和 AI 能力调用为中心

### 2.2 前端必须遵守

- 前端不得直接调用外部 AI 厂商接口
- 前端不得自己拼 prompt
- 前端只能调用项目内 API
- 前端必须使用本文档定义的字段名
- 前端不得假设服务端永远返回某一种 AI 来源
- 前端必须兼容真实 AI、gateway、mock、缓存、降级回退

### 2.3 当前 AI 链路状态

当前真实后端状态：

- `chat`
  - `story / opponent / co-create` 三条线都可走真实千问
  - 失败时可回退 `gateway` 或 `mock`
- `tts`
  - 当前支持百炼 realtime、阿里云 NLS、mock/浏览器降级
  - 服务端对前端统一暴露为一个 `/api/ai/tts`
- `stt`
  - 当前通过 `/api/ai/stt`
- `summary`
  - 当前通过 `/api/ai/summary`
- `progress log`
  - 当前通过 `/api/progress/log`

前端不需要知道服务端内部具体走了哪条厂商链路。

---

## 3. 基础类型

以下类型由 [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\types\index.ts](../types/index.ts) 定义，前端必须对齐。

### 3.1 枚举

```ts
type TaskMode = "opponent" | "co-create" | "story";
type VoiceRole = "guide" | "opponent" | "maker" | "storyteller" | "parent";
type AIIntent = "challenge" | "coach" | "storybeat" | "reflection" | "summary";
```

### 3.2 AIMessage

```ts
interface AIMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  intent: AIIntent;
  hints: string[];
  nextAction?: string;
  speakerName?: string;
  voiceRole?: VoiceRole;
  speakableText?: string;
  autoSpeak?: boolean;
}
```

说明：

- `content` 用于展示文字
- `speakableText` 优先用于语音播报
- `speakerName` 和 `voiceRole` 用于角色表现
- `autoSpeak=true` 表示前端可以自动触发播报

### 3.3 TaskSessionState

```ts
interface TaskSessionState {
  taskId: string;
  mode: TaskMode;
  stage: number;
  status: "idle" | "active" | "completed";
  progress: number;
  completion: string;
  messages: AIMessage[];
  meta: Record<string, unknown>;
}
```

说明：

- `session` 是前端与后端对话的核心上下文
- 前端必须完整保存并在下一轮请求中回传
- `meta` 允许不同模式扩展状态，但前端不得随意重命名已有字段

### 3.4 RewardSignal

```ts
interface RewardSignal {
  type: "instant" | "identity" | "world";
  title: string;
  detail: string;
}
```

### 3.5 WorldState Patch

服务端返回的是 `Partial<WorldState>`，前端必须按 patch 合并，不是整对象覆盖。

---

## 4. API 一览

当前前端可调用的核心接口如下：

| 能力 | 方法 | 路径 | 请求格式 | 返回格式 |
| --- | --- | --- | --- | --- |
| 聊天/推进回合 | `POST` | `/api/ai/chat` | JSON | `ChatResponsePayload` |
| 语音转文字 | `POST` | `/api/ai/stt` | `multipart/form-data` | `SttResponsePayload` |
| 文字转语音 | `POST` | `/api/ai/tts` | JSON | `TtsResponsePayload` |
| 家长摘要 | `POST` | `/api/ai/summary` | JSON 空对象或无 body | `SummaryResponsePayload` |
| 完成记录落库 | `POST` | `/api/progress/log` | JSON | `{ ok: true }` |

补充：

- `/api/ai/tts/realtime` 是服务端内部和特殊调试路径，前端一般不直接依赖
- `/api/ai/vision` 当前不是主线前端阻塞项

---

## 5. 聊天接口

## 5.1 路径

`POST /api/ai/chat`

文件位置：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\chat\route.ts](../app/api/ai/chat/route.ts)

## 5.2 请求体

```ts
interface ChatRequestPayload {
  mode: TaskMode;
  taskId: string;
  message: string;
  session: TaskSessionState;
  action?: string;
}
```

### 5.2.1 必须字段说明

- `mode`
  - 当前只能是 `opponent | co-create | story`
- `taskId`
  - 当前前端应与玩法一致
  - 常见值：`opponent`、`co-create`、`story`
- `message`
  - 用户本轮输入的自然语言
  - 即使主要是点击选择，也建议保持有意义文本
- `session`
  - 当前完整会话状态
- `action`
  - 可选
  - 用于表达结构化选择行为
  - 例如 `take-1`、`take-2` 或某个 story choice id

### 5.2.2 session.meta 现行约定

前端需要知道，服务端当前会依赖部分 `meta` 字段。

#### `story`

常见字段：

- `sceneId`
- `frameIndex`
- `kernelId`
- `currentChoices`
- `carryover`
- `lastChoice`
- `lastMathMove`

#### `opponent`

常见字段：

- `sceneId`
- `remaining`
- `winner`

#### `co-create`

常见字段：

- `sceneId`
- `createdRule`

前端原则：

- 可以读取这些字段
- 可以回传这些字段
- 不要随意替换成另一套命名
- 不要在没有确认的情况下删除这些字段

## 5.3 返回体

```ts
interface ChatResponsePayload {
  messages: AIMessage[];
  sessionPatch: Partial<TaskSessionState>;
  worldPatch: Partial<WorldState>;
  rewardSignals: RewardSignal[];
}
```

### 5.3.1 前端处理规则

- `messages`
  - 追加到当前会话消息流
- `sessionPatch`
  - 合并进当前 `session`
  - 不要整对象重建丢失旧字段
- `worldPatch`
  - 合并进当前 `world state`
- `rewardSignals`
  - 进入当前奖励队列

### 5.3.2 前端禁止事项

- 不要假设 `messages.length` 固定为 1
- 不要假设 `nextAction` 必定存在
- 不要假设 `speakerName` 必定存在
- 不要假设 `progress===100` 以外都属于失败

## 5.4 示例请求

```json
{
  "mode": "story",
  "taskId": "story",
  "message": "我先比较谁更着急",
  "action": "compare-needs",
  "session": {
    "taskId": "story",
    "mode": "story",
    "stage": 1,
    "status": "active",
    "progress": 25,
    "completion": "",
    "messages": [],
    "meta": {
      "sceneId": "market_bridge_bargain",
      "frameIndex": 0
    }
  }
}
```

## 5.5 示例返回

```json
{
  "messages": [
    {
      "id": "assistant-1",
      "role": "assistant",
      "content": "先比较需求是对的。现在再想一步：如果你先帮这一边，另一边会怎样？",
      "intent": "storybeat",
      "hints": ["先猜后果，不要只看眼前"],
      "nextAction": "choose",
      "speakerName": "雾镇讲述者",
      "voiceRole": "storyteller",
      "speakableText": "先比较需求是对的。现在再想一步：如果你先帮这一边，另一边会怎样？",
      "autoSpeak": true
    }
  ],
  "sessionPatch": {
    "stage": 2,
    "progress": 40,
    "status": "active",
    "meta": {
      "frameIndex": 1
    }
  },
  "worldPatch": {
    "statusText": "桥市开始对你的判断做出反应"
  },
  "rewardSignals": [
    {
      "type": "instant",
      "title": "AI 接住了你的思路",
      "detail": "系统识别到你在先比较需求"
    }
  ]
}
```

---

## 6. 语音识别接口

## 6.1 路径

`POST /api/ai/stt`

文件位置：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\stt\route.ts](../app/api/ai/stt/route.ts)

## 6.2 请求格式

`multipart/form-data`

字段：

- `audio`
  - 录音文件 blob
- `mode`
  - `opponent | co-create | story`

## 6.3 返回体

```ts
interface SttResponsePayload {
  transcript: string;
  confidence: number;
  fallbackUsed: boolean;
}
```

## 6.4 前端处理规则

- `transcript` 识别成功后回填到输入区或直接发到 `/api/ai/chat`
- `fallbackUsed=true` 不代表失败，只表示走了降级路径
- 不要自己伪造 `confidence`

---

## 7. 语音合成接口

## 7.1 路径

`POST /api/ai/tts`

文件位置：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\tts\route.ts](../app/api/ai/tts/route.ts)

## 7.2 请求体

```ts
interface TtsRequestPayload {
  text: string;
  voiceRole: VoiceRole;
  speakerName?: string;
}
```

## 7.3 返回体

```ts
interface TtsResponsePayload {
  text: string;
  voiceRole: VoiceRole;
  speakerName?: string;
  fallbackUsed: boolean;
  audioBase64?: string;
  mimeType?: string;
}
```

## 7.4 前端处理规则

- 如果有 `audioBase64 + mimeType`
  - 直接播放真实音频
- 如果没有 `audioBase64`
  - 前端可以自行退回浏览器语音
- 不要在前端自己决定角色音色映射
- 角色只传 `voiceRole` 和可选 `speakerName`

## 7.5 当前后端行为

当前服务端内部会尝试多条语音链路，但前端统一看一个接口：

- 百炼 realtime TTS
- 阿里云 NLS
- 其他回退路径

此外，服务端已经有缓存机制：

- 相同 `voiceRole + speakerName + text` 会命中缓存

前端不得自己再实现另一套相同语义缓存来干扰服务端策略。

---

## 8. 家长摘要接口

## 8.1 路径

`POST /api/ai/summary`

文件位置：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\ai\summary\route.ts](../app/api/ai/summary/route.ts)

## 8.2 请求

当前可用空请求：

```json
{}
```

或直接无有效业务字段。

## 8.3 返回体

```ts
type SummaryResponsePayload = ParentSummary;

interface ParentSummary {
  dailySummary: string;
  strengthSignals: string[];
  stuckSignals: string[];
  nextSuggestion: string;
  recentHighlights: string[];
  latestMathFocus?: string;
  observedMoves?: string[];
  aiFocus?: string[];
}
```

## 8.4 前端处理规则

- 家长页必须优先展示 `dailySummary`
- `latestMathFocus / observedMoves / aiFocus` 是数学思维证据层
- 不允许前端把它渲染成考试分数报告

---

## 9. 完成记录接口

## 9.1 路径

`POST /api/progress/log`

文件位置：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\app\api\progress\log\route.ts](../app/api/progress/log/route.ts)

## 9.2 请求体

```ts
interface CompletedSessionPayload {
  mode: TaskMode;
  taskId: string;
  sceneId?: string;
  title: string;
  completion: string;
  highlights: string[];
  rewardSignals: RewardSignal[];
  mathEvidence?: MathEvidence;
}
```

### 9.2.1 MathEvidence

```ts
interface MathEvidence {
  kernelId?: string;
  publicTitle: string;
  skillFocus: string[];
  observedMoves: string[];
  aiFocus: string[];
}
```

## 9.3 返回体

```json
{ "ok": true }
```

## 9.4 前端处理规则

- 任务真正完成后才调用
- 不要在中途每一轮都落库
- `mathEvidence` 能传则尽量传
- 不要伪造未发生的 `rewardSignals`

---

## 10. 错误处理约束

## 10.1 当前现实情况

当前 API 还没有完整统一的错误码体系。

因此前端必须按以下策略处理：

- 请求失败时，显示通用失败态
- 不依赖某个固定 `error.code`
- 不依赖某个固定 `message` 文案

## 10.2 前端最低要求

- 所有调用必须有 `try/catch`
- `chat` 失败时，保留当前 `session`
- `tts` 失败时，允许静音或浏览器语音回退
- `stt` 失败时，允许用户重新录音或切文本输入
- 不要因为一个能力失败导致整个页面崩溃

---

## 11. 前端状态合并规范

前端状态更新必须遵守：

### 11.1 session

- 当前会话对象 = `旧 session` + `sessionPatch`
- `messages` 不是由 `sessionPatch` 替换，而是应与返回 `messages` 一起更新消息流

### 11.2 world

- 当前世界状态 = `旧 world` + `worldPatch`

### 11.3 reward

- `rewardSignals` 进入当前奖励展示和记录

### 11.4 不允许的更新方式

- 不要收到 patch 后整页重置初始状态
- 不要把未知字段清空
- 不要因为某个 patch 缺字段就当作该字段被删除

---

## 12. 新前端必须遵守的边界

### 12.1 可以重做

- 页面结构
- 动画表现
- 舞台交互
- 视觉样式
- 组件层组织方式

### 12.2 不要擅自改

- API 路径
- 请求字段名
- 返回字段名
- `TaskMode` 枚举值
- `voiceRole` 枚举值
- `session.meta` 里现有关键字段命名
- `mathEvidence` 结构

### 12.3 如果必须改接口

必须先同步更新：

- [C:\Users\Administrator\.openclaw\workspace\math-ai-kid\types\index.ts](../types/index.ts)
- 对应 route handler
- 本文档

没有同步更新，不视为允许变更。

---

## 13. 给前端设计师/开发者的直接约束

新前端可以完全重做表现层，但必须遵守以下一句话规则：

> 你可以重做舞台，不能重做协议。

具体就是：

- 前端只通过本文档列出的接口拿数据
- 前端不直接碰模型厂商
- 前端不自己定义另一套 session 结构
- 前端不把数学思维训练改成“随便讲故事”
- 前端不把家长页改成分数排行榜

---

## 14. 当前建议的前端接入顺序

1. 先接 `/api/ai/chat`
2. 再接 `/api/ai/tts`
3. 再接 `/api/ai/stt`
4. 完成回合后接 `/api/progress/log`
5. 家长页最后接 `/api/ai/summary`

原因：

- `chat` 是主交互骨架
- `tts` 决定沉浸感
- `stt` 是输入增强
- `progress log` 和 `summary` 属于结果与复盘层

---

## 15. 文档状态

当前状态：

- 生效中
- 适用于当前阶段新前端接手
- 以当前仓库代码为准

后续如接口变更，必须同步更新本文档。
