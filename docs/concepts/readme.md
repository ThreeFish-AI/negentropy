# 概念设计总览

> Negentropy「概念设计」分部索引。按「核心架构 → 子系统设计 → 工程运维 → 设计 RFC → 用户指南」五路组织；本页为各模块阅读入口。

---

## 一、核心架构（根）

系统级架构与协议基线，全仓引用的 Single Source of Truth。

| 文档 | 主旨 |
|:---|:---|
| [架构设计方案 · 一核五翼总览](./framework.md) | 系统全景架构、流水线编排、设计模式目录、数据持久化、前端架构 |
| [Conversation Foundation · 人与 Agent 对话基础](./conversation-foundation.md) | Home 对话的理论总章与业界对标 |
| [A2UI · Agent-to-UI 协议校正与 Chat 页落地方案](./a2ui.md) | AG-UI / A2UI 协议事实与 Chat 页落地方案 |

## 二、子系统设计 · `subsystems/`

一核五翼各子系统（记忆 / 知识 / Routine / 人机交互）的架构设计与工程落地方案。

| 文档 | 主旨 |
|:---|:---|
| [The Memory System 架构设计](./subsystems/025-the-memory-system.md) | Agent Memory 子系统 SoT |
| [Memory 模块白皮书](./subsystems/026-memory-whitepaper.md) | 记忆理论基础与设计取舍 |
| [The Knowledge Base 设计](./subsystems/035-the-knowledge-base.md) | KB / KG / User Memory 工程落地 |
| [知识图谱架构设计](./subsystems/036-the-knowledge-graph.md) | KG 架构与实施 |
| [联邦知识图谱](./subsystems/037-federated-kg.md) | Federated KG + 跨 Corpus 混合检索 |
| [Claude Code 集成设计](./subsystems/038-claude-code-integration.md) | Claude Code 作为 BuiltinTool 接入 ADK Agent |
| [The Routine System](./subsystems/039-the-routine-system.md) | 长周期自主任务架构设计 |
| [Routine 多 Agent 归因](./subsystems/040-routine-multi-agent-faculty.md) | 一核五翼 Faculty 接入 Routine 编排链 |
| [人机交互转录 UI](./subsystems/041-human-machine-interaction-transcript.md) | Routine × Studio 统一转录架构 |

## 三、工程与运维 · `operations/`

开发、部署、运维与本地集成等操作类文档（How-to / Reference）。

| 文档 | 主旨 |
|:---|:---|
| [开发指南](./operations/development.md) | 环境搭建、开发工作流、数据库迁移、前后端对接 |
| [Docker Compose 运维指引](./operations/docker-operations.md) | compose 栈部署、日常操作、故障排查 |
| [工程变更日志](./operations/engineering-changelog.md) | 里程碑与基线变更记录 |
| [本地 LLM 集成 · Ollama](./operations/local-llm-ollama.md) | 零 Key 本地 LLM 可选方案 |

## 四、设计 RFC · `design/`

跨子系统的横向设计决策与 RFC。

| 文档 | 主旨 |
|:---|:---|
| [单点登录（SSO）方案](./design/sso.md) | Google OAuth + 用户权限管理 |
| [GenAI 可观测性](./design/observability-genai.md) | OpenTelemetry GenAI Semantic Conventions 落地 |
| [QA 与发布流水线](./design/qa-delivery-pipeline.md) | 测试与发布门控 |
| [Docker Release Pipeline](./design/docker-release-pipeline.md) | 镜像构建与 Docker Hub 发布 |
| [浏览器操作 MCP 集成方案](./design/browser-automation-mcp-integration.md) | Playwright MCP 全系统默认配备 |
| [自进化 Agents Team 技术方案](./design/self-evolving-agents.md) | 四层自进化架构 |
| [Skills 模块](./design/skills.md) | Agent Skills 工程实现 |
| [RFC 0001：Home Chat 会话架构重塑](./design/0001-conversation-architecture-refactor.md) | 会话架构重构决策记录 |
| [RFC 0002：Home Chat UI 交互能力增强](./design/0002-ui-interaction-enhancements.md) | UI 交互增强决策记录 |

## 五、用户指南 · `user-guide/`

面向终端用户的操作手册（Tutorial / How-to）。完整阅读路径见 [用户手册首页](../README.md)。

---

> 阅读建议：新人从「核心架构」入门 → 按需深入「子系统设计」；运维与开发查「工程与运维」；横向决策查「设计 RFC」；终端用户操作查「用户指南」。
