---
sidebar_position: 14
title: "KBP ADR-0002：真 BM25 关键字检索选型——许可与托管可用性评估"
id: knowledge-base-platform-adr-0002-bm25-engine
last_update:
  author: Aurelius Huang
tags:
  - Knowledge Base
  - ADR
  - BM25
  - License
---

# KBP ADR-0002：真 BM25 关键字检索选型——许可与托管可用性评估

| 字段 | 值 |
|---|---|
| 状态 | Accepted（2026-11-02，按评估建议定稿；许可结论为工程视角评估，商用前需法务确认） |
| 范围 | 《[知识库平台技术方案](./knowledge-base-platform.md)》§3.1 单库现实与 §6 推荐起步组合；《[M1–M3 实施计划](./knowledge-base-platform-implementation.md)》P2-4 |
| 取证 | 三路并行取证（PG 内扩展 / 外置引擎 / AGPL 义务边界）+ 逐路对抗核验：66 项核验 50 confirmed / 11 corrected / 0 removed；许可证取自官方仓库 LICENSE 或源码文件头，托管可用性取自云厂商扩展清单（访问日期 2026-11-02） |

## 1. 问题

方案起步组合是 PostgreSQL 一库四路，但 PG 原生 `ts_rank`/`ts_rank_cd` 官方明言「不使用任何全局信息」，即没有 IDF，不是 BM25。方案原先的补法是 ParadeDB `pg_search`，并标注「AGPL 需法务评估、托管支持不稳」。本 ADR 回答：真 BM25 用什么实现，许可与托管能否走通。

## 2. 结论（先行）

1. **主选：`pg_textsearch`（Tiger Data / Timescale）**——PostgreSQL License（宽松许可、无商业版分叉），真 BM25（带 IDF、TF 饱和与长度归一，Block-Max WAND），k1/b 按索引可调；已进入 Google Cloud SQL 与 AlloyDB（均建议按 Preview 对待），PG17/18。许可风险在全部候选中最低，且保留「一库四路」单库架构。
2. **扩容/升级路线：OpenSearch（Apache-2.0，Linux Foundation 治理）**——需要原生 BM25F（`combined_fields`，3.2 起）、成熟中文分词（AWS 托管提供 IK / smartcn / HanLP 插件）或检索面独立扩容时外置。与方案 §6 的演进边界一致，接口经仓储层抽象即可受控迁移。
3. **不采用 ParadeDB `pg_search` Community 作生产主选**——许可本身未修改使用无源码义务，但三条工程硬伤叠加：① 主流托管 PG 七家全部不可安装（Neon 2026-03-19 弃用、2026-09-21 从存量移除）；② Community 版 BM25 索引**不做物理复制**，只读副本与 HA 需 Enterprise 商业许可；③ AGPL 对私有化交付（分发）与企业客户合规政策不友好。
4. **兜底路径**：托管环境不支持任何 BM25 扩展时，保留 `ts_rank` 粗召回 + 应用层/SQL 侧按 BM25 公式重算（自维护 df/文档长度统计表），以评测集对照 Lucene 基线验证正确性。

## 3. 候选对比

| 候选 | 许可 | 真 BM25 | BM25F | 中文 | 主流托管可用性（2026-11-02） | 成熟度 |
|---|---|---|---|---|---|---|
| **pg_textsearch** | PostgreSQL License | ✓ k1 0.1–10 / b 0–1，按索引 | ✗（多列拼表达式或多索引应用融合） | 复用 PG text search config，配 zhparser（v1.4.0 起） | Cloud SQL ✓（PG17+，需 flag）· AlloyDB ✓ Preview · RDS/Aurora ✗ · Azure Flexible ✗（官方答复未在路线图）· Neon ✗ · Supabase ✗ | v1.0 GA 2026-03-27，v1.5.1 2026-10-02（修复并发损坏），~4.0k stars |
| ParadeDB pg_search | **AGPL-3.0-or-later**（源码文件头）/ Enterprise 商业 | ✓ Tantivy，k1/b 按字段 | ≈（查询级 boost 拆子查询相加） | Jieba / Lindera / ICU | 七家全部 ✗；仅自托管 / ParadeDB Cloud（private preview）/ 托管主库逻辑复制到自建节点（PG17+） | v0.26.4（2026-10-29），~9.5k stars；Community 无索引复制 |
| VectorChord-bm25 | AGPLv3 或 ELv2 二选一 | ✓ Block-WeakAnd | ✗ | jieba 预分词（README：仅测过英文） | 七家全部 ✗ | 0.3.0（2025-12-15），主仓约 6 个月无提交，仓库迁移至个人账号，维护前景不确定 |
| pgx-bm25 | PostgreSQL License | ✓ | ✓ 原生多列 | ✗（仅 Snowball english） | 七家全部 ✗ | v1.0.0 2026-10-06，极新，无生产证据 |
| lakebase_text | 未公开（专有托管组件） | ✓ | — | 内置 | 仅 Neon / Databricks Lakebase | 0.1.x，供应商锁定最强 |
| **OpenSearch** | **Apache-2.0**（LF 基金会） | ✓ k1/b/discount_overlaps，按字段 | ✓ `combined_fields`（3.2 起） | AWS 托管提供 IK / smartcn / HanLP / Pinyin / ICU | Amazon OpenSearch Service（3.x）+ 自托管 | 3.9.0（2026-09-29），~13.9k stars |
| Elasticsearch | AGPL-3.0 / SSPL / ELv2 三选一（源码）；x-pack 仅 ELv2 | ✓ | ≈（`combined_fields` 官方称近似） | 插件生态 | Elastic Cloud；上传自定义插件（IK/jieba）需 Gold 及以上订阅 | 9.5.x，~78.5k stars |
| Vespa | Apache-2.0 | ✓ rank feature `bm25(field)` | — | OpenNLP/Lucene linguistics | Vespa Cloud（AWS/GCP prod） | 近乎每日发版 |
| Meilisearch / Typesense | MIT+BUSL-1.1 / GPL-3.0 | **✗（无 IDF，启发式排序）** | ✗ | — | 各自 Cloud | 不满足「真 BM25」要求，排除 |
| Tantivy / Quickwit（库/引擎） | MIT / Apache-2.0 | ✓ 但 **k1/b 硬编码** | ✗ | 字级切分 | 无托管 | 调参需 fork，排除作主选 |

## 4. AGPL 义务边界（ParadeDB 等 AGPL 组件的参考结论，非法律意见）

| 情形 | 义务 | 确定性 |
|---|---|---|
| A 未修改使用（自运维 PG 加载原版扩展，仅作 SaaS 后端） | 对扩展本身无源码提供义务（§2 明确授权运行未修改程序）；应用经 SQL 访问不受传染 | 前半为官方明文；「不传染」为普遍解读（FSF 承认最终由法院判断） |
| B 修改后使用（fork/patch 扩展，如改打分、加分词器） | §13：须向通过网络交互的用户提供修改版源码；义务范围限于修改版扩展及其依赖 | 义务本身为官方明文；「应用中转访问是否构成交互」存疑、无判例 |
| C 分发（私有化部署包/镜像/一体机含扩展） | §4–§6：附许可证全文并提供对应源码，修改与否都一样 | 官方明文 |

叠加约束：多家企业政策直接禁用 AGPL（例：Google 政策原文 "Code licensed under the GNU Affero General Public License (AGPL) MUST NOT be used at Google"；Apache 基金会将 AGPL 列入 Category X）。平台若有私有化交付或大客户采购场景，AGPL 组件会成为商务阻碍——这是不选 pg_search 作主选的主要原因之一，而非 SaaS 部署本身的源码义务。

## 5. 决策后果与落地

- **方案联动**：方案 §3.1「单库起步现实」与 §6「推荐起步组合」中「pg_search 类扩展补真 BM25」改为「pg_textsearch（PostgreSQL License）补真 BM25，AGPL 类扩展不作主选」；实施计划 P2-4 改为「pg_textsearch 集成 + 托管兼容性验证（目标云为 Google Cloud 时直接可用；AWS/Azure 部署走 OpenSearch 外置或兜底路径）」。
- **部署约束**：pg_textsearch 要求 PG17/18 且需 `shared_preload_libraries`（托管侧为 flag），M1 基线 PG 版本据此定为 **PG17+**。
- **已知限制须进测试**（取自官方 README Limitations）：① 语料统计包含 RLS 隐藏的行——多租户共享表时 IDF 会跨租户泄漏统计信息（不泄漏内容），须评估是否按产品域分区/分索引；② 分区表的 IDF 按分区各自计算；③ 刚建索引时不支持 2PC。第 ① 条与方案 §5.3 的 RLS 兜底直接相关，列入 M2 泄漏回归矩阵。
- **云厂商分岔**：目标云若为 AWS 或 Azure，pg_textsearch 当前不可用——此时 M1 关键字路先走兜底路径（`ts_rank` 粗召回 + SQL 侧 BM25 重算），M2 起外置 OpenSearch（Amazon OpenSearch Service 原生提供中文插件）。
- **重评触发器**：Cloud SQL/AlloyDB 上 pg_textsearch 转 GA，或 RDS/Azure 加入支持；pg_textsearch 出现新的数据损坏类缺陷；OpenSearch BM25F 或中文插件托管策略变化。

## 6. 依据

许可证与托管可用性的逐项取证 URL（含访问日期 2026-11-02）随本 ADR 一并入库：[`knowledge-base-platform-adr-0002-evidence.json`](./knowledge-base-platform-adr-0002-evidence.json)。关键源包括：pg_textsearch LICENSE 与 README Limitations、Cloud SQL / AlloyDB 文档与 release notes、ParadeDB 部署文档（Enterprise / 逻辑复制）、Neon pg_search 弃用页、OpenSearch `combined_fields` 文档与 Amazon OpenSearch Service 插件表、Elastic 许可 FAQ、FSF AGPL FAQ。
