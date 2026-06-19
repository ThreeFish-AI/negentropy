# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.0.1](https://github.com/ThreeFish-AI/negentropy/releases/tag/v0.0.1) - 2026-06-19

首个公开 MVP。立意于薛定谔「熵减」，Negentropy 不在于打造 Agent，而是构建持续自我进化的认知系统，直面当下 AI 助手的五大熵增痛点——**信息过载、金鱼记忆、浅尝辄止、纸上谈兵、晦涩难懂**，把混沌输入转化为有序、可落地的高价值输出。

### Core Feature

- **「一核五翼」认知架构**：Negentropy 主智能体统一调度，感知/内化/坐照/知行/影响五系部正交分工，知识获取/问题解决/价值交付三条流水线自动编排，并支持 Skill、Routine 与子代理横向扩展——告别教科书式的**浅尝辄止**。
- **动态记忆系统**：跨会话长期记忆、对话后自动巩固（事实抽取/反思/摘要）、艾宾浩斯遗忘曲线衰减与 PII 治理，首链路即注入相关记忆——治好 AI 的**金鱼记忆**。
- **感知引擎（独立 MCP 微服务）**：PDF→Markdown 多引擎（Docling/Marker/MinerU 等）+ LLM Judge 仲裁择优，网页抓取内置反检测，大型 PDF 透明分批与断点续传——从信息洪流中**只捞信号**。
- **知识管理全链路**：pgvector HNSW 语义检索 + BM25 + Reranking 混合召回，知识图谱（实体抽取/社区发现/PageRank）、Catalog 目录树、Wiki 一键发布（SSG/ISR）——消除**晦涩难懂**。
- **知行系部 + 双通道沙箱**：MCP 与 MicroSandbox 双通道安全执行代码、读写文件——让分析走出**纸上谈兵**，直接落地为行动。

### Security

- **身份与权限**：Google OAuth SSO 单点登录 + RBAC（admin/user 双层守卫）。
- **数据与执行隔离**：记忆 PII 治理贯穿全链路；代码执行经双通道沙箱隔离，OAuth/SSO 登录态禁止代理或模拟。
- **可观测留痕**：structlog + OpenTelemetry + Langfuse 三层观测，每次「思考」均可审计。
