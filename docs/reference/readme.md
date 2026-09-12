# 技术参考总览

> Negentropy「技术参考」分部索引。按「引擎内核 → 数据提取 MCP → Wiki 运维」三栈组织，承载各子系统的工程参考（架构 / 开发 / 接口 / 运维）；本页为各模块阅读入口。

---

## 一、Cognizes 引擎 · `cognizes/`

Agentic AI 引擎内核的验证资产：项目级 PRD/计划、五阶段（Pulse / Hippocampus / Perception / Realm of Mind / Demo）实施方案、配套 DDL 与开发/测试/CI 指南。

> 注：`apps/cognizes` 代码项目已于 2026-09 退役删除（功能由 Negentropy 主栈承接），本分部为保留的设计参考资产。

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

## 四、通用参考 · 根目录与 `paper-notes/`

跨栈的精读笔记、机制映射与通用基础设施设计。

| 文档 | 主旨 |
|:---|:---|
| [论文/产品精读](./paper-notes/)（`_category_.json` 分部） | 领域核心材料精读：机制解构、实证数字、批判性边界与对本仓的映射 |
| [Context Layer 基础设施设计蓝图](./context-layer-blueprint.md) | 对标 Snowflake Horizon Context 的通用可复刻治理上下文层：对象模型 / 目录 / 富化自纠 / MCP 激活 / 双层治理 / 治理≠验证对策与演进路线 |

---

> 阅读建议：引擎内核设计与 PRD 查「Cognizes 引擎」；数据提取与 PDF 工程化查「Perceives MCP」；Wiki 站点本身的部署与发布查「Wiki 运维」；领域材料精读与 Context Layer 复刻查「通用参考」。
