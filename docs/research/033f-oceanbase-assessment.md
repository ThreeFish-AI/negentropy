### OceanBase

**Research**

- 起于 Oracle/MySQL 兼容形态
- 采用 Shared-Nothing 无共享架构，具备强水平扩展性
- 支持最新的 BM45 算法，具备文档相关性（关键词）搜索能力
- Agentic AI 中的 Context Engineering、Memory 管理模块没有强事务要求，更多关注与「显式内存管理」、「上下文窗口管理」、「协调性需求」、「可扩展性考虑」

**Todo**

- [ ] OceanBase 的 Self-Hosted 部署/验证
- [ ] 阿里云上 Agent Engine 的 DB 选型中，OceanBase 的定位如何？
- [ ] 验证 Milvus 在 Agentic AI 应用场景下的支撑方案（Context Engineering：混合检索、RAG、Memory 等中间件层和基础框架支持层的云原生方案）
- [ ] 调研其他类似 OceanBase 的全能型 DB，或者专业 Context Engineering 的 DB（Milvus）
- [ ] 验证在 Agentic AI 场景下的用例
- [ ] 验证 OceanBase 的跨云分布式部署方案

**Defect**

1. 与行业标准工具的无缝集成能力欠佳；
2. 在兼容模式下不同场景的性能差异很大；

**Advantages**

- 混合查询能力
- 高并发与低延迟
- 多模态交互（比如图搜图，Maps）
- 数据安全与合规 - 认证？
