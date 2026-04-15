"use client";
/**
 * 奖励页（重写）
 * 去掉旧的 session-store/world-store 依赖，改用 agent-store + profile-store。
 */

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";

export default function RewardsPage() {
  const activeProfile = useProfileStore((s) => s.getActiveProfile());
  const { activeToolCalls } = useAgentStore();

  // 从最近的 award_badge tool calls 中提取徽章
  const badges = activeToolCalls
    .filter((tc) => tc.name === "award_badge")
    .map((tc) => (tc.arguments as { badgeId?: string; title?: string; detail?: string }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7]">
      <header className="flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 backdrop-blur-sm">
        <h1 className="text-lg font-bold text-foreground">成长与变化</h1>
        <Link href="/" className="text-sm text-accent underline">返回首页</Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <Image
            src="/illustrations/character/brainy-encouraging.png"
            alt="脑脑鼓励"
            width={120}
            height={120}
            className="rounded-3xl"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />

          {activeProfile && (
            <p className="text-xl font-bold text-foreground">
              {activeProfile.nickname}，做得很棒！
            </p>
          )}

          {badges.length > 0 ? (
            <section className="w-full space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">获得的徽章</p>
              {badges.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <Image
                    src="/illustrations/icons/badge-star.png"
                    alt="徽章"
                    width={48}
                    height={48}
                    className="flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div>
                    <p className="font-semibold text-amber-800">{b.title ?? "成就徽章"}</p>
                    <p className="text-sm text-amber-700">{b.detail ?? ""}</p>
                  </div>
                </motion.div>
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-6 text-center">
              <p className="text-sm text-ink-soft">还没有徽章，去和脑脑互动解锁吧！</p>
              <Link
                href="/session"
                className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white"
              >
                开始互动
              </Link>
            </div>
          )}

          <Link
            href="/session"
            className="mt-4 rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-foreground hover:bg-accent-soft"
          >
            继续互动
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
