# Wiki 运维索引

> Negentropy Wiki 是纯静态（`output: export`）站点，由本仓 `docs/` 合成、按 Publication 切片发布。本页为部署、发布、设计与回归验证的阅读入口。

---

## 一、运维与部署

| 文档 | 主旨 |
|:---|:---|
| [Wiki 独立部署与内容同步](./deployment.md) | 静态 SSG 部署、内容导出 / 重建流程、发布语义 |
| [Wiki 运维指引](./ops.md) | 服务拓扑、日常运维、故障排查、安全注意 |

## 二、Wiki 设计 · `design/`

| 文档 | 主旨 |
|:---|:---|
| [Wiki 知识图谱（按 Publication 切片发布）](./design/knowledge-graph.md) | KG 按 Publication 切片、Sigma WebGL 渲染 |

## 三、报告与用户指南 · `reports/` · `user-guide/`

| 文档 | 主旨 |
|:---|:---|
| [Agents at Wiki · 浏览器回归验证报告](./reports/agents-validation.md) | 一主五翼 6 Agents 嵌入 Wiki 的端到端验证 |
| [Wiki 知识发布](./user-guide/publishing.md) | 内容发布工作流、静态重建、双目标（测试 / 生产） |

---

> 阅读建议：首次部署查「独立部署与内容同步」；日常运维查「运维指引」；发布操作查「Wiki 知识发布」；验证回归查「浏览器回归验证报告」。
