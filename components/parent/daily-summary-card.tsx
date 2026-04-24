"use client";

export function DailySummaryCard({ text }: { text: string }) {
  return (
    <div className="bp-panel rounded-[34px] p-4 md:p-5">
      <p className="section-kicker">今日互动摘要</p>
      <p className="mt-4 text-sm leading-7 text-ink-soft md:text-base">{text}</p>
    </div>
  );
}
