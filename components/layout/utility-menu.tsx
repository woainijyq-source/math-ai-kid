"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const utilityItems = [
  { href: "/rewards", label: "奖励变化", description: "查看身份、权限和世界变化" },
  { href: "/parent", label: "家长观察", description: "看试玩摘要和观察记录" },
  { href: "/playtest", label: "试玩记录", description: "记录内部试玩发现" },
];

export function UtilityMenu() {
  const pathname = usePathname();

  return (
    <details className="group relative z-[90]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-white/86 px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
        更多
        <span className="text-xs text-ink-soft transition group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute top-[calc(100%+10px)] right-0 z-[100] w-80 rounded-[24px] border border-border bg-white/98 p-3 shadow-2xl backdrop-blur">
        <div className="space-y-2">
          {utilityItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-[18px] px-4 py-3 transition ${
                  active ? "bg-accent-soft" : "hover:bg-surface-strong"
                }`}
              >
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </details>
  );
}
