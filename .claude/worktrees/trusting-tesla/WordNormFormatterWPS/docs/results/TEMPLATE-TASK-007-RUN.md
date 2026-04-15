# TASK-007 真机执行记录

> 使用方式：复制本文件到当次结果目录，例如 `docs/results/2026-03-16/run-01/TASK-007-RUN.md`，然后按实际测试填写。

---

## 1. 基本信息

- 测试日期：
- 测试轮次：
- 测试人：
- 项目分支 / 提交：
- WPS 版本：
- 测试模式：本地文件模式
- 测试入口：TaskPane 四按钮
- 测试文档：
- Worker 场景：未配置 / 已配置
- Worker 地址（可脱敏）：
- 本轮目标：

## 2. 前置准备

### 2.1 执行命令

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-build-assets.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\sync-wps-local-registration.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\restart-wps-and-open-doc.ps1
```

### 2.2 前置检查结果

- [ ] `wps-addon-build\` 已同步最新源码
- [ ] WPS 本地注册已指向当前 `wps-addon-build\`
- [ ] `wpsDemo.docx` 已成功打开
- [ ] `规范排版助手` Tab 可见
- [ ] TaskPane 可打开
- [ ] TaskPane 日志区已出现加载提示

前置异常 / 补充说明：

```text
（无则写“无”）
```

## 3. 执行记录

### Step 0 - 宿主加载确认
- 结果：通过 / 失败
- 耗时：
- 关键观察：
- 截图：
  - [ ] `screenshots/01-ribbon.png`
  - [ ] `screenshots/02-taskpane.png`
- 日志摘录：

```text
```

### Step 1 - 读取文档段落
- 结果：通过 / 失败
- 耗时：
- 关键观察：
  - 总段落数：
  - 有效段落数：
  - 样式返回是否合理：是 / 否
- 截图：
  - [ ] `screenshots/03-read-paragraphs.png`
- 日志摘录：

```text
```

### Step 2 - 测试 Worker
- 结果：通过 / 失败 / 不适用
- 耗时：
- 当前场景：未配置 / 已配置
- 关键观察：
  - 配置缺失提示是否符合预期：是 / 否 / 不适用
  - JSON 返回是否合理：是 / 否 / 不适用
- 截图：
  - [ ] `screenshots/04-worker-test.png`
- 日志摘录：

```text
```

### Step 3 - 预览样式应用
- 结果：通过 / 失败
- 耗时：
- 预览来源：Worker / 本地启发式
- 关键观察：
  - 是否输出 `beforeStyle -> afterStyle`：是 / 否
  - 预览是否合理：是 / 否
  - 是否确认“仅预览、未改正文”：是 / 否
- 截图：
  - [ ] `screenshots/05-preview.png`
- 日志摘录：

```text
```

### Step 4 - 一键规范排版
- 结果：通过 / 失败
- 耗时：
- 关键观察：
  - 是否 10 秒内完成：是 / 否
  - 是否输出处理统计：是 / 否
  - 文本内容是否保持不变：是 / 否
  - 样式写回是否符合预期：是 / 否
- 截图：
  - [ ] `screenshots/06-final-doc.png`
- 日志摘录：

```text
```

## 4. 最终判定

### 4.1 按按钮汇总
- Ribbon / TaskPane：通过 / 失败
- 读取文档段落：通过 / 失败
- 测试 Worker：通过 / 失败 / 不适用
- 预览样式应用：通过 / 失败
- 一键规范排版：通过 / 失败

### 4.2 本轮结论
- [ ] 基础通过
- [ ] 标准通过
- [ ] 理想通过
- [ ] 未通过，需要继续排查

结论说明：

```text
```

## 5. 失败归因

> 没失败也建议写“本轮未见失败”。

- 初步归因：宿主加载 / 文档读取 / Worker 配置 / Worker 服务 / 样式写回 / 分类质量 / 其他
- 具体现象：
- 复现稳定性：必现 / 偶现 / 本轮一次性出现
- 是否已定位到明确步骤：是 / 否
- 是否有替代链路可继续验证：

详细说明：

```text
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
- [ ] 其他：

## 7. 下轮建议动作

- 建议 1：
- 建议 2：
- 建议 3：

## 8. 一句话摘要

```text
示例：本轮在“本地文件模式 + TaskPane 四按钮”下已跑通读取、预览与真实写回；Worker 连通正常，最终耗时 6.8 秒，剩余问题主要是三级标题分类偶发偏差。
```
