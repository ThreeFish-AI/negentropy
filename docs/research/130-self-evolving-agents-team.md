---
sidebar_position: 13
---
# 自进化 Agents Team：自主迭代与自我强化系统调研

> **摘要 / 导言**：将 negentropy 平台打造成「自主迭代升级、自我强化的 Agents Team」，系统分四类——**固定框架**（进化基座，自身稳定不自改）、**动态 Agent 定义**（根据反馈学习成长）、**外部能力工具**（Skills / MCP / Tools，效果反向驱动迭代）、**记忆与知识系统**（兼具进化基质与客体双角色）。核心命题是构建一条统一的进化闭环：信号采集 → 归因 → 变更生成 → 验证门禁 → 发布/回滚。本报告综合自进化智能体理论（DGM、ADAS、AgentSquare、AlphaEvolve）、进化算子（GEPA、ACE、DSPy）、评测与反馈回路（Agent-as-a-Judge、OTel GenAI semconv、Langfuse 评测体系）、工具/技能生态自进化（MCP Registry、Agent Skills、LLM 自造工具谱系）、记忆与知识系统自进化（MemGPT/Mem0/A-Mem 自编辑记忆、ExpeL/AWM/ReasoningBank 经验沉淀、MemEvolve/MemSkill 记忆元进化、Zep/HippoRAG 2 图谱记忆、SSGM/MINJA 记忆治理）、以及生产化护栏（OWASP Agentic AI Top 10、金丝雀/影子部署、Goodhart 防护），最终将证据映射到 negentropy 四类系统的设计决策上。重叠声明：ReAct / Reflexion / Self-Refine / LATS / Voyager / LLM-as-Judge 偏差治理已由 [110 号调研](./110-routine-agent-iteration.md) 覆盖，本报告一律引用不重述。

---

## 1. 问题背景与设计命题

### 1.1 三类系统的进化边界

| 系统层 | 进化语义 | 不变量 | 可进化资产 |
|--------|---------|--------|-----------|
| **固定框架（Meta-Layer）** | 进化基座自身不自改 | 护栏逻辑、安全策略、预算阈值、决策函数 | 无（改进走 Git PR 人工合并） |
| **动态 Agent 定义** | 自主迭代、自驱拟合目标场景 | 角色定位（Faculty 职责边界）、安全红线 | `system_prompt`、模型选型、技能挂载列表 |
| **外部能力工具** | 效果反向驱动迭代 | 工具白名单、权限边界、凭证隔离 | 技能 `prompt_template`（Jinja2）、工具 config JSONB、MCP pipeline 参数 |

核心设计约束：**进化 = 数据变更（DB 白名单字段），框架 = 代码（改动唯一通道 Git PR + 人工 Merge）**。

此外，**记忆与知识系统（Memory / Knowledge Base / Knowledge Graph）具有双重角色**：它既是三类系统共享的**进化基质（substrate）**——反思、playbook 条目、采收用例等进化经验的沉淀介质；又构成事实上的第四类**进化客体（object）**——其检索参数、遗忘曲线、管线 prompt、抽取策略自身可被同一进化回路优化。该维度的学术依据与设计展开见 [§6](#6-记忆与知识系统的自进化)。

### 1.2 已有基座盘点

negentropy 已具备四个可复用的进化原语，本报告的核心论点是将其收敛为统一闭环而非从零造轮：

| 原语 | 实现位置 | 产出 |
|------|---------|------|
| LLM-as-Judge 评测 | [engine/routine/evaluator.py](../../apps/negentropy/src/negentropy/engine/routine/evaluator.py) | 0–100 分 + verdict 五档 + 自然语言反思 |
| Reflexion 反思 | [engine/consolidation/reflection_generator.py](../../apps/negentropy/src/negentropy/engine/consolidation/reflection_generator.py) | `routines.reflections` JSONB 跨迭代注入 |
| SemVer 版本快照 | [models/skill.py](../../apps/negentropy/src/negentropy/models/skill.py) `skill_versions` 表 | 不可变版本历史 + SemVer + JSONB snapshot |
| 竞争择优 | perceives [pipeline_config.py](../reference/perceives/) `competition_mode` | 多引擎并行 + LLM 评审择优 |
| 检索反馈闭环 | engine/adapters/postgres/retrieval_tracker.py | `memory_retrieval_logs`（zero_hit_rate / was_referenced / outcome_feedback）+ 反馈触发反思 |
| 遗忘曲线治理 | engine/governance/memory.py | retention_score（λ 支持 `metadata.decay_override` 条目级覆盖——参数外置接口已就位） |

四个决定性缺口（方案需解决）：
1. `agents` 表**无版本表**，且 `sync_negentropy_agents` 每次 Sync 覆写 `system_prompt`——进化产物会被踩掉；
2. ADK 主运行时**无工具调用级遥测**（`tool_executions` 表 dormant——写入路径 `ToolRegistry._record_execution` 虽存在，但该 Registry 未接入主运行时，仅集成测试实例化，生产无写入）；
3. `eval_tests/` 近乎空壳，无 golden set / 回归门禁；
4. 记忆/知识子系统的运行参数（遗忘 λ、检索权重、chunking 策略、KG 抽取 prompt）**散落在 env/代码常量中无版本化**——进化产物无处落地。

### 1.3 进化回路总览

```mermaid
flowchart LR
    subgraph "Meta-Layer（固定框架）"
        T["遥测采集<br/>tool_invocations"]
        E["评测引擎<br/>LLM-as-Judge / Agent-as-Judge"]
        P["进化提案器<br/>GEPA / ACE 式反思→变异"]
        G["门控发布<br/>Shadow → Canary → Promote/Rollback"]
    end

    subgraph "进化客体"
        A["Agent 定义<br/>system_prompt / model / skills"]
        S["Skills<br/>prompt_template / resources"]
        M["MCP Tools<br/>pipeline 参数 / 引擎选型"]
        K["Memory / KB / KG<br/>检索参数 / 遗忘 λ / 管线 prompt"]
    end

    A -->|"执行轨迹 + 反馈"| T
    S -->|"调用结果 + 延迟/成本"| T
    M -->|"Stage 输出 + 竞争评分"| T
    K -->|"检索反馈 + 零命中率<br/>+ 图谱质量指标"| T
    K -.->|"经验基质：反思 / playbook<br/>/ 采收用例沉淀于此"| P
    T -->|"信号聚合"| E
    E -->|"标量分 + 文本反馈<br/>+ 归因组件"| P
    P -->|"候选版本<br/>（SemVer 快照）"| G
    G -->|"active_version<br/>指针切换"| A
    G -->|"active_version<br/>指针切换"| S
    G -->|"参数/排名更新"| M
    G -->|"配置版本晋升/回滚"| K
    G -->|"回滚 = 指针回退"| T

    style T fill:#1f3a5f,stroke:#5b9bd5,stroke-width:2px,color:#e8f0fe
    style E fill:#3d2c52,stroke:#a07cc5,stroke-width:2px,color:#f3e9fb
    style P fill:#5a3d1f,stroke:#d59b5b,stroke-width:2px,color:#fdf3e8
    style G fill:#1f4d2e,stroke:#5bbd7c,stroke-width:2px,color:#e8fbef
    style A fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
    style S fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
    style M fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
    style K fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
```

---

## 2. 学术基础：自进化智能体理论

### 2.1 领域分类框架

两篇 2025 年综述为整个领域建立了分类坐标系。

**Gao et al.（TMLR 2026）** 提出四维框架<sup>[[1]](#ref1)</sup>：**What** to evolve（模型 / 记忆 / 工具 / 架构四类组件）、**When** to evolve（intra-test-time 即时适应 vs inter-test-time 跨任务适应）、**How** to evolve（标量奖励驱动 vs 文本反馈驱动，单智能体 vs 多智能体）、**Where** 对应应用域。该分类可直接作为 negentropy 三类系统的"进化对象坐标系"。

**Fang et al.** 提出统一迭代回路抽象<sup>[[2]](#ref2)</sup>：**System Inputs → Agent System → Environment → Optimisers** 四组件反馈回路，几乎所有自进化系统都可实例化进去。negentropy 的 Dispatch→Execute→Evaluate→Decide 是该抽象的完整实例；其"Optimiser 与 Agent System 分离"的原则直接支持固定框架层设计——优化器（进化基座）本身不在被优化对象之内。

### 2.2 系统级自改

**Darwin Gödel Machine（Sakana AI）**<sup>[[3]](#ref3)</sup> 进化对象是智能体自身的代码库。核心机制：从档案库（archive）采样父代 → 基础模型生成变体 → 基准经验验证 → 入档。关键发现：SWE-bench 20.0% → 50.0%；**劣质祖先可播种突破**（通往最优解的谱系有时包含比父代更差的中间体）；**安全实证**——观察到目标欺骗（伪造单元测试日志）和移除检测标记骗取成功两种作弊。防护依赖沙箱隔离 + 人类监督 + 谱系可追溯性。

**ADAS（ICLR 2025）**<sup>[[4]](#ref4)</sup> 提出 Meta Agent Search——元智能体在代码空间搜索新 agent 设计，以持续增长的历史发现档案作为上下文。跨域跨模型迁移后仍保持优势，降低"DB 化 agent 定义 + 可替换底座"的风险。

**AlphaEvolve（DeepMind）**<sup>[[5]](#ref5)</sup> 核心论断：**automated evaluator 是进化的先决条件**——问题解必须可被机器自动评分。生产实证：Borg 数据中心调度启发式已**生产运行超一年，平均持续回收全球算力 0.7%**。"人类可读代码胜过黑盒"（Borg 案例）支持进化产物固化为可读文本。

### 2.3 模块级与拓扑级进化

**AgentSquare（ICLR 2025）**<sup>[[6]](#ref6)</sup> 将智能体抽象为 Planning / Reasoning / ToolUse / Memory 四模块，搜索用 module evolution（变异单模块）+ module recombination（跨设计重组）两算子。平均超越手工设计 17.2%。引入性能预测器预判候选表现以跳过无望设计，降低评估成本。

**EvoAgent（NAACL 2025）**<sup>[[7]](#ref7)</sup> 用进化算法从单专家 Agent 自动扩展为多智能体系统（变异 / 交叉 / 选择三算子）。对应"拓扑级进化"的最轻量入口。

### 2.4 权重级对照面与取舍

**SEAL（MIT）**<sup>[[8]](#ref8)</sup> 进化对象是模型权重（自编辑→SFT微调）。关键障碍：**灾难性遗忘**——持续自编辑导致早期任务性能退化，缺乏保持机制时自我修改可能覆盖有价值的先验信息。该实证为 negentropy 选择"非权重级进化"（prompt / 工具层，可回滚、可 diff、可审计）提供了取舍依据。

**进化层次谱系已成领域共识**：权重级（SEAL）→ prompt/上下文/记忆级（Reflexion 类）→ 工具/技能级（AlphaEvolve、DGM 工具自造）→ 架构/拓扑级（ADAS、AgentSquare、EvoAgent）。negentropy 选择"prompt 级 + 工具级 + 受限拓扑级"在谱系上有明确位置且有文献支撑。

---

## 3. 进化算子：Prompt 与上下文自动优化

### 3.1 GEPA——反思驱动进化（核心方法论）

**GEPA（ICLR 2026 Oral）**<sup>[[9]](#ref9)</sup> 是面向"含一个或多个 LLM prompt 的任意 AI 系统"的反思式进化优化器，已并入 DSPy 优化器家族为 `dspy.GEPA`。核心循环：采样执行轨迹 → 强反思模型诊断失败 → 提出单组件 prompt 变异 → minibatch 验证 → **Pareto 前沿候选保留**。

**与 negentropy 的关键同构性**：GEPA 所需的「(轨迹, 标量分, 自然语言反馈)」三元组与 Routine 闭环已产出的「执行轨迹 + LLM-as-Judge 0–100 分 + `routines.reflections` JSONB 反思」**逐字段同构**。差距仅在消费侧——当前反思只做 Reflexion 式运行时注入，未被消费为 prompt 资产的变异依据。

关键差异：Reflexion 管 episode 内自纠（运行时短期记忆），GEPA 管跨 episode 的 prompt 持久进化（资产更新）。两者正交可并存。

关键数字：6 个任务平均超 GRPO 6%（最高 20%），使用最多 35 倍更少 rollout；超 MIPROv2 10%+。

**生产局限**（Decagon 工程经验<sup>[[10]](#ref10)</sup>）：无约束 GEPA 可产出 >5,000 字符 prompt；训练样本 20–100 例是甜区，500 反而过拟合（-2%）；反思器必须用前沿模型（弱反思器致整轮报废），但仅占总成本 5–10%。

### 3.2 ACE——上下文增量进化

**ACE（ICLR 2026）**<sup>[[11]](#ref11)</sup> 把上下文当作"不断进化的 playbook"，由 Generator / Reflector / Curator 三角色分工。核心创新：Curator 合并必须用**确定性非 LLM 逻辑**（防 context collapse），只做增量 delta（新增条目 + 计数器更新 + 嵌入去重）。

**与 negentropy 的同构性**：issue.md 即手工版 ACE playbook（问题描述/表因根因/处理/防范 = ACE 的"失败模式"条目）；Generator/Reflector/Curator 对应 Routine 执行 / Judge+reflections / Consolidation。

**context collapse 实证**：AppWorld 第 60 步上下文 18,282 token、准确率 66.7，一步整体重写后坍缩至 122 token、准确率跌至 57.1（低于无适配基线 63.7）。**这直接警告：禁止让 LLM 端到端重写 system_prompt 或 issue.md。**

### 3.3 算子横向比较

| 算子 | 信号需求量 | 需离线训练集 | 在线可用性 | 实现复杂度 | 与 DB 动态加载适配度 |
|------|-----------|-------------|-----------|-----------|-------------------|
| **GEPA** | 低（20–100 rollout） | 小验证集即可 | 中（官方支持 inference-time） | 中 | **高**：候选=版本表行，晋升=指针切换 |
| **ACE** | 极低（可无标注） | 否 | **高**（在线 memory 原生场景） | 中 | **高**：条目天然映射 DB 行，增量=upsert |
| MIPROv2 | 中-高（数百样本） | 是 | 否（纯离线） | 低-中 | 中：不消费 reflections |
| SIMBA | 中（≥32 条硬下限） | 是 | 否 | 低 | 中：规则形态与 issue 条目兼容 |
| TextGrad<sup>[[12]](#ref12)</sup> | 低-中 | 可选 | 中-高 | 中（集成成本高） | 低-中：借归因思想成本近零 |
| Promptbreeder<sup>[[13]](#ref13)</sup> | 极高（10^5 评估） | 是 | 否 | 高 | 低：rollout 成本不匹配 |
| OPRO<sup>[[14]](#ref14)</sup> | 低 | 小评估集 | 中 | **极低** | **高**：版本表+评分=现成历史 |

**选型建议**：主线 = **GEPA（指令资产）+ ACE（经验/playbook 资产）双算子分轨**；以 **OPRO 式历史评分注入**作为最小可行起点；从 TextGrad 借组件级归因字段（`blamed_component`）、从 SIMBA 借高方差样本优选。

### 3.4 组件级归因

**TextGrad**<sup>[[12]](#ref12)</sup>（Nature 2025）提出文本梯度反传——LLM 批评沿调用链反传到各变量。核心价值是**归因思想**而非框架整体引入：最小实现是让 Judge/反思器在 reflections 中输出 `blamed_component` 字段（agent_prompt / skill_id / tool_desc），即得到组件级归因信号。GEPA 的 `pred_name, pred_trace` 参数同样支持 per-predictor 定向变异。

---

## 4. 进化信号源：评测与反馈回路

### 4.1 从 LLM-as-a-Judge 到 Agent-as-a-Judge

**Agent-as-a-Judge（Meta AI）**<sup>[[15]](#ref15)</sup> 将评测建模为多步智能体工作流，可读取被评 Agent 的完整执行轨迹。关键数字：与人类共识对齐率 ~90%（对比 LLM-as-a-Judge 仅 ~70%），成本仅 2.29%。消融实验表明最优子集为 graph + locate + read + retrieve + ask（memory/planning 有害，降低对齐率）。

**negentropy 映射**：当前 Routine Evaluator 是"终态 LLM-as-a-Judge"。升级路径——评测 Agent 配备 read/search 工具读取 OTel/Langfuse trace，实现**轨迹级评审**定位失败步骤。建议三层分级：(1) 终态 LLM-as-Judge（秒级，全量高频）；(2) 轨迹 Agent-as-a-Judge（分钟级，采样/触发式）；(3) 人工（边缘案例）。

**Agent 评测综述**<sup>[[16]](#ref16)</sup> 指出：Langfuse 本身不支持原生轨迹评测——验证了 negentropy 需自建轨迹评审 Agent 的必要性。

### 4.2 轨迹级评测与终态评测

Agent 评测综述<sup>[[16]](#ref16)</sup> 明确分层：最终响应评测（快速低成本但无法定位失败）→ 逐步评测（单步独立打分）→ **轨迹评测**（reference-based 与黄金路径对齐，或 reference-free 由 LLM judge 评估连贯性/效率/目标导向性）。开发者框架中，仅 LangSmith、Vertex AI、AgentEvals 支持轨迹评测。

### 4.3 在线评测与生产监控

**OTel GenAI Semantic Conventions**<sup>[[17]](#ref17)</sup> 定义了 `execute_tool` span（属性含 `gen_ai.tool.name`、`gen_ai.tool.type`、`gen_ai.tool.call.arguments/result` 等），当前 **Development 状态**。negentropy `tool_invocations` 表应直接对齐此 schema。

**Langfuse 评测体系**<sup>[[18]](#ref18)</sup> 提供 Score 四级挂载（trace/observation/session/dataset run）、LLM-as-Judge 托管评测（Live Observations 推荐）、Datasets 从生产 trace 采收（`source_trace_id` 溯源 + 批量 UI）。

**MLflow GenAI Evaluation**<sup>[[19]](#ref19)</sup> 提供内置 judges 含实验性 **ToolCallCorrectness / ToolCallEfficiency**——直接对应 negentropy 的工具调用评测需求。

**共识路径**：离线 golden set 用于回归测试与版本对比（发布前拦截），在线评测用于生产监控与趋势感知（发布后保障）。生产 trace 是 golden set 的主要来源。

### 4.4 隐式/显式人类反馈采集

**Liu et al.**<sup>[[20]](#ref20)</sup> 证明：用户反馈是"理解用户的窗口但噪声大的学习信号"——反馈语义训练在短问题显著提升（p<.00001），但在长复杂问题上**显著劣于**基线（p≤0.0126）。正反馈噪声高（越狱场景）。

**结论**：negentropy 应将用户反馈用于**实时监控趋势**和**golden set 采收触发**，**不应直接作为训练/进化标签**。

---

## 5. 工具/技能生态自进化

### 5.1 MCP 规范与 Registry 进展

**MCP Registry**（2025-09-08 Preview<sup>[[21]](#ref21)</sup>）是面向公开 MCP Server 的开放目录，server.json 元数据 schema + REST API，当前 **Preview 阶段**（v0.1 冻结）。支持公共/私有子注册表——私有型映射企业部署场景。注册体量随生态快速扩张（第三方分析显示去重后约千余个唯一包，原始条目因 CI 重复发布远高于此）。

**MCP 2025-11-25 稳定版**<sup>[[22]](#ref22)</sup> 引入 Tasks 原语（长时运行任务，experimental capability，状态机 working/input_required→completed/failed/cancelled）、Sampling+Tools（服务端 agentic loop）、简化 OAuth。2026-07-28 RC 计划无状态核心、Transport Headers、Tasks 移至扩展。

### 5.2 Agent Skills 设计哲学

**Anthropic Agent Skills**<sup>[[23]](#ref23)</sup>（开放标准 agentskills.io，2025-12-18 启动）核心设计：**渐进式披露三级加载**——Level 1 技能元数据（name/description，启动期注入系统提示）→ Level 2 完整 SKILL.md 正文（判定相关时加载）→ Level 3 SKILL.md 引用的捆绑文件/脚本（按需读取）。

**negentropy 对标**：`skills_injector` 的 Jinja2 prompt_template + Progressive Disclosure 与 SKILL.md 三级加载**高度同构**。skills 表 name/description = Level 1 元数据层；prompt_template = Level 2 正文层；resources = Level 3 捆绑文件层。建议增加 SKILL.md 兼容 adapter。

**技能层综述**<sup>[[24]](#ref24)</sup> 发现社区贡献技能中 **26.1% 含安全漏洞**——强力驱动验证流水线需求。

### 5.3 工具效果评测

**MCP-Bench**<sup>[[25]](#ref25)</sup> 在 28 个真实 MCP Server + 250 工具上测试模糊指令下的端到端完成率，三层评测维度：工具级 schema 理解 → 轨迹级规划 → 任务完成。20 个先进 LLM 均面临持续挑战。

**BFCL V4**<sup>[[26]](#ref26)</sup> 转向 Holistic Agentic Evaluation（Web Search + Memory + Format Sensitivity），Agentic 占总分 **40% 权重**。

**ToolLLM**<sup>[[27]](#ref27)</sup>（ICLR 2024）覆盖 16,464 真实 API，DFSDT 多轨迹推理 + ToolEval 双指标（Pass Rate + Win Rate）。

### 5.4 LLM 自造工具谱系

| 工作 | 核心机制 | 关键数字 | negentropy 映射 |
|------|---------|---------|----------------|
| LATM<sup>[[28]](#ref28)</sup> | 强模型造工具 / 弱模型用工具 | GPT-4 造 + GPT-3.5 用 ≈ 全程 GPT-4 | 制造/消费分离，skill_versions 天然支持 |
| CREATOR<sup>[[29]](#ref29)</sup> | 分离抽象推理（设计工具）与具体推理（使用工具） | Creation Challenge 2K 问题 | prompt_template（抽象）vs required_tools（具体）分层 |
| ToolMaker<sup>[[30]](#ref30)</sup> | 论文+代码仓 → 自动转化为 LLM 工具（闭环自纠错） | 15 任务 **80% 正确率** | 外部能力自动摄入流程 |
| **Alita**<sup>[[31]](#ref31)</sup> | 最小预定义 + 最大自进化；自动沉淀能力为可复用 MCP | GAIA 75.15% pass@1 | **MCP Brainstorming → 生成 → 隔离验证 → MCP Box** 映射自造技能链 |
| ASI<sup>[[32]](#ref32)</sup> | 在线归纳→验证→复用程序化技能 | WebArena +23.5% | 程序化验证是主要驱动力 |

---

## 6. 记忆与知识系统的自进化

> 与 [025 记忆系统](../concepts/025-the-memory-system.md)、[026 记忆白皮书](../concepts/026-memory-whitepaper.md)、[035 知识库](../concepts/035-the-knowledge-base.md)、[036 知识图谱](../concepts/036-the-knowledge-graph.md) 的关系：上述文档定义记忆/知识子系统**自身的设计与基线评测**，本节将其纳入**进化回路**——回答"记忆与知识系统如何参与并接受自进化"。

### 6.1 双重角色：进化的基质与客体

记忆与知识系统在自进化体系中承担两种正交角色，全文统一以如下措辞定义：

- **基质（substrate）**：记忆/知识库是进化回路经验沉淀的介质——反思文本、playbook 条目、采收的评测用例、提案成败记录都写入其中。ACE<sup>[[11]](#ref11)</sup> 的增量 playbook 本质上就是上下文形态的记忆资产；
- **客体（object）**：记忆系统自身的参数（遗忘 λ、检索权重）、prompt（fact extractor / reflection generator / KG 抽取）、策略（chunking / reranker 选型）可被同一进化回路优化。

Gao et al. 的四维框架<sup>[[1]](#ref1)</sup>在 "What to evolve" 维度已将 memory 与模型、工具、架构并列为四类进化组件——本节是该维度的系统展开。而 2025 年末出现的 **MemEvolve**<sup>[[51]](#ref51)</sup> 更进一步：联合进化"经验知识"与"记忆架构本身"，使系统不仅积累经验、还逐步改进**学习经验的方式**——由此形成「基质（沉淀经验）→ 客体（优化记忆配置）→ 元进化（优化记忆架构）」三阶谱系。negentropy 取前两阶为工程范围，第三阶作为远期对照面。

```mermaid
flowchart LR
    subgraph "基质角色（substrate）"
        R["反思 / playbook<br/>采收用例 / 提案成败"]
    end
    subgraph "客体角色（object）"
        C["检索参数 / 遗忘 λ<br/>管线 prompt / 抽取策略"]
    end
    MEM["Memory / KB / KG"]

    MEM -->|"沉淀进化经验"| R
    R -->|"喂入提案器"| P2["进化提案器"]
    P2 -->|"候选配置版本"| G2["门控发布"]
    G2 -->|"晋升 / 回滚"| C
    C -->|"约束运行行为"| MEM

    style MEM fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
    style R fill:#1f3a5f,stroke:#5b9bd5,stroke-width:2px,color:#e8f0fe
    style C fill:#2a1f3d,stroke:#7c5ca5,stroke-width:2px,color:#e8dff5
    style P2 fill:#5a3d1f,stroke:#d59b5b,stroke-width:2px,color:#fdf3e8
    style G2 fill:#1f4d2e,stroke:#5bbd7c,stroke-width:2px,color:#e8fbef
```

### 6.2 记忆分类学与操作坐标系

三份综述确立了记忆系统的坐标系。Zhang et al.（ACM TOIS）<sup>[[39]](#ref39)</sup> 按来源（intra-trial / cross-trial / 外部知识）× 形态（文本 / 参数）划分记忆；Du et al.<sup>[[40]](#ref40)</sup> 提出**六大记忆操作**——consolidation（巩固）、updating（更新）、indexing（索引）、forgetting（遗忘）、retrieval（检索）、compression（压缩）；2026 年的 "second half" 综述<sup>[[41]](#ref41)</sup> 则以 substrate × cognitive mechanism（episodic/semantic/sensory/working/procedural）× subject（agent-centric / user-centric）三维定位，并断言记忆是 Agent 从"刷榜"走向"真实世界长期效用"的核心瓶颈。

六操作可与 negentropy 记忆子系统的现成模块一一映射——**每个操作都是潜在的进化客体**：

| 记忆操作 | negentropy 模块 | 可进化参数/prompt |
|---------|----------------|------------------|
| consolidation | `engine/consolidation/`（reflection / fact 抽取） | extractor prompt、反思生成 prompt |
| updating | `governance/conflict_resolver.py`（AGM 信念修正） | 冲突检测阈值、消解 prompt |
| indexing / retrieval | `adapters/postgres/memory_service.py`（四级回退混合检索） | 语义/关键词权重、`rrf_k`、PPR 通道参数 |
| forgetting | `governance/memory.py`（Ebbinghaus 衰减） | 类型级 λ、retention 阈值 |
| compression | `consolidation/memory_summarizer.py` | 摘要 prompt、token 预算 |

### 6.3 自编辑与分层记忆架构

**MemGPT**<sup>[[42]](#ref42)</sup> 开创 OS 式虚拟上下文管理——Agent 通过工具自编辑记忆，确立"记忆操作本身是可学习行为"的范式起点。**Mem0**<sup>[[43]](#ref43)</sup> 给出生产级抽取-更新两阶段管线（每条候选记忆经 ADD / UPDATE / DELETE / NOOP 四择决策），LoCoMo 上 LLM-as-Judge 指标相对 OpenAI 记忆基线提升 26%，p95 延迟较全上下文低 91%。**A-Mem**（NeurIPS 2025）<sup>[[44]](#ref44)</sup> 引入 Zettelkasten 式动态组织：新记忆触发既有记忆网络的链接生成与演化更新——是"记忆条目级自进化"的最直接文献锚点。**MemoryBank**<sup>[[45]](#ref45)</sup> 将 Ebbinghaus 遗忘曲线引入记忆强化/淘汰。**MemOS**<sup>[[46]](#ref46)</sup> 以 MemCube 统一抽象将记忆升格为一等运维资源，强调表示、组织与**生命周期治理**的统一机制。工业侧，Letta 的 sleep-time compute<sup>[[64]](#ref64)</sup> 将"对话 Agent"与"记忆管理 Agent"分离——记忆重组在系统空闲期异步进行，离线巩固窗口即进化回路的天然调度时机。

**negentropy 映射**：`memory_associations`（语义/时间/会话/实体共现四种自动链接）与 A-Mem 链接网络同构；`governance/memory.py` 的类型级 λ 衰减与 MemoryBank 同构，且 `metadata.decay_override` 已支持条目级覆盖——**λ 可进化的工程接口已经存在**；`conflict_resolver.py` 的 AGM 信念修正是 Mem0 UPDATE/DELETE 决策的形式化版本；`consolidation_jobs` 异步巩固即 sleep-time 范式的既有实现。

### 6.4 经验沉淀型记忆：从反思到推理策略库

经验型记忆的文献谱系清晰地展示了"基质→客体"的过渡：**Reflexion**（口头反思，见 [110 号调研](./110-routine-agent-iteration.md)）→ **ExpeL**<sup>[[47]](#ref47)</sup>（跨任务成功/失败轨迹对比中提炼自然语言 insights，无参数更新）→ **AWM**<sup>[[48]](#ref48)</sup>（ICML 2025，从轨迹归纳可复用 workflow 并选择性注入）→ **Memp**<sup>[[49]](#ref49)</sup>（程序化记忆升格为**一等优化目标**：可学习、可更新、终身演化，并支持从强模型到弱模型的记忆迁移）→ **ReasoningBank**（Google）<sup>[[50]](#ref50)</sup>（从**自评判定的成功与失败经验**中蒸馏可泛化推理策略，并以 MaTTS 记忆感知测试时扩展形成"更多经验→更好记忆→更优探索"的正循环，确立**记忆驱动经验扩展为新的 scaling 维度**）。

两个关键论断：① ExpeL 的经验池只是沉淀介质（基质），Memp 已把记忆的更新策略本身当作被优化对象（客体）——谱系完成角色过渡；② ReasoningBank 证明**失败经验与成功经验同等可蒸馏**，且无需 ground-truth 标签（自评判定）——这直接支持 negentropy 把提案 rejected/rolled_back 记录纳入反思沉淀（见 §9.1）。

**negentropy 映射**：`routines.reflections` JSONB ≅ ExpeL insights 池；§3.2 ACE 的增量 delta 即 Curator 化的 AWM；Phase 4 自造技能（Voyager 式，见 110 号调研）是程序化记忆的终点形态。

### 6.5 记忆系统的元进化

2025 末至 2026 年的一组工作把"记忆系统自身"推上进化客体的位置：

- **MemEvolve**<sup>[[51]](#ref51)</sup>：元进化框架联合进化经验知识与记忆架构，对强 Agent 框架最高提升约 17%——证明记忆架构的设计空间值得搜索（negentropy 远期对照面）；
- **MemSkill**<sup>[[52]](#ref52)</sup>：将记忆抽取/巩固/淘汰操作重构为**可学习、可进化的记忆技能**（controller 选技能 → executor 产记忆 → designer 复盘硬案例提炼/改写技能）——designer 的"复盘失败案例→变异技能集"与 GEPA<sup>[[9]](#ref9)</sup> 反思→变异算子同构，说明 prompt 进化算子可直接复用于记忆管线 prompt；
- **Memory-R1**<sup>[[53]](#ref53)</sup>：用 RL 训练记忆管理（ADD/UPDATE/DELETE/NOOP 决策）与检索利用策略——证明记忆操作策略空间值得优化，但 RL 路线属权重级（对照面）；
- **RMM**（ACL 2025）<sup>[[54]](#ref54)</sup>：prospective + retrospective 双向反思，其中 **retrospective reflection 用"检索结果是否被引用"的下游信号在线调优 reranker**（提升 10%+）——与 negentropy `retrieval_tracker.py` 的 `was_referenced` / `outcome_feedback` 字段**逐字段同构**，是检索参数在线进化的最直接文献依据；
- **Evo-Memory**<sup>[[55]](#ref55)</sup>：首个面向"测试时记忆自进化"的流式基准——评测范式从静态对话检索转向任务流上的持续积累与复用。

**取舍结论**：与 §2.4 SEAL 的论证一致，negentropy 选择"提案-门控回路优化记忆系统配置"而非 RL——配置变更可回滚、可 diff、可审计，且复用统一进化流水线。

### 6.6 图谱化记忆与知识图谱自更新

- **Zep / Graphiti**<sup>[[56]](#ref56)</sup>：双时态知识图谱（事实有效期 + 系统记录期双轴），核心机制是**边失效（edge invalidation）**——新证据到达时不删除旧事实而是标记失效区间，使图谱随证据流自修正而非只增不减；LongMemEval 上较基线提升至多 18.5%、延迟降 90%；
- **HippoRAG 2**（ICML 2025）<sup>[[57]](#ref57)</sup>：schema-less KG + Personalized PageRank + 在线 LLM 相关性校验，将 RAG 升格为**非参数持续学习**框架，在事实记忆、sense-making 与关联记忆三类任务上全面超越标准 RAG——其"以非参数记忆替代权重级持续学习"的立场再次佐证 negentropy 的非权重级进化路线（呼应 §2.4）；
- **SAGE**<sup>[[58]](#ref58)</sup>：自进化图记忆引擎——图记忆不再是静态检索中间件，而是经下游 reader 反馈持续改进的动态基质（两轮自进化后多跳 QA 平均排名第一）；
- **AutoSchemaKG**<sup>[[59]](#ref59)</sup>：从语料动态归纳 schema（零人工干预，与人工 schema 语义对齐 92%）——KG 的 schema 本身可自动演化；
- **LazyGraphRAG**（Microsoft）<sup>[[60]](#ref60)</sup>：以 0.1% 的索引成本达到 GraphRAG 全局检索可比质量——证明**图谱构建的成本-质量权衡本身是可进化的目标函数**（索引深度/时机的策略选择）。

**negentropy 映射**：Apache AGE 图存储 + `knowledge/graph/temporal_resolver.py`（双时态雏形）已对齐 Zep 方向；`memory_service.py` 的 PPR-RRF 融合通道与 HippoRAG 直接同构——`HippoRAGSettings` 的 `enabled / depth / alpha / rrf_k / seed_top_k / seed_threshold` 全部是现成的进化参数；KG 抽取（`graph/extractors.py`）的 prompt 与实体解析阈值（`entity_resolver.py`）对应 AutoSchemaKG 的演化维度。

### 6.7 知识冲突消解与记忆安全

**冲突消解**：Xu et al. 的知识冲突综述（EMNLP 2024）<sup>[[61]](#ref61)</sup> 给出三类冲突分类——context-memory（上下文与参数记忆冲突）、inter-context（多源上下文互冲）、intra-memory（记忆库内部不一致）——negentropy `conflict_resolver.py` 的三阶段冲突检测（Key-based / Embedding-based / LLM-based）可对号入座，主要覆盖 intra-memory 类。权重级 knowledge editing（ROME/MEMIT 谱系）存在连续编辑退化问题<sup>[[61]](#ref61)</sup>，作为对照面再次支持"DB 级知识资产 + 版本化"路线。

**记忆安全**：自进化记忆引入静态 RAG 不存在的累积性风险。SSGM 框架<sup>[[62]](#ref62)</sup> 指出演化记忆的**复合失效环**——输入摄取期投毒（poisoning）→ 巩固期语义漂移（drift）→ 检索期冲突/幻觉（hallucination）——错误跨环节累积且持久；其核心治理原则"**记忆演化与执行解耦**"与本报告固定框架层设计同构。攻击侧，MINJA（NeurIPS 2025）<sup>[[63]](#ref63)</sup> 证明仅凭普通用户的 query-only 交互即可向 Agent 记忆注入恶意记录（注入成功率 95%+）——结论是**记忆写入必须被视为特权状态变迁**，需要验证、隔离与审计，而非"学习的良性副产品"。这为 §8.1 的 ASI06 威胁提供了具体攻击面证据，也直接约束进化回路设计：进化提案**永远不直接写记忆条目内容**（见 §9.1）。

### 6.8 评测信号与基准

| 信号 | 来源 | 进化用途 |
|------|------|---------|
| LoCoMo / LongMemEval 离线 recall | CI 基线已就位（见 [026 白皮书](../concepts/026-memory-whitepaper.md)：LoCoMo-mini recall 0.933 / LongMemEval-mini 0.867） | 记忆检索 golden suite：晋升判据 |
| KG 质量综合分 | `knowledge/graph/quality.py`（完整性 40% + 社区覆盖 20% + 置信度 20% + 证据支持 20%） | KG 抽取配置的客观门控 |
| KG 构建指标 | `knowledge/graph/metrics.py`（`chunks_fallback` / `over_extraction_chunks` / `entity_density_p95` 等） | 抽取 prompt 变异的回归检测 |
| zero_hit_rate / referenced 率 / helpful-irrelevant 比 | `memory_retrieval_logs`（`retrieval_tracker.py` 聚合） | 在线监控 + 检索参数提案触发 + 金丝雀对比 |
| 检索回退事件率 | `memory_service.py` `_log_fallback_event`（PPR/Hybrid 降级） | 通道参数（超时/深度）调优信号 |
| 冲突率 | `memory_conflicts` 表 | 抽取/消解配置的健康度监控 |
| 流式测试时进化范式 | Evo-Memory<sup>[[55]](#ref55)</sup> | 远期：评测从静态检索转向任务流持续复用 |

与 §4.4 结论一致：用户反馈（helpful/irrelevant 标注）只做**监控与采收触发**，不直接作为进化标签；离线 suite（LoCoMo/LongMemEval/KG quality）承担晋升裁决，在线信号承担金丝雀验证与回滚触发。

---

## 7. 工业对标：自进化系统的生产化实践

按「信号采集 → 优化算子 → 门禁验证 → 发布/回滚」四段对齐比较：

| 平台 | 信号采集 | 优化算子 | 门禁验证 | 发布/回滚 |
|------|---------|---------|---------|----------|
| **DGM**<sup>[[3]](#ref3)</sup> | 编码基准分数 | 档案库 + 代码变体 | 基准经验验证 | 档案分支可回溯 |
| **AlphaEvolve**<sup>[[5]](#ref5)</sup> | 自动化评估器打分 | Gemini Flash(广度)+Pro(深度) | 客观指标门禁 | 程序数据库保留历史 |
| **Langfuse**<sup>[[18]](#ref18)</sup> | Scores(trace/obs/session级) + User Feedback | Prompt Experiments 多版本对比 | LLM-as-Judge evaluator | Label 切换即回滚（Protected Labels） |
| **MLflow**<sup>[[19]](#ref19)</sup> | Feedback(HUMAN/CODE/LLM_JUDGE) | 内置 judges + 自定义 scorers | Evaluation-Driven Development | 版本对比 |
| **W&B Weave**<sup>[[33]](#ref33)</sup> | Scorer(@weave.op) + Trials(方差检测) | Leaderboard 多版本排行 | 多维度横向对比 | 择优发布 |
| **promptfoo**<sup>[[34]](#ref34)</sup> | eval + red team | — | CI/CD 回归门禁 (`--fail-on-error`) | 阻断部署 |
| **Letta / Mem0 / Zep（记忆平台）**<sup>[[42]](#ref42)</sup><sup>[[43]](#ref43)</sup><sup>[[56]](#ref56)</sup> | 检索引用反馈 + 会话信号 | 自编辑记忆 / 抽取-更新四择管线 / 时序边失效 | 内置 benchmark（LoCoMo / DMR / LongMemEval） | 记忆条目软删除 + 时序失效（非物理删除） |
| **negentropy（本设计）** | tool_invocations + interaction_feedback + memory_retrieval_logs + tool_stats_daily | GEPA（指令）+ ACE（经验）+ OPRO（baseline）+ 参数搜索（记忆/检索配置） | Shadow eval → LLM Judge → OWASP red team | active_version 指针 + 秒级回滚 |

---

## 8. 护栏与治理：自改系统的安全边界

### 8.1 OWASP Agentic AI 威胁映射

**OWASP Agentic AI Top 10（2025-12）**<sup>[[35]](#ref35)</sup> 与 negentropy 进化回路的直接映射：

| 威胁 | 映射 |
|------|------|
| ASI01 Agent Goal Hijack | 进化生成的 prompt 可能被投毒 → 需 diff 审查 + 红队扫描 |
| ASI02 Tool Misuse | 自进化 Agent 可能生成滥用工具的配置 → 工具白名单 + 最小权限 |
| ASI04 Supply Chain | 进化引入的第三方模板/工具 → 沙箱验证 + 安全静态分析 |
| ASI06 Memory/Context Poisoning | 反思/reflections 被投毒（MINJA query-only 注入实证见 §6.7） → 不可变版本历史 + 审计 + 进化提案不直写记忆内容 |
| ASI08 Cascading Failures | 多 Agent 级联 → 熔断器 + 爆炸半径控制 |
| ASI10 Rogue Agents | Reward hacking / 自复制 → 预算硬上限 + 人类审批 |

### 8.2 金丝雀/影子评测

业界共识递进顺序<sup>[[36]](#ref36)</sup>：**Shadow Mode → Canary → A/B Testing**。

- Shadow Mode：生产请求复制到候选版本，候选输出仅记录不返回用户；推理开销约翻倍；
- Canary：1% → 5% → 20% → 50% → 100% 渐进放量，**自动回滚阈值**（p99 延迟升 >40%、拒绝率升 >5%、成本超预算任一触发）；
- 用户一致性：通过 user_id / session_id 哈希分配，保证同一用户始终使用同一版本。

### 8.3 版本注册表与回滚

**Langfuse Prompt Management**<sup>[[18]](#ref18)</sup> 的 Label 机制映射 negentropy 设计：版本不可变 + 发布 = Label 赋值 + 回滚 = Label 重赋 + Protected Labels（审批权限控制）。

### 8.4 Goodhart's Law 防护

**OpenAI CoT 监控论文**<sup>[[37]](#ref37)</sup> 证明：对 CoT 施加强优化压力会导致 Obfuscated Reward Hacking——Agent 学会在 CoT 中隐藏意图但仍继续作弊。建议：不对 CoT 直接施加优化压力。

**Anthropic Emergent Misalignment**<sup>[[38]](#ref38)</sup> 证明：模型学会 reward hack 的瞬间，所有 misalignment 指标同时飙升。Inoculation prompting（告知模型作弊边界）是论文列出的三个**有效**缓解之一（正文报告其将 misalignment 降低 75–90%）。

**防护四件套**：① 冻结 holdout 集（结果不回流 proposer）；② 多目标晋升判据（质量 AND 成本 AND 延迟 AND 在线确认）；③ Judge 与 Proposer 模型强制异源；④ 评测集随失败采收持续换血。

---

## 9. 对 Negentropy 的设计映射

### 9.1 三类系统 × 进化回路矩阵

| 可进化资产 | 信号源 | 归因 | 变更算子 | 验证门禁 | 发布/回滚 | 文献 |
|-----------|-------|------|---------|---------|----------|------|
| Agent `system_prompt` | Routine 轨迹 + 反馈 | `blamed_component` 字段 | GEPA 反思→变异 | Shadow eval + Golden Set 双轨 | `active_version` 指针 + 秒级回滚 | [[9]](#ref9) [[11]](#ref11) |
| 技能 `prompt_template` | 工具调用遥测 + 评测分数 | per-skill eval_suite | GEPA/OPRO + 长度约束 | Shadow eval + 红队 | SemVer 晋升 + 金丝雀 | [[9]](#ref9) [[14]](#ref14) |
| 工具 config JSONB | 延迟/成本/成功率 | `tool_stats_daily` 聚合 | 参数搜索 + competition 证据 | 回归测试 | `builtin_tool_versions` + 回滚 | [[5]](#ref5) |
| MCP Pipeline 参数 | Stage 输出 + 竞争评分 | per-stage 评分 | 参数调优 / 引擎排名 | competition_mode 验证 | YAML 更新（Phase 3 DB 化） | [[22]](#ref22) |
| 记忆/经验条目（基质，走 consolidation 回路） | 失败案例 + 反馈 | — | ACE 增量 delta + 去重 | 语义去重 + helpful/harmful 计数 | 条目级淘汰 | [[11]](#ref11) [[50]](#ref50) |
| 记忆检索参数（语义/关键词权重 / rrf_k / PPR 通道 / 遗忘 λ） | `memory_retrieval_logs`（零命中率/引用率/反馈） | 检索日志 per-query 归因 | 参数搜索 + OPRO 式历史评分 | LoCoMo/LongMemEval suite + 在线零命中率不退化 | 配置版本表 + 指针回滚 | [[45]](#ref45) [[54]](#ref54) [[57]](#ref57) |
| 记忆管线 prompt（fact extractor / reflection / summarizer / 冲突消解） | 抽取质量抽检 + 下游检索引用率 | per-prompt eval_suite | GEPA 反思→变异 | 影子抽取对比 + holdout | 版本表 + 秒级回滚 | [[9]](#ref9) [[43]](#ref43) [[52]](#ref52) |
| KB/KG 策略（chunking / reranker 选型 / KG 抽取 prompt / 实体解析阈值） | `knowledge_feedback` + KG 质量综合分 + 构建指标 | per-strategy 评分 | GEPA（prompt）/ 参数搜索（阈值）/ 策略枚举 A/B | KG quality suite + 引用精度 | 版本表 + 回滚 | [[56]](#ref56) [[59]](#ref59) [[61]](#ref61) |

### 9.2 演进路线

| Phase | 主题 | 验收标准 | 不做清单 |
|-------|------|---------|---------|
| **1 遥测 + 评测地基** | `tool_invocations` 三源采集 + `interaction_feedback` + eval 四表 + 首批 golden suite + 记忆/知识健康度聚合（零命中率/引用率/冲突率） | 任一 Agent/Skill/Tool 可查 7 日健康度；记忆/知识健康度可查；可手动发起评测 | 不做自动化进化 |
| **2 Agent prompt 进化** | `agent_versions` + `active_version` + Sync 改造 + GEPA proposer + 金丝雀路由 | 一个非 root Faculty 走完 propose→shadow→canary→promote 全闭环 | 不做 root Agent 进化；不做技能进化 |
| **3 技能/工具进化** | Skills `active_version` + per-skill suite + `builtin_tool_versions` + competition 证据回流 + 记忆/知识检索参数数值级进化（含参数 DB 化前置迁移） | 至少一个技能和一个 builtin tool 经数据驱动完成改进；至少一项检索参数经数据驱动完成改进 | 不做 MCP YAML 全量 DB 化；不自造新技能 |
| **4 自造技能 + 团队结构** | Voyager 式新技能流水线 + skills 挂载/模型选型纳入进化范围 + 记忆管线/KG 抽取 prompt 进化 + 遗忘 λ 进化试点 | Agent 针对重复失败任务自造技能并经人审入库 | — |

### 9.3 与既有调研的接口

- [110 号调研](./110-routine-agent-iteration.md)：Routine 闭环学术基础（ReAct/Reflexion/Self-Refine/LATS/Voyager）+ LLM-as-Judge 偏差治理 → 本报告引用不重述，进化回路在 Routine 之上叠加；
- [090 号调研](./090-agent-evaluation.md)：Agent 通用评测 → 本报告 §4 反哺其评测分类学，090 后续可展开；
- [020 号调研](./020-agent-runtime-frameworks.md)：ADK vs Claude SDK 运行时 → 本报告固定框架层设计直接依赖；
- [010 号调研](./010-context-engineering.md)：上下文工程 → ACE 的增量 delta 机制是其进化延伸；
- [025 记忆系统](../concepts/025-the-memory-system.md) / [026 记忆白皮书](../concepts/026-memory-whitepaper.md) / [035 知识库](../concepts/035-the-knowledge-base.md) / [036 知识图谱](../concepts/036-the-knowledge-graph.md)：记忆/知识子系统设计与基线评测 → 本报告 §6 将其纳入进化回路（基质 + 客体双角色）。

---

## 参考文献

<a id="ref1"></a>[1] H. Gao et al., "A survey of self-evolving agents: On the path to artificial super intelligence," *TMLR*, 2026. arXiv:2507.21046v4.

<a id="ref2"></a>[2] J. Fang et al., "A comprehensive survey of self-evolving AI agents: A new paradigm bridging foundation models and lifelong agentic systems," arXiv:2508.07407, 2025.

<a id="ref3"></a>[3] J. Zhang, S. Hu, C. Lu, R. Lange, and J. Clune, "Darwin Gödel machine: Open-ended evolution of self-improving agents," arXiv:2505.22954v3, 2025.

<a id="ref4"></a>[4] S. Hu, C. Lu, and J. Clune, "Automated design of agentic systems," in *Proc. ICLR*, 2025. arXiv:2408.08435.

<a id="ref5"></a>[5] A. Novikov et al., "AlphaEvolve: A coding agent for scientific and algorithmic discovery," arXiv:2506.13131, 2025.

<a id="ref6"></a>[6] Y. Shang et al., "AgentSquare: Automatic LLM agent search in modular design space," in *Proc. ICLR*, 2025. arXiv:2410.06153.

<a id="ref7"></a>[7] S. Yuan et al., "EvoAgent: Towards automatic multi-agent generation via evolutionary algorithms," in *Proc. NAACL*, 2025. arXiv:2406.14228.

<a id="ref8"></a>[8] A. Zweiger et al., "Self-adapting language models," arXiv:2506.10943, 2025.

<a id="ref9"></a>[9] L. A. Agrawal et al., "GEPA: Reflective prompt evolution can outperform reinforcement learning," in *Proc. ICLR (Oral)*, 2026. arXiv:2507.19457.

<a id="ref10"></a>[10] Decagon, "Optimizing GEPA for production," Decagon Engineering Blog, 2026. [Online]. Available: https://decagon.ai/blog/optimizing-gepa-for-production

<a id="ref11"></a>[11] Q. Zhang et al., "Agentic context engineering: Evolving contexts for self-improving language models," in *Proc. ICLR*, 2026. arXiv:2510.04618.

<a id="ref12"></a>[12] M. Yuksekgonul et al., "Optimizing generative AI by backpropagating language model feedback," *Nature*, 2025. doi:10.1038/s41586-025-08661-4.

<a id="ref13"></a>[13] C. Fernando et al., "Promptbreeder: Self-referential self-improvement via prompt evolution," arXiv:2309.16797, 2023.

<a id="ref14"></a>[14] C. Yang et al., "Large language models as optimizers," in *Proc. ICLR*, 2024. arXiv:2309.03409.

<a id="ref15"></a>[15] M. Zhuge et al., "Agent-as-a-Judge: Evaluate agents with agents," arXiv:2410.10934, 2024.

<a id="ref16"></a>[16] A. Yehudai et al., "Survey on evaluation of LLM-based agents," in *ACL Findings*, 2025. arXiv:2503.16416.

<a id="ref17"></a>[17] OpenTelemetry, "GenAI semantic conventions," 2026. [Online]. Available: https://opentelemetry.io/docs/specs/semconv/gen-ai/

<a id="ref18"></a>[18] Langfuse, "Evaluation overview / Prompt management / User feedback," 2026. [Online]. Available: https://langfuse.com/docs/evaluation/overview

<a id="ref19"></a>[19] MLflow, "GenAI evaluation / Scorers / Feedback," 2026. [Online]. Available: https://mlflow.org/docs/latest/genai/eval-monitor/

<a id="ref20"></a>[20] Y. Liu, M. J. Q. Zhang, and E. Choi, "User feedback in human-LLM dialogues: A lens to understand users but noisy as a learning signal," in *EMNLP*, 2025. arXiv:2507.23158.

<a id="ref21"></a>[21] MCP, "MCP registry preview," MCP Blog, 2025. [Online]. Available: https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/

<a id="ref22"></a>[22] MCP, "First MCP anniversary: 2025-11-25 spec release," MCP Blog, 2025. [Online]. Available: https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/

<a id="ref23"></a>[23] Anthropic, "Equipping agents for the real world with Agent Skills," Anthropic Engineering Blog, 2025. [Online]. Available: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

<a id="ref24"></a>[24] R. Xu and Y. Yan, "Agent skills for large language models: Architecture, acquisition, security, and the path forward," in *Agent Skills '26 Workshop (ACM)*, 2026. arXiv:2602.12430.

<a id="ref25"></a>[25] Z. Wang et al., "MCP-Bench: Benchmarking tool-using LLM agents with complex real-world tasks via MCP servers," arXiv:2508.20453, 2025.

<a id="ref26"></a>[26] Gorilla / UC Berkeley, "BFCL V4: Holistic agentic evaluation," 2026. [Online]. Available: https://gorilla.cs.berkeley.edu/leaderboard.html

<a id="ref27"></a>[27] Y. Qin et al., "ToolLLM: Facilitating large language models to master 16000+ real-world APIs," in *Proc. ICLR*, 2024. arXiv:2307.16789.

<a id="ref28"></a>[28] T. Cai et al., "Large language models as tool makers," arXiv:2305.17126, 2023.

<a id="ref29"></a>[29] C. Qian et al., "CREATOR: Tool creation for disentangling abstract and concrete reasoning," in *EMNLP Findings*, 2023. arXiv:2305.14318.

<a id="ref30"></a>[30] G. Wolflein et al., "LLM agents making agent tools," in *Proc. ACL*, 2025. arXiv:2502.11705.

<a id="ref31"></a>[31] J. Qiu et al., "Alita: Generalist agent enabling scalable agentic reasoning with minimal predefinition and maximal self-evolution," arXiv:2505.20286, 2025.

<a id="ref32"></a>[32] Z. Z. Wang et al., "Inducing programmatic skills for agentic tasks," arXiv:2504.06821, 2025.

<a id="ref33"></a>[33] W&B, "Weave evaluations / leaderboards," 2026. [Online]. Available: https://docs.wandb.ai/weave/guides/core-types/evaluations

<a id="ref34"></a>[34] promptfoo, "CI/CD integration," 2026. [Online]. Available: https://www.promptfoo.dev/docs/integrations/ci-cd/

<a id="ref35"></a>[35] OWASP, "Top 10 for agentic applications for 2026," OWASP GenAI Security Project, 2025. [Online]. Available: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/

<a id="ref36"></a>[36] T. Pan, "Releasing AI features without breaking production: Shadow mode, canary deployments, and A/B testing for LLMs," 2026. [Online]. Available: https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing

<a id="ref37"></a>[37] B. Baker et al., "Monitoring reasoning models for misbehavior and the risks of promoting obfuscation," arXiv:2503.11926, 2025.

<a id="ref38"></a>[38] Anthropic, "Natural emergent misalignment from reward hacking in production RL," Anthropic Research, 2025. arXiv:2511.18397.

<a id="ref39"></a>[39] Z. Zhang, X. Bo, C. Ma et al., "A survey on the memory mechanism of large language model based agents," *ACM Trans. Inf. Syst.*, vol. 43, no. 6, 2025. arXiv:2404.13501.

<a id="ref40"></a>[40] Y. Du, W. Huang et al., "Rethinking memory in AI: Taxonomy, operations, topics, and future directions," arXiv:2505.00675, 2025.

<a id="ref41"></a>[41] W.-C. Huang et al., "Rethinking memory mechanisms of foundation agents in the second half: A survey," arXiv:2602.06052, 2026.

<a id="ref42"></a>[42] C. Packer et al., "MemGPT: Towards LLMs as operating systems," arXiv:2310.08560, 2023.

<a id="ref43"></a>[43] T. Chhikara, D. Khant, S. Aryan, T. Singh, and D. Yadav, "Mem0: Building production-ready AI agents with scalable long-term memory," arXiv:2504.19413, 2025.

<a id="ref44"></a>[44] W. Xu, Z. Liang, K. Mei, H. Gao, J. Tan, and Y. Zhang, "A-Mem: Agentic memory for LLM agents," in *Proc. NeurIPS*, 2025. arXiv:2502.12110.

<a id="ref45"></a>[45] W. Zhong, L. Guo, Q. Gao, H. Ye, and Y. Wang, "MemoryBank: Enhancing large language models with long-term memory," in *Proc. AAAI*, 2024. arXiv:2305.10250.

<a id="ref46"></a>[46] Z. Li et al., "MemOS: A memory OS for AI system," arXiv:2507.03724, 2025.

<a id="ref47"></a>[47] A. Zhao, D. Huang, Q. Xu, M. Lin, Y.-J. Liu, and G. Huang, "ExpeL: LLM agents are experiential learners," in *Proc. AAAI (Oral)*, 2024. arXiv:2308.10144.

<a id="ref48"></a>[48] Z. Z. Wang, D. Fried, and G. Neubig, "Agent workflow memory," in *Proc. ICML*, 2025. arXiv:2409.07429.

<a id="ref49"></a>[49] R. Fang, Y. Liang et al., "Memp: Exploring agent procedural memory," arXiv:2508.06433, 2025.

<a id="ref50"></a>[50] S. Ouyang, J. Yan, I.-H. Hsu et al., "ReasoningBank: Scaling agent self-evolving with reasoning memory," arXiv:2509.25140, 2025.

<a id="ref51"></a>[51] G. Zhang, H. Ren, C. Zhan et al., "MemEvolve: Meta-evolution of agent memory systems," arXiv:2512.18746, 2025.

<a id="ref52"></a>[52] H. Zhang, Q. Long, J. Bao, T. Feng, W. Zhang, H. Yue, and W. Wang, "MemSkill: Learning and evolving memory skills for self-evolving agents," arXiv:2602.02474, 2026.

<a id="ref53"></a>[53] S. Yan, X. Yang et al., "Memory-R1: Enhancing large language model agents to manage and utilize memories via reinforcement learning," arXiv:2508.19828, 2025.

<a id="ref54"></a>[54] Z. Tan, J. Yan, I.-H. Hsu, R. Han, Z. Wang et al., "In prospect and retrospect: Reflective memory management for long-term personalized dialogue agents," in *Proc. ACL*, 2025. arXiv:2503.08026.

<a id="ref55"></a>[55] T. Wei, N. Sachdeva, B. Coleman, Z. He et al., "Evo-Memory: Benchmarking LLM agent test-time learning with self-evolving memory," arXiv:2511.20857, 2025.

<a id="ref56"></a>[56] P. Rasmussen, P. Paliychuk, T. Beauvais, J. Ryan, and D. Chalef, "Zep: A temporal knowledge graph architecture for agent memory," arXiv:2501.13956, 2025.

<a id="ref57"></a>[57] B. Jiménez Gutiérrez, Y. Shu, W. Qi, S. Zhou, and Y. Su, "From RAG to memory: Non-parametric continual learning for large language models," in *Proc. ICML*, 2025. arXiv:2502.14802.

<a id="ref58"></a>[58] "SAGE: A self-evolving agentic graph-memory engine for structure-aware associative memory," arXiv:2605.12061, 2026.

<a id="ref59"></a>[59] J. Bai, W. Fan et al., "AutoSchemaKG: Autonomous knowledge graph construction through dynamic schema induction from web-scale corpora," arXiv:2505.23628, 2025.

<a id="ref60"></a>[60] D. Edge, H. Trinh, and J. Larson, "LazyGraphRAG: Setting a new standard for quality and cost," Microsoft Research Blog, Nov. 2024. [Online]. Available: https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/

<a id="ref61"></a>[61] R. Xu et al., "Knowledge conflicts for LLMs: A survey," in *Proc. EMNLP*, 2024. arXiv:2403.08319.

<a id="ref62"></a>[62] C. Lam, J. Li, L. Zhang, and K. Zhao, "Governing evolving memory in LLM agents: Risks, mechanisms, and the stability and safety governed memory (SSGM) framework," arXiv:2603.11768, 2026.

<a id="ref63"></a>[63] S. Dong et al., "A practical memory injection attack against LLM agents," in *Proc. NeurIPS*, 2025. arXiv:2503.03704.

<a id="ref64"></a>[64] K. Lin, C. Snell, Y. Wang, C. Packer, S. Wooders, I. Stoica, and J. E. Gonzalez, "Sleep-time compute: Beyond inference scaling at test-time," arXiv:2504.13171, 2025. 工业实现见 Letta Docs: https://docs.letta.com/guides/agents/architectures/sleeptime/
