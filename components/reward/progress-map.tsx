"use client";

export interface ProgressMapNode {
  id: string;
  title: string;
  detail: string;
  status: "done" | "active" | "locked";
}

export function ProgressMap({
  title = "成长地图",
  subtitle,
  nodes,
}: {
  title?: string;
  subtitle?: string;
  nodes: ProgressMapNode[];
}) {
  return (
    <div className="storybook-card sunrise-panel rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker">{title}</p>
          {subtitle && <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {nodes.map((node, index) => {
          const statusClass = node.status === "done"
            ? "bg-emerald-50 border-emerald-200"
            : node.status === "active"
              ? "bg-amber-50 border-amber-200"
              : "bg-slate-50 border-border/70";
          const badgeClass = node.status === "done"
            ? "bg-emerald-500 text-white"
            : node.status === "active"
              ? "bg-amber-400 text-white"
              : "bg-slate-200 text-slate-600";
          const statusLabel = node.status === "done"
            ? "已亮起"
            : node.status === "active"
              ? "正在变亮"
              : "还没到这一步";

          return (
            <div key={node.id} className={`rounded-[22px] border p-4 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${badgeClass}`}>
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{node.title}</p>
                    <span className="text-[11px] font-semibold text-ink-soft">{statusLabel}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{node.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
