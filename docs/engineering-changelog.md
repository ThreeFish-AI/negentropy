# 工程变更日志

> 目标：沉淀已经完成的工程里程碑，记录背景、完成内容、影响面与验证结果，避免团队对当前工程基线产生状态误判。

## 2026-03-10 · QA 与发布流水线基线收口

### 背景

在此轮治理前，`Negentropy` 已具备后端与 UI 两条独立测试 workflow，但仍存在 4 个系统性缺口：

- `PR` 门禁与 `Release` 没有共享同一套 QA 定义，存在漂移风险；
- 发布阶段缺乏稳定的版本工件、校验和与元数据清单；
- 依赖清单变更缺少单独的供应链审查哨兵；
- 本地 UI lint 会被 `coverage/` 等生成产物噪音污染。

### 完成内容

本次治理完成如下收口：

1. 将后端与 UI 测试主链路提取为 reusable workflows：
   - [reusable-negentropy-backend-quality.yml](../.github/workflows/reusable-negentropy-backend-quality.yml)
   - [reusable-negentropy-ui-quality.yml](../.github/workflows/reusable-negentropy-ui-quality.yml)
2. 将现有入口 workflow 改造成薄封装：
   - [negentropy-backend-tests.yml](../.github/workflows/negentropy-backend-tests.yml)
   - [negentropy-ui-tests.yml](../.github/workflows/negentropy-ui-tests.yml)
3. 新增发布工作流 [negentropy-release.yml](../.github/workflows/negentropy-release.yml)，统一执行 QA、构建工件、输出 `release-manifest.json` 与 `SHA256SUMS.txt`。
4. 新增依赖审查工作流 [negentropy-dependency-review.yml](../.github/workflows/negentropy-dependency-review.yml)，对 lockfile / manifest 改动施加高危漏洞门禁。
5. 收敛覆盖率阈值与本地噪音：
   - 后端 `coverage fail_under = 50`
   - UI `vitest` 覆盖率总阈值接入
   - UI `eslint` 忽略生成产物目录
6. UI 构建改为 `standalone` 输出，以便 release 工件可移植归档。
7. 新增 [`apps/negentropy-ui/scripts/start-production.mjs`](../apps/negentropy-ui/scripts/start-production.mjs)，统一源码工作树、Playwright 冒烟与 release bundle 的生产启动入口，移除 `next start` 与 `standalone` 输出之间的契约偏移。

### 影响与当前状态

- 代码门禁、发布门禁共享同一套 QA 定义，单一事实源更清晰。
- 发布不再只是“重新跑一次 build”，而是带有版本、校验和与元数据的可追溯工件生产过程。
- 供应链风险更早暴露在 PR 阶段，减少把依赖问题带入主干或发布窗口的概率。
- 本地开发者执行 `pnpm lint` 时不会再被 `coverage/`、`playwright-report/` 之类的生成产物干扰。
- UI 自动化冒烟现在直接启动与发布工件同构的 standalone 服务器，QA 信号更贴近真实发布拓扑。

### 验证

本轮治理完成后，已执行并通过以下本地验证：

- `cd apps/negentropy && uv run pytest tests/unit_tests/`
- `pnpm --dir apps/negentropy-ui lint`
- `pnpm --dir apps/negentropy-ui typecheck`
- `pnpm --dir apps/negentropy-ui test:coverage`
- `pnpm --dir apps/negentropy-ui build`
- `pnpm --dir apps/negentropy-ui test:e2e`

### 相关链接

- 流水线文档：[docs/qa-delivery-pipeline.md](./qa-delivery-pipeline.md)
- 发布工作流：[.github/workflows/negentropy-release.yml](../.github/workflows/negentropy-release.yml)
- 依赖审查：[.github/workflows/negentropy-dependency-review.yml](../.github/workflows/negentropy-dependency-review.yml)
- 后端复用 QA：[.github/workflows/reusable-negentropy-backend-quality.yml](../.github/workflows/reusable-negentropy-backend-quality.yml)
- UI 复用 QA：[.github/workflows/reusable-negentropy-ui-quality.yml](../.github/workflows/reusable-negentropy-ui-quality.yml)

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
