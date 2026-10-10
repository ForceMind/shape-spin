# 整改实施进度

> 基线与差异见 `docs/REMEDIATION_BASELINE.md`。本文件记录整改后的真实进展；**用户已明确授权将当前整改版本同步到 `main` 并更新默认 Cloudflare Pages 站点**。已提交推送 `8b06f4b` → `origin/main`，已部署 `https://24afe86c.shape-spin.pages.dev`。本次仍按预览更新处理，不宣称 R4–R7 全部整体验收完成。

## R0：冻结现场 ✅

- 整改前 commit：`fa211d9db6911553038ab2d64410c8690bd8851a`。
- 整改前线上：`https://a3833be8.shape-spin.pages.dev`。
- 原 Demo：`reference/demo-baseline/shape-spin-demo.html`，不修改。
- Arrow Flow：`/Volumes/Work/Prive/Arrow Flow`，只读工程/交互对标。

## R1：架构拆分（进行中）

已新增：

```text
src/render/RenderSnapshot.ts
src/render/RenderPrimitives.ts
src/render/ReelRenderer.ts
src/render/BufferRenderer.ts
src/render/BoardRenderer.ts
src/render/EffectsRenderer.ts
src/render/CanvasRenderer.ts
src/game/AnimationQueue.ts
src/game/GameController.ts
src/app/AppRouter.ts
src/app/ListenerBag.ts
src/ui/Modal.ts
src/screens/Screen.ts
src/screens/HelpScreen.ts
src/screens/CampaignScreen.ts
src/screens/SettingsScreen.ts
src/screens/ResultScreen.ts
src/screens/HomeScreen.ts
src/screens/GameScreen.ts
src/screens/PracticeScreen.ts
src/devtools/EditorScreen.ts
src/services/fileTransferService.ts
src/services/rewardService.ts
src/services/progressService.ts
src/services/dailyService.ts
src/services/practiceService.ts
```

职责边界：

```text
core/session → GameController → RenderSnapshot → CanvasRenderer
                                           ├→ ReelRenderer
                                           ├→ BufferRenderer
                                           ├→ BoardRenderer
                                           └→ EffectsRenderer
```

`GameController` 已接管 `pick/spin/undo/getLegalActions/getSelectablePieceIds`，`main.ts` 不再直接提交规则动作。原简化 Canvas 代码已删除约 674 行；`Modal`、`AppRouter`、`ListenerBag` 与 Home/Game/Help/Campaign/Practice/Settings/Result screen 已接入；存档 JSON 文件传输、进度记账和模式身份已分别拆到 service。`main.ts` 目前约 500 行，应用启动与导航仍待继续拆分。

## R2：原 Demo 视觉迁移（进行中）

本次修正桌面居中、取消弹窗背景模糊及完整 `devicePixelRatio` 适配。上轮开发 HTTP 聚焦测试 12/12 通过，不能单独证明线上模糊已解决。本轮生产 HTTP 与线上同视口对比确认：线上首次加载仍是默认 `300×150` Canvas（旧版只在尺寸为 0 时初始化）；1280×720 桌面偏右约 189px。当前本地生产构建首次加载桌面画布 `328×686`、DPR=3 手机 `1179×2468`、水平偏差 0；四组真实点击均推进且无 `pageerror`。`npm run build` 与临时 Playwright 探针退出码 0，已查看截图；实体设备与 R6/R7 全量验收仍未完成，未部署。详见 `docs/TEST_REPORT.md`。

已迁移并接入实际 Canvas 路径：

- 原 Demo 的拟 3D 圆柱转轮（`reelPosition`、角度、法线、深度排序）；
- 转轴、侧边支架、MATCH 固定框；
- 零件厚度、高光、描边、软阴影；
- 孔槽凹陷与填满面；
- 五格暂存阴影、编号、临满警告；
- 棋盘格、出口标记、可取高亮、阻挡抖动；
- `stored/fitted` 已按动作前 snapshot 映射棋盘/暂存起点与转轮/暂存终点；
- 原 Demo 风格飞行、落槽粒子、行完成庆祝和胜利粒子已接入。

本机浏览器验证：新 Canvas 可见；真实 pointer 点击令 `FITTED 0/12 → 1/12`；关卡 2 SPIN 实际 `2 → 1`；无 JS 错误。`tests/e2e/renderer-regression.spec.ts` 在 Chromium 与 Mobile Chrome 共 8/8 通过。

## R3：玩家交互闭环（进行中）

已修正：

- Home / Campaign / Game / Help / Settings / Result / Practice 已拆为独立 screen，并由 `AppRouter` 或主 GameScreen 生命周期管理；
- Daily/Practice 从游戏页顶栏移入 Home 与关卡选择 screen；
- Editor 不再向普通玩家游戏页暴露；
- 关卡标题缺少文案时显示中文 `第 NN 关` / 英文 `Level NN` fallback；
- 关卡选择确认有 200 张卡片及每日/练习入口；
- `Modal` 已负责焦点、inert、Escape、背景点击与 action 委托；
- `ListenerBag` 已接管 pagehide / visibilitychange / resize / keyboard 全局监听并在 pagehide 清理。

待完成：

- Editor 已迁入 `src/devtools/EditorScreen.ts`，仅通过 `?dev=1` 的 Home 开发入口开放；旧 editor action 与 renderer 已删除；
- 存档状态编排与应用装配继续拆出 `main.ts`（当前约 527 行，整改前约 1040 行）。

## R4：内容系统整改（进行中）

- 新增 10 种具名拓扑模板；主线第 9 关起即使用模板，旧 Demo 前 8 关保持原身份。
- `scripts/generate-levels.ts` 已加入模板选取、结构指纹去重和固定 seed 采样报告。
- 最近一次实际生成报告：200/200 levels；10 类模板均有分布；200 个唯一指纹；重复候选 0；固定 seed 样本 1000/1000 有效、0 重复、0 预算耗尽、0 fallback。
- `scripts/validate-levels.ts` 最近实测：200/200 witness 经正式 core 重放获胜。
- 内容更新兼容性：活跃局面新增精确 `levelContentIdentity`；旧 schema 2 或同 ID 换题局面拒绝续用，重开本关且保留通关/奖励；Home 不再把不兼容局面标为“继续”，进入本关后一次性提示。单测 32/32、迁移浏览器用例 2/2、完整 e2e 36/36 已通过。
- 第 9–20 关内容审查（读取当前 `campaign.json`，用正式 `replay`/`getLegalActions` 逐关计算）：12/12 可赢，含 10 种拓扑；但 12/12 witness 的 `witnessSpins=0`、`witnessPeakBuffer=0`，零件数 14–23。当前目标顺序由可取顺序逐组三个构造，尚未形成可证明的 SPIN/暂存教学节奏。旧 `docs/level-generation-report.json` 的关卡条目缺少现行脚本所写的峰值等字段，不可用作当前难度验收。
- 尚未完成：第 9–20 关人工策略精调、按章节拆包与难度/暂存峰值指标审查门槛；生成关卡目前确定可解但不能称作全部人工精调。

## R5-R7：未开始

- R5：服务/HostAdapter/生命周期整改；
- R6：全量单元、内容、浏览器与截图回归；
- R7：重新构建、单文件验证、Cloudflare Pages 更新。

## 仓库同步前新增的导入安全修复

- 审查发现旧文件导入只检查外层 schema，畸形 progress 可覆盖有效存档；现已在写存储前完整校验，并对无法验证的 Daily/Practice/Editor 局面仅丢弃活跃局面、保留全局进度。
- 当前 `npm run typecheck && npm run test && git diff --check` 退出码 0，单测 36/36；`saveImport`/`progressService` 聚焦测试 8/8。**导入修复后的完整 Playwright 未执行**（宿主证据锁拒绝启动），上轮 36/36 不作为最新改动的验收证明。
- `npm run lint` 最新执行退出码 1（153 项）。其中 7 项来自仓库中的 macOS `._*` 元数据/忽略产物解析，146 项为真实源码、脚本与测试 lint 错误；R4–R7 未完成，不能将当前版本描述为最终验收完成。

## 较早轮次验证（导入安全修复之前）

```text
npm run typecheck  ✅
npm run test       ✅ 本轮 32/32（含 levelContentIdentity、旧局面安全重开与进度保留）
npm run test:e2e  ✅ 本轮 36/36（Chromium + Mobile Chrome；含 save-migration 2/2）
npm run levels:validate ✅ 上轮 200/200 witness 经正式 core 重放
npm run build      ✅ 上轮根路径与 BASE_PATH=/shape-spin/ 均通过；本轮未重建
npm run build:standalone ✅ 上轮 200 关内联产物生成；本轮未重建
file:// 浏览器      ✅ 上轮 200 关、真实点击推进、零非 file 请求、零 JS 错误；本轮未重测
子目录 HTTP 浏览器 ✅ 上轮请求 /shape-spin/campaign.json、真实点击推进、零 JS/资源错误；本轮未重测
根目录旧缓存回归   ✅ 上轮注入旧 shape-spin-level-pack 后仍加载当前 200 关
仍待验证          ⚠ 实体 iOS/Android 与 App WebView、R4 人工精调及 R5–R7 最终验收
```

## 当前禁止项

- 不删除 `reference/demo-baseline/`；
- 不将当前整改描述为最终验收完成；
- 不将新增 renderer 模块当作完整架构整改；
- 不为普通玩家重新暴露 Editor 顶栏入口；
- 不隐瞒未通过/未验证项；后续部署仍需在文档记录真实命令与线上核验结果。
