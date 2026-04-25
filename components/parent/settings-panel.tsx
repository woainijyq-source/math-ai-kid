"use client";

import { useEffect, useState } from "react";

const TOGGLE_OPTIONS = [
  {
    title: "启用语音入口",
    detail: "保留更自然的短句输入，减少长文本阻力。",
    enabled: true,
  },
  {
    title: "显示世界变化提示",
    detail: "让孩子在结果页和首页都能看见变化痕迹。",
    enabled: true,
  },
  {
    title: "预留摄像头入口",
    detail: "阶段 1 只保留开关，不默认进入真实视觉玩法。",
    enabled: false,
  },
];

const VOICE_OPTIONS = [
  { value: "zh_female_xiaohe_uranus_bigtts", label: "小荷", desc: "自然清亮，适合林老师主音色" },
  { value: "zh_female_tianmeixiaoyuan_uranus_bigtts", label: "甜美校园", desc: "活泼轻快，适合互动" },
  { value: "zh_female_vv_uranus_bigtts", label: "VV", desc: "更有节奏感，适合追问" },
  { value: "zh_female_shuangkuaisisi_uranus_bigtts", label: "爽快思思", desc: "表达清楚，适合讲故事" },
  { value: "zh_female_cancan_uranus_bigtts", label: "灿灿", desc: "温和稳定，适合家长视角" },
];

type ChatProviderId = "deepseek" | "qwen";

interface ChatProviderOption {
  value: ChatProviderId;
  label: string;
  description: string;
  model: string;
  configured: boolean;
}

const FALLBACK_PROVIDER_OPTIONS: ChatProviderOption[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    description: "更稳的文字对话主链路，适合当前训练回合。",
    model: "deepseek-chat",
    configured: true,
  },
  {
    value: "qwen",
    label: "Qwen",
    description: "一键切回千问，保留现有语音能力和备用主链路。",
    model: "qwen3.6-plus",
    configured: true,
  },
];

type SaveField = "voice" | "model" | null;

interface ParentSettingsResponse {
  voice?: string;
  chatProvider?: ChatProviderId;
  providers?: ChatProviderOption[];
}

function normalizeProviders(value: unknown): ChatProviderOption[] {
  if (!Array.isArray(value)) return FALLBACK_PROVIDER_OPTIONS;
  const normalized = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<ChatProviderOption>;
      if (candidate.value !== "deepseek" && candidate.value !== "qwen") return null;
      return {
        value: candidate.value,
        label: typeof candidate.label === "string" ? candidate.label : candidate.value,
        description: typeof candidate.description === "string" ? candidate.description : "",
        model: typeof candidate.model === "string" ? candidate.model : "",
        configured: Boolean(candidate.configured),
      } satisfies ChatProviderOption;
    })
    .filter((item): item is ChatProviderOption => Boolean(item));

  return normalized.length > 0 ? normalized : FALLBACK_PROVIDER_OPTIONS;
}

export function SettingsPanel() {
  const [voice, setVoice] = useState("zh_female_xiaohe_uranus_bigtts");
  const [chatProvider, setChatProvider] = useState<ChatProviderId>("deepseek");
  const [providers, setProviders] = useState<ChatProviderOption[]>(FALLBACK_PROVIDER_OPTIONS);
  const [savingField, setSavingField] = useState<SaveField>(null);
  const [savedField, setSavedField] = useState<SaveField>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/parent/settings")
      .then((response) => response.json())
      .then((data: ParentSettingsResponse) => {
        if (data.voice) setVoice(data.voice);
        if (data.chatProvider === "deepseek" || data.chatProvider === "qwen") {
          setChatProvider(data.chatProvider);
        }
        setProviders(normalizeProviders(data.providers));
      })
      .catch(() => {});
  }, []);

  async function saveSettings(payload: Record<string, string>, field: Exclude<SaveField, null>) {
    setSavingField(field);
    setSavedField(null);
    setError(null);

    try {
      const response = await fetch("/api/parent/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as ParentSettingsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "save_failed");
      }

      if (data.voice) setVoice(data.voice);
      if (data.chatProvider === "deepseek" || data.chatProvider === "qwen") {
        setChatProvider(data.chatProvider);
      }
      setProviders(normalizeProviders(data.providers));
      setSavedField(field);
      window.setTimeout(() => setSavedField((current) => (current === field ? null : current)), 2000);
      return true;
    } catch (saveError) {
      setError(
        field === "model"
          ? "主模型切换失败，请确认当前配置可用。"
          : "音色保存失败，请稍后再试。",
      );
      console.error("[parent.settings] save failed", saveError);
      return false;
    } finally {
      setSavingField(null);
    }
  }

  async function handleVoiceChange(nextVoice: string) {
    const previousVoice = voice;
    setVoice(nextVoice);
    const ok = await saveSettings({ voice: nextVoice }, "voice");
    if (!ok) setVoice(previousVoice);
  }

  async function handleChatProviderChange(nextProvider: ChatProviderId) {
    if (nextProvider === chatProvider) return;
    const previousProvider = chatProvider;
    setChatProvider(nextProvider);
    const ok = await saveSettings({ chatProvider: nextProvider }, "model");
    if (!ok) setChatProvider(previousProvider);
  }

  const activeProvider =
    providers.find((provider) => provider.value === chatProvider) ??
    FALLBACK_PROVIDER_OPTIONS[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="bp-panel rounded-[34px] p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-kicker">文字主模型</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                这里只切换文字对话和训练判断，真人语音链路保持原样。
              </p>
            </div>
            {savingField === "model" && <span className="animate-pulse text-xs text-ink-soft">切换中…</span>}
            {savedField === "model" && <span className="text-xs text-green-600">✓ 已切换</span>}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {providers.map((provider) => (
              <button
                key={provider.value}
                type="button"
                disabled={!provider.configured || savingField === "model"}
                onClick={() => handleChatProviderChange(provider.value)}
                className={`rounded-[24px] border px-4 py-4 text-left shadow-sm transition ${
                  chatProvider === provider.value
                    ? "border-2 border-accent bg-accent/10"
                    : "border-white/70 bg-white/68 hover:border-accent/50"
                } ${!provider.configured ? "cursor-not-allowed opacity-55" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    chatProvider === provider.value
                      ? "bg-accent text-white"
                      : provider.configured
                        ? "bg-slate-100 text-slate-600"
                        : "bg-rose-50 text-rose-600"
                  }`}>
                    {chatProvider === provider.value ? "当前" : provider.configured ? "可切换" : "未配置"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-soft">{provider.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                  <span>模型 {provider.model}</span>
                  <span>{provider.configured ? "已预置" : "缺少 key"}</span>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            当前文字主模型：{activeProvider.label} / {activeProvider.model}。切换后新的文字回合立即生效，无需重复配置。
          </p>
        </div>

        <div className="bp-panel rounded-[34px] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <p className="section-kicker">林老师语音音色</p>
            {savingField === "voice" && <span className="animate-pulse text-xs text-ink-soft">保存中…</span>}
            {savedField === "voice" && <span className="text-xs text-green-600">✓ 已保存</span>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VOICE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleVoiceChange(opt.value)}
                className={`flex items-center gap-3 rounded-[24px] px-4 py-3 text-left shadow-sm transition ${
                  voice === opt.value
                    ? "border-2 border-accent bg-accent/10"
                    : "border border-white/70 bg-white/68 hover:border-accent/50"
                }`}
              >
                <span className="text-2xl">{voice === opt.value ? "🔊" : "🔈"}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="text-xs text-ink-soft">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">修改后下次对话生效（无需重启）</p>
        </div>

        <div className="bp-panel rounded-[34px] p-4 md:p-5">
          <p className="section-kicker">原型设置</p>
          <div className="mt-4 space-y-3">
            {TOGGLE_OPTIONS.map((option) => (
              <label
                key={option.title}
                className="bp-muted-card flex items-center justify-between gap-4 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{option.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{option.detail}</p>
                </div>
                <input defaultChecked={option.enabled} type="checkbox" className="h-4 w-4" />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="bp-panel rounded-[34px] p-4 md:p-5">
        <p className="section-kicker">当前说明</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">
          <p>阶段 1 只保留最小设置，不提前堆复杂的家长控制系统。</p>
          <p>文字主模型支持一键在 DeepSeek 和 Qwen 间切换，不需要重新填写 key。</p>
          <p>音色修改后无需重启，下次对话自动生效。</p>
          <p>语音识别、语音播报和实时语音链路不受这个模型开关影响。</p>
        </div>
      </div>
    </div>
  );
}
