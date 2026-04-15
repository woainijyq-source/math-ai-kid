import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(request: Request) {
  const { prompt, alt } = (await request.json()) as { prompt?: string; alt?: string };

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  // 没有 Gemini API Key 时返回 fallback
  if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
    console.warn("[generate-image] no API key, returning fallback");
    return NextResponse.json({ imageUrl: null });
  }

  try {
    const body = {
      contents: [{ parts: [{ text: `Children's educational illustration: ${prompt}. Colorful, friendly, simple, cartoon style, suitable for ages 6-12.` }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    };

    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.warn("[generate-image] Gemini error:", resp.status, err.slice(0, 200));
      return NextResponse.json({ imageUrl: null });
    }

    const data = await resp.json() as {
      candidates?: Array<{ content: { parts: Array<{ inlineData?: { data: string; mimeType: string } }> } }>
    };

    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) {
      console.warn("[generate-image] no image in response");
      return NextResponse.json({ imageUrl: null });
    }

    const { data: base64, mimeType } = part.inlineData;
    const imageUrl = `data:${mimeType};base64,${base64}`;

    console.info("[generate-image] OK", { prompt: prompt.slice(0, 40), alt });
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.warn("[generate-image] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ imageUrl: null });
  }
}
