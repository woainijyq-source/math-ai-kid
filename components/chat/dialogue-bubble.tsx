"use client";

import type { AIMessage } from "@/types";

export function DialogueBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === "user";
  const roleLabel = isUser ? "我" : message.speakerName ?? "剧情向导";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "bp-chat-bubble-user text-white"
            : "bp-chat-bubble-ai text-foreground"
        }`}
      >
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${
            isUser ? "text-white/75" : "text-accent"
          }`}
        >
          {roleLabel}
        </p>
        <p>{message.content}</p>
        {message.hints.length > 0 ? (
          <p
            className={`mt-3 rounded-2xl px-3 py-2 text-xs leading-5 ${
              isUser
                ? "bg-white/12 text-white/82"
                : "bg-accent-soft text-accent-strong"
            }`}
          >
            提示：{message.hints.join(" / ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
