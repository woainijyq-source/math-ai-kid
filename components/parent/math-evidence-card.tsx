"use client";

export function MathEvidenceCard({
  focus,
  moves,
  aiFocus,
}: {
  focus?: string;
  moves: string[];
  aiFocus: string[];
}) {
  return (
    <div className="storybook-card sunrise-panel rounded-[28px] p-4 md:p-5">
      <p className="section-kicker">数学思维证据</p>
      <p className="mt-4 text-lg font-semibold text-foreground">
        {focus ?? "等待一轮真实试玩后显示"}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            孩子实际用到的思路
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {moves.length > 0 ? (
              moves.map((move) => (
                <span
                  key={move}
                  className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-accent-strong shadow-sm"
                >
                  {move}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-ink-soft shadow-sm">
                暂无记录
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            AI 正在观察什么
          </p>
          <div className="mt-3 space-y-2">
            {aiFocus.length > 0 ? (
              aiFocus.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] bg-white/80 px-4 py-3 text-sm leading-6 text-ink-soft shadow-sm"
                >
                  {item}
                </div>
              ))
            ) : (
              <div className="rounded-[18px] bg-white/80 px-4 py-3 text-sm leading-6 text-ink-soft shadow-sm">
                等待这一轮试玩完成后生成观察点。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
