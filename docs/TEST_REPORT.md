# 测试报告

## 当前状态

Shape Spin 整改仍在进行；本报告记录当前可核对的验证结果，不将测试通过等同于 R4–R7 整体验收或上线授权。旧的“无 Node/npm、无法执行浏览器”结论属于早期环境快照，已失效。

## 本次画面清晰度与居中检查（独立于上述整改验收）

- 修正桌面布局：游戏框以视口中心定位，说明栏改为左侧绝对定位；宽度不足时隐藏说明栏，避免覆盖游戏框。首页弹窗取消背景模糊；Canvas 使用完整 `devicePixelRatio` 并避免尺寸未变时清空画布。
- `npm run typecheck && npm run build`：退出码 0，生产构建成功。
- `npm run test:e2e -- tests/e2e/renderer-regression.spec.ts --reporter=line`：退出码 0，Chromium 与 Mobile Chrome 共 12/12；覆盖居中、物理像素、弹窗滤镜及原有点击/SPIN。该命令使用现有配置的 Vite 开发 HTTP 服务，**并非生产 HTTP 浏览器验收**；实体设备与生产视觉对比仍未验证。

- 上轮取消弹窗背景模糊不能解释线上问题：实测线上游戏页 `modalHidden=true`、Canvas `filter=none`。**线上直接原因已确认：首次加载保留 Canvas 默认 `300×150`**；旧版 `drawCanvas()` 只在宽/高为 0 时调用 `resizeCanvas()`，默认非零导致初始化跳过。线上窗口高度从 720 改为 721 后画布变为 `328×687`，验证 resize 能恢复像素适配。
- 本轮 `npm run build`：退出码 0。`npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` 启动生产 HTTP；通过 `node --input-type=module` 的临时 Playwright 探针访问线上及本地，退出码 0，截图/测量写入 `/tmp/shape-spin-visual/`。
- 同视口对比：`1280×720 / DPR=1` 时线上 CSS 约 `328×686`、画布 `300×150`、游戏水平偏右 `189.39px`；本地画布 `328×686`、水平偏差 `0px`。`393×851 / DPR=3` 时两者 CSS 约 `393×823`，线上画布 `300×150`，本地 `1179×2468`，两者水平偏差均为 `0px`。
- 两种页面 × 两种视口均真实点击 `0 / 12 → 1 / 12`，未捕获 `pageerror`；已查看四张同视口截图。本地不再出现线上低分辨率画布拉伸，但 renderer 视觉也已变更，截图不是仅改变分辨率的严格 A/B。实体手机与完整 R6/R7 验收仍未完成，未部署。

## 本次部署前验证（当前最新）

- `npm run typecheck && npm run test && npm run levels:validate`：退出码 0；单测 36/36；200/200 witness 经正式 core 重放获胜。
- `npm run build`：退出码 0，产物 `dist/assets/index-KlhhuvVg.js`、`dist/assets/index-kKvtnKJb.css`。
- `npm run build:standalone`：退出码 0，生成 `release/shape-spin.html`（811.9 KB，内联 200 关）。
- `npm run test:e2e -- --reporter=line --output=/private/tmp/shape-spin-deploy-results`：退出码 0，Chromium 与 Mobile Chrome 共 40/40；报告在 `/private/tmp/shape-spin-deploy-report`，未提交。
- `npm run lint`：退出码 1，153 项；其中 7 项为仓库中 macOS `._*` 元数据/忽略产物解析错误，其余 146 项是真实源码、脚本与测试 lint 错误，未标通过。
- 生产 HTTP（`npm run preview` + 临时 Playwright 探针）：桌面 `1280×720/DPR=1` 首次加载 Canvas `328×686`，居中偏差 0；移动 `393×851/DPR=3` 首次加载 Canvas `1179×2468`，居中偏差 0；两种视口真实点击均从 `0 / 12 → 1 / 12`，无 `pageerror` 或 console error。截图写入 `/private/tmp/shape-spin-prod-*.png`。
- 首次以 `/tmp` 输出目录运行 e2e 时被宿主沙盒 `EPERM` 拒绝，测试未启动；改用 `/private/tmp` 并显式授权后完成。

## 本次部署与线上验证（当前最新）

- 提交并推送：`8b06f4b` → `origin/main`（63 文件，+4008/-1456）。
- 部署：`source ~/.zprofile && npx wrangler pages deploy dist --project-name shape-spin --branch main --commit-dirty=true`，退出码 0，上传 4 文件。
- 部署地址：`https://24afe86c.shape-spin.pages.dev`；`curl` 校验线上 bundle 为 `assets/index-KlhhuvVg.js`，与本地 `npm run build` 产物一致。
- 线上 Playwright 验证（临时脚本，截图 `/private/tmp/shape-spin-online-*.png`）：
  - 桌面 `1280×720/DPR=1`：Canvas 物理像素 `328×686`，与 shell × DPR 完全一致；居中偏差 `0px`。
  - 移动 `393×851/DPR=3`：Canvas 物理像素 `1179×2468`，与 shell × DPR 完全一致；居中偏差 `0px`。
  - 两组视口均无 `pageerror`、无 console error；像素与居中测量通过。截图虽已生成，但 `view_image` 返回当前模型不支持图片读取，**未完成目视视觉核验**；上轮“截图确认清晰、色彩正常”的说法撤回。
  - 上轮探针未关闭 Home 弹窗，任意坐标点击未推进计数；不能据此归因为零件点击位置问题或游戏缺陷。
- 本轮补充核验：以 `/opt/homebrew/bin/node --input-type=module` 调用项目现有 `@playwright/test`，退出码 0；检查默认站点 `https://shape-spin.pages.dev/` 和部署地址 `https://24afe86c.shape-spin.pages.dev/`，各覆盖 `1280×720/DPR=1` 与 `393×851/DPR=3`。通过 `[data-action="home-start"]` 关闭 Home 后，真实点击 `.piece-hit` 使 `#fit-count` 从 `0 / 12 → 1 / 12`；选第二关并点击 SPIN，`#spin-count` 从 `2 → 1`。四组 Canvas 物理像素均匹配、居中偏差均为 `0px`、无 JS/console error，bundle 均为 `/assets/index-KlhhuvVg.js`。脚本以 stdin 执行，无仓库 scratch 文件。
- 本次为预览更新，**不宣称 R4–R7 整体验收完成**。`npm run lint` 仍失败（153 项），实体 iOS/Android 设备、R4 第 9–20 关人工精调、R5–R7 仍未验收。

## 本轮仓库同步前验证（旧整改回归见下文）

- 修复导入文件在写入前未验证 progress 的风险：新增 `parseBrowserSaveData()`，严格检查通关、选关、语言、设置、奖励；campaign 活跃局面按当前关卡反序列化，Daily/Practice/Editor 无法验证的局面置空但保留全局进度。存储写失败不切换内存状态。
- `npm run typecheck && npm run test && git diff --check`：退出码 0，36/36 单测通过，diff 无空白问题。
- `npm run typecheck && npm run test -- --run tests/unit/saveImport.spec.ts tests/unit/progressService.spec.ts`：退出码 0，8/8 聚焦测试通过。
- 最新导入改动后尝试 `PLAYWRIGHT_HTML_OUTPUT_DIR=/tmp/shape-spin-precommit-report npm run test:e2e -- --reporter=line --output=/tmp/shape-spin-precommit-results`：宿主返回 `evidence required`，**未启动，不能算通过**。
- 用户选择暂不部署；计划仅在隔离分支标 WIP，不推 `main`。`git switch -c wip/remediation-snapshot-20260926` 被宿主证据锁拒绝，**尚未创建分支、提交或推送**。

## 较早整改验证（早于导入修复）

| 命令 | 结果 |
|---|---|
| `npm run typecheck` | 退出码 0 |
| `npm run test` | 退出码 0，32/32；含 `levelContentIdentity`、旧局面安全重开与全局进度保留 |
| `npm run test -- --run tests/unit/levelIdentity.spec.ts tests/unit/core.spec.ts tests/unit/progressService.spec.ts` | 退出码 0，18/18 |
| `PLAYWRIGHT_HTML_OUTPUT_DIR=/tmp/shape-spin-save-report npm run test:e2e -- tests/e2e/save-migration.spec.ts --reporter=line --output=/tmp/shape-spin-save-results` | 退出码 0，Chromium + Mobile Chrome 2/2；旧局面重开、提示、通关标记和无 pageerror |
| `PLAYWRIGHT_HTML_OUTPUT_DIR=/tmp/shape-spin-all-report npm run test:e2e -- --reporter=line --output=/tmp/shape-spin-all-results` | 退出码 0，Chromium + Mobile Chrome 36/36 |
| `PLAYWRIGHT_HTML_OUTPUT_DIR=/tmp/shape-spin-final-report npm run test:e2e -- --reporter=line --output=/tmp/shape-spin-final-results` | 退出码 0，集中化提示文案后 Chromium + Mobile Chrome 36/36 |
| `npm run levels:validate` | 退出码 0，200/200 witness 重放获胜，缺失 0、失败 0 |
| `npm run lint` | 退出码 1，报告 146 项：含 macOS `._*` 解析错误及真实源码/测试 lint 错误；未标通过 |
| `npx eslint tests/unit/levelIdentity.spec.ts && npm run test -- --run tests/unit/levelIdentity.spec.ts tests/unit/progressService.spec.ts && git diff --check` | 退出码 0，新测试文件局部 lint 通过，聚焦测试 8/8 |
| `git diff --check` | 退出码 0 |

本轮核对 `reference/demo-baseline/shape-spin-demo.html` SHA256 为 `29aa16eccbe41daa229ea8f64cc57e4ba5662ca968aed45d853f1e73042c1243`。Playwright 报告和产物写入 `/tmp`，未更改仓库历史报告。

## 较早轮次的结果（不作为本轮重新执行）

- 结构指纹、1000 seed 报告的历史结果见 `docs/REMEDIATION_PROGRESS.md`；当前 `docs/level-generation-report.json` 的关卡条目缺少现行指标字段，须重新生成后核实。
- 根路径与 `BASE_PATH=/shape-spin/` 构建、单文件 `file://` 及 HTTP 浏览器加载均曾实测通过；这些检查早于本轮存档内容身份修改，需要在 R7 最终产物验收时重跑。
- 原 Demo 基线保留；早期静态 HTTP 200 检查仅证明资源可访问，不证明交互可用。

## 尚未验证

- 实体 iOS/Android 及 App WebView、切后台/跨标签生命周期、逐帧视觉对比与动画取消专项验收。
- 第 9–20 关诊断：读取当前包，正式 `replay` 返回 12/12 `won`；全部 12 关的已存 witness 均为 0 次 SPIN、0 格暂存峰值（14–23 个零件），故无法凭现有 witness 证明教学节奏。`docs/level-generation-report.json` 当前关卡条目为旧字段，不用于当前难度验收。
- 第 9–20 关人工精调、章节拆包及难度门槛仍未完成；200/200 witness 只证明可解，不等于关卡设计完成。
- R5–R7 完整整改与最终双产物验收仍未完成；已按本次授权更新 Pages 预览，不能等同于最终验收。
