# 开发进展

## 当前阶段：全部核心阶段已完成，项目已部署上线

**线上地址**：https://a3833be8.shape-spin.pages.dev
**GitHub 仓库**：https://github.com/ForceMind/shape-spin
**当前版本**：`main` 分支 commit `111bf33`

---

## 项目状态总览

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段 0：基线验证 | ✅ 完成 | 原 Demo 已保留到 `reference/demo-baseline/`，字节一致 |
| 阶段 1：规则工程化 | ✅ 完成 | 纯 TypeScript 核心，typecheck 0 错误 |
| 阶段 2：表现层接管 | ✅ 完成 | Canvas 2D + DOM，无 Phaser |
| 阶段 3：完整游戏 | ✅ 完成 | 200 关、每日、练习、编辑器全部实现 |
| 阶段 4：打磨与兼容 | ✅ 完成 | 性能优化、奖励兼容、默认中文 |
| 阶段 5：双产物交付 | ✅ 完成 | `dist/` + `release/shape-spin.html` 单文件版 |
| 部署 | ✅ 完成 | Cloudflare Pages + GitHub 推送 |

---

## 技术栈

- **前端**：TypeScript + Vite + Canvas 2D + 原生 DOM/CSS
- **测试**：Vitest（单元）+ Playwright（e2e）
- **部署**：Cloudflare Pages（静态）
- **包管理**：npm

---

## 核心功能

### 游戏规则
- 出口四向空格连通判定（BFS）
- 形状 + 颜色双条件匹配
- 5 格暂存区（先进先出）
- 三列转轮共享当前排索引
- 确定性 SPIN 切换目标排
- 自动连锁结算
- 原子操作 + 完整撤销（整链回退）
- 胜负判定（无合法推进动作即失败）

### 游戏模式
- **主线闯关**：200 关（10 章 × 20 关），星级评价（1-3 星）
- **每日挑战**：UTC 00:00 确定性选关，本地最佳记录
- **自由练习**：种子 + 难度参数化生成
- **关卡编辑器**：可视化编辑、类型循环、添加/删除行、自动供需平衡、导出/导入 JSON

### 玩家系统
- 首次通关奖励 +10 演示金币（幂等账本）
- 本地存档（schema 2）：进度、设置、活跃局面、历史、audit
- 旧存档迁移：`shape-spin-demo-v1` → `shape-spin-save-v2`
- 中英文切换（默认中文）
- 减少动态效果选项
- 存档导出/导入 JSON

---

## 验证结果（全部本机实测）

| 检查项 | 结果 |
|--------|------|
| `npm run typecheck` | ✅ 0 错误 |
| `npm run test`（单元） | ✅ 14/14 通过 |
| `npm run test:e2e`（Chromium） | ✅ 11/11 通过 |
| `npm run test:e2e`（Mobile Chrome） | ✅ 11/11 通过 |
| `npm run levels:validate` | ✅ 8/8 witness 重放通过 |
| `npm run build` | ✅ 成功 |
| `npm run build:standalone` | ✅ 成功（894KB 单文件） |
| `file://` 单文件打开 | ✅ 正常加载、无 JS 错误 |
| Cloudflare Pages 部署 | ✅ https://a3833be8.shape-spin.pages.dev |
| GitHub 推送 | ✅ ForceMind/shape-spin |

---

## 构建产物

| 产物 | 大小 | 说明 |
|------|------|------|
| `dist/assets/index-*.js` | 48.5KB (gzip 15.8KB) | 主 bundle |
| `dist/assets/index-*.css` | 13.5KB (gzip 4.2KB) | 样式 |
| `dist/campaign.json` | 853KB | 200 关数据（独立加载） |
| `release/shape-spin.html` | 894KB | 单文件版（内联全部） |

---

## 项目结构

```
Shape Spin/
├── src/
│   ├── core/              # 纯规则层（无 DOM 依赖）
│   │   ├── types.ts       # LevelDefinition / GameState / PlayerAction
│   │   ├── engine.ts      # 原子操作、自动结算、胜负判定
│   │   ├── session.ts     # 撤销、历史、audit
│   │   ├── solver.ts      # BFS 求解 + seedWitness
│   │   ├── validation.ts  # 关卡/状态校验
│   │   ├── replay.ts      # witness 重放
│   │   └── serialization.ts # 存档序列化
│   ├── content/
│   │   ├── pieceTypes.ts  # 9 种类型映射
│   │   ├── legacyLevels.ts # 旧 8 关兼容
│   │   └── generated/     # 200 关数据（JSON + TS wrapper）
│   ├── services/
│   │   ├── i18n.ts        # 中英双语（默认中文）
│   │   ├── audio.ts       # WebAudio 音效
│   │   └── saveService.ts # localStorage 存档
│   ├── main.ts            # 页面入口（Canvas 渲染 + UI）
│   └── styles/game.css    # 全部样式
├── scripts/
│   ├── generate-levels.ts # 200 关生成器
│   ├── validate-levels.ts # witness 验证
│   └── build-standalone.ts # 单文件构建
├── tests/
│   ├── unit/              # 14 个单元测试
│   └── e2e/               # 11 个 e2e 测试
├── dist/                  # 静态部署产物
├── release/               # 单文件产物
└── reference/demo-baseline/ # 原始 Demo 备份
```

---

## 与 Arrow Flow 的关键差异

| 维度 | Arrow Flow | Shape Spin |
|------|-----------|-----------|
| 引擎 | Phaser 3.90 | 原生 Canvas 2D |
| 关卡数 | 2000 关（40 章 × 50 关） | 200 关（10 章 × 20 关） |
| 核心玩法 | 箭头飞出棋盘 | 形状颜色匹配 + 暂存 + 转轮 |
| 求解器 | 贪心 | BFS + seedWitness |
| 部署 | GitHub Pages | Cloudflare Pages |
| PWA | 有 Service Worker | 未实现（可选） |

---

## 已知限制（非阻塞）

- 无 PWA（Service Worker、manifest）——任务书未强制要求
- 无主题/皮肤系统——Arrow Flow 有，Shape Spin 可后续加
- 无本地排行榜——可后续加速成记录
- 动画较简单——目前为 CSS + Canvas 渐变，无粒子特效

---

## 下一步（可选优化，非必须）

1. PWA 支持（离线可玩、添加到主屏）
2. 主题系统（金币解锁配色）
3. 更丰富的动画（转轮 3D 效果、粒子反馈）
4. 性能进一步优化（campaign.json 动态 import 拆包）

---

## 重要边界（始终遵守）

- 原始 `shape-spin-demo.html` 和截图不修改、不删除
- 核心规则：出口四向连通、双条件匹配、固定五格暂存、共享目标排、确定性 SPIN
- 奖励幂等：主线按 `levelId`，每日按日期，不重复发放
- 默认中文，完整支持英文切换
- 不在沙盒尝试 GitHub/Cloudflare 认证
