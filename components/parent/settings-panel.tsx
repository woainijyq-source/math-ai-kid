"use client";

import { useState, useEffect } from "react";

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
  { value: "Mia",    label: "Mia",    desc: "亲切温暖，适合引导" },
  { value: "Cherry", label: "Cherry", desc: "温暖故事感，适合叙事" },
  { value: "Mochi",  label: "Mochi",  desc: "活泼俏皮，适合互动" },
  { value: "Moon",   label: "Moon",   desc: "中性沉稳，适合挑战" },
  { value: "Maia",   label: "Maia",   desc: "成熟可靠，适合家长" },
];

export function SettingsPanel() {
  const [voice, setVoice] = useState("Mia");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 读取当前音色配置
  useEffect(() => {
    fetch("/api/parent/settings")
      .then((r) => r.json())
      .then((d) => { if (d.voice) setVoice(d.voice); })
      .catch(() => {});
  }, []);

  async function handleVoiceChange(v: string) {
    setVoice(v);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/parent/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: v }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // 静默失败
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        {/* 音色设置 */}
        <div className="storybook-card sunrise-panel rounded-[28px] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <p className="section-kicker">脑脑语音音色</p>
            {saving && <span className="text-xs text-ink-soft animate-pulse">保存中…</span>}
            {saved && <span className="text-xs text-green-600">✓ 已保存</span>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VOICE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleVoiceChange(opt.value)}
                className={`metric-pill flex items-center gap-3 rounded-[20px] px-4 py-3 text-left transition ${
                  voice === opt.value
                    ? "border-2 border-accent bg-accent/10"
                    : "border border-border hover:border-accent/50"
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

        {/* 原型设置 */}
        <div className="storybook-card sunrise-panel rounded-[28px] p-4 md:p-5">
          <p className="section-kicker">原型设置</p>
          <div className="mt-4 space-y-3">
            {TOGGLE_OPTIONS.map((option) => (
              <label
                key={option.title}
                className="metric-pill flex items-center justify-between gap-4 rounded-[24px] px-4 py-4"
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
      </div>

      <div className="storybook-card rounded-[28px] p-4 md:p-5">
        <p className="section-kicker">当前说明</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-ink-soft">
          <p>阶段 1 只保留最小设置，不提前堆复杂的家长控制系统。</p>
          <p>这一页的目的主要是帮助后续确认哪些开关需要进正式版。</p>
          <p>音色修改后无需重启，下次对话自动生效。</p>
        </div>
      </div>
    </div>
  );
}
