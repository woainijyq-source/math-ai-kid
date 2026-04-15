# BrainPlay Prototype

阶段 1 的 Web 原型验证版，目标是先验证：

- 首页和三条原型入口
- 剧情主线的数学思维训练体验
- 统一 AI 服务层
- 语音输入和语音播报
- 结果反馈、奖励页、家长页

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

默认使用本地 mock AI。开发服务器启动后，可以跑一轮回归：

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

### 方案 2：千问直连

```bash
QWEN_API_KEY=
QWEN_MODEL=qwen3.6-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

说明：

- 千问直连目前只用于 `story` 主线的 `chat`
- 前端接口不变，仍然走 `/api/ai/chat`
- 服务端会把数学任务核、剧情壳、当前思维帧和可选思路一起发给千问
- 如果千问返回不合规，会自动回退到本地 mock

## 文档

- 契约说明：[docs/ai-gateway-contract.md](C:/Users/Administrator/.openclaw/workspace/math-ai-kid/docs/ai-gateway-contract.md)
- 联调说明：[docs/ai-gateway-runbook.md](C:/Users/Administrator/.openclaw/workspace/math-ai-kid/docs/ai-gateway-runbook.md)
- 内容系统：[docs/content-system.md](C:/Users/Administrator/.openclaw/workspace/math-ai-kid/docs/content-system.md)
