# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- **Plan Review 人机交互断链根治 + 一核五翼 Faculty 真实答问（实证 Routine 77c8a8b6）**：巡检 Routine 的 Plan Review 回路断裂——CC 经 `AskUserQuestion` 提交方案后收到 `<error>Answer questions?</error>`、困惑重试空耗 turns，NegentropyEngine（元神）的 refine 反馈虽产出（事件流可见 3 次 `plan_review`）却从未送达 CC。根因：`orchestrator._build_config` 的 unified plan 段仅在 `plan_review_via_hook=True` 时挂 PreToolUse 钩子，而巡检默认 `False` → 回退到 reader clean stdin 路径，但 headless `claude -p` 下 `AskUserQuestion` 的 stdin tool_result **从始无效**（ISSUE-123 实验结论）；历史注释「clean stdin 经 19 例 ExitPlanMode 应答证明可用」混淆了 ExitPlanMode（stdin 可用）与 AskUserQuestion（stdin 无效，而 PLAN prompt 恰约束 CC 用后者提交）。**修复（PR 2a）**：unified plan 段**无条件挂 PreToolUse 钩子**（不再受 per-routine `via_hook` 控制——plan 段评审是引擎核心机制、headless 下唯有钩子可工作），并强制 `plan_config.auto_answer_context.plan_review_via_hook=True` 令 reader 跳过失效 stdin；修正 `orchestrator`/`patrol_prompt` 的错误注释。refine 反馈经钩子 `deny+reason` 同轮回灌 CC，CC 据此修订重提或按 approve 结束本轮。**FacultyBridge 真实答问（PR 2b）**：`_auto_answer_question`（INJECT-4）开启 `faculty_bridge_enabled` 时经 ADK Runner 同步调用**真实本心（Internalization）Faculty** 产出答复，失败/超时降级 litellm（与 INJECT-2 Plan 审 / INJECT-5 评估的元神调用同范式）。INJECT-3 门控为确定性子进程执行、无 LLM 接缝，保留 `action`（妙手）归因不强插 Faculty（最小干预）。
- **`cli.sh restart` 报 `Can't locate revision identified by '0078'`**：共享 `negentropy` dev DB 的 `alembic_version` 被超前 stamp 到 `0078`（`routine_iteration_events.agent_role` 列），但 `cli.sh` 从部署分支 `feature/1.x.x`（迁移树 head 仅到 `0077`）跑 alembic 时无法在自身树中定位 `0078`。根因是工作区（带未合并 PR #1013 的 migration 0078）曾以无效 env override 跑 alembic roundtrip——`NE_DATABASE__NAME` 并非 `DatabaseSettings` 真实字段，未重定向到临时库、实际落到共享 `negentropy` DB。修复：从工作区执行 `0078` 的 `downgrade()`（drop 空 `agent_role` 列，核查 113550 行该列 0 非空、零数据损失）realign DB 到 `0077`，与部署分支 head 对齐；前向安全已验证（`0077→0078` 幂等重应用，PR #1013 合并后自动复用）。防范：迁移测试须用真实 settings 字段或独立 DSN 重定向，勿依赖未映射的 env key。

### Changed

- **Wiki 发布入口一体化 + 双目标发布**：`/knowledge/wiki` 工具栏的「从 Catalog 同步」「同步并发布」「仅发布」收敛为单一 **「发布」** 按钮（选 Catalog 节点 → 同步 → 发布），并新增**发布目标选择器**：
  - **测试环境**：后端 spawn `scripts/build-wiki-local.sh`（导出 `content/` + `next build` 重建本地 `:3092`）。
  - **生产环境**：spawn `scripts/publish-wiki-pages.sh` 推送到 [`threefish-ai.github.io`](https://github.com/ThreeFish-AI/threefish-ai.github.io) `master` 分支，直接更新 [https://threefish-ai.github.io/](https://threefish-ai.github.io/)；`gh auth token` 可用即零配置，生产目标经 destructive 二次确认（不可逆）。
  - `POST /wiki/publications/{pub_id}/publish` 新增可选请求体 `{ target: "local" | "production" }`（缺省 `local`）；响应回填 `target` / `site_url`。

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
