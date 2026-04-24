import type { DailyThemeId } from "./daily";

/**
 * T1.1 — Agent 协议类型定义
 * 纯类型文件，无实现代码。
 */

// ---------------------------------------------------------------------------
// 基础标识类型
// ---------------------------------------------------------------------------

export type ToolCallId = string;

export type ToolName =
  // 首发 8 个工具
  | "narrate"
  | "show_choices"
  | "show_text_input"
  | "show_image"
  | "request_voice"
  | "think"
  | "award_badge"
  | "end_activity"
  // 延后工具（占位）
  | "show_number_input"
  | "request_photo"
  | "show_emotion_checkin"
  | "show_drag_board"
  | "request_camera"
  | "show_drawing_canvas"
  | "log_observation";

// ---------------------------------------------------------------------------
// Tool Call 类型
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: ToolCallId;
  name: ToolName;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult extends ToolCall {
  renderedAt?: number;
  status: "pending" | "rendered" | "responded";
}

// ---------------------------------------------------------------------------
// 输入类型
// ---------------------------------------------------------------------------

export type InputType =
  | "choice"
  | "text"
  | "voice"
  | "drag"
  | "photo"
  | "camera"
  | "number"
  | "drawing"
  | "emotion";

export interface InputMeta {
  choiceId?: string;
  fragments?: string[];
  photoBase64?: string;
  numberValue?: number;
  emotionId?: string;
}

// ---------------------------------------------------------------------------
// 对话消息类型
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: ToolCall[];
  /** tool 角色消息时的工具调用 ID */
  tool_call_id?: string;
  /** tool 角色消息时的工具名称 */
  name?: string;
}

// ---------------------------------------------------------------------------
// API 请求类型
// ---------------------------------------------------------------------------

export interface AgentTurnRequest {
  sessionId: string;
  input: string;
  inputType: InputType;
  inputMeta?: InputMeta;
  themeId?: DailyThemeId;
  questionId?: string;
}

export interface AgentStartRequest {
  profileId: string;
  goalFocus?: string[];
  profile?: import("./goals").ChildProfile;
  recentActivityIds?: string[];
  themeId?: DailyThemeId;
  questionId?: string;
}

// ---------------------------------------------------------------------------
// Agent 流式事件类型
// ---------------------------------------------------------------------------

export interface SessionStartEvent {
  type: "session_start";
  sessionId: string;
  profileId: string;
  activityId?: string;
  timestamp: number;
}

export interface ToolCallEvent {
  type: "tool_call";
  toolCall: ToolCallResult;
  turnIndex: number;
}

export interface SystemEffect {
  type: "award_badge" | "end_activity" | "log_observation";
  data: Record<string, unknown>;
}

export interface SystemEffectEvent {
  type: "system_effect";
  effect: SystemEffect;
  turnIndex: number;
}

export interface TurnEndEvent {
  type: "turn_end";
  turnIndex: number;
  toolCallCount: number;
  usedFastPath: boolean;
  elapsedMs: number;
}

export interface ErrorEvent {
  type: "error";
  code: string;
  message: string;
  recoverable: boolean;
}

export type AgentStreamEvent =
  | SessionStartEvent
  | ToolCallEvent
  | SystemEffectEvent
  | TurnEndEvent
  | ErrorEvent;
