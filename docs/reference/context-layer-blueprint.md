# Context Layer 基础设施设计蓝图

> 以 [Snowflake Horizon Context](https://www.snowflake.com/en/product/features/horizon-context/) 为范本的**通用可复刻架构**：一个可独立部署、面向 Agents 研发与平台集成的治理上下文层。
>
> 定位辨析：本仓已有两份亲缘文档——[Context Layer · 上下文治理层技术方案](../concepts/design/context-layer.md)（negentropy **内部**治理织物，收敛 Memory/KB/KG/Tools/Skills 五子系统）；本蓝图则是**通用基础设施**设计（不绑定 negentropy 内部栈，可独立服务化、经标准协议供任意 agent 平台消费）。两者互补互链：内部织物是蓝图在 negentropy 的一次实例化。
>
> 循证基础：机制详解、实证数字与批判性边界见 [Horizon Context 精读笔记](./paper-notes/horizon-context.md)；与本仓代码的逐条对照见[机制映射报告](./paper-notes/horizon-context-mapping-negentropy.md)；最小原型（M1–M6 六机制 + MCP 服务）已随笔记入库验证。

---

## 0. 范围与设计原则

**要解决的问题**（Horizon 的归因，已被两家独立实测背书）：Agent 缺业务含义时准确率 ~21–25% 且自信地错；含义散落在 SQL/看板/prompt 里必然漂移；外挂治理层可被绕过。

| 设计规格 | 通俗版 | 蓝图对应 |
| --- | --- | --- |
| 定义一次、处处生效 | 术语表只写一遍，处处引用不抄写 | §2 对象模型 + §3 目录 |
| 治理内嵌、不可绕过 | 门禁装在楼里，不是墙上的告示 | §6 双层防线 |
| 双轨养上下文 | 手册（显式）+ 观察（隐式），冲突必见人 | §4 富化与自纠 |
| 通用接入 | 任何 agent/BI/应用用标准插头消费 | §5 Activation（MCP） |
| 对冲「治理≠验证」 | 治理正确 ≠ 计算正确，出口要有检查 | §7 边界对策 |

**范围外**：替代各子系统的检索算法；数据平面本身（仓库/向量库）；模型训练。

## 1. 总体架构

五个正交层——对象存储（放什么）、目录（怎么找）、富化（怎么养）、治理（怎么信）、激活（怎么用）。机制（治理/路由）与策略（各源算法）分离，各层可独立演进。

![Context Layer 基础设施五正交层：对象存储经逻辑视图指针汇入统一目录，显式/隐式双轨富化并由 eval 自纠环修正，目录经四因子排序、Governance Gate 与 MCP Server 供给 agent/BI/应用，治理角色负责作者与评审。](../assets/architecture/paper-notes/context-layer-blueprint--architecture-dark.png)

> 图源（可 diff 文本）：[`context-layer-blueprint--architecture.mmd`](../assets/mermaid/paper-notes/context-layer-blueprint--architecture.mmd) · 交互版（下载到本地打开）：[`context-layer-blueprint--architecture.html`](../assets/architecture/paper-notes/context-layer-blueprint--architecture.html)

## 2. 上下文对象模型（核心）

对标 semantic view 五段式的**泛化**——上下文不限于指标，任何「agent 推理所需的受治理含义」都是对象：

```yaml
# 对齐 Apache Ossie (Incubating) YAML 风格的示意（指标类对象）
id: metrics/net_revenue
kind: metric                      # definition | metric | doc | skill | qa | policy
name: net_revenue
synonyms: [净收入, net sales]      # 召回别名是受治理上下文，不是检索层外挂
spec:                             # 五段式（指标类）：tables/relationships/facts/dimensions/metrics
  tables: [...]
  metrics: [{name: net_revenue, agg: sum, expr: "gross * (1 - discount)",
             non_additive_by: [day]}]
instructions: "聚合先于 join；默认走 buyer 关系"   # 随定义分发的 agent 指令
verified_queries:                 # 人验证过的问答，一等资产
  - question: "net revenue by month"
    answer_ref: "queries/q001"
    verified_by: "( data_governance = data-team@example.com )"
    verified_at: 2026-08-20
visibility: {level: public}       # public | private | roles: [...]
tags: {domain: finance, owner: data-platform}
provenance: {source: governed, authority: 1.0}    # governed | inferred | legacy
version: 12
```

三条字段纪律（映射报告 #1 的增量，negentropy definitions 的 `meta` 可承载）：

1. **synonyms 必填意识**——没有同义词的定义在自然语言检索面上是隐形的；
2. **instructions 随对象走**——给 agent 的口径说明内嵌定义、随定义治理与版本化，拒绝 prompt 里硬编码；
3. **verified Q&A 带溯源**——答案样例是信任度最便宜的来源，`VERIFIED_BY/AT` 使其可审计。

**生命周期状态机**：

![上下文对象生命周期状态机：draft 经校验门+评审晋升 governed；同名异义进 conflict 态浮出人工裁决（胜者回 governed、败者进 rejected）；新版本取代转 superseded。](../assets/architecture/paper-notes/context-layer-blueprint--object-lifecycle-dark.png)

> 图源（可 diff 文本）：[`context-layer-blueprint--object-lifecycle.mmd`](../assets/mermaid/paper-notes/context-layer-blueprint--object-lifecycle.mmd) · 交互版（下载到本地打开）：[`context-layer-blueprint--object-lifecycle.html`](../assets/architecture/paper-notes/context-layer-blueprint--object-lifecycle.html)

结构校验门（对标 validation-rules）：引用必须命中键约束、至少一个可用面（维度/指标/正文）、名字唯一、`non_additive_by` 引用的维度存在——**非法结构在注册期被拒，不进运行时**。

## 3. 目录层

- **逻辑视图而非新物理表**（[context-layer.md ADR-1](../concepts/design/context-layer.md) 同款决策）：UNION 各来源的元数据 + 轻量指针，杜绝 Split-Brain。
- **四层信号**入库：Structural（有什么/怎么连，含血缘）、Operational（新鲜度/运行状态）、Semantic（定义/口径/本体）、Behavioral（热度/使用模式）。
- **血缘**记录「谁喂谁」（观察型）；其边界见 §7。

## 4. 富化层：双轨 + 自纠 + 冲突浮出

- **显式轨道**（金标准，authority=1.0）：人手工 + 生成辅助（对标 Autopilot：从既有 SQL/配置/文档批量生成草稿，人审后转 governed）。
- **隐式轨道**（长尾，authority<1.0）：从查询日志、使用痕迹、BI 定义自动拼装「同类的理解」——解决显式覆盖不动的问题（Snowflake 实测 9,685 表覆盖 <5%）。
- **eval 自纠环**：金标准问答集 / 用户反馈 / 系统自检薄弱区三路输入 → 错配 → 修正（定义级：补 synonyms；信号级：调 popularity）→ 重排复测。
- **冲突浮出（核心契约）**：同名异义 → 双双标 `conflict` → 检索返回 **CONFLICT 卡片（并列两定义、无数值、needs_adjudication=true）** → 执行层拒绝 → 人工裁决恢复。**禁止按 popularity 自动选**（原型 D4 实测：自动选让错误口径 [6,1,2] 胜出——477 vs 48 事故的机制复现）。

## 5. 激活层：resolve + MCP

**resolve 契约**（agent 侧唯一入口）：`resolve(question, role) → ContextPackage{top-k 条目, instructions, verified_query?, warnings, conflict_card?}`。命中 verified query 即短路重放（带溯源）；无 governed 覆盖时显式 `no_governed_coverage` 警告而非静默用推断口径。

**排序**：`0.4·relevance + 0.3·authority + 0.2·popularity + 0.1·freshness`，三条工程纪律——authority 区分 governed/inferred；popularity 用 log1p 有界变换（防全局归一漂移）；tie-break 显式化 `(-score, -authority, -updated, name)`。

**MCP 供给面**（平台集成的标准插头，原型已验证纯标准库可行）：

| 工具 | 职责 | 治理要点 |
| --- | --- | --- |
| `list_context_objects(role)` | 目录 + 信任信号 | RBAC 过滤后下发 |
| `resolve_context(question, role)` | top-k 上下文包 | 含 CONFLICT 卡片路径 |
| `execute/compile(metric, dims, via, role)` | 受治理执行 | **引擎层 RBAC 兜底**（检索层泄露也拦得住） |
| `report_feedback(name, verdict)` | 行为反馈写回 popularity | Behavioral 闭环；同名需带 source 消歧 |

## 6. 治理层：双层防线

1. **检索层**（体验）：resolve 时对无权角色过滤 private 资产与维度建议；
2. **执行层**（底线）：execute 必经 RBAC 校验——「检索藏起来但执行层照样跑」是外挂治理层的标准死法（原型 C2）。

配套：出口 guardrails（对标 AI Guardrails：PII/敏感信息在**出口**检测/脱敏/拦截）；per-role context（不同角色解析出不同上下文集——Horizon 私测期尚未交付，属本蓝图的后置项）；审计日志（谁在何时以何角色消费了何定义）。

## 7. 边界对策：治理 ≠ 验证

Typedef 批判的核心（详见笔记 §10-4）：governed 定义在**上游已塌缩的 grain** 上照样产出错误数字（477 vs 48）；`NON ADDITIVE BY` 是人填的声明非推导。蓝图的三级对策：

1. **表达式级 derived 校验**（便宜，先做）：口径表达式里可见的非可加性（如 `SUM(x)/COUNT(DISTINCT y)`）注册期自动标记，提示消费方；
2. **verified Q&A 作为出口对账资产**：验证答案与重算结果不一致时告警（原型 A1b 的对账断言即此机制的雏形）；
3. **eval 环事后评分 + 血缘回溯**（贵，后置）：承认「编译期从转换代码推导计算合法性」目前无成熟方案，以 eval 环兜底而非假装解决。

## 8. 与 negentropy 的集成路径（实例化）

| 蓝图组件 | negentropy 承载 | 状态 |
| --- | --- | --- |
| 对象层 | `definitions` registry（4 类定义 SSOT + checksum/版本） | ✅ 已有，补三字段纪律即可（映射 #1） |
| 目录层 | `context_catalog_unified` 等三视图（context-layer.md §4） | 🔷 方案已设计 |
| 富化层 | patrol/Judge 巡检闭环 = eval 环同构物 | ✅ 已有（映射 #6）；冲突浮出面待补（#7） |
| 激活层 | 三层渐进披露（skills_injector）+ 计划中的 HybridPlanner 扩展 | ✅/🔷 |
| MCP 供给面 | 复用 McpClientService 的协议工程经验，方向从消费转供给 | 🔶 新增（映射 #12） |
| 治理层 | `accessible_corpus_ids` + 计划中的 ContextGuard | 🔷 第一层已有，第二层随 Phase 2 |

**独立部署路径**：对象层落 PostgreSQL（或任意带版本化的存储）、激活层以单进程 stdio/HTTP MCP server 起步——原型 [`paper-notes/assets/horizon_context_mcp.py`](./paper-notes/assets/horizon_context_mcp.py) 即其零依赖种子。

## 9. 演进路线

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| **P0 机制验证（已完成）** | 六机制玩具域 + MCP stdio 原型 + 7 次破坏性实验 | selftest 全绿；引擎层 RBAC 经 MCP 仍生效 |
| **P1 最小服务** | 对象 CRUD + resolve + MCP 四工具 + 双层 RBAC + 审计日志，接一个真实 agent 客户端 | 真实客户端经 MCP 命中 verified query 短路；越权被拒且有审计 |
| **P2 信任与自纠** | 四因子归一（有界变换 + 单一 staleness）+ 冲突浮出 + 反馈闭环 + verified QA 沉淀 | 排序可解释；CONFLICT 卡片全程无数字；反馈改变排序可复现 |
| **P3 互操作** | Ossie YAML 导入导出 + per-role context + 表达式级 derived 校验 | 第三方语义模型可导入即用；跨角色上下文隔离 |

## 10. 参考

[1] Snowflake, "Horizon Context — Governed Semantic Layer & Data Catalog," *产品页*, 2026. [Online]. Available: https://www.snowflake.com/en/product/features/horizon-context/

[2] Snowflake Documentation, "CREATE SEMANTIC VIEW," "How Snowflake validates semantic views," *docs.snowflake.com*, 2026. [Online]. Available: https://docs.snowflake.com/en/sql-reference/sql/create-semantic-view

[3] Apache Ossie (Incubating), "Open specification for semantic layer and ontology," 2026. [Online]. Available: https://ossie.apache.org/

[4] Anthropic, "Model Context Protocol," 2024. [Online]. Available: https://modelcontextprotocol.io/

[5] J. M. Hellerstein et al., "Ground: A Data Context Service," in *Proc. CIDR*, 2017.（数据上下文服务的开创性主张）

[6] Typedef, "What Is Horizon Context? Snowflake's Governed Context Layer Explained," 2026. [Online]. Available: https://www.typedef.ai/blog/what-is-horizon-context-snowflakes-governed-context-layer-explained（治理≠验证批判与 477 vs 48 复现）
