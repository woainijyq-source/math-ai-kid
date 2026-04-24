# BrainPlay Prototype

当前仓库已经从早期多入口原型收敛到以 `/session` 为核心的 Web 训练原型，主要验证：

- 首页和 `/session` 主会话入口
- agent SSE 驱动的数学思维训练体验
- 训练目标、证据评估和家长报告闭环
- 语音输入和语音播报
- 奖励页、家长页和设置页

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Zustand
- Framer Motion
- SQLite (`better-sqlite3`) for local session logs

## 本地启动

```bash
npm install
npm run dev
```

默认不要求配置真实 AI key；当前主链路会在本地 structured/fallback/mock 逻辑下正常运行。开发服务器启动后，可以跑一轮回归：

```bash
npm run smoke
```

## AI 配置

复制 `.env.example` 为 `.env.local` 后配置。

### 方案 1：自建 AI gateway

```bash
AI_PROVIDER_MODE=real
AI_GATEWAY_URL=
AI_GATEWAY_TOKEN=
AI_GATEWAY_TIMEOUT_MS=15000
AI_GATEWAY_CHAT_PATH=/chat
AI_GATEWAY_STT_PATH=/stt
AI_GATEWAY_SUMMARY_PATH=/summary
AI_GATEWAY_TTS_PATH=/tts
AI_GATEWAY_VISION_PATH=/vision
```

### 方案 2：DeepSeek 直连（推荐）

```bash
AI_CHAT_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

说明：

- DeepSeek 用于 `/api/agent/*` 的 tool calling 主链路
- 如果同时配置了 DeepSeek 和千问，默认优先使用 DeepSeek
- 如果要强制使用千问，可设置 `AI_CHAT_PROVIDER=qwen`

### 方案 3：千问直连（可选回退）

```bash
AI_CHAT_PROVIDER=qwen
QWEN_API_KEY=
QWEN_MODEL=qwen3.6-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

说明：

- 前端接口不变，仍然走 `/api/agent/*` 和 `/api/ai/chat`
- 服务端会把当前活动、孩子 profile、近期观察和可用工具一起发给模型
- 如果模型返回不合规，会自动回退到本地 mock/fallback

## 文档

- 当前状态与下一批：[docs/current-status-and-next-batch.md](docs/current-status-and-next-batch.md)
- 产品框架：[docs/micro-leap-inquiry-framework.md](docs/micro-leap-inquiry-framework.md)
- 数学思维路线图：[docs/math-thinking-progression-map.md](docs/math-thinking-progression-map.md)
- 数学实时升级机制设计稿：[docs/adaptive-math-runtime-design.md](docs/adaptive-math-runtime-design.md)
- 契约说明：[docs/ai-gateway-contract.md](docs/ai-gateway-contract.md)
- 联调说明：[docs/ai-gateway-runbook.md](docs/ai-gateway-runbook.md)
- 内容系统：[docs/content-system.md](docs/content-system.md)
