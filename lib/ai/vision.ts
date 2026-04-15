/**
 * T6.2 — Vision API（升级版）
 * 使用 Qwen VL 进行真实图像理解，保留 mock fallback。
 */

const QWEN_BASE_URL =
  process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1";
const QWEN_API_KEY =
  process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? "";
const VISION_MODEL = process.env.QWEN_VISION_MODEL ?? "qwen-vl-plus";

export interface VisionResult {
  description: string;
  fallbackUsed?: boolean;
}

/**
 * 使用 Qwen VL 分析图片，返回与任务相关的描述。
 * @param imageBase64 - base64 编码的图片数据（不含 data:image/... 前缀）
 * @param mimeType    - 图片 MIME 类型，默认 image/jpeg
 * @param taskHint    - 任务提示，帮助模型聚焦相关内容
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType = "image/jpeg",
  taskHint = "",
): Promise<VisionResult> {
  if (!QWEN_API_KEY) {
    return buildMockVision(taskHint);
  }

  const systemPrompt = `你是一个帮助儿童做思维训练的 AI 助手。
分析图片时，只描述与学习任务相关的内容，过滤掉个人隐私信息（人脸、姓名、地址等）。
用简短中文描述（不超过 50 字），面向 6-12 岁孩子。`;

  const userPrompt = taskHint
    ? `任务：${taskHint}\n\n请描述图片中与任务相关的内容。`
    : "请描述图片中与学习任务相关的主要内容。";

  try {
    const resp = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn("[vision] Qwen VL failed:", resp.status);
      return buildMockVision(taskHint);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const description = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!description) return buildMockVision(taskHint);

    return { description, fallbackUsed: false };
  } catch (err) {
    console.warn("[vision] error:", err);
    return buildMockVision(taskHint);
  }
}

/**
 * Mock fallback：返回与任务相关的模拟描述。
 */
function buildMockVision(taskHint: string): VisionResult {
  const hints: Record<string, string> = {
    math: "画面中有 3 块红色积木和 2 块蓝色积木，共 5 块。",
    count: "画面中可以数到 4 个物体。",
    shape: "画面中有圆形和方形两种形状。",
    pattern: "画面中物体排列有规律，间隔相同。",
  };
  const key = Object.keys(hints).find((k) => taskHint.includes(k));
  return {
    description:
      key
        ? hints[key]
        : "当前是视觉接口预留阶段，首轮原型暂未启用真实图像理解。",
    fallbackUsed: true,
  };
}

/**
 * 兼容旧接口：接收 FormData，提取图片并调用 analyzeImage。
 */
export async function runVision(formData: FormData): Promise<VisionResult> {
  const imageBase64 = formData.get("imageBase64") as string | null;
  const mimeType = (formData.get("mimeType") as string | null) ?? "image/jpeg";
  const taskHint = (formData.get("taskHint") as string | null) ?? "";

  if (imageBase64) {
    return analyzeImage(imageBase64, mimeType, taskHint);
  }

  // 旧路径：通过 gateway 上传文件
  return {
    description: "当前是视觉接口预留阶段，首轮原型暂未启用真实图像理解。",
    fallbackUsed: true,
  };
}
