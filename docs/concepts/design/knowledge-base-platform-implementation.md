---
sidebar_position: 12
title: "知识库平台 M1–M3 工程实施计划（独立新建平台）"
id: knowledge-base-platform-implementation
last_update:
  author: Aurelius Huang
tags:
  - Knowledge Base
  - Implementation Plan
  - Design RFC
---

# 知识库平台 M1–M3 工程实施计划

> **定位**：把《[知识库平台技术方案](./knowledge-base-platform.md)》落成**独立新建平台**的分里程碑工程计划。Negentropy 知识库子系统不作为演进底座，定位为**参考实现与经验库**——可移植代码件与已确证的工程铁律全部来自《[差距分析与补充诊断](./knowledge-base-platform-gap-analysis.md)》（下称「差距分析」，其 §10.3 参考件清单与 §10.2 铁律清单为本计划下位输入）。

## 0. 前提与总体假设

- **推荐技术栈**（与方案 §6 对齐，最大化参考件复用）：Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic；PostgreSQL 17+（pgvector；关键字路 pg_textsearch，见 [ADR-0002](./knowledge-base-platform-adr-0002-bm25-engine.md)，M2 落地、M1 以 ts_rank 兜底起步；PostGIS 于 M2 引入）；Redis（队列/限流，M2）；Next.js（管理台与官网 Widget）；uv + pnpm。检索层以仓储接口抽象，保持 ES/OpenSearch 可替换。
- **团队假设**：后端 3、前端 1、算法/评测 1（可缩配 2+1+1）；人月按此折算。
- **工期估算**：M1 ≈ 4–5 周（约 14 人周）；M2 ≈ 7–9 周（约 26 人周）；M3 ≈ 4–6 周（约 15 人周）。关键路径见 §9。
- **总原则**：每个里程碑以**可量化的退出门**收口（§8）；安全不变量（方案 §5.2 五条）在 M1 即以最小形态成立，之后只收紧不放松；一切原生快路径随迁移交付、降级必须可观测。

## 1. 总路线图

![知识库平台 M1–M3 路线图：六个工作流（平台工程/文档管理/索引构建/检索服务/权限管控/应用与闭环）横跨三个里程碑。M1：服务骨架与鉴权覆盖门、DocumentVersion 与确定性 chunk 与原子换版、ts_rank+HNSW+元数据过滤、谓词构造器与四模式 RRF、Channel 与匿名产品域谓词与 fail-closed、Answer API 与 golden set v0。M2：队列调度与死信、连接器 SPI 与 Source 与 overlay、真 BM25 与 PostGIS 与蓝绿、真重排与置信校准与逐腿回归、ACL 三类主体与撤销覆盖表与增强 token 与 RLS 与泄漏 CI、Widget 沙箱与 KnowledgeTask 与四态反馈与 RAGAS 门。M3：运维常态化、引用降频与合规擦除与多语言、嵌入双轨 MRL、高精档可选、ReBAC 外置评估、A/B 灰度与 resolution 口径。](../../assets/architecture/design/knowledge-base-platform--roadmap-dark.png)

> 图源（可 diff 文本）：[`knowledge-base-platform--roadmap.mmd`](../../assets/mermaid/design/knowledge-base-platform--roadmap.mmd) · 交互版（下载到本地打开）：[`knowledge-base-platform--roadmap.html`](../../assets/architecture/design/knowledge-base-platform--roadmap.html)

三里程碑的定位：**M1 单产品可用**（一个产品域、匿名访客、关键字+向量两路、手动引入与人工编辑）；**M2 多产品与全索引**（连接器同步、真 BM25、geo、登录客户 ACL、Widget 上线）；**M3 规模化与闭环**（评测门常态化、灰度、合规与多语言、授权外置评估）。

## 2. P0 平台工程骨架

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P0-1 (M1) | 仓库与 CI 骨架：uv 工程化、pre-commit、CI（单测/集成/迁移 up-down） | 可部署的空服务 + CI 全绿 | Negentropy CI 形态 | M |
| P0-2 (M1) | **鉴权中间件默认 strict + 路由鉴权覆盖门**：写端点无授权依赖即 CI 失败；公开端点显式白名单 | middleware + CI 门 + 测试 | 差距 D4-L4（Negentropy 默认 OPTIONAL 即 fail-open 的反例） | M |
| P0-3 (M1) | 迁移与扩展自检体系：Alembic 全量基线；启动自检 pgvector 等扩展存在性 | migration 0001 + doctor 自检 | D2-L8（I-139：宿主环境漂移静默瘫痪） | S |
| P0-4 (M1) | 结构化日志与 SLI 基线：检索日志行含 mode/latency/zero-hit；审计事件骨架 | structlog 配置 + SLI 定义文档 | 方案 §4.4；D5-L5（零命中须与未检索可区分） | M |
| P0-5 (M2) | 队列、调度与死信：摄取/索引任务统一队列，退避重试、超限死信+告警；watchdog 收敛卡死任务 | 任务框架 + DLQ + watchdog | D1-L1/L9、D2-L7（状态机+协作取消+看门狗） | L |
| P0-6 (M3) | 运维常态化：蓝绿重建例行化、容量演练、混沌（判定服务宕机→fail-closed 演练） | runbook + 演练记录 | 方案 §5.2-2 | M |

## 3. P1 文档管理

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P1-1 (M1) | 核心数据模型落地：Product/Source(upload)/Document/DocumentVersion(version_key 含 acl+product_ids)/Chunk(确定性 chunk_id)/Draft/KnowledgeTask/IndexBuild/Channel/QAInteraction/AuditLog | migration + ORM + 单测 | 方案 §1 三不变量；D1-L3（chunk_id 确定性派生）；D1-L4（软删复活+partial unique） | L |
| P1-2 (M1) | upload 引入管线：解析（复用/移植 NE extraction 的多 target 路由）→清洗（含 NUL 剥离咽喉点）→递归分块→标题路径前缀→embedding（指数退避）→**同事务原子换版**（DELETE+INSERT） | ingest API + 管线测试 | NE chunking/extraction/embedding 直移；D1-L2/L6 | L |
| P1-3 (M1) | 人工编辑最小闭环：Draft→diff 评审→发布；可见性变更独立权限+四眼；乐观锁；append-only 审计 | 编辑 API + 审批流 + 审计表 | 方案 §2.3；Confluence 审批范式（调研 §2-F7） | L |
| P1-4 (M2) | Connector SPI：discover（内容/ACL/删除三类探测）+ webhook（验签/通知-only/落队列回 202）+ 增量拉取（游标；DB 源 CDC）+ 全量重扫；Source 聚合（信任档/权威策略/白黑名单/默认可见性） | SPI 接口 + 3 个内置连接器（帮助中心 API/对象存储/DB 视图） | Glean/Azure 形态（调研 §2/§3）；D1-L5（超时预算传递+指纹断点续传） | XL |
| P1-5 (M2) | overlay 与冲突：上游权威源本地改动存 overlay、自动 rebase、冲突转 KnowledgeTask；删除 tombstone 单通道（级联 chunk 下线+检索感知） | overlay 层 + tombstone 语义 + 孤儿清理工具 | 差距 D1-C6/C8（双删除入口与静默覆盖反例） | L |
| P1-6 (M2) | 验证态治理：verifier/周期/编辑即失效/过期灰标转 KnowledgeTask；PII 识别脱敏（移植 NE Presidio 工厂）进预处理 | 验证态字段+过滤+巡检例程；PII 管线 | Guru 范式（调研 §2-F8/F9）；D1-L7（patrol 状态机复用）；I-099 教训 | M |
| P1-7 (M3) | 引用价值降频调度（retrieval_count 驱动，ACL/删除通道除外）；保留期与合规擦除（加密粉碎+级联派生物清理）；多语言源 | 调度器 + 擦除通道 | Fin 范式（§4-F3）；方案 §2.2 | M |

## 4. P2 索引构建

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P2-1 (M1) | 索引基线：tsvector（**明示非 BM25**）+ pgvector HNSW（M/efC/efS 参数化）+ 元数据结构化列与 GIN + (product_id) 复合索引 | migration + 索引回归测试（含 CJK 子串用例） | D2-L6/I-196（english 配置中文全灭）；差距 D2-C1/C2 | M |
| P2-2 (M1) | chunk 数据态与写入幂等：parsed→indexing→indexed；未索引隔离；LLM 派生物缓存键 (hash(正文+源侧 metadata), pipeline_ver) | 状态机 + 缓存层 + 测试 | 方案不变量①；FastGPT 三态（调研 §4.3） | M |
| P2-3 (M1) | 增量与重建（起步档）：文档粒度原子换版；text_hash 命中复用 embedding；重建判据=模型标识变更；重建入口覆盖全部源类型 | rebuild 管线 + 对比测试 | D2-L3/L4、D2-L5（幂等锚不可变标识） | M |
| P2-4 (M2) | 真 BM25 落地（选型已定，[ADR-0002](./knowledge-base-platform-adr-0002-bm25-engine.md)）：pg_textsearch 集成（k1/b 按索引；中文 zhparser 托管均不可装——分词方案需 PoC 验证，见 ADR-0002 §5 ④）+ 目标云兼容性验证；RLS 共享表 IDF 跨租户统计评估（必要时按产品域分区）；AWS/Azure 场景走兜底重算并外置 OpenSearch（BM25F `combined_fields`） | 集成 + 兼容矩阵 + IDF 隔离测试 | ADR-0002；方案 §3.1 | L |
| P2-5 (M2) | 地理空间：PostGIS + geo_point/geo_region 列 + GiST + `<->` KNN + H3 分析列；参照点优先级链与降级 | migration + geo 检索腿 + 测试 | 方案 §3.1/§3.3；调研 §8 | L |
| P2-6 (M2) | index_ver 蓝绿：双写、水位追平、回归门、别名原子切换；回滚先重放删除/ACL 事件；权限/内容分队列部分重索引 | 蓝绿编排器 + 回滚演练 | 方案 §3.2；Azure Resync 范式（§3-F5） | XL |
| P2-7 (M3) | 嵌入双轨：中文 BGE-M3/Qwen3 自托管 + 西文 API；MRL 弹性维度与租户配额；换模型重建常态化 | 双轨接入 + 重建 runbook | 调研 §5-F7/F8/F9 | L |

## 5. P3 检索服务

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P3-1 (M1) | **单一谓词构造器**：权限+产品域+元数据+geo 的结构化 DSL（参数化、枚举白名单）；四路召回一律经构造器下推 | 谓词模块 + 四路单测 | 差距 D3-C2（谓词散落两处反例）；D3-L5（图扩展/父块回提复用同构造器） | M |
| P3-2 (M1) | 四模式检索（semantic/keyword/hybrid/RRF k=60）：DB 侧函数**随迁移交付**+存在性回归，降级打点告警 | 检索服务 + 迁移内 SQL 函数 | 差距 D2/D3（kb_* 未入迁移恒回退的反例）；D2-L2 | M |
| P3-3 (M2) | cross-encoder 真重排：BGE 本地 + API 回退（Composite）；截断参数显式对齐 limit；**置信=按产品域校准的原始分**，阈值拒答+兜底链 | reranker + 校准脚本 + 拒答链 | D3-L3/L8（归一化分与隐式截断反例）；方案 §4.2 | L |
| P3-4 (M2) | 逐腿回归门：golden set 按召回腿分别断言（关键词腿单独过，含 CJK）；RAGAS 四指标；索引重建/参数变更过门 | 评测 executor + CI 门 | D3-L7/I-196；方案 §4.4 | L |
| P3-5 (M2) | 降级矩阵：embedding 故障→hybrid 退 keyword（显式标注）；纯语义显式 502；部分失败≠零命中（不触发知识缺口任务） | 降级测试矩阵 + SLI | D3-L6/L9、D5-L4 | M |
| P3-6 (M3) | 高精档（可选）：ColBERT 晚交互作重排档（多向量侧表预算）；学习型稀疏（SPLADE 类）试点 | POC + 评测对比 | 调研 §5-F4/F6 | L |

## 6. P4 权限管控

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P4-1 (M1) | Channel 实体与匿名平面：Channel（product 绑定/scope⊆产品域/允许身份集/限流）；匿名谓词**静态化**；权限范围参数一律必填 | Channel API + 谓词注入 + 测试 | 方案 §5.1/§5.2；D4-L5（Optional=fail-open 反例） | M |
| P4-2 (M1) | 内部 RBAC：角色×产品域（admin/知识管理员/编辑/审阅者）；DB 为权威按请求解析（token 只证身份）；写路径全覆盖 | RBAC 中间件 + 覆盖门联动 | NE auth 工厂可参考；D4-L2（I-057） | M |
| P4-3 (M2) | ACL 全链路：三类主体映射（public/客户谓词/内部组，源 ACL 镜像默认 internal、空=不可见）；visibility 入 version_key；chunk 物化继承；**撤销覆盖表**（收紧同步/放宽异步） | ACL 模型 + 映射表 + 撤销通道 + 演练 | 方案 §5.2；Glean 范式（§2-F3/F4） | XL |
| P4-4 (M2) | 登录客户与增强 token：IdP JWT 兑换（iss 白名单/aud=Channel/jti 一次性；token TTL≤15min、按产品域命名空间 claims、属性版本号即时失效）；机器调用方只读 token | 兑换端点 + 验权网关 + 测试 | 方案 §5.2 集成期；D4-L1 | L |
| P4-5 (M2) | RLS 兜底与泄漏回归：SET LOCAL 事务级注入、FORCE RLS、非 owner 角色；CI「逐路删谓词→结果必空」差分矩阵（覆盖四路+facets/补全/推荐） | RLS migration + CI 矩阵 | 方案 §5.3；NE kg_entity_alias ORM 级兜底先例（差距 D4 missed） | L |
| P4-6 (M2) | 双审计与缓存隔离：append-only 管理/检索审计（fail-loud，写失败告警）；答案/语义缓存键=Channel+权限视图哈希，个体上下文答案不入缓存 | 审计表 + 缓存层 + 测试 | D4-L7（审计静默 DOA 反例）；方案 §5.2-5 | M |
| P4-7 (M3) | ReBAC 外置评估：OpenFGA/SpiceDB POC（一致性水位自补）；大租户独立 schema/库演进判据 | 评估 ADR + POC | 方案 §5.3；调研 §6-F8/F9/F10 | L |

## 7. P5 应用集成与评测闭环

| # | 任务 | 交付物 | 参考件 / 依据 | 量 |
|---|---|---|---|---|
| P5-1 (M1) | Answer API + 管理台检索调试台：引用元数据（chunk→文档→锚点）；golden set v0（≥50 题/产品域） | API + 调试 UI + 种子集 | NE Agent 检索工具族 citation 元数据（差距 D5-C8） | L |
| P5-2 (M2) | 问答链路生产化：查询改写（指代消解）；逐断言引用**生成后校验**（无锚断言标记/丢弃/重生成）；拒答哨兵不混入证据聚合 | 链路服务 + 校验门 | 方案 §4.2；D5-L7 | L |
| P5-3 (M2) | 官网 Widget：沙箱 iframe + 受限 Markdown 渲染（转义/白名单）+ 短签引用链接（禁直链源系统）；登录态透传 | Widget SDK + sanitize 层 | NE wiki MarkdownRenderer sanitize 参考件（D5-C6 复核） | L |
| P5-4 (M2) | KnowledgeTask 闭环 + 四态反馈：拒答/点踩/转人工→归因四路回流（评测集/调参/生成策略/知识补录→Draft）；**反馈与消费方同 PR 落地** | 任务流 + 反馈 API + 端到端测试 | 差距 D5-L1（表在链路死反例）；Kapa 范式（§4-F6） | L |
| P5-5 (M2) | 转人工 Webhook（出站签名+目标白名单）与客服系统对接样例 | Webhook + 对接文档 | 方案 §4.3 | M |
| P5-6 (M3) | A/B 灰度与会话粘性分桶、最小样本量、变异界与多样性护栏；resolution 口径（判定规则+时间窗+可复算审计，按身份分层） | 灰度框架 + 口径文档 | NE memory 域自进化回路（D5-L2）；Fin 教训（§4-F2） | M |
| P5-7 (M3) | 多语言 Widget 与答案策略按 Channel 配置化 | i18n + 策略配置 | 方案 §4.1 | M |

## 8. 里程碑退出门（量化验收）

| 门 | 判据（全部满足才退出） |
|---|---|
| **M1** | 单产品域上线：upload→编辑→发布→检索（关键字+向量）→Answer API 全链路通；权限红线成立（匿名只见本域 public；鉴权覆盖门 0 违例；删权限谓词差分测试全过）；原子换版下并发读无一致性违例；golden set v0 检索腿逐腿有基线；审计表有写入且 fail-loud 验证 |
| **M2** | ≥2 产品域 + 登录客户 ACL：连接器增量同步 staleness 达 SLO（推送 P95≤5min/拉取按档）；真 BM25 决策落地（ADR）；geo 检索腿过 CJK+geo 用例；蓝绿切换+回滚演练过（回滚不复活已撤权限）；泄漏回归矩阵（四路+旁路出口）CI 全绿；Widget 上线且 XSS/注入测试过；RAGAS 回归门拦截一次人为退化（演习） |
| **M3** | 评测门常态化（索引/策略变更过门率 100%）；A/B 灰度跑通一次完整 promote/rollback；合规擦除演练（版本+派生物+索引级联清零可审计）；ReBAC/分库演进 ADR 出结论；多语言场景验收 |

## 9. 依赖与关键路径

关键路径：**P0-1/2 → P1-1（数据模型）→ P1-2（upload 管线）→ P2-1/2（索引基线）→ P3-1/2（谓词+四模式）→ P4-1（Channel/匿名）→ M1 门 → P1-4（Connector SPI）∥ P2-6（蓝绿）→ P4-3（ACL 全链路）→ P5-3（Widget）→ M2 门**。P4-3 依赖 P1-1 的 version_key 与 P4-1 的 Channel；P2-4（真 BM25）有法务评估前置，须 M2 初启动以免阻塞；P5-4 依赖 P5-1 的 golden set 与 P1-1 的 KnowledgeTask 表。P0-5（队列）是 P1-4 与 P2-6 的共同前置。

## 10. 工程铁律（来自差距分析 §10.2，执行期逐条对照）

1. 权限范围参数一律必填；None 不作全量；默认拒绝，公开端点白名单自负其责（D4-L4/L5）。
2. 整文档替换单事务原子 DELETE+INSERT；幂等锚用不可变标识（文档 ID/内容 hash），URI 变更级联重写派生键（D1-L2、D2-L5）。
3. 原生快路径（DB 函数/专用索引）随迁移交付+存在性回归；任何降级打点告警，禁静默回退（D2-L2、D3-L1）。
4. 重建判据=模型标识变更；重建入口覆盖全部源类型，失败源显式留痕（D2-L3）。
5. 跨索引融合只可用名次（RRF）；裸相似度分不可跨向量空间比较（D3-L2）。
6. 置信禁用逐查询归一化分；重排截断参数与 limit 显式对齐（D3-L3/L8）。
7. 逐召回腿分别断言回归（含 CJK 子串）；分词配置×目标语言显式核对（D2-L6、D3-L7）。
8. 部分召回失败显式上抛，不得与零命中混淆触发拒答/知识缺口任务（D3-L6）。
9. 审计与反馈写入 fail-loud（禁裸 except），反馈与消费方同 PR 端到端锁定（D4-L7、D5-L1）。
10. 任务状态机带 watchdog 超时收敛与协作取消；状态写入回读+乐观并发（D1-L1、D2-L7）。
11. 连接器并发按（源系统,类型）闸门；排队超时与调用超时分离；长任务按内容指纹断点（D1-L5/L9）。
12. 清洗含 NUL 剥离咽喉点；内容寻址唯一约束覆盖软删行（D1-L4/L6）。
13. 降级矩阵：embedding 故障退关键词并显式标注；上游故障映射 502 与自身 bug 区分（D3-L9、D5-L4）。
14. A/B 会话粘性分桶+最小样本+变异界+多样性护栏；LLM 判分设容差带，判分失败≠零分（D5-L2/L3）。
15. 派生态以权威事实表幂等 reconcile；取消态不作结论（D5-L9）。
16. 部署侧扩展（pgvector/PostGIS）启动自检+迁移前置（D2-L8）。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 目标云不支持 pg_textsearch（AWS/Azure） | ADR-0002 兜底：ts_rank 粗召回+SQL 侧 BM25 重算，M2 外置 OpenSearch；接口已抽象 |
| 登录客户 IdP 对接形态未知（SSO/自建） | P4-4 预留双入口（OIDC 兑换 + 自建会话）；M2 前与产品侧确认 |
| geo 场景数据量与查询形态不确定 | P2-5 先以单产品域网点/区域政策小集试点，再决定 H3 分析列深度 |
| 蓝绿双写复杂度超预期 | M1 已用原子换版兜底；index_ver 蓝绿可降档为「重建+影子比对+切换」 |
| 评测集冷启动 | golden set v0 由存量帮助中心 FAQ 抽取+人工标注 ≥50 题/域；线上回流持续扩充 |
| 单库 QPS 天花板 | SLI 容量演练（P0-6）+ 演进边界预案（方案 §6） |

## 12. Next Actions（两周内可开工）

1. P0-1/P0-2/P0-3：仓库骨架、鉴权默认 strict+覆盖门、迁移与扩展自检（可立即开工）。
2. P1-1 数据模型按 [ADR-0001](./knowledge-base-platform-adr-0001-data-model.md) 开工（version_key 含 document_id+产品域+ACL、确定性 chunk_id、文档粒度原子换版）。
3. 确认目标云：按 [ADR-0002](./knowledge-base-platform-adr-0002-bm25-engine.md)（pg_textsearch 主选、OpenSearch 扩容），M1 关键字路一律以 ts_rank 兜底起步（P2-1，明示非 BM25），目标云决定 M2 P2-4 真 BM25 落地形态（Google Cloud 直接集成 pg_textsearch；AWS/Azure 走兜底重算并外置 OpenSearch）。
4. 与产品侧确认 M2 的 IdP 对接形态与首个多产品试点域。
