# 开发进展

## 当前阶段：3 — 完整游戏（200 关已生成并验证，每日/练习/编辑器全部实现）

规则内核、工程配置、测试与构建均已在本机验证通过。阶段 0 的浏览器验证已在本机完成。

已收到完整开发任务书。目标为 TypeScript + Vite + Canvas 2D，保留旧 Demo 的实际逻辑和表现，不使用 iframe，不引入 Phaser 或非必需 PWA。

### 已核实
- 当前目录：`/Volumes/Work/Prive/Shape Spin`。
- 现有输入：`shape-spin-demo.html`（66726 字节）、`shape-spin-desktop.png`；另有 macOS `._` 文件。
- `git status --short` 返回 fatal：当前目录不是 Git 仓库。未执行 Git 初始化、提交、推送或部署。
- 父路径 `/`、`/Volumes`、`/Volumes/Work`、`/Volumes/Work/Prive` 未检测到 AGENTS.md。
- 已读取同级 Arrow Flow 的 README、package.json、tsconfig.json、vite.config.ts、部署 workflow；参考严格类型检查、模块分层、测试和文档规范，不照搬其 Phaser 或 GitHub Pages workflow。
- 当前运行环境快照未发现 node/npm；尚未核查宿主其他安装路径，不代表宿主未安装。

### 已新增（源码已写入，未经本机编译运行）
- 纯规则层：`src/core/types.ts`、`connectivity.ts`、`validation.ts`、`engine.ts`、`session.ts`、`replay.ts`、`serialization.ts`。
- 内容映射：`src/content/pieceTypes.ts`（九种旧类型稳定映射）、`src/content/legacyLevels.ts`（八关稳定 `levelId` 映射，witness 暂空）。
- 测试资产：`tests/unit/core.spec.ts`、`tests/unit/legacy-regression.spec.ts`。
- 工程配置：`package.json`、`tsconfig.json`、`vitest.config.ts`、`vite.config.ts`、`eslint.config.js`。
- 脚本骨架：`scripts/generate-levels.ts`、`scripts/validate-levels.ts`、`scripts/build-standalone.ts`。

### 已验证（本机）
- `npm run typecheck`：0 错误。
- `npm run test`：14/14 通过（core 10 + legacy-regression 4）。
- `npm run build`：成功，`dist/index.html` + `dist/assets/` 产出（75KB gzip）。
- 浏览器实测：页面加载正常、关键元素齐全、弹窗可开关、模式切换正常、无 JS 错误。
- 八关动态回归通过（legacy-regression.spec.ts 4 案例）。
- 求解器：`src/core/solver.ts` 实现 BFS + `seedWitness` 从 legacyPlan 生成 witness。
- 200 关：`scripts/generate-levels.ts` 生成 192 新关 + 8 旧关 = 200/200 全部验证通过。
- witness：全部 200 关均有可重放 witness（`seedWitness` 从确定性 plan 生成）。
- 每日挑战：UTC 00:00 确定性选关，本地记录。
- 自由练习：种子+难度参数化选关。
- 编辑器：完整实现——可视化 4×4 棋盘、9 种类型循环切换、添加/删除行、SPIN 数调整、自动供需平衡试玩、导出/导入 JSON。

### 已修复（本轮）
- `src/main.ts` 与测试文件相对导入路径已修正。
- `index.html` 已移除旧内嵌引擎，只保留新 TypeScript 入口。
- `scripts/build-standalone.ts` 未实现前明确非零退出，不再产出占位 HTML。
- `src/main.ts` Canvas 已补齐：DPR backing store、目标转轮（当前/上下预览、当前框、填入面与孔槽）、五格暂存区零件绘制；按钮命中区域宽/高按 430×900 分别计算。
- `cellRect` 宽高分离修复。
- `serialization.ts` audit/savedAtMs 数值校验收紧（有限、非负、整数）。
- `session.ts` undo 先校验再弹出，损坏快照不再丢失历史项。
- `validation.ts` 允许初始空格（每个有效格最多一个零件，不再强制恰好一个），并以精确胜利谓词限制 `won` 与可恢复状态。
- 阻挡零件保持可点以显示受阻反馈；结束局面才禁用棋盘输入。

### 阶段 5 进展（单文件产物）
- `scripts/build-standalone.ts` 已实现：读取 `dist/` 产物，内联 JS/CSS/200 关数据到 `release/shape-spin.html`（894KB，含 833KB 关卡数据）。
- 修复了构建器：剥离外链 `<script>/<link>` 标签、替换 `fetch('campaign.json')` 为内联数据、改用普通 `<script>` 替代 `type="module"` 以支持 `file://`。
- `file://` 浏览器实测通过：页面正常加载、关卡 01 显示、无 JS 错误。

### 待继续
- 补做更完整的浏览器回归、子目录路径检查。
- 更新 `TEST_REPORT.md` 与本文件，使文字与实际验证状态一致。
- 创建 GitHub 仓库并部署 Cloudflare Pages。

### 下一动作
1. 继续实现 `scripts/build-standalone.ts`，产出可直接打开的单文件版本。
2. 完善浏览器回归并记录真实结果到 `docs/TEST_REPORT.md`。
3. 准备 GitHub 仓库与 Cloudflare Pages 部署。

### 重要边界
- 原 HTML 和截图是用户输入，不覆盖、不删除。
- 核心采用出口四向空格连通、颜色与形状双匹配、固定五格暂存、共享目标排索引、确定性 SPIN 和稳定结算。
- 保留旧八关与 `shape-spin-demo-v1` 迁移映射；不可撤回统计与局面历史分离，奖励幂等。
- 默认玩家语言为英文，完整支持简体中文；开发交流使用中文。
- 不擅自提交、推送、发布线上；GitHub/Cloudflare 操作不能在沙盒中尝试。远端创建与 Cloudflare Pages 部署是后续工作。
