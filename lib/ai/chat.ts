import { buildChatGatewayPayload } from "@/lib/ai/chat-gateway-payload";
import { postGatewayJson } from "@/lib/ai/gateway";
import { runQwenDirectChat } from "@/lib/ai/qwen-chat";
import { isChatResponsePayload } from "@/lib/ai/validators";
import type { ChatRequestPayload, ChatResponsePayload } from "@/types";

export interface ChatRunResult {
  response: ChatResponsePayload;
  source: "qwen-direct" | "gateway" | "mock";
  debug?: Record<string, unknown>;
}

export async function runChat(
  payload: ChatRequestPayload,
): Promise<ChatRunResult> {
  const gatewayPayload = buildChatGatewayPayload(payload);

  const qwenResult = await runQwenDirectChat(gatewayPayload);

  if (qwenResult.payload && isChatResponsePayload(qwenResult.payload)) {
    return {
      response: qwenResult.payload,
      source: "qwen-direct",
      debug: qwenResult.debug,
    };
  }

  const response = await postGatewayJson<ChatResponsePayload>("chat", gatewayPayload);

  if (response && isChatResponsePayload(response)) {
    return {
      response,
      source: "gateway",
      debug: qwenResult.debug,
    };
  }

  return {
    response: { messages: [], sessionPatch: {}, worldPatch: {}, rewardSignals: [] },
    source: "mock",
    debug: qwenResult.debug,
  };
}
