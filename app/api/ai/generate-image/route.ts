import { NextResponse } from "next/server";
import { readLocalEnvValue } from "@/lib/server/local-env";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/api/v1";
const DEFAULT_DASHSCOPE_IMAGE_MODEL = "wan2.6-t2i";
const DEFAULT_IMAGE_SIZE = "1280*1280";
const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_ASYNC_TIMEOUT_MS = 75000;
const IMAGE_NEGATIVE_PROMPT =
  "low quality, blurry, distorted text, scary, violent, mature content, cluttered composition";

type ImageProvider = "gemini" | "dashscope" | "local-fallback";

interface ImageResponse {
  imageUrl: string | null;
  provider?: ImageProvider;
  fallbackUsed?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(readLocalEnvValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getGeminiApiKey() {
  return readLocalEnvValue("GEMINI_API_KEY");
}

function getDashScopeApiKey() {
  return readLocalEnvValue("DASHSCOPE_API_KEY") || readLocalEnvValue("QWEN_API_KEY");
}

function getDashScopeBaseUrl() {
  return (readLocalEnvValue("DASHSCOPE_IMAGE_BASE_URL") || DEFAULT_DASHSCOPE_BASE_URL).replace(/\/+$/, "");
}

function getDashScopeImageModel() {
  return readLocalEnvValue("DASHSCOPE_IMAGE_MODEL") || DEFAULT_DASHSCOPE_IMAGE_MODEL;
}

function getDashScopeImageSize() {
  return readLocalEnvValue("DASHSCOPE_IMAGE_SIZE") || DEFAULT_IMAGE_SIZE;
}

function buildPrompt(prompt: string, alt?: string) {
  const trimmedPrompt = prompt.trim();
  const altHint = alt?.trim() ? ` Scene description: ${alt.trim()}.` : "";

  return [
    "Children's educational illustration.",
    "Friendly cartoon style for ages 6-10, warm colors, simple composition, clear learning objects.",
    "Do not add readable text unless it is explicitly requested.",
    `${trimmedPrompt}.${altHint}`,
  ].join(" ").slice(0, 2000);
}

function extractGeminiImageUrl(data: unknown) {
  if (!isRecord(data)) return null;
  const candidates = data.candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const content = candidate.content;
    if (!isRecord(content) || !Array.isArray(content.parts)) continue;

    for (const part of content.parts) {
      if (!isRecord(part) || !isRecord(part.inlineData)) continue;
      const base64 = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      if (typeof base64 === "string" && typeof mimeType === "string") {
        return `data:${mimeType};base64,${base64}`;
      }
    }
  }

  return null;
}

function extractDashScopeImageUrl(data: unknown) {
  if (!isRecord(data) || !isRecord(data.output)) return null;

  const choices = data.output.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!isRecord(choice) || !isRecord(choice.message)) continue;
      const content = choice.message.content;
      if (!Array.isArray(content)) continue;

      for (const item of content) {
        if (!isRecord(item)) continue;
        if (typeof item.image === "string" && item.image.length > 0) {
          return item.image;
        }
      }
    }
  }

  const results = data.output.results;
  if (Array.isArray(results)) {
    for (const result of results) {
      if (isRecord(result) && typeof result.url === "string" && result.url.length > 0) {
        return result.url;
      }
    }
  }

  return null;
}

function extractTaskId(data: unknown) {
  if (!isRecord(data) || !isRecord(data.output)) return null;
  return typeof data.output.task_id === "string" ? data.output.task_id : null;
}

function extractTaskStatus(data: unknown) {
  if (!isRecord(data) || !isRecord(data.output)) return null;
  return typeof data.output.task_status === "string" ? data.output.task_status : null;
}

function getErrorSummary(data: unknown) {
  if (!isRecord(data)) return "";
  const code = typeof data.code === "string" ? data.code : "";
  const message = typeof data.message === "string" ? data.message : "";
  return [code, message].filter(Boolean).join(": ");
}

function buildDashScopeRequestBody(prompt: string) {
  return {
    model: getDashScopeImageModel(),
    input: {
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
    },
    parameters: {
      prompt_extend: true,
      watermark: false,
      n: 1,
      negative_prompt: IMAGE_NEGATIVE_PROMPT,
      size: getDashScopeImageSize(),
    },
  };
}

async function generateWithGemini(prompt: string, alt?: string) {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey.length < 10) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(prompt, alt) }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
    signal: AbortSignal.timeout(25000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.warn("[generate-image] Gemini error:", response.status, getErrorSummary(data));
    return null;
  }

  return extractGeminiImageUrl(data);
}

async function generateWithDashScopeSync(prompt: string, alt?: string) {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${getDashScopeBaseUrl()}/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildDashScopeRequestBody(buildPrompt(prompt, alt))),
    signal: AbortSignal.timeout(65000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.warn("[generate-image] DashScope sync error:", response.status, getErrorSummary(data));
    return null;
  }

  return extractDashScopeImageUrl(data);
}

async function pollDashScopeTask(taskId: string, apiKey: string) {
  const deadline = Date.now() + readNumberEnv("DASHSCOPE_IMAGE_TIMEOUT_MS", DEFAULT_ASYNC_TIMEOUT_MS);
  const intervalMs = readNumberEnv("DASHSCOPE_IMAGE_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await fetch(`${getDashScopeBaseUrl()}/tasks/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn("[generate-image] DashScope poll error:", response.status, getErrorSummary(data));
      return null;
    }

    const imageUrl = extractDashScopeImageUrl(data);
    if (imageUrl) {
      return imageUrl;
    }

    const status = extractTaskStatus(data);
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      console.warn("[generate-image] DashScope task failed:", status, getErrorSummary(data));
      return null;
    }
  }

  console.warn("[generate-image] DashScope task timed out:", taskId);
  return null;
}

async function generateWithDashScopeAsync(prompt: string, alt?: string) {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`${getDashScopeBaseUrl()}/services/aigc/image-generation/generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(buildDashScopeRequestBody(buildPrompt(prompt, alt))),
    signal: AbortSignal.timeout(25000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.warn("[generate-image] DashScope async create error:", response.status, getErrorSummary(data));
    return null;
  }

  const taskId = extractTaskId(data);
  if (!taskId) {
    return extractDashScopeImageUrl(data);
  }

  return pollDashScopeTask(taskId, apiKey);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapText(value: string) {
  const chars = Array.from(value.trim() || "一张学习场景图");
  const lines: string[] = [];
  let current = "";

  for (const char of chars) {
    current += char;
    if (current.length >= 14) {
      lines.push(current);
      current = "";
      if (lines.length === 3) break;
    }
  }

  if (current && lines.length < 3) {
    lines.push(current);
  }

  return lines;
}

function buildLocalFallbackImage(alt?: string) {
  const lines = wrapText(alt ?? "");
  const textSpans = lines
    .map((line, index) => `<text x="640" y="${650 + index * 58}" text-anchor="middle" class="label">${escapeXml(line)}</text>`)
    .join("");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="880" viewBox="0 0 1280 880">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#fff5cf"/>
      <stop offset="0.48" stop-color="#dff7ee"/>
      <stop offset="1" stop-color="#e9efff"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#35504b" flood-opacity="0.16"/>
    </filter>
    <style>
      .line{fill:none;stroke:#343a40;stroke-width:14;stroke-linecap:round;stroke-linejoin:round}
      .soft{fill:#ffffff;stroke:#343a40;stroke-width:12}
      .label{font-family:Arial, "PingFang SC", sans-serif;font-size:40px;font-weight:700;fill:#2b3230}
    </style>
  </defs>
  <rect width="1280" height="880" rx="48" fill="url(#bg)"/>
  <circle cx="1035" cy="150" r="72" fill="#ffd66b" stroke="#343a40" stroke-width="12"/>
  <g filter="url(#shadow)">
    <rect x="238" y="164" width="804" height="484" rx="44" fill="#fffdf7" stroke="#343a40" stroke-width="14"/>
    <path d="M310 546c95-120 196-135 302-46 82-112 181-159 318-52 36 28 64 63 82 98" fill="#9edfc7" stroke="#343a40" stroke-width="14" stroke-linejoin="round"/>
    <circle cx="468" cy="316" r="74" fill="#ffbc7a" stroke="#343a40" stroke-width="14"/>
    <path class="line" d="M384 444h510"/>
    <path class="line" d="M384 508h172"/>
    <path class="line" d="M622 508h272"/>
  </g>
  <g transform="translate(164 636)">
    <circle class="soft" cx="76" cy="76" r="64"/>
    <path class="line" d="M50 84c18 20 39 20 55 0"/>
    <path class="line" d="M54 54h1M99 54h1"/>
  </g>
  ${textSpans}
</svg>`.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export async function POST(request: Request) {
  const { prompt, alt } = (await request.json()) as { prompt?: string; alt?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  try {
    const geminiImageUrl = await generateWithGemini(prompt, alt);
    if (geminiImageUrl) {
      return NextResponse.json({ imageUrl: geminiImageUrl, provider: "gemini" } satisfies ImageResponse);
    }
  } catch (err) {
    console.warn("[generate-image] Gemini failed:", err instanceof Error ? err.message : err);
  }

  try {
    const dashScopeImageUrl =
      (await generateWithDashScopeSync(prompt, alt)) ?? (await generateWithDashScopeAsync(prompt, alt));
    if (dashScopeImageUrl) {
      return NextResponse.json({ imageUrl: dashScopeImageUrl, provider: "dashscope" } satisfies ImageResponse);
    }
  } catch (err) {
    console.warn("[generate-image] DashScope failed:", err instanceof Error ? err.message : err);
  }

  console.warn("[generate-image] cloud providers unavailable, returning local fallback");
  return NextResponse.json({
    imageUrl: buildLocalFallbackImage(alt ?? prompt),
    provider: "local-fallback",
    fallbackUsed: true,
  } satisfies ImageResponse);
}
