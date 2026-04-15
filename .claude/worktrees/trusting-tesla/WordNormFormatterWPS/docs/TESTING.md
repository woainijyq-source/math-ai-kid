# 测试清单

## A. 本地服务测试
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npm install
Copy-Item .env.example .env
npm run dev
```

验证：
- 打开 `http://127.0.0.1:3100/health`
- 打开 `http://127.0.0.1:3100/taskpane/`

## B. WPS 加载测试
1. 打开 WPS 文字
2. 进入加载项/开发者入口
3. 加载 `wps-addon\publish.xml` 或手工指定任务页 URL：
   - `http://127.0.0.1:3100/taskpane/`
4. 确认 Ribbon 中能看到：`一键规范排版`
5. 点击后能弹出/显示任务窗格

## C. 功能测试
准备一份包含以下内容的测试文档：
- 一级标题
- 二级标题
- 三级标题
- 正文多段

点击按钮后检查：
- 文本内容是否完全不变
- 只改变样式，不改变字词
- Heading 1/2/3/正文 是否正确

## D. 异常测试
- 不填 Worker 地址 → 应报配置错误
- Worker 返回非 JSON → 应中止，不改文档
- AI 返回段落数量不匹配 → 应中止，不改文档
- WPS API 不可用 → 应提示当前不是 WPS 环境

## E. 当前自动化测试边界
由于当前会话无法直接驱动你本机真实 WPS 桌面程序完成最终加载验证，因此：
- 已完成：项目骨架、前端、调用链、启动链
- 待真机确认：WPS 插件加载入口名称、Ribbon/Taskpane 的最终挂载细节

## 建议首轮验证口径
先不追求“安装包级别分发”，先跑通：
- 本地服务启动
- WPS 能打开 Taskpane
- 一键按钮能读取文档并应用样式

跑通后再做：
- 安装包
- 用户一键安装
- 自动更新
