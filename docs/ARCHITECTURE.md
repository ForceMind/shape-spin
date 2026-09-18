# Shape Spin 架构

## 当前基线

原始 `shape-spin-demo.html` 被完整保留在 `reference/demo-baseline/`。为接管而非重写，当前已原样拆分：

- `src/core/legacy-engine.js`：旧 `TYPES`、八关定义、`selectable()`、`Engine`。
- `src/render/legacy-app.js`：Canvas、DOM UI、音效、动画、旧存档和 `window.ShapeSpinDemo`。
- `src/styles/game.css`：原内联样式。
- `index.html`：引用上述拆分文件。

拆分不等于规则迁移；现阶段仍是旧 JavaScript 实现。

## 目标分层

```text
src/core/       纯 TypeScript 规则、状态、连通性、事务、验证、回放
src/content/    类型、八关映射、主线与挑战内容
src/levels/     schema、生成、求解、指标、结构去重
src/render/     Canvas 2D、转轮、零件、布局、动画事件消费
src/ui/         页面与弹窗、输入及教程
src/services/   存档、奖励、统计、计时、音频、国际化
src/platform/   BrowserAdapter 与受限 HostAdapter
src/devtools/   编辑器、受限开发辅助
```

规则层只接收数据并输出新状态与事件。渲染层只能消费状态/事件；它不能维护另一个真实暂存区、目标排或资源余额。

## 规则事务

`applyAction(level, state, audit, action)` 依次完成：

1. 运行时验证 action、level 和 state；
2. 克隆候选局面；
3. 执行合法的取出或 SPIN；
4. 运行同步、有限的 `settle()`；
5. 检查守恒和全部状态不变量；
6. 产出提交后的状态、表现 `GameEvent[]` 和不可撤回 audit 更新。

无效 action 不产生状态变更、历史项或 audit 变更。UI 对动画期间输入加锁，使用 session epoch 取消旧回调；规则逻辑本身不等动画。

## 旧实现差异登记

| 范围 | 旧实现 | 目标迁移 |
|---|---|---|
| 连通性 | `selectable()` 从已取走的顶行格扩展，再取相邻未取格 | 用“移除该零件后的四向空格到 exits 搜索”明确表达，并支持 `exits` |
| 失败 | `_finish()` 仅在暂存满且 `spins===0` 时检查直接归位 | 稳定后检查所有合法取出与合法 SPIN，无推进才失败 |
| 类型 | 单一 `key` 绑定形状与颜色 | 保留旧 key 稳定映射，新增稳定 `typeId`、`shapeId`、`colorId` |
| 历史 | 只保存局面，最多 50 步 | 局面历史与不可撤回 `RunAudit` 分离；存档最近至少 12 步 |
| 奖励 | `completed` 数组隐式决定 +10 | 使用稳定奖励账本，胜利事务幂等写入 |
| 存档 | `shape-spin-demo-v1` 直接存局面 | 版本化 `SaveEnvelope`、备份、校验、迁移和恢复 |
| 文案 | 大量中文字符串散落渲染/UI | 集中 i18n，默认英文、完整中文 |
| 调试 | 正式页面暴露 `window.ShapeSpinDemo` | 仅开发/测试构建保留受限工具，正式构建不暴露作弊接口 |

## 发布模型

Vite 负责静态构建。构建必须支持 `BASE_PATH`，不能写死根路径。单文件版本由构建脚本从同一代码库内联必要 JS/CSS/资源；在 `file://` 下，Worker 能力使用可取消分片回退。

Cloudflare Pages 仅部署 `dist/` 静态内容。配置和实际部署将在本地 Node/npm、构建与测试恢复后进行；不能将当前文档当成已部署凭据。
