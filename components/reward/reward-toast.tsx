"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useUiStore } from "@/store/ui-store";

export function RewardToast() {
  const { toast, dismissToast } = useUiStore();

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => dismissToast(), 2400);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          className="bp-panel fixed bottom-4 right-4 z-50 max-w-sm rounded-[28px] px-4 py-3 text-foreground"
        >
          <div className="text-sm font-semibold">{toast.title}</div>
          <div className="mt-1 text-sm text-ink-soft">{toast.detail}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
