---
sidebar_position: 14
---

# 经验时代的自驱迭代进化智能体：综述研读与系统改进落地

> **摘要**：本报告精读 88 页综述 *Self-Improving Agents in the Era of Experience: A Survey of Self- to Meta-Evolution*（清华大学 & Horizon Research，2026-06）[1]，提炼其「经验基础设施」理论框架，并将其逐项映射到 negentropy 的 Routine 自驱闭环，识别出两处**根本断点**——Judge 无历史锚点的单点重打分（评分振荡误杀根因）、经验记忆约 7-8 天全灭 + 反馈链断裂（`decay_override` 死配置）。落地双支柱改进：**证据锚定的纵向评估**（trajectory 纯函数 + Judge 注入近 K 轮轨迹 + progress_evidence「证据先于给分」+ 量化振荡 opt-in）与**经验记忆闭环补强**（衰减修复 E / 检索反馈闭环 B / 写入去重准入 A / 失败教训结构化与注入 C-D）。两支柱零 DB 迁移、默认路径逐字节向后兼容。

---

## 1. 综述核心框架

### 1.1 Harness 作为经验基础设施

综述把部署态智能体形式化为四元组 `A_t = ⟨M_θt（模型）, H_t（可变 Harness）, U_t（用户侧）, E_t（环境侧）⟩`。Harness 是「经验基础设施」：组织上下文、工具、权限、执行、反馈、记忆、恢复。trace 窗口 τᵢ 经 Harness 编译为**可用经验 zᵢ**（须经「过滤 / 压缩 / 归因 / 验证」才「可用」，非原始日志）——快时标更新 Harness（`H⁺=Φ_H(H,z)`）、慢时标巩固进模型参数（`θ⁺=Φ_M(θ,Z)`）。

> **三代演进**：Gen1 任务环（episodic）→ Gen2 跨任务复用（记忆 / 技能 / 工作流持久化但人工配置）→ Gen3 运行时系统（Harness 本身成为部署后持续进化的对象）。negentropy 的 Routine 闭环（dispatch→CC 执行→gate+Judge→decide→reflection/memory 沉淀→下轮注入）即属 Gen3。

### 1.2 三大运行时更新面（Part II）

| 面 | 综述章节 | 核心 | negentropy 对应 |
|---|---|---|---|
| **Skills** | §3 | σ=⟨Manifest, Instructions, References, Artifacts⟩；三阶段生命周期 Creation→Use→Evolution；负面证据同样关键（须转成具体更新目标）；**验证准入是硬门**（SkillsBench 16/84 任务负迁移） | skills / skill_versions（SemVer）/skill_schedules；三层渐进披露注入；**进化提案器（GEPA）尚缺** |
| **Memory** | §4 | 内容单元（raw/episodic/summary+语义）× 组织结构（flat/分层/关系图）；五操作（写入准入 / 压缩 / 巩固 / 检索 / 修订）；自进化三层（内容 / 机制 / 策略）；陈旧记忆继续生效、错误放大风险 | memories/pgvector + retention_score 艾宾浩斯衰减 + decay_override；IterationMemoryExtractor → `_retrieve_memory_context`；**写入准入缺失、反馈链断、decay_override 死配置** |
| **Environment** | §5 | 环境约束适应上限（`J*(E)`）；可执行 → 协议化 → 可学习 | Routine worktree 隔离 + gate 验收命令 + MCP/A2A 工具面 |

### 1.3 巩固、协调、评测与安全（Part III/IV）

- **元进化（§7）**：两轴——what evolves（内容资产 / 执行机制 / 改进策略 / meta 层自身）× who controls（TaskAgent 内部 vs 独立持久 meta 层）。SkillOS（冻结 executor + 独立 Skill Curator）、Agentic Harness Engineering（harness 文件级可编辑 + Agent Debugger 蒸馏证据 + Evolve Agent 验证）、Autogenesis（RSPL 资源版本化 + SEPL 协议）是本项目 `docs/concepts/design/self-evolving-agents.md` 四层蓝图的文献对应物。
- **自我改进评测六目标（§8）**：held-out gain / backward retention / longitudinal stability / improvement efficiency / **path attribution** / safety non-regression。SIP-Bench 协议在同一进化 agent 的 T0→T1→T2 检查点上 replay/adapt/held-out 分区重复评测。
- **安全（§9）**：自我改进 = 移动攻击面。五大威胁面（技能供应链 / 记忆投毒 / 工具协议组合 / **反馈操纵** / 对齐漂移）；运行时治理原语（准入测试 / 最小权限 / 写入治理 / 评估器隔离 / 版本+回滚 / 持续再认证）；Claude Code 三检查点：「模型决定尝试什么，工具系统决定允许什么」。

---

## 2. 诊断：两处根本断点（均已一手复核）

### 2.1 断点一：Judge 无历史锚点评分

`evaluator.py:37-67` 的 `_JUDGE_PROMPT` 要求 Judge 判定 verdict「较上轮有实质推进 / 退步」，**但 prompt 从未提供任何上轮信息**——Judge 每轮仅看本轮 summary 独立重打分。机理后果：±20 天然振荡（修一处感知缺陷压低另一处总分等聚合任务尤甚），触发 `_is_no_progress` / `_is_oscillating` 误杀收敛中任务（ISSUE-128 容差带只是治标）。对应综述 §8 纵向评估缺失与 §10.3 弱反馈信用分配。

### 2.2 断点二：经验记忆约 7-8 天全灭 + 反馈链断裂

夜间清理任务（seed cron `0 2 * * *`）调用 SQL 函数 `cleanup_low_value_memories(0.1, 7, 0.1)`（迁移 0043），以**平坦 λ=0.1 重算全表 retention 并物理 DELETE**，完全忽略 `metadata->>'decay_override'`。`IterationMemoryExtractor` 精心设计的 verdict×type 衰减矩阵（λ=0.003≈230 天半衰意图、patrol done/unfixable 确定性标记）是**死配置**；未被检索命中的经验记忆约第 7-8 天被删除（`retention = LEAST(1, EXP(-0.1·d)·(1+ln(1+access))/5)`，access=0 时 d≈6.9 天跌破 0.1）。叠加：记忆写入无去重准入（同模板 routine 近似经验线性膨胀）、`依据 Memory <id8>` 引用格式无输出侧解析器、`outcome_feedback` 无自动写入方——而下游 Rocchio 调权管道（memory_reweight 每 6h）**已建成在跑，只缺反馈源**。

---

## 3. 双支柱改进

### 3.1 支柱一：证据锚定的纵向评估（Anchored Longitudinal Judging）

| 改动 | 说明 |
|---|---|
| **trajectory 纯函数模块** | `score_trajectory`（trend/振幅/flips/direction）/ `format_anchor_context`（中文锚点段）/ `build_anchor_audit`（metrics 摘要）。遵循 `decision.py` 纯函数 + frozen dataclass + Protocol 范式 |
| **Judge 模板锚定版** | 在「客观验证结果」与「评审要求」之间插 `{anchor_section}`（近 K 轮 `第N轮[phase]：score(verdict)` + 历史最优 + 上轮反思）；追加两条要求——`progress_evidence`（先于评分完成，≤150 字）与评分锚定一致性（无实质退步不得低于上轮 10 分以上、无实质新进展不得高于上轮 10 分以上；**锚点非地板 / 天花板**）；JSON 输出行 `progress_evidence` 置首强制「证据先于给分」生成顺序 |
| **orchestrator 接线** | `_do_evaluate` ①段只读查 floored history 快照注入 evaluator（①段查询天然不含本轮=正确语义，③段那次含本轮供 decide 用、不可复用）；③段 `latest.metrics["judge_anchor"]` 审计写入；`_persist_eval_events` payload 增 `progress_evidence` |
| **量化振荡 opt-in** | `decide(oscillation_min_amplitude=0)`；`_is_oscillating` 追加与 verdict 无关的量化分支（n≥6、net_gain≤0、amplitude≥阈值、flips≥3）。⚠️ 与 ISSUE-128 容差带存在张力（真实振荡轨迹会被任何合理阈值命中）——故**默认关闭、巡检不启用**，定位为锚定降振荡后的兜底护栏 |
| **关键不变量** | 锚点「历史最优」取 floored history max(score)，**不用** `routine.best_score`（跨 restart 不复位会泄漏旧高分）；「上轮 reflection」取 `history[-1].reflection`（iteration 列，非 routine.reflections 全生命周期流）；faculty_bridge 与 litellm 两路接收同一 prompt 字符串，锚点注入对二者逐字节一致 |
| **默认值** | `judge_anchor_enabled=True` / `judge_anchor_window=5`。首轮 / 无历史 prompt 逐字节等价原版；属信息注入而非决定性改分（与 acceptance cap 区分），env / per-routine config 可秒关 |

### 3.2 支柱二：经验记忆闭环补强（E→B→A→C-lite→D）

- **E 衰减修复（地基）**：`memory_automation._run_cleanup()` 弃用 SQL 存储函数、改 handler 内联 SQL，retention 重算 λ 取 `COALESCE((metadata->>'decay_override')::float, :decay_lambda)`。零迁移（SQL 函数定义保留），无 override 记忆逐字节不变；带 override 记忆存活期恢复设计值。
- **B 检索反馈闭环（杠杆最大）**：`search_memory` 四策略分支接收 `_record_access` 返回的 log_id（原被丢弃）经 `_build_search_response(retrieval_log_id=…)` 写入 entry `custom_metadata["retrieval_log_id"]`；`_retrieve_memory_context` 返回 `(context, injection_meta)`、dispatch 时写 `iteration.metrics["memory_injection"]`；评估期 `_fire_reference_feedback` 解析产出引用（两种格式 + 与注入集求交防伪引用）→ `mark_referenced` + 据 verdict 粗粒度 `record_feedback`（cited+pass/progressing→helpful；零引用→irrelevant；cited+regressed/stalled→不写）；删 `_launch_approved` 死代码检索（白落 retrieval log 且被零引用规则误判）。`memory_feedback_enabled` 开关可回退。
- **A 写入准入去重**：`_check_duplicate` 改调 `_find_duplicate`（返回命中 id|None，会话巩固路径零变化）；`add_memory_typed(dedupe=False)` opt-in，命中则 touch 既有记忆（access_count+1，「重复出现即重要性信号」）；`_write_memories_from_snap` 传 `dedupe=True`。
- **C-lite 失败教训结构化**：`extract_on_termination` 已覆盖所有 routine 终态（非只 patrol）——**不新建提取阶段**。`_build_termination_prompt` 对失败 reason（no_progress/oscillation/unrecoverable_error）注入三段式附加指令（教训 / 根因 / 下次行动目标）；写入 metadata 补 `termination_reason`/`routine_status`/`repository_id`。
- **D 同 repo 失败教训确定性注入**：`_retrieve_memory_context` 增补充段——`repository_id` 非空时 raw SQL 拉同 repo、失败 reason 的最近 2 条终态教训，与语义 top5 按 id 去重合并（行前缀「⚠ 失败教训」）。不做「排除本 routine 自身」过滤（会挡 restart 教训回流）。

---

## 4. 理论依据（IEEE）

- [1] C. Jiang, J. Zhong, Y Fu, *et al.*, "Self-Improving Agents in the Era of Experience: A Survey of Self- to Meta-Evolution," *Frontis.AI / Tsinghua University*, Jun. 2026. Harness 形式化、技能 / 记忆 / 环境三面、元进化、SI 六评测目标、移动攻击面。
- [2] N. Shinn, F. Cassano, E. Berman, *et al.*, "Reflexion: Language Agents with Verbal Reinforcement Learning and Reasoning," in *Proc. NeurIPS*, 2023. arXiv:2303.11366. 跨迭代自反思记忆（Routine reflections 注入）。
- [3] J. Gu, Z. Dong, S. Liu, *et al.*, "A Survey on LLM-as-a-Judge," arXiv:2411.15594, 2024. LLM-as-Judge 偏差与缓解（锚定 + 一致性约束）。
- [4] OpenAI, *Codex: Long-horizon tasks*, 2025. 测试驱动自我校验（Plan→Edit→Test→Repair）。
- [5] Anthropic, *Building Effective AI Agents*, 2024. Evaluator-Optimizer / Orchestrator-Workers、停止条件。
- [6] A. Ebbinghaus, *Memory: A Contribution to Experimental Psychology*, 1885. 类型化衰减曲线（decay_override 的理论依据）。

---

## 5. 与本项目四层自进化架构的关系

本报告双支柱改进是对 `docs/concepts/design/self-evolving-agents.md` 四层架构中「记忆与知识系统」层（基质 / 客体双轨，ADR-4）的**可持久性 + 可反馈性 + 可去重**基础设施补全——未引入新的进化提案器（GEPA/ACE 仍属后续工作），而是让既有「沉淀-消费」回路真正闭合：经验不会 7-8 天消失、检索效果能回流调权、近似经验不膨胀、失败教训能被同 repo 后续 routine 看到。这是后续任何记忆 / 知识参数自进化（[130 号调研](./130-self-evolving-agents-team.md) §6）的前置地基。

评测维度上，本改进把综述 §8 的纵向评估与 path attribution 两个最小目标引入 Routine 闭环（锚点审计 metrics 让「同一进化 agent 的评分轨迹」首次可观测、引用反馈让「检索→产出」的 path attribution 可度量），其余四目标（retention / stability / efficiency / safety non-regression）仍是后续工作。
