# WPS 排版插件 — 任务追踪

## 里程碑 1：WPS 真机加载（当前）

### TASK-001: 验证 WPS 加载项注册 + Ribbon 显示
- status: pending
- agent: tester
- acceptance: WPS 启动后顶部出现"规范排版助手" Tab 和"一键规范排版"按钮
- steps:
  1. 确认 npx wpsjs debug 正在运行（端口 3889）
  2. 浏览器访问 http://127.0.0.1:3889/ 确认可访问
  3. 确认 WPS 已开启开发者模式
  4. 重启 WPS Word，检查顶部 Ribbon
  5. 记录结果

### TASK-002: 验证 TaskPane 弹出
- status: pending
- agent: tester
- depends_on: TASK-001
- acceptance: 点击"一键规范排版"按钮后，右侧 TaskPane 弹出
- steps:
  1. TASK-001 通过后执行
  2. 点击按钮，观察 TaskPane 是否弹出
  3. 查看 WPS 开发者控制台有无 JS 报错

### TASK-003: 修复加载问题（如有）
- status: pending
- agent: coder
- depends_on: TASK-001 或 TASK-002 失败时触发
- acceptance: TASK-001 + TASK-002 全部通过

## 里程碑 2：核心功能联调

### TASK-004: WPS JS API 段落读取
- status: pending
- agent: coder
- acceptance: 能读取 WPS 文档所有段落文本和现有样式

### TASK-005: Cloudflare Worker 对接
- status: pending
- agent: coder
- acceptance: 段落文本发送到 Worker，返回样式标注结果

### TASK-006: 样式应用
- status: pending
- agent: coder
- depends_on: TASK-004, TASK-005
- acceptance: 根据 AI 返回结果，正确应用 WPS 样式到段落

### TASK-007: 端到端测试
- status: pending
- agent: tester
- depends_on: TASK-006
- acceptance: 打开一份乱格式文档，点击按钮，10 秒内完成排版

## 里程碑 3：UI 完善 + 发布

### TASK-008: UI 美化
- status: pending
### TASK-009: 预览/回滚功能
- status: pending
### TASK-010: 打包分发
- status: pending

---
最后更新：2026-03-15
