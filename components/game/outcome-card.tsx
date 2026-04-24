"use client";

export function OutcomeCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="bp-panel rounded-[30px] px-4 py-4">
      <p className="section-kicker">当前回合反馈</p>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{detail}</p>
    </div>
  );
}
