# Perceives MCP 索引

> Negentropy Perceives 是「网页 / PDF → Markdown」数据提取 MCP Server。本页为工程文档（架构 / 开发 / 用户指南）与 Agents 专题的阅读入口。

---

## 一、工程文档

| 文档 | 主旨 |
|:---|:---|
| [Framework · 架构设计](./framework.md) | 五层分层架构、Pipeline 编排与 6 个 MCP 工具的接入设计 |
| [Development · 开发指南](./development.md) | 开发环境、项目结构、测试体系、CI/CD 与最佳实践 |
| [User Guide · 用户指南](./user-guide.md) | MCP Server 部署配置、6 个工具参考、Python SDK |
| [Issue 处理档案](./issue.md) | 历史问题归档与结构化处置范式 |

## 二、Agents 专题 · `agents/`

PDF Pipeline 工程化专题：Apple Silicon 调优、PDF 引擎自适应选型、Perceives 知识索引。

| 文档 | 主旨 |
|:---|:---|
| [Apple Silicon PDF Pipeline 调优](./agents/apple-silicon-tuning.md) | Docling / MinerU / Marker 在 Apple M 系列的 MPS 调优 |
| [PDF 引擎选择决策图](./agents/pdf-engine-selection.md) | 各阶段自适应引擎选型决策树 |
| [Knowledge Map · 知识索引](./agents/knowledge-map.md) | Perceives 文档与能力索引 |

---

> 阅读建议：首次接入从「User Guide」入门；二次开发查「Development」；架构理解查「Framework」；PDF 工程化专题查「Agents 专题」。
