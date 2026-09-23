---
sidebar_position: 9
title: "Dream-RSI ↔ negentropy 机制映射报告"
description: "把 Dream-RSI 六条机制对照本仓 evolution / routine / eval 体系：候选包含保证与策略层分离已同构对齐，Judge 锚定方向一致，历史重放模拟器按 YAGNI 暂缓并给出触发条件，语义注入的 over-constrain 边界须知"
---

# Dream-RSI ↔ negentropy 机制映射报告

> 把 [Dream-RSI 论文精读笔记](./144-dream-rsi.md)（arXiv:2609.14858）的机制对照到本仓 evolution / routine / eval 体系，回答「论文的哪些设计本仓已有、哪些是真增量、哪些值得落地」。**只分析不改码**；锚点均经 `grep -n` 实际代码核验（分支 `ThreeFish-AI/guided-learn-arxiv-2609-14858`）。

## 结论先行

本仓**已实现 Dream-RSI 的两道结构护栏**（候选包含保证的策略层分离），且 140 号笔记落地的「Judge 锚定版评估」与论文的离线锚定思想同向；Dream-RSI 的真增量是一件重武器——**把执行历史组织成可交互的重放模拟器，用于元策略的离线评估与改进**。六条映射中：M3/M5 已对齐，M2 方向一致（论文是其更强形式），M4 是教训对话（本仓已有旁路），M1 按最小干预原则**暂缓**（绑定明确触发条件），M6 是对现有语义注入设计的**边界警示**（无须改码，须知边界）。

## 映射总表

| # | Dream-RSI 机制（论文出处） | 本仓对应 | 锚点 | 判定 |
| --- | --- | --- | --- | --- |
| M1 | 历史即重放模拟器：发现树 → 确定性重放 → 元策略离线评估（§2-§3.3） | eval 四表版本链 + holdout 复跑 + `memory_retrieval_logs` 窗口重放 + `fire_reason ∈ {tick, manual, replay}` 已有 replay 语义 | [`models/eval_suite.py:242-260`](../../../apps/negentropy/src/negentropy/models/eval_suite.py) · [`models/internalization.py:168-170`](../../../apps/negentropy/src/negentropy/models/internalization.py) · [`models/scheduled_task.py:129`](../../../apps/negentropy/src/negentropy/models/scheduled_task.py) | 🔶 部分对齐，**暂缓**（YAGNI） |
| M2 | 离线锚定评估：评估基于历史记录而非每轮独立重打分（§3.3 + §5.1） | Judge 锚定版 prompt（trajectory + progress_evidence 先证据后给分）——140 号双支柱之一已落地 | [`engine/routine/evaluator.py:93`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（锚定版在 :252 条件启用） | ✅ 方向已对齐，论文是更强形式 |
| M3 | 候选包含保证 V\*≥V⁰：argmax 池含当前策略，防回退下界（§3.5） | canary 门「不退化即接受（平局接受）、任一退化即 rollback」+ 配置版本 promote/rollback 指针翻转 | [`engine/evolution/decision.py:228`](../../../apps/negentropy/src/negentropy/engine/evolution/decision.py) · [`models/evolution.py:192-221`](../../../apps/negentropy/src/negentropy/models/evolution.py) | ✅ 已对齐 |
| M4 | 重放目标三分量：质量 − 成本 + 并行度，目标函数设计决定选出什么（§3.4 Eq.1） | routine 成功判定的目标口径：score 阈值 OR verdict=pass 旁路（历史坑：阈值不可达致收敛成功态被误杀） | [`engine/routine/decision.py:96-150`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ 教训已吸收（旁路存在） |
| M5 | 只改策略层、底座冻结：模型/评估器/执行接口不动，仅策略代码可变（§3） | definitions SSOT → TargetHandler 六面 → harness_materializer 渲染：进化只改定义层，agent 运行时不动 | [`models/evolution.py:53-66`](../../../apps/negentropy/src/negentropy/models/evolution.py)（六面白名单） · [`agents/definitions/harness_materializer.py`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) | ✅ 已对齐 |
| M6 | 语义引导 over-constrain 警示：历史摘要注入 prompt 劣于无引导（§5.1 实证） | Reflexion episodic replay / `routine.reflections` 注入 / patrol_memory pattern 注入——全是「语义摘要注入」型 | [`config/memory.py:31`](../../../apps/negentropy/src/negentropy/config/memory.py) · [`engine/routine/prompt_builder.py`](../../../apps/negentropy/src/negentropy/engine/routine/prompt_builder.py) · [`engine/routine/patrol_memory.py:42-47`](../../../apps/negentropy/src/negentropy/engine/routine/patrol_memory.py) | ⏸ 批判性警示（无须改码） |

## 逐条说明

### M1 历史即重放模拟器——离线门已有，「历史→模拟器」是真空区

- 论文把「已完成的历史」升级为**可交互对象**：候选策略在发现树上走替代轨迹，评估只读记录、零执行成本。本仓最接近的对照是 eval 体系——[`EvalRun`](../../../apps/negentropy/src/negentropy/models/eval_suite.py) 的 `baseline_version` parent 边构成版本链，`is_frozen` 切出可见/holdout 集，`longitudinal_recheck` 每日对已晋升对象复跑 holdout；retrieval 侧 `memory_retrieval_logs.config_version` 让 [`eval_runner`](../../../apps/negentropy/src/negentropy/engine/evolution/eval_runner.py) 能按版本分桶**重放聚合**历史窗口指标。甚至 [`scheduled_task.fire_reason`](../../../apps/negentropy/src/negentropy/models/scheduled_task.py) 已含 `replay` 枚举（为审计与回放区分调度源）。
- **差异在交互性**：本仓的「重放」都是**重放聚合/复跑验证**（对既有数据算指标、对既有版本再打分），不是「让一个候选**策略/编排**在录制好的历史上走替代路径并为其打分」。Dream-RSI 评估的对象是「会做序列决策的策略」，本仓 evolution 的提案是「一组配置参数」——后者没有序列决策面，也就不需要模拟器。
- **判定暂缓（YAGNI）**：本仓当前没有「可编程探索策略」这一层可被重放评估。触发条件成文见落地建议。

### M2 离线锚定评估——140 号双支柱已同向，论文给出极端形式

- 论文的评估信号全部来自历史记录（重放分），绝不每轮从零独立打分。本仓 [140 号调研](./140-experience-era-self-improvement.md)诊断的正是反面病症：Judge 无历史锚点、评分天然 ±20 振荡（[ISSUE-128](../../.agents/issue.md) 容差带治标），随后落地的 [`_JUDGE_PROMPT_ANCHORED`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py)（轨迹锚定 + progress_evidence 先证据后给分）就是锚定支柱。
- 论文比本仓走得更远的地方：锚定不止用于「评得稳」，还闭环进「改得对」（策略修订看重放轨迹）。对本仓的启示按 Dream-RSI 保真度光谱读：锚定 prompt（弱形式，无新信息）→ 轨迹证据锚定（中形式，本仓现状）→ 历史重放模拟器（强形式，M1）。**无须立刻行动**；若未来 Judge 振荡再次成为主痛点，沿光谱升级是现成路径。

### M3 候选包含保证——两套系统在同一个坑位收敛到同一个解法

- 论文 argmax 候选集包含当前策略 ⇒ V\*≥V⁰；本仓 [`decide_canary`](../../../apps/negentropy/src/negentropy/engine/evolution/decision.py) 的语义是「helpful_ratio 不下降即接受（平局接受），任一退化则 rollback」，且 [`MemoryConfigVersion`](../../../apps/negentropy/src/negentropy/models/evolution.py) 的 promote/rollback = 新写一行 + 翻 `is_active` 指针——「改不动就不换」的防回退下界两边同构。
- 交叉确认价值：与 PG 映射报告 M1（验证门平局接受）构成**三套独立系统的同构收敛**（Dream-RSI / PG / 本仓 + 金丝雀发布与进化计算 elitism），该模式已是领域共识，本仓无需动作。

### M4 重放目标三分量——本仓的历史坑恰是「目标函数设计错误」的实例

- 论文 V 的三分量各管一事：max s 管质量、β₁·N 管成本、β₂·N/k 管并行效率；[原型 D2/D3 实测](./144-dream-rsi.md#7-动手实验室把机制亲手拆坏五次)证明拆掉任何一项都会选出错误的东西。本仓的对应教训是 routine 成功判定口径：`decide()` 历史上只看 `score >= threshold`，阈值不可达时收敛成功态被 `no_progress` 误杀（[记忆中的历史 issue]），后来引入 [`accept_verdict_pass` 旁路](../../../apps/negentropy/src/negentropy/engine/routine/decision.py)（verdict=pass 亦可判成功）。
- 两侧共同的教学点：**代理指标的设计决定进化方向，写门之前先验证门可达**。本仓已吸收（旁路存在）；Dream-RSI 补充的增量是「成本与并行度也须入目标」——本仓 routine 的预算控制（max_cost_usd/max_iterations）是硬截断而非目标函数分量，语义不同但各得其所，无须合并。

### M5 只改策略层、底座冻结——本仓的定义层分离与之同构

- 论文整个 RSI 闭环里只有探索策略代码可变。本仓 [`EvolutionProposal.target_kind`](../../../apps/negentropy/src/negentropy/models/evolution.py) 白名单六面（retrieval_config / skill_template / memory_pipeline_prompt / builtin_tool_config / knowledge_strategy / agent_prompt）全部是**定义层**，经 [`harness_materializer`](../../../apps/negentropy/src/negentropy/agents/definitions/harness_materializer.py) 渲染生效，agent 运行时与引擎本体不在进化面内——「进化不碰底座」的边界管理两边一致。

### M6 语义引导 over-constrain——对本仓三类经验注入的边界警示

- 论文 §5.1 实证：把历史摘要成方向性洞见注入 prompt，两种范式下都**劣于**无引导版——长程、多并行线程的探索中，强语义偏置会把搜索空间框死。本仓的经验注入恰有三类同型设计：F2 Reflexion episodic replay（[`config/memory.py:31`](../../../apps/negentropy/src/negentropy/config/memory.py)）、`routine.reflections` 累积反思注入下一轮 prompt、patrol_memory 的 pattern 正证据向后传播。
- **判定为批判性警示而非行动项**：论文的伤害条件是「长视野 × 并行多样探索 × 组合空间巨大 × 验证一条洞见就要烧掉想省的预算」的发现型任务；本仓的注入多服务于「重复性巡检/流程执行」类任务（教训便宜可证伪、动作空间小），恰在论文承认小抄有效的区间。**须知边界**：若未来某 Routine 的核心价值是发散探索（如自动调参、方案发现），对其 reflections 注入应主动克制——多样性的优先级高于教训密度。

## 落地建议汇总

- **做**（绑时机）：无——六条映射中没有需要立即动码的项。
- **写**（一句话成本）：在 [自进化 Agents Team 方案](../../concepts/design/self-evolving-agents.md) 的演进路线节补一句「元级评估重放化」的候选方向与触发条件（即下条），防止未来重新调研。
- **暂缓**（写明触发条件）：M1 重放模拟器。触发条件有三，满足任一即重开评估：① 本仓出现「可编程的序列决策编排层」（如 routine 的调度策略本身成为进化对象，而非 preset 参数）；② 元级试错成本成为可观测瓶颈（多个候选编排的在线 A/B 各需完整 Routine 轮次）；③ patrol/evolution 的历史轨迹已结构化到能支撑确定性重放（`RoutineIterationEvent` 全转录 + 分数链）。在此之前，论文的锚定思想以 M2 的既有形式（轨迹锚定 Judge）为已足。

## 交叉引用

- [Dream-RSI 论文精读笔记](./144-dream-rsi.md)（机制三拍详解、五次破坏性实验、批判性边界）
- [PG ↔ negentropy 机制映射](./143-pg-mapping-negentropy.md)（对象级 vs 元级的姊妹篇；其遗留 M2「编辑级拒绝记忆」与本文 M6 的注入边界同属「负证据/经验的正确用法」主题）
- [140 经验时代的自驱迭代进化智能体](./140-experience-era-self-improvement.md)（Judge 锚定双支柱的出处）
- [130 自进化 Agents Team 调研](./130-self-evolving-agents-team.md)（AlphaEvolve/GEPA 谱系与本映射 M5 的进化面白名单语境）
