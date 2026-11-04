---
sidebar_position: 13
title: "KBP ADR-0001：核心数据模型——version_key、确定性 chunk_id 与原子换版"
id: knowledge-base-platform-adr-0001-data-model
last_update:
  author: Aurelius Huang
tags:
  - Knowledge Base
  - ADR
  - Data Model
---

# KBP ADR-0001：核心数据模型——version_key、确定性 chunk_id 与原子换版

| 字段 | 值 |
|---|---|
| 状态 | Accepted（2026-11-02，按评估建议定稿） |
| 范围 | 《[知识库平台技术方案](./knowledge-base-platform.md)》§1 数据模型；《[M1–M3 实施计划](./knowledge-base-platform-implementation.md)》P1-1 / P2-2 / P2-3 / P2-8（图文混合索引） |
| 证据 | 《[差距分析](./knowledge-base-platform-gap-analysis.md)》D1-C5/C9、D1-L2/L3/L4、D2-L4/L5 |

## 1. 背景

数据模型是 M1 关键路径的首个一次性设计决策，决定后续同步、索引、权限与回滚能否正确实现。差距分析在 Negentropy 上确证了三类由模型缺陷连锁引发的生产问题，是本 ADR 的直接输入：

1. **幂等锚可变**：以 `source_uri` 作幂等锚，存储迁移（`gs://`→`pgblob://`）后同一 PDF 在 live 库出现两份完整 chunk 集（D2-L5）。
2. **chunk 身份随整源替换再生**：重同步后 KG 增量水位按旧 chunk id 判定失效、触发全量重抽；反馈表外键级联使历史反馈随替换蒸发（D1-L3）。
3. **无版本实体**：正文原地覆写，本地编辑被下次同步静默删除，回滚无据可依（D1-C9）。

## 2. 决策

### D1 version_key：内容寻址 + 文档绑定

```text
version_key = sha256( document_id ‖ canonical_text ‖ media_manifest_hash ‖ source_metadata_canonical_json ‖ sorted(product_ids) ‖ acl_canonical_json )
```

- **纳入 `document_id`**：杜绝两篇内容相同但归属/权限不同的文档撞键。
- **纳入 `product_ids` 与 `acl`**：产品域或权限单独变化也产生新版本，使版本成为可见性的唯一事实源；回滚与重放天然携带当时的权限。
- **纳入 `media_manifest_hash`**（M2 图文混合索引，P2-8）：canonical 内容 = 清洗正文 + 媒体资产清单（每图内容哈希及其 alt/邻接语境锚）的哈希——图片单独替换也产新版本；媒体不入键则「未变即短路」会吞掉换图，图片 chunk/caption/跨模态向量永不重建，版本库 SSOT 对图片内容失效。
- **`source_metadata` 只含源侧元数据**：LLM 抽取的元数据不进键，避免「算键先要抽取、抽取缓存又以键为键」的循环依赖。
- **规范化**：JSON 键排序、Unicode NFC、行尾统一 `\n`、NUL 剥离（D1-L6）——保证同内容跨通道得到同键。
- **未变即短路**：新到内容算出的 `version_key` 与当前版本相同，则跳过下游全链（解析之后的分块/嵌入/索引全部不跑）；正文与媒体任一变化即键变、不短路。

### D2 DocumentVersion：不可变，Document 为当前版投影

- `DocumentVersion` 一经写入不可更新；`Document.current_version_id` 指向当前版，`Document.product_ids` 等字段是当前版的**投影**（读优化），写路径只写版本表、投影由同事务更新。
- 唯一约束：`UNIQUE (document_id, version_key)`；**软删行同样参与唯一性**，同内容重传走「复活」路径而非撞键报错（D1-L4）。
- 版本保留策略与清理分两层：业务层永不物理删版本；合规擦除走加密粉碎例外路径（方案 §2.2）。

### D3 确定性 chunk_id

```text
chunk_id = uuid5( NAMESPACE_KBP, document_id ‖ text_hash ‖ ordinal_within_document )
text_hash = sha256( chunk_canonical_text )
```

- 同一文档、同一文本、同一位置的 chunk 跨版本保持同一 id——下游水位（KG 增量、反馈、缓存）不随重同步失效。
- **图片 chunk（M2，P2-8）**：`text_hash = sha256( image_hash ‖ alt ‖ 邻接语境 )`——同图异语境（不同 alt/邻接文本）得到不同 chunk 身份；caption 与跨模态嵌入等 VLM 派生物按方案不变量①以 (hash(图片哈希+alt+邻接语境+源侧 metadata), pipeline_ver) 缓存，防同图异语境陈旧命中。
- **`ordinal` 纳入**：同文档内重复段落（如每章重复的免责声明）得到不同 id。
- **embedding 复用**：`text_hash` 命中即复用已有向量（向量侧表键为 `(chunk_id, model_version)`），只对变更块重嵌。
- **外键策略**：反馈、引用等下游表引用 `chunk_id` 时用 `ON DELETE SET NULL` + 保留 `text_hash` 冗余列，而不是 `CASCADE`——chunk 被替换时历史反馈留存可追溯。

### D4 写入：文档粒度同事务原子换版

```sql
BEGIN;
  INSERT INTO document_versions (...) VALUES (...);          -- 新版本
  DELETE FROM chunks WHERE document_id = :doc;              -- 旧派生物
  INSERT INTO chunks (...) VALUES (...), (...);             -- 新派生物（嵌入已在事务外算好）
  UPDATE documents SET current_version_id = :v, ... WHERE id = :doc;
COMMIT;
```

- 嵌入计算在事务**外**完成（避免长事务），事务内只做写入；MVCC 保证并发读者只见整旧或整新（D2-L4）。
- 这是 M1 的蓝绿起步档；M2 引入 `index_ver` 双写时，本流程变为「写入新 index_ver」，接口不变。
- **幂等锚**：`(document_id, version_key)`——不可变标识；`source_uri` 只作溯源属性，变更时不影响幂等（D2-L5）。

## 3. 备选方案与否决理由

| 方案 | 否决理由 |
|---|---|
| 幂等锚用 `source_uri` | 可变；存储迁移即双份摄取（Negentropy 实证） |
| chunk_id 用随机 UUID | 重同步改 id，下游水位与外键连锁失效（Negentropy 实证） |
| version_key 只含正文 | ACL/产品域变更无版本，ACL 出现多处真源；跨文档同内容撞键 |
| version_key 不含媒体清单哈希 | 图片替换被「未变即短路」吞掉，图片 chunk/caption/向量永不重建——版本库 SSOT 对图片内容失效（M2 图文引入前的盲点，评审补入） |
| version_key 含 LLM 抽取元数据 | 与 LLM 派生物缓存键循环依赖；LLM 非确定导致同内容不同键 |
| 原地更新 + 审计日志代替版本表 | 回滚需逆向重放日志，且无法对历史版本重建索引 |

## 4. 后果

- **正面**：重同步零成本（未变短路）；下游水位稳定；回滚与重放携带当时权限；幂等对存储迁移免疫。
- **代价**：版本表随编辑增长（可接受，按文档保留策略归档）；`version_key` 规范化逻辑须单点实现并有跨通道一致性测试。
- **验证（M1 退出门的组成部分）**：① 同内容经 upload 与连接器两通道得到同一 `version_key`；② 重同步未变文档时下游零写入；③ 并发读在换版期间无「半旧半新」结果；④ ACL 单独变更产生新版本且旧版本仍可按其 ACL 重放；⑤ 图片单独替换产生新版本并触发该图 chunk/caption/跨模态向量重建（M2 P2-8 落地后纳入退出门）。
