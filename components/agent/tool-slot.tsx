"use client";
/**
 * Task 8 — ToolSlot：聚焦/模糊注意力引导系统
 */

import { Component, type ReactNode } from "react";
import type { ToolCallResult } from "@/types/agent";

interface ErrorBoundaryState { hasError: boolean }

class ToolSlotErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="bp-muted-card px-4 py-3 text-sm text-ink-soft">
          哎呀，这里出了点小问题～
        </div>
      );
    }
    return this.props.children;
  }
}

export function ToolSlot({
  toolCall,
  children,
  isFocused = true,
}: {
  toolCall: ToolCallResult;
  children: ReactNode;
  isFocused?: boolean;
}) {
  return (
    <ToolSlotErrorBoundary>
      <div
        key={toolCall.id}
        className={[
          "story-cinema-bubble transition-all duration-300",
          isFocused
            ? "story-cinema-focus agent-focus-glow spotlight-panel"
            : "story-cinema-dim",
        ].join(" ")}
      >
        {children}
      </div>
    </ToolSlotErrorBoundary>
  );
}

export function FallbackSlot({ onContinue }: { onContinue?: () => void }) {
  return (
    <div className="bp-muted-card px-4 py-3 text-sm text-ink-soft">
      <button
        type="button"
        onClick={onContinue}
        className="text-accent underline"
      >
        点击继续
      </button>
    </div>
  );
}
