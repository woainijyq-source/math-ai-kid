import { postGatewayForm } from "@/lib/ai/gateway";
import { canUseAliyunNlsStt, runAliyunNlsStt } from "@/lib/ai/aliyun-nls-stt";
import { isSttResponsePayload } from "@/lib/ai/validators";
import type { SttResponsePayload } from "@/types";

export async function runStt(_mode: string, formData: FormData): Promise<SttResponsePayload> {
  const audio = formData.get("audio");

  if (audio instanceof File && canUseAliyunNlsStt()) {
    try {
      return await runAliyunNlsStt(audio);
    } catch (error) {
      console.warn("[stt] aliyun-nls failed, trying gateway", error instanceof Error ? error.message : error);
    }
  }

  const response = await postGatewayForm<SttResponsePayload>("stt", formData);
  if (response && isSttResponsePayload(response)) {
    return response;
  }

  return {
    transcript: "",
    confidence: 0,
    fallbackUsed: true,
  };
}
