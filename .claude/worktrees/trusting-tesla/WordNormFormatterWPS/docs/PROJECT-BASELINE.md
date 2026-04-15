# WordNormFormatterWPS 项目基线

## 1. 项目目标
做一个 **“一键规范排版”插件**。

## 2. MVP 功能
MVP 只保留一个主功能按钮：
- **一键规范排版**

目标链路：
- 用户点击一次按钮
- 插件读取当前文档段落结构
- AI 只判断每段应套用的样式
- 插件重新应用样式
- 不修改任何文字内容

## 3. 支持范围
第一版只支持 4 类样式：
- Heading 1
- Heading 2
- Heading 3
- 正文

暂不纳入：
- Heading 4/5/6
- 列表编号/项目符号
- 表格样式
- 页眉页脚
- 更细粒度字体字号规则

## 4. AI 红线
AI 只负责：
- 识别结构
- 返回样式标签

AI 明确禁止：
- 改写原文
- 润色
- 扩写
- 缩写
- 删减
- 纠错
- 翻译
- 替换原文字词
- 输出新的正文覆盖旧正文

工程约束：
1. Prompt 明确禁止改写文本。
2. AI 只允许返回样式分类 JSON。
3. 执行层只做“段落索引 -> 套样式”。
4. 若返回数量不匹配或结构异常，立即中止，不修改文档。

## 5. OpenAI 接入策略
必须走 **Cloudflare Worker 代理**。

目标：
- 由项目方提供 Key
- 用户开箱即用
- 大陆可直连
- 客户端不直接调用 OpenAI 官方接口

默认配置项：
- Worker Base URL
- Worker API Key
- Model 名称

## 6. 目标用户
面向 **零基础 Windows 用户**。

产品取舍原则：
- 优先稳
- 优先快
- 优先少折腾
- 安装和使用门槛尽量低
- 文案尽量人话化
- 报错尽量可理解

## 7. 技术路线演进
### 原路线（历史方案）
- yo office
- React
- Office.js
- Fluent UI
- OOXML fallback

### 当前主路线（已切换）
- WPS JS API
- ribbon.xml
- taskpane
- Cloudflare Worker 代理
- 保留 promptBuilder / Worker 调用
- 保留 Fluent UI 风格（先保风格，后视稳定性决定是否补完整组件体系）

说明：
- 当前切换的是插件宿主路线：Office Add-in -> WPS 插件
- 不切换 AI 核心识别逻辑

## 8. 项目正式名称
- **WordNormFormatterWPS**

## 9. 当前执行策略
- 全程按 gpt-5.4 标准推进
- 优先自动创建文件
- 优先自动修复问题
- 输出全部可直接复制的命令
- 先做最稳最快的可跑版本，再逐步增强

## 10. 当前阶段目标
### 已完成
- WPS 路线骨架已创建
- taskpane 本地服务已可启动
- promptBuilder / Worker 调用 / 样式应用逻辑已落地
- README / 架构文档 / 测试文档已生成

### 下一步
- 完成 WPS 真机加载联调
- 确认 Ribbon 按钮是否正常出现
- 确认 taskpane 是否能在 WPS 内打开
- 确认真实文档样式应用链是否打通
