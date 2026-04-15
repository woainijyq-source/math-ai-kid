"use client";
/**
 * T7.1 — playtest page 重写
 * 旧版依赖已删除的 playtest-log-store + session-store，简化为重定向页。
 */

import Link from "next/link";

export default function PlaytestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#FFF7ED] to-[#F3E8FF] px-4">
      <h1 className="text-xl font-bold text-foreground">试玩记录</h1>
      <p className="text-sm text-ink-soft">试玩记录功能已迁移到家长报告页。</p>
      <div className="flex gap-3">
        <Link
          href="/parent"
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white"
        >
          查看家长报告
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border bg-white px-5 py-2 text-sm text-foreground"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
