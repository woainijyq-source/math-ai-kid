# 脑脑对话呈现升级与追问链路修复计划

## Summary

这次合并做两类事情，一次性把“能用”和“更像实时对话”都补齐：

- 先修正当前追问链路，确保脑脑追问时一定有语音播报，且文字输入框/语音输入控件按预期出现。
- 在此基础上，把对话升级成“打字机文本 + 动态气泡 + 聚焦高亮 + 周边轻模糊”的实时对话体验，让孩子的注意力自然集中到脑脑正在说的话上，再平滑转移到输入区域。

整体目标不是重做页面，而是在现有 `session` / `agent` 渲染链路上做一层稳定的对话导演系统。

## Key Changes

### 1. 修复追问无语音、无输入框的链路
涉及 [app/api/agent/turn/route.ts](../app/api/agent/turn/route.ts)、[lib/agent/agent-loop.ts](../lib/agent/agent-loop.ts)、[components/agent/universal-renderer.tsx](../components/agent/universal-renderer.tsx)

- 在服务端增加“追问组合补全”规则：
  - 若本轮包含 `show_text_input` 或 `request_voice`
  - 但没有 `narrate`
  - 自动补一条 narrate，文案优先从输入工具的 `prompt` 提炼，转成更适合口播的短句
- 固定追问型轮次的推荐组合：
  - `narrate`：负责说给孩子听
  - `show_text_input` / `request_voice`：负责接收孩子回复
- 在服务端和前端各加一层开发日志，验证每轮最终实际渲染的工具组合，快速判断是“工具没下发”还是“下发了但前端没显示”。
- 保证输入控件不会被 `pendingInputType` 和主渲染区互相打架：主渲染区有专用输入工具时，底部 `InputBar` 继续隐藏，输入由当前 tool slot 接管。

### 2. 把 narrate 升级成打字机式实时出现
涉及 [components/agent/agent-narrator.tsx](../components/agent/agent-narrator.tsx)、[components/agent/tool-slot.tsx](../components/agent/tool-slot.tsx)

- `AgentNarrator` 从“一次性显示整段文字”改为“收到完整文本后逐字 reveal”。
- 新增内部播放状态：
  - `idle`
  - `typing`
  - `speaking`
  - `handoff`
  - `complete`
- 文本 reveal 规则：
  - 优先按 TTS 实际播放时长估算 reveal 节奏
  - 拿不到时长则回退固定字速
  - 中文按字 reveal，标点增加短暂停顿
- 增加打字机光标或尾部跳动点，明确“脑脑正在说”。
- narrate 播放完成后，向父层发出“可交接输入”的状态，让输入控件在合适时机激活。

### 3. 加入动态对话气泡
涉及 [components/agent/agent-narrator.tsx](../components/agent/agent-narrator.tsx)、[components/agent/tool-slot.tsx](../components/agent/tool-slot.tsx)、[app/globals.css](../app/globals.css)

- 当前 narrate 气泡出现时增加三段式动画：
  - 进入：淡入 + 上浮 + 轻缩放
  - 讲话中：边框、阴影、halo 轻呼吸
  - 完成：回落到稳定态
- 气泡内部增加微高光和温暖 halo，突出“当前正在被说出的内容”。
- 样式尽量复用现有语义：
  - `spotlight-panel`
  - `scene-muted`
  - `halo-pulse`
  - 新增 `agent-focus-bubble`、`agent-focus-ring`、`agent-typing-caret` 等专用类
- 所有效果保持儿童向、柔和，不做赛博或过强闪烁。

### 4. 加入“聚焦 + 模糊”注意力引导
涉及 [components/agent/session-page.tsx](../components/agent/session-page.tsx)、[components/agent/universal-renderer.tsx](../components/agent/universal-renderer.tsx)、[components/agent/tool-slot.tsx](../components/agent/tool-slot.tsx)、[app/globals.css](../app/globals.css)

- 在主内容区引入 `focusMode` 和 `focusToolCallId`：
  - `narrate`：聚焦当前说话气泡
  - `input-handoff`：聚焦从气泡平滑转移到输入控件
  - `idle`：无特殊聚焦
- 对当前 narrate slot 做强聚焦：
  - 放大 1-2%
  - halo 外扩
  - 阴影增强
  - 位置轻上浮
- 对同层其他旧内容做弱化：
  - `blur(1px-2.5px)`
  - 降饱和
  - 降透明度
  - 轻微缩小
- 不模糊以下区域：
  - 当前 narrate 气泡
  - 当前将要接棒的输入控件
  - 顶部栏
  - 底部输入栏
  - 机器人角色
- 额外加一层局部 spotlight，而不是全屏暗幕：
  - 聚焦区上方暖白径向光斑
  - 周边轻暗角
  - `pointer-events: none`
  - 只作用于主内容区

### 5. 让输入阶段形成“脑脑说完 → 孩子接话”的节奏
涉及 [components/game/text-input-slot.tsx](../components/game/text-input-slot.tsx)、[components/agent/voice-input-slot.tsx](../components/agent/voice-input-slot.tsx)、[components/agent/universal-renderer.tsx](../components/agent/universal-renderer.tsx)

- 当一轮包含 `narrate + show_text_input`：
  - 输入框立即挂载，避免布局跳变
  - 但先处于弱化/禁用态
  - narrate 接近结束后，输入框高亮、启用并自动 focus
- 当一轮包含 `narrate + request_voice`：
  - 录音按钮先渲染为弱态
  - narrate 结束后再进入可点击态
- 这样保证孩子先听脑脑说，再自然进入回答动作，不会看到多个静态块同时抢注意力。

### 6. 性能与可访问性约束
涉及 [app/globals.css](../app/globals.css)、[components/agent/agent-narrator.tsx](../components/agent/agent-narrator.tsx)

- 动画采用 CSS + Framer Motion 混合方案：
  - 进入/退出/状态切换用 Framer Motion
  - 持续 blur / halo / breathe 用 CSS keyframes
- 移动端降低 blur 和 glow 强度，避免掉帧。
- `prefers-reduced-motion: reduce` 下：
  - 保留聚焦明暗层次
  - 关闭呼吸、漂浮、持续 pulse
- 所有聚焦层和 spotlight 层都必须 `pointer-events: none`，不得挡住输入和点击。

## Test Plan

- 回归测试：凡是包含 `show_text_input` 或 `request_voice` 的追问轮次，最终都必须有 `narrate`。
- 回归测试：追问场景里，脑脑会先播报，再出现可用的文字框或语音按钮。
- 手动测试：narrate 文本以打字机方式出现，且 TTS 播放时气泡处于讲话态。
- 手动测试：narrate 出现时当前气泡明显高亮，其他旧内容轻模糊，但输入区域不会被遮挡。
- 手动测试：narrate 结束后，聚焦从气泡自然转移到输入框或录音按钮。
- 手动测试：连续 3-5 轮对话中，聚焦态不会卡在旧气泡上，输入也不会失焦或重复禁用。
- 手动测试：移动端滚动、切换轮次时不出现明显卡顿或闪烁。
- 手动测试：TTS 失败时，仍保留打字机 reveal 和输入激活节奏。

## Assumptions

- 第一版打字机效果基于完整文本做前端 reveal，不改成服务端 token 级流式输出。
- 聚焦效果第一版只对当前 `narrate` 进行强引导，不对 `show_choices` 采用同等级 spotlight。
- 输入控件默认“先挂载后激活”，避免 narrate 结束时布局重新计算。
- spotlight 第一版按当前 slot 容器居中实现，不做像素级位置跟踪。
