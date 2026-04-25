import { postGatewayForm } from "@/lib/ai/gateway";
import { canUseAliyunNlsStt, runAliyunNlsStt } from "@/lib/ai/aliyun-nls-stt";
import { canUseVolcengineAsr, runVolcengineAsr } from "@/lib/ai/volcengine-asr";
import { isSttResponsePayload } from "@/lib/ai/validators";
import { readLocalEnvValue } from "@/lib/server/local-env";
import type { SttResponsePayload } from "@/types";

function getSttProviderOrder() {
  const configured = readLocalEnvValue("STT_PROVIDER_ORDER")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : ["volcengine-asr", "aliyun-nls", "gateway"];
}

export async function runStt(_mode: string, formData: FormData): Promise<SttResponsePayload> {
  const audio = formData.get("audio");

  for (const provider of getSttProviderOrder()) {
    if (provider === "gateway") {
      const response = await postGatewayForm<SttResponsePayload>("stt", formData);
      if (response && isSttResponsePayload(response)) {
        return response;
      }
      continue;
    }

    if (!(audio instanceof File)) {
      continue;
    }

    try {
      if (provider === "volcengine-asr" && canUseVolcengineAsr()) {
        return await runVolcengineAsr(audio);
      }

      if (provider === "aliyun-nls" && canUseAliyunNlsStt()) {
        return await runAliyunNlsStt(audio);
      }
    } catch (error) {
      console.warn("[stt] provider failed, trying next provider", {
        provider,
        message: error instanceof Error ? error.message : error,
      });
    }
  }

  return {
    transcript: "",
    confidence: 0,
    fallbackUsed: true,
  };
}
