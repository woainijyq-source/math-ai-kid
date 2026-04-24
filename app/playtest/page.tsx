"use client";
/**
 * T7.1 — playtest page 重写
 * 旧版依赖已删除的 playtest-log-store + session-store，简化为重定向页。
 */

import Link from "next/link";

export default function PlaytestPage() {
  return (
    <div className="brainplay-page flex min-h-screen flex-col items-center justify-center px-4">
      <div className="bp-panel max-w-sm rounded-[40px] p-7 text-center">
        <p className="bp-kicker justify-center">Playtest</p>
        <h1 className="mt-3 text-xl font-black text-foreground">试玩记录</h1>
        <p className="mt-3 text-sm text-ink-soft">试玩记录功能已迁移到家长报告页。</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/parent"
            className="bp-button-primary px-5 py-2 text-sm"
          >
            查看家长报告
          </Link>
          <Link
            href="/"
            className="bp-button-secondary px-5 py-2 text-sm"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
