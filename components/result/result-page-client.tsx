"use client";
/**
 * T7.1 — result-page-client 重写
 * 旧版依赖已删除的 session-store，改为简单的完成页。
 */

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";

export function ResultPageClient() {
  const activeProfile = useProfileStore((s) => s.getActiveProfile());
  const { activeToolCalls } = useAgentStore();

  const endActivity = activeToolCalls
    .filter((tc) => tc.name === "end_activity")
    .map((tc) => (tc.arguments as { summary?: string; completionRate?: number }))
    .at(-1);

  return (
    <div className="brainplay-page flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bp-panel w-full max-w-sm space-y-6 rounded-[40px] p-7 text-center"
      >
        <Image
          src="/illustrations/character/brainy-encouraging.png"
          alt="脑脑鼓励"
          width={120}
          height={120}
          className="mx-auto rounded-3xl"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <h1 className="text-2xl font-bold text-foreground">
          {activeProfile ? `${activeProfile.nickname}，做得棒！` : "很棒！"}
        </h1>
        {endActivity?.summary && (
          <p className="text-sm text-ink-soft">{endActivity.summary}</p>
        )}
        {typeof endActivity?.completionRate === "number" && (
          <div className="mx-auto w-48">
            <div className="mb-1 flex justify-between text-xs text-ink-soft">
              <span>今天先收到这里</span>
              <span>{endActivity.completionRate}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${endActivity.completionRate}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/session"
            className="bp-button-primary px-6 py-3 text-sm"
          >
            再聊一个小问题
          </Link>
          <Link
            href="/rewards"
            className="bp-button-secondary px-6 py-3 text-sm"
          >
            查看成长
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
