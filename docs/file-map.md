# 项目文件地图

这份文件是给开发导航用的轻量索引，不是构建产物里的 source map `.map`。后续查 UI、会话、素材或接口时，先看这里能减少反复全仓搜索。

## 入口与页面

- `app/page.tsx`：首页入口，当前渲染 `HomePage`。
- `components/home/home-page.tsx`：首页主界面、主题入口、开始按钮。
- `components/agent/session-page.tsx`：会话页总容器，负责舞台布局、工具调用结果、用户输入提交。
- `components/agent/universal-renderer.tsx`：把工具调用渲染成具体交互组件，例如选择卡片、文字/语音输入、图片、拍照、绘画。

## 会话输入

- `components/game/text-input-slot.tsx`：会话内联的文字/语音输入组件；现在默认语音优先，文字输入为二级展开。
- `components/agent/voice-input-slot.tsx`：语音输入工具的薄封装，复用 `TextInputSlot`。
- `components/agent/input-bar.tsx`：没有内联工具时的底部兜底输入条。
- `hooks/use-voice-recorder.ts`：浏览器录音与语音识别状态。

## 选择卡片与图片

- `components/agent/choice-grid.tsx`：选择题网格，负责触发选项图片生成。
- `components/game/choice-card.tsx`：单张选择卡片的视觉呈现。
- `components/agent/generated-image-client.ts`：前端图片生成请求与缓存。
- `components/agent/image-slot.tsx`：独立图片展示工具。
- `app/api/ai/generate-image/route.ts`：图片生成 API 入口，之后配置供应商时重点看这里。

## 对话与防重复

- `lib/agent/agent-loop.ts`：主 agent 循环、工具调用选择、输入后的下一轮推进。
- `lib/daily/dynamic-conversation.ts`：日常对话提示词与轮次策略。
- `lib/agent/orchestration-guard.ts`：工具调用质量检查与兜底修正。
- `lib/agent/tool-definitions.ts`：工具 schema，包括 `show_choices` 的图片字段。
- `lib/agent/tool-validators.ts`：工具参数校验。

## 内容与主题

- `content/scenes.ts`：场景定义。
- `content/story-episodes.ts`：故事片段。
- `content/tasks.ts`：任务内容。
- `content/math-progression.ts`：数学能力进阶。
- `content/math-story-kernels.ts`：数学故事内核。

## 状态与数据

- `store/agent-store.ts`：会话状态。
- `store/profile-store.ts`：用户画像。
- `store/reward-store.ts`：奖励状态。
- `store/ui-store.ts`：UI 状态。
- `.data/brainplay.sqlite`：本地 SQLite 数据库。

## 样式

- `app/globals.css`：当前大部分视觉系统、首页、会话舞台、选择卡片、输入区样式都在这里。
