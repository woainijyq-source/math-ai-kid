# TASK-007 测试结果留档约定

这个目录专门用于存放 **TASK-007 真机端到端测试** 的每轮执行记录，目标是让后续联调直接“复制模板 → 填空 → 留档”，不要每次临时拼日志。

## 目录用途

建议每一轮真机验证都在这里留下一套最小资料：
- 1 份执行记录 Markdown
- 0~N 张截图
- 0~N 份日志摘录或导出文件

## 推荐结构

```text
docs/results/
├─ README.md
├─ TEMPLATE-TASK-007-RUN.md
└─ YYYY-MM-DD/
   └─ run-01/
      ├─ TASK-007-RUN.md
      ├─ screenshots/
      │  ├─ 01-ribbon.png
      │  ├─ 02-taskpane.png
      │  └─ 03-final-doc.png
      └─ logs/
         ├─ taskpane-log.txt
         └─ probe-summary.txt
```

## 命名建议

### 记录文件
- 固定复制：`TEMPLATE-TASK-007-RUN.md`
- 单次执行记录建议命名：`TASK-007-RUN.md`

### 轮次目录
- 日期目录：`YYYY-MM-DD`
- 同日多轮：`run-01`、`run-02`、`run-03`

这样做的好处是：
- 同一天的多轮回归不会互相覆盖
- 截图、日志、结论天然归档在同一处
- 后续回看时能快速定位“哪一轮第一次通过 / 哪一轮开始回归”

## 每轮最少应留什么

最少建议留以下内容：
1. `TASK-007-RUN.md`：填写步骤、结果、耗时、失败归因
2. `screenshots/`：至少放 Ribbon / TaskPane / 最终结果中的关键截图
3. `logs/`：至少留 TaskPane 日志关键字；如有 probe 或脚本输出，也放进去

## 截图建议

按测试顺序留图最省心：
- `01-ribbon.png`：确认 `规范排版助手` Tab 可见
- `02-taskpane.png`：确认 TaskPane 可见且日志区已加载
- `03-read-paragraphs.png`：`读取文档段落` 结果
- `04-worker-test.png`：`测试 Worker` 结果
- `05-preview.png`：`预览样式应用` 结果
- `06-final-doc.png`：`一键规范排版` 后文档效果

## 日志建议

日志不要求很花，只要能支撑复盘即可：
- TaskPane 日志区的关键文本可直接复制进 `TASK-007-RUN.md`
- 如果单独导出成 txt，则放到 `logs/`
- 如有脚本输出（例如注册修复、probe 分析），可单独放：
  - `logs/sync-build-assets.txt`
  - `logs/sync-registration.txt`
  - `logs/probe-summary.txt`

## 当前口径

这个结果目录默认服务于当前已确定的验证路线：
- **本地文件模式**
- **TaskPane 四按钮**

不要把这里重新混回旧的在线 debug 口径，除非后续文档明确升级测试方案。
