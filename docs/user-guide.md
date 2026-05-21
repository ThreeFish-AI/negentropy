# Negentropy 用户手册

> **Negentropy (熵减引擎)** — 一套基于「一核五翼」架构的智能体系统，致力于将混沌的输入转化为有序、结构化的高价值输出。
>
> 本手册已按内容模块正交分解为独立文档，便于按需阅读与维护。以下为各模块用户指南的索引入口。

---

## 阅读路径

| 角色           | 推荐阅读顺序                                                                                        |
| :------------- | :-------------------------------------------------------------------------------------------------- |
| **首次使用者** | [认识 Negentropy](./core/user-guide/overview.md) → [快速上手](./core/user-guide/quickstart.md) → [对话交互](./core/user-guide/chat-essentials.md) |
| **知识管理员** | [认识 Negentropy](./core/user-guide/overview.md) → [知识库管理](./core/user-guide/knowledge-management.md) → [记忆系统](./core/user-guide/memory-basics.md) |
| **系统管理员** | [认识 Negentropy](./core/user-guide/overview.md) → [管理后台](./infrastructure/user-guide/admin.md) → [Interface](./core/user-guide/interface.md) |
| **AI 研究者**  | [对话交互](./core/user-guide/chat-essentials.md) → [论文自动采集](./core/user-guide/papers-curation.md) |
| **全面了解**   | 按模块顺序逐项阅读                                                                                    |

---

## 模块用户指南

### 核心系统

| 文档 | 说明 |
| :--- | :--- |
| [认识 Negentropy](./core/user-guide/overview.md) | 系统哲学、一核五翼架构、三大标准流水线 |
| [快速上手](./core/user-guide/quickstart.md) | 环境要求、启动后端/前端、首次对话 |
| [对话交互](./core/user-guide/chat-essentials.md) | 界面布局、Agent 调度、HITL 确认、Session 管理、调试工具、长任务、附件、提示词、错误排查 |
| [Interface 能力接入](./core/user-guide/interface.md) | Models / SubAgents / MCP Servers / Skills 四维管理 |
| [Skills 基础](./core/user-guide/skills-basics.md) | 5 步创建 Skill |
| [Skills 进阶](./core/user-guide/skills-advanced.md) | 可见性、工具白名单、渐进披露 |
| [Skills 模板](./core/user-guide/skills-templates.md) | 模板导入系统 |
| [Skills 调度](./core/user-guide/skills-scheduling.md) | Cron 定时触发 |
| [Skills 版本](./core/user-guide/skills-versions.md) | 版本管理 |
| [Skills 排查](./core/user-guide/skills-troubleshooting.md) | 错误诊断 |
| [常见问题 FAQ](./core/user-guide/faq.md) | 术语表、环境变量速查、文档导航 |

### 知识系统

| 文档 | 说明 |
| :--- | :--- |
| [知识库管理](./core/user-guide/knowledge-management.md) | 语料库管理、文档摄取、知识检索、知识图谱可视化、路径探索 |
| [论文自动采集](./core/user-guide/papers-curation.md) | AI Agent 论文 → KB/KG 流水线 |
| [Skills: Paper Hunter](./core/user-guide/skills-paper-hunter.md) | 端到端论文采集用例 |

### 记忆系统

| 文档 | 说明 |
| :--- | :--- |
| [记忆基础](./core/user-guide/memory-basics.md) | 5 分钟入门、UI 导航 |
| [记忆自动化](./core/user-guide/memory-automation.md) | pg_cron 配置、调度策略 |
| [记忆集成](./core/user-guide/memory-integration.md) | API 集成、开发者指南 |
| [记忆排查](./core/user-guide/memory-troubleshooting.md) | 10 大常见问题 + SQL 诊断 |

### 基础设施

| 文档 | 说明 |
| :--- | :--- |
| [管理后台](./infrastructure/user-guide/admin.md) | 用户管理、角色权限管理 |

### Wiki 发布

| 文档 | 说明 |
| :--- | :--- |
| [Wiki 知识发布](./reference/wiki/user-guide/publishing.md) | Publication 创建、SSG/ISR 部署 |

---

## 技术设计文档

各模块的技术设计与架构文档，面向开发者：

| 模块 | 文档 |
| :--- | :--- |
| 系统架构 | [Framework](./concepts/framework.md) · [Development](./core/development.md) · [对话基础](./concepts/conversation-foundation.md) · [A2UI](./concepts/a2ui.md) |
| 核心设计 | [Skills 模块](./core/design/skills.md) · [工程变更日志](./core/engineering-changelog.md) |
| 知识设计 | [Knowledge 设计](./reference/cognizes/engine/035-the-knowledge-base.md) · [KG 概览](./reference/cognizes/engine/036-the-knowledge-graph.md) · [联邦 KG](./reference/cognizes/engine/037-federated-kg.md) |
| 记忆设计 | [Memory 概览](./reference/cognizes/engine/025-the-memory-system.md) · [白皮书](./reference/cognizes/engine/026-memory-whitepaper.md) |
| 基础设施 | [SSO](./concepts/design/sso.md) · [Observability](./concepts/design/observability-genai.md) · [QA Pipeline](./concepts/design/qa-delivery-pipeline.md) |
| Wiki | [Wiki 运维](./reference/wiki/ops.md) · [KG 发布设计](./reference/wiki/design/knowledge-graph.md) |

---

## Agent 协作协议

- [Agent 协作协议（AGENTS.md）](../AGENTS.md) — 项目根工程行为准则
- [浏览器验证协议](./agents/browser-validation.md) — Chrome 实机验证规范
- [引用规范 (IEEE)](./agents/reference-specifications.md) — 决策引用与文献格式
- [Issues 摘要](./agents/issue.md) — 历次问题表因 / 根因 / 处理 / 防范的跨上下文留存
- [知识索引](./agents/knowledge-map.md) — 项目文档全局导航
