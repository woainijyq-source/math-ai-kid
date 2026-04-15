"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { GOAL_READINESS } from "@/lib/training/domain-pedagogy";
import { useIsClient } from "@/hooks/use-is-client";
import { useAgentStore } from "@/store/agent-store";
import { useProfileStore } from "@/store/profile-store";
import type { GoalId } from "@/types/goals";

const GOAL_CARDS: Array<{
  id: GoalId;
  label: string;
  emoji: string;
  icon: string;
  desc: string;
}> = [
  { id: "math-thinking", label: "数学思维", emoji: "🔢", icon: "/illustrations/icons/math-thinking.png", desc: "发现模式、数量和策略" },
  { id: "logical-reasoning", label: "逻辑推理", emoji: "🧩", icon: "/illustrations/icons/logical-reasoning.png", desc: "条件、排除和链式推理" },
  { id: "creative-thinking", label: "创意思维", emoji: "💡", icon: "/illustrations/icons/creative-thinking.png", desc: "生成、比较和改进想法" },
  { id: "language-thinking", label: "语言表达", emoji: "🗣", icon: "/illustrations/icons/language-thinking.png", desc: "把观察和理由说清楚" },
  { id: "strategy-thinking", label: "策略博弈", emoji: "♟️", icon: "/illustrations/icons/strategy-thinking.png", desc: "预测、行动和复盘" },
  { id: "observation-induction", label: "观察归纳", emoji: "🔎", icon: "/illustrations/icons/observation-induction.png", desc: "观察、归类和迁移" },
];

function readinessLabel(goalId: GoalId) {
  switch (GOAL_READINESS[goalId]) {
    case "ready":
      return "已闭环";
    case "pilot":
      return "试运行";
    default:
      return "建设中";
  }
}

function readinessClass(goalId: GoalId) {
  switch (GOAL_READINESS[goalId]) {
    case "ready":
      return "bg-emerald-50 text-emerald-700";
    case "pilot":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function HomePage() {
  const activeProfile = useProfileStore((state) => state.getActiveProfile());
  const profiles = useProfileStore((state) => state.profiles);
  const { sessionId } = useAgentStore();
  const isClient = useIsClient();

  const profile = isClient ? activeProfile : null;
  const hasSession = isClient ? Boolean(sessionId) : false;
  const profileCount = isClient ? profiles.length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF7ED] to-[#F3E8FF]">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/illustrations/character/robot-happy.png"
            alt="脑脑"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-lg font-bold text-foreground">BrainPlay</span>
        </div>
        <div className="flex items-center gap-3">
          {profile && <span className="text-sm text-ink-soft">{profile.nickname}</span>}
          <Link
            href="/parent"
            className="rounded-full border border-border bg-white px-4 py-2 text-sm text-ink-soft hover:bg-accent-soft"
          >
            家长
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex items-center gap-6 rounded-3xl bg-white/80 p-6 shadow-sm backdrop-blur-sm"
        >
          <Image
            src="/illustrations/character/robot-encouraging.png"
            alt="脑脑"
            width={80}
            height={80}
            className="flex-shrink-0 rounded-2xl"
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile ? `${profile.nickname}，今天练什么？` : "你好，我是脑脑"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {profile
                ? (hasSession ? "上次的训练还在，或者重新选一条线。" : "选一条训练线，开始今天的挑战。")
                : "选一个方向，和我一起做思维训练。"}
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              首页会诚实显示每条训练线当前的闭环状态，不再把所有方向都假装成同等成熟。
            </p>
          </div>
        </motion.section>

        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">选择训练方向</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {GOAL_CARDS.map((goal, index) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * index }}
              >
                <Link
                  href={`/session?goal=${goal.id}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-accent hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="relative h-14 w-14">
                      <Image
                        src={goal.icon}
                        alt={goal.label}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${readinessClass(goal.id)}`}>
                      {readinessLabel(goal.id)}
                    </span>
                  </div>
                  <span className="mt-3 text-sm font-semibold text-foreground">{goal.label}</span>
                  <span className="mt-1 text-xs text-ink-soft">{goal.desc}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center gap-3"
        >
          <Link
            href="/session"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-accent/90 hover:shadow-xl"
          >
            🎯 {hasSession ? "继续训练" : "随便玩玩"}
          </Link>
          {profileCount > 1 && (
            <p className="text-xs text-ink-soft">当前档案：{profile?.nickname ?? "未选择"}</p>
          )}
        </motion.section>
      </main>
    </div>
  );
}
