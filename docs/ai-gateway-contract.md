# AI Gateway Contract

## Overview

The prototype can run in two modes:

- `mock`: use the built-in local mock engine
- `real`: forward requests to your external AI gateway and fall back to mock on failure
- `qwen-direct`: for `story/chat`, the server can call Qwen directly when `QWEN_API_KEY` is configured

Environment variables:

```bash
AI_PROVIDER_MODE=real
AI_GATEWAY_URL=https://your-gateway.example.com
AI_GATEWAY_TOKEN=your-token
AI_GATEWAY_TIMEOUT_MS=15000
AI_GATEWAY_CHAT_PATH=/chat
AI_GATEWAY_STT_PATH=/stt
AI_GATEWAY_SUMMARY_PATH=/summary
AI_GATEWAY_TTS_PATH=/tts
AI_GATEWAY_VISION_PATH=/vision
QWEN_API_KEY=
QWEN_MODEL=qwen3.6-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

If `QWEN_API_KEY` is set:

- `story` mode chat will try direct Qwen first
- other modes still use the existing gateway/mock path
- if Qwen returns invalid structure, the app falls back to gateway/mock

Shared request headers added by the app:

- `Authorization: Bearer <AI_GATEWAY_TOKEN>` when token is configured
- `X-BrainPlay-Source: brainplay-web-prototype`
- `X-BrainPlay-Capability: chat | stt | summary | tts | vision`

## POST /chat

Request body follows the frontend `ChatRequestPayload`.

Minimum response shape:

```json
{
  "messages": [
    {
      "id": "assistant-1",
      "role": "assistant",
      "content": "先观察这一步之后还剩几颗。",
      "intent": "challenge",
      "hints": ["注意回合结束时的剩余数量"],
      "speakerName": "月石引导者",
      "voiceRole": "guide",
      "speakableText": "先观察这一步之后还剩几颗。",
      "autoSpeak": true
    }
  ],
  "sessionPatch": {
    "stage": 1,
    "status": "active",
    "progress": 35,
    "completion": "你开始注意到局面变化。"
  },
  "worldPatch": {
    "statusText": "营地里亮起一圈新的月灯。"
  },
  "rewardSignals": [
    {
      "type": "instant",
      "title": "你开始找规律了",
      "detail": "孩子开始观察剩余数量。"
    }
  ]
}
```

### Story mode runtimeContext

When `mode = "story"`, the server now enriches the payload before forwarding it to the real gateway.
The gateway will receive the original `ChatRequestPayload` plus a `runtimeContext` object.

Purpose:

- keep the product aligned with math-thinking training
- stop the model from drifting into fixed plot playback
- make AI act as director, challenger, and world simulator

Key fields inside `runtimeContext`:

- `scene`: current story shell, narrator, world line label, backdrop
- `mathKernel`: the actual math-thinking goal for this chapter
- `currentFrame`: current reasoning frame and follow-up question
- `allowedChoices`: the specific reasoning moves currently shown to the child
- `childState`: recent child choices, carryover, progress
- `responseRules`: guardrails for tone and behavior

Example shape:

```json
{
  "mode": "story",
  "taskId": "story",
  "message": "先比较谁更急",
  "action": "compare-needs",
  "session": {},
  "runtimeContext": {
    "productIntent": "This is a math-thinking training game wrapped in story form.",
    "scene": {
      "id": "market_bridge_bargain",
      "title": "桥市交换风向",
      "worldLineLabel": "数量分配"
    },
    "mathKernel": {
      "id": "quantity-allocation",
      "publicTitle": "怎么分更公平",
      "mathGoal": "在有限资源下比较不同分配方案，权衡公平与效率。",
      "aiEvaluationFocus": ["是否先比较数量", "是否考虑公平", "是否能解释取舍理由"]
    },
    "currentFrame": {
      "index": 0,
      "id": "observe-demand",
      "childPrompt": "先看谁需要什么，再决定第一步帮谁。",
      "followUpQuestion": "如果你先帮这一边，另一边会发生什么？"
    },
    "allowedChoices": [
      {
        "id": "compare-needs",
        "label": "先比谁更急",
        "mathMove": "比较需求大小"
      }
    ],
    "childState": {
      "progress": 35,
      "recentUserMessages": ["先比谁更急"]
    },
    "responseRules": [
      "Stay inside the story shell, but keep the math-thinking task explicit in your reasoning.",
      "Challenge the child to explain why, compare options, or predict consequences."
    ]
  }
}
```

## POST /stt

Multipart form-data:

- `audio`: recorded audio blob
- `mode`: `opponent | co-create | story`

Response:

```json
{
  "transcript": "我拿两颗",
  "confidence": 0.92,
  "fallbackUsed": false
}
```

## POST /summary

Request body:

```json
{}
```

Response:

```json
{
  "dailySummary": "孩子今天更愿意主动尝试下一轮。",
  "recentHighlights": ["会先观察再行动"],
  "strengthSignals": ["策略投入感增强"],
  "stuckSignals": ["遇到长文本时会停顿"],
  "nextSuggestion": "继续保留先听后选的节奏。"
}
```

## POST /tts

Request:

```json
{
  "text": "轮到你选了。",
  "voiceRole": "guide",
  "speakerName": "月石引导者"
}
```

Response:

```json
{
  "text": "轮到你选了。",
  "voiceRole": "guide",
  "speakerName": "月石引导者",
  "audioBase64": "base64-audio-optional",
  "mimeType": "audio/mpeg",
  "fallbackUsed": false
}
```

If `audioBase64` is omitted, the client falls back to browser speech synthesis.

## POST /vision

Multipart form-data:

- `image`: image blob
- `mode`: optional mode string

Response:

```json
{
  "description": "图像里是一张孩子拍下来的桌面任务卡。",
  "fallbackUsed": false
}
```
