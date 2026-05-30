# Knowledge Map（知识索引）

> 项目内文档与关键能力索引；按主题正交分组，链接为相对路径以便跨上下文跳转。
> 新增/变更文档时应即时同步本表。

## 协同协议与规范

- [Agent 协作协议（CLAUDE.md / AGENTS.md）](../../AGENTS.md) — 项目根工程行为准则
- [浏览器验证协议](./browser-validation.md) — Chrome devtools 实机验证规范
- [引用规范 (IEEE)](./reference-specifications.md) — 决策引用与文献格式

## 工程经验沉淀

- [Issues 摘要](issue.md) — 历次问题表因 / 根因 / 处理 / 防范的跨上下文留存
- [PDF 一比一还原质量迭代](pdf-harness-engineering-parity.md) — 学术 PDF → Markdown 端到端保真度提升记录（断字 / 公式 / 标题 / TOC / 图片孤儿）
- [Development（开发指南）](../concepts/development.md) — 环境搭建、开发工作流、数据库迁移、前后端对接

## 系统概念与设计

- [Framework（系统框架）](../concepts/framework.md)
- [Conversation Foundation（对话基础）](../concepts/conversation-foundation.md)
- [A2UI（Agent-to-UI 协议）](../concepts/a2ui.md)
- [SSO（单点登录设计）](../concepts/design/sso.md)
- [Observability / GenAI 可观测性](../concepts/design/observability-genai.md)
- [QA Delivery Pipeline](../concepts/design/qa-delivery-pipeline.md)

## 系统能力概览

- [Memory（记忆系统）](../concepts/025-the-memory-system.md) · [白皮书](../concepts/026-memory-whitepaper.md)
- [Knowledge Base（知识库设计）](../concepts/035-the-knowledge-base.md)
- [Knowledge Graph（知识图谱）](../concepts/036-the-knowledge-graph.md) · [联邦知识图谱 + 跨 Corpus 混合检索](../concepts/037-federated-kg.md)
- [Claude Code 集成（BuiltinTool）](../concepts/038-claude-code-integration.md) — Claude Code CLI 作为 ADK Agent 工具的接入方案
- [Routine（长周期自主任务）](../concepts/039-the-routine-system.md) — Engine 编排 + Claude Code 执行的 Evaluator-Optimizer 自迭代闭环（含 Reflexion 反思记忆、LLM-as-Judge 评估、审批门控、停止护栏）
- [Skills](../concepts/design/skills.md)
- [Negentropy Wiki Ops](../reference/wiki/ops.md)
- [Wiki 知识图谱（按 Publication 切片发布）](../reference/wiki/design/knowledge-graph.md)
- [Agents at Wiki —— 浏览器回归验证报告](../reference/wiki/reports/agents-validation.md) — 一主五翼 6 Agents 嵌入 wiki 的端到端验证
- [Engineering Changelog](../concepts/engineering-changelog.md)

## 概念层（Concepts）

- [Cognizes Engine 总览](../reference/cognizes/engine/README.md) — Agentic AI Engine 一核五翼架构入口
- [P1 The Pulse](../reference/cognizes/engine/010-the-pulse.md) · [P2 The Hippocampus](../reference/cognizes/engine/020-the-hippocampus.md) · [P3 The Perception](../reference/cognizes/engine/030-the-perception.md) · [P4 The Realm of Mind](../reference/cognizes/engine/040-the-realm-of-mind.md) · [P5 Integrated Demo](../reference/cognizes/engine/050-integrated-demo.md)
- 子系统专项：[025 Memory System](../concepts/025-the-memory-system.md) · [026 Memory Whitepaper](../concepts/026-memory-whitepaper.md) · [035 Knowledge Base](../concepts/035-the-knowledge-base.md) · [036 Knowledge Graph](../concepts/036-the-knowledge-graph.md) · [037 Federated KG](../concepts/037-federated-kg.md)
- 参考 DDL：[`reference/cognizes/engine/schema/`](../reference/cognizes/engine/schema/)（hippocampus / perception / kg_schema_extension）

## 项目级 PRD / Plan / Checklist

- [PRD & Architecture](../reference/cognizes/000-prd-architecture.md) — Agentic AI 学术研究与工程应用平台 产品需求与架构
- [Implementation Plan](../reference/cognizes/001-implementation-plan.md) — 实施计划
- [Task Checklist](../reference/cognizes/002-task-checklist.md) — 任务执行清单

## 研究文献 / Research

- [Research（研究文献索引）](../research/) — 认知增强、上下文工程、Agent runtime、向量检索、知识图谱、Agent Sandbox 等领域基线调研
- [ADK 2.0 升级调研](../research/020b-adk-2.0-upgrade.md) — Google ADK 2.0 核心新特性、Breaking Changes、本项目影响评估与渐进式升级路径
- [Routine Agent 迭代模式调研](../research/110-routine-agent-iteration.md) — ReAct/Reflexion/Self-Refine/LATS/Voyager + LLM-as-Judge + Claude Code/Codex/Gemini/OpenHands 工程实践与停止护栏（长周期自主任务理论基础）

## 用户文档与运维

- [User Guide（用户指南）](../user-guide.md)
- [Admin（管理后台）](../concepts/user-guide/admin.md)
- [Knowledges（知识库引用）](../concepts/035-the-knowledge-base.md)

## 关键基础设施

- **模型解析（Single Source of Truth）**：`apps/negentropy/src/negentropy/config/model_resolver.py`
  - 全局默认 / by_id / by_model_name / **by_task** / SubAgent 五条解析路径
  - 缓存键命名空间：`llm` / `embedding` / `llm:<id>` / `subagent:<name>` / `task:<llm|embedding>:<corpus_id|'_'>:<task_key>`
- **任务 → 模型映射注册表**：`apps/negentropy/src/negentropy/config/task_registry.py`（参见 ISSUE-087）
- **后台 LLM 调用点列表**：见 ISSUE-087 处理方式第 4 项
- **Interface / Models 页**：`apps/negentropy-ui/app/interface/models/page.tsx`
- **Interface / Task Models 页**：`apps/negentropy-ui/app/interface/task-models/page.tsx`
- **Corpus Model Config Panel**（含 per-corpus task overrides）：`apps/negentropy-ui/app/knowledge/graph/_components/ModelConfigPanel.tsx`

## 跨语言通用约定

- Python：`uv` 管理依赖与运行（禁用 pip / poetry）
- JS/TS：`pnpm` 管理依赖与运行（禁用 npm / yarn）
- Git 提交：使用 Claude Code `/commit` slash command，严禁 rebase；分支命名见 AGENTS.md
- 数据库迁移：使用 alembic，严禁清理数据；新增表使用偏唯一索引覆盖 PG 复合主键 NULL 语义（参考 `0032_task_model_settings.py`）

- [RFC 0001：会话架构重塑](../concepts/0001-conversation-architecture-refactor.md) · [RFC 0002：UI 交互增强](../concepts/0002-ui-interaction-enhancements.md) — 设计提案与决策记录
- `docs/reference/cognizes/engine/schema/` — 数据 schema 参考 DDL（Knowledge / Memory / KG）
