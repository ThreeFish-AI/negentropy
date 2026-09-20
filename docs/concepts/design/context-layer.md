---
sidebar_position: 10
title: "Context Layer · 上下文治理层技术方案（实施入口页）"
---
# Context Layer · 上下文治理层技术方案（实施入口页）

> **状态声明（2026-09-20）**：本方案的设计正文已**全量并入** [Context Layer 技术蓝图与方案](../../research/cognitive-context/013-context-layer-blueprint.md)（013 自此为 Context Layer 知识与设计的**单一事实源**——机制原理 M1–M7 × 五正交层通用蓝图 × 本方案全部设计内容 × 证据与边界 × 双轨演进路线）。本页保留为 concepts/design 的**实施入口**：定位声明、章节指针与实施状态跟踪。
>
> 设计核心锚定：
> - **全量蓝图（设计 SSOT）**：[013 · Context Layer 技术蓝图与方案](../../research/cognitive-context/013-context-layer-blueprint.md)
> - **精读过程档案（冻结）**：[Horizon Context 精读笔记](../../research/cognitive-context/011-horizon-context.md)
> - **锚点核验快照**：[Horizon Context ↔ negentropy 机制映射报告](../../research/cognitive-context/012-horizon-context-mapping-negentropy.md)
> - **理论基线**：[Context Engineering 通俗全解](../../research/cognitive-context/010-context-engineering.md)（Collect / Management / Usage 三段论）
> - **架构上下文**：[系统框架 · 一核五翼](../framework.md) · [自进化 Agents Team 方案](./self-evolving-agents.md) · [Skills 设计](./skills.md)

---

## 0. 范围与定位（保留声明）

> **核心论断**：不"从零造一个上下文引擎"，而是"把已有的上下文子系统收敛到一个治理织物（Context Fabric）之下"。

Negentropy 的「一核五翼」智能体效能**完全取决于上下文质量**——系统提示、记忆、知识、工具、技能、会话状态。这些信号已经分散在多个子系统并被各自组装，但**缺少一个统一的治理与编排层**来汇聚、富化、治理并按需激活。Context Layer 正是这一层：它对标 Snowflake Horizon Context「让 AI Agent 基于受治理、可信、一致的定义推理，而非从原始数据猜测」的设计哲学，以**横向治理织物**的身份横亘在 Agent Runtime 与 Memory / KB / KG / Tools / Skills 之上。

范围外：模型权重训练/微调；重写既有检索/巩固管线；新建外部存储后端。所有规划改动均为 **additive + 特性开关 + fail-soft**，不破坏现有功能。

## 1. 章节指针表（原方案 → 013 蓝图）

| 原方案章节                  | 内容要点                                                 | 现位于 013                                                          |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| §0 范围与定位               | 治理织物定位、设计对象「是/不是」表                       | [§1 术语与范围](../../research/cognitive-context/013-context-layer-blueprint.md)（通用列×实例列并轨） |
| §1 理论锚点与对标           | Horizon 三阶段流水线、四层信号、学术锚点                 | §3.4（三相×四信号对齐）· §1（理论骨架）                              |
| §2 现状盘点                 | 请求期注入链、9 路上下文来源、三大结构性缺口              | §12.1（锚点经 2026-09-20 重校）                                      |
| §3 架构总览                 | 三相 × 四信号层映射、四信号本仓来源表                    | §12.2 · §3.4                                                         |
| §4 Context Catalog          | ADR-1（VIEW 非新表）、三视图、信任归一公式                | §5.3（目录层实例化，含三纪律）                                        |
| §5 统一激活架构             | ADR-2/3、双通道统一、`_collect_kb_grounding`、ContextGuard | §8.5（激活层实例化）· §7.7（守卫）                                   |
| §6 子系统上下文契约         | Memory/KB/KG/Tools/Skills 五契约表                       | §12.3                                                                |
| §7 进化集成                 | `context_strategy` 第 7 杠杆、信任反馈闭环               | §12.5                                                                |
| §8 演进路线                 | Phase 1–3 施工明细                                       | §16（与独立部署 P0–P3 双轨对齐）                                     |
| §9 风险与对策               | TTL 一致性、回退绕过、token 预算、进化交互、延迟          | §12.6                                                                |
| §10 与既有架构的自洽性      | 一核五翼/自进化四层/三层披露/AG-UI 四条                   | §12.6                                                                |

## 2. 实施状态（核验 2026-09-20）

**Phase 1–3 均为方案未落地（🔶）**——`engine/context/`（trust/router/guard）目录不存在，迁移目录无三视图 CREATE VIEW，进化 handlers 现仅 6 个 target_kind（无 `context_strategy`），`HybridPlanner` 零 memory 引用。已落地基线（✅ 锚点实测）：definitions registry（4 类 SSOT + 422 校验门 + harness_materializer）、检索层 `scoped & accessible` 过滤（unified_search.py:100 强制交集）、三层渐进披露（skills_injector.py:342）、patrol/Judge 巡检闭环。完整 16 条机制映射状态总表与能力×轨道对齐矩阵见 013 §12.7 / §16。

## 3. 维护注记

- **设计变更一律改 013**；本页只回填「本仓实施进度」（§2）与指针维护。
- 011 精读笔记冻结为过程档案；012 为 2026-09-17 锚点核验快照，再核验直接更新 013 §12 并刷新日期。
- 本方案涉及的图表资产（request-injection / runtime-layering / auto-channel / assembler-planner / evolution-levers）已由 013 相应章节引用，图源登记见 [mermaid README](../../assets/mermaid/README.md)。
