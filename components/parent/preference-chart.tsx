"use client";

import type { TaskMode } from "@/types";

const modeMeta: Array<{ mode: TaskMode; label: string; activeWidth: string }> = [
  { mode: "opponent", label: "策略对手", activeWidth: "76%" },
  { mode: "co-create", label: "规则共创", activeWidth: "62%" },
  { mode: "story", label: "剧情分支", activeWidth: "58%" },
];

export function PreferenceChart({ modes }: { modes: TaskMode[] }) {
  return (
    <div className="bp-panel rounded-[34px] p-4 md:p-5">
      <p className="section-kicker">最近偏好类型</p>
      <div className="mt-4 space-y-4">
        {modeMeta.map((item) => {
          const active = modes.includes(item.mode);

          return (
            <div key={item.mode} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-ink-soft">{active ? "当前更投入" : "等待更多记录"}</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/70 shadow-inner">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    active ? "bg-accent" : "bg-border"
                  }`}
                  style={{ width: active ? item.activeWidth : "32%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
