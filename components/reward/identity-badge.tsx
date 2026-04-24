"use client";

export function IdentityBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white/78 px-4 py-2 text-sm font-black text-accent shadow-sm">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-black text-white">
        ID
      </span>
      现在更像：{label}
    </div>
  );
}
