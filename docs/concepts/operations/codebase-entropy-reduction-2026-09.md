---
sidebar_position: 5
title: "全仓熵减审计 · Entropy Reduction 2026-09"
---
# 全仓熵减审计（2026-09）

> 对本仓库执行的一次「清减 + 重点分解」级结构性熵减的完整留痕：已执行清单、量化结果、执行期勘误、行为变更声明与 backlog 全登记。方法论为三路并行取证（backend / Python 卫星域 / 前端域）+ 主线程对高危断言独立复核 + 分批执行逐批验证。

## 1. 范围与力度

- **范围**：全仓宏观 + 各子模块（backend / perceives / cognizes / cognizes-ui / negentropy-ui；influence 的「复制+校验」SSOT 与 wiki/agents-chat-core 排除在清减口径外）
- **力度**：全面死代码/冗余/命名清减 + 两个重点正交分解标的（backend `interface/api.py`、ui `knowledge-api.ts`）

## 2. 已执行清单

| 批 | commit | 内容 | 验证 |
|---|---|---|---|
| B1 | `aab8d566` | backend 死代码 4 项（prf_expander+PRF 旋钮 / lifecycle_types / db/deps get_db / numpy、scipy 直接依赖），净减 481 行 | 全量门失败集 ⊆ 已知基线，零新增 |
| B2 | `c413d4c1` | perceives skills/ 孤儿包 + benchmark 一次性脚本 + setup.sh 坏 cp + tagline 校正 + 文档死链，净减 1279 行 | 基线-回归完全一致（2131 passed / 4 既有失败） |
| B3 | `59edc595` | cognizes 死入口/死配置 + 陈旧重复测试树 + sandbox 归位 + Chunker 改名 + cognizes-ui 死模板/死依赖，净减 856 行 | unittests 225/2 维持；全树收集 3 ERROR→0 |
| B4 | `a6da8176` | ui 死簇 15 文件（hooks×3 / monitoring / adk guards / ui 组件×4 / conversation 目录 / 5 空壳 barrel），1620 行 | typecheck + 1006 用例 + build 全绿 |
| B5 | `dbb58ad2` | interface 路由测试先行：50 路由契约快照 + 遮蔽 lint + 鉴权 sweep + CRUD 冒烟 + reorder 暴露测试 | 契约绿 + 三红（bug 暴露） |
| B6 | `d257b664` | **行为变更**：修三域 reorder 路由遮蔽 422 | 232 passed 全绿（红转绿） |
| B7 | `c0b7f88c` | interface/api.py 3197 行 → 六域路由模块 + 25 行聚合器 | 契约 50 断言全绿；232 一致；全量门零新增 |
| B8 | `434b4e46` | knowledge-api.ts 3429 行/211 export → 11 模块目录，符号集编译期锁定 | 符号集 diff 为空；1006 用例全绿 |
| B9 | `52ac45ff` | backend 重复收敛六项（_utcnow×8+2 隐藏消费者 / _require_admin×3 / _resolve_app_name×2 / _get_knowledge_service×3 / env-falsy×5+双读消除 / 日志统一×8 文件），净 -49 行 + 消除 8 处语义漂移源 | ruff 零告警；定向 2745 passed；全量门 7 failed ⊆ 基线集 |
| B10 | `f9b98dc0` | （条件批次）knowledge/service.py 12 个 execute_*_pipeline 的 8 步执行骨架抽取为 `_run_async_pipeline`（body 回调 + 差异参数 + on_error 钩子），净 -171 行、样板 12→1；日志键序脚本比对与 HEAD 12/12 全等 | knowledge 域 1143 passed；全量门 ⊆ 基线集 |
| B11 | 本提交 | 审计文档 + knowledge-map + CHANGELOG | — |
| B12 | `21b5790a`+`cba8fc69` | （条件批次）ui BFF 代理三合一（1178→756，净减 422 行）+ bff 契约测试 9 例；adk.ts 下线经取证中止（见 §4） | typecheck + 1015 用例 + build + lint 全绿 |

## 3. 行为变更声明（B6）

`PATCH /interface/{mcp/servers,tools,skills}/reorder` 自注册起即被各自 `{id: UUID}` 参数路由遮蔽——Starlette 首序全匹配将字面量段 `reorder` 当作 `{id}` 做 UUID 解析返回 422，reorder handler 不可达（`agents/reorder` 注册序正确故未受影响）。影响面：三域拖拽排序持久化静默损坏。修复后契约测试的静态遮蔽 lint（字面量段注册于参数段之后即失败）作为永久机器防线。

## 4. 执行期勘误（探索期结论 → 复核修正）

探索代理的高危断言经主线程独立 grep 复核，以下结论被纠偏——**这是"删除前执行日重 grep（含函数内延迟导入）"硬门的直接产出**：

| 探索期结论 | 复核事实 | 处置 |
|---|---|---|
| `engine/relevance/` 整包死代码 | `rocchio_reweighter.py` 被 `memory_automation.py` 函数内延迟导入（活路径） | 仅删 `prf_expander.py` + PRF 旋钮 |
| ui `dashboard/_lib/api.ts` 零引用 | 有 2 个活消费方（TaskDetailDrawer/useSchedulerData） | 跳过不删 |
| rxjs 零引用可删 | catalog 锁定的 AGUI 协议运行时（防 Observable 双实例化） | 保留并登记 |
| cognizes 无 CI | 有（backend-tests/ruff/ui-tests，paths 触发） | 修正基线假设 |
| cognizes-ui vitest 全套死基建 | 是跨包测试宿主（收集 `../cognizes/tests/ui` 4 个活文件，CI 生产依赖） | 保留 faker/msw/vitest，仅删确证死项 |
| interface/api.py 49 路由 | 实为 49（探索计数 50 混入了导出日志行） | 契约以实测为准 |
| ui `lib/adk.ts`「兼容入口大半是 re-export」可下线 | re-export 仅 7 行，其余 ~900 行是 ADK→AG-UI 流归一化 SSOT 本体（620 行 normalizer） | 下线中止，维持现状 |

## 5. 后端测试基线方法论（本地共享库）

**根因链**（修复 117 failed + 90 errors 的本地破窗）：共享 `negentropy_test` 库（schema `negentropy`）被 `db/test_migrations.py::reset_database` 的全量降级砸坏——0067 迁移的破坏性降级护栏被 347 条遗留 library documents 拒绝 → 降级半途停在 0073 → 同会话后续集成测试崩坏。CI 空容器不复现。

**本地口径**：
1. 全量门命令：`uv run pytest tests/unit_tests tests/integration_tests --deselect tests/integration_tests/db/test_migrations.py`
2. 已知基线失败集（共享库数据污染型，CI 空库全绿）：`test_catalog_cross_corpus` 4 例（全表扫描断言 × 358 条累积文档）、`test_routine_orchestrator` dispatch 系列 0-4 例、`test_scheduler_registry::test_interval_task_due` 0-1 例、`test_evolution_full_loop` 1 例——**比对用失败名清单而非计数**（同类 flaky 在 0-10 间波动）
3. 已做非破坏修复：测试库 additive upgrade 至 0099（`NE_DB_URL=postgresql+asyncpg://…` 注意 env.py 为 async 引擎）；四行固定名测试残留 corpus 改名保全（`-legacy-20260910` 后缀，未删数据）

## 6. 跨模块重复决策记录（抽包边界）

- **图渲染引擎套件**（ui 与 wiki 各一套，同依赖集、分叉演化）：有意分叉，暂不抽包——wiki 有静态化约束，待第三消费者出现再议
- **markdown 管线**（ui / wiki / cognizes 三份）：同上，有意分叉
- **`cn()`**（ui / cognizes-ui 各一份）：8 行工具，抽包成本 > 收益
- **agents-chat-core**：全部 44 个引用在 negentropy-ui——定位实为「ui 私有分层」而非跨前端共享包，命名与预期不符但结构健康，暂不动
- **rxjs**：保留（见 §4）
- **influence**：「复制+校验」受 skeleton.toml + verify_skeleton.py 机器执法，为文档化有意决策

## 7. 量化结果

口径：物理行（`wc -l` 含空行注释），生产/测试分栏，基线 `f953441a` vs 终态；排除 influence/wiki/agents-chat-core。

| 模块 | 基线（f953441a） | 终态 | Δ 生产 | 降幅 |
|---|---|---|---|---|
| backend 生产（src） | 123,205 | 122,734 | **-471** | -0.38% |
| backend 测试 | 66,414 | 66,801 | +387（新增 392 行路由契约/集成测试） | — |
| perceives 生产（src） | 44,807 | 44,577 | **-230** | -0.51% |
| perceives 测试 | 35,878 | 35,878 | 0 | — |
| cognizes 生产（src） | 16,283 | 16,283 | 0（sandbox 归位/Chunker 改名不改行数） | — |
| cognizes 测试 | 21,467 | 21,169 | -298（陈旧分叉测试树） | — |
| negentropy-ui 生产 | 90,688 | 89,145 | **-1,543** | -1.70% |
| negentropy-ui 测试 | 30,688 | 30,825 | +137（新增 BFF 契约测试） | — |
| cognizes-ui 生产 | 9,243 | 8,882 | **-361** | -3.90% |

**合计：生产代码净减 2,605 行（口径内 0.92%）**；口径外另有 perceives 一次性基准脚本 -1,049 行（scripts/ 不在 src 口径）、pnpm-lock -157 行、测试侧净 +226 行（新增契约/路由/集成测试 529 行 - 死测试与陈旧树清理 303 行）。

**结构性收益（LOC 不可见）**：`interface/api.py` 3,197 行单体 → 25 行聚合器 + 六域模块（49 路由契约锁定）；`knowledge-api.ts` 3,429 行/211 export → 11 模块目录（符号集编译期锁定）；三份 BFF 代理 1,178 → 756；12× 管线样板 → 1；8 组跨文件重复 helper → 单一事实源；一个线上遮蔽缺陷修复 + 静态防再发 lint。

**终局补验**：ui e2e chat-smoke 1 passed（真实浏览器路径）；backend performance_tests 7 passed/1 skipped（顺手修复 `get_subtree` 测试的一处既有 kwarg 签名漂移，该套件此前从未进本地基线口径）。

## 8. Backlog（未执行项全登记）

**结构性（高价值）**：`knowledge/service.py`（4099 行）文件级拆分、perceives `assembly.py`（4099 行，AssemblyStage 在 :4078）按 test_assembly_* 边界拆分、PDF 双路径收敛（`pdf/` 传统路径降级 thin wrapper，`attempt_pipeline` 降级日志为切换依据）、`home-body.tsx`（1512 行，文件头自带 TODO）拆分、`engine/api.py` 内联 SQL 下沉、perceives `markdown/formatter.py`（2693 行/82 方法）拆分、巨型函数拆分（`_execute_build` 1271 行、`invoke` 1134 行）
**测试工程**：`test_migrations.py` 改用独立临时库（`negentropy_mig_test` 闲置库暗示此意图，当前它在共享库上做全量降级循环会砸坏后续会话）、非密闭集成测试治理（固定名 corpus / 全表扫描断言相对化）、cognizes 测试目录三名归一（unittests/agents-unit/integration）、覆盖农场测试清理（test_simple_coverage 等）、SQL 孪生纳管 check_twin_files（src engine/schema ↔ docs 两目录已漂移 89 行）
**语义规范化**：chat 域四名收敛（ChatMessage/ConversationNode/TranscriptItem/SessionRecord）、a2ui/agui 语义、patrol 词表三分（patrol_*/_*_inspector/longitudinal_recheck）、「repository」三义、`interface/` 包更名（实为插件控制面）、logger 域名拆分、`GraphCanvas`→CytoscapeGraphCanvas、cognizes「realm」文档名与代码 mind 统一、features/ 空壳域归并、model_names vs model_resolver 双口径
**配置与 CI**：36 处 env 散读收编 config、异常基类统一、migration helper 去重（`_table_exists`×9，注意迁移历史文件冻结原则）、perceives-ci 拆 reusable、pip-audit ignore 清单与 pyproject 合一、cognizes-ruff 与 reusable-quality 的 lint job 合并、scripts/tests/*.sh CI 挂钩、cognizes Dockerfile COPY 不存在目录（L28-29）、setup.sh 引用不存在 compose 服务
**cognizes「只有测试在养」模块处置**（需产品决策）：agent_executor（Phase 4 招牌交付）、reranker、index_warmup、copilotkit_server、generate_test_data
**其他**：influence TTS 四脚本家族（3241 行）收敛、poc-hyperframes 归档、cognizes sandbox 与 backend 合流（现为两份独立实现）、perceives 四层同面（sdk/tools/ops/cli 同名函数逐层重复）

## 9. 执行纪律沉淀

- 删除标的执行日重 grep（含函数内延迟导入/字符串动态导入/tests/scripts 全域）是硬门——本次 6 项探索期结论被纠偏
- **任何提交前必须全量核对暂存区**（`git status --porcelain | grep "^[MARD]"`）且**看到什么就提交什么**：并行代理的 `git rm/git mv` 会预先进入 index，按路径 `git add` 不会清除它们（本次 aab8d566 因此混入并行批次的一条删除，终态由 434b4e46 补齐）；`git add` 的任一路径不存在会**整命令失败**，重定向 stderr 会掩盖它（本次 21b5790a 因此只含契约测试，实现由 cba8fc69 补齐）——两次都依赖「终态树正确」兜底，核对输出必须与预期清单逐项对照后才允许 commit
- 子代理工单须显式禁止 git 写操作
- 行为等价性验证前必须先让测试暴露既有 bug（B5→B6 序列），否则拆分会把 bug 固化进基线
