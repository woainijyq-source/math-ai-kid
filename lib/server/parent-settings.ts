import fs from "node:fs";
import path from "node:path";
import { readLocalEnvValue } from "./local-env";

export type ChatProviderName = "deepseek" | "qwen";

export interface ParentSettingsState {
  voice: string;
  chatProvider: ChatProviderName;
}

export interface ChatProviderOption {
  value: ChatProviderName;
  label: string;
  description: string;
  model: string;
  configured: boolean;
}

const SETTINGS_DIR = path.join(process.cwd(), ".data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "parent-settings.json");
const DEFAULT_VOICE = "zh_female_xiaohe_uranus_bigtts";
const VALID_VOICES = [
  "zh_female_xiaohe_uranus_bigtts",
  "zh_female_tianmeixiaoyuan_uranus_bigtts",
  "zh_female_vv_uranus_bigtts",
  "zh_female_shuangkuaisisi_uranus_bigtts",
  "zh_female_cancan_uranus_bigtts",
  "Mia",
  "Cherry",
  "Mochi",
  "Moon",
  "Maia",
] as const;

const LEGACY_VOICE_MAP: Record<string, (typeof VALID_VOICES)[number]> = {
  Mia: "zh_female_xiaohe_uranus_bigtts",
  Cherry: "zh_female_shuangkuaisisi_uranus_bigtts",
  Mochi: "zh_female_tianmeixiaoyuan_uranus_bigtts",
  Moon: "zh_female_vv_uranus_bigtts",
  Maia: "zh_female_cancan_uranus_bigtts",
  zh_female_kailangjiejie_moon_bigtts: "zh_female_xiaohe_uranus_bigtts",
  zh_female_linjianvhai_moon_bigtts: "zh_female_shuangkuaisisi_uranus_bigtts",
  zh_female_tianmeixiaoyuan_moon_bigtts: "zh_female_tianmeixiaoyuan_uranus_bigtts",
  zh_female_yuanqinvyou_moon_bigtts: "zh_female_vv_uranus_bigtts",
  zh_female_wanwanxiaohe_moon_bigtts: "zh_female_cancan_uranus_bigtts",
};

function normalizeVoiceValue(value: string) {
  const trimmed = value.trim();
  if (LEGACY_VOICE_MAP[trimmed]) {
    return LEGACY_VOICE_MAP[trimmed];
  }

  return VALID_VOICES.includes(trimmed as (typeof VALID_VOICES)[number])
    ? trimmed
    : DEFAULT_VOICE;
}

function getDefaultVoice() {
  return normalizeVoiceValue(
    readLocalEnvValue("VOLCENGINE_TTS_VOICE") ||
    readLocalEnvValue("QWEN_TTS_VOICE_OVERRIDE") ||
    DEFAULT_VOICE
  );
}

function getDefaultChatProvider(): ChatProviderName {
  const requested = readLocalEnvValue("AI_CHAT_PROVIDER").toLowerCase();
  if (requested === "qwen") return "qwen";
  if (requested === "deepseek") return "deepseek";
  if (readLocalEnvValue("DEEPSEEK_API_KEY")) return "deepseek";
  return "qwen";
}

function sanitizeVoice(value: unknown) {
  if (typeof value !== "string") return getDefaultVoice();
  return normalizeVoiceValue(value);
}

function sanitizeChatProvider(value: unknown): ChatProviderName {
  return value === "qwen" ? "qwen" : "deepseek";
}

function ensureSettingsDir() {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
}

function syncRuntimeEnv(settings: ParentSettingsState) {
  process.env.VOLCENGINE_TTS_VOICE = settings.voice;
  process.env.QWEN_TTS_VOICE_OVERRIDE = settings.voice;
  process.env.AI_CHAT_PROVIDER = settings.chatProvider;
}

function readSettingsFile(): Partial<ParentSettingsState> {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ParentSettingsState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildSettings(partial?: Partial<ParentSettingsState>): ParentSettingsState {
  return {
    voice: sanitizeVoice(partial?.voice),
    chatProvider: sanitizeChatProvider(partial?.chatProvider ?? getDefaultChatProvider()),
  };
}

export function getParentSettings(): ParentSettingsState {
  const settings = buildSettings(readSettingsFile());
  syncRuntimeEnv(settings);
  return settings;
}

export function saveParentSettings(nextPartial: Partial<ParentSettingsState>) {
  const current = getParentSettings();
  const next = buildSettings({
    ...current,
    ...nextPartial,
  });
  ensureSettingsDir();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  syncRuntimeEnv(next);
  return next;
}

function getDeepSeekModel() {
  return readLocalEnvValue("DEEPSEEK_MODEL") || "deepseek-chat";
}

function getQwenModel() {
  return readLocalEnvValue("QWEN_MODEL") || "qwen3.6-plus";
}

export function isChatProviderConfigured(provider: ChatProviderName) {
  if (provider === "deepseek") {
    return Boolean(readLocalEnvValue("DEEPSEEK_API_KEY"));
  }

  return Boolean(readLocalEnvValue("QWEN_API_KEY"));
}

export function listChatProviderOptions(): ChatProviderOption[] {
  return [
    {
      value: "deepseek",
      label: "DeepSeek",
      description: "更稳的文字对话主链路，适合当前训练回合。",
      model: getDeepSeekModel(),
      configured: isChatProviderConfigured("deepseek"),
    },
    {
      value: "qwen",
      label: "Qwen",
      description: "一键切回千问，保留现有语音能力和备用主链路。",
      model: getQwenModel(),
      configured: isChatProviderConfigured("qwen"),
    },
  ];
}
