import { NextResponse } from "next/server";

/**
 * 家长端音色设置 API
 * 用进程内存存储（无需数据库），重启后读取 env 默认值。
 */

// 进程内存缓存，重启后回退到 env 配置
let currentVoice: string = process.env.QWEN_TTS_VOICE_OVERRIDE ?? "Mia";

export async function GET() {
  return NextResponse.json({ voice: currentVoice });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { voice?: string };
  const VALID_VOICES = ["Mia", "Cherry", "Mochi", "Moon", "Maia"];

  if (!body.voice || !VALID_VOICES.includes(body.voice)) {
    return NextResponse.json({ error: "invalid voice" }, { status: 400 });
  }

  currentVoice = body.voice;

  // 同步更新 qwen-tts-realtime 使用的音色（通过环境变量覆盖）
  process.env.QWEN_TTS_VOICE_OVERRIDE = currentVoice;

  console.info("[parent/settings] voice updated to:", currentVoice);

  return NextResponse.json({ voice: currentVoice, ok: true });
}
