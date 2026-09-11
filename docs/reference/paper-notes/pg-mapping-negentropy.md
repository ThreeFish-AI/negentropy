# PG ↔ negentropy 机制映射报告

> 把 [Procedural Graph 论文精读笔记](./procedural-graphs.md)（arXiv:2609.09153）的机制对照到本仓 Routine / 巡检 / 自进化体系，回答「论文的哪些设计本仓已有、哪些是真增量、哪些值得落地」。**只分析不改码**；锚点均经实际代码核验（分支 `ThreeFish-AI/agent-graph-paper-guided-study`）。

## 结论先行

本仓**已实现 PG 的「门控进化」骨架且部分环节更完备**（shadow/canary 双窗、人审矩阵、纯函数决策边界）；PG 的真增量集中在三件事：① 程序性知识的**显式图表示**（typed 边 + 三属性）；② 拒绝记忆的**编辑级结构化**（负证据阻断重复提案）；③ 「平局接受」语义的显式化。五条映射中，**M2（拒绝记忆进进化回路）值得落地，M3（报告纪律）值得一句话补文档，其余已对齐或按 YAGNI 暂缓**。

## 映射总表

| # | PG 机制（论文出处） | 本仓对应 | 锚点 | 判定 |
| --- | --- | --- | --- | --- |
| M1 | 验证门：候选 ≥ 缓存分才接受，**平局也接受**（§3.3 式 5） | 金丝雀双窗判定；routine 成功/停滞判定 | [`evolution/decision.py:228`](../../../apps/negentropy/src/negentropy/engine/evolution/decision.py) · [`routine/decision.py:96`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 已对齐 |
| M2 | 拒绝记忆：被拒编辑连同轨迹作负证据注入下一轮提案（§3.3 式 6） | 巡检记忆的正/负证据标签体系；进化提案回路缺编辑级负证据 | [`routine/patrol_memory.py:43-45`](../../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) | 🔶 部分对齐，**值得落地** |
| M3 | 报告纪律：报「返回图 85%」而非「搜索最优 95%」，杜绝测试集选优（§5.4） | `decide()` 以最新迭代判成功、`best_score` 仅作停滞参照 | [`routine/decision.py:34`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 天然对齐，宜显式成文 |
| M4 | 边属性 `condition`/`guidance`/`pitfalls`：转移级操作知识（§3.1） | definitions SSOT → harness_materializer 渲染 skill/routine 定义 | [`agents/definitions/harness_materializer.py`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) | ⏸ 暂缓（YAGNI） |
| M5 | 结构校验先于验证 rollout：非法候选不花预算、直接沉淀负证据（Algorithm 1 L11-13） | 决策纯函数边界（不读 settings、参数显式注入）+ 门控语义（门控超时/失败 ≠ 门控通过，ISSUE-115） | [`routine/decision.py:96-170`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 已对齐 |

## 逐条说明

### M1 验证门与「平局接受」——存量已对齐

- PG 的门是「单一权威信号（验证分）+ 缓存参考分 + 平局接受」。本仓 [`decide_canary`](../../../apps/negentropy/src/negentropy/engine/evolution/decision.py) 已实现同型语义：**「helpful_ratio 允许 0 改进（只要不下降）」即平局接受，任一退化则 rollback**，且比 PG 多了样本充足性检查（`hold` 而非立即定夺）。
- routine 侧 [`decide()`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) 的停滞判定同样吸收了「平局含信息」：ISSUE-128 引入的 `no_progress_score_tolerance` 容差带（经 [`orchestrator.py:905-911`](../../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) per-routine 注入）把「评分落在 [历史最优 − tolerance, +∞)」视为有进展——这正是对 Judge 聚合分天然 ± 振荡的「平局语义」处理，与 PG 面对小验证集时的谨慎同源。
- **无需落地**；价值在于交叉确认：两套独立系统在同一个坑位收敛到同一个解法，说明该模式已是领域共识（PG 之外，金丝雀发布、进化计算 elitism 亦然）。

### M2 拒绝记忆——巡检侧已结构化，进化侧是真空区

- 本仓巡检记忆已有一套**正/负证据双轨**：[`patrol_memory.py`](../../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) 的 `pdf-fidelity-unfixable`（区域级不可修复标记 = 负证据，会话内避让）、`pdf-fidelity-pattern`（有效修法 = 正证据，向后传播）、`pdf-fidelity-baseline`（回归基线集 + `DEFAULT_REGRESSION_DROP_THRESHOLD = 3` 的非回归门）。这与 PG「被拒候选 + 成功 pattern 分轨沉淀」的设计同构，且以 tag 键定的确定性查询实现了 SSOT。
- **差异在进化回路**：PG 的拒绝记忆是**编辑级**的——记录「哪个结构变更提案、在哪个验证集上、掉了多少分」，并作为负证据注入下一轮提案器（式 6）。本仓 [自进化 Agents Team 方案](../../concepts/design/self-evolving-agents.md) 的 GEPA 反思回路目前从**执行反馈**提案，尚无「历史被拒提案」的结构化沉淀；若提案器重复生成等价坏提案，没有机制层阻断。
- **建议落地**（对应方案落地阶段实施）：`evolution_proposals` 增加 `rejection_evidence` 沉淀（提案 diff + 验证指标 delta + 拒绝原因），提案器上下文注入最近 N 条负证据。PG 的经验是这能拦住「训练集动机未泛化」型重复提案（论文 R3/R10 均为实例）。

### M3 报告纪律——实现已对齐，宜显式成文

- PG 明确区分「返回图」（部署产物）与「搜索最优」（过程观测），只报前者。本仓 `decide()` 判成功用 `latest.score`（返回态），`best_score` 仅在 [`_is_no_progress`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) 内作窗口外基线参照（窗口语义见该函数注释）——不存在「挑历史最优轮交付」的选优路径，纪律天然对齐。
- 风险在未来：自进化方案上线后若引入「保留历史最优版本」语义（版本库挑拣），须显式区分「部署返回态」与「搜索最优态」两个口径，避免测试集选优。建议在 [自进化 Agents Team 方案](../../concepts/design/self-evolving-agents.md) 评测节补一句该纪律——**一句话成本，防一类评估事故**。

### M4 边属性三件套——暂缓，等真实痛点

- PG 把「何时走 / 怎么走 / 别踩什么坑」字段化到**转移级**。本仓 definitions SSOT → [`harness_materializer`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) 渲染的是 skill/routine 定义的文本与结构化字段，步骤间依赖以叙述存在。
- 借鉴形态：给 routine preset / harness skill 的步骤定义加 `condition`/`pitfalls` 显式字段（不必引入完整图）。**判定暂缓**：当前 routine 失败模式中未见「步骤乱序」主导的案例（Judge 振荡/命名门控才是主痛点），按最小干预原则等真实痛点出现再动（论文自己也证明：错误位置的结构先验会把 MultiChallenge 从 87.5 拖到 58.9——结构是双刃剑）。

### M5 结构校验先于 rollout——存量已对齐

- PG：结构非法的候选不进验证 rollout，直接入拒绝记忆（省预算 + 负证据沉淀）。本仓同型模式两处：① 决策层纯函数边界（`decide()` 不读 settings、阈值/容差显式注入，非法输入在类型层即被拒）；② 门控语义（ISSUE-115：`gate_exit_code ∉ {None, 0}` 时整块跳过成功判定——「门控超时/失败 ≠ 门控通过」）。原则一致：**不可用候选在进入昂贵验证之前拦截**。

## 落地建议汇总

1. **做**：M2——自进化方案的提案回路增加编辑级拒绝记忆（提案 diff + 指标 delta + 原因，注入下一轮提案上下文）。
2. **写**：M3——自进化方案评测节补「报告返回态而非搜索最优」纪律一句。
3. **暂缓**：M4——`condition`/`pitfalls` 字段化，待「步骤乱序」成为可观测的 routine 失败主因再评估。

## 交叉引用

- [Procedural Graph 论文精读笔记](./procedural-graphs.md) · [自进化 Agents Team 方案](../../concepts/design/self-evolving-agents.md) · [Routine 子系统](../../concepts/subsystems/039-the-routine-system.md) · [PDF 巡检状态落库方案](../../.agents/pdf-fidelity-patrol-status.md)
