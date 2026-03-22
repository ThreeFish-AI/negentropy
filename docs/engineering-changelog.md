# 工程变更日志

> 目标：沉淀已经完成的工程里程碑，记录背景、完成内容、影响面与验证结果，避免团队对当前工程基线产生状态误判。

## 2026-03-08 · UI ESLint 基线治理完成

### 背景

在这轮治理开始前，`apps/negentropy-ui` 的 ESLint 仍处于“专项 guard 过渡态”：

- UI 基线存在 `47` 个问题，其中 `16` 个 error、`31` 个 warning。
- `useSessionManager` 的禁用依赖临时专项 guard，而不是正式全量 lint 门禁。
- UI CI 还没有把 `pnpm lint` 作为标准工程门禁接入。

对应总追踪 issue 为 [#185 技术债(UI): 清理 ESLint 基线并启用全量 pnpm lint CI 门禁](https://github.com/ThreeFish-AI/negentropy/issues/185)。

### 完成内容

本次治理按 3 个批次完成：

1. Batch 1：清理 React 语义类 ESLint error  
   关联 PR：[ #191 ](https://github.com/ThreeFish-AI/negentropy/pull/191)
2. Batch 2：清理类型与导入类 ESLint error  
   关联 PR：[ #194 ](https://github.com/ThreeFish-AI/negentropy/pull/194)
3. Batch 3：清理 warning 并启用全量 lint CI  
   关联 PR：[ #196 ](https://github.com/ThreeFish-AI/negentropy/pull/196)

同时完成以下收尾动作：

- 父任务 [#185](https://github.com/ThreeFish-AI/negentropy/issues/185) 已完成收口并关闭。
- 子任务 [#187](https://github.com/ThreeFish-AI/negentropy/issues/187)、[#188](https://github.com/ThreeFish-AI/negentropy/issues/188)、[#189](https://github.com/ThreeFish-AI/negentropy/issues/189) 已全部关闭。
- UI workflow 已切换到正式全量 lint job，见 [UI Test Suite](../.github/workflows/negentropy-ui-tests.yml)。
- `lint:legacy-session-imports` 与专项扫描脚本已退役，禁用 `useSessionManager` 的职责回归 ESLint 规则本身。

### 影响与当前状态

当前工程基线已经从“专项 guard 过渡态”切换为“正式 lint 门禁态”：

- `pnpm lint` 已成为 `apps/negentropy-ui` 的正式工程门禁。
- `useSessionManager` 的禁用由 [apps/negentropy-ui/eslint.config.mjs](../apps/negentropy-ui/eslint.config.mjs) 中的 `no-restricted-imports` 承载。
- `useSessionManager` 仍保留为 legacy 兼容入口，但其架构边界说明已同步收敛到 [A2UI 文档](./a2ui.md)。
- UI 规划与落地背景仍可参考 [UI 设计与落地方案](./negentropy-ui-plan.md)。

### 验证

本轮治理完成时，执行并通过了以下校验：

- `pnpm --dir apps/negentropy-ui lint`
- `pnpm --dir apps/negentropy-ui typecheck`
- `pnpm --dir apps/negentropy-ui test`

其中 Batch 3 收尾时，`vitest` 结果为 `50` 个测试文件、`264` 个测试全部通过。

### 相关链接

- 总任务：[ #185 ](https://github.com/ThreeFish-AI/negentropy/issues/185)
- Batch 1：[ #187 ](https://github.com/ThreeFish-AI/negentropy/issues/187) / [ #191 ](https://github.com/ThreeFish-AI/negentropy/pull/191)
- Batch 2：[ #188 ](https://github.com/ThreeFish-AI/negentropy/issues/188) / [ #194 ](https://github.com/ThreeFish-AI/negentropy/pull/194)
- Batch 3：[ #189 ](https://github.com/ThreeFish-AI/negentropy/issues/189) / [ #196 ](https://github.com/ThreeFish-AI/negentropy/pull/196)
- UI workflow：[.github/workflows/negentropy-ui-tests.yml](../.github/workflows/negentropy-ui-tests.yml)
- ESLint 约束：[apps/negentropy-ui/eslint.config.mjs](../apps/negentropy-ui/eslint.config.mjs)
- UI 架构文档：[docs/a2ui.md](./a2ui.md)
