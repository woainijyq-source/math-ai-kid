"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UtilityMenu } from "@/components/layout/utility-menu";

const navItems = [{ href: "/", label: "首页" }];

export function AppShell({
  title,
  subtitle,
  children,
  aside,
  compactHeader = false,
  showHeader = true,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
  compactHeader?: boolean;
  showHeader?: boolean;
}) {
  const pathname = usePathname();
  const hasAside = Boolean(aside);

  return (
    <div className="min-h-screen px-3 py-3 md:px-6 md:py-6">
      <div className="page-shell space-y-4 md:space-y-5">
        {showHeader ? (
          <header
            className={`storybook-card sunrise-panel grain relative z-40 overflow-visible px-5 md:px-8 ${
              compactHeader ? "py-4 md:py-5" : "py-5 md:py-7"
            }`}
          >
            <div className="absolute right-8 top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
            <div className="absolute -bottom-10 left-10 h-36 w-36 rounded-full bg-warm/10 blur-3xl" />

            <div
              className={`relative z-10 flex flex-col gap-4 ${
                compactHeader
                  ? "lg:flex-row lg:items-center lg:justify-between"
                  : "xl:flex-row xl:items-end xl:justify-between"
              }`}
            >
              <div className="max-w-3xl space-y-2">
                <div className="inline-flex rounded-full border border-accent/15 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-accent">
                  BrainPlay Prototype
                </div>
                <h1
                  className={`max-w-3xl font-semibold tracking-tight text-balance ${
                    compactHeader
                      ? "text-2xl md:text-3xl"
                      : "text-3xl md:text-4xl lg:text-[2.75rem]"
                  }`}
                >
                  {title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-ink-soft md:text-base">
                  {subtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <nav className="flex flex-wrap gap-2 rounded-full bg-white/70 p-1.5 shadow-sm">
                    {navItems.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            active
                              ? "bg-accent text-white shadow-sm"
                              : "text-ink-soft hover:bg-accent-soft"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <UtilityMenu />
                </div>

                {!compactHeader ? (
                  <div className="metric-pill inline-flex max-w-sm items-center gap-3 rounded-[22px] px-4 py-3 text-sm text-ink-soft">
                    <span className="float-up inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                      BP
                    </span>
                    <p className="leading-5">
                      iPad First 的试玩层。主场景先占住视线，设置和辅助入口都收进二级菜单。
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        ) : null}

        {hasAside ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-4">{children}</main>
            <aside className="space-y-4">{aside}</aside>
          </div>
        ) : (
          <main className="space-y-4">{children}</main>
        )}
      </div>
    </div>
  );
}
