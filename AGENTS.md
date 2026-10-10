# Shape Spin 项目约定

## 项目
- 原项目继续开发，**先读** `docs/REMEDIATION_PROGRESS.md`、`docs/REMEDIATION_BASELINE.md`、`docs/GAME_SPEC.md`；`docs/PROGRESS.md` 和 `docs/TEST_REPORT.md` 含过期历史结论，核实后才更新，不能当验收证明。
- TypeScript + Vite + Canvas 2D + DOM/CSS；`src/core/` 是唯一规则事实来源，`src/game/GameController.ts` 连接规则与 `src/render/`，`src/screens/`/`src/ui/` 管理玩家界面，`src/services/` 管理存档、奖励、模式。对标同级 `Arrow Flow` 的分层、交互和测试纪律，**不照搬** Phaser 或超出 Shape Spin 任务书的对战/经济功能。
- 不修改原始 `shape-spin-demo.html`、截图及 `reference/demo-baseline/`。保留旧八关、九种稳定类型、旧存档迁移；关卡必须供需守恒并以正式引擎重放 witness。五格暂存、四向出口连通、共享目标排、原子动作、不可撤回统计与奖励幂等必须测试；求解 `unknown` 不是无解。
- 玩家默认简体中文、完整支持英文；文案集中管理。Editor 仅开发入口，不向普通玩家展示作弊功能。本次不强制 PWA，不添加假在线/充值/排行榜。

## 命令（以本机实际环境和 package.json 为准）
- `npm run typecheck`、`npm run lint`、`npm run test`、`npm run test:e2e`
- `npm run levels:generate`、`npm run levels:validate`、`npm run build`、`npm run build:standalone`
- `npm run dev`、`npm run preview`。运行前确认 Node/npm 与浏览器可用；脚本存在不代表已通过。

## 每轮工作流
1. 检查 `git status --short`、当前计划和目标文件。读目标文件**当前版本及将被替换的完整范围**后再写；优先 `read_file`/`edit_file`，不要用 shell 绕过宿主写入证据、权限或沙盒保护。若工具报告 `WRITE_EVIDENCE_MISSING/STALE`，按提示重新读对应范围；不要反复重发同一失败调用或虚报已通过。大文件/生成物按宿主给出的 cursor/receipt 分页；仍受阻则保留现场并说明真实阻塞。
2. 小步提交改动（不自动 Git 提交）。改规则/内容：聚焦测试 + 200 关 witness 验证；改页面/渲染：生产 HTTP Playwright 真实点击、指定手机视口和控制台；改构建：根路径、子目录、`file://` 双产物。失败先复现、修复、重跑，不把静态检查冒充浏览器测试。
3. Scratch 脚本、截图、报告放临时目录；检查 `git diff --check`、`git status --short` 与最终 diff，排除 `._*`、`playwright-report/`、`test-results/`、`reasonix.toml` 的非产品副作用；不可覆盖用户改动。
4. 在 `docs/REMEDIATION_PROGRESS.md` 与 `docs/TEST_REPORT.md` 只写真实命令、退出码、通过/失败/未验证项。各整改阶段未过门槛不能标完成。
5. 不擅自提交、推送、部署或尝试付费；当前线上仅为整改前预览。GitHub/Cloudflare 认证不在沙盒试；真正重部署须整改验收完成且获当前任务授权。

## 提示词入口
- 详细交接提示词与验收清单：`docs/PROJECT_PROMPT.md`。
