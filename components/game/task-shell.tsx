"use client";

import type { ReactNode } from "react";

export function TaskShell({
  title,
  subtitle,
  children,
  footer,
  focusMode = false,
  showHeader = true,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  focusMode?: boolean;
  showHeader?: boolean;
}) {
  return (
    <section className="storybook-card sunrise-panel relative overflow-hidden rounded-[32px] px-4 py-4 md:px-6 md:py-6">
      <div className="absolute right-6 top-4 h-20 w-20 rounded-full bg-white/30 blur-2xl" />
      <div className="relative">
        {showHeader ? (
          <div className={`${focusMode ? "mb-4" : "mb-5"} flex items-start justify-between gap-4`}>
            <div className="max-w-3xl">
              <p className="section-kicker">{focusMode ? "马上开始" : "任务进行中"}</p>
              <h2
                className={`font-semibold tracking-tight ${
                  focusMode ? "mt-2 text-xl md:text-2xl" : "mt-3 text-2xl md:text-[2rem]"
                }`}
              >
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{subtitle}</p>
            </div>
          </div>
        ) : null}
        <div className="space-y-4">{children}</div>
        {footer ? <div className="ambient-divider mt-5 pt-4">{footer}</div> : null}
      </div>
    </section>
  );
}
