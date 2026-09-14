# 事实源：《自己动手，给 AI 搭一个上下文层》（Context Layer 篇）

> **本集口播的单一事实源**。逐字稿（[../script/narration.md](../script/narration.md)）中每一条断言都必须能回溯到本文件的某一节；回溯不到的断言不得进入口播。
>
> **信源轨（B 型 · 仓内固定提交 @ `cf6724d688d6`，2026-09-12）**
> - **A 轨 · 复刻蓝图**：[docs/reference/context-layer-blueprint.md](../../../../../docs/reference/context-layer-blueprint.md)（150 行）——通用可复刻基础设施的设计 SSOT。
> - **B 轨 · 精读笔记**：[docs/reference/paper-notes/horizon-context.md](../../../../../docs/reference/paper-notes/horizon-context.md)——机制详解与实证数字（经它间接可溯 Snowflake 上游）。
> - **C 轨 · 原型实测**：[assets/horizon_context_mcp.py](../../../../../docs/reference/paper-notes/assets/horizon_context_mcp.py)（328 行）+ lab，`--selftest` 全绿（2026-09-12 复跑）。
> - **D 轨 · 内部织物方案**：[docs/concepts/design/context-layer.md](../../../../../docs/concepts/design/context-layer.md)（352 行）——蓝图在 negentropy 的实例化，工程纪律（ADR/三纪律）引用源。
>
> **证据四级**：同上篇（【一】原型实测可复跑 / 【二】仓内文档的讲法 / 【三】厂商自家基准须归属 / 【四】第三方分析须归属）。
>
> **本集特有纪律**：讲的是「可复刻的通用蓝图」，凡说「能落地」「已验证」必须区分——【一】原型验证过什么 / 【二】蓝图设计主张什么 / 什么只在路线图上（未验证不许说成已做到）。

---

## 一、从产品到蓝图：为什么值得抽象出来

- 【二】蓝图定位：以 Horizon Context 为范本的**通用可复刻架构**——可独立部署、面向 Agents 研发与平台集成的治理上下文层；不绑定 Snowflake、不绑定数据指标栈。
- 【二】要解决的问题（Horizon 归因，两家独立实测背书基线端）：Agent 缺业务含义时准确率 ~21–25% 且自信地错；含义散落必然漂移；外挂治理可被绕过。
- 【二】五条设计规格 → 蓝图对应：定义一次处处生效（§2 对象模型 + §3 目录）/ 治理内嵌不可绕过（§6 双层防线）/ 双轨养上下文（§4 富化）/ 通用接入（§5 MCP）/ 对冲治理≠验证（§7 边界对策）。
- 【二】范围外（诚实边界）：不替代各子系统的检索算法；不含数据平面本身（仓库/向量库）；不做模型训练。

## 二、五正交层总体架构

- 【二】五个**正交**层（机制与策略分离，各层独立演进）：
  1. **对象存储 Object Store**——放什么：上下文对象（定义/指标/文档/技能/验证问答/策略）。
  2. **目录 Catalog**——怎么找：逻辑视图 + 轻量指针，四层信号（Structural/Operational/Semantic/Behavioral）。
  3. **富化 Enrichment**——怎么养：显式/隐式双轨 + eval 自纠环 + 冲突浮出。
  4. **治理 Governance**——怎么信：双层 RBAC + 出口 guardrails + 审计。
  5. **激活 Activation**——怎么用：resolve 契约 + 四因子排序 + MCP 供给面。
- 【二】目录层 ADR-1（蓝图 §3 + 内部方案 ADR-1）：**逻辑视图而非新物理表**——UNION 各来源元数据 + 轻量指针，杜绝 Split-Brain（引用指针不复制数据）。
- 【二】血缘记录「谁喂谁」（观察型），其边界见 §7。

## 三、上下文对象模型（核心）

- 【二】对标 semantic view 五段式的**泛化**：上下文不限于指标，任何「agent 推理所需的受治理含义」都是对象。YAML 示例字段：`id/kind/name/synonyms/spec/instructions/verified_queries/visibility/tags/provenance/version`。
- 【二】kind 可为 `definition | metric | doc | skill | qa | policy`——对 agent 平台而言，「技能」「文档」「问答」与「指标」同为一等上下文对象。
- 【二】**三条字段纪律**（本仓映射报告认定的真增量）：①**synonyms 必填意识**——没有同义词的定义在自然语言检索面上是隐形的；②**instructions 随对象走**——给 agent 的口径说明内嵌定义、随定义治理与版本化，拒绝 prompt 硬编码；③**verified Q&A 带溯源**——答案样例是信任度最便宜的来源，`VERIFIED_BY/AT` 使其可审计。
- 【二】结构校验门（对标 validation-rules）：引用必须命中键约束、至少一个可用面、名字唯一、`non_additive_by` 引用的维度存在——**非法结构在注册期被拒，不进运行时**。

## 四、对象生命周期状态机

- 【二】五态：`draft`（作者创建/生成草稿）→ 结构校验门 + 评审 → `governed`；校验失败 → `rejected`；governed 被目录检出**同名异义** → `conflict`；conflict 经人工裁决 → 胜者回 `governed`、败者 `rejected`；governed 被新版本取代 → `superseded`（保留参与排序、freshness 衰减）。
- 【二】冲突浮出契约（核心纪律）：同名异义 → 双双标 conflict → 检索返回 **CONFLICT 卡片（并列两定义、无数值、needs_adjudication=true）** → 执行层拒绝 → 人工裁决恢复。**禁止按 popularity 自动选**。
- 【一】原型实测（C3/C3b）：CONFLICT 卡片并列 `count_distinct(orders.customer_id)` 与 `count(events.id)` 无数值；agent 拒答；compile → ConflictingDefinitionError；裁决 governed 胜后恢复 [3,1,2]。
- 【一】D4 破坏实验：改 auto_popularity → 错误口径（数事件 [6,1,2]）胜出（对照数人 [3,1,2]）——「自动选让多数派错误碾压正确口径」。
- 【一】superseded 的 freshness 隔离（C5）：governed revenue(fresh=0.96, score 0.854) 压过 legacy(0.00, 0.826)——被取代的旧口径不参与冲突检测但参与排序，靠 freshness 自然衰减。

## 五、富化层：双轨 + 自纠 + 冲突浮出

- 【二】**显式轨道**（金标准，authority=1.0）：人手工 + 生成辅助（对标 Autopilot：从既有 SQL/配置/文档批量生成草稿，人审后转 governed）。
- 【二】**隐式轨道**（长尾，authority<1.0）：从查询日志、使用痕迹、BI 定义自动拼装——解决显式覆盖不动（Snowflake 实测 9,685 表 <5%，【三】须归属）。
- 【二】**eval 自纠环**：金标准问答集 / 用户反馈 / 系统自检薄弱区三路输入 → 错配 → 修正（定义级：补 synonyms；信号级：调 popularity）→ 重排复测。
- 【一】原型实测（C4）：错配前 top1=active_users（sum(dau)=[11,6,7] 错）→ 补 synonym + 调信号 → top1=active_customers（count_distinct=[3,1,2] 对）。

## 六、激活层：resolve 契约 + 四因子 + MCP 供给面

- 【二】**resolve 契约**（agent 侧唯一入口）：`resolve(question, role) → ContextPackage{top-k 条目, instructions, verified_query?, warnings, conflict_card?}`。命中 verified query 即短路重放（带溯源）；无 governed 覆盖时显式 `no_governed_coverage` 警告而非静默用推断口径。
- 【二】**排序公式**：`0.4·relevance + 0.3·authority + 0.2·popularity + 0.1·freshness`。
- 【二】**三条工程纪律**：①authority 区分 governed/inferred（受治理 > 行为推断）；②popularity 用 log1p 有界变换（防全局归一漂移）；③tie-break 显式化 `(-score, -authority, -updated, name)`。
- 【二】**MCP 四工具**（平台集成标准插头）：
  | 工具 | 职责 | 治理要点 |
  |---|---|---|
  | `list_context_objects(role)` | 目录 + 信任信号 | RBAC 过滤后下发 |
  | `resolve_context(question, role)` | top-k 上下文包 | 含 CONFLICT 卡片路径 |
  | `compile_metric(metric, dims, via, role)` | 受治理执行 | **引擎层 RBAC 兜底** |
  | `report_feedback(name, verdict, source)` | 行为反馈写回 popularity | 同名需带 source 消歧 |
- 【一】**原型实测**（T1–T8 全绿，纯标准库 stdio）：initialize 握手 + 版本协商（不支持版本回应自身支持版）；tools/list 四工具；list 对 intern 过滤 PRIVATE 条目；resolve 新表场景 no_governed_coverage；compile 引擎层 RBAC 经 MCP 仍生效（T5）；feedback down/up 改变排序可复现（T6/T6b）；子进程 stdio 往返（T8）。

## 七、治理层与「治理≠验证」对策

- 【二】**双层防线**：检索层（体验）resolve 时过滤 private 资产与维度建议；执行层（底线）execute 必经 RBAC——「检索藏起来但执行层照样跑」是外挂治理层的标准死法（原型 C2 实测【一】）。配套：出口 guardrails（PII/敏感信息出口检测/脱敏/拦截）、per-role context（不同角色解析不同上下文集——Horizon 私测期尚未交付，属蓝图后置项）、审计日志。
- 【四】**治理≠验证**（Typedef 批评）：governed 定义在**上游已塌缩的 grain** 上照样产出错误数字（**477 vs 48** 生产复现，Typedef，须归属）；`NON ADDITIVE BY` 是人填的声明非推导。
- 【二】**三级对策**（蓝图 §7，按成本排序）：
  1. 表达式级 derived 校验（便宜先做）：口径表达式里可见的非可加性注册期自动标记；
  2. verified Q&A 作为出口对账资产：验证答案与重算结果不一致时告警（原型 A1b 对账断言即雏形【一】）；
  3. eval 环事后评分 + 血缘回溯（贵，后置）：承认「编译期从转换代码推导计算合法性」目前无成熟方案，以 eval 兜底而非假装解决。

## 八、工程落地纪律与演进路线

- 【二】**三条落地纪律**（内部织物方案，蓝图实例化验证）：改动 **additive + 特性开关 + fail-soft**（不破坏现有功能）；机制（治理/路由）与策略（各源算法）**正交分解**；SSOT **指针不复制**。
- 【二】**独立部署路径**：对象层落 PostgreSQL（或任意带版本化的存储）、激活层以单进程 stdio/HTTP MCP server 起步——原型即零依赖种子。
- 【二】**演进路线**（验收口径照抄蓝图 §9）：P0 机制验证（**已完成**【一】：六机制玩具域 + MCP stdio + 7 次破坏实验，selftest 全绿）→ P1 最小服务（对象 CRUD + resolve + MCP 四工具 + 双层 RBAC + 审计，接一个真实 agent 客户端）→ P2 信任与自纠（四因子归一 + 冲突浮出 + 反馈闭环 + verified QA 沉淀）→ P3 互操作（Ossie YAML 导入导出 + per-role context + 表达式级 derived 校验）。
- 【二】P1–P3 均**未实现**，口播须说「路线图上」不得说「已做到」。

## 九、业务价值数字（引用前查级，全部【三】须归属）

| 数字 | 一句话读法 |
|---|---|
| 24.1% → 86.3%（Snowflake 自家基准） | 上下文层把准确率抬 3.6 倍；增益端无第三方复现 |
| $1.76 → $0.59/query | 每次查询成本砍 2/3 |
| 整站搭建数月 → 一天（官方口径） | 隐式轨道的搭建效率 |
| 「同一问题两个答案」的组织成本（【二】定性） | 不用对数——每个部门自己算一遍的重复劳动与扯皮 |

## 十、批判性边界（同上篇五条，本集侧重工程视角）

1. 增益数字是厂商自家基准；复刻者自己的基线必须自己测。
2. 「不可绕过」只在引擎周界内成立——导出数据即绕过；自建层的周界由自己划定。
3. 治理 ≠ 验证：注册期校验的是结构合法性，不是计算正确性；上游 grain 塌缩照样错（477 vs 48）。
4. 四因子排序可能放大多数派错误——所以冲突必须浮出人工，不许排序代替裁决。
5. 通用化折损：Horizon 的引擎内嵌优势依赖「引擎+上下文同厂」；自建层用「执行层守卫」逼近，但跨系统场景（OSI 解决携带、不解决执行）仍是无解区，只能显式声明边界。

## 十一、v2 代码实景引用清单（2026-09-13 改版增补）

> v2 口播中「屏幕上的代码/实测输出/对话记录」逐处锚定（全部【一】仓内可复跑）：

| 口播位置 | 画面代码/输出 | 锚点 |
|---|---|---|
| p2-11..13 同义词参数 | `Metric("revenue", "sum", "orders", "total", synonyms=("sales", "毛收入", "营收"))` | lab `build_sales_view()` |
| p2-25..26 校验拦截 | `✗ relationship bad: … not PRIMARY KEY/UNIQUE` | lab D6 输出 |
| p3-14..16 自纠三处 | `e.synonyms = tuple(sorted(...))` / `e.popularity = 50`（对的条目 5→50）/ `e.popularity = 120`（错条目 200→120） | lab `eval_loop` 双循环三赋值；C4 输出 |
| p3-26..27 自动选反事实 | D4 实测行 | lab D4 |
| p4-18 log1p 一行 | `pop = math.log1p(popularity) / math.log1p(POP_CAP)` | lab `rank()` |
| p4-26..32 MCP 实录 | initialize 握手 / tools/list 四工具 / list_context_objects（revenue · governed · 权威 1.0）/ compile_metric → {200,150,300} | mcp TOOLS + T1/T2/T4 实测 |
| p4-33..36 三行日志 | `[PASS] T5 … plan is a PRIVATE fact` / `T6 … governed → legacy` / `T8 … [3,1,2]` | mcp selftest T5/T6/T8 原文 |
| archify 回放 | blueprint-architecture / object-lifecycle 两段 Play 录制 | `docs/assets/architecture/paper-notes/` + `pipeline/scripts/record_archify.py` |
