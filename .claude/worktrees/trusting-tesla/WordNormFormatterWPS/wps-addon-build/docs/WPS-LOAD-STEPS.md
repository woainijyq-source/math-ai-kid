# WPS 真机加载步骤

## 0. 先启动本地服务
```powershell
cd C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS
npm run dev
```

看到以下输出说明服务正常：
```text
WordNormFormatterWPS running at http://127.0.0.1:3100
Taskpane: http://127.0.0.1:3100/taskpane/
Health: http://127.0.0.1:3100/health
```

## 1. 先验证本机能打开任务页
浏览器访问：
```text
http://127.0.0.1:3100/taskpane/
```

如果打不开，先不要进 WPS，先检查服务是否还在运行。

## 2. 在 WPS 中尝试两种加载方式

### 方式 A：加载发布文件
优先尝试加载：
```text
C:\Users\Administrator\.openclaw\workspace\WordNormFormatterWPS\wps-addon\publish.xml
```

### 方式 B：直接填写任务页 URL
如果 WPS 不认 `publish.xml`，则直接填写：
```text
http://127.0.0.1:3100/taskpane/
```

## 3. 期望看到的结果
- WPS 中出现插件入口
- 或任务窗格直接打开
- 或 Ribbon 中出现：`一键规范排版`

## 4. 如果失败，优先记录这四类信息
把以下任一信息发回来即可：
1. `publish.xml 能加载 / 不能加载`
2. `taskpane 打开了 / 没打开`
3. `按钮出来了 / 没出来`
4. 错误截图

## 5. 联调优先级
优先排查顺序：
1. 本地服务是否正常
2. 浏览器能否打开 taskpane
3. WPS 是否支持当前加载入口
4. Ribbon 是否识别
5. WPS JS API 是否可用

## 6. 当前最小联调目标
不是一步到位做安装包，而是先跑通：
- taskpane 能在 WPS 中打开
- 能读取文档
- 能把 Heading 1 / 2 / 3 / 正文样式应用上去
