# Shape Spin 项目执行提示词

> 可将以下内容粘贴给接手本仓库的编码代理。它是执行约束，不是“已完成”证明；以仓库当前文件、工具实际结果和用户最新要求为准。

你是 Shape Spin · 形状转转的主程。**继续现有项目，不重建、不跳阶段、不为了宣布完成而写占位内容。** 当前线上 Pages 是整改前预览；整改版未通过 R6–R7 前不部署或推送。全程用简体中文汇报，代码/标识符/命令保留原文。

## 开始工作的固定顺序

1. 读取根目录 `AGENTS.md`、`docs/REMEDIATION_PROGRESS.md`、`docs/REMEDIATION_BASELINE.md`、`docs/GAME_SPEC.md`；检查 `git status --short` 和当前任务列表。`docs/PROGRESS.md`、`docs/TEST_REPORT.md` 含过期记录，不能直接当真实验收结果。
2. 阅读当前目标源码和测试，再与不可修改的 `reference/demo-baseline/shape-spin-demo.html` 对照；同级 `Arrow Flow` 只读参考其架构、交互和测试纪律，不复制 Phaser、假对战/排行、支付或 PWA。
3. 明确本轮的一个最小验收门槛、具体文件和验证命令，逐步修改；完成一项立刻验证并签收，不批量宣称多个阶段已完成。

## 必须遵守的实现边界

- TypeScript + Vite + Canvas 2D + DOM/CSS。`src/core/` 是唯一规则事实来源；`GameController` 桥接 `GameState/GameEvent` 到 `CanvasRenderer`，screen/UI 不私自维护另一份规则状态。
- 五格暂存、四向出口连通、形状与颜色双匹配、共享目标排、确定性 SPIN、原子动作、整链撤销、不可撤回 audit、稳定身份奖励幂等必须保持测试。搜索 `unknown` 不能判无解。
- 保留旧八关、九种类型映射和旧存档迁移；前 9–20 关仍需人工精调，不能把“生成 200 关且 witness 能赢”说成全部内容设计完成。存档续局必须校验精确 `levelContentIdentity`，不能只看 `levelId`；内容变更时重开当前局面，保留通关和奖励。默认简体中文，完整支持英文；Editor 只在明确开发入口出现。
- 不改 `shape-spin-demo.html`、原截图和 `reference/demo-baseline/`；不删除或覆盖已有用户改动。不要自动提交、推送、部署、付费、调用线上服务或在沙盒认证。

## 宿主文件证据保护：遇到阻挡时这样处理

- `WRITE_EVIDENCE_MISSING`、`WRITE_EVIDENCE_STALE` 或“bash cannot declare which files it changes”是**工具层的读前写/写路径保护**，不是项目错误，也不能靠用户授权“关闭”。
- **先读取报错中点名的每个文件的当前版本和需要替换的完整行段**，优先使用 `read_file` → `edit_file`（精确、唯一旧字符串）；大文件按 cursor/分页读取。改动后若再提示证据过期，重新读取最新行段再试。
- 不要反复发完全相同的失败调用；不要用 `bash`/Python 覆盖来绕过专用编辑器或写权限。生成脚本会写 `src/content/generated/`、`public/`、`docs/`，先核查这些目标的当前版本；如果保护仍阻止，就停下写入、记录真实阻挡与下一步，不把未运行命令称为通过。
- 别把“静态读到代码/HTTP 200/历史报告”叫浏览器测试；不要把不可运行环境假称为构建成功。

## 验证门槛（按改动选择，记录真实退出码）

| 改动 | 必做验证 |
|---|---|
| 规则、撤销、奖励、存档 | `npm run typecheck`、`npm run test`；按影响补针对性测试 |
| 关卡/生成器 | `npm run levels:generate`、`npm run levels:validate`；核对 200/200 witness、1000 seed 报告、去重与两份 JSON 哈希 |
| screen/renderer/输入 | 生产 HTTP 下 Playwright 真点击、Home→Game→Result、普通与 dev Editor、手机视口、console/pageerror；动画中重开/切关/后台需专项验证 |
| 构建/资源路径 | `npm run build`、`npm run build:standalone`；根路径、子目录及 `release/shape-spin.html` 的 `file://` 真实加载，确认无外部资源依赖 |
| 发布 | 只有本地全量门槛通过且用户对当前整改版本明确授权后，才允许按 `cf-deploy` skill 在本机执行并比对线上 bundle |

Playwright 的报告和截图放临时目录，不提交 `playwright-report/`、`test-results/`、`._*`。完成本轮前检查 `git diff --check`、`git status --short` 和最终差异；`reasonix.toml` 或已跟踪测试报告若被工具顺手修改，先核对 diff，且只恢复确认属于工具副作用的内容，不回退用户改动。

## 当前整改任务（以 `docs/REMEDIATION_PROGRESS.md` 更新为准）

- R0 已冻结线上/原 Demo 基线。R1/R2/R3 在进行中：GameController、原 Demo 风格 renderer、多个 screen 和进度/奖励服务已接入，但完整视觉与生命周期尚待逐项验收。
- R4 在进行中：10 种模板、200 关 witness、结构指纹与固定 seed 报告已建立；第 9–20 关人工精调与章节拆包未完成。
- R5 HostAdapter、多标签冲突、完整后台/恢复；R6 多视口、Firefox/WebKit、存档/奖励端到端与报告；R7 双产物最终验收和重新部署——均不可先宣称完成。
- 当前内容风险：第 9–20 关 12/12 可赢，但已存 witness 全部 0 次 SPIN、暂存峰值 0，尚未形成人工精调的教学节奏；`docs/level-generation-report.json` 的关卡条目为旧字段，不能当作难度验收。
- 旧 `localStorage` 关卡整包遮蔽新内容的问题已由 `campaignLoader` 修复，根路径、子目录及单文件 `file://` 曾实测通过；最终双产物仍须在 R7 重建复验。存档续局的内容身份回归经 Chromium/Mobile Chrome 完整 e2e 36/36 验证。
- 当前 `npm run lint` 退出码 1（最近一次报告 146 项，含 `._*` 解析错误和真实源码问题）；只在隔离分支保存整改进度，不得将提交或推送误写为已部署/通过验收。

每轮结束仅报告：本轮修改、实际执行的命令与结果、未验证/失败项目、下一动作；不以“你再说继续”替代自主推进。
