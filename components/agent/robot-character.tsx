"use client";
/**
 * TE.2 — RobotCharacter 组件
 * 使用 Framer Motion 动画展示机器人角色，支持 5 种表情和说话状态。
 */

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export type RobotMood = "happy" | "thinking" | "surprised" | "encouraging" | "playful";
export type RobotSize = "small" | "medium" | "large";

interface RobotCharacterProps {
  mood: RobotMood;
  isSpeaking: boolean;
  size?: RobotSize;
}

const SIZE_MAP: Record<RobotSize, { px: number; cls: string }> = {
  small:  { px: 80,  cls: "w-20 h-20" },
  medium: { px: 160, cls: "w-40 h-40" },
  large:  { px: 240, cls: "w-60 h-60" },
};

export function RobotCharacter({ mood, isSpeaking, size = "medium" }: RobotCharacterProps) {
  const { px, cls } = SIZE_MAP[size];

  return (
    <div className={`relative flex flex-col items-center ${cls}`}>
      {/* 待机浮动 */}
      <motion.div
        className="relative w-full h-full"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* 思考时头顶问号 */}
        <AnimatePresence>
          {mood === "thinking" && (
            <motion.span
              key="question"
              className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg select-none"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: [0, -4, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ❓
            </motion.span>
          )}
        </AnimatePresence>

        {/* 开心说话时粒子 */}
        <AnimatePresence>
          {mood === "happy" && isSpeaking && (
            <>
              {["✨", "⭐", "✨"].map((star, i) => (
                <motion.span
                  key={`star-${i}`}
                  className="absolute text-sm select-none pointer-events-none"
                  style={{ left: `${20 + i * 30}%`, top: "-8px" }}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -24 }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                >
                  {star}
                </motion.span>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* 表情切换 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mood}
            className="w-full h-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            {/* 眨眼动画 */}
            <motion.div
              className="w-full h-full"
              animate={{ opacity: [1, 1, 0, 1, 1] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                times: [0, 0.45, 0.47, 0.49, 1],
                repeatDelay: 2,
              }}
            >
              <Image
                src={`/illustrations/character/robot-${mood}.png`}
                alt={`脑脑-${mood}`}
                width={px}
                height={px}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/illustrations/character/brainy-happy.png";
                }}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* 说话脉冲指示器 */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="pulse"
            className="mt-1 h-1.5 w-10 rounded-full bg-accent"
            initial={{ opacity: 0, scaleX: 1 }}
            animate={{ opacity: 1, scaleX: [1, 1.3, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
