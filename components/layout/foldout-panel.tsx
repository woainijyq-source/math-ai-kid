"use client";

import type { ReactNode } from "react";

export function FoldoutPanel({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="bp-panel group rounded-[28px] p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <p className="section-kicker">{title}</p>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-white/70 bg-white/72 px-3 py-1 text-xs font-semibold text-ink-soft transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="ambient-divider mt-4 pt-4">{children}</div>
    </details>
  );
}
