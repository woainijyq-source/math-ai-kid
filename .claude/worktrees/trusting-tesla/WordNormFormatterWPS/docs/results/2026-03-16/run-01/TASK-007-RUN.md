# TASK-007 真机执行记录

> 本文件基于当前已确认的真机结果回填 run-01 留档。
> 当前状态：**部分已确认，未执行项保持待测**。仅记录已看到/已确认事实，不补写未发生内容。

---

## 1. 基本信息

- 测试日期：2026-03-16
- 测试轮次：run-01
- 测试人：用户真机确认 + 当前回填
- 项目分支 / 提交：当前仓库未提供可用 git 提交号（待补）
- WPS 版本：待填写
- 测试模式：本地文件模式
- 测试入口：TaskPane 四按钮
- 测试文档：`wpsDemo.docx`（默认）
- Worker 场景：当前已确认的是"未配置 Worker"场景
- Worker 地址（可脱敏）：未填写
- 本轮目标：按当前已确认事实回填 run-01 留档，并明确未执行项保持待测

## 2. 前置准备

### 2.1 执行命令

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-build-assets.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\sync-wps-local-registration.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\restart-wps-and-open-doc.ps1
```

### 2.2 前置检查结果

- [ ] `wps-addon-build\` 已同步最新源码（本轮未单独留档）
- [ ] WPS 本地注册已指向当前 `wps-addon-build\`（本轮未单独留档）
- [ ] `wpsDemo.docx` 已成功打开（本轮未单独留档）
- [x] `规范排版助手` Tab 可见（用户已确认）
- [x] TaskPane 可打开（用户已确认）
- [ ] TaskPane 日志区已出现加载提示（未单独留档，待补）

前置异常 / 补充说明：

```text
已知上下文（本轮回填依据）：
1) 用户已确认 `规范排版助手` Tab 与 TaskPane 均可打开，说明 WPS 宿主加载主链路已打通。
2) 本次真机实际点击的是"预览样式应用"。
3) 日志已确认进入【开始】预览样式应用，并明确写出"按配置决定走 Worker 或本地启发式分类""输出 beforeStyle -> afterStyle 预览，不真实改文档"。
4) 本次结果为【成功】预览样式应用；预览来源为"本地启发式"。
5) 降级原因为"未配置 Worker，自动切换到本地启发式预览"。
6) 同时发现一个新问题：`beforeStyle` 在日志中显示为 `[object Object]`，说明样式展示格式仍需修复。
7) 当前不补写未执行内容；"读取文档段落""测试 Worker""一键规范排版"等仍保持待测。
```

## 3. 执行记录

### Step 0 - 宿主加载确认
- 结果：通过
- 耗时：未记录
- 关键观察：
  - 用户已确认 `规范排版助手` Tab 可见。
  - 用户已确认 TaskPane 可打开。
  - TaskPane 日志区可正常显示。
- 截图：
  - [ ] `screenshots/01-ribbon.png`
  - [ ] `screenshots/02-taskpane.png`
- 日志摘录：

```text
用户已确认：Ribbon 与 TaskPane 均可打开，宿主加载主链路已打通。
```

### Step 1 - 探测 WPS 能力
- 结果：已执行，全部通过
- 耗时：未记录
- 关键观察：
  - 探测对象数：13 项
  - 全部可访问：13 项
  - 缺失对象：0 项
  - 报错对象：0 项
- 探测结果明细：
  - Application: 可访问 (Name=Microsoft Word)
  - ActiveDocument: 可访问 (Name=新建 DOCX 文档.docx)
  - Selection: 可访问
  - Paragraphs: 可访问 (Count=5)
  - Styles: 可访问 (Count=478)
  - Tables: 可访问
  - Shapes: 可访问
  - InlineShapes: 可访问
  - Sections: 可访问 (Count=1, Headers=3, Footers=3)
  - PageSetup: 可访问 (TopMargin=72, BottomMargin=72)
  - Fields: 可访问
  - Headers: 可访问 (Count=3)
  - Footers: 可访问 (Count=3)
- 截图：
  - [ ] `screenshots/03-probe-result.png`
- 日志摘录：

```text
【开始】探测 WPS 能力
探测对象：Application, ActiveDocument, Selection, Paragraphs, Styles, Tables, Shapes, InlineShapes, Sections, PageSetup, Fields, Headers, Footers
【成功】探测 WPS 能力
探测到 13 项对象，全部可访问，0 项缺失，0 项报错
```

### Step 2 - 测试 Worker
- 结果：未单独执行留档
- 耗时：待填写
- 当前场景：未配置 Worker
- 关键观察：
  - 本轮没有单独点击"测试 Worker"的实录。
  - JSON 返回是否合理：待判定
  - 当前已知上下文：Worker 仍未配置，但"预览样式应用"已确认可自动降级到本地启发式预览。
- 截图：
  - [ ] `screenshots/04-worker-test.png`
- 日志摘录：

```text
本轮没有单独点击"测试 Worker"的实录。
当前仅能确认：未配置 Worker 时，预览链路会自动切到本地启发式预览。
```

### Step 3 - 预览样式应用
- 结果：已执行，成功
- 耗时：未记录
- 预览来源：本地启发式
- 关键观察：
  - 已确认本次实际点击的是"预览样式应用"。
  - 日志已出现【开始】预览样式应用。
  - 日志已明确写出：按配置决定走 Worker 或本地启发式分类。
  - 日志已明确写出：输出 `beforeStyle -> afterStyle` 预览，不真实改文档。
  - 本次结果为【成功】预览样式应用。
  - 已确认因未配置 Worker，自动切换到本地启发式预览。
  - 新发现：日志中的 `beforeStyle` 当前显示成 `[object Object]`，样式展示格式仍需修复。
  - 预览内容是否逐条完全合理：本轮仅按已确认事实留档，暂不扩写未核实判断。
- 截图：
  - [ ] `screenshots/05-preview.png`
- 日志摘录：

```text
【开始】预览样式应用
按配置决定走 Worker 或本地启发式分类
输出 beforeStyle -> afterStyle 预览，不真实改文档
【成功】预览样式应用
预览来源：本地启发式
降级原因：未配置 Worker，自动切换到本地启发式预览
补充问题：beforeStyle 在日志中显示为 [object Object]
```

### Step 4 - 一键规范排版
- 结果：待补正式留档
- 耗时：待填写
- 关键观察：
  - 本轮未新增可直接回填到本步骤的已确认事实。
  - 若引用更早上下文，应单独核对附件/截图后再补，不与本次"预览样式应用"结果混写。
- 截图：
  - [ ] `screenshots/06-final-doc.png`
- 日志摘录：

```text
本轮未对"一键规范排版"新增正式留档，保持待补。
```

## 4. 最终判定

### 4.1 按按钮汇总
- Ribbon / TaskPane：已确认可打开
- 探测 WPS 能力：已执行并成功，13 项对象全部可访问
- 读取文档段落：待执行
- 测试 Worker：未单独执行留档
- 预览样式应用：已执行并成功；未配置 Worker 时自动降级到本地启发式预览
- 一键规范排版：待补正式留档

### 4.2 本轮结论
- [ ] 基础通过
- [ ] 标准通过
- [ ] 理想通过
- [ ] 尚未执行，本文件仅完成 run-01 留档准备
- [x] 未通过，需要继续排查

结论说明：

```text
run-01 已确认宿主加载主链路可用：Ribbon 与 TaskPane 均可打开。
WPS 宿主能力探测已完成：13 项核心对象（Application, ActiveDocument, Selection, Paragraphs, Styles, Tables, Shapes, InlineShapes, Sections, PageSetup, Fields, Headers, Footers）全部可访问，0 项缺失，0 项报错。
同时已确认"预览样式应用"可在未配置 Worker 的场景下成功执行，并自动降级到本地启发式预览；日志已明确写出"按配置决定走 Worker 或本地启发式分类"以及"输出 beforeStyle -> afterStyle 预览，不真实改文档"。
本轮也新增暴露出一个显示问题：`beforeStyle` 在日志中显示为 `[object Object]`，说明样式展示格式仍需修复。
由于"读取文档段落""测试 Worker"以及真实"一键规范排版"本轮仍未补齐正式留档，且真实 Worker 仍未配置，因此本轮仍不能判定为基础通过；未执行项继续保持待测。
```

## 5. 失败归因

> 本轮不是"预览样式应用执行失败"，而是"仍存在待测项和一个新暴露的显示问题"。

- 初步归因：未配置 Worker 的场景已被本地启发式预览兜底；当前主要问题转为日志展示格式缺陷
- 具体现象：`beforeStyle` 在日志中显示为 `[object Object]`
- 复现稳定性：基于本次真机结果已确认 1 次
- 是否已定位到明确步骤：是，出现在"预览样式应用"的日志展示阶段
- 是否有替代链路可继续验证：有

详细说明：

```text
当前已确认的归因/问题：
1) 这不是 Ribbon/TaskPane 打不开的问题；宿主加载主链路已确认可用。
2) 这也不是"按钮一点击就完全没反应"的问题；因为最新真机结果已显示"预览样式应用"日志进入【开始】并最终【成功】。
3) 未配置 Worker 不再导致预览链路直接失败；当前已确认会自动降级到本地启发式预览。
4) 当前新暴露的问题是日志展示格式：`beforeStyle` 被打印成 `[object Object]`，需要继续修复样式名/样式对象的显示逻辑。
5) 是否存在其他后续问题（如读取文档明细、测试 Worker 真连通、真实样式写回、文本保持不变、处理统计、耗时）本轮尚未执行到，继续保持待测。
```

## 6. 附件清单

### 6.1 截图
- [ ] `screenshots/01-ribbon.png`
- [ ] `screenshots/02-taskpane.png`
- [ ] `screenshots/03-read-paragraphs.png`
- [ ] `screenshots/04-worker-test.png`
- [ ] `screenshots/05-preview.png`
- [ ] `screenshots/06-final-doc.png`

### 6.2 日志 / 导出
- [ ] `logs/taskpane-log.txt`
- [ ] `logs/probe-summary.txt`
- [ ] 其他：`logs/README.txt`（可选，记录本轮额外脚本输出）

## 7. 下一步最小测试动作

1. 保持当前本地文件模式，不先填 Worker。
2. 优先补齐本轮"预览样式应用"截图 / 原始日志留档，尤其是 `beforeStyle` 显示成 `[object Object]` 的问题证据。
3. 在 TaskPane 中补点 **"读取文档段落"**，确认日志能输出前若干段的段落序号 / 样式 / 文本摘要，并截图留档。
4. 再决定是否补测"测试 Worker"或真实"一键规范排版"，不要把未配置 Worker 的本地预览结果与真实 Worker / 真实写回结果混写。

补充建议：
- 下一轮优先把 `screenshots/05-preview.png` 与对应日志补齐；当前它已从"待测"变成"已成功但缺正式附件"，同时还能直接支撑修复 `[object Object]` 显示问题。
- 若后续补填 Worker，再单独记录 Worker 地址是否已配置、`测试 Worker` 返回是否正常，不要和本轮未配置场景混写。

## 8. 一句话摘要

```text
run-01 已确认 WPS 宿主加载主链路打通，且 13 项核心 WPS 对象全部可访问（0 缺失 0 报错）；"预览样式应用"在未配置 Worker 时已可成功走本地启发式预览；同时新发现 `beforeStyle` 日志显示为 `[object Object]` 的格式问题，其余未执行项继续待测，下一步应优先补齐预览附件并修复样式展示。
```