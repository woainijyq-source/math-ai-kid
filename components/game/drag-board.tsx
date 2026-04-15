"use client";

import type { InputMeta, InputType } from "@/types/agent";

export function DragBoard({
  selected,
  onSelect,
  fragments,
  prompt,
  submitLabel = "确认选择",
  onSubmit,
}: {
  selected: string[];
  onSelect: (fragment: string) => void;
  fragments?: string[];
  /** T5.4 新增：用于 universal-renderer 调用时显示的提示语 */
  prompt?: string;
  submitLabel?: string;
  /** T5.4 新增：选择完成后的回调，兼容 universal-renderer 的 onUserInput 签名 */
  onSubmit?: (input: string, type: InputType, meta?: InputMeta) => void;
}) {
  const items = fragments ?? [
    "先说明理由",
    "再行动",
    "每次只改一个规则",
    "输赢后都要复盘",
  ];

  function handleSubmit() {
    if (!onSubmit || selected.length === 0) return;
    onSubmit(selected.join("、"), "drag", { fragments: selected });
  }

  return (
    <div className="storybook-card sunrise-panel rounded-[28px] p-4">
      <p className="section-kicker">规则碎片板</p>
      <p className="mt-3 text-sm leading-6 text-ink-soft">
        {prompt ?? "先点选 1 到 2 个规则碎片，帮助孩子把想法说得更完整。"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((fragment) => {
          const active = selected.includes(fragment);

          return (
            <button
              key={fragment}
              type="button"
              onClick={() => onSelect(fragment)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-accent text-white shadow-sm"
                  : "border border-border bg-white hover:bg-accent-soft"
              }`}
            >
              {fragment}
            </button>
          );
        })}
      </div>
      {onSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selected.length === 0}
          className="mt-4 w-full rounded-2xl bg-accent py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitLabel}
        </button>
      )}
    </div>
  );
}
