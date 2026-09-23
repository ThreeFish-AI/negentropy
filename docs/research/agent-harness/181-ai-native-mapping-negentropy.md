---
sidebar_position: 8
title: "AI Native 手册 ↔ negentropy 机制映射"
description: "《AI Native 研发范式实践手册》企业级 Harness 十七条机制对照本仓 Routine / 知识库 / 工具 / 权限 / 可观测的实现：✅ 8 / 🔶 3 / ⏸ 6，真增量集中在凭据边界、授权第三态与生产门控对象三处"
---

# 《AI Native 研发范式实践手册》↔ negentropy 机制映射报告

> 声明：本报告只做分析，不改代码。锚点均经 `grep -n` 在基线提交 `161d6244`（`feature/1.x.x`）上核验，页码为手册印刷页码。精读笔记见 [180](./180-ai-native-handbook.md)。后端路径均以 `apps/negentropy/src/negentropy/` 为根。

## 结论先行

本仓已具备手册第三章的**闭环骨架**：

- 验证闭环：命令门控 + Judge + `decide()`；
- 上下文预算与压缩重试；
- 检查点恢复；
- 审批模式；
- 只读知识 MCP；
- Skill 渐进披露；
- OTel GenAI 双层可观测。

手册的**真增量**集中在三处，本仓均未实现：

1. **凭据边界**：Sandbox 里只放占位值，由出站代理注入真实凭证。
2. **授权第三态 Challenge**：结构化说明需要补什么授权，确认后自动重试。
3. **生产门控对象**：规则版本 + 动作快照摘要 + 时效 + 三态聚合。

它们都绑定在「Agent 触达生产或不可信代码」这一前提上，而本仓目前是单用户本机部署，所以大多判为暂缓，并写明触发条件。

17 条映射中：✅ 已对齐 8 条，🔶 值得落地 3 条，⏸ 暂缓 6 条。

## 映射总表

| # | 手册机制（出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| 1 | 行动—验证—纠错闭环，完成要有客观证据（p35–36） | Routine 命令门控 + Judge 评估 + 决策纯函数 | [`evaluator.py:407`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py) `_run_gate` · [`decision.py:96`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) `decide` | ✅ |
| 2 | 门禁由程序执行，门控失败不等于通过（p37、p58） | 只有 `gate_exit_code ∈ {None, 0}` 才可能判成功（ISSUE-115） | [`decision.py:147`](../../../apps/negentropy/src/negentropy/engine/routine/decision.py) | ✅ |
| 3 | 上下文按需加载，超预算时裁剪或压缩（p36） | token 预算装配 + 上下文耗尽后压缩重试 | [`context_assembler.py:353`](../../../apps/negentropy/src/negentropy/engine/adapters/postgres/context_assembler.py) · [`runner.py:69`](../../../apps/negentropy/src/negentropy/engine/routine/runner.py) | ✅ |
| 4 | 规划、状态与恢复，中断后从可信位置继续（p36） | 引擎确定性检查点提交 + 迭代全过程事件 | [`workspace.py:522`](../../../apps/negentropy/src/negentropy/engine/routine/workspace.py) · [`routine.py:283`](../../../apps/negentropy/src/negentropy/models/routine.py) | ✅ |
| 5 | 人只放在需要判断的位置（p36） | 审批模式 every / first / auto + 高风险工具审批 | [`orchestrator.py:1220`](../../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) · [`approval.py:128`](../../../apps/negentropy/src/negentropy/agents/approval.py) | ✅ |
| 6 | 知识按场景供给（p40） | 知识库以只读 MCP 工具供给 CC | [`mcp_server.py:97`](../../../apps/negentropy/src/negentropy/knowledge/mcp_server.py) | ✅ |
| 7 | 使用反馈回流到知识治理（p39–40） | 已采集检索反馈，尚未驱动「过期 / 冲突」治理 | [`unified_search.py:495`](../../../apps/negentropy/src/negentropy/knowledge/retrieval/unified_search.py) | ⏸ |
| 8 | 在正确时机选对能力（p33、p41） | 三层渐进披露；strict 模式缺工具即阻断 | [`skills_injector.py:423`](../../../apps/negentropy/src/negentropy/agents/skills_injector.py) | ✅ |
| 9 | 工具评测：命中率 + 成功率（p42） | 只有成功率，没有命中率 | [`tool_telemetry.py:148`](../../../apps/negentropy/src/negentropy/models/tool_telemetry.py) `success_count` | 🔶 |
| 10 | Sandbox 四边界：生命周期 / 执行 / 网络 / 凭据（p43–45） | worktree 隔离 + re-anchor；容器沙箱 Docker 后端未实现，网络默认关闭 | [`workspace.py:315`](../../../apps/negentropy/src/negentropy/engine/routine/workspace.py) · [`sandbox/__init__.py:30`](../../../apps/negentropy/src/negentropy/engine/sandbox/__init__.py) | ⏸ |
| 11 | 凭据边界：占位值 + 出站代理注入（p45、p53） | CC 子进程经环境变量拿到真实凭证；`ANTHROPIC_BASE_URL` 已指向本地 coding-proxy | [`service.py:479`](../../../apps/negentropy/src/negentropy/engine/claude_code/service.py) `_credential_env` | ⏸ |
| 12 | 有效权限取交集，资源侧重验（p51–53） | RBAC 只有 admin / user 两个角色，没有 Agent 独立身份和委托收敛 | [`rbac.py:82`](../../../apps/negentropy/src/negentropy/auth/rbac.py) | 🔶 |
| 13 | 授权第三态 Challenge（p54） | 审批决策只有 approved / denied 两态 | [`approval.py:186`](../../../apps/negentropy/src/negentropy/agents/approval.py) | ⏸ |
| 14 | Guardrail：规则版本 + 动作快照摘要 + 时效（p55–58） | 定义有版本指针，但没有生产变更门控对象 | [`agent.py:40`](../../../apps/negentropy/src/negentropy/models/agent.py) `active_version` | ⏸ |
| 15 | UNKNOWN 必须显式记录（p58） | Judge 返回非法 verdict 时，按分数推断为 progressing 或 stalled | [`evaluator.py:556`](../../../apps/negentropy/src/negentropy/engine/routine/evaluator.py) | 🔶 |
| 16 | System + Trajectory 双层可观测（p59–61） | OTel GenAI 语义约定 + 迭代锚点审计 | [`instrumentation.py:38`](../../../apps/negentropy/src/negentropy/instrumentation.py) · [`trajectory.py:213`](../../../apps/negentropy/src/negentropy/engine/routine/trajectory.py) | ✅ |
| 17 | 风险拦截独立于模型（p37） | 只有 Plan Review 的 PreToolUse 钩子；危险命令没有硬拦截 | [`orchestrator.py:229`](../../../apps/negentropy/src/negentropy/engine/routine/orchestrator.py) | ⏸ |

## 逐条说明

只列出判定需要解释的条目。

- **#2**：与手册「UNKNOWN 不当 PASS」同构，门控超时或失败都不会误判为成功。原型 D3 实测了违反这一点的代价：撞上监控故障的批次被照常恢复发布。
- **#9**：`ToolStatsDaily` 已有 `success_count` / `error_count`，可以直接产出手册 p42 要求的「长期低成功率能力」清单。命中率需要「本该选哪个工具」的标注数据，成本高，暂不纳入。
- **#11**：这正是手册 p45 点名「最常见也最危险」的形态。原型 D5 实测：出站拦截即使守住，令牌仍会经构建日志泄露。本仓的前提不同：单用户本机部署，CC 本身就是用户的代理，所以判为暂缓。落地路径现成：已有 coding-proxy，届时由它注入凭证，子进程只留占位值。
- **#12**：与 [012 映射 #15](../cognitive-context/012-horizon-context-mapping-negentropy.md) 是同一缺口（代理会话权限天花板），沿用其 🔶 判定与落地时机，不重复立项。
- **#15**：推断 verdict 本身合理，它保证决策层总有合法输入。但它抹掉了「这一轮评估其实没读懂」的信号，属于 UNKNOWN 被静默转写。
- **#17**：这是既定设计取舍，不是遗漏。CC 以最大权限运行，Routine 的不变量由 workspace 机制保障，不靠禁用工具（[PR #998](https://github.com/ThreeFish-AI/negentropy/pull/998)）。手册的硬拦截针对的是触达生产的 Agent，二者的前提不同。

## 落地建议汇总

**做**

- **#15**：下次修改 `evaluator.py` 解析逻辑时，为推断出的 verdict 加 `verdict_inferred` 审计标记，并计入「连续评估失败」。
- **#12**：沿用 012 #15 的时机，在 Context Layer Phase 2 的 ContextGuard 中纳入「调用方身份」。

**写**

- **#9**：一条 `ToolStatsDaily` 聚合查询，产出「近 30 天成功率 <50% 的能力」清单，接入巡检报告。成本约 1 个查询函数。

**暂缓**（写明触发条件）

- **#10 / #11**：Routine 开始安装第三方依赖、执行不可信代码，或引擎跨用户共享时。
- **#13**：出现 Agent 反复猜测拒绝文本、重试同一越权操作时。
- **#14 / #17**：Routine 被授予生产发布、配置变更类动作，或持有生产凭证时。
- **#7**：知识库出现过期或冲突条目，导致 Judge 反思中出现「引用失效」时。

## 交叉引用

- [180 精读笔记](./180-ai-native-handbook.md)：规律 R1–R5 与破坏性实验 D1–D6。
- [170 五层 Harness 总览](./170-claude-code-harness-overview.md)：循环本体的机制对位。
- [012 Horizon 映射](../cognitive-context/012-horizon-context-mapping-negentropy.md)：代理会话权限天花板（#15）。
- [039 Routine 系统](../../concepts/subsystems/039-the-routine-system.md)：闭环与决策的现役设计。
