"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const PUNCTUATION_RE = /[。！？，、；：]/;

interface TypewriterTextProps {
  text: string;
  speed?: number;
  punctuationPause?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({
  text,
  speed = 60,
  punctuationPause = 180,
  className,
  onComplete,
}: TypewriterTextProps) {
  const [charIndex, setCharIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const done = prefersReducedMotion || charIndex >= text.length;
    if (done) {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    const currentChar = text[charIndex];
    const delay = PUNCTUATION_RE.test(currentChar)
      ? speed + punctuationPause
      : speed;

    timerRef.current = setTimeout(() => {
      setCharIndex((index) => index + 1);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [charIndex, text, speed, punctuationPause, prefersReducedMotion]);

  function handleSkip() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCharIndex(text.length);
  }

  const done = prefersReducedMotion || charIndex >= text.length;
  const visibleText = prefersReducedMotion ? text : text.slice(0, charIndex);

  return (
    <span
      className={`cursor-pointer select-none ${className ?? ""}`}
      onClick={done ? undefined : handleSkip}
    >
      {visibleText}
      {!done && (
        <span
          aria-hidden="true"
          className="ml-[1px] inline-block h-[1em] w-[2px] animate-[caret-blink_0.8s_steps(2)_infinite] bg-accent align-middle"
        />
      )}
    </span>
  );
}
