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
- [PDF 巡检状态落库方案](pdf-fidelity-patrol-status.md) — 巡检文档级状态从 Memory 标签迁为 `knowledge_documents` 持久列（SSOT）+ Documents 列表「巡检状态」列 + 「重置为未拟合」二次巡检 API
- [Development（开发指南）](../concepts/operations/development.md) — 环境搭建、开发工作流、数据库迁移、前后端对接

## 系统概念与设计

- [Framework（系统框架）](../concepts/framework.md)
- [Conversation Foundation（对话基础）](../concepts/conversation-foundation.md)
- [A2UI（Agent-to-UI 协议）](../concepts/a2ui.md)
- [SSO（单点登录设计）](../concepts/design/sso.md)
- [Observability / GenAI 可观测性](../concepts/design/observability-genai.md)
- [QA Delivery Pipeline](../concepts/design/qa-delivery-pipeline.md)
- [Docker Release Pipeline](../concepts/design/docker-release-pipeline.md) — compose 栈 4 镜像（backend / perceives / ui / wiki）的多架构构建与 Docker Hub 发布：PR 构建校验 + tag 发布双入口，amd64+arm64 原生 runner + digest 合并 + provenance/SBOM
- [Docker Compose 运维指引](../concepts/operations/docker-operations.md) — compose 栈 5 服务的部署、日常操作、开发工作流与故障排查：首次部署、首次发布、版本管理、健康检查、日志查看、卷备份、常见故障排除
- [浏览器操作 MCP 集成方案](../concepts/design/browser-automation-mcp-integration.md) — Playwright MCP 全系统默认配备：单一注入点（builtin_tools.mcp_config）provision 至 Routine / Scheduler / 6 Agents，用于浏览器实机回归验证
- [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md) — 四层自进化架构（固定框架 Meta-Layer / 动态 Agent 定义 / 外部能力工具 / 记忆与知识系统）：遥测→评测→提案→验证→门控发布全闭环，含 agent_versions 版本化、GEPA/ACE 进化算子、记忆/知识配置进化回路（基质/客体分轨 ADR-4）、Golden Set 双轨评测、金丝雀发布、护栏决策矩阵与四阶段演进路线（调研基础见 [130 号调研](../research/self-evolution/130-self-evolving-agents-team.md)）
- [Context Layer · 上下文治理层技术方案](../concepts/design/context-layer.md) — 对标 Snowflake Horizon Context（Collect/Enrich/Activate 三相 + Structural/Operational/Semantic/Behavioral 四信号层 + 引擎级治理不可绕过）的横向治理织物：统一 Context Catalog（逻辑视图非新表）、信任信号归一、扩展 HybridPlanner 接入 Memory 与 ContextAssembler 接地 KB、ContextGuard 兜底治理、`context_strategy` 进化杠杆与三阶段演进路线（理论见 [Context Engineering 调研](../research/cognitive-context/010-context-engineering.md)，对标见 [Snowflake §D7](../research/retrieval-storage/034-snowflake-data-cloud.md)）

## 系统能力概览

- [Memory（记忆系统）](../concepts/subsystems/025-the-memory-system.md) · [白皮书](../concepts/subsystems/026-memory-whitepaper.md)
- [Knowledge Base（知识库设计）](../concepts/subsystems/035-the-knowledge-base.md)
- [Knowledge Graph（知识图谱）](../concepts/subsystems/036-the-knowledge-graph.md) · [联邦知识图谱 + 跨 Corpus 混合检索](../concepts/subsystems/037-federated-kg.md)
- [Claude Code 集成（BuiltinTool）](../concepts/subsystems/038-claude-code-integration.md) — Claude Code CLI 作为 ADK Agent 工具的接入方案
- [Routine（长周期自主任务）](../concepts/subsystems/039-the-routine-system.md) — Engine 编排 + Claude Code 执行的 Evaluator-Optimizer 自迭代闭环（含 Reflexion 反思记忆、LLM-as-Judge 评估、审批门控、停止护栏） · [预设模版](../concepts/user-guide/routine-presets.md) — 4 个开箱即用的场景模版（代码审计 / 测试增强 / 文档生成 / 架构清减），正交覆盖全部核心功能
- [Routine 多 Agent 归因（一核五翼 Faculty 接入）](../concepts/subsystems/040-routine-multi-agent-faculty.md) — 将 5 翼 Faculty 真正引入 Routine 编排链，使「人机交互」中「人」侧动作（审 Plan / 答问 / 门控 / 评估）由真实 Faculty Agent 产出并归因（agent_role）；FacultyBridge 同步桥接 + litellm 降级，前端 deriveHumanRole 语义投射平滑切换至后端字段
- [人机交互转录 UI（Routine × Studio 统一架构）](../concepts/subsystems/041-human-machine-interaction-transcript.md) — 回合制转录渲染器（`TranscriptItemsView` + `TranscriptPolicy`）统一 Routine Iterations Full View 与 Home/Studio 中栏对话；语义重映射（Routine 人=一核五翼 / 机=Claude Code；Studio 人=用户 / 机=一核五翼+Claude Code）、机制 vs 策略正交分解、`TranscriptItem` 视图模型与 per-agent 归因映射 · [实操手册](../concepts/user-guide/transcript-view.md) — 两处「人机交互」界面的实操指引（左右分栏语义 / 工具卡展开 / 思考引用 / 节点选中搜索 / FAQ）
- [Skills](../concepts/design/skills.md)
- [Negentropy Wiki Ops](../reference/wiki/ops.md)
- [Wiki 独立部署与内容同步](../reference/wiki/deployment.md) — 纯静态 wiki 独立部署（Docker / 静态托管）+ 本地主站 Catalog 内容同步到远程 wiki 的 step-by-step 指引；含「本地 publish 自动发布到 GitHub Pages」（图片烘焙自包含 + 后端 spawn `publish-wiki-pages.sh` + buildId 幂等）
- [Wiki 知识图谱（按 Publication 切片发布）](../reference/wiki/design/knowledge-graph.md)
- [Agents at Wiki —— 浏览器回归验证报告](../reference/wiki/reports/agents-validation.md) — 一主五翼 6 Agents 嵌入 wiki 的端到端验证
- [Engineering Changelog](../concepts/operations/engineering-changelog.md)

## Cognizes 引擎与子系统设计

- [Cognizes Engine 总览](../reference/cognizes/engine/README.md) — Agentic AI Engine 一核五翼架构入口
- [P1 The Pulse](../reference/cognizes/engine/010-the-pulse.md) · [P2 The Hippocampus](../reference/cognizes/engine/020-the-hippocampus.md) · [P3 The Perception](../reference/cognizes/engine/030-the-perception.md) · [P4 The Realm of Mind](../reference/cognizes/engine/040-the-realm-of-mind.md) · [P5 Integrated Demo](../reference/cognizes/engine/050-integrated-demo.md)
- 子系统专项：[025 Memory System](../concepts/subsystems/025-the-memory-system.md) · [026 Memory Whitepaper](../concepts/subsystems/026-memory-whitepaper.md) · [035 Knowledge Base](../concepts/subsystems/035-the-knowledge-base.md) · [036 Knowledge Graph](../concepts/subsystems/036-the-knowledge-graph.md) · [037 Federated KG](../concepts/subsystems/037-federated-kg.md)
- 参考 DDL：[`reference/cognizes/engine/schema/`](../reference/cognizes/engine/schema/)（hippocampus / perception / kg_schema_extension）

## 项目级 PRD / Plan / Checklist

- [PRD & Architecture](../reference/cognizes/prd/000-prd-architecture.md) — Agentic AI 学术研究与工程应用平台 产品需求与架构
- [Implementation Plan](../reference/cognizes/prd/001-implementation-plan.md) — 实施计划
- [Task Checklist](../reference/cognizes/prd/002-task-checklist.md) — 任务执行清单

## 研究文献 / Research

- [Research（研究文献索引）](../research/) — 认知增强、上下文工程、Agent runtime、向量检索、知识图谱、Agent Sandbox 等领域基线调研
- [Snowflake 数据云平台深度调研](../research/retrieval-storage/034-snowflake-data-cloud.md) — 基于 Snowflake 官方文档的 10 正交维度（架构/存储/计算/数据工程/开发/AI/安全治理/数据共享/业务连续性/成本）全景调研 + 主流方案（BigQuery/Redshift/Databricks/OceanBase）横向对比与选型建议
- [ADK 2.0 升级调研](../research/agent-runtime/020b-adk-2.0-upgrade.md) — Google ADK 2.0 核心新特性、Breaking Changes、本项目影响评估与渐进式升级路径
- [Routine Agent 迭代模式调研](../research/self-evolution/110-routine-agent-iteration.md) — ReAct/Reflexion/Self-Refine/LATS/Voyager + LLM-as-Judge + Claude Code/Codex/Gemini/OpenHands 工程实践与停止护栏（长周期自主任务理论基础）
- [浏览器操作 MCP 调研](../research/self-evolution/120-browser-automation-mcp.md) — Playwright MCP / Chrome DevTools MCP / claude-in-chrome / Webwright 等纵向深挖与横向决策矩阵，结合"6 Agents + 自治 Routine"两类上下文的选型论证（集成落地见 [集成方案](../concepts/design/browser-automation-mcp-integration.md)）
- [自进化 Agents Team 调研](../research/self-evolution/130-self-evolving-agents-team.md) — 自进化智能体理论（DGM/ADAS/AlphaEvolve/AgentSquare）+ 进化算子（GEPA/ACE/DSPy）+ 评测回路（Agent-as-a-Judge/OTel/Langfuse）+ 工具生态自进化（MCP Registry/Agent Skills/LLM 自造工具）+ 记忆/知识系统自进化（MemGPT/Mem0/A-Mem 自编辑记忆、ReasoningBank/Memp 经验沉淀、MemEvolve/MemSkill 记忆元进化、Zep/HippoRAG 2 图谱记忆、SSGM/MINJA 记忆治理）+ 护栏治理（OWASP Agentic Top 10/金丝雀/Goodhart 防护），映射至四层自进化架构（技术方案见 [自进化 Agents Team 方案](../concepts/design/self-evolving-agents.md)）
- [经验时代的自驱迭代进化智能体调研](../research/self-evolution/140-experience-era-self-improvement.md) — 精读 88 页综述提炼 Harness 经验基础设施框架，对照 negentropy Routine 闭环诊断出两处根本断点（Judge 无历史锚点 ±20 振荡 / `decay_override` 死配置致经验记忆 7-8 天全灭 + 反馈链断），落地双支柱改进：证据锚定纵向评估（trajectory + progress_evidence + 量化振荡 opt-in）与经验记忆闭环补强（衰减修复 E / 检索反馈闭环 B / 写入去重准入 A / 失败教训结构化与注入 C-D）
- [Skill 进化闭环 × 自我改进评测](../research/self-evolution/141-skills-evolution-and-si-measurement.md) — 综述 §3（Skills 三阶段 Evolution 缺口）/ §7（Meta-Evolving 三体制）/ §8（SI 六目标 + SIP-Bench + 反事实归因）映射到 negentropy：PR [#1038](https://github.com/ThreeFish-AI/negentropy/pull/1038) 落地 eval 四表 + held-out 双相门（decide_skill_shadow/canary）+ 反事实 Skill Influence Pattern + TargetHandler 抽象 + SkillTemplateHandler 闭环（GEPA 变异 prompt_template + active_version 发布），补 140 号未覆盖的 Skills/Meta/SI 度量框架
- [科普视频制作 Pipeline（公共基建，apps/negentropy-influence）](../../apps/negentropy-influence/README.md) — 子项目已从仓库根 media/ 迁入 apps/（分层：pipeline/ 机制 vs episodes/ 内容，路径锚点=根哨兵 `.influence-root`，对目录深度免疫）；全仓可复用的论文→视频九阶段流水线：`pipeline.py` 单入口（status/doctor/build/check/tts/captions/render/qa/all/stages）+ 每集 `pipeline.toml` 声明式配置（[schema/默认值层](../../apps/negentropy-influence/pipeline/scripts/config.py)：机制常数进代码、toml 只写偏离，缺失会让时长门**点名跳过**而非静默）+ `timing.json` 时序 SSOT（timing.ts 与 Python 共读，双语言镜像漂移结构性消灭）+ [stages.toml](../../apps/negentropy-influence/pipeline/stages.toml) 九阶段唯一声明（序号↔文件号错位 ⑥↔07/⑦↔06 显式化并由 test_stages 执法）；技能规格 skills/01–09，真 Skill 挂载于 [.agent/skills/science-video-pipeline](../../.agent/skills/science-video-pipeline/SKILL.md)（纯路由壳，其死链已入 check_series 受检面）；测试 `pipeline/tests/`（全量 5 秒内跑完，digest 黄金哈希守缓存零失效）；骨架三件套 [templates/video-skeleton](../../apps/negentropy-influence/pipeline/templates/video-skeleton/skeleton.toml)（scaffold 实例化 + verify_skeleton 按系列分组 md5 漂移门，「复制源头」从「任一既有集」收敛为命名模板）；工具：check_script（分镜覆盖性/时长预算双口径）、check_series（系列顺序五规则执法 [series.json](../../apps/negentropy-influence/series.json)）、captions（srt/vtt）、qa_frames --check（黑帧/字幕带侵入/冻帧/WCAG 对比度自动体检）、paper_extract（论文取证五子命令）、source_ledger（B 型信源固定提交+双指纹清单）、refs（样本指纹清单）；Stage ① 分两型——A 型论文（paper_extract + paper-notes.md）、B 型文档/代码/课程站点（source_ledger + source-notes.md + 证据三级），见 [skills/01](../../apps/negentropy-influence/pipeline/skills/01-source-extraction.md)。
- [科普视频作品总览（两个系列）](../../apps/negentropy-influence/series.md) — 机读 SSOT [series.json](../../apps/negentropy-influence/series.json) 顶层为 `seriesList[]`；**自进化系列**（论文型）《上线之后，AI 才开始上学》（金/青/紫，v3 已交付，成片 14:01）→《AI 如何自己变强？》（蓝/橙）→《会写代码的 AI，开始给自己写代码》（绿/洋红）；**Claude Code 通俗全解**（文档/代码型，新系列）《拆开 Claude Code：让 AI 动手的四层机制》（陶土橙/石青/警示红，信源 Learn Claude Code s01–s04 + 仓库 @ f9e8b28 MIT）。多系列执法语义：反串线规则跨系列全局，顺序类规则按系列内判定；口播永不携带集数序号，顺序变更 TTS 代价恒为零。
- [系列信源地图（source-map，多集系列的章节归属 SSOT）](../../apps/negentropy-influence/source-map/claude-code-explained.md) — 站点↔仓库**修订分叉**的系列级唯一登记处（ISSUE-165 根因再上探：站点整站是课程旧修订，20 章 vs main 17 章整合版，故双钉——ep1 钉 main、后续集钉站点同源修订 67a9126c）；机器版 [claude-code-explained.toml](../../apps/negentropy-influence/source-map/claude-code-explained.toml) 供 `source_ledger.py sync/audit` 派生台账条目名（{slug}-readme/-code/-site，与 ep1 交付台账字节兼容）并离线执法三断言（条目齐/无跨集混入/pinned_ref=地图值）；各集 source-notes 只链接不重述。
- [IndexTTS 声音克隆手册](../../apps/negentropy-influence/pipeline/VOICE-CLONING.md) — 双引擎 TTS 的克隆侧单一参考：部署（~/tools/index-tts 服务）/参考样本（prospect+prepare+refs 指纹门）/风格预设（sunny 明快阳光推荐位、sunny-steady 成片档 beams=3）/试听关卡（tts_sample + 领航片段）/缓存摘要与幂等/许可合规。
- [IndexTTS-2.5 进阶用法（上游能力面 · 机制循证 · 提升路线图）](../../apps/negentropy-influence/pipeline/INDEXTTS-2.5-ADVANCED.md) — 与操作手册正交的循证篇，锚定上游 HEAD `4f8792f` 逐条给出 file:line：能力矩阵（含 `do_sample` 在上游失效、`max_text_tokens_per_segment` 对本仓惰性等否定结论）/文本前端（中文走 wetext 而非 NeMo；实测读法矩阵——4 位年份带空格是**唯一**被击穿的规则，已成门，见 [ISSUE-164](./issue.md)）/发音标注 `<行\|HANG2>`（DTW 对照证实拼音通道生效 2.4× 分离度，CMU 通道不可判定）/情感机制（`emo_bias` 8 维不等权、`normalize_emo_vec` 在 infer 内从不被调用 ⇒ `Σvec×alpha≤0.8` 是本仓自创口径，跨来源参数迁移偏差 16–33%；73 个「情感×说话人」原型解释「换选段则标定失效」）/采样参数族（`length_penalty=0.0` 非中性、`repetition_penalty=10` 与音色耦合、`max_mel_tokens`≈30s 且溢出表现为文本尾部未念出、无种子致 A/B 不可信）/参考音频（15s 硬截断保前丢后、恒重采样 22.05kHz、CMVN 使相似度对增益免疫、逐句成本来自 CFM 前缀）/性能（本机是 U-DiT 非论文 Zipformer ⇒ 论文 RTF 不可引用；分段 profile 实测 **s2mel 占 45–73%** 而非 T2S，束宽在 MPS 上近乎免费）/16 项 ROI 排序路线图与迁移地雷。配套工具：[发音标注台账](../../apps/negentropy-influence/pipeline/PRON-GLOSSARY.md)、[pron_marks.py](../../apps/negentropy-influence/pipeline/scripts/pron_marks.py)（标注解析/校验，拦「孤立 < 吞正文」等三类静默失效）、[tts_bench.py](../../apps/negentropy-influence/pipeline/scripts/tts_bench.py)（耗时基准与**测量环境体检**：漂移已定因为热节流，加 75s 冷却后 A/A 极差比 1.016–1.047× 合格；含成对 A/B 模式与 whisper 回转写判据）、[prospect_ref.py --accept](../../apps/negentropy-influence/pipeline/scripts/prospect_ref.py)（参考样本保真度验收：削波/底噪/动态/带宽/超 15s）。
- [自进化 Agents Team 方案（Phase 3 记忆检索面已落地）](../concepts/design/self-evolving-agents.md) — 四层自进化架构：本次落地 `engine/evolution/` 子系统（GEPA proposer + 状态机 + decision 护栏）并在记忆检索权重面接通 propose→shadow→canary→promote/rollback 全闭环（迁移 0081 + evolution_inspector），默认全关灰度；agent/skill/knowledge 面、Phase 1 tool_invocations 遥测、eval 四表留后续
