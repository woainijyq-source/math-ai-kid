# WPS 排版插件 - 任务追踪

## 里程碑 1：WPS 真机加载（当前）

### TASK-001: 验证 WPS 加载项注册 + Ribbon 显示
- status: done
- agent: tester
- acceptance: WPS 启动后顶部出现"规范排版助手" Tab 和"一键规范排版"按钮
- notes:
  - 已确认 `npx wpsjs debug -p 3889` 正常运行
  - 已确认 `http://127.0.0.1:3889/index.html` 与 `/ribbon.xml` 可访问
  - 已确认 `%AppData%\\kingsoft\\wps\\jsaddons\\publish.xml` 已指向 `http://127.0.0.1:3889/`
  - 已验证 `manifest.xml` 加入 `WpsAddinEntry` 后，构建仍成功
  - 当前阻塞：WPS 客户端启动异常，先后出现"启动文件损坏"与"核心支持库加载失败"提示，无法稳定进入真实文档编辑界面，因此 Ribbon 无法完成最终可见验证
  - 已确认 `%AppData%\\kingsoft\\wps\\jsaddons\\authaddin.json` 中 `WordNormFormatterWPS` 现为 `enable: true / isload: true / path: http://127.0.0.1:3889`
  - 当前更接近的根因：WPS 首页壳层/阻塞弹窗拦住了进入真实文档编辑态，导致 Ribbon 无法完成最终可见验证
  - 已准备本地测试文档：`C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\wpsDemo.docx`，后续进入编辑态时可直接用它验证 Ribbon
  - 已新增快速打开脚本：`scripts\open-test-doc.ps1`，后续可直接用 WPS 打开测试文档并缩短验证路径
  - 已新增一键回归脚本：`scripts\start-debug-and-open-doc.ps1`，可直接启动 `wpsjs debug -p 3889` 并打开 `wpsDemo.docx`
  - 已实测该脚本可正常启动 debug 并调用 WPS 打开测试文档，后续 Ribbon 回归验证统一优先走该路径
  - 2026-03-16 心跳补充发现：`%AppData%\\kingsoft\\wps\\jsaddons\\publish.xml` 实际曾残留为 `file:///.../wps-addon-build/` 的离线注册，和 TODO 里的 `http://127.0.0.1:3889/` 预期不一致；已新增 `scripts\\sync-wps-debug-registration.ps1` 强制回写在线调试注册，并让 `scripts\\start-debug-and-open-doc.ps1` 自动执行该修复
  - 2026-03-16 08:41 cron 自动补跑：已再次执行 `scripts\\start-debug-and-open-doc.ps1`，随后运行 `scripts\\analyze-ribbon-probe.ps1`；结果为 `STATUS: NO_LOG`，`logs\\ribbon-probe.log` 未生成，说明当前机器上的 WPS 仍未真正执行到加载项页面，TASK-001 仍需人工进入 WPS 客户端/开发者入口/加载项管理继续核查，暂无法仅靠后台脚本完成验收
  - 2026-03-16 09:06 cron 检查：TODO 中没有实际 `[ ]` 勾选项；按"首个未完成任务"解释时，TASK-001 仍排在最前，但当前阻塞点仍是 WPS 宿主侧人工操作（需进入 WPS 客户端/开发者入口/加载项管理），因此本轮跳过，未标记完成
  - 2026-03-16 09:21 cron 检查：再次按 `[ ]` 勾选项扫描，仍无可直接执行的复选框任务；若按未完成状态顺位，首项仍是 TASK-001，但依旧卡在 WPS 宿主人工操作，故本轮继续跳过，仅记录说明
  - 2026-03-16 09:36 cron 自动执行：已重跑 `scripts\start-debug-and-open-doc.ps1`，其间自动刷新 `publish.xml / jsplugins.xml / authaddin.json` 到 `http://127.0.0.1:3889/`，并尝试打开 `wpsDemo.docx`；随后运行 `scripts\analyze-ribbon-probe.ps1`，结果仍为 `STATUS: NO_LOG`。说明当前依旧不是前端脚本可见报错，而是 WPS 宿主未真正执行到加载项页面，本轮需继续按"需要用户手动操作"处理并跳过，未标记完成。
  - 2026-03-16 09:51 cron 检查：再次按 TODO 中的 `[ ]` 复选框扫描，当前仍无可直接勾选执行的新子任务；若按未完成项顺位，首项仍是 TASK-001，但阻塞点依旧是需要人工进入 WPS 客户端/开发者入口/加载项管理确认加载状态，因此本轮继续跳过，仅记录说明。
  - 2026-03-16 10:06 cron 检查：再次读取 TODO，当前依旧没有实际 `[ ]` 复选框任务；若按未完成状态顺位，首项仍是 TASK-001，但它仍需人工进入 WPS 客户端/开发者入口/加载项管理后才能继续验证 Ribbon 是否显示，因此本轮按"需要用户手动操作"跳过，未标记完成。
  - 2026-03-16 10:21 cron 检查：再次按 `[ ]` 复选框扫描，仍无新的未勾选子任务；若按未完成状态顺位，首项依旧是 TASK-001，但阻塞点还是需要人工进入 WPS 客户端/开发者入口/加载项管理确认加载状态，因此本轮继续跳过，仅补充记录说明。
  - 2026-03-16 10:36 cron 检查：再次读取 TODO，当前仍不存在实际 `[ ]` 复选框任务；若按未完成状态顺位，首项仍是 TASK-001，但它继续卡在需要人工进入 WPS 客户端/开发者入口/加载项管理的宿主侧操作，因此本轮按"需要用户手动操作"跳过，未标记完成。
  - 2026-03-16 10:51 cron 检查：再次按 TODO 中的 `[ ]` 复选框扫描，仍未发现可直接执行的未勾选子任务；若按未完成状态顺位，首项依旧是 TASK-001，但阻塞点仍是需要人工进入 WPS 客户端/开发者入口/加载项管理确认加载状态，因此本轮继续跳过，仅补充记录说明。
  - 2026-03-16 12:06 cron 检查：再次读取 TODO，当前仍不存在实际 `[ ]` 复选框未完成任务；若按最靠前的未完成事项理解，仍是 TASK-001，但它继续卡在需要人工进入 WPS 客户端/开发者入口/加载项管理的宿主侧操作，因此本轮按"需要用户手动操作"跳过，未标记完成。
  - 2026-03-16 12:15 真机确认：用户已确认 `规范排版助手` Tab 与 TaskPane 均可打开，说明 WPS 宿主加载主链路已经打通；TASK-001 以"显示已验证"视为完成。
- steps:
  1. 确认 npx wpsjs debug 正在运行（端口 3889）
  2. 浏览器访问 http://127.0.0.1:3889/ 确认可访问
  3. 确认 WPS 已开启开发者模式
  4. 重启 WPS Word，检查顶部 Ribbon
  5. 记录结果

### TASK-002: 验证 TaskPane 弹出
- status: done
- agent: tester
- depends_on: TASK-001
- acceptance: 点击"一键规范排版"按钮后，右侧 TaskPane 弹出
- notes:
  - 2026-03-16 12:15 真机确认：TaskPane 已可打开，当前已从"是否能弹出"进入"弹出后功能链是否顺畅"的阶段。
- steps:
  1. TASK-001 通过后执行
  2. 点击按钮，观察 TaskPane 是否弹出
  3. 查看 WPS 开发者控制台有无 JS 报错

### TASK-003: 修复加载问题（如有）
- status: done
- agent: coder
- depends_on: TASK-001 或 TASK-002 失败时触发
- acceptance: TASK-001 + TASK-002 全部通过；并把后续问题收敛到 TaskPane 内的配置、预览、样式应用链路
- notes:
  - 已修复 debug 端口错配：统一到 3889
  - 已将 `package.json` 中 debug/debug:server 固定为 3889
  - 已补 `manifest.xml` 的 `WpsAddinEntry`
  - 当前剩余问题已转移为：WPS 客户端本身启动异常，需要继续寻找可自动修复入口或等待人工修复
  - 新发现：`%AppData%\\kingsoft\\wps\\jsaddons\\authaddin.json` 中 `WordNormFormatterWPS` 曾被标记为 `enable: false`，已改为 `true`，需重新验证是否因此恢复 Ribbon 显示
  - 2026-03-16 已补一层自动修复：启动联调脚本时同步刷新 `publish.xml` 为 `jspluginonline + http://127.0.0.1:3889/`，避免被旧的 build/publish 产物注册覆盖
  - 2026-03-16 已新增本地探针链路：`js/probe.js` + `scripts/ribbon-probe-server.js`，并接入 `OnAddinLoad / OnAction / GetImage / TaskPane.loaded`；后续即使 Ribbon 不可见，也可先看 `logs/ribbon-probe.log` 判断 WPS 是否真正执行到加载项回调
  - 2026-03-16 已补 `scripts/analyze-ribbon-probe.ps1`，可把 `ribbon-probe.log` 自动归因为 `NOT_TRIGGERED / ADDIN_LOADED / ACTION_TRIGGERED / TASKPANE_LOADED / ONLOAD_ERROR`
  - 2026-03-16 新线索：本机 `office6\\cfgs\\setup.cfg` / `oem.ini` 缺失，而 `wpsjs` 源码显示这种情况下更可能走 `jsplugins.xml` 调试链路；因此已把注册修复从"只写 publish.xml"升级为"同时写 publish.xml + jsplugins.xml`
  - 2026-03-16 已补 `docs\\WPS-MANUAL-CHECKLIST.md`，把 `NOT_TRIGGERED` 场景下的人工核查项收口为：关闭全部 WPS → 重跑联调脚本 → 打开开发者入口 → 检查加载项/禁用项 → 再跑 probe 分析
  - 2026-03-16 新进展：已补 `scripts\\sync-wps-local-registration.ps1` 与 `scripts\\restart-wps-and-open-doc.ps1`，把本地文件模式收口为"同时回写 publish.xml + jsplugins.xml 到 `wps-addon-build\\`，再强制重启 WPS 并打开测试文档"，避免继续依赖 debug 服务器
  - 2026-03-16 08:41 cron 自动补跑结论：在线调试链路已重跑，注册刷新成功，但探针分析仍返回 `NO_LOG`；当前更像是 WPS 客户端/壳层未加载插件，而不是前端代码报错，后续优先走 `docs\\WPS-MANUAL-CHECKLIST.md` 的人工核查路径
  - [x] 2026-03-16 08:51 cron 新增并执行 `scripts\\auto-diagnose-wps-load.ps1`：脚本已串联"在线 debug 注册 → probe 分析 → 本地文件注册回退 → 再分析"；实测两条链路均返回 `STATUS: NO_LOG`，进一步坐实当前阻塞点仍在 WPS 宿主侧而非前端代码侧

## 里程碑 2：核心功能联调

### TASK-004: WPS JS API 段落读取
- status: in_progress
- agent: coder
- acceptance: 能读取 WPS 文档所有段落文本和现有样式
- notes:
  - 2026-03-16 已补底层诊断接口 `getParagraphDiagnostics(limit)`：返回段落序号、归一化文本、当前样式名
  - 2026-03-16 已在 `ui/taskpane.html` 增加"读取文档段落"按钮，可直接把前 20 段及其样式打到日志区，用于真机验证 TASK-004
  - 2026-03-16 13:06 cron 自动推进：已增强段落读取兼容层，`getParagraphDiagnostics()` 不再只依赖 `doc.Paragraphs.Count / Item(i) / para.Range.Text` 这一种对象形态，现额外兼容 `get_Paragraphs / get_Count / get_Item / get_Range / get_Text` 及索引回退；并已执行 `scripts\sync-build-assets.ps1` 同步到 `wps-addon-build\`。下一步仍需真机点击"读取文档段落"完成验收。
  - 2026-03-16 13:51 cron 检查：再次按 TODO 中实际的 `[ ]` 复选框扫描，当前仍未发现可直接执行的未勾选项；文档内仅有状态字段（如 `in_progress / pending`）与已完成的 `[x]` 记录，没有新的 `[ ]` 子任务，因此本轮无可直接执行项，也无需改勾选状态。

### TASK-005: Cloudflare Worker 对接
- status: in_progress
- agent: coder
- acceptance: 段落文本发送到 Worker，返回样式标注结果
- notes:
  - 2026-03-16 已抽出 `getWorkerConfig()` 与 `requestWorker()`，把 Worker 请求逻辑从分类流程中独立出来
  - 2026-03-16 已新增 `testWorkerConnection()`，并在 taskpane 中加入"测试 Worker"按钮，可先独立验证连通性、鉴权与 JSON 响应，再进入真实分类链路
  - 2026-03-16 09:03 心跳修复：`js/ai.js` 源文件曾被截断，且 `requestWorker()` 错误引用未定义变量 `paragraphs`，会导致"测试 Worker / 预览样式应用 / 一键规范排版"三条链路直接报错；现已重写 `getWorkerConfig / requestWorker / testWorkerConnection / classifyParagraphs`，并同步到 `wps-addon-build/js/ai.js`
  - 2026-03-16 09:17 心跳验证：已用 Node `vm.Script` 对源码与 `wps-addon-build/js/ai.js` 做静态语法检查，结果均为 OK，至少已排除 JS 文件本身的语法损坏
  - 2026-03-16 12:15 真机新进展：用户已确认 `规范排版助手` Tab 与 TaskPane 可打开；当前第一处真实错误已收敛为"未填写 Cloudflare Worker 地址"，说明 TASK-001/002 已基本打通，主阻塞已转移到 TASK-005/006 的运行体验与配置引导
  - 2026-03-16 已补本地降级预览：当 Worker 未配置时，`previewOneClickFormatting()` 自动切到 `localHeuristicClassify()`，保证用户仍可先验证"读段落 + 样式预览"链路，而不是所有按钮一起报错
  - 2026-03-16 已补 `scripts\\sync-build-assets.ps1`，用于把 `ui/taskpane.html`、`js/*.js`、`ribbon.xml` 等当前源码同步进 `wps-addon-build\\`，避免本地文件模式下 WPS 继续跑旧 build 代码
  - [x] 2026-03-16 12:36 cron 收口：按当前 TODO 顺位，首个未完成事项已推进为 TASK-003。现已满足其验收口径--TASK-001 / TASK-002 已通过，问题已从"加载是否成功"收敛到 TaskPane 内的 Worker 配置、预览与样式应用链路，因此将 TASK-003 标记为 done。

### TASK-006: 样式应用
- status: in_progress
- agent: coder
- depends_on: TASK-004, TASK-005
- acceptance: 根据 AI 返回结果，正确应用 WPS 样式到段落
- notes:
  - 2026-03-16 已补 `resolveWritableStyle()`，对 Heading 1/2/3 与 正文增加中英样式名候选，降低不同 WPS 环境下的样式名不兼容风险
  - 2026-03-16 已补 `previewOneClickFormatting(limit)`，并在 taskpane 中新增"预览样式应用"按钮，可先查看 `beforeStyle -> afterStyle`，再决定是否真实写入
  - 2026-03-16 `runOneClickFormatting()` 现会返回 `applied[]` 明细，便于后续在日志区或调试输出中核对每段应用结果
  - 2026-03-16 已补 `normalizeStyleName()`，兼容 WPS 返回样式对象/名称两种形态，修复 TaskPane 预览与 applied 明细中 `beforeStyle` 偶发显示为 `[object Object]`

### TASK-007: 端到端测试
- status: in_progress
- agent: tester
- depends_on: TASK-006
- acceptance: 打开一份乱格式文档，点击按钮，10 秒内完成排版
- notes:
  - 2026-03-16 已新增 `docs\TASK-007-E2E-CHECKLIST.md`，把当前真机联调前置条件、四按钮点击顺序、成功判定、失败归因统一收口
  - 当前测试口径明确固定为"本地文件模式 + TaskPane 按钮面板"，不回退到旧的在线 debug 模式
  - 当前建议执行顺序：`探测 WPS 能力` → `读取文档段落` → `测试 Worker` → `预览样式应用` → `一键规范排版`
  - 2026-03-16 已补"探测 WPS 能力"入口：可在真机中统一输出 Application / ActiveDocument / Selection / Paragraphs / Styles / Tables / Shapes / InlineShapes / Sections / PageSetup / Fields / Headers / Footers 的可访问状态，便于先确认宿主开放边界再继续调功能
  - **2026-03-16 15:14 真机探测已完成**：13 项核心对象全部可访问（Application, ActiveDocument, Selection, Paragraphs, Styles, Tables, Shapes, InlineShapes, Sections, PageSetup, Fields, Headers, Footers），0 项缺失，0 项报错。结果已回填至 `docs/results/2026-03-16/run-01/TASK-007-RUN.md` 和 `docs/WPS-CAPABILITY-MAP.md`
  - 当前最小通过标准：Ribbon/TaskPane 可见、读取文档成功、未配置 Worker 时预览可走本地降级
  - 当前标准通过标准：真实 Worker 可连通、预览结果合理、真实样式写回成功且文本不变
  - 2026-03-16 已补真机执行记录模板与留档目录约定：`docs\results\TEMPLATE-TASK-007-RUN.md` + `docs\results\README.md`
  - 后续每轮真机联调统一把结果落到 `docs\results\YYYY-MM-DD\run-XX\TASK-007-RUN.md`，截图放 `screenshots\`，日志放 `logs\`
  - 2026-03-16 已完成 run-01 留档准备：`docs\results\2026-03-16\run-01\` 已创建，包含 `TASK-007-RUN.md`、`screenshots\README.md`、`logs\README.md`；其中执行记录已按当前已知上下文预填，但尚未写入任何伪造测试结果
  - 2026-03-16 12:43 回填 run-01 已确认事实：用户已确认 Ribbon / TaskPane 可打开；最新真机截图已确认点击"一键规范排版"后日志进入【开始】/步骤/【失败】结构，失败点收敛为"未填写 Cloudflare Worker 地址"；下一步最小测试动作优先为"读取文档段落"与"预览样式应用"留档
  - 2026-03-16 12:50 run-01 新增已确认事实：本次真机实际点击的是"预览样式应用"；日志显示【开始】预览样式应用，并明确写出"按配置决定走 Worker 或本地启发式分类""输出 beforeStyle -> afterStyle 预览，不真实改文档"；结果为【成功】预览样式应用，预览来源为"本地启发式"，降级原因为"未配置 Worker，自动切换到本地启发式预览"；同时新发现 `beforeStyle` 在日志中显示为 `[object Object]`，需继续修复样式展示格式
- steps:
  1. 执行 `scripts\sync-build-assets.ps1`，确保本地文件模式加载的是最新源码
  2. 执行 `scripts\sync-wps-local-registration.ps1`
  3. 执行 `scripts\restart-wps-and-open-doc.ps1`
  4. 在 WPS 中确认 `规范排版助手` Tab 与 TaskPane 可见
  5. 依次点击 `探测 WPS 能力`、`读取文档段落`、`测试 Worker`、`预览样式应用`、`一键规范排版`
  6. 按 `docs\TASK-007-E2E-CHECKLIST.md` 记录成功判定、失败日志和归因

## 里程碑 3：UI 完善 + 发布

### TASK-008: UI 美化
- status: pending
### TASK-009: 预览/回滚功能
- status: pending
### TASK-010: 打包分发
- status: pending

---
最后更新：2026-03-16
