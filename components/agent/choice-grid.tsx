"use client";
/**
 * Task 6 — ChoiceGrid 改造
 * 打字机 prompt + stagger 选项入场动画
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { ChoiceCard } from "@/components/game/choice-card";
import { TypewriterText } from "@/components/agent/typewriter-text";
import type { InputMeta, InputType } from "@/types/agent";

interface Choice {
  id: string;
  label: string;
  desc?: string;
  badge?: string;
  imageUrl?: string;
}

interface ChoiceGridProps {
  prompt: string;
  choices: Choice[];
  onSubmit: (input: string, type: InputType, meta?: InputMeta) => void;
}

export function ChoiceGrid({ prompt, choices, onSubmit }: ChoiceGridProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showChoices, setShowChoices] = useState(false);

  function handleClick(choice: Choice) {
    if (selected !== null) return;
    setSelected(choice.id);
    onSubmit(choice.label, "choice", { choiceId: choice.id });
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-foreground">
        <TypewriterText
          key={prompt}
          text={prompt}
          speed={50}
          onComplete={() => setShowChoices(true)}
        />
      </p>
      {showChoices && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {choices.map((choice, i) => (
            <motion.div
              key={choice.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, delay: i * 0.08, ease: "easeOut" }}
            >
              <ChoiceCard
                label={choice.label}
                description={choice.desc ?? ""}
                badge={choice.badge}
                imageUrl={choice.imageUrl}
                disabled={selected !== null}
                onClick={() => handleClick(choice)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
