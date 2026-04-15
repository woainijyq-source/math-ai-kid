# AI Gateway Runbook

## Purpose

Use this runbook when switching from local mock AI to a real external gateway.

## 1. Fill environment variables

Create `.env.local` from `.env.example` and set:

```bash
AI_PROVIDER_MODE=real
AI_GATEWAY_URL=https://your-gateway.example.com
AI_GATEWAY_TOKEN=your-token
AI_GATEWAY_TIMEOUT_MS=15000
```

Optional path overrides:

```bash
AI_GATEWAY_CHAT_PATH=/chat
AI_GATEWAY_STT_PATH=/stt
AI_GATEWAY_SUMMARY_PATH=/summary
AI_GATEWAY_TTS_PATH=/tts
AI_GATEWAY_VISION_PATH=/vision
```

## 2. Validate the gateway directly

Run:

```bash
npm run gateway:check
```

This checks:

- `/chat`
- `/summary`
- `/tts`
- `/stt`
- `/vision`

If one endpoint returns malformed data, the script fails immediately.

## 3. Validate the app fallback path

After the direct gateway check passes:

```bash
npm run dev
npm run smoke
```

Expected behavior:

- valid gateway responses are used directly
- malformed or failed gateway responses fall back to local mock responses
- the UI should stay playable even when one capability fails

## 4. Watch server logs

Relevant server log prefixes:

- `[ai.chat]`
- `[ai.stt]`
- `[ai.summary]`
- `[ai.tts]`
- `[ai.vision]`
- `[ai.gateway]`

If you see repeated `[ai.gateway]` warnings, the gateway is reachable but not returning a usable response.
