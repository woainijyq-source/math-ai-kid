# WordNormFormatterWPS

WPS 文字加载项 MVP：**一键规范排版**

## 当前状态
项目已切换并收口到 **WPS 官方 `wpsjs` 路线**，当前验证通过：

- `npx wpsjs debug -p 3889` ✅
- `npx wpsjs build` ✅
- `npx wpsjs publish --serverUrl http://127.0.0.1:3889/` ✅

已确认 `wpsjs debug` 会：
- 启动本地服务（固定端口：`http://127.0.0.1:3889/`）
- 写入 `%AppData%\kingsoft\wps\jsaddons\publish.xml`
- 拉起 WPS 文字进行官方调试

## 项目目标
- 一个大按钮：**一键规范排版**
- 支持样式：`Heading 1` / `Heading 2` / `Heading 3` / `正文`
- AI **只识别结构并回传样式标签**，**绝不修改任何文字内容**
- OpenAI 请求统一走 **Cloudflare Worker 代理**
- 面向零基础 Windows 用户

## 当前项目结构

```txt
WordNormFormatterWPS/
├─ manifest.xml
├─ ribbon.xml
├─ index.html
├─ main.js
├─ package.json
├─ js/
│  ├─ util.js
│  ├─ config.js
│  ├─ ai.js
│  ├─ formatter.js
│  └─ ribbon.js
├─ ui/
│  └─ taskpane.html
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ PROJECT-BASELINE.md
│  ├─ TASK-007-E2E-CHECKLIST.md
│  ├─ TESTING.md
│  ├─ WPS-CAPABILITY-MAP.md
│  └─ WPS-LOAD-STEPS.md
├─ wps-addon-build/      # build 产物
└─ wps-addon-publish/    # publish 产物（含 publish.html）
```

## 先改这一个文件
先把 `js/config.js` 里的 Worker 配置改成你自己的：

```js
window.WordNormConfig = {
  workerBaseUrl: 'https://your-worker.example.workers.dev',
  workerApiKey: 'replace-me',
  model: 'gpt-4.1-mini'
};
```

## 常用命令

### 安装依赖
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npm install
```

### 官方调试
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npx wpsjs debug
```

### 仅启动调试服务
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npx wpsjs debug --server
```

### 打包
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npx wpsjs build
```

### 生成发布页
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npx wpsjs publish --serverUrl http://127.0.0.1:3889/
```

### 直接打开本地测试文档
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
powershell -ExecutionPolicy Bypass -File .\scripts\open-test-doc.ps1
```

### 本地文件模式：重启 WPS 并打开测试文档
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
powershell -ExecutionPolicy Bypass -File .\scripts\restart-wps-and-open-doc.ps1
```

### 仅刷新本地文件注册（publish.xml + jsplugins.xml）
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
powershell -ExecutionPolicy Bypass -File .\scripts\sync-wps-local-registration.ps1
```

### 老的 debug 联调脚本（仅排查时使用）
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
powershell -ExecutionPolicy Bypass -File .\scripts\start-debug-and-open-doc.ps1
```

### 分析 Ribbon / TaskPane 探针日志
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
powershell -ExecutionPolicy Bypass -File .\scripts\analyze-ribbon-probe.ps1
```

测试文档路径：
```text
C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\wpsDemo.docx
```

## 关键产物
### WPS 本地调试注册文件
```text
%AppData%\kingsoft\wps\jsaddons\publish.xml
```

### build 产物目录
```text
C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\wps-addon-build
```

### publish 页面
```text
C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\wps-addon-publish\publish.html
```

## 能力地图 / 演进蓝图
- `docs/WPS-CAPABILITY-MAP.md`
  - 说明当前 MVP 已验证能力、待验证能力、潜在边界
  - 明确区分 AI 负责什么、WPS 宿主/API 负责什么
  - 给出从“段落结构分类 MVP”演进到“复杂文书一键排版”的分阶段 roadmap

## 当前剩余工作
- 按 `docs/TASK-007-E2E-CHECKLIST.md` 逐项完成真机联调记录
- 每轮真机验证完成后，把结果留档到 `docs/results/`（模板：`docs/results/TEMPLATE-TASK-007-RUN.md`）
- 验证 taskpane 中“读取文档段落”按钮能否稳定打印前 20 段文本及现有样式
- 验证 taskpane 中“测试 Worker”按钮能否独立返回 JSON 健康检查结果
- 验证 taskpane 中“预览样式应用”按钮能否在两种模式下工作：
  - 已配置 Worker → 返回 AI 预览
  - 未配置 Worker → 自动走本地启发式预览，先验证“读段落 + 预览”链路
- 配置真实 Worker 后验证“一键规范排版”在真实乱格式文档上的写回效果与耗时
- 收集失败样例并按“宿主加载 / 文档读取 / Worker 配置 / Worker 服务 / 样式写回 / 分类质量”归因

## 端到端联调入口
当前推荐固定走 **本地文件模式 + TaskPane 四按钮**，不要退回到旧的在线 debug 口径：

1. 执行 `scripts\sync-build-assets.ps1`
2. 执行 `scripts\sync-wps-local-registration.ps1`
3. 执行 `scripts\restart-wps-and-open-doc.ps1`
4. 在 WPS 中打开 TaskPane，按以下顺序点击：
   - `读取文档段落`
   - `测试 Worker`
   - `预览样式应用`
   - `一键规范排版`

详细成功判定与失败归因见：`docs/TASK-007-E2E-CHECKLIST.md`

真机结果留档位置：`docs/results/`
- 模板：`docs/results/TEMPLATE-TASK-007-RUN.md`
- 约定说明：`docs/results/README.md`
- 2026-03-16 run-01 已预创建：`docs/results/2026-03-16/run-01/`
  - 执行记录：`docs/results/2026-03-16/run-01/TASK-007-RUN.md`
  - 截图目录：`docs/results/2026-03-16/run-01/screenshots/`
  - 日志目录：`docs/results/2026-03-16/run-01/logs/`
  - 当前状态：已按模板预填已知上下文，待真机执行后回填实际结果

## TaskPane 日志口径（当前真机联调用）
当前 TaskPane 按钮都已统一为“开始 → 步骤 → 成功摘要 / 失败归因提示”的日志结构，便于在 WPS 真机里直接截图或抄关键字排查：

- `读取文档段落`
  - 输出：总段落数、有效段落数、前 20 条 `#序号 [当前样式] 文本摘要`
  - 失败时优先提示：宿主 / 文档对象 / 段落过滤问题
- `测试 Worker`
  - 输出：连通性测试耗时、返回 JSON 摘要
  - 失败时优先提示：配置缺失 / 鉴权 / 网络 / Worker 协议
- `预览样式应用`
  - 输出：共分析多少段、当前使用 `Worker` 还是 `本地启发式`、前若干条 `beforeStyle -> afterStyle`
  - 当前已对 WPS 返回的样式对象做名称规范化，避免日志里出现 `[object Object]`
  - 未配置 Worker 时，会明确打印“自动切换到本地启发式预览”
- `一键规范排版`
  - 输出：总处理段数、耗时、样式统计、前几条真实写回明细
  - 失败时优先提示：文档读取 / Worker 返回 / 样式写回 三段中的哪一段更可疑

如果你要做 TASK-007 真机联调，建议把日志区当成第一现场，先看“【开始】停在哪一步”，再看后面的“失败归因提示”。
ker 时，会明确打印“自动切换到本地启发式预览”
- `一键规范排版`
  - 输出：总处理段数、耗时、样式统计、前几条真实写回明细
  - 失败时优先提示：文档读取 / Worker 返回 / 样式写回 三段中的哪一段更可疑

如果你要做 TASK-007 真机联调，建议把日志区当成第一现场，先看“【开始】停在哪一步”，再看后面的“失败归因提示”。
��归因提示”。
�。
