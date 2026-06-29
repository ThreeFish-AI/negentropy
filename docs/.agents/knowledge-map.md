# Knowledge Map（知识索引）

> 项目内文档与关键能力索引；按主题正交分组，链接为相对路径以便跨上下文跳转。
> 新增/变更文档时应即时同步本表。

## 协同协议与规范

- [Agent 协作协议（CLAUDE.md / AGENTS.md）](../../AGENTS.md) — 项目根工程行为准则
- [浏览器验证协议](./browser-validation.md) — 浏览器实机验证规范（A 类 claude-in-chrome 交互 / B 类系统默认 Playwright MCP 自治）
- [引用规范 (IEEE)](./reference-specifications.md) — 决策引用与文献格式
- [Wiki 文档排序元数据规范](./wiki-docs-ordering.md) — `sidebar_position`（文件 frontmatter）+ `_category_.json`（目录）驱动 docs/ → wiki 导航排序

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
- [Docker Release Pipeline](../concepts/design/docker-release-pipeline.md) — compose 栈 4 镜像（backend / perceives / ui / wiki）的多架构构建与 Docker Hub 发布：PR 构建校验 + tag 发布双入口，amd64+arm64 原生 runner + digest 合并 + provenance/SBOM
- [Docker Compose 运维指引](../concepts/docker-operations.md) — compose 栈 5 服务的部署、日常操作、开发工作流与故障排查：首次部署、首次发布、版本管理、健康检查、日志查看、卷备份、常见故障排除
- [浏览器操作 MCP 集成方案](../concepts/design/browser-automation-mcp-integration.md) — Playwright MCP 全系统默认配备：单一注入点（builtin_tools.mcp_config）provision 至 Routine / Scheduler / 6 Agents，用于浏览器实机回归验证
- [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) — 四层自进化架构（固定框架 Meta-Layer / 动态 Agent 定义 / 外部能力工具 / 记忆与知识系统）：遥测→评测→提案→验证→门控发布全闭环，含 agent_versions 版本化、GEPA/ACE 进化算子、记忆/知识配置进化回路（基质/客体分轨 ADR-4）、Golden Set 双轨评测、金丝雀发布、护栏决策矩阵与四阶段演进路线（调研基础见 [130 号调研](../research/130-self-evolving-agents-team.md)）

## 系统能力概览

- [Memory（记忆系统）](../concepts/025-the-memory-system.md) · [白皮书](../concepts/026-memory-whitepaper.md)
- [Knowledge Base（知识库设计）](../concepts/035-the-knowledge-base.md)
- [Knowledge Graph（知识图谱）](../concepts/036-the-knowledge-graph.md) · [联邦知识图谱 + 跨 Corpus 混合检索](../concepts/037-federated-kg.md)
- [Claude Code 集成（BuiltinTool）](../concepts/038-claude-code-integration.md) — Claude Code CLI 作为 ADK Agent 工具的接入方案
- [Routine（长周期自主任务）](../concepts/039-the-routine-system.md) — Engine 编排 + Claude Code 执行的 Evaluator-Optimizer 自迭代闭环（含 Reflexion 反思记忆、LLM-as-Judge 评估、审批门控、停止护栏） · [预设模版](../concepts/user-guide/routine-presets.md) — 4 个开箱即用的场景模版（代码审计 / 测试增强 / 文档生成 / 架构清减），正交覆盖全部核心功能
- [Routine 多 Agent 归因（一核五翼 Faculty 接入）](../concepts/040-routine-multi-agent-faculty.md) — 将 5 翼 Faculty 真正引入 Routine 编排链，使「人机交互」中「人」侧动作（审 Plan / 答问 / 门控 / 评估）由真实 Faculty Agent 产出并归因（agent_role）；FacultyBridge 同步桥接 + litellm 降级，前端 deriveHumanRole 语义投射平滑切换至后端字段
- [Skills](../concepts/design/skills.md)
- [Negentropy Wiki Ops](../reference/wiki/ops.md)
- [Wiki 独立部署与内容同步](../reference/wiki/deployment.md) — 纯静态 wiki 独立部署（Docker / 静态托管）+ 本地主站 Catalog 内容同步到远程 wiki 的 step-by-step 指引；含「本地 publish 自动发布到 GitHub Pages」（图片烘焙自包含 + 后端 spawn `publish-wiki-pages.sh` + buildId 幂等）
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
- [浏览器操作 MCP 调研](../research/120-browser-automation-mcp.md) — Playwright MCP / Chrome DevTools MCP / claude-in-chrome / Webwright 等纵向深挖与横向决策矩阵，结合"6 Agents + 自治 Routine"两类上下文的选型论证（集成落地见 [集成方案](../concepts/design/browser-automation-mcp-integration.md)）
- [自进化 Agents Team 调研](../research/130-self-evolving-agents-team.md) — 自进化智能体理论（DGM/ADAS/AlphaEvolve/AgentSquare）+ 进化算子（GEPA/ACE/DSPy）+ 评测回路（Agent-as-a-Judge/OTel/Langfuse）+ 工具生态自进化（MCP Registry/Agent Skills/LLM 自造工具）+ 记忆/知识系统自进化（MemGPT/Mem0/A-Mem 自编辑记忆、ReasoningBank/Memp 经验沉淀、MemEvolve/MemSkill 记忆元进化、Zep/HippoRAG 2 图谱记忆、SSGM/MINJA 记忆治理）+ 护栏治理（OWASP Agentic Top 10/金丝雀/Goodhart 防护），映射至四层自进化架构（技术方案见 [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md)）

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
- 版本号单一事实源（SSOT）：仓库根 `VERSION` 文件为唯一权威源，由 `scripts/sync_versions.py`（`uv run ... sync` 写回 / `check` 校验）投射到主栈 6 清单（4 package.json + 2 pyproject.toml）+ 2 uv.lock；pre-commit `version-sync-check` hook + CI `.github/workflows/version-consistency.yml` 双重防漂移。管辖主栈（root / negentropy / negentropy-ui / negentropy-wiki / negentropy-perceives / agents-chat-core）；改版本只动 `VERSION` 后跑 sync，勿手改清单。`cognizes` / `cognizes-ui` 为独立项目保持自治（详见 [issue.md ISSUE-144](issue.md#issue-144)）

- [RFC 0001：会话架构重塑](../concepts/0001-conversation-architecture-refactor.md) · [RFC 0002：UI 交互增强](../concepts/0002-ui-interaction-enhancements.md) — 设计提案与决策记录
- `docs/reference/cognizes/engine/schema/` — 数据 schema 参考 DDL（Knowledge / Memory / KG）
