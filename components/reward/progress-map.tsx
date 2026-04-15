"use client";
/**
 * T7.1 — ProgressMap 重写
 * 去掉旧 content/scenes 依赖，改为通用进度展示。
 */

export function ProgressMap({
  zone,
  unlockedAreas,
  visitedStorySceneIds = [],
}: {
  zone?: string;
  unlockedAreas?: string[];
  visitedStorySceneIds?: string[];
}) {
  const areas = unlockedAreas ?? [];
  const visited = visitedStorySceneIds.length;

  return (
    <div className="storybook-card sunrise-panel rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker">成长地图</p>
          {zone && <p className="mt-2 text-sm text-ink-soft">当前区域：{zone}</p>}
        </div>
        {visited > 0 && (
          <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-accent shadow-sm">
            已完成 {visited} 轮
          </span>
        )}
      </div>

      {areas.length > 0 && (
        <div className="mt-4 rounded-[24px] border border-accent/12 bg-white/78 px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">已解锁区域</p>
          <div className="mt-3 space-y-2">
            {areas.map((area, index) => (
              <div
                key={area}
                className={`flex items-center gap-3 rounded-[20px] px-3 py-3 ${
                  area === zone ? "bg-accent-soft/70" : "bg-[#fffdf8]"
                }`}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{area}</p>
                  <p className="text-xs text-ink-soft">
                    {area === zone ? "你现在就在这里。" : "已解锁"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {areas.length === 0 && (
        <p className="mt-4 text-sm text-ink-soft">和脑脑互动后，这里会显示你的成长轨迹。</p>
      )}
    </div>
  );
}
