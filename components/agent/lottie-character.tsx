"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AnimationItem } from "lottie-web";

interface LottieCharacterProps {
  src: string;
  ariaLabel: string;
  className?: string;
  fallback?: ReactNode;
  loop?: boolean;
  autoplay?: boolean;
}

export function LottieCharacter({
  src,
  ariaLabel,
  className,
  fallback,
  loop = true,
  autoplay = true,
}: LottieCharacterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let animation: AnimationItem | null = null;

    async function loadAnimation() {
      try {
        const lottie = (await import("lottie-web")).default;
        if (!active || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop,
          autoplay,
          path: src,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
          },
        });

        animation.addEventListener("data_failed", () => {
          if (active) setFailed(true);
        });
      } catch {
        if (active) setFailed(true);
      }
    }

    setFailed(false);
    void loadAnimation();

    return () => {
      active = false;
      animation?.destroy();
    };
  }, [autoplay, loop, src]);

  if (failed) {
    return fallback;
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
    />
  );
}
