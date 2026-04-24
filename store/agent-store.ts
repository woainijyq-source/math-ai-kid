"use client";
/**
 * T3.1 — Agent Store
 * 管理 session、对话历史、活跃 tool_calls、流式状态。
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AgentStreamEvent,
  AgentStartRequest,
  AgentTurnRequest,
  ConversationMessage,
  InputType,
  InputMeta,
  ToolCallResult,
} from "@/types/agent";
import type { DailyThemeId } from "@/types/daily";
import type { ChildProfile } from "@/types/goals";
import { parseSSE } from "@/lib/agent/stream-parser";

// ---------------------------------------------------------------------------
// SSE 流读取工具
// ---------------------------------------------------------------------------

async function readSSEStream(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const block of lines) {
        const events = parseSSE(block + "\n\n");
        for (const event of events) onEvent(event);
      }
    }
    // flush remaining
    if (buffer.trim()) {
      const events = parseSSE(buffer);
      for (const event of events) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Store 类型
// ---------------------------------------------------------------------------

interface AgentState {
  sessionId: string | null;
  conversation: ConversationMessage[];
  activeToolCalls: ToolCallResult[];
  pendingInputType: InputType | null;
  isStreaming: boolean;
  currentGoalFocus: string[];
  currentThemeId: DailyThemeId | null;
  currentQuestionId: string | null;
  currentProfile: ChildProfile | null;
  error: string | null;
  // 会话完成状态（end_activity 触发，不持久化）
  sessionComplete: boolean;
  sessionSummary: { summary: string; completionRate?: number; parentNote?: string } | null;
  // 最近活动 ID 列表（用于去重，持久化到 localStorage）
  recentActivityIds: string[];

  // Actions
  startSession: (
    profileId: string,
    goalFocus?: string[],
    profile?: ChildProfile,
    options?: { themeId?: DailyThemeId; questionId?: string },
  ) => Promise<void>;
  sendTurn: (input: string, inputType: InputType, inputMeta?: InputMeta) => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store 实现
// ---------------------------------------------------------------------------

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      conversation: [],
      activeToolCalls: [],
      pendingInputType: null,
      isStreaming: false,
      currentGoalFocus: [],
      currentThemeId: null,
      currentQuestionId: null,
      currentProfile: null,
      error: null,
      sessionComplete: false,
      sessionSummary: null,
      recentActivityIds: [],

      startSession: async (profileId, goalFocus = [], profile, options) => {
        const recentActivityIds = get().recentActivityIds;
        set({
          isStreaming: true,
          error: null,
          activeToolCalls: [],
          conversation: [],
          currentGoalFocus: goalFocus,
          currentThemeId: options?.themeId ?? null,
          currentQuestionId: options?.questionId ?? null,
          currentProfile: profile ?? null,
          sessionComplete: false,
          sessionSummary: null,
        });

        const request: AgentStartRequest & { recentActivityIds: string[] } = {
          profileId,
          goalFocus,
          profile,
          recentActivityIds,
          themeId: options?.themeId,
          questionId: options?.questionId,
        };

        try {
          const resp = await fetch("/api/agent/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });

          if (!resp.ok) {
            set({ error: `HTTP ${resp.status}`, isStreaming: false });
            return;
          }

          const startToolCalls: ToolCallResult[] = [];

          await readSSEStream(resp, (event) => {
            if (event.type === "session_start") {
              if (event.activityId) {
                const current = get().recentActivityIds;
                const newRecent = [
                  event.activityId,
                  ...current.filter((id) => id !== event.activityId),
                ].slice(0, 5);
                const currentThemeId = get().currentThemeId;
                set(() => ({
                  sessionId: event.sessionId,
                  recentActivityIds: newRecent,
                  currentQuestionId: currentThemeId ? event.activityId : get().currentQuestionId,
                }));
              } else {
                set({ sessionId: event.sessionId });
              }
            } else if (event.type === "tool_call") {
              startToolCalls.push(event.toolCall);
              set((s) => ({ activeToolCalls: [...s.activeToolCalls, event.toolCall] }));
            } else if (event.type === "turn_end") {
              set({ isStreaming: false });
              // 把首轮 assistant 消息加入对话历史
              const assistantMsg: ConversationMessage = {
                role: "assistant",
                toolCalls: startToolCalls,
              };
              set((s) => ({ conversation: [...s.conversation, assistantMsg] }));
              // 计算 pendingInputType
              const calls = get().activeToolCalls;
              const inputTool = [...calls].reverse().find(
                (tc) => ["show_text_input", "request_voice", "show_number_input",
                  "request_photo", "show_emotion_checkin", "request_camera",
                  "show_drawing_canvas"].includes(tc.name)
              );
              const inputTypeMap: Record<string, InputType> = {
                show_text_input: "text",
                request_voice: "voice",
                show_number_input: "number",
                request_photo: "photo",
                show_emotion_checkin: "emotion",
                request_camera: "camera",
                show_drawing_canvas: "drawing",
              };
              set({ pendingInputType: inputTool ? (inputTypeMap[inputTool.name] ?? null) : null });
            } else if (event.type === "system_effect") {
              // 处理首发轮可能出现的 end_activity
              if (event.effect?.type === "end_activity") {
                set({
                  sessionComplete: true,
                  sessionSummary: {
                    summary: (event.effect.data?.summary as string) ?? "",
                    completionRate: event.effect.data?.completionRate as number | undefined,
                  },
                  isStreaming: false,
                });
              }
            } else if (event.type === "error") {
              set({ error: event.message, isStreaming: false });
            }
          });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "unknown", isStreaming: false });
        }
      },

      sendTurn: async (input, inputType, inputMeta) => {
        const {
          sessionId,
          conversation,
          currentGoalFocus,
          currentThemeId,
          currentQuestionId,
          activeToolCalls,
          currentProfile,
          recentActivityIds,
          isStreaming,
        } = get();
        if (!sessionId || isStreaming) return;

        // 把用户输入加入对话历史
        const userMsg: ConversationMessage = { role: "user", content: input };
        const newConversation = [...conversation, userMsg];
        const turnIndex = Math.floor(newConversation.length / 2);

        set({
          isStreaming: true,
          error: null,
          conversation: newConversation,
          activeToolCalls: [],
          pendingInputType: null,
        });

        const request: AgentTurnRequest & {
          conversation: ConversationMessage[];
          turnIndex: number;
          lastTurnToolCalls: typeof activeToolCalls;
          goalFocus: string[];
          themeId?: DailyThemeId;
          questionId?: string;
          profile: ChildProfile | null;
          recentActivityIds: string[];
        } = {
          sessionId,
          input,
          inputType,
          inputMeta,
          conversation: newConversation,
          turnIndex,
          lastTurnToolCalls: activeToolCalls,
          goalFocus: currentGoalFocus,
          themeId: currentThemeId ?? undefined,
          questionId: currentQuestionId ?? undefined,
          profile: currentProfile,
          recentActivityIds,
        };

        try {
          const resp = await fetch("/api/agent/turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });

          if (!resp.ok) {
            set({ error: `HTTP ${resp.status}`, isStreaming: false });
            return;
          }

          const newToolCalls: ToolCallResult[] = [];

          await readSSEStream(resp, (event) => {
            if (event.type === "tool_call") {
              newToolCalls.push(event.toolCall);
              set((s) => ({ activeToolCalls: [...s.activeToolCalls, event.toolCall] }));
            } else if (event.type === "system_effect") {
              // 处理 end_activity 事件，标记会话完成
              if (event.effect?.type === "end_activity") {
                set({
                  sessionComplete: true,
                  sessionSummary: {
                    summary: (event.effect.data?.summary as string) ?? "",
                    completionRate: event.effect.data?.completionRate as number | undefined,
                  },
                  isStreaming: false,
                });
              }
            } else if (event.type === "turn_end") {
              set({ isStreaming: false });
              // 把 assistant 消息加入对话历史
              const assistantMsg: ConversationMessage = {
                role: "assistant",
                toolCalls: newToolCalls,
              };
              set((s) => ({ conversation: [...s.conversation, assistantMsg] }));
              // 计算 pendingInputType
              const inputTool = [...newToolCalls].reverse().find(
                (tc) => ["show_text_input", "request_voice", "show_number_input",
                  "request_photo", "show_emotion_checkin", "request_camera",
                  "show_drawing_canvas"].includes(tc.name)
              );
              const inputTypeMap: Record<string, InputType> = {
                show_text_input: "text",
                request_voice: "voice",
                show_number_input: "number",
                request_photo: "photo",
                show_emotion_checkin: "emotion",
                request_camera: "camera",
                show_drawing_canvas: "drawing",
              };
              set({ pendingInputType: inputTool ? (inputTypeMap[inputTool.name] ?? null) : null });
            } else if (event.type === "error") {
              set({ error: event.message, isStreaming: false });
            }
          });
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "unknown", isStreaming: false });
        }
      },

      reset: () => set({
        sessionId: null,
        conversation: [],
        activeToolCalls: [],
        pendingInputType: null,
        isStreaming: false,
        currentGoalFocus: [],
        currentThemeId: null,
        currentQuestionId: null,
        currentProfile: null,
        error: null,
        sessionComplete: false,
        sessionSummary: null,
        recentActivityIds: [],
      }),
    }),
    {
      name: "brainplay-agent-store",
      partialize: (state) => ({
        sessionId: state.sessionId,
        conversation: state.conversation,
        currentGoalFocus: state.currentGoalFocus,
        currentThemeId: state.currentThemeId,
        currentQuestionId: state.currentQuestionId,
        recentActivityIds: state.recentActivityIds,
        // 不持久化 sessionComplete / sessionSummary，每次刷新需重置
      }),
    },
  ),
);
