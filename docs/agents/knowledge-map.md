# Knowledge Map（知识索引）

> 项目内文档与关键能力索引；按主题正交分组，链接为相对路径以便跨上下文跳转。
> 新增/变更文档时应即时同步本表。

## 协同协议与规范

- [Agent 协作协议（CLAUDE.md / AGENTS.md）](../../AGENTS.md) — 项目根工程行为准则
- [浏览器验证协议](./browser-validation.md) — Chrome devtools 实机验证规范
- [引用规范 (IEEE)](./reference-specifications.md) — 决策引用与文献格式

## 工程经验沉淀

- [Issues 摘要](issue.md) — 历次问题表因 / 根因 / 处理 / 防范的跨上下文留存

## 系统架构与设计

- [Framework（系统框架）](../architecture/framework.md)
- [Development（开发指南）](../architecture/development.md)
- [Conversation Foundation（对话基础）](../architecture/conversation-foundation.md)
- [A2UI（Agent-to-UI 协议）](../architecture/a2ui.md)

## 系统能力概览

- [Memory（记忆系统）](../concepts/025-the-memory-system.md) · [白皮书](../concepts/026-memory-whitepaper.md)
- [Knowledge Base（知识库设计）](../concepts/035-the-knowledge-base.md)
- [Knowledge Graph（知识图谱）](../concepts/036-the-knowledge-graph.md) · [联邦知识图谱 + 跨 Corpus 混合检索](../concepts/037-federated-kg.md)
- [Skills](../core/design/skills.md)
- [Negentropy Wiki Ops](../wiki/ops.md)
- [Wiki 知识图谱（按 Publication 切片发布）](../wiki/design/knowledge-graph.md)
- [Agents at Wiki —— 浏览器回归验证报告](../wiki/reports/agents-validation.md) — 一主五翼 6 Agents 嵌入 wiki 的端到端验证
- [Engineering Changelog](../core/engineering-changelog.md)

## 概念层（Concepts）

- [Cognizes Engine 总览](../concepts/README.md) — Agentic AI Engine 一核五翼架构入口
- [P1 The Pulse](../concepts/010-the-pulse.md) · [P2 The Hippocampus](../concepts/020-the-hippocampus.md) · [P3 The Perception](../concepts/030-the-perception.md) · [P4 The Realm of Mind](../concepts/040-the-realm-of-mind.md) · [P5 Integrated Demo](../concepts/050-integrated-demo.md)
- 子系统专项：[025 Memory System](../concepts/025-the-memory-system.md) · [026 Memory Whitepaper](../concepts/026-memory-whitepaper.md) · [035 Knowledge Base](../concepts/035-the-knowledge-base.md) · [036 Knowledge Graph](../concepts/036-the-knowledge-graph.md) · [037 Federated KG](../concepts/037-federated-kg.md)
- 参考 DDL：[`concepts/schema/`](../concepts/schema/)（hippocampus / perception / kg_schema_extension）

## 研究文献 / Research

- [Research（研究文献索引）](../research/) — 认知增强、上下文工程、Agent runtime、向量检索、知识图谱、Agent Sandbox 等领域基线调研

## 用户文档与运维

- [User Guide（用户指南）](../user-guide.md)
- [Knowledges（知识库引用）](../concepts/035-the-knowledge-base.md)
- [SSO 配置](../infrastructure/design/sso.md)
- [Observability / GenAI 可观测性](../infrastructure/design/observability-genai.md)
- [QA Delivery Pipeline](../infrastructure/design/qa-delivery-pipeline.md)

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

## RFC / Architecture（链接结构占位）

- `docs/rfcs/` — 设计提案与决策记录
- `docs/concepts/schema/` — 数据 schema 参考 DDL（Knowledge / Memory / KG）
