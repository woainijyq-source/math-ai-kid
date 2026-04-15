# WPS 手工核查清单（Ribbon 不触发时）

当前自动诊断结论：`scripts/analyze-ribbon-probe.ps1` 返回 `NOT_TRIGGERED`。
这表示 WPS **尚未真正执行到加载项页面**，问题更像在 **WPS 侧未装载插件**，而不是插件前端 JS 报错。

## 先做这 4 步

### 1. 关闭所有 WPS 窗口
确保 Writer / Spreadsheets / Presentation / 首页壳层都退出。

### 2. 重新运行联调脚本
```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\scripts\start-debug-and-open-doc.ps1
```

### 3. 进入 WPS 选项，确认“开发者”相关入口可见
目标不是写代码，而是确认 WPS 没把加载项入口彻底隐藏。

优先检查：
- 顶部菜单中是否能看到 **开发工具 / 开发者**
- 如果看不到：
  - 进入 **菜单 / 文件 → 选项 → 自定义功能区**
  - 勾选 **开发工具 / 开发者**
  - 保存后重启 WPS

### 4. 检查加载项管理中是否存在被禁用项
优先检查：
- **菜单 / 文件 → 选项 → 加载项**
- 看是否有 `WordNormFormatterWPS`
- 如果存在但被禁用，改为启用
- 如果有“禁用项目 / Disabled Items”，检查是否包含该插件

## 做完后立刻跑探针分析
```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\scripts\analyze-ribbon-probe.ps1
```

## 结果判读
- `NOT_TRIGGERED`
  - WPS 仍未执行插件页面
  - 继续优先排查：开发者入口 / 加载项启用 / 首页壳层
- `ADDIN_LOADED`
  - 插件已进入宿主，但 UI 可能未显现
- `ACTION_TRIGGERED`
  - Ribbon 按钮已响应
- `TASKPANE_LOADED`
  - TaskPane 已真实打开
- `ONLOAD_ERROR`
  - 插件页面已被执行，但初始化报错

## 当前机器上的关键已知状态
- `publish.xml` 已指向 `http://127.0.0.1:3889/`
- `jsplugins.xml` 已指向 `http://127.0.0.1:3889/`
- `authaddin.json` 中 `WordNormFormatterWPS` 已是 `enable: true / isload: true`
- `office6\cfgs\setup.cfg` 与 `oem.ini` 缺失，因此本机更可疑的是 `jsplugins.xml` 调试链
