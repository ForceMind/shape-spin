# 测试报告

## 状态

阶段 0 未完成。本报告只记录本会话实际执行的命令与结果，不将历史说明或静态检查表述为浏览器测试。

## 实际执行

### 基线保留与拆分

执行 Python 检查，退出码 `0`：

- `shape-spin-demo.html` 与 `reference/demo-baseline/shape-spin-demo.html` 字节一致。
- 基线 SHA256：`29aa16eccbe41daa229ea8f64cc57e4ba5662ca968aed45d853f1e73042c1243`。
- 原 HTML 的两个内联脚本分别与 `src/core/legacy-engine.js`、`src/render/legacy-app.js` 一致；一个内联样式与 `src/styles/game.css` 一致（仅移除了包裹标签边缘空白，新增末尾换行）。
- 当前目录中不存在 `test-engine.cjs`，未发现可直接执行的旧测试套件。

### 本地 HTTP 静态检查

已启动：

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

Python `urllib` 请求并验证以下资源均返回 HTTP 200，且响应字节与磁盘文件相同，检查退出码 `0`：

- `index.html`
- `src/core/legacy-engine.js`
- `src/render/legacy-app.js`
- `src/styles/game.css`
- `reference/demo-baseline/shape-spin-demo.html`

## 未验证 / 阻塞

- 当前环境快照没有 Node/npm，尚无 `package.json`，不能运行 TypeScript、Vite、Vitest、Playwright 或任务书列出的 npm 脚本。
- 尝试调用内置 `browser_open` 打开本地页面，工具返回 `unavailable in the current workflow context`；没有执行真实浏览器 JavaScript。
- 因此未验证原 Demo 交互、八关回归、Canvas 渲染、存档、音效、移动布局、构建产物或单文件 `file://`。
- 还未有正式 200 关、求解器、生成器或 witness，不存在内容验证结果。

## 下一轮最低验证计划

在可用 Node/npm 与真实浏览器执行能力恢复后：

1. 为原八关建立独立基线回归测试并运行；这些是新增测试，不称为“旧测试”。
2. 对原 Demo 与拆分入口执行真实 HTTP 浏览器检查，采集控制台错误、交互结果和截图。
3. 再开始 TypeScript/Vite 工程与规则迁移；每次迁移后运行对应测试。
