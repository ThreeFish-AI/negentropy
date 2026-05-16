# Knowledge Map（知识索引）

> 项目内文档与关键能力索引；按主题正交分组，链接为相对路径以便跨上下文跳转。
> 新增/变更文档时应即时同步本表。

## 协同协议与规范

- [Agent 协作协议（CLAUDE.md / AGENTS.md）](../../AGENTS.md) — 项目根工程行为准则
- [浏览器验证协议](./browser-validation.md) — Chrome devtools 实机验证规范
- [引用规范 (IEEE)](./reference-specifications.md) — 决策引用与文献格式

## 工程经验沉淀

- [Issues 摘要](issue.md) — 历次问题表因 / 根因 / 处理 / 防范的跨上下文留存

## 系统能力概览

- [Conversation Foundation（对话基础）](../conversation-foundation.md)
- [Memory（记忆系统）](../memory.md) · [白皮书](../memory-whitepaper.md)
- [Knowledge Graph（知识图谱）](../knowledge-graph.md)
- [Skills](../skills.md)
- [Negentropy Wiki Ops](../negentropy-wiki-ops.md)
- [Engineering Changelog](../engineering-changelog.md)

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
- `docs/schema/` — 数据 schema 规范
