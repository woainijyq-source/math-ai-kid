"use client";

export function WeeklyInsightCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="storybook-card rounded-[28px] p-4 md:p-5">
      <p className="section-kicker">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-[20px] bg-white/78 px-4 py-3 text-sm leading-6 text-ink-soft shadow-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
