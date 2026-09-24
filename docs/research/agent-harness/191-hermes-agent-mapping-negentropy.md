---
sidebar_position: 10
title: "Hermes Agent ↔ negentropy 机制映射报告"
description: "十六条机制对照（✅4 / 🔶6 含部分对齐 1 / ⏸6）：真增量是交互式对话的上下文压缩（全仓零压缩、未启用 ADK 2.2 原生 EventsCompactionConfig）、记忆写入与注入两端的防注入、零 LLM 原文会话检索；取证副产物为中文关键词检索失效（english tsvector 整段汉字单 token，PG 实测，ISSUE-196）与审批门只接线两个工具（ISSUE-197）；运行中自写技能按争议一暂缓"
---

# Hermes Agent ↔ negentropy 机制映射报告

> [!NOTE] 声明
>
> - 本报告只做分析，不改代码。
> - 本仓锚点均在工作区 HEAD `2edf3ed5`（`feature/1.x.x` 基线）上经 `grep -n` 核验；`ng/` = `apps/negentropy/src/negentropy/`。
> - Hermes 侧出处指向 [190 精读笔记](./190-hermes-agent.md)的章节，代码行号统一钉在固定提交 `068db016`。

## 结论先行

本仓已经具备与 Hermes 同构的几块底座：

- 所有权字段加版本快照；
- 按翼的工具许可上界；
- 排程不对 Agent 开放；
- `execute_code` 走沙箱且审批不因沙箱豁免。

材料的真增量落在三处，都是本仓**交互式对话主链路**上的缺口：

1. **上下文压缩为零**：历史全量回放，没有任何截断或压缩，也没有启用 ADK 2.2 已自带的 `EventsCompactionConfig`。长会话终将撞上模型窗口。
2. **记忆链路两端都没有防注入**：Agent 写入端只查 JSON 格式（连 PII 检测都不经过）；注入端每轮把检索到的记忆写进 system instruction，却没有声明「这是数据，不是指令」。
3. **历史会话不可检索**：事件表没有全文索引。

取证副产物更紧迫，有两条：

- 记忆与知识库的关键词检索用的是 `english` 分词配置。中文整段被切成单个 token，tsvector 关键词腿对中文子串全部落空（PG 16.14 实测）；记忆检索在无 embedding 时靠 `ILIKE` 回退兜住，知识库没有回退（[ISSUE-196](../../.agents/issue.md)）。
- 审批门 `should_request_approval` 只在 `ingest_to_corpus`、`ingest_paper` 两个工具里接线；`HIGH_RISK_TOOLS` 列出的 `save_to_memory`、`execute_code`、`write_file`、`publish_content`、`send_notification` 并未调用它，能跑主机 Bash 的 `invoke_claude_code` 也不在清单里（[ISSUE-197](../../.agents/issue.md)）。

16 条映射中：

| 判定 | 条数 | 编号 |
|---|---|---|
| ✅ 已对齐 | 4 | M6 / M7 / M13 / M15 |
| 🔶 值得落地（含部分对齐 1） | 6 | M2 / M3 / M4 / M9 / M10 / M11 |
| ⏸ 暂缓 | 6 | M1 / M5 / M8 / M12 / M14 / M16 |

Hermes 的头号卖点「运行中自写技能」按[争议一](./190-hermes-agent.md#争议一运行中自写技能还是离线门控进化没有判卷人时一次成功不等于方法对)暂缓：本仓选的是离线门控进化，这与 Hermes 的在线写回是路线分歧，不是缺口。

## 映射总表

| # | Hermes 机制（190 出处） | 本仓对应 | 锚点 | 判定 |
|---|---|---|---|---|
| M1 | 缓存优先三段式装配 + 冻结快照（§3） | 每请求动态 instruction；每轮检索记忆注入 system instruction；LLM 请求侧未配置提供方前缀缓存 | `ng/agents/_dynamic_instruction.py:80` `_provider` · `:97-99` · `ng/agents/tools/memory.py:6` · `:161` `append_instructions` | ⏸ 触发条件见下 |
| M2 | 有界常驻、Agent 可自编的声明式记忆（§4） | `MemoryCoreBlock` + 30% 记忆预算；核心块只能经 REST `/core-blocks` 写，Agent 无编辑工具（`core_block_replace` 全仓零调用方） | `ng/models/internalization.py:250` · `ng/engine/api.py:1206` · `ng/engine/tools/memory_tools.py:236` · `ng/agents/tools/registry.py:64` · `ng/engine/adapters/postgres/context_assembler.py:38` | 🔶 写 |
| M3 | 记忆写入与加载两端威胁扫描、快照 `[BLOCKED]` 占位（§4） | `save_to_memory` 只做 JSON 格式校验后直接 ORM 落库，不经 memory_service，PII 与注入检测都不覆盖；注入块只说「无关时忽略」 | `ng/agents/tools/internalization.py:23` · `:71-80` · `ng/engine/governance/content_validator.py:21` · `ng/agents/tools/memory.py:52-56` | 🔶 做 |
| M4 | 技能渐进披露：目录常驻、正文按需（§4） | 目录注入已对齐；`expand_skill` 未挂载 | `ng/agents/skills_injector.py:342` · `:357` · `ng/agents/tools/registry.py:64` | 🔶（部分）ISSUE-194 已登记 |
| M5 | 交付后旁路 review 自写技能（§5） | 交互式无；Routine 有迭代后记忆提炼；技能进化走离线门控 | `ng/engine/routine/orchestrator.py:1393` · `ng/engine/evolution/handlers/skill.py:96` · `ng/engine/evolution/decision.py:120` | ⏸ 争议一 |
| M6 | 分派侧白名单、「广播不等于许可」（§5） | 按翼 `allowed_names` 许可上界 + Faculty `read_only` 白名单 | `ng/agents/_dynamic_tools.py:38` · `ng/engine/routine/faculty_bridge.py:43` · `:81` | ✅ |
| M7 | 署名边界 + 只归档不删除（§5） | `Skill.owner_id` / `is_system` + `SkillVersion` 快照可恢复 | `ng/models/skill.py:21` · `:48` · `:114-119` | ✅ 前置齐备 |
| M8 | Curator 按使用信号的生命周期（§5） | 技能无使用遥测字段 | `ng/models/skill.py:15-68` | ⏸ 同 M5 |
| M9 | 零 LLM 原文会话检索 + 谱系去重（§6） | 事件表无全文索引；会话 API 无检索路由 | `ng/models/pulse.py:36` · `:45` · `ng/engine/sessions_api.py:119-202` | 🔶 做 |
| M10 | CJK bigram / trigram 分词索引（§6） | `memories` 与知识库的 `search_vector` 均按 english 配置生成与查询 | `ng/db/migrations/versions/0047_memory_hybrid_search_function.py:58` · `:146` · `ng/db/migrations/versions/0001_init_schema.py:914` · `ng/engine/adapters/postgres/memory_service.py:1255` · `ng/knowledge/retrieval/repository.py:841` | 🔶 做（ISSUE-196） |
| M11 | 交互式上下文压缩：结构不变式 + 唯一断点（§6） | 零压缩：`num_recent_events` 零调用方，未启用 `EventsCompactionConfig`（ADK 2.2.0 标 `@experimental`）；仅 Routine 有 compact 重试 | `ng/engine/adapters/postgres/session_service.py:146-156` · `ng/engine/routine/runner.py:69` · ADK 2.2.0 `google/adk/apps/_configs.py:49-50` | 🔶 做 |
| M12 | 隔离委派：新上下文、只回摘要、深度 1、子代理禁记忆（§7） | `transfer_to_agent` 是控制权移交，不是隔离执行；`run_faculty` 的 `read_only` 近似 | `ng/agents/agent.py:126-130` · `:249` · `ng/engine/routine/faculty_bridge.py:125` | ⏸ |
| M13 | cron 不许自排程（§7） | Agent 工具注册表内无排程类工具，排程只经 REST / UI | `ng/agents/tools/registry.py:64-92` · `ng/models/scheduled_task.py:31` | ✅ 结构性对齐 |
| M14 | 命令内容级 hardline（连 yolo 也拦）（§7） | 工具级审批清单 `HIGH_RISK_TOOLS` + `ApprovalPolicy`，但只接线两个工具；`invoke_claude_code` 给主机 Bash（CC 自身 `permission_mode` 默认 auto），不在清单内；无命令内容级硬拦截 | `ng/agents/approval.py:46` · `:118` · `:128` · `ng/agents/tools/claude_code.py:23` · `ng/agents/tools/ingest.py:119` · `ng/agents/tools/paper.py:343` | ⏸ 同 181 #17（CC 最大权限取舍） |
| M15 | 容器后端跳过审批（§7） | `execute_code` 在 microsandbox 内执行，未因沙箱豁免审批（但审批本身未接线，见 M14） | `ng/agents/tools/action.py:44` · `ng/engine/sandbox/__init__.py:9` | ✅ 仅就 `execute_code` 而言；不照抄「容器即边界」 |
| M16 | 30+ 平台消息网关 / 7 种终端后端（Tier 3） | 无；Docker 后端 `NotImplementedError` | `ng/engine/sandbox/__init__.py:30` | ⏸ YAGNI |

## 逐条说明

### M11 交互式上下文压缩（🔶 做 · 最高优先）

- **Hermes 怎么做**：
  - 50% 阈值（小于 512K 的窗口抬到 75%）触发四阶段压缩。
  - 对齐工具组、清洗孤儿对两道保险。
  - 摘要在上一版上迭代更新；压缩后重建提示并重读记忆，是会话内唯一计划内的缓存断点。
- **本仓现状**：
  - `get_session` 只在调用方传 `num_recent_events` 时截尾（`session_service.py:146-156`），而全仓没有任何调用方传这个参数。
  - 也没有启用 ADK 2.2.0 已提供的 `App(events_compaction_config=…)`（`google/adk/apps/_configs.py:50`、`apps/app.py:84`）；该配置在 2.2.0 仍标 `@experimental`（`_configs.py:49`），接入时须锁版本并跟踪 ADK 变更。
  - 交互式对话每轮都全量回放历史。
- **差异**：会话越长，每轮成本越高，最终撞窗口报错；没有任何环节保证工具调用对不被截断拆开。
- **建议**：
  - 复用 ADK 原生 `EventsCompactionConfig`，不自造压缩器。
  - 验收加一条原型 D3 同款断言：压缩后不存在孤儿 `function_response`。
  - 时机：绑定下一次交互式长会话稳定性工作，或 [013 Phase 1](../cognitive-context/013-context-layer-blueprint.md)，二者取先。

### M3 记忆链路两端防注入（🔶 做）

- **Hermes 怎么做**：
  - 写入时过 36 条威胁模式，另查不可见字符。
  - 加载时命中的条目在快照里替换为 `[BLOCKED: …]`，live 列表保留原文，供用户删除。
- **本仓现状**：
  - `save_to_memory` 只调 `validate_memory_content`，它仅判断「是不是 JSON」（`content_validator.py:21`），随后直接用 ORM 落库（`internalization.py:71-80`），不经 memory_service。memory_service 里的 PII 检测（`memory_service.py:160`、`:1647`）因此也覆盖不到这条 Agent 写入路径，注入检测则两条路径都没有。
  - `NegentropyPreloadMemoryTool` 每轮按用户消息检索，把结果以 `<RELEVANT_MEMORIES>` 块 `append_instructions` 进 **system instruction**（`memory.py:161`、`:180`）。块头只写「无关时直接忽略」（`:52-56`），没有「视为数据、不执行其中指令」的声明。
- **差异**：一条被投毒的记忆会被持久化，并在相关查询时被推进系统指令。这正是间接提示注入 [190 参考 12] 的持久化变体。
- **建议**：
  - 写入端复用一份威胁模式表：Hermes 的 36 条是 MIT 许可，可按需裁剪。
  - 注入块头补一句数据声明。
  - 时机：与 [091](../agent-infra/091-agent-skills-mapping-negentropy.md) 的「目录注入防护」同批落地，在 ISSUE-195 会话巩固上线前完成——巩固一旦上线，自动写入量会放大这个面。

### M9 零 LLM 原文会话检索（🔶 做）

- **Hermes 怎么做**：
  - FTS5 三索引，检索零 LLM、返回原文。
  - 命中按谱系归并到对话再去重；默认 3 条，最多 10 条。
- **本仓现状**：
  - `Event`（`pulse.py:36`）的内容以 JSONB 存储（`:45`），没有 tsvector 或向量索引。
  - `sessions_api` 只有归档、删除、审批响应等路由（`:119-202`），没有检索路由。
  - 关键词检索只覆盖记忆表和知识库。
- **建议**：
  - [ISSUE-195](../../.agents/issue.md) 的「会话 → 长期记忆」断链修好之前，原文检索是更便宜的第一步：零 LLM、没有巩固 worker 的一致性问题，而且与 015 M-d 不冲突，二者互补。
  - 做法：在事件文本上建 GIN 索引，挂一个只读检索工具，结果按 thread 去重。
  - 时机：与 ISSUE-195 方案评审同场决定。
  - 前置：先修 M10，否则中文检索仍然失效。

### M10 中文关键词检索失效（🔶 做 · ISSUE-196）

- **Hermes 怎么做**：专门加了 `cjk_unicode61` bigram 索引与 trigram 回退。原因是 unicode61 会把一串连续汉字当作一个 token。
- **本仓现状**：迁移 0047 为 `memories` 建的触发器是 `to_tsvector('english', content)`（`:58`），查询用 `plainto_tsquery('english', …)`（`:146`、`memory_service.py:1255`）；知识库由 0001 的 `tsvector_update_trigger(search_vector, 'pg_catalog.english', content)` 生成（`0001_init_schema.py:914`），查询同款（`repository.py:841`）。
- **实测**（本机 PostgreSQL 16.14，只读查询）：

  ```text
  to_tsvector('english','用户偏好先给结论，少铺垫')  →  '少铺垫':2 '用户偏好先给结论':1
  …@@ plainto_tsquery('english','先给结论')        →  f
  …@@ plainto_tsquery('english','用户偏好先给结论')  →  t
  ```

- **差异**：中文内容的 tsvector 关键词腿只能命中「整段原串」，混合检索实际退化为纯向量检索，BM25 融合权重对中文是空转。记忆检索在没有 embedding 时会回退到 `ILIKE '%query%'`（`memory_service.py:808`、`:1290`），中文子串能命中；知识库没有这层回退。
- **建议**：先登记 ISSUE-196，方案另行评审，本报告不预设。候选是 `pg_trgm` 或 `pg_bigm`，或在入库时做 bigram 预切分写入 `simple` 配置；须在 PG16/17/18 上核扩展可用性（见本机多版本漂移经验）。时机：下一次触及 hybrid search 的 PR。

### M2 Agent 可自编的有界核心记忆（🔶 写）

- **Hermes 怎么做**：`MEMORY.md` / `USER.md` 由 Agent 用 add / replace / remove 自编，硬上限 2200 / 1375 字符，写满必须合并。
- **本仓现状**：`MemoryCoreBlock`（`internalization.py:250`）具备「常驻、按作用域分块」的形态；上下文装配给记忆 30% 预算（`context_assembler.py:38`）。但核心块只能经 REST `/core-blocks` 写入（`engine/api.py:1206`，直接调 `core_block_service`）；`core_block_replace` 工具函数（`memory_tools.py:236`）全仓零调用方，也不在 Agent 工具注册表里（`registry.py:64`）。
- **建议**：先**写**清楚，暂不开放。在 013 蓝图的记忆层补一句设计取舍：核心块由谁写、上限多少、写满怎么办。是否开放给 Agent，等 M3 防注入落地之后再议——开放可自编的常驻记忆而没有写入扫描，等于给注入开一条常驻通道。成本约一段文档。

### M1 缓存优先装配（⏸）

- **本仓现状**：
  - instruction 每次请求由 `InstructionProvider` 从 DB 解析（60 秒 TTL 缓存），并追加全局技能块（`_dynamic_instruction.py:80`、`:97-99`）。
  - 检索记忆每轮注入 system instruction，同一 invocation 内去重复用（`memory.py:151-161`）。
  - LLM 请求侧没有设置任何 `cache_control`（grep 仅命中 HTTP 下载头，`knowledge/_http_range.py:145`）。
- **判定理由**：本仓目前不付前缀缓存的钱，也不收它的折扣，所以「每轮注入」在今天没有额外代价。这是[争议三](./190-hermes-agent.md#争议三缓存优先还是每轮相关性注入)的相关性一侧，是合理选址。
- **触发条件**：一旦为 Anthropic 或 Gemini 路由启用前缀或上下文缓存，就须把 `<RELEVANT_MEMORIES>` 从 system instruction 移到本轮用户消息一侧，或者按会话冻结。否则每个新用户轮都会让整段历史按原价重算。

### M5 / M8 运行中自写技能与 Curator（⏸）

- **本仓路线**：技能进化由 `SkillProposer` 从失败用例驱动有界改写（`evolution/handlers/skill.py:96`），经 `pre_propose_check` → shadow → canary 门控（`decision.py:120`、`:427`）。这是门控派。
- **暂缓理由**：
  - 本仓连「模型自主激活技能」都尚未打通：`expand_skill` 未挂载（ISSUE-194），在线 canary 恒被跳过。
  - 没有使用遥测，Curator 式回收无信号可用。
- **触发条件**：ISSUE-194 挂载完成，技能具备 view / use 计数，且出现至少一类同构任务在 30 天内反复出现。届时可借鉴两点，而不是照搬「Be ACTIVE」：
  - review prompt 的「禁止固化」清单：环境性失败、负面工具结论、未解决的失败。
  - 「只归档不删除、宽限从未用过的新技能」这两条回收纪律。

### M12 隔离委派（⏸）

`transfer_to_agent`（`agent.py:126-130`）把控制权交给子 Faculty，子 Faculty 在同一会话上下文里继续工作，而不是「新上下文执行、只回摘要」。触发条件：出现需要并行扇出子任务的场景。届时优先评估 ADK 原生的 AgentTool 形态，并照 Hermes 的子代理禁用清单来限权：禁记忆写、禁再委派、禁直接找用户。

### M14 命令内容级硬拦截（⏸）

- **本仓现状**：主机级命令执行已经存在。`invoke_claude_code`（`claude_code.py:23`）默认给 Claude Code 开 `Bash,Read,Write,Edit,Glob,Grep`，在主机 cwd 上运行，权限由 CC 自身的 `permission_mode`（默认 auto）决定，且不在 `HIGH_RISK_TOOLS` 内。审批门本身只在 `ingest_to_corpus`、`ingest_paper` 两处接线（`ingest.py:119`、`paper.py:343`），全局 `before_tool_callback` 只做遥测。
- **判定理由**：维持 ⏸，与 [181 #17](./181-ai-native-mapping-negentropy.md) 的「CC 最大权限」取舍保持一致——这是既定的产品选择，不是缺口。但 181 当时的前提「没有通用 shell」已不成立，触发条件实际已满足，是否把 `invoke_claude_code` 纳入审批清单或加命令级硬拦截，需要单独决策。
- **需先修的事实层问题**：`HIGH_RISK_TOOLS` 与[用户指南](../../concepts/user-guide/chat-essentials.md)（称 `always` 模式「任何工具调用前都弹审批」）都高估了审批覆盖面，已登记 ISSUE-197。

## 落地建议汇总

- **做**：
  1. M11：交互式对话启用 ADK 原生 `EventsCompactionConfig`，验收加「无孤儿 function_response」断言。时机：下一次长会话稳定性工作或 013 Phase 1，二者取先。
  2. M3：记忆写入过威胁模式表，注入块头补数据声明。时机：与 091 目录注入防护同批，先于 ISSUE-195 巩固上线。
  3. M10：修中文关键词检索（ISSUE-196）。时机：下一次触及 hybrid search 的 PR。
  4. M9：事件文本全文索引 + 只读会话检索工具，结果按 thread 去重。时机：ISSUE-195 方案评审同场决定，前置 M10。
  5. ISSUE-197：把审批覆盖面与文档对齐——要么为清单内工具补接线，要么收窄清单与用户指南的说法。时机：下一次触及 approval 的 PR。
- **写**：
  - M2：013 记忆层补「核心块由谁写、上限、写满策略」的设计取舍，约一段。
  - 本次同批：校正 [0001 RFC](../../concepts/design/0001-conversation-architecture-refactor.md) 的 Hermes 口径（见下节）。
- **暂缓**：
  - M1：启用提供方前缀缓存时。
  - M5 / M8：ISSUE-194 挂载、有使用遥测、同构任务反复出现时。
  - M12：需要并行扇出时。
  - M14：维持「CC 最大权限」取舍；若改变该取舍，或 ISSUE-197 决定补接线，再评估命令级硬拦截。
  - M16：出现消息平台接入需求时。

## 取证副产物

1. **ISSUE-196**：中文关键词检索失效，详见 [issue.md](../../.agents/issue.md)。
2. **0001 RFC 口径校正**：[`0001-conversation-architecture-refactor.md`](../../concepts/design/0001-conversation-architecture-refactor.md) §1.2 表把 Hermes 的刷新语义写成「session lineage 跨 compression」。按固定提交，默认 `in_place: True` 是**同一会话 ID 原地压缩、旧行软归档**，只有旧式轮换路径才生成 `parent_session_id` 续接会话。已就地校正并注明钉点；该表「服务端去重」的结论不受影响。
3. **ISSUE-197**：审批门只接线两个工具，`HIGH_RISK_TOOLS` 与用户指南高估了覆盖面，详见 [issue.md](../../.agents/issue.md)。

## 交叉引用

- 精读笔记：[190 Hermes Agent](./190-hermes-agent.md)；原型：[`assets/hermes_lab.py`](./assets/hermes_lab.py)。
- 相邻映射：
  - [181 AI Native 手册映射](./181-ai-native-mapping-negentropy.md)：命令硬拦截、凭据边界。
  - [091 Agent Skills 映射](../agent-infra/091-agent-skills-mapping-negentropy.md)：目录注入防护、`expand_skill`。
  - [015 OpenViking 映射](../cognitive-context/015-openviking-mapping-negentropy.md)：会话两阶段提交、ISSUE-195。
- 蓝图：[013 Context Layer 技术蓝图](../cognitive-context/013-context-layer-blueprint.md)。
- 进化路线：[130 自进化 Agents Team](../self-evolution/130-self-evolving-agents-team.md) · [141 Skill 进化闭环](../self-evolution/141-skills-evolution-and-si-measurement.md)。
