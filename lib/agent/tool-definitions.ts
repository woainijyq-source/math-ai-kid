/**
 * T1.3 — 工具 JSON Schema 定义
 * 导出 Qwen/OpenAI 兼容的 tools 参数格式。
 */

import type { ToolName } from "../../types/agent";

// ---------------------------------------------------------------------------
// 工具定义类型
// ---------------------------------------------------------------------------

export interface ToolFunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolFunctionParameter | { type: string; properties?: Record<string, ToolFunctionParameter>; required?: string[] };
  properties?: Record<string, ToolFunctionParameter>;
  required?: string[];
}

export interface ToolFunction {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolFunctionParameter>;
    required: string[];
  };
  strict: true;
}

export interface ToolDefinition {
  type: "function";
  function: ToolFunction;
}

// ---------------------------------------------------------------------------
// 首发 8 个工具定义
// ---------------------------------------------------------------------------

export const FIRST_LAUNCH_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "narrate",
      description:
        "向孩子朗读一段叙述文本，可以是开场白、反馈或过渡语。【重要】每轮对话必须将此工具作为第一个调用，无论孩子用中文还是英文输入，都必须先调用 narrate 再调用其他工具。禁止在没有 narrate 的情况下直接调用展示类或输入类工具。",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "要朗读的文本，面向孩子，简短，1-2 句话",
          },
          speakerName: {
            type: "string",
            description: "说话角色名称，如脑脑",
          },
          voiceRole: {
            type: "string",
            enum: ["guide", "opponent", "maker", "storyteller"],
            description: "语音角色，影响 TTS 音色选择",
          },
          autoSpeak: {
            type: "boolean",
            description: "是否自动播放 TTS，默认 true",
          },
        },
        required: ["text"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_choices",
      description:
        "向孩子展示选择卡片，等待孩子点击选择一项。【重要】如果选项需要图形（如规律题、形状题），请在 choices 每个元素中附带 imageUrl 字段（调用 /api/ai/generate-image 获得），而不只是文字标签。展示型工具，配合 narrate 一起调用。",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "选择题问题文本",
          },
          choices: {
            type: "array",
            description: "选项列表，2-4 项。几何图形或规律类题目建议每个选项附带 imageUrl。",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string", description: "选项简短标签" },
                desc: { type: "string", description: "可选的选项补充说明" },
                imageUrl: { type: "string", description: "可选的图片 URL，适用于需要可视化选项的场景（如图形规律题），优先使用 imageUrl 而非纯文字 label" },
              },
              required: ["id", "label"],
            },
          },
        },
        required: ["prompt", "choices"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_text_input",
      description:
        "显示一个文字输入框，让孩子用键盘输入回答。输入请求工具，每轮最多使用 1 次。",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "问题或指引文本",
          },
          placeholder: {
            type: "string",
            description: "输入框占位符",
          },
          submitLabel: {
            type: "string",
            description: "提交按钮文字，默认发送",
          },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_image",
      description:
        "在对话中插入一张图片，可以是示意图或场景图。展示型工具。",
      parameters: {
        type: "object",
        properties: {
          alt: {
            type: "string",
            description: "图片文字描述（无障碍）",
          },
          imageUrl: {
            type: "string",
            description: "已有图片 URL（可选）",
          },
          generatePrompt: {
            type: "string",
            description: "若无 imageUrl，用于生成图片的提示词",
          },
        },
        required: ["alt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "request_voice",
      description:
        "请求孩子用语音回答，激活麦克风录音。输入请求工具，每轮最多使用 1 次。",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "语音题提示文本",
          },
          language: {
            type: "string",
            description: "识别语言，如 zh-CN、en-US",
          },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "think",
      description:
        "AI 内部思考步骤，不向孩子展示，用于规划下一步工具调用。系统工具，不产生前端渲染。",
      parameters: {
        type: "object",
        properties: {
          reasoning: {
            type: "string",
            description: "AI 的思考过程",
          },
          nextToolSuggestion: {
            type: "array",
            items: { type: "string" },
            description: "建议接下来调用的工具名列表（可选）",
          },
        },
        required: ["reasoning"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "award_badge",
      description:
        "给孩子颁发一枚成就徽章，触发奖励反馈。系统工具，在孩子完成阶段任务时调用。",
      parameters: {
        type: "object",
        properties: {
          badgeId: {
            type: "string",
            description: "徽章 ID，如 math-explorer-01",
          },
          title: {
            type: "string",
            description: "徽章名称",
          },
          detail: {
            type: "string",
            description: "获得原因说明",
          },
        },
        required: ["badgeId", "title", "detail"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "end_activity",
      description:
        "结束当前活动，触发结算页面跳转。系统工具，活动完成后调用。",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "本次活动的简短总结",
          },
          completionRate: {
            type: "number",
            description: "完成度 0-100",
          },
        },
        required: ["summary", "completionRate"],
      },
      strict: true,
    },
  },
];

// ---------------------------------------------------------------------------
// 延后工具（占位，后续 Step 5/6 实现）
// ---------------------------------------------------------------------------

export const DEFERRED_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "show_number_input",
      description: "显示数字选择器，让孩子输入一个数字。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "问题文本" },
          min: { type: "number", description: "最小值" },
          max: { type: "number", description: "最大值" },
          step: { type: "number", description: "步长" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "request_photo",
      description: "请求孩子拍一张照片提交。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "拍照提示文本" },
          hints: { type: "array", items: { type: "string" }, description: "拍摄提示列表" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_emotion_checkin",
      description: "显示情绪打卡组件，让孩子选择当前状态。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_drag_board",
      description: "显示拖拽操作板，让孩子通过拖拽完成任务。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "操作提示文本" },
          items: { type: "array", items: { type: "string" }, description: "可拖拽的元素列表" },
        },
        required: ["prompt", "items"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "request_camera",
      description: "开启摄像头，捕捉孩子的动作或作品。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "摄像头提示文本" },
          hints: { type: "array", items: { type: "string" }, description: "操作提示列表" },
          duration: { type: "number", description: "录制时长（秒），可选" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "show_drawing_canvas",
      description: "显示画板，让孩子自由绘画或作答。",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "画画提示文本" },
        },
        required: ["prompt"],
      },
      strict: true,
    },
  },
  {
    type: "function",
    function: {
      name: "log_observation",
      description: "记录对孩子的观察（系统内部工具，不向孩子展示）。",
      parameters: {
        type: "object",
        properties: {
          goalId: { type: "string", description: "目标 ID" },
          subGoalId: { type: "string", description: "子目标 ID" },
          skill: { type: "string", description: "观察到的技能" },
          observation: { type: "string", description: "观察描述" },
          evidence: { type: "string", description: "支撑证据（孩子的原话或行为）" },
          difficultyLevel: {
            type: "string",
            enum: ["L1", "L2", "L3", "L4"],
            description: "当前难度级别",
          },
          confidence: { type: "number", description: "置信度 0-1" },
          hintCount: { type: "number", description: "本轮提示次数" },
          selfExplained: { type: "boolean", description: "孩子是否自己解释了" },
        },
        required: ["goalId", "subGoalId", "skill", "observation", "evidence"],
      },
      strict: true,
    },
  },
];

// ---------------------------------------------------------------------------
// 合并导出
// ---------------------------------------------------------------------------

/** 首发 + 延后所有工具 */
export const ALL_TOOLS: ToolDefinition[] = [...FIRST_LAUNCH_TOOLS, ...DEFERRED_TOOLS];

/** 所有已注册工具名集合，用于快速查找 */
export const KNOWN_TOOL_NAMES = new Set<ToolName>(
  ALL_TOOLS.map((t) => t.function.name)
);
