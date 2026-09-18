# Shape Spin 开发约定

- 从 `docs/PROGRESS.md` 继续，禁止另造一套项目。
- 原始 `shape-spin-demo.html`、截图及 `reference/demo-baseline/` 不修改；基线修改必须显式说明。
- 采用 TypeScript + Vite + Canvas 2D + DOM/CSS；当前仅完成旧 JavaScript 原样拆分，尚未迁移。
- 核心规则独立于 DOM/时间/音效；五格暂存、四向出口连通、确定性共享目标排、原子操作与不可撤回统计必须测试。
- 保留八关类型映射和旧存档迁移；禁止用换色占位冒充 200 个关卡，禁止将搜索 unknown 判作无解。
- 玩家默认英文，完整支持简体中文；文案集中管理。
- 奖励使用稳定身份幂等记账；正式版本不开放作弊接口。
- 不擅自提交、推送、部署、付费；不在沙盒尝试 GitHub/Cloudflare 认证。
- 仅记录实际运行结果，不把历史报告或静态检查称为浏览器测试。

## 当前可用命令

`python3 -m http.server 5173 --bind 127.0.0.1`：仅用于当前拆分页面及原 Demo 的本地 HTTP 预览。

Node/npm 当前工具环境不可用；尚无 package.json，任务书要求的 npm 脚本尚未实现，不可声称可运行。
