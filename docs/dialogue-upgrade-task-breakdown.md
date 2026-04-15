# 脑脑对话呈现升级 — 任务拆分计划书

> 综合 Claude 代码分析 + GPT 设计建议，按依赖顺序拆分为可独立执行的任务单元。
> 每个任务包含：目标、涉及文件、实现要点、验收标准。

---

## 背景

当前问题：
1. **Bug**：脑脑追问时（`show_text_input` / `request_voice`）prompt 文字没有语音播报
2. **Bug**：某些追问轮次缺少 `narrate`，导致无语音也无气泡
3. **体验**：文字一次性出现，缺少对话感；没有注意力引导

目标：
- 修复追问链路，保证每轮追问都有语音 + 输入控件
- 文字以打字机方式逐字出现，配合语音产生实时对话感
- 对话气泡出现时聚焦高亮 + 周边轻模糊，引导孩子注意力
- 输入控件在脑脑说完后才激活，形成"先听后答"的自然节奏

---

## 已有可复用资源

| 资源 | 位置 | 用途 |
|------|------|------|
| `.story-cinema-focus` | `app/globals.css:676` | 聚焦态：scale(1), opacity(1), box-shadow 发光 |
| `.story-cinema-dim` | `app/globals.css:683` | 模糊态：scale(0.98), opacity(0.58), blur(2px) |
| `.spotlight-panel` + `::after` | `app/globals.css:215` | 呼吸发光（spotlight-breathe 1.8s） |
| `.scene-muted` | `app/globals.css:234` | 场景静音/模糊态 |
| `.story-cinema-bubble` | `app/globals.css:666` | 220ms ease transition（transform + filter + opacity + box-shadow） |
| `@keyframes caret-blink` | `app/globals.css` | 光标闪烁动画 |
| `DialogueBubble` | `components/chat/dialogue-bubble.tsx` | 气泡 UI 样式参考 |
| Framer Motion `^12.38.0` | `package.json` | 入场/退出/状态动画 |
| TTS 完整管线 | `agent-narrator.tsx` → `lib/ai/client.ts` → `app/api/ai/tts/route.ts` → `lib/ai/tts.ts` | 语音播放 |

---

## 任务依赖关系

```
Task 1 (TTS Hook) ──┐
                     ├── Task 4 (AgentNarrator 改造)
Task 2 (Typewriter)──┤
                     ├── Task 5 (TextInputSlot 改造)
                     ├── Task 6 (ChoiceGrid 改造)
                     └── Task 7 (对话历史气泡)
Task 3 (追问补全) ────── 独立，可并行

Task 4 完成后 ──── Task 8 (聚焦/模糊系统)
```

**可并行的任务组**：
- 第一批（无依赖）：Task 1, Task 2, Task 3
- 第二批（依赖 Task 1+2）：Task 4, Task 5, Task 6
- 第三批（依赖 Task 4）：Task 7, Task 8

---

## Task 1：提取 TTS Hook

**目标**：从 `AgentNarrator` 提取 TTS 播放逻辑为可复用 React Hook，让其他组件也能播报语音。

**涉及文件**：
- 新建 `hooks/use-tts.ts`
- 修改 `components/agent/agent-narrator.tsx`

**实现要点**：

1. 将 `agent-narrator.tsx` 中以下逻辑提取到 `hooks/use-tts.ts`：
   - `ttsQueue`（全局 TTS 队列，避免多个组件同时播放）
   - `userHasInteracted`（用户交互解锁检测）
   - `enqueueTts()`, `playAudioBase64()`, `speakWithBrowser()` 函数
   - `sendTts()` 调用（来自 `lib/ai/client.ts`）

2. Hook 接口设计：
```ts
export function useTts(text: string, options?: {
  voiceRole?: VoiceRole;     // 默认 "guide"
  speakerName?: string;
  autoSpeak?: boolean;       // 默认 true
  enabled?: boolean;         // 默认 true，可条件控制
}): {
  isSpeaking: boolean;       // 当前是否在播放
  isComplete: boolean;       // 是否播放完毕
}
```

3. 内部用 `useEffect` 触发播放，`useRef` 防重复
4. 返回 `isSpeaking` / `isComplete` 状态（可联动 robot mood 和聚焦系统）
5. `agent-narrator.tsx` 改为调用 `useTts(text, { voiceRole, speakerName, autoSpeak })`，删除内联 TTS 逻辑

**验收标准**：
- `AgentNarrator` 行为不变（narrate 仍自动播放语音）
- `useTts` 可在其他组件中独立使用
- `npx tsc --noEmit` 通过

---

## Task 2：创建 TypewriterText 组件

**目标**：创建逐字显示文本的组件，模拟打字机效果。

**涉及文件**：
- 新建 `components/agent/typewriter-text.tsx`

**实现要点**：

1. 组件接口：
```tsx
interface TypewriterTextProps {
  text: string;
  speed?: number;              // ms/字，默认 60（约对应正常语速）
  punctuationPause?: number;   // 标点额外暂停 ms，默认 180
  className?: string;
  onComplete?: () => void;     // 全部显示完毕回调
}
```

2. 核心逻辑：
   - `charIndex` state 从 0 递增到 `text.length`
   - 用 `useEffect` + `setTimeout` 递归调度（非 setInterval，因为每字间隔可能不同）
   - 遇到中文标点 `。！？，、；：…` 时额外暂停 `punctuationPause` ms
   - 显示：`<span>{text.slice(0, charIndex)}</span>`
   - 未完成时末尾显示闪烁光标：`<span className="inline-block w-[2px] h-[1em] bg-accent animate-[caret-blink_0.8s_steps(2)_infinite]" />`
   - 完成后光标消失，调用 `onComplete()`

3. 跳过功能：
   - 点击/触摸组件区域时立即 `setCharIndex(text.length)`
   - 添加 `cursor-pointer` 提示可点击

4. 清理：组件 unmount 时清除 timeout

5. `prefers-reduced-motion` 支持：
   - 检测 `matchMedia("(prefers-reduced-motion: reduce)")`
   - 如果启用，直接显示全文，不做逐字动画

**验收标准**：
- 文字逐字出现，标点有停顿
- 有闪烁光标跟随
- 可点击跳过
- `npx tsc --noEmit` 通过

---

## Task 3：服务端追问组合补全

**目标**：保证每个包含 `show_text_input` / `request_voice` 的轮次都有 `narrate`。

**涉及文件**：
- 修改 `lib/agent/orchestration-guard.ts`（在 `enforceOrchestration` 中增加规则）
- 或新建 `lib/agent/followup-guard.ts`

**实现要点**：

1. 在编排约束（`enforceOrchestration`）中新增规则：
   - 检查当前轮次的 tool_calls
   - 如果包含 `show_text_input` 或 `request_voice`，但没有 `narrate`
   - 从输入工具的 `prompt` 字段提取文案
   - 自动在列表头部插入一条 `narrate` tool_call：
     ```ts
     {
       id: `auto-narrate-${Date.now()}`,
       name: "narrate",
       arguments: {
         text: inputTool.arguments.prompt,  // 复用 prompt 文案
         voiceRole: "guide",
         autoSpeak: true
       }
     }
     ```

2. 在 `app/api/agent/turn/route.ts` 的编排流程中，这个补全在 `enforceOrchestration` 之后、`filterAIOutput` 之前执行

3. 添加日志：`console.debug("[followup-guard] auto-injected narrate for input-only turn")`

**验收标准**：
- AI 只返回 `show_text_input` 时，前端仍能听到语音（自动补的 narrate）
- 已有 narrate 的轮次不受影响
- `npx tsc --noEmit` 通过

---

## Task 4：AgentNarrator 改造 — 打字机 + 气泡

**依赖**：Task 1（useTts hook）、Task 2（TypewriterText）

**目标**：将 narrate 渲染升级为打字机文本 + 对话气泡样式。

**涉及文件**：
- 修改 `components/agent/agent-narrator.tsx`

**实现要点**：

1. 新增 props：
```tsx
interface AgentNarratorProps {
  text: string;
  speakerName?: string;
  voiceRole?: string;
  autoSpeak?: boolean;
  onComplete?: () => void;  // 新增：打字机 + TTS 都完成后回调
}
```

2. 文字渲染改用 TypewriterText：
```tsx
<TypewriterText text={text} speed={60} onComplete={handleTypingDone} />
```

3. 外层改为对话气泡样式（参考 `DialogueBubble`）：
```tsx
<motion.div
  initial={{ opacity: 0, y: 12, scale: 0.96 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
  className="flex justify-start"
>
  <div className="relative max-w-[85%] rounded-[24px] rounded-tl-md
    border border-border bg-white/90 px-4 py-3 shadow-sm">
    {/* 气泡左上角小三角 */}
    <div className="absolute -left-2 top-3 h-3 w-3 rotate-45 border-b border-l border-border bg-white/90" />
    {speakerName && <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent">{speakerName}</p>}
    <TypewriterText text={text} onComplete={handleTypingDone} className="text-sm leading-6 text-foreground" />
  </div>
</motion.div>
```

4. TTS 使用 `useTts` hook，与打字机同时启动
5. `onComplete` 在打字机和 TTS 都完成后才触发（用 `useEffect` 监听两个 complete 状态）

**验收标准**：
- narrate 文字逐字出现，有光标
- 同时播放语音
- 气泡有入场动画（淡入 + 上浮）
- 打字机 + TTS 完成后触发 onComplete
- 可点击跳过文字动画

---

## Task 5：TextInputSlot 改造 — TTS + 打字机 + 延迟激活

**依赖**：Task 1（useTts hook）、Task 2（TypewriterText）

**目标**：修复追问无语音 bug + 打字机效果 + 输入框延迟激活。

**涉及文件**：
- 修改 `components/game/text-input-slot.tsx`

**实现要点**：

1. 用 `useTts(prompt)` 播放追问语音（**修复核心 Bug**）
2. prompt 用 `TypewriterText` 渲染
3. 输入框立即挂载但先禁用（避免布局跳变），打字机完成后启用：
```tsx
const [inputReady, setInputReady] = useState(false);
useTts(prompt, { autoSpeak: true });

return (
  <div className="space-y-3">
    <TypewriterText text={prompt} onComplete={() => setInputReady(true)} className="text-sm font-medium text-foreground" />
    <motion.div
      initial={{ opacity: 0.4 }}
      animate={{ opacity: inputReady ? 1 : 0.4 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex gap-2">
        <input
          disabled={!inputReady || submitted}
          autoFocus={inputReady}
          // ... existing props
        />
        <button disabled={!inputReady || !value.trim() || submitted}>
          {submitLabel}
        </button>
      </div>
    </motion.div>
  </div>
);
```

4. 输入框启用时自动 focus（用 `useRef` + `useEffect` 监听 `inputReady`）

**验收标准**：
- `show_text_input` 的 prompt 有语音播报
- prompt 逐字出现
- 打字完成前输入框可见但禁用（半透明）
- 打字完成后输入框亮起、自动聚焦
- `npx tsc --noEmit` 通过

---

## Task 6：ChoiceGrid 改造 — 打字机 prompt + stagger 选项入场

**依赖**：Task 2（TypewriterText）

**目标**：选择题 prompt 也有打字机效果，选项卡依次入场。

**涉及文件**：
- 修改 `components/agent/choice-grid.tsx`

**实现要点**：

1. prompt 改用 `TypewriterText`
2. 打字机完成前选项不可见，完成后选项依次入场（stagger 动画）：
```tsx
const [showChoices, setShowChoices] = useState(false);

<TypewriterText text={prompt} onComplete={() => setShowChoices(true)} />

{showChoices && (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {choices.map((choice, i) => (
      <motion.div
        key={choice.id}
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
      >
        <ChoiceCard ... />
      </motion.div>
    ))}
  </div>
)}
```

**验收标准**：
- 选择题 prompt 逐字出现
- 打字完成后选项卡依次弹入（每张间隔 ~80ms）
- 选项入场前不可见
- `npx tsc --noEmit` 通过

---

## Task 7：对话历史气泡 + 自动滚动

**依赖**：Task 4（AgentNarrator 气泡样式）

**目标**：显示历史对话（用户消息 + AI 回复），形成完整聊天流。

**涉及文件**：
- 修改 `components/agent/session-page.tsx`

**实现要点**：

1. 从 `conversation` state 中提取历史消息
2. 在 `UniversalRenderer` 上方渲染历史气泡：

**用户消息气泡**（右对齐）：
```tsx
function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-[24px] rounded-tr-md bg-accent px-4 py-3 text-sm text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}
```

**历史 AI 气泡**（左对齐，从 toolCalls 提取 narrate 文本）：
```tsx
function HistoryBubble({ toolCalls }: { toolCalls?: ToolCallResult[] }) {
  const narrateTexts = (toolCalls ?? [])
    .filter(tc => tc.name === "narrate")
    .map(tc => (tc.arguments as { text?: string })?.text)
    .filter(Boolean);
  if (narrateTexts.length === 0) return null;
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-[24px] rounded-tl-md border border-border bg-white/80 px-4 py-3 text-sm text-foreground/70 shadow-sm">
        {narrateTexts.join(" ")}
      </div>
    </div>
  );
}
```

3. 历史气泡始终为 dim 态（`.story-cinema-dim`）
4. 当前轮仍用 `UniversalRenderer` 渲染（有打字机 + TTS + 聚焦）

5. 自动滚动：
```tsx
const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [activeToolCalls, conversation]);

// 在内容区底部：
<div ref={bottomRef} />
```

6. 注意：最后一条 assistant 消息（即 activeToolCalls 对应的）不渲染为历史气泡（避免重复），只渲染 `conversation` 中除最后一条 assistant 之外的记录

**验收标准**：
- 多轮对话后能看到历史消息
- 用户消息右对齐（绿色），AI 消息左对齐（白色）
- 历史消息为模糊/半透明态
- 新内容出现时自动滚动到底部
- `npx tsc --noEmit` 通过

---

## Task 8：聚焦/模糊注意力引导系统

**依赖**：Task 4（AgentNarrator 的 onComplete）

**目标**：当前活跃内容聚焦高亮，其余内容模糊退后，引导孩子注意力。

**涉及文件**：
- 修改 `components/agent/universal-renderer.tsx`
- 修改 `components/agent/tool-slot.tsx`
- 可能微调 `app/globals.css`（增加 `agent-focus-ring` 类）

**实现要点**：

### 8A：UniversalRenderer 聚焦状态管理

```tsx
// universal-renderer.tsx
const [focusIndex, setFocusIndex] = useState(0);

function handleToolComplete(index: number) {
  // 当前 tool 完成，聚焦移到下一个
  setFocusIndex(Math.min(index + 1, sorted.length - 1));
}

{sorted.map((tc, i) => {
  const content = renderTool(tc, onUserInput, () => handleToolComplete(i));
  if (!content) return null;
  return (
    <ToolSlot key={tc.id} toolCall={tc} isFocused={i === focusIndex}>
      {content}
    </ToolSlot>
  );
})}
```

需要给 `renderTool` 增加 `onComplete` 参数，传给 `AgentNarrator`、`TypewriterText` 等组件。

### 8B：ToolSlot 聚焦/模糊样式

```tsx
// tool-slot.tsx
export function ToolSlot({ toolCall, children, isFocused = true }: {
  toolCall: ToolCallResult;
  children: ReactNode;
  isFocused?: boolean;
}) {
  return (
    <ToolSlotErrorBoundary>
      <div
        className={`story-cinema-bubble ${
          isFocused
            ? "story-cinema-focus spotlight-panel"
            : "story-cinema-dim"
        }`}
      >
        {children}
      </div>
    </ToolSlotErrorBoundary>
  );
}
```

### 8C：聚焦流转逻辑

按 tool 渲染顺序（narrate → image → choices → input）：
1. `narrate` 出现 → 聚焦 narrate 气泡，其他 dim
2. narrate `onComplete` → `setFocusIndex(next)`，聚焦移到 choices/input
3. `show_choices` / `show_text_input` 获得聚焦 → spotlight-panel 发光
4. 用户提交后 → 下一轮开始，focusIndex 重置为 0

### 8D：不模糊的区域

以下区域永远不参与 dim（它们在 ToolSlot 外部）：
- 顶部栏（sticky，z-10）
- 底部 InputBar（fixed，z 层级高于内容区）
- 机器人角色（fixed，z-20）

### 8E：可选 — 局部 spotlight 光斑

在聚焦 tool slot 上方叠加一个 `::before` 暖白径向光斑（`pointer-events: none`）：

```css
/* globals.css — 如需新增 */
.agent-focus-glow::before {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 30%,
    rgba(255, 250, 235, 0.5) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 300ms ease;
}
.agent-focus-glow.story-cinema-focus::before {
  opacity: 1;
}
```

### 8F：性能约束

- 移动端：降低 blur 强度（`blur(1px)` 而非 `blur(2px)`）
- `prefers-reduced-motion: reduce`：保留明暗层次，关闭呼吸/pulse 动画
- 所有 spotlight 层 `pointer-events: none`

**验收标准**：
- 当前说话的气泡高亮 + 发光
- 其他旧内容模糊 + 半透明 + 微缩小
- 聚焦随打字机完成自动流转
- 顶栏/底栏/机器人不受影响
- 多轮对话中聚焦不卡在旧位置
- 移动端无明显卡顿
- `npx tsc --noEmit` 通过

---

## 执行顺序建议

| 批次 | 任务 | 预估工时 | 可并行 |
|------|------|----------|--------|
| 第一批 | Task 1（TTS Hook） | 1h | 是 |
| 第一批 | Task 2（TypewriterText） | 1.5h | 是 |
| 第一批 | Task 3（追问补全） | 1h | 是 |
| 第二批 | Task 4（AgentNarrator 改造） | 1.5h | 依赖 1+2 |
| 第二批 | Task 5（TextInputSlot 改造） | 1h | 依赖 1+2 |
| 第二批 | Task 6（ChoiceGrid 改造） | 0.5h | 依赖 2 |
| 第三批 | Task 7（对话历史气泡） | 1.5h | 依赖 4 |
| 第三批 | Task 8（聚焦/模糊系统） | 2h | 依赖 4 |

---

## 全局验收检查清单

- [ ] `npx tsc --noEmit` 编译通过
- [ ] 追问场景：包含 `show_text_input` 的轮次都有语音播报
- [ ] narrate 文字逐字出现 + 闪烁光标 + 同步语音
- [ ] 打字机可点击跳过
- [ ] 输入框/选项卡在打字机完成后才激活/出现
- [ ] 当前气泡聚焦高亮 + 发光；旧内容模糊半透明
- [ ] 聚焦从 narrate → input 自动流转
- [ ] 多轮对话有历史气泡（用户右对齐，AI 左对齐）
- [ ] 历史消息为 dim 态
- [ ] 新内容出现时自动滚动到底部
- [ ] 顶栏/底栏/机器人不受模糊影响
- [ ] 移动端流畅无卡顿
- [ ] TTS 失败时打字机效果和输入激活节奏不受影响
