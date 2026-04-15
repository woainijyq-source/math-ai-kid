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
│  ├─ TESTING.md
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

## 当前剩余工作
- 确认 WPS 中是否已出现 `规范排版助手 / 一键规范排版`
- 确认点击按钮后 taskpane 能否弹出
- 配置真实 Worker 后验证真实文档格式化链
�化链
