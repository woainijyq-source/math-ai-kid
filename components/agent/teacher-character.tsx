"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { AI_TEACHER_NAME } from "@/lib/agent/persona";

export type TeacherMood = "happy" | "thinking" | "surprised" | "encouraging" | "playful";
export type TeacherSize = "small" | "medium" | "large";

interface TeacherCharacterProps {
  mood: TeacherMood;
  isSpeaking: boolean;
  size?: TeacherSize;
}

const SIZE_MAP: Record<TeacherSize, { px: number; cls: string }> = {
  small: { px: 124, cls: "h-[124px] w-[124px]" },
  medium: { px: 176, cls: "h-44 w-44" },
  large: { px: 260, cls: "h-[260px] w-[260px]" },
};

export const TEACHER_AVATAR_SRC = "/illustrations/character/teacher-happy.svg";
export const TEACHER_NAME = AI_TEACHER_NAME;

export function TeacherCharacter({ mood, isSpeaking, size = "medium" }: TeacherCharacterProps) {
  const { px, cls } = SIZE_MAP[size];

  return (
    <div className={`relative flex flex-col items-center ${cls}`}>
      <motion.div
        className="relative h-full w-full"
        animate={{ y: [0, -8, 0], scale: [0.995, 1.02, 0.995] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <AnimatePresence>
          {mood === "thinking" && (
            <motion.span
              key="question"
              className="absolute -top-4 left-1/2 -translate-x-1/2 select-none rounded-full bg-white/85 px-3 py-1 text-lg shadow-sm"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: [0, -4, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ?
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSpeaking && (
            <>
              {["", "", ""].map((_, i) => (
                <motion.span
                  key={`spark-${i}`}
                  className="absolute h-2.5 w-2.5 rounded-full bg-amber-300 shadow-sm"
                  style={{ left: `${22 + i * 28}%`, top: "-6px" }}
                  initial={{ opacity: 0, y: 0, scale: 0.7 }}
                  animate={{ opacity: [0, 1, 0], y: -24, scale: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={mood}
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="h-full w-full drop-shadow-[0_28px_40px_rgba(49,40,23,0.16)]"
              animate={{ opacity: [1, 1, 0.92, 1, 1] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                times: [0, 0.45, 0.47, 0.49, 1],
                repeatDelay: 2,
              }}
            >
              <Image
                src={`/illustrations/character/teacher-${mood}.svg`}
                alt={`${TEACHER_NAME}-${mood}`}
                width={px}
                height={px}
                className="h-full w-full object-contain"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="pulse"
            className="mt-2 h-2 w-14 rounded-full bg-accent"
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
