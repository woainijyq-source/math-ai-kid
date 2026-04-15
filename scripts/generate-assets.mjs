/**
 * T5.6-T5.8 — 使用 Gemini API 生成视觉素材
 * 运行：node scripts/generate-assets.mjs
 */

import fs from "node:fs";
import path from "node:path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "AIzaSyCMKu0zNfG46HYomHPqFwovAI2wde2mDdk";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent";

async function generateImage(prompt, outputPath) {
  console.log(`\n🎨 生成: ${path.basename(outputPath)}`);
  console.log(`   提示词: ${prompt.slice(0, 80)}...`);

  const resp = await fetch(`${BASE_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`   ❌ API 错误 ${resp.status}: ${err.slice(0, 200)}`);
    return false;
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));

  if (!imagePart) {
    console.error(`   ❌ 未找到图片数据，返回:`, JSON.stringify(data).slice(0, 300));
    return false;
  }

  const buf = Buffer.from(imagePart.inlineData.data, "base64");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buf);
  console.log(`   ✅ 已保存 (${(buf.length / 1024).toFixed(1)} KB)`);
  return true;
}

const BASE = "C:/Users/Administrator/.openclaw/workspace/math-ai-kid/public/illustrations";

// T5.6 — 角色"脑脑"（5个表情）
const CHARACTER_ASSETS = [
  {
    file: `${BASE}/character/brainy-happy.png`,
    prompt: "A cute cartoon fox character named Brain-Brain (脑脑), flat vector art style, transparent background, 512x512px. The fox is happy and smiling broadly, orange fur with white belly, big sparkling eyes, wearing a small star-shaped badge. Child-friendly, warm colors, clean lines, no text.",
  },
  {
    file: `${BASE}/character/brainy-thinking.png`,
    prompt: "A cute cartoon fox character named Brain-Brain (脑脑), flat vector art style, transparent background, 512x512px. The fox is thinking, one paw on chin, eyes looking upward with a thought bubble containing a question mark. Orange fur with white belly. Child-friendly, warm colors, clean lines, no text.",
  },
  {
    file: `${BASE}/character/brainy-surprised.png`,
    prompt: "A cute cartoon fox character named Brain-Brain (脑脑), flat vector art style, transparent background, 512x512px. The fox is surprised and excited, wide eyes, open mouth, ears perked up, small exclamation marks around it. Orange fur with white belly. Child-friendly, warm colors, clean lines, no text.",
  },
  {
    file: `${BASE}/character/brainy-encouraging.png`,
    prompt: "A cute cartoon fox character named Brain-Brain (脑脑), flat vector art style, transparent background, 512x512px. The fox is encouraging, giving a thumbs up with one paw, eyes in happy crescents, small golden stars around it. Orange fur with white belly. Child-friendly, warm colors, clean lines, no text.",
  },
  {
    file: `${BASE}/character/brainy-playful.png`,
    prompt: "A cute cartoon fox character named Brain-Brain (脑脑), flat vector art style, transparent background, 512x512px. The fox is playful and mischievous, winking one eye, slight smirk, tail curled playfully, sparkle effects. Orange fur with white belly. Child-friendly, warm colors, clean lines, no text.",
  },
];

// T5.7 — 场景背景（5张）
const BACKGROUND_ASSETS = [
  {
    file: `${BASE}/backgrounds/math.png`,
    prompt: "A soft, dreamy background illustration for a children's math learning app, 1920x1080px. Features floating numbers, geometric shapes (circles, triangles, squares), gentle gradients in warm orange and yellow tones, subtle grid patterns. No characters, no text. Flat design, child-friendly.",
  },
  {
    file: `${BASE}/backgrounds/logic.png`,
    prompt: "A soft, dreamy background illustration for a children's logic and reasoning app, 1920x1080px. Features connected dots forming constellations, flowing arrows, puzzle piece silhouettes, soft blue and purple tones. No characters, no text. Flat design, child-friendly.",
  },
  {
    file: `${BASE}/backgrounds/creative.png`,
    prompt: "A soft, dreamy background illustration for a children's creative thinking app, 1920x1080px. Features colorful paint splashes, pencil doodles, light bulbs, stars, rainbow gradients. No characters, no text. Flat design, child-friendly, vibrant and playful.",
  },
  {
    file: `${BASE}/backgrounds/language.png`,
    prompt: "A soft, dreamy background illustration for a children's language and expression app, 1920x1080px. Features speech bubbles, letters floating gently, bookmarks, soft green and teal tones. No characters, no text. Flat design, child-friendly.",
  },
  {
    file: `${BASE}/backgrounds/general.png`,
    prompt: "A soft, dreamy background illustration for a children's thinking game app, 1920x1080px. Features gentle clouds, small stars, soft gradients from warm peach to light lavender. Calming and inviting atmosphere. No characters, no text. Flat design, child-friendly.",
  },
];

// T5.8 — UI 图标（12个）
const ICON_ASSETS = [
  { file: `${BASE}/icons/math-thinking.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a glowing brain with numbers floating around it, orange and yellow tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/logical-reasoning.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: interlocking gears with a magnifying glass, blue tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/creative-thinking.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a colorful lightbulb with star sparkles, purple and yellow tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/language-thinking.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a speech bubble with small letters inside, green tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/strategy-thinking.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a chess knight piece with a shield, deep blue tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/observation-induction.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: an eye with small stars and dots forming a pattern, teal tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/voice-input.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a microphone with sound waves, warm orange tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/photo-input.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a camera with a small star, soft blue tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/drawing-input.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a pencil drawing a colorful line, warm tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/badge-star.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a golden star badge with sparkles, gold and yellow tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/badge-brain.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a purple brain trophy cup, purple and silver tones. Clean vector style, child-friendly, no text." },
  { file: `${BASE}/icons/badge-creative.png`, prompt: "A single flat icon, 128x128px, transparent background. Icon: a rainbow paintbrush making a colorful arc, vibrant tones. Clean vector style, child-friendly, no text." },
];

async function main() {
  const allAssets = [...CHARACTER_ASSETS, ...BACKGROUND_ASSETS, ...ICON_ASSETS];
  console.log(`\n🚀 开始生成 ${allAssets.length} 个视觉素材...`);

  let success = 0;
  let fail = 0;

  for (const asset of allAssets) {
    // 已存在则跳过
    if (fs.existsSync(asset.file)) {
      console.log(`   ⏭️  已存在: ${path.basename(asset.file)}`);
      success++;
      continue;
    }

    const ok = await generateImage(asset.prompt, asset.file);
    if (ok) success++;
    else fail++;

    // 避免限速
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n📊 完成: ${success} 成功, ${fail} 失败`);
}

main().catch((err) => { console.error(err); process.exit(1); });
