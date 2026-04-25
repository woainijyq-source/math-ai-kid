import { NextResponse } from "next/server";
import {
  getParentSettings,
  isChatProviderConfigured,
  listChatProviderOptions,
  saveParentSettings,
  type ChatProviderName,
} from "@/lib/server/parent-settings";

function buildResponse() {
  const settings = getParentSettings();
  const providers = listChatProviderOptions();
  const activeProvider = providers.find((item) => item.value === settings.chatProvider) ?? providers[0];

  return {
    voice: settings.voice,
    chatProvider: settings.chatProvider,
    chatModel: activeProvider?.model ?? null,
    providers,
  };
}

export async function GET() {
  return NextResponse.json(buildResponse());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    voice?: string;
    chatProvider?: ChatProviderName;
  };

  const nextSettings: {
    voice?: string;
    chatProvider?: ChatProviderName;
  } = {};

  if (typeof body.voice === "string") {
    nextSettings.voice = body.voice;
  }

  if (body.chatProvider === "deepseek" || body.chatProvider === "qwen") {
    if (!isChatProviderConfigured(body.chatProvider)) {
      return NextResponse.json(
        { error: "chat_provider_not_configured", chatProvider: body.chatProvider },
        { status: 400 },
      );
    }
    nextSettings.chatProvider = body.chatProvider;
  }

  saveParentSettings(nextSettings);

  const response = buildResponse();
  console.info("[parent/settings] updated", {
    voice: response.voice,
    chatProvider: response.chatProvider,
    chatModel: response.chatModel,
  });

  return NextResponse.json({
    ok: true,
    ...response,
  });
}
