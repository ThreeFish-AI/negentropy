# 技术参考总览

> Negentropy「技术参考」分部索引。按「引擎内核 → 数据提取 MCP → Wiki 运维」三栈组织，承载各子系统的工程参考（架构 / 开发 / 接口 / 运维）；本页为各模块阅读入口。

---

## 一、Cognizes 引擎 · `cognizes/`

Agentic AI 引擎内核的验证资产：项目级 PRD/计划、五阶段（Pulse / Hippocampus / Perception / Realm of Mind / Demo）实施方案、配套 DDL 与开发/测试/CI 指南。

| 文档 | 主旨 |
|:---|:---|
| [Cognizes 引擎索引](./cognizes/readme.md) | 引擎内核各 Phase 实现与外部基线调研的阅读入口 |
| [产品需求与架构（PRD）](./cognizes/prd/000-prd-architecture.md) | 项目级 PRD 与概要设计 |
| [Cognizes Engine](./cognizes/engine/README.md) | 引擎架构白皮书：主权、云无关、成本可控 |

## 二、Perceives MCP · `perceives/`

网页 / PDF → Markdown 数据提取 MCP Server 的工程参考（架构 / 开发 / 用户指南）与 Agents 专题（Apple Silicon 调优、PDF 引擎选型）。

| 文档 | 主旨 |
|:---|:---|
| [Perceives MCP 索引](./perceives/readme.md) | Perceives 工程文档与 Agents 专题阅读入口 |

## 三、Wiki 运维 · `wiki/`

纯静态 Wiki 站的部署、发布、设计与回归验证。

| 文档 | 主旨 |
|:---|:---|
| [Wiki 运维索引](./wiki/readme.md) | Wiki 部署/发布/设计/验证阅读入口 |

---

> 阅读建议：引擎内核设计与 PRD 查「Cognizes 引擎」；数据提取与 PDF 工程化查「Perceives MCP」；Wiki 站点本身的部署与发布查「Wiki 运维」。
