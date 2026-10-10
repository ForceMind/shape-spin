# Shape Spin 整改基线与差异清单

记录时间：2026-09-18

## 冻结身份

| 项目 | 值 |
|---|---|
| 当前 Git commit | `fa211d9db6911553038ab2d64410c8690bd8851a` |
| 当前线上预览 | `https://a3833be8.shape-spin.pages.dev` |
| 线上/本地 bundle | `assets/index-7_iPFlxq.js`（已核对一致） |
| 原玩法与视觉基线 | `reference/demo-baseline/shape-spin-demo.html` |
| 工程/交互质量对标 | `/Volumes/Work/Prive/Arrow Flow` |

当前线上版本作为**整改前预览版本**保留；整改期间不得删除或覆盖原 Demo 基线。

## 已保留、可继续使用

- `src/core/`：规则、连通、原子动作、撤销、校验、回放、求解；整改必须保持规则测试通过。
- `src/content/pieceTypes.ts`：旧九种类型映射。
- `src/content/legacyLevels.ts`：旧八关稳定身份。
- `src/services/saveService.ts`：版本化存档与旧键迁移方向。
- `reference/demo-baseline/`：不可改动。

## 当前版本的确认问题

### P0：视觉与手感倒退

原 Demo 具备、当前表现层缺失或显著简化的内容：

- 基于 `reelPosition`、`RADIUS`、`STEP` 的拟 3D 转轮滚动；
- 以角度、法线、深度排序绘制的上下目标排；
- 零件飞行轨迹与落槽隐藏；
- `drawParticles` 粒子；
- `celebration` 行完成庆祝；
- 完整孔槽深度、轴承、转轴、边框与填满面；
- 暂存编号、稳定左移和临满槽警告；
- 阻挡弹回、镜头震动。

### P0：应用架构不对标

- `src/main.ts` 约 1000 行，承担启动、模式、存档、screen、输入、渲染、动画和编辑器逻辑；
- 缺少类似 Arrow Flow 的 `scenes`、`rendering`、`ui`、`services` 职责拆分；
- 缺少单一 Screen 生命周期与明确清理路径；
- 当前编辑器入口出现在普通游戏顶栏，违反“开发工具不属于玩家首页”。

### P1：内容与产品完整度不足

- 当前 200 关主要是确定性生成与 witness，可解不等同于人工调优的十类布局和难度节奏；
- 每日/练习/编辑器已有入口但 UI、奖励和隔离仍需按正式 screen 重做；
- 缺少 Arrow Flow 级别的 QA 脚本体系、主题系统及 PWA（后两项不在本次 P0 范围）。

## 整改不可违反的规则

1. 对标 Arrow Flow 的分层、交互完整度与测试纪律，**不复制**其 Phaser、假对战、假排行榜、支付或经济系统。
2. Shape Spin 继续使用 TypeScript + Vite + Canvas 2D + DOM/CSS；不以换技术栈为借口丢失原 Demo 表现。
3. 重构每一小步必须保留 `core/` 行为、八关身份、存档迁移和规则测试。
4. 不把入口、骨架或占位实现称为完整模式；不把静态检查称为浏览器测试。
5. 只有 R6-R7 全部验证后才重新部署整改版本；当前线上版本不作为最终交付宣称。
