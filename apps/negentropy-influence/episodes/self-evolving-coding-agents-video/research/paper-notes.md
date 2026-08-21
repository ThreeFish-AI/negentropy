# 论文精读笔记：Self-Evolving Coding Agents: A Survey

> **来源**：H. Zhou, H. Hu, Y. Shang, and Q. Zhang, "Self-Evolving Coding Agents: A Survey," arXiv:2608.03392, Aug. 2026. [Online]. Available: https://arxiv.org/abs/2608.03392（HTML 全文：https://arxiv.org/html/2608.03392v1）
> **作者**：南京理工大学（Hao Zhou、Haichuan Hu、Quanjun Zhang）× 南京大学（Ye Shang）
> **用途**：本笔记是科普视频《会写代码的 AI，开始给自己写代码》的**单一事实源**——逐字稿中的每个论文断言必须能回溯到本文件的对应条目。
> **提取方式**：2026-08-17 由 8 个并行提取代理对论文 HTML 全文逐节精读产出（A: 摘要+§1；B: §2+Table 1；C–F: §3.1–3.4 各一；G: §3.5+§4；H: §5–7+Table 2 结构）。
> **配套资源**：论文附论文列表仓库 Awesome-Self-Evolving-Coding-Agents（https://github.com/zhouhao1024/Awesome-Self-Evolving-Coding-Agents）。
> **与同系列另两集的关系**：《上线之后，AI 才开始上学》（清华×Frontis 综述，通用·部署后经验怎么攒：Harness/trace→z/四去处/元进化）、《AI 如何自己变强？》（arXiv:2607.13104，通用·自我进化改什么：大脑 θ/装备 Σ）。本集论文**领域深潜**：自进化编码智能体——自进化最先真实落地的田野（可执行反馈让进化可测量）。三集互补且各自独立成片（发布顺序见 [../../series.json](../../series.json)）。


---

## 摘要 + §1 Introduction 提取笔记（全片钩子与三问骨架）

### 1. 章节主旨综述段

摘要与 §1 共同承担全文「问题定义 + 开场钩子」的功能。摘要先立靶心：LLM 编码智能体已能 inspect repositories、invoke tools、execute tests、debug failures、generate patches，但 "most existing agents remain largely static after deployment"，而软件开发本身却是动态、反馈密集的过程——这组矛盾张力催生了「自进化编码智能体」这一新兴方向。§1 按五步推进组织：(1) 编码智能体已从代码补全演进为嵌入真实开发工作流的交互系统（引用 SWE-agent、OpenHands）；(2) 静态设计的五个部件（base model、prompts、tool interfaces、memory mechanisms、control flow）部署后基本固定，在持续演化的代码库面前难以为继；(3) 与通用自进化智能体研究划界——软件工程的仓库中心环境与可执行工件反馈使进化绑定 repository understanding、iterative debugging、correctness、maintainability，评测也须超越泛化任务完成度；(4) 抛出三个研究问题 RQ1/RQ2/RQ3（配合 Figure 1 总览图）；(5) 给出分层分析路线图与四条贡献清单。在全文中，本章是后续 §3 分类学（what）、§4 时间×证据（when/evidence）、§5 评测（how）的总纲。

定义原样摘录（§1 文字性定义；符号化形式定义在本辖区未出现，论文未展开）：**"self-evolving coding agents: agents that can update their frameworks, memory, skills, tools, models, or workflow and topology structures based on previous coding attempts and software-specific feedback"**——白话：智能体拿以前的编码尝试和软件特有的反馈（测试、编译器报错、CI 等）来更新自己的六个「身体部件」——框架、记忆、技能、工具、模型、工作流与协作拓扑，让下一次干得更好。

三个研究问题逐字（§1）：
- **RQ1**: "What components of coding agents evolve, and through what mechanisms are they evolved?"（进化什么、靠什么机制）
- **RQ2**: "When does evolution occur in coding agents, and what software-specific evidence drives this process?"（何时进化、靠什么软件特有证据驱动）
- **RQ3**: "How should self-evolving coding agents be evaluated in terms of software engineering performance, reliability, and generalization beyond the evolved setting?"（如何评估，尤其是能否泛化到进化环境之外）

### 2. 代表方法列表

§1 对方法多为集体性引用（系统名出自参考文献题名），逐条注明本章语境下的落点；机制细节本节未展开的均已标注。

- **SWE-agent（Yang et al., 2024）**：作为「近期编码智能体以交互系统形态嵌入真实开发工作流」的代表被引用："recent coding agents increasingly operate as interactive systems embedded in realistic development workflows"。机制细节论文在 §2.1 展开，本节未展开。
- **OpenHands（Wang et al., 2024b）**：与 SWE-agent 并列，同上引用语境；本节未展开。
- **SWE-bench（Jimenez et al., 2023）**：被引以支撑「软件工程任务并非孤立文本生成」的判断："they are long-horizon, tool-intensive, and tightly coupled with project-specific codebases, dependencies, build systems, test suites, and continuous integration pipelines"。
- **A Self-Improving Coding Agent / SICA（Robeyns et al., 2025）**：§1 动机句的四篇代表引用之一，集体定义为 "agents that can update their frameworks, memory, skills, tools, models, or workflow and topology structures based on previous coding attempts and software-specific feedback"；具体机制本节未展开（§3.1 展开）。
- **Darwin Gödel Machine（Zhang et al., 2025b）**：同为动机句四篇引用之一；本节未展开。
- **Live-SWE-Agent（Xia et al., 2025）**：同为动机句四篇引用之一；本节未展开。
- **Socratic-SWE（Xiao et al., 2026）**：同为动机句四篇引用之一；本节未展开。
- **Gao et al. 自进化智能体综述（2026）/ Fang et al. 综述（2025）**：作为通用自进化范式对标对象被引："most existing discussions focus on improving agents across broad task environments rather than analyzing the distinctive requirements of software engineering"。
- **（抽象层面的机制句，摘要）**：面向整个文献集体——"the agent improves its future behavior by updating its framework, memory, skills, tools, models, or collaboration structures from prior coding interactions"。

### 3. 风险 / 挑战 / 防护

- **六大新挑战（摘要原文）**：自进化在软件工程落地同时 "introduce new challenges in **feedback reliability, benchmark overfitting, safety, maintainability, cost, and generalization**"（反馈可靠性、基准过拟合、安全性、可维护性、成本、泛化）。
- **不进化的失败模式（§1）**：静态代理 "may repeat similar mistakes across tasks and fail to adapt to project-specific contexts"——跨任务重复同类错误、无法适配项目特有上下文。
- **反馈误导风险（§1）**：评测须考核 "robustness to **misleading or incomplete feedback**"（对误导性或不完整反馈的鲁棒性）。
- **评测维度升维（§1）**：必须 "go beyond generic task completion"，覆盖 "functional correctness, code quality, safety, efficiency, maintainability"；评估要 "moving beyond **one-shot task success**"，且要看 "generalization beyond the setting in which evolution occurs"。
- **作者的方法论自防（§1）**："we frame this survey as a guiding synthesis rather than a review of a fully established paradigm"、"Instead of enforcing rigid boundaries, we aim to organize heterogeneous mechanisms for coding-agent evolution into a coherent framework"——领域边界尚流动，综述以组织梳理代替强行划界。
- 具体防护/治理机制在本辖区论文未展开（指向 §6 Challenges）。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【反差开场｜全片第一钩子】"Yet most existing agents remain largely static after deployment, even though software development is a dynamic, feedback-rich process in which repositories evolve, dependencies change, tests fail, and repair attempts leave reusable experience." → 今天的 AI 编程助手上线后基本就「定型」了，可软件世界天天在变：仓库在长、依赖在换、测试在挂、每次修 bug 都留下可复用的经验。画面：左边封在玻璃罩里的机器人面对一成不变的代码，右边代码库像活物一样持续生长。
- 【进化前史】"Early code assistants primarily focused on code completion or function-level generation, but recent coding agents increasingly operate as interactive systems embedded in realistic development workflows." → 从「补全工具」到「坐在工位上的同事」。画面：时间轴左端是输入框里灰色的自动补全，右端是一个能开终端、跑测试、改文件的完整工位。
- 【七连动词·能力清单】"They can interpret natural-language requirements, inspect repository structure, edit multiple files, call command-line tools, run tests, diagnose failures, generate patches, and assist with code review and debugging." → 读需求、看仓库、改多文件、敲命令、跑测试、查病因、出补丁、帮 code review——八件事一气呵成（原文七个 and 连接的动作组）。画面：八个图标随念白逐一点亮的连环动画。
- 【任务本质·反直觉】"software engineering tasks are rarely isolated text generation problems: they are long-horizon, tool-intensive, and tightly coupled with project-specific codebases, dependencies, build systems, test suites, and continuous integration pipelines." → 编程任务根本不是「写一段作文」，而是长链条、玩工具、深度绑死一个具体项目。画面：一道题从一行提示词炸开成依赖图、构建系统、测试套件、CI 管线的星系。
- 【静态五件套】"In many systems, the base model, prompts, tool interfaces, memory mechanisms, and control flow are largely fixed after deployment." → 模型、提示词、工具接口、记忆机制、控制流——上市即浇铸定型的五个部件。画面：五个齿轮被水泥浇筑，旁边世界在飞速运转。
- 【修 bug 循环】"bug fixing often requires repeated cycles of localization, patch generation, execution, and revision." → 定位→打补丁→执行→再修改，一圈又一圈。画面：环形传送带，机器人在四个工位间循环。
- 【六种体检信号】"software engineering provides rich executable feedback, including unit tests, compiler errors, runtime traces, lint warnings, continuous integration results, and human code reviews." → 软件工程自带六份「体检报告」，每一步都有机器替你判卷。画面：六个仪表盘依次亮绿灯/红灯。
- 【重复犯错·痛点】"If coding agents cannot accumulate experience from such feedback, they may repeat similar mistakes across tasks and fail to adapt to project-specific contexts." → 不长记性的代理会在不同任务上反复栽进同一个坑。画面：日历哗哗翻页，地上同一个红色裂缝坑，机器人次次掉进去。
- 【反直觉断言｜全片题眼】"In this sense, software engineering is a natural domain for studying self-evolving agents."；摘要呼应版："executable feedback, repository-level context, and coding trajectories give software engineering a distinctive role as a natural domain for agent self-evolution" → 大家以为写代码是「死板」领域，论文却说它恰恰是智能体自进化的天然试验田：可执行反馈 + 仓库级上下文 + 编码轨迹三大养分。画面：一片土壤里长出不断分叉的树，三个养分管 labeled feedback/context/trajectories。
- 【张力金句】"This tension has motivated a growing body of work on self-evolving coding agents, where the agent improves its future behavior by updating its framework, memory, skills, tools, models, or collaboration structures from prior coding interactions." → 张力催生新物种：六个可进化的部件清单。画面：一张「可升级零件目录」展开——框架/记忆/技能/工具/模型/协作结构。
- 【领域分界·硬家伙】"evolving coding agents operate in repository-centered environments, interact with compilers, test frameworks, shells, dependency managers, and CI systems, and receive concrete feedback from executable artifacts." → 编码智能体打交道的是编译器、测试框架、shell、依赖管理器、CI 这些「硬家伙」，收到的反馈来自真实跑起来的工件，而非空口打分。画面：通用智能体对话气泡 vs 编码智能体接的实体管线接口。
- 【研究空白】"This leaves self-evolving coding agents under-characterized as a research problem." → 自进化编码智能体作为研究问题还没被讲清楚——空白即机会。画面：地图上一块未上色区域。
- 【作者自评边界】"we frame this survey as a guiding synthesis rather than a review of a fully established paradigm." → 作者自己承认：领域未定型，这是带路图，不是定论集。
- 【接口定位】"coding agents are becoming an important interface between language models and real software engineering workflows." → 编码智能体正在成为大模型与真实软件工程之间的那道「接口」。画面：插头（LLM）插入插座（软件工厂）。
- 【评测升维】"moving beyond one-shot task success toward correctness, maintainability, robustness, cost, safety, and generalization beyond the setting in which evolution occurs." → 评测从「一锤子通过率」升级为六维考核，还要看学到的东西能不能带出「进化发生的那间教室」。画面：单格计分板切换成六维雷达图。
- 【三幕结构骨架】RQ1/RQ2/RQ3 原文三问可直接作为全片三幕：进化什么（What）→ 何时+靠什么证据（When/Evidence）→ 如何评估（How）。配合 Figure 1（"The overview of self-evolving coding agents."）总览图使用。
- 【3×3 分类学彩蛋】贡献三："covering task-time, post-task, and stage-wise evolution, as well as outcome evidence, environmental feedback, and trajectory-derived evidence" → 时间三档 × 证据三类的分类矩阵，是后续章节的导航网格。
- 【可展示资源】"The papers we collect can be found at https://github.com/zhouhao1024/Awesome-Self-Evolving-Coding-Agents" → 论文配套 GitHub 论文清单，片尾可直接展示 URL。
- 【愿景收束】"provide a foundation for designing more adaptive, reliable, and software-aware agentic systems." → 为设计更自适应、更可靠、更懂软件的智能体系统打地基。画面：地基上缓缓立起建筑框架。


---

## §2 Background and Definitions 提取笔记（Self-Evolving Coding Agents: A Survey, arXiv:2608.03392v1）

### 1. 章节主旨综述段

§2 是全文的概念地基：在讨论“如何进化”之前，先回答“研究的到底是什么系统”。三小节构成同心圆式的递进——2.1 画出外圈之一「coding agents」（能检视仓库、调用工具、执行测试、编辑文件、迭代修订的智能体），2.2 画出另一个外圈「self-evolving agents」（把改进的来源从外部工程化更新转移到系统内部反馈驱动适应的通用智能体），2.3 求两圈交集，给出本文的工作定义，并用 Table 1 以「概念 / 核心思想 / 反馈来源 / 变化对象」四列精确切割 conventional coding agent、general self-evolving agent、self-evolving coding agent 三者的边界。全章的逻辑枢纽是“反馈的可执行性”：一般自进化智能体的反馈来自文本批评、用户偏好或标量奖励，而编码智能体操作的是可执行工件——单元测试、编译诊断、运行时轨迹、静态分析警告、仓库历史、CI 日志、代码评审——信号具体且可复现。这既解释了为什么软件工程是研究智能体自进化的天然基底（§2.1 结尾句），也预告了新风险（测试不全、日志歧义、基准过拟合、补丁过检但伤可维护性，§2.3 结尾句），为 §6 的 Challenges 埋下伏笔。形式化定义：**论文未展开**——§2 三小节均为散文式（prose）定义，全文此章未出现带数学符号（如 Π、τ、M）的形式化定义框；工作定义以自然语言给出（§2.3）："an agentic software engineering system that updates its behavior or internal components based on previous coding attempts and software-specific feedback"（一个会根据以往编码尝试与软件专属反馈，更新自身行为或内部组件的“智能体化软件工程系统”）。§1 提出的三个研究问题（RQ1 什么组件在进化/经何机制；RQ2 何时进化/由何种软件证据驱动；RQ3 如何评估）是后续 §3–§5 的骨架，§2 即为回答 RQ 前先钉死的概念坐标。

### 2. 代表方法列表

**§2.1 Coding Agents（编码智能体：会动手的，不只是会写代码的）**

- **ChatDev（Qian et al., 2023）**：把软件开发建模为角色分工多智能体的协作对话。（论文原文表述 "framed software development as collaboration among role-specialized agents"）
- **MetaGPT（Hong et al., 2023）**：与 ChatDev 同类，以元编程方式组织多智能体协作框架，同样按角色分工。（"role-specialized agents"）
- **AgentCoder（Huang et al., 2023）**：用程序员、测试设计者、测试执行者三个协同智能体做代码生成。（"coordinated programmer, test designer, and test executor agents"）
- **SWE-agent（Yang et al., 2024）**：定义智能体-计算机接口（agent-computer interfaces），把智能体接到终端、文件系统、仓库与执行环境，接近真实软件工程。（"connecting agents to terminals, file systems, repositories, and execution environments"）
- **OpenHands（Wang et al., 2024b）**：开源的 AI 软件开发者通用智能体平台，与 SWE-agent 同样连接真实执行环境。
- **AutoDev（Tufano et al., 2024）**：强调 AI 驱动开发中的自主任务管理。（"autonomous task management for AI-driven development"）
- **AutoCodeRover（Zhang et al., 2024d）与 RepairAgent（Bouzenia et al., 2024）**：聚焦仓库级程序修复与改进。（"repository-level program repair and improvement"）
- **MASAI（Arora et al., 2024）/ CodeR（Chen et al., 2024）/ SpecRover（Ruan et al., 2024）**：分别为软件工程任务探索模块化、多智能体+任务图、意图感知设计。（"modular, multi-agent, task-graph, or intent-aware designs"）
- **Agentless（Xia et al., 2024）**：证明简化的定位-规划-修复三段式同样高效，主张按交互环质量而非架构复杂度评价设计。（"simplified localization, planning, and repair stages can also be highly effective"）
- **SWE-Search（Antoniades et al., 2024）**：搜索式方法，凸显仓库级修复中探索与精炼（exploration and refinement）的重要性。
- **Terminal-native agents（Bui, 2026）**：强调脚手架（scaffolding）、测试马甲（harness）设计与上下文工程是可靠开发环境交互的关键。
- **可执行动作/测试执行研究（Wang et al., 2024a；Bouzenia and Pradel, 2024）**：把可执行动作空间与测试执行当作智能体行为的核心部分。
- **其他应用方向（Zhang et al., 2024b；Garg and Huang, 2026；Ma et al., 2026）**：仓库级代码生成、代码评审、交互式调试、仓库理解。
- **基准：SWE-bench（Jimenez et al., 2023）与 SWE-Bench Pro（Deng et al., 2025）**：界定编码智能体必须运作的环境——长时程、工具密集、反馈丰富、与项目专属仓库紧耦合。

**§2.2 Self-Evolving Agents（通用自进化智能体：改进发生在系统内部）**

- **Reflexion（Shinn et al., 2023）与 Self-Refine（Madaan et al., 2023）**：用言语反馈与自我批评改进后续决策，不改动模型权重。（"use verbal feedback and self-critique to improve subsequent decisions without changing model weights"）
- **ExpeL（Zhao et al., 2024）与 AGENT KB（Tang et al., 2025）**：把历史轨迹转化为可复用经验，跨任务检索。（"convert past trajectories into reusable experience that can be retrieved across tasks"）
- **PromptBreeder（Fernando et al., 2023）/ DSPy（Khattab et al., 2023）/ TextGrad（Yuksekgonul et al., 2024）**：进化“条件化未来行为”的上下文或提示词，即提示优化与自指提示进化（正文以作者-年份引用，系统名取自参考文献标题）。
- **MemGPT（Packer et al., 2023）/ Mem0（Chhikara et al., 2025）/ MemEvolve（Zhang et al., 2025a）**：进化记忆系统——随时间存储、抽象、检索经验，让智能体复用既往成败而非把每个任务当独立事件（系统名取自参考文献标题）。
- **Voyager（Wang et al., 2023）**：通过开放式交互构建可执行技能库（executable skill library）。
- **Tool-genesis（Xia et al., 2026）/ MUSE-Autoskill（Lin et al., 2026）**：研究智能体如何创建、选择、精炼、评估可复用能力（系统名取自参考文献标题）。
- **更激进层级的进化（Zhou et al., 2025；Zhang et al., 2024c；Yuan et al., 2024；Weng et al., 2026，即 Self-challenging agents / Agent-Pro / EvoAgent / Group-evolving agents）**：作用于模型行为、策略、工作流或架构——自生成训练数据、反馈强化学习、对智能体设计做进化搜索、多智能体协同进化（系统名取自参考文献标题）。

**§2.3 Self-Evolving Coding Agents（交集圈：本文主角）**

- **A Self-Improving Coding Agent / SICA（Robeyns et al., 2025）**：修改并验证自身实现的自我改进型编码智能体。（"self-improving coding agents that modify and validate their own implementation"）
- **Darwin Gödel Machine（Zhang et al., 2025b）等哥德尔机系（Anonymous, 2026; Wang et al., 2025a）**：维护并从多个不断进化的编码智能体变体中做选择（§2.3 以引用点名，"maintaining and selecting among evolving coding-agent variants"）。
- **Live-SWE-Agent（Xia et al., 2025）**：在线进化——在解决软件任务的当下，从正在执行的轨迹中适应。（"adapts from the trajectory it is currently executing"）
- **Socratic-SWE（Xiao et al., 2026）/ CODESKILL（Li et al., 2026）/ gskill（Tan et al., 2026）**：把编码轨迹蒸馏为可复用技能或技能注册表，指导后续开发任务。（"distilling coding trajectories into reusable skills or skill registries"）
- **SWE-Exp（Chen et al., 2026）**：为未来任务积累议题解决（issue-resolution）经验。（系统名取自参考文献标题）
- **Repository Memory（Wang et al., 2026a）**：构建服务于定位与项目理解的仓库记忆。（"construct repository memory for localization and project understanding"）
- **EvoRepair（Hu et al., 2026a）**：在漏洞修复这类安全攸关场景复用基于经验的修复知识。（系统名取自参考文献标题）
- **SWE-RL（Wei et al., 2025）**：软件演化数据在策略层面为开放软件任务上的推理与决策提供训练信号。（系统名取自参考文献标题）

### 3. 风险 / 挑战 / 防护

- **反馈质量风险（§2.3 核心风险句）**："tests may be incomplete, logs may be ambiguous, benchmark signals may be overfitted, and patches that pass local checks may still harm maintainability or safety" —— 测试可能不全、日志可能歧义、基准信号可能被过拟合、通过本地检查的补丁仍可能损害可维护性或安全性；论文称这种反馈丰富的环境反而令进化"more delicate"（更微妙、更需小心）。
- **概念边界防护（防混淆三件套）**：论文反复用否定句钉边界——自进化"does not simply mean rerunning an agent with a different prompt, nor does it require every improvement to update model parameters"（§2.2）；自进化编码智能体"are not simply conventional coding agents equipped with an additional learning module, nor are they merely general self-evolving agents applied to code"（§2.3）；编码智能体"are not merely code generation models"（§2 开篇）。
- **设计评价的 trade-off（§2.1，借 Agentless 表达）**：编码智能体设计应“按交互环质量而非仅按架构复杂度”评价（"evaluated by the quality of its interaction loop rather than by architectural complexity alone"）——复杂多智能体架构并非天然更优。
- **进化强度谱系的 trade-off（§2.2）**：自进化是一个谱系——从反思/记忆这类轻量适应，到修改工具、工作流、策略、智能体架构的强形式；强度越高，改动范围越大。
- **领域特异性约束（§2.2 结尾）**：相比大多数通用智能体场景，软件工程引入了"more concrete artifacts, feedback signals, and correctness constraints"（更具体的工件、反馈信号与正确性约束）——正确性约束既是护栏也是限制。
- **Table 1 的边界防护作用**：以“反馈来源 + 变化对象”双维度防止把普通编码智能体（只改任务状态与补丁）或通用自进化智能体（改 prompts/memory/tools/policies/architectures 但反馈是文本/奖励）误认作自进化编码智能体（改 repository memory, coding skills, workflows, policies, or scaffolds，反馈必须是 repositories/tests/CI/logs/reviews 的可执行反馈）。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【核心定义｜全文题眼】"an agentic software engineering system that updates its behavior or internal components based on previous coding attempts and software-specific feedback" → 一个会根据自己以往写代码的尝试和软件专属反馈，来更新自己行为或内部组件的智能体软件工程系统 → 画面：一个机器人修完 bug 后不是合上笔记本，而是掏出笔记本把自己的“修法手册”改写了一页。
- 【范式转变金句】"Coding agents represent a shift from code generation as isolated text production to software engineering as tool-mediated, environment-grounded action." → 编码智能体标志着一次转变：从“孤立文本生产式的代码生成”，到“以工具为中介、以环境为根基的软件工程行动” → 画面：左边一个只会吐字符串的打字机，右边一个手握终端、测试按钮、文件树的操盘手。
- 【反直觉断言】"coding-agent design should be evaluated by the quality of its interaction loop rather than by architectural complexity alone" → Agentless 的启示：评价编码智能体要看交互环的质量，而不是只看架构有多复杂；简化三段式照样能打 → 画面：朴素流水线 defeats 豪华多智能体军团。
- 【防杠边界句】"self-evolution does not simply mean rerunning an agent with a different prompt, nor does it require every improvement to update model parameters" → 自进化不等于“换个提示词再跑一遍”，也不要求每次改进都改模型参数 → 画面：划掉两个误区牌子（“换 prompt ≠ 进化”“必须改权重 ≠ 进化”）。
- 【谱系比喻】"self-evolution is best understood as a spectrum: from lightweight adaptation through reflection and memory, to stronger forms that modify tools, workflows, policies, or agent architectures" → 自进化最好理解为一条光谱：从反思与记忆的轻量适应，到修改工具、工作流、策略、架构的强形式 → 画面：滑块从“写日记”一路推到“给自己做手术”。
- 【系统解剖｜可视化素材】"a coding agent couples a language model with context, tools, control logic, and verification" → 编码智能体 = 语言模型 + 上下文 + 工具 + 控制逻辑 + 验证机制，五件套（模型提供推理与代码生成、控制器分解任务选动作、上下文机制维护仓库状态与任务历史、工具暴露搜索/编辑/测试/调试/依赖管理、验证机制检查变更是否满足可执行约束）→ 画面：五模块拆解图。
- 【典型工作流｜7 步循环】"A typical loop involves understanding an issue or request, exploring the repository, localizing relevant code, editing files, running tests, diagnosing failures, and revising the patch." → 理解 issue → 探索仓库 → 定位代码 → 编辑文件 → 跑测试 → 诊断失败 → 修订补丁，七步闭环 → 画面：环形传送带动画，每步一个工位。
- 【环境画像｜四关键词】"long-horizon, tool-intensive, feedback-rich, and tightly coupled with project-specific repositories" → SWE-bench/SWE-Bench Pro 界定的战场：长时程、工具密集、反馈丰富、与项目专属仓库深度耦合 → 画面：四个标签牌砸在同一个仓库图标上。
- 【承上启下金句】"These characteristics make coding agents a natural substrate for studying self-evolution in software engineering." → 正是这些特性，让编码智能体成为研究软件工程中自进化的天然基底 → 画面：培养皿里长出代码树。
- 【交集定义金句】"A self-evolving coding agent goes one step further by turning these interactions into sources of persistent adaptation." → 自进化编码智能体再往前一步：把“检视仓库、编辑文件、跑测试”这些交互本身，变成持续适应的来源 → 画面：普通智能体的操作流水被回收，浇灌成进化的养料。
- 【反差金句｜领域独特性】"Unlike many general self-evolving agents, whose feedback may come from textual critiques, user preferences, or scalar rewards, coding agents operate over executable artifacts that provide concrete and repeatable signals." → 通用自进化智能体的反馈是文本批评、用户偏好或标量奖励；编码智能体操作的是能给出具体且可复现信号的可执行工件 → 画面：一边是模糊的点赞/差评，一边是红灯绿灯般确定的测试通过/失败。
- 【证据清单｜7 类可执行反馈】"Unit tests, compiler diagnostics, runtime traces, static analysis warnings, repository histories, continuous integration logs, and code reviews can all become evidence for adaptation." → 单元测试、编译诊断、运行时轨迹、静态分析警告、仓库历史、CI 日志、代码评审，七类皆可成为适应的证据 → 画面：七种仪表盘同时亮起的控制室。
- 【风险金句｜作者自评边界】"this feedback-rich setting also makes evolution more delicate: tests may be incomplete, logs may be ambiguous, benchmark signals may be overfitted, and patches that pass local checks may still harm maintainability or safety" → 反馈越丰富，进化越“娇贵”：测试可能不全、日志可能歧义、基准信号可能被过拟合、本地全绿的补丁仍可能伤可维护性与安全 → 画面：全绿的 CI 界面背后裂开一道红缝。
- 【收束句｜章末定位】"Self-evolving coding agents should therefore be studied as software engineering systems whose evolution is grounded in executable feedback, repository-level context, and code quality constraints." → 因此应把自进化编码智能体当作软件工程系统来研究：其进化锚定在可执行反馈、仓库级上下文与代码质量约束之上 → 画面：三根地桩把“进化中的智能体”钉进工程地基。
- 【有名字的系统｜记忆点】"Voyager builds an executable skill library through open-ended interaction" → Voyager 通过开放式交互搭起一座可执行技能库 → 画面：机器人在沙盒世界里捡一个技能塞进背包，背包越背越鼓。
- 【结构三问｜复述框架】"what part of the agent evolves, when the evolution occurs, and what signals guide the adaptation process" → 智能体的哪部分在进化、进化发生在何时、什么信号引导适应——三问贯穿全文（对齐 RQ1/RQ2 与 §3/§4）→ 画面：三盏聚光灯分别打在“改什么/何时改/凭什么改”。
- 【Table 1｜三圈边界表（逐字）】三行四列：Coding agents（Act in software engineering workflows / Tool outputs, tests, and user instructions / Task state and generated patches）；General self-evolving agents（Adapt behavior across tasks or environments / Textual feedback, rewards, and task outcomes / Prompts, memory, tools, policies, or architectures）；Self-evolving coding agents（Adapt software engineering behavior through coding experience / Executable feedback from repositories, tests, CI, logs, and reviews / Repository memory, coding skills, workflows, policies, or scaffolds）→ 白话：会干活的、会自己变强的、既会干活又会靠干活经验变强的 → 画面：三个同心圆，最内圈高亮。

校验锚点：本笔记全部内容回溯自 arXiv:2608.03392v1 HTML 版 §2（含 2.1/2.2/2.3 与 Table 1 "Conceptual boundary of self-evolving coding agents"）；§2 无形式化符号定义（论文未展开）；系统名凡未在 §2 正文拼写、仅以作者-年份引用者，均已注明“系统名取自参考文献标题”（依据参考文献列表，如 Anonymous, 2026 = Mendel Gödel machine、Wang et al., 2025a = Huxley Gödel machine、Chen et al., 2026 = SWE-Exp、Hu et al., 2026a = EvoRepair、Wei et al., 2025 = SWE-RL 等）。


---

## §3 分类法总览 + §3.1 Agent Framework Self-Evolution（智能体框架自进化）提取笔记

### 1. 章节主旨综述段

§3 是全文分类法的中枢：作者放弃把“自进化”当成单一技术，转而从「进化时到底更新了什么」这一视角切入，建立以进化对象（object of evolution）为中心的五分类法。原文开宗明义："This section develops a taxonomy of self-evolving coding agents from the perspective of what is actually updated during evolution. Rather than treating self-evolution as a single technique, we view it as a family of adaptation processes that operate on different artifacts in a coding-agent system."。关键前提是：软件工程场景中被进化的工件「往往在基座模型之外」（external to the base language model）——可以是框架、修复经验、仓库记忆、可复用技能、工具、工作流、多智能体协作方式或底层模型策略。五类别为：agent framework self-evolution、experience and repository memory self-evolution、skill and tool self-evolution、model self-evolution、workflow and topology self-evolution。作者强调 "These categories are not mutually exclusive, since a single system may evolve several artifacts simultaneously"，分类的目的是「识别主要适应对象、使不同机制可比」。Figure 2 给出分类树（注：HTML 版树体渲染为 LaTeX `{forest}` 占位符，节点文本不可得），Table 2 则把代表系统映射到主要分析维度；凡「中心贡献并非通过编码专属反馈改变智能体组件或行为」的工作（纯基准数据集、静态编码智能体）被排除在自进化方法之外。§3.1 是五类的第一类，也是最激进的一类：把编码智能体自身当作可修改的软件工件（modifiable software artifact），让智能体改写实现自己的源代码与执行框架。论文在 §3/§3.1 未给出符号化数学定义（论文未展开），仅有散文式界定；机制上分两种形式：scaffold rewriting（脚手架改写）与 archive-based framework evolution（基于档案的框架进化）。

**形式化定义摘录**：本节无符号化定义，散文式定义原句如下——

- "Agent framework self-evolution treats the coding agent itself as a modifiable software artifact."（白话：框架自进化就是把编码智能体自己当成一份可以改的软件代码。）
- "The most direct form is scaffold rewriting, where an agent modifies the implementation of its own agent system."（白话：最直接的形式是改自己的脚手架代码——智能体修改实现自身智能体系统的那套程序。）
- "A second form is archive-based framework evolution, where the system maintains multiple executable agent variants and searches over self-modifications."（白话：第二种形式是养一窝可执行的智能体变体档案，在“自我修改”的空间里做搜索。）

### 2. 代表方法列表

（脚手架基线，§3.1 开篇点名）：

- **SWE-agent（Yang et al., 2024）**：现代软件工程智能体的代表性 scaffold，被引为框架自进化所要修改的那类对象——编排模型调用、仓库检查、文件编辑、shell 命令、测试执行、工具使用与控制流。（例："a scaffold that orchestrates model calls, repository inspection, file editing, shell commands, test execution, tool use, and control flow"）
- **OpenHands（Wang et al., 2024b）**：与 SWE-agent 并列被引的 scaffold 基线，作为框架自进化的改造对象。（例：同上句，两文共同支撑该句）

（形式一：scaffold rewriting 脚手架改写）：

- **SICA / A Self-Improving Coding Agent（Robeyns, Szummer & Aitchison, 2025, arXiv:2504.15228）**：给编码智能体配上基础软件工具，让它编辑自己的代码库、发现新的提示方案或工具，并在编码基准上验证改出来的新智能体。（例："equipping a coding agent with basic software tools and allowing it to edit its own codebase, discover new prompting schemes or tools, and validate the resulting agent on coding benchmarks"；§4.2 补充其选择信号为 "coding benchmark performance, cost, and runtime"；原文实测数字：SWE-bench Verified 50 题随机子集 0.17 → 0.53（17%→53%），LiveCodeBench 0.65→0.71——分镜 2-B/3-C 画面引用此真实数字）
- **SIFT / Self-improvement via fast tree-search（Fu, Kulanthaivelu & Yamada, 2026, ICLR）**：与 SICA 同一 scaffold 级设定，但把自我修改的搜索做得更省样本——不完整评估每个候选自我修改，而是用 LLM-as-a-judge 信号加轻量树搜索来优先评估最有希望的补丁。（例："instead of fully evaluating every candidate self-modification, it uses an LLM-as-a-judge signal and lightweight tree search to prioritize the most promising patches"）
- **STOP / Self-Taught Optimizer（Zelikman, Lorch, Mackey & Kalai, 2024, COLM）**：研究递归自我改进的代码生成脚手架，被 §3.1 定位为 SICA/SIFT 方向的概念先声。（例："This direction is conceptually related to STOP, which studies recursively self-improving code-generation scaffolds"）

（形式二：archive-based framework evolution 基于档案的框架进化）：

- **Darwin Gödel Machine（Zhang, Hu, Lu, Lange & Clune, 2025, arXiv:2505.22954）**：把自我修改过程框定为对编码智能体变体的开放式进化（open-ended evolution over coding-agent variants）。（例：原句见上；§4.2 补充其及后继系统 "maintain archives of coding-agent variants and retain self-modifications that improve empirical coding performance"）
- **Mendel Gödel Machine（Anonymous, 2026, 在审稿件）**：Gödel-machine 式后继系统之一，研究如何跨谱系（lineages）与任务选择、继承、评估自我修改；正文未单独展开机制，仅在引用串与 Table 2 中归类（Agent framework / Stage-wise / Outcome）。标题自述："comparative evolution enables state-of-the-art self-improving coding agents"
- **Huxley Gödel Machine（Wang, Piękos, Nanbo, Laakom, Chen, Ostaszewski, Zhuge & Schmidhuber, 2025, arXiv:2510.21614）**：同上引用串中的后继系统；正文机制描述同为「跨谱系与任务的选择/继承/评估」一句话，未单独展开。标题自述："human-level coding agent development by an approximation of the optimal self-improving machine"（注意：此 Wang et al. 2025a 非 OpenHands 的 Wang et al. 2024b，是不同文献）

（关联的代码进化系统，§3.1 点名的引用串）：

- **AlphaEvolve（Novikov et al., 2025, arXiv:2506.13131）**：面向算法发现与优化的进化式编码智能体，在 §3.1 以作者名形式被引（正文未出现系统名"AlphaEvolve"字样，名称见参考文献标题 "AlphaEvolve: a coding agent for scientific and algorithmic discovery"）。（例："evolutionary coding agents for algorithmic discovery and optimization (Novikov et al., 2025; Assumpcao et al., 2025; Hu et al., 2026b)"）
- **CodeEvolve（Assumpcao, Ferreira, Campos & Murai, 2025, arXiv:2510.14150）**：同一引用串中的开源进化框架，用于算法发现与优化（"an open-source evolutionary framework for algorithmic discovery and optimization"，见参考文献）。
- **Controlled self-evolution for algorithmic code optimization（Hu et al., 2026b, arXiv:2601.07348）**：同一引用串的第三篇，算法代码优化的受控自进化；正文未展开机制。

Table 2 中本类归类（六系统 SICA/SIFT/STOP/DGM/Mendel/Huxley 均为）：Main object = Agent framework，Timing = Stage-wise，Evidence = Outcome，任务域 = coding-agent development。

### 3. 风险 / 挑战 / 防护

- **风险定级：本类是全分类中可靠性关切最强的一类**。"At the same time, this category raises stronger reliability concerns than lighter-weight forms of evolution." 原因（作者自评的因果句）："Because the evolving object is the mechanism that generates future actions..."——被进化的对象正是生成未来行动的机制本身，所以改坏的不是一个程序，而是“未来所有行动的源头”。
- **四种具体失败模式（原文四连）**："a harmful framework modification may break the agent loop, degrade tool use, overfit to benchmark feedback, or exploit weaknesses in the evaluation harness"——①打断智能体循环；②削弱工具使用；③对基准反馈过拟合（benchmark overfitting）；④利用评测 harness 的弱点（exploit weaknesses in the evaluation harness）。
- **防护措施（原文三点）**："Framework self-evolution therefore requires not only performance-driven search, but also careful validation, rollback, and robustness checks."——仅有性能驱动的搜索不够，还需谨慎验证（validation）、回滚（rollback）与鲁棒性检查（robustness checks）。
- **（§6 呼应，供交叉校验）**："Systems that select self-modifications or agent variants using benchmark outcomes are especially sensitive to evaluation noise and benchmark leakage"——用基准结果来筛选自我修改/智能体变体的系统对评测噪声与基准泄漏尤其敏感，点名 SICA 与 DGM 两篇文献。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【核心定义·金句】"Agent framework self-evolution treats the coding agent itself as a modifiable software artifact." → 把编码智能体自己当成一份“可修改的软件工件”——别的进化改的是笔记、提示词，这一类改的是智能体本人的源代码。画面：一个机器人打开自己的胸腔，拿着手术刀对着自己的电路动刀。
- 【反差句】"Unlike general self-evolving agents, where evolution often acts on prompts, memory, or high-level policies, coding agents expose a more concrete target for adaptation: the source code and execution framework that implement the agent itself." → 通用自进化智能体改的是提示词、记忆、高层策略；编码智能体却暴露出一个更具体的改造靶子——实现智能体自身的那套源代码与执行框架。画面：左边 agent 在改便利贴（prompt），右边 agent 在编译自己。
- 【闭环描述】"The agent can inspect its own implementation, propose code changes to its framework, execute the modified version, and evaluate the result through software-specific feedback such as test outcomes, runtime failures, benchmark solve rates, or patch validity." → 四步自改闭环：看自己的代码→提改动→跑改后的版本→用测试结果/运行时失败/基准通过率/补丁有效性来打分。画面：四格漫画式流程动画。
- 【两种形式·命名】"The most direct form is scaffold rewriting" 与 "A second form is archive-based framework evolution" → 白话：一种是自己给自己做手术（改脚手架），一种是养一整个“族谱动物园”，让多个智能体变体互相竞争进化（档案式）。画面：单机器人自我改写 vs. 一棵挂满历代机器人变体的进化树/档案库。
- 【SICA 例子】"allowing it to edit its own codebase, discover new prompting schemes or tools, and validate the resulting agent on coding benchmarks" → SICA 让 agent 编辑自己的代码库、自己发明新的提示方案或工具，再拿基准考试验证新版自己。画面：agent 把自己仓库 clone 下来提交 PR，PR 的评审人是基准测试。
- 【SIFT 数字感】"instead of fully evaluating every candidate self-modification, it uses an LLM-as-a-judge signal and lightweight tree search to prioritize the most promising patches" → 省钱省样本：不把每个候选改动都跑完整评测，而是让“LLM 当裁判”先打分+轻量树搜索挑出最有希望的补丁。画面：考场外先模拟面试筛掉绝大多数考生，只让少数尖子进真考场。
- 【STOP 命名梗】"recursively self-improving code generation"（全称 Self-Taught Optimizer）→ “自教优化器”：一段会改进“改进它自己的代码”的代码，递归套娃。画面：两面镜子对照产生无限递归的意象。
- 【DGM 定位】"The Darwin Gödel Machine frames this process as open-ended evolution over coding-agent variants" → 达尔文+哥德尔双梗命名：把自我修改当作对智能体变体的“开放式进化”（没有终点的进化）。画面：达尔文雀喙的适应性辐射图，雀换成不同版本的 coding agent。
- 【后继谱系】"later Gödel-machine-style systems further study how to select, inherit, and evaluate self-modifications across lineages and tasks" → 后来的 Gödel 机式系统进一步研究怎么跨“谱系”与任务来选择、继承、评估自我修改——像遗传学的选择/遗传/评估三步。画面：族谱树上的基因遗传箭头，标注 select / inherit / evaluate。
- 【点睛金句·最推荐】"The evolving artifact is not only a candidate program being optimized, but the machinery that produces future software-engineering actions." → 被进化的东西不只是“一个待优化的候选程序”，而是“生产未来一切软件工程行动的机器”。画面：传送带的机器在焊接下一台自己。
- 【可执行性】"A framework change becomes executable agent code that can be run, debugged, and compared against previous agent versions." → 框架改动立刻变成可运行的智能体代码，能跑、能调试、能和上一版自己对比。画面：git diff 视图两侧分别是 v1 和 v2 智能体在跑同一个 bug。
- 【反馈具体性】"The feedback loop is also unusually concrete: compilation errors, unit tests, shell outputs, benchmark results, and repository-level task success provide direct evidence about whether a framework modification improves the agent." → 反馈回路异常具体：编译错误、单元测试、shell 输出、基准结果、仓库级任务成败，都是“改动有没有让智能体变强”的直接证据。画面：五路信号线汇入一个仪表盘。
- 【风险金句】"Because the evolving object is the mechanism that generates future actions, a harmful framework modification may break the agent loop, degrade tool use, overfit to benchmark feedback, or exploit weaknesses in the evaluation harness." → 改坏一次 = 污染未来所有行动的源头：循环断裂、工具退化、基准过拟合、钻评测系统的空子。画面：一条被污染的上游河流，下游全部变色的俯视图。
- 【防护清单】"requires not only performance-driven search, but also careful validation, rollback, and robustness checks" → 只会“冲分搜索”不够，必须配上验证、回滚、鲁棒性检查三件套。画面：机器人身上三条安全带：validation / rollback / robustness。
- 【分类学谦辞】"These categories are not mutually exclusive, since a single system may evolve several artifacts simultaneously." → 五分类不是互斥的抽屉，一个系统可以同时进化多种工件——分类只为找出“主要进化对象”。画面：一个系统同时伸出多根触手，最粗的一根标成“primary object”。
- 【边界句·收录门槛】"benchmark-only datasets and static coding-agent systems are discussed later as evaluation context rather than as self-evolutionary methods." → 纯基准数据集和静态编码智能体不算自进化方法，只当评测背景讨论——综述给自己划的收录红线。画面：安检口，纯数据集和静态 agent 被分流到“评测背景”通道。
- 【系统名彩蛋】Huxley Gödel Machine 论文标题自述 "human-level coding agent development by an approximation of the optimal self-improving machine"（用“最优自我改进机的近似”开发人类级编码智能体）；Mendel Gödel Machine 标题自述 "comparative evolution enables state-of-the-art self-improving coding agents"（比较式进化造就 SOTA 自我改进编码智能体）。→ 哥德尔机谱系用科学家姓氏接力命名（Darwin→Mendel→Huxley，恰好是进化生物学三代人物）。画面：三位科学家的肖像与三篇论文标题并排。


---

## §3.2 Memory Self-Evolution（记忆自进化）提取笔记

### 1. 章节主旨综述段

§3.2 是全文分类法（§3 Taxonomy of self-evolving coding agents）四大进化维度中的第二个，紧接 §3.1「Agent Framework Self-Evolution」之后。本章回答的问题是：编码智能体如何把单次任务中获得的经验沉淀为**跨任务可复用的记忆组件**，并且让这个记忆机制本身（存什么、怎么抽象、何时更新、如何检索）成为被进化的对象。论文开宗明义地强调，记忆自进化「not simply mean storing interaction history」（不是简单存交互历史），而是 "the continual construction, refinement, and reuse of an explicit memory component"（持续构建、精炼并复用一个显式记忆组件）。该记忆记录的是软件特有经验：issue 解决轨迹、仓库历史、失败与成功的补丁、测试结果、编译器诊断、运行日志、漏洞模式与代码评审反馈等八类。论文未在本节给出符号化形式定义（如 M 的数学式），其操作性定义即上句原文——白话讲：进化的不是参数，而是「记忆这台机器」的运转方式。组织逻辑上，本节按记忆的**四种形态**递进展开：(1) 轨迹派生记忆（SWE-Exp 经验银行、EvoCoder 层级经验池、子任务级结构对齐记忆）；(2) 以仓库为中心的记忆（commit 历史→定位）；(3) 领域特化记忆（EvoRepair 漏洞修复）；(4) 计划抽象型记忆（SAGE），最后与通用经验系统（ExpeL、AGENT KB）划界，并落点在「选择性进化」这一核心挑战上。本节讨论的六个方法在 Table 2 中全部归类为 Main object = Memory、Timing = Post-task、Evidence = Trajectory-derived。

### 2. 代表方法列表

- **SWE-Exp（Chen et al., 2026，引用编号 11）**：从过往 issue 解决轨迹中构建「经验银行」，明确同时收录成功与失败的修复尝试，供新问题复用定位策略、补丁决策与失败教训。（例："SWE-Exp follows this direction by constructing an experience bank from prior issue-resolution trajectories, including both successful and failed repair attempts (11)."）
- **EvoCoder（Lin et al., 2024，引用编号 37）**：把经验银行思路用到缺陷代码复现（issue code reproduction）上，用层级经验池把「通用经验」与「仓库特定经验」分开存放，并从已解决的复现轨迹中更新。（例："a hierarchical experience pool separates general experience from repository-specific experience and is updated from previously resolved reproduction trajectories (37)."）
- **Structurally Aligned Subtask-Level Memory（Shen et al., 2026，引用编号 50）**：把 SWE-agent 经验的存取与更新下沉到「分析、定位、编辑、验证」四个子任务粒度，避免对整条任务轨迹做粗粒度匹配。（例："at the granularity of analysis, localization, editing, and validation subtasks, avoiding coarse matching over whole task trajectories (50)."）
- **Improving Code Localization with Repository Memory（Wang et al., 2026a，引用编号 56）**：不把仓库当静态输入，而是从历史 commit、关联 issue、高频修改区域的功能摘要中构建记忆，用于支持未来的代码定位。（例："builds memory from historical commits, linked issues, and functionality summaries of frequently modified code regions, and uses this memory to support future code localization tasks (56)."）
- **EvoRepair（Hu et al., 2026a，引用编号 24）**：面向漏洞修复领域，在单个漏洞内积累修复经验、跨漏洞复用经验，使记忆成为领域感知知识库而非通用交互流水账。（例："accumulates repair experience within a vulnerability and reuses experience across vulnerabilities (24)... making it a domain-aware knowledge base rather than a generic record of past interactions."）
- **SAGE（Hayashi et al., 2025，引用编号 21）**：把一次初始 SWE-agent rollout 抽象为一份简明计划，在后续执行中把该计划作为上下文指导复用。（例："it abstracts an initial SWE-agent rollout into a concise plan and reuses that plan as contextual guidance for a subsequent execution (21)."）
- **ExpeL（Zhao et al., 2024，引用编号 82）与 AGENT KB（Tang et al., 2025，引用编号 54）**：本节作为对照系点名的通用经验记忆系统，展示跨任务存储与复用智能体经验的更广价值；论文据此说明编码场景与之的差异（证据耦合更紧），非本节方法本体。（例："general experience-memory systems such as ExpeL and AGENT KB, which demonstrate the broader value of storing and reusing agent experience across tasks (82; 54)."）

表格补充（Table 2 中各方法行）：SWE-Exp → Repository issue resolution；EvoCoder → Defect reproduction；Subtask-Level Memory → Repository-level issue resolution；EvoRepair → Vulnerability repair；Repository Memory → Code localization；SAGE → Repository-level repair；六者 Timing 均为 Post-task、Evidence 均为 Trajectory-derived。

### 3. 风险 / 挑战 / 防护

- **核心挑战（选择性进化）**：逐字原文 ——「The key challenge is not merely how to store more experience, but how to evolve memory selectively.」（关键不是存更多经验，而是如何有选择地进化记忆。）
- **四类污染源**：论文列举 "Noisy logs, misleading tests, brittle patches, and repository-specific conventions"（噪声日志、误导性测试、脆弱补丁、仓库特定惯例），它们 "can all produce memories that hurt future performance if retrieved uncritically"（若不加甄别地检索，都会产生损害未来性能的记忆）——即记忆可能反过来负迁移。
- **过拟合风险**：需避免 "overfitting to past repositories, benchmarks, or accidental feedback"（对过去仓库、基准测试或偶然反馈过拟合）。
- **防护机制（论文给出的四个必备环节）**：有效记忆自进化要求 "mechanisms for filtering, abstraction, retrieval, and validation"——过滤、抽象、检索、验证四关。
- **与通用记忆系统的边界（trade-off 式区分）**：编码智能体的记忆 "more tightly coupled with executable and repository-level evidence"——测试判定记下的补丁策略是否真对，编译/运行时错误暴露具体失败模式，commit 历史提供项目长期变化信号；这既是优势（证据可验证）也是约束（强绑定仓库）。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【定义反差】"memory self-evolution does not simply mean storing interaction history" → 记忆自进化不等于存聊天记录；进化的是「怎么记」这套机制本身。画面：不是往硬盘里堆文件，而是升级图书馆的编目系统。
- 【被进化对象】"The object being evolved is therefore the agent's memory mechanism: what information is retained, how it is abstracted, when it is updated, and how it is retrieved to guide future software engineering actions." → 四连问（存什么/怎么抽象/何时更新/如何检索）就是记忆机制的全部旋钮。画面：四个旋钮的调音台特写。
- 【任务不孤立】"software engineering tasks are rarely independent. Bugs may recur across related modules, similar APIs may fail in similar ways, tests may expose repeated failure patterns, and repository history often reveals which components tend to change together." → 四个排比句：bug 会复发、API 摔同一个坑、测试暴露重复失败模式、历史揭示组件联动。画面：同一种报错在不同文件反复弹出的循环动画。
- 【金句对照】"A memoryless coding agent must rediscover such information for every new issue, whereas a memory-evolving agent can transform previous coding attempts into reusable knowledge." → 没记忆的 agent 每个 issue 都要重新踩坑一遍；有记忆的把踩坑变成知识。画面：左：金鱼每次绕新迷宫；右：墙上贴满便签的老手。
- 【失败也是资产·反直觉点】SWE-Exp 的经验银行 "including both successful and failed repair attempts" → 明确收录失败轨迹：失败教训与成功经验同等级入库。画面：银行金库里失败补丁与成功补丁并排陈列，标签各半。
- 【层级记忆·比喻】EvoCoder 的 "hierarchical experience pool separates general experience from repository-specific experience" → 通用经验与「这家仓库专属」经验分层存放，像通用医学手册 vs 病人专属病历。画面：两层抽屉柜。
- 【记忆粒度】子任务级记忆 "avoiding coarse matching over whole task trajectories" → 别拿整条录像去对整条录像，切成分析/定位/编辑/验证四段各自配对。画面：长视频切成四格分镜各自做相似度匹配。
- 【仓库是活的】"Instead of treating a repository as a static input context, repository memory captures how the codebase has evolved over time." → 仓库不是一份静态说明书，而是有年轮的生物。画面：代码库的 timelapse 生长动画。
- 【SE 独有性】"it is grounded in the temporal structure of a codebase, the co-evolution of files and modules, and the historical relationship between issue reports and code changes." → 仓库记忆的独特性三支柱：时间结构、文件共演化、issue 与代码变更的历史关联。画面：git graph 上 issue 气泡与 commit 节点连线。
- 【金句·知识库定位】"a domain-aware knowledge base rather than a generic record of past interactions"（EvoRepair） → 是领域专家的案例库，不是流水账日记。画面：左边流水账滚筒，右边带索引卡片的专科医案。
- 【计划即记忆】SAGE "abstracts an initial SWE-agent rollout into a concise plan" → 第一次摸索出的完整操作录像，压缩成一张便签计划，第二次直接照单执行。画面：长流程视频→一张 step list 卡片。
- 【与通用系统的分界·证据三问】"Tests determine whether a remembered patching strategy was actually correct, compiler and runtime errors expose concrete failure modes, and commit histories provide long-term signals about how a software project changes." → 测试当裁判、编译器当验伤员、commit 历史当年鉴——编码记忆有天然的「对答案」机制，这是它区别于 ExpeL/AGENT KB 的硬证据。画面：三个角色给记忆卡片盖章/打叉。
- 【升华句】"Memory self-evolution therefore turns software engineering feedback into an internal, reusable substrate for future coding behavior." → 把工程反馈炼成内在可复用的底座/substrate。画面：矿石（反馈）熔炼成锭（substrate）。
- 【全章最关键挑战句·逐字】"The key challenge is not merely how to store more experience, but how to evolve memory selectively." → 记得多不等于用得好，选择性才是命门。画面：仓库爆满的仓库 vs 精选货架。
- 【毒记忆具象】"Noisy logs, misleading tests, brittle patches, and repository-specific conventions can all produce memories that hurt future performance if retrieved uncritically." → 坏记忆清单四件套：噪声日志、误导测试、脆弱补丁、仓库私规——不加甄别就检索，等于给未来投毒。画面：四张灰色卡片混入金色卡片堆，被过滤网拦下。

（注：§3.2 本节内无 Figure；上述方法分类见 Table 2。引用编号 (11)(37)(50)(56)(24)(21)(82; 54) 为论文 HTML 正文渲染编号，已逐一与文末参考文献核对：11=SWE-Exp(Chen et al., 2026)、37=Lin et al., 2024（即 EvoCoder 所在论文 "LLMs as continuous learners..."）、50=Shen et al., 2026、56=Wang et al., 2026a、24=Hu et al., 2026a、21=Hayashi et al., 2025、82=Zhao et al., 2024、54=Tang et al., 2025。）


---

## §3.3 Skill and Tool Self-Evolution 提取笔记

### 1. 章节主旨综述段

本节是第三章「自进化对象」分类中的第三类：前两节分别处理记忆（memory）与策略（policy）的自进化，本节处理**技能与工具**（skills and tools）的自进化——即编码智能体如何把软件工程经验转化为可复用的操作能力。开篇即给出全章核心区分句："While memory records what happened in previous tasks, skills and tools encode how the agent should act when similar situations arise again."（记忆记录的是「过去发生了什么」（WHAT），技能编码的是「下次遇到类似情况该怎么动手」（HOW）。）论文强调，软件工程中任务解决高度依赖重复性流程，涉及 "shells, test runners, code search utilities, static analyzers, and patch editors" 这类工具的操作程序，因此技能自进化尤为关键。本节明确界定进化对象："The evolved object in this category is therefore not the codebase itself, but the agent's procedural knowledge and tool-use capability"——被改写的不是代码仓库，而是智能体自身的程序性知识与工具使用能力（技能有哪些、何时调用、如何更新）。本节无编号子节，为连续论述：先讲技能自进化（CODESKILL、gskill、Socratic-SWE、EffiSkill 四条路线），再以 Live-SWE-Agent 引出工具自进化，最后与记忆自进化作对照收束。**形式化定义：本节无数学形式化定义（论文未展开），仅有概念性界定。** Table 2 将本节五个系统统一归类为 Main object = Skill/tool，Timing 上除 Live-SWE-Agent 为 Task-time 外均为 Post-task，Evidence 上多为 Trajectory-derived（EffiSkill 为 Environmental、CODESKILL 为 Trajectory-derived + environmental）。这些系统同时出现在 Figure 2 的分类图中。

### 2. 代表方法列表

- **CODESKILL（Li et al., 2026 [34]）**：从任务轨迹中提取并维护双层粒度技能库——任务级技能（如如何检查仓库、验证修复）与事件驱动技能（对命令失败等重复执行事件的局部响应），并把技能管理本身当作可学习的策略来优化。（例："CODESKILL treats skill management itself as a learnable policy, using both rubric-based skill-quality feedback" 与 "verifiable downstream execution feedback from coding tasks"；其出发点是 "raw trajectories are too long and task-specific to be reused directly"——原始轨迹太长、太任务特定，无法直接复用。）
- **gskill（"Automatically Learning Skills for Coding Agents" [53]）**：针对单个仓库自动学习一份简洁的技能文档（涵盖架构、约定、测试流程、陷阱与修改模式），本质是给编码智能体自动生成的入职文档。（例：其洞见是失败常源于 "missing project knowledge" 而非推理太弱；"gskill addresses this problem by generating verifiable software engineering tasks with SWE-smith and then iteratively refining skill documents through an evolutionary optimization loop."；评估方式是 "Candidate skills are evaluated by running agents in isolated repository environments and checking whether their patches pass tests."；产物是 "automatically learned onboarding documents"。综述 HTML 参考文献表截断，原始作者信息论文未展开。）
- **Socratic-SWE（[71]）**：不丢弃历史解题轨迹，而是从中蒸馏出「Agent Skill Registry」（技能注册表，汇总重复出现的失败模式与有效修复模式），再由注册表指导在真实仓库中生成定向修复任务、经执行验证过滤后用于训练求解器，新轨迹再进入下一轮——形成技能与策略自进化的闭环。（例："reuses historical solving traces as a source of training signal rather than discarding them after reward computation"；蒸馏出 "an Agent Skill Registry that summarizes recurring failure modes and effective repair patterns"；技能 "guide the generation of targeted repair tasks in real repositories"。）
- **EffiSkill（[64]）**：从「慢程序→快程序」配对中挖出代码效率优化技能，组织成一个可移植工具箱，支撑免执行的诊断、技能检索、方案组合与候选生成；其技能库是离线构建的，而非完全封闭的智能体循环。（例："into a portable toolbox for execution-free diagnosis, skill retrieval, plan composition, and candidate generation"；库 "constructed offline rather than through a fully closed agent loop"。）
- **Live-SWE-Agent（[70]）**：从仅有 bash 的最小脚手架出发，在仓库级 issue 解决过程中现场合成并修订自定义工具（编辑器、搜索工具、分析器等），是本节唯一的工具自进化（Task-time）实例。（例：起点是 "a minimal bash-only scaffold"；能够 "create and revise custom tools"；工具 "are synthesized during the issue-solving loop"；§4.1 亦表述为 "creates and revises tools while solving repository-level issues"。）

（Table 2 行项复核：CODESKILL = Skill/tool / Post-task / Trajectory-derived + environmental / Repository-level coding tasks；GSkill = Skill/tool / Post-task / Trajectory-derived / Repository-level issue resolution；Socratic-SWE 同 GSkill 的 Timing/Evidence；EffiSkill = Skill/tool / Post-task / Environmental / Code efficiency optimization；Live-SWE-Agent = Skill/tool / Task-time / Environmental / Repository issue resolution。）

### 3. 风险 / 挑战 / 防护

- **技能泛化与具体化的两难（本节点名的核心挑战）**：技能必须 "general enough to transfer across tasks, yet concrete enough to be useful"——在具体仓库与执行环境中真正有用；太泛无法落地，太具体无法迁移。
- **原始轨迹不可直接复用**：CODESKILL 指出 "raw trajectories are too long and task-specific to be reused directly"，须先做提取与组织（技能库），而非把轨迹原文塞回上下文。
- **技能质量的验证防护**：gskill 不靠主观打分，而是在隔离仓库环境中实际运行智能体、"checking whether their patches pass tests"（补丁过测试才算数）；CODESKILL 同时使用 rubric-based skill-quality feedback 与可验证的下游执行反馈双通道；Socratic-SWE 的修复任务须经 "execution-based validation" 过滤。三者共同点：用可执行的环境反馈给技能把关。
- **闭环 vs 离线的 trade-off**：EffiSkill 的技能库 "constructed offline rather than through a fully closed agent loop"——论文以边界句明示其非封闭循环属性，与 Socratic-SWE 的闭环形成对照。
- **工具自进化尚不成熟（作者自评的边界判断）**："Tool self-evolution is closely related, but currently less developed in software-engineering-specific systems."——现有 SWE 工作大多提升「用工具」的技能，而非让智能体自主「造工具」，Live-SWE-Agent 是少数例外。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【WHAT vs HOW 核心区分】"While memory records what happened in previous tasks, skills and tools encode how the agent should act when similar situations arise again." → 记忆是「上次发生了什么」的日记，技能是「下次该怎么做」的操作手册。画面：左边一本翻旧了的日记，右边一张不断增补的 SOP 卡片。
- 【进化对象反直觉】"The evolved object in this category is therefore not the codebase itself, but the agent's procedural knowledge and tool-use capability." → 反直觉点：自进化改的不是它写的代码，而是它「会干活」这件事本身。画面：代码仓库纹丝不动，智能体脑内的「手艺」在长大。
- 【轨迹复用困境】"raw trajectories are too long and task-specific to be reused directly" → 完整录像带不能当教材用，必须剪成教学片段。画面：冗长录像带被剪成一张张技能卡。
- 【双层技能粒度】"task-level skills capture high-level procedures" 与 "event-driven skills capture local responses to recurring execution events" → 一层是「整个任务怎么打」，一层是「报错了怎么救」。画面：技能库分两个抽屉——「作战方案」与「急救手册」。
- 【技能管理也是策略】"CODESKILL treats skill management itself as a learnable policy" → 连「怎么整理技能库」这件事本身也在被学习。画面：图书管理员一边整理书架，一边优化自己的整理法。
- 【入职文档比喻】gskill 产物是 "automatically learned onboarding documents for coding agents" → 智能体进新仓库第一天的自动生成新人手册。画面：新员工工位上放着一本机器写的《本仓库生存指南》。
- 【失败根因】失败常源于 "missing project knowledge" 而非推理能力不足 → 不是不聪明，是不熟悉你家祖传代码。画面：天才程序员面对陌生老代码库抓耳挠腮。
- 【任务生成引擎】"generating verifiable software engineering tasks with SWE-smith" → 用 SWE-smith 批量造「可验证」的练习题，再让技能在进化循环里优胜劣汰。
- 【技能注册表】"an Agent Skill Registry that summarizes recurring failure modes and effective repair patterns" → 一本「踩坑-修复」对照账本；且轨迹 "rather than discarding them after reward computation"——算完奖励不扔，废物利用。画面：别人丢进垃圾桶的草稿纸被捡起来提炼成错题本。
- 【慢→快配对】EffiSkill 从 slow-to-fast program pairs 中挖技能 → 同一功能一慢一快两份代码，差异处就是优化秘籍。画面：两段代码并排 diff，高亮处冒出「提速技能 +1」。
- 【白手起家造工具】Live-SWE-Agent 从 "a minimal bash-only scaffold" 起步，工具 "are synthesized during the issue-solving loop" → 只发一个命令行，锤子扳手边干活边自己造。画面：空车间里智能体边修 bug 边打造自己的工具墙。
- 【诚实的不成熟声明】"Tool self-evolution is closely related, but currently less developed in software-engineering-specific systems." → 作者亲口承认：造工具这条线还嫩。可作为叙事转折点——技能进化已百花齐放，工具进化才刚破土。
- 【收束金句】"the agent should not only remember that a previous attempt failed, but also acquire a reusable procedure for avoiding similar failures." → 好员工不是记住「我搞砸过」，而是写出「下次不再搞砸」的流程。画面：失败便签逐渐演变成标准操作流程图。
- 【记忆 vs 技能定调】"memory self-evolution... emphasizes storage and retrieval, skill and tool self-evolution emphasizes actionability" → 记忆比的是存得全、取得快；技能比的是拿起来就能干。

Sources: [arXiv:2608.03392 HTML 全文](https://arxiv.org/html/2608.03392v1)；交叉核对 [gskill 官方博客（GEPA）](https://gepa-ai.github.io/gepa/blog/2026/02/18/automatically-learning-skills-for-coding-agents/)、[Socratic-SWE arXiv:2606.07412](https://arxiv.org/abs/2606.07412)（仅用于系统存在性核对，笔记内容以综述正文为准）。

---

## 2026-08 升级复核（第二遍全文重读校准）

> **目的**：视频配音升级轮（v2→v3）前的全文重读，逐幕核对 narration 断言与原文的一致性，并沉淀本轮升级新增断言的锚点。重读方式：WebFetch 再次全文精读 §2.3 / §3.1 / §3.4 / §4 / §5 / §7（2026-08-17）。
> **结论**：现有 narration v2 的全部论文断言与原文一致，无需事实修正；SICA 0.17→0.53 与 LiveCodeBench 0.65→0.71 数字锚点维持（原笔记 §3.1 已核）。**重要边界发现**：综述正文本身不含 SICA/DGM 的迭代次数、代数、档案规模等工程数字——首轮提取的「SWE-bench Verified 50 题随机子集」数字出自 SICA 原论文（arXiv:2504.15228）在综述 §3.1 的实例引用，本页复核未见正文展开；逐字稿不得新增任何「综述未展开」的工程数字。

### 本轮新增断言锚点（v3 新句用）

- 【§2.3 工作定义·逐字】"an agentic software engineering system that updates its behavior or internal components based on previous coding attempts and software-specific feedback"——v3 若在 P1 补定义句，以此为准。
- 【§2.3 独特性句·逐字】"the distinctiveness of self-evolving coding agents lies in the nature of the software engineering loop in which evolution occurs"。
- 【§4.1 三时机定义·逐字】Task-time "occurs while the agent is still solving the current coding task, such as when test failures, compiler errors, or tool failures" trigger immediate changes；Post-task "occurs after a task or trajectory has ended, when the agent abstracts the outcome into memory, skills, repository knowledge, or" repair experience；Stage-wise "occurs after a larger body of evidence has accumulated, such as a batch of verified trajectories, self-play tasks, repository" interactions, or validation results。
- 【§4.2 三证据定义·逐字】Outcome "summarizes whether an attempted change improves observable software-engineering performance"（例 solve rates / test pass rates / verifier scores）；Environmental "produced during the agent's interaction with the software environment"（compiler diagnostics / runtime exceptions / failed test logs / tool responses）；Trajectory-derived "comes from the complete record of an agent's attempts rather than from a single score or observation"。
- 【§4.2 时机×证据耦合规律（Table 2 结构观察）】Task-time 5 系统（Live-SWE-Agent、SEW、SEMAG、EvoMAC、AgentConductor）有 4 个属 Workflow 类；Model 类 7 系统全部 Stage-wise；Memory 类 6 系统全部 Post-task + Trajectory-derived——「改组织可当场改、改模型必须攒批、攒记忆靠复盘」的规律在 Table 2 肉眼可见（v3 P3 矩阵镜的落格动画据此强化）。
- 【§5.2 指标维度·逐字】"pass rate, solve rate, resolve rate, repair rate, benchmark score, and Pass@k" + "cost, runtime, token usage, step counts, or retrieval overhead" + 泛化（held-out repositories, new benchmarks, different models/languages）。
- 【§7 KEY QUOTE·逐字】"The central challenge for future work is therefore not merely to make coding agents evolve, but to make their evolution" trustworthy.（分页断行，语义完整即此句）。
- 【收集规模】综述正文未给出收录论文总数；Table 2 分类约 30 个代表系统；论文集在 GitHub Awesome 仓库（正文原句 "The papers we collect can be found at" + repo URL）。

### 本轮升级断言复核（v2 存量句抽查）

- p1-16「软件工程自带六份免费体检报告」↔ §1 原文六信号清单（unit tests / compiler errors / runtime traces / lint warnings / CI results / human code reviews）✓（首段笔记【六种体检信号】锚点）。
- p2-07「跑基准测试，分数涨了就留下」↔ §4.2 SICA 锚点 "selects improved versions of the agent using coding benchmark performance, cost, and runtime"——narration 简化为「分数涨」，Strictly 说还应含 cost/runtime；v3 在 2-B 数字角标镜补一句成本维（见 upgrade 文档 delta 表）。
- p3-25「改流程的，基本当场改；改模型的，必须攒批；攒记忆的，全靠复盘」↔ Table 2 结构观察 ✓（本轮新增锚点）。
- p4-16「可维护性、安全性、长期可靠性，现在还测得很弱」↔ §5 自评边界句 ✓。
- p5-07「静态 AI 出错，错一单；会进化的 AI 学错，错一辈子」↔ §6 开题金句意译 ✓（"may not only affect one patch, but also be stored as memory..."）。


---

## §3.4 Model Self-Evolution（模型自进化）

### 1. 章节主旨综述段

§3.4 是全文五分类法（agent framework / memory / skill & tool / **model** / workflow & topology，见 Figure 2 与 Table 2）中的第四类，回答的问题是：**当进化的对象是模型本身时，什么才算「自进化」、什么只是普通训练**。定义原句：*Model self-evolution refers to adaptation that changes the model-side components of a coding agent, such as the base model, adapters, agent policy, reward model, or verifier.* —— 白话：只有当基座模型、适配器、agent 策略、奖励模型或验证器这些「模型侧部件」被改写时才叫模型自进化；改存储、改检索、改执行流程而底模不动，属于前三节（§3.1–§3.3、§3.5）。作者指出软件工程场景的独特优势是反馈异常具体：tests、compiler diagnostics、execution traces、repository states、verifier judgments 都能被转成训练信号，而不只是指导一次修复。全节按四步组织：(1) 划界（判据句）；(2) 最强形态——训练信号由 agent 自身软件交互生成（Self-play SWE-RL、Agent-RLVR）；(3) 编码与验证能力共进化（ReVeal、CURE、ZeroCoder、Sol-Ver、ACE）；(4) 边界案例——SWE-RL、SWE-Gym、R2E-Gym、SWE-RM 属基建/证据而非自进化本身，末尾给出失败模式（learnable information gain）。时间维度上该类全部属 Stage-wise evolution（§4.1），证据维度横跨 Outcome 与 Environmental feedback（§4.2、Table 2）。注：论文在本节未给出符号化数学定义，定义以自然语言表述。

### 2. 代表方法列表

**（A）自生成训练信号（最强形态）**

- **Self-play SWE-RL（Wei et al., 2026）**：造 bug-修 bug-可执行验证三环闭合——agent 在真实仓库里自己制造 bug、自己尝试修复、用验证过的结果训练后面的求解器。（原文：*"Self-play SWE-RL follows this direction by coupling bug generation, bug solving, and executable verification: a software agent creates bugs in real repositories, attempts to repair them, and uses the verified outcomes to improve later solvers (66)."*；§4.1 补充它能让 agent *"create increasingly challenging bugs in real repositories"*）
- **Agent-RLVR（Da et al., 2025）**：agent 先产出软件工程轨迹，接收 guidance 与环境奖励，再用「被引导的重试」更新 agent 策略。（原文：*"software-engineering agents first produce trajectories, receive guidance and environment rewards, and then use guided reattempts to update the agent policy (13)."*）

**（B）Coder–Verifier 共进化**

- **ReVeal（Jin et al., 2025）**：交替进行代码生成与自验证，用解释器反馈加强化学习同时提升生成器「写程序」和「评判程序」两种能力。（原文：*"ReVeal alternates code generation and self-verification, using interpreter feedback and reinforcement learning to improve both the generator’s ability to produce candidate programs and its ability to judge them (32)."*）
- **CURE（Wang et al., 2025c）**：把 coder 与 unit-tester 两个角色放在一起训练，coder 靠面对越来越有信息量的测试变强。（原文见 CURE/ZeroCoder 合句：*"training coder and unit-tester roles together: the coder improves by facing increasingly informative tests, while the tester improves by exposing weaknesses in generated programs (63; 15)."*）
- **ZeroCoder（Fan et al., 2026）**：同上合训 coder 与 unit-tester，tester 靠暴露生成程序的弱点变强——不需要 ground-truth 监督（据其文献标题 *"ZeroCoder: can LLMs improve code generation without ground-truth supervision?"*；正文机制与 CURE 同句描述 (15)）。
- **Sol-Ver（Lin et al., 2025）**：把代码生成与测试生成框成 solver-verifier 自博弈，证明验证侧可以是进化的模型组件而非固定裁判。（原文：*"Sol-Ver similarly frames code generation and test generation as a solver-verifier self-play process, showing that the verification side of a coding agent can be an evolving model component rather than a fixed oracle (38)."*）
- **ACE（Huang et al., 2026）**：用对抗式单元测试生成加偏好优化加压筛选，对手发现的失败用例成为改进求解器的证据。（原文：*"ACE further sharpens the selection pressure through adversarial unit-test generation and preference optimization, where failing cases discovered by an adversary become evidence for improving the solver (28)."*）

**（C）边界案例：基建/证据，不算完整自进化**

- **SWE-RL（Wei et al., 2025）**：用开源软件演化数据+规则奖励提升 LLM 推理，但除非学习信号闭合于 agent 自身的演化尝试，否则只是 SWE 导向的模型优化。（原文：*"it is better understood as SWE-oriented model optimization unless the learning signal is closed around the agent’s own evolving attempts (65)."*）
- **SWE-Gym（Pan et al., 2025）/ R2E-Gym（Jain et al., 2025）**：提供可执行环境、轨迹与验证器信号，使策略改进成为可能，但主要角色是 infrastructure 而非自进化本身。（原文：*"provide executable environments, trajectories, and verifier signals that make agent policy improvement possible, but their primary role is infrastructure rather than self-evolution itself (45; 30)."*）
- **SWE-RM（Shum et al., 2025）**：训练奖励模型提供 execution-free 反馈，用于 test-time scaling 与 RL，但它是 learned evidence（习得的证据），不是完整的自进化 agent。（原文：*"the reward model is learned evidence supporting agent improvement rather than a complete self-evolving agent (52)."*）
- **Liu et al., 2026（分析性工作，引用 40）**：对 self-play 编码任务的近期分析，证明可持续改进需要跨迭代的 learnable information gain——本节风险论述的依据（见第 3 节）。

**（D）Table 2 中 Model 类别七行（原样）**：Self-play SWE-RL (66)｜Model｜Stage-wise｜Outcome + environmental｜Bug generation and repair；Agent-RLVR (13)｜Stage-wise｜Environmental｜Repository-level issue resolution；ReVeal (32)｜Stage-wise｜Environmental｜Code generation and verification；CURE (63)｜Stage-wise｜Environmental｜Code generation and test generation；ZeroCoder (15)｜同 CURE 行；Sol-Ver (38)｜Stage-wise｜Environmental｜Code generation and verification；ACE (28)｜Stage-wise｜Environmental｜Code generation and unit testing。

### 3. 风险 / 挑战 / 防护

- **数据多 ≠ 进化**（本节核心失败模式）：*"generating more data does not guarantee evolution"*；引用 (40) 的分析指出 *"sustainable improvement requires learnable information gain across iterations; otherwise, the loop may reinforce existing biases or produce redundant tasks without improving the next agent"*。§4.1 重申为 *"A central risk is that larger self-generated or automatically filtered data does not necessarily produce better agents."*
- **强大但脆弱（powerful but fragile）**：模型更新影响跨任务的行为，*"incomplete tests, reward hacking, synthetic-data artifacts, or weak verifiers may teach the agent brittle habits that are difficult to detect from task success alone"*——坏习惯难以从任务成功率上察觉。
- **判据本身是防护**：是否自进化取决于学习信号是否来自 agent 自身尝试并经 closed software-feedback loop 改变未来 agent（判据句见第 4 节金句）；§4.1 补充边界纪律 *"not every SWE-oriented post-training pipeline is self-evolution. The feedback must be tied to the agent’s own attempts, generated tasks, or interaction outcomes, rather than merely being an externally curated training dataset."*
- **§6 全局风险对模型路径的放大**：*"An unreliable test result, noisy trajectory, weak verifier, or benchmark-specific shortcut may not only affect one patch, but also be stored as memory, distilled into a skill, selected as a workflow, or used to update a model."* 且 *"tests, compilers, CI logs, generated tests, and reward models are imperfect"*，依赖 unit-test validation、environment rewards 或 learned verifiers 的系统 *"may therefore inherit the biases and blind spots of these signals (65; 45)"*；*"a misleading feedback signal can shape future behavior rather than only one output."*（§6 之 Feedback reliability 小节）
- **Trade-off：SWE-RM 的定位**——奖励模型可以 *"replacing or complementing costly execution"*（替代/补充昂贵的执行验证）来支撑 stage-wise 更新，但代价是它只是 learned evidence 而非进化主体本身（§4.1）。
- **防护指向**：论文对防护措施的展开限于「依赖可靠训练环境与验证器」（§4.1：stage-wise evolution *"depends on reliable training environments and verifiers"*）；具体防护机制论文未展开。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【判据金句｜全节锚点】*"The key boundary is that ordinary post-training becomes self-evolution only when software-specific experience is fed back into the model-side components that govern later agent behavior."* → 白话：普通后训练只有当「软件专有经验被回灌进支配后续行为的模型侧组件」时，才升级为自进化——不是算法升级，是回路升级。画面：一条训练流水线，中间插上一个「回流阀」，把出口的经验抽回入口的模型本体。
- 【反直觉｜SFT vs RL 不是关键】*"model self-evolution is less about the choice of SFT or RL as an algorithm, and more about whether coding trajectories, executable outcomes, or verifier judgments become persistent changes in the agent’s future policy."* → 白话：用监督微调还是强化学习根本不重要，重要的是「经验有没有沉淀成未来策略的永久改变」。画面：SFT/RL 两个标签被划掉，箭头指向「经验→未来策略」这条主轴。
- 【比喻｜环境不是考官是老师】*"the executable environment is not merely an evaluation harness. It becomes part of the learning loop that turns failed or successful coding attempts into model-side changes."* → 白话：可执行环境不再只是打分的考场，它变成学习回路的一部分，把成败的编码尝试都炼成模型的改变。画面：测试环境从「考场」变身「教练」，直接站进训练循环的圆环里。
- 【反直觉｜数据通胀】*"Self-generated tasks are especially attractive in this respect, but they also expose a failure mode: generating more data does not guarantee evolution."* → 白话：自己造任务很诱人，但造得越多≠学得越好，可能原地转圈甚至强化偏见。画面：传送带源源不断送出题目，机器人却停在原地，分数曲线水平不动。
- 【反直觉标题｜信息增益门槛】被引论文 (40) 标题即结论：*"Self-play only evolves when self-synthetic pipeline ensures learnable information gain"*（Liu et al., 2026, arXiv:2603.02218）→ 白话：自博弈只有在「自合成管线保证有可学的信息增益」时才会进化——题目重复、无新信息，等于白练。画面：筛选漏斗，题目流过时只有带「新信息增量」标签的才能掉进训练池。
- 【比喻｜考官也进化】*"the verification side of a coding agent can be an evolving model component rather than a fixed oracle."*（Sol-Ver 句）→ 白话：验证器不是钉死的裁判，而是跟着选手一起成长的另一个模型组件。画面：考场里判卷的考官每判一卷自己也在变强，出题越来越刁。
- 【对抗式例子｜ACE】*"failing cases discovered by an adversary become evidence for improving the solver."* → 白话：对手专门挖出来的失败用例，反过来变成求解器进步的养料。画面：红队黑客与白队程序员背靠背，黑客每攻破一次，就把「攻击报告」递给程序员当教材。
- 【造越难越强的闭环｜Self-play SWE-RL】§4.1：*"a software agent can create increasingly challenging bugs in real repositories and use the resulting repair outcomes to improve later solvers."* → 白话：agent 在真实仓库里出的题一版比一版难，修题成绩又用来训练下一代解题者。画面：关卡编辑器自动生成越来越难的 bug 关卡，通关录像自动变成下一代玩家的训练教材。
- 【系统命名素材｜健身房与健身房2】SWE-Gym、R2E-Gym 的本名自带「健身房」比喻：论文定位它们是 *"infrastructure rather than self-evolution itself"* / §4.1 *"better understood as infrastructure for this form of evolution"*——提供器械（可执行任务、轨迹、验证信号），但健身房本身不举铁。画面：健身房大门特写，标注「器械供应商」，与正在举铁的 agent 区分。
- 【强大但脆弱｜收束句】*"This makes model self-evolution powerful but fragile."* → 白话：模型自进化威力最大，也最易碎。画面：一枚精密陀螺高速旋转（强大），镜头拉近显示裂纹（incomplete tests / reward hacking / synthetic-data artifacts / weak verifiers 四道裂纹标签）。
- 【§6 警句｜错误会被制度化】*"a misleading feedback signal can shape future behavior rather than only one output."* → 白话：一条误导性的反馈信号毒化的不是一次输出，而是未来的所有行为——错误被「制度化」了。画面：一滴墨落入循环水管，随循环染黑整个水池。
- 【证据分类｜模型层证据】§4.2：*"At the model level, verifiable software-task outcomes can be converted into policy updates or coder–verifier training signals (66; 13; 32; 28)."* 与 *"environment rewards, sandboxed execution, generated tests, and adversarial failures ground policy or verifier updates in observable software behavior (13; 66; 32; 63; 15; 38; 28)."* → 白话：可验证的任务结果能被「兑换」成策略更新；环境奖励、沙箱执行、生成的测试、对抗失败，都是模型更新落地到可观察软件行为的锚点。画面：四路信号线汇入同一台「兑换机」，输出为模型权重增量。
- 【作者自评边界｜分层叙事用】作者对本节与前后的分界：*"This differs from memory, skill, or workflow self-evolution, where the agent may change what it stores, retrieves, or executes while keeping the underlying model fixed."* → 白话：前三类进化改的是「存什么、取什么、执行什么」，模型自进化改的是模型本身。画面：五层抽屉柜，第四层抽屉里装的是「模型权重」图标被高亮点亮。


---

## §3.5 Workflow and Topology Self-Evolution + §4 Evolving Time and Evidence 提取笔记（Self-Evolving Coding Agents: A Survey, arXiv:2608.03392v1）

### 1. 章节主旨综述段

§3.5 是全文五类分类法（§3，配 Figure 2 与 Table 2）的最后一类，把“进化对象”从单个智能体组件（框架、记忆、技能工具、模型）上移到智能体系统的组织结构本身：workflow（工作流）、agent roles（角色）与 communication topology（通信拓扑）。论文的立论是：编码智能体失败往往不是模型写不出补丁，而是系统组织错了——定位错文件、跳过 bug 复现、测试调得太晚、失败日志发错了 agent。任务难度跨度大，固定协作协议会变脆，因此应让组织结构随任务难度、执行反馈与验证需求自适应。组织逻辑为三段递进：先讲可变协作网络（SEMAG/EvoMAC），再讲图结构表示的 workflow（SEW/AFlow/EvoAgentX），最后聚焦通信拓扑（AgentConductor 的密度感知 DAG）与“协作量”这一权衡。§4 与 §3 正交，回答“何时进化（Evolving Time, §4.1）与凭什么进化（Evolving Evidence, §4.2）”两个互补维度，开篇即申明二者紧耦合：同一个编译器错误可当场改补丁，而跨 issue 的反复失败会被固化成仓库记忆/技能/训练数据。形式化定义说明：§3.5 与 §4 均无符号化数学定义（该 HTML 全文这两节内 `<math>` 元素为 0 个），操作性定义均为文字型原句——三种时机定义见 §4.1 首段（"Task-time evolution occurs while the agent is still solving the current coding task…Post-task evolution occurs after a task or trajectory has ended…Stage-wise evolution occurs after a larger body of evidence has accumulated"），白话即：任务中快改、任务后复盘沉淀、攒一批证据后换代升级；三类证据定义见 §4.2 三个小节标题（Outcome / Environmental / Trajectory-Derived），分别对应“只看结果分、过程中环境信号、完整轨迹复盘”。符号化形式定义在 §2.3，不在本辖区，论文于此未展开。

### 2. 代表方法列表

**§3.5 Workflow and Topology Self-Evolution**

- **ChatDev（Qian et al., 2023）/ MetaGPT（Hong et al., 2023）/ AgentCoder（Huang et al., 2023）**：证明角色分工、讨论、测试与审查有益于软件开发与代码生成，但其角色与消息路径基本由人工设计。（例：论文原文表述 "their roles and message paths are largely human-designed"）
- **SEMAG（Peng et al., 2026）**：按任务难度协调 planning、coding、debugging、discussion 组成多智能体代码生成工作流，并让模型选择随可用编码底座一起进化。（例："adapts a multi-agent code-generation workflow by coordinating planning, coding, debugging, and discussion according to task difficulty, while also allowing model selection to evolve with the available coding backbones"）
- **EvoMAC（Hu et al., 2024）**：把软件开发团队建模为多智能体协作网络，其 agent 与连接可用文本化环境反馈、基于单元测试的验证和文本反向传播来更新。（例："a multi-agent collaboration network whose agents and connections can be updated using textual environmental feedback, unit-test-based verification, and textual back-propagation"）
- **SEW（Liu et al., 2025）**：对自动代码生成同时进化 agent prompt 与 workflow 拓扑，使不同编码任务不必共用同一条手工流水线。（例："both agent prompts and workflow topology can be evolved, so different coding tasks need not share the same hand-crafted pipeline"）
- **AFlow（Zhang et al., 2024）**：用蒙特卡洛树搜索在代码表示的 workflow 空间中搜索，并利用执行反馈。（例："searching over code-represented workflows with Monte Carlo Tree Search and execution feedback"）
- **EvoAgentX（Wang et al., 2025）**：把 workflow 优化打包进更广的自进化智能体框架，联合精炼 prompt、工具与 workflow 拓扑（含代码生成任务）。（例："jointly refining prompts, tools, and workflow topologies"）
- **AgentConductor（Wang et al., 2026）**：用执行反馈为竞赛级代码生成任务生成任务自适应、密度感知的通信 DAG。（例："generating task-adaptive, density-aware communication DAGs for competition-level code generation using execution feedback"）

**§4.1 三种时机下的代表系统**

- **Live-SWE-Agent（Xia et al., 2025）**：在解决仓库级 issue 的过程中创建并修订工具（task-time）。（例："creates and revises tools while solving repository-level issues"）
- **SWE-Exp（Chen et al., 2026）/ Repository Memory（Wang et al., 2026）/ EvoRepair（Hu et al., 2026）**：把已完成的 issue 解决/修复轨迹变成可检索经验——issue 解决记忆、仓库专属知识、漏洞修复经验（post-task）。
- **EvoCoder（Lin et al., 2024）/ Subtask-Level Memory（Shen et al., 2026）/ SAGE（Hayashi et al., 2025）**：post-task 证据不限于整段 episode，可组织为层级化复现经验、子任务对齐轨迹、计划级抽象。
- **CODESKILL（Li et al., 2026）/ GSkill（Tan et al., 2026）/ Socratic-SWE（Xiao et al., 2026）/ EffiSkill（Wang et al., 2026）**：把轨迹蒸馏成可复用编码技能，后续 agent 由抽象出的程序性知识而非原始历史引导。（例："guided not by the raw history itself, but by abstracted procedures learned from previous development attempts"）
- **Self-play SWE-RL（Wei et al., 2026）**：耦合 bug 生成、bug 解决与可执行验证，让 agent 在真实仓库中造出越来越难的 bug，用修复结果改进后续求解器（stage-wise）。（例："create increasingly challenging bugs in real repositories and use the resulting repair outcomes to improve later solvers"）
- **Agent-RLVR（Da et al., 2025）**：agent 先产出 SWE 轨迹、接收引导与环境奖励，再用带引导的重试更新策略（stage-wise）。
- **SWE-RL（Wei et al., 2025）**：展示软件进化数据对训练 SWE 推理模型的价值，但被划为"SWE-oriented model optimization"（除非训练信号闭环于 agent 自身进化行为）。
- **ReVeal（Jin et al., 2025）/ CURE（Wang et al., 2025）/ ZeroCoder（Fan et al., 2026）/ Sol-Ver（Lin et al., 2025）/ ACE（Huang et al., 2026）**：coder–verifier 与对抗测试设定，生成程序、生成测试与执行结果成为强化后续模型行为的证据（stage-wise）。
- **SWE-Gym（Pan et al., 2025）/ R2E-Gym（Jain et al., 2025）**：为此形态进化提供可执行任务、轨迹与验证信号的"infrastructure"，本身不是完整自进化 agent。
- **SWE-RM（Shum et al., 2025）**：以学习到的奖励模型替代/补充昂贵执行来支撑 stage-wise 更新，属"learned evidence"而非进化主体。
- **Liu et al., 2026（引文 40）**：对自博弈编码任务的分析——自进化需要跨迭代存在可学习的信息增益，否则只会产生冗余数据或强化既有偏见。

**§4.2 三类证据下的代表系统**

- **SICA（Robeyns et al., 2025）**：用编码基准性能、成本与运行时间来筛选改进后的 agent 版本（outcome）。（例："selects improved versions of the agent using coding benchmark performance, cost, and runtime"）
- **Darwin Gödel Machine（Zhang et al., 2025）及其后继 Mendel（Anonymous, 2026）/ Huxley（Wang et al., 2025）**：维护编码 agent 变体的档案（archive），保留能提升实证编码表现的自修改（outcome）。
- **Novikov et al., 2025 / CodeEvolve（Assumpcao et al., 2025）/ Hu et al., 2026b（引文 43; 4; 25）**：算法发现与优化类代码进化系统，按执行表现指标选择生成的程序或 agent 修改（outcome）。
- **Live-SWE-Agent / EvoMAC（引文 70; 26）**：环境反馈分别作为在线工具进化的直接触发器，以及多智能体开发网络中传播改进的信号（environmental）。
- **CODESKILL / GSkill / EffiSkill（引文 34; 53; 64）**：把反复出现的命令失败、测试输出模式、运行时行为与优化轨迹抽象成可复用技能而非用完即弃（environmental → skill）。
- **轨迹记忆类（引文 11; 56; 37; 24）/ 子任务级与计划级记忆（50; 21）/ 技能蒸馏类（34; 53; 64; 71）**：issue 解决、定位、复现、修复轨迹压缩为经验库或仓库知识；按内部结构抽象轨迹；将编码 rollout、修复尝试与优化轨迹蒸馏为技能注册表（trajectory-derived）。

**Table 2 中 Workflow and topology 六系统的时机×证据坐标（原样转录）**：SEW = Task-time + Outcome+environmental（Code generation）；AFlow = Stage-wise + Outcome；EvoAgentX = Stage-wise + Outcome；SEMAG = Task-time + Outcome+environmental（Multi-agent code generation）；EvoMAC = Task-time + Outcome+environmental（Multi-agent development）；AgentConductor = Task-time + Environmental（Competition-level code generation）。

### 3. 风险 / 挑战 / 防护

- **进化工作流的三重风险（§3.5 末段，逐字）**："Evolved workflows may overfit to benchmark feedback, add unnecessary coordination overhead, or optimize for passing tests while neglecting maintainability." —— 过拟合基准反馈、不必要协调开销、为过测牺牲可维护性（maintainability）。
- **过度协作/欠协作 trade-off（§3.5）**：协作量是任务依赖的设计决策——"easy tasks may suffer from excessive discussion, while difficult tasks may require richer interaction among planners, coders, debuggers, and reviewers"。
- **工作流进化位于更全局层级，故风险更大（§3.5）**：它决定"when repository search happens, whether debugging is separated from patch generation, how test failures are routed, which agent reviews a patch, and how much communication is worth paying for"；挑战不止于发现更好的协作图，还要确保其在真实开发反馈下改进正确性、效率与鲁棒性。
- **stage-wise 的边界防护（§4.1）**："not every SWE-oriented post-training pipeline is self-evolution. The feedback must be tied to the agent’s own attempts, generated tasks, or interaction outcomes, rather than merely being an externally curated training dataset." —— SWE-RL 被据此划出边界；SWE-Gym/R2E-Gym 被降格为 infrastructure；SWE-RM 仅为 learned evidence。
- **自博弈数据规模≠收益（§4.1，关键风险）**："A central risk is that larger self-generated or automatically filtered data does not necessarily produce better agents." 自进化需要跨迭代的 learnable information gain，否则"the loop may simply generate more redundant data or reinforce existing biases"。
- **task-time 进化的局部性（§4.1）**：适应往往局部于当前任务，"become more valuable when later consolidated into memory, skills, reusable workflows, or model-level updates"。
- **outcome evidence 的解释力缺陷（§4.2）**："it often identifies which agent is better without explaining why the improvement occurred"。
- **environmental feedback 的抽象门槛（§4.2）**："it must often be abstracted before it can support longer-term self-improvement"。
- **trajectory-derived evidence 的处理成本（§4.2）**："harder to process; compared with environmental feedback, it is less immediate"。
- **stage-wise 依赖可靠训练环境与验证器（§4.1）**："stage-wise evolution depends on reliable training environments and verifiers"。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【反直觉断言】"A coding agent may fail not because its model cannot write a patch, but because the system localizes the wrong file before editing, skips bug reproduction, invokes testing too late, sends failure logs to the wrong agent, or forces all tasks through the same rigid planning–coding–debugging loop." → 模型会写代码，团队流程却能把好模型带崩：改错文件、跳过复现、测试太晚、日志送错人、万任务一条死流程。→ 画面：一条固定流水线上，机器人把“报错报告”塞进了“写文档”工位的收件箱，旁边“修 bug”工位空转。
- 【金句·协作即工程决策】"collaboration should be treated as a software-engineering decision: the agent must decide not only what code to write, but also which roles should inspect, test, critique, or revise that code." → 写什么代码是决策，谁来查、测、批、改这份代码同样是决策。→ 画面：一张会议排座表在 AI 眼中变成可编辑的代码文件，增删“测试员”“评审员”座位。
- 【金句·反馈的双重身份】"test results and code quality signals do not merely judge the final program; they also provide evidence about whether the collaboration pattern that produced the program should be revised." → 测试结果既给程序打分，也给“造出这个程序的组织方式”打分。→ 画面：一份测试报告一分为二，一半指向代码，一半指向背后那张协作网络图。
- 【金句·不是加步骤】"workflow evolution is not simply adding more steps; it is about discovering which verification, debugging, and refinement paths are worth activating for a particular class of coding problems." → 进化不是把流程越堆越长，而是学会“这类问题该点亮哪条支路”。→ 画面：地铁线路图上，AI 按任务难度点亮/熄灭不同支线。
- 【金句·全局层的清单】"It determines when repository search happens, whether debugging is separated from patch generation, how test failures are routed, which agent reviews a patch, and how much communication is worth paying for." → 工作流层掌管五个灵魂拷问：何时搜仓库、修 bug 与写补丁是否分家、失败日志发给谁、谁来评审、沟通值多少钱。→ 画面：五盏开关面板，每盏标注一问，AI 逐盏拨动。
- 【比喻·组织即网络】EvoMAC 把开发团队建成"whose agents and connections can be updated"的网络——团队编制和汇报线本身可被改写，还配了"textual back-propagation"（文本反向传播）把功劳/错误传回连接上。→ 画面：组织架构图的连线被梯度染成红蓝，粗细随每次任务涨落。
- 【具体机制·密度感知 DAG】AgentConductor 生成"density-aware communication DAGs"——按任务难度调“沟通密度”，简单题少开会、难题多协作（"easy tasks may suffer from excessive discussion"）。→ 画面：同一张 DAG 图，左侧稀疏几条边（easy task），右侧密集蛛网（hard task）。
- 【金句·解决与进化的边界消融】"These works blur the boundary between solving and evolving: the same execution trace that exposes a failed plan can also guide an immediate reorganization of agent behavior." → 暴露失败计划的同一条执行轨迹，转身就能指挥即时重组——“干活”与“变强”同一条流水线。→ 画面：一条传送带同时输出“补丁”和“组织结构调整令”。
- 【时机×证据耦合·开场例子】"A compiler error observed during a single debugging attempt may lead to an immediate revision of the current patch, while repeated failures across issues may be consolidated into repository memory, reusable skills, or training data for later model updates." → 一次报错当场改补丁，反复报错升级成记忆、技能乃至下一代模型的训练数据。→ 画面：单个火花 vs 累积成电池，同一类事件因“次数”走上两条时间线。
- 【反直觉断言·信号不同权】"a test failure, a runtime trace, a code review comment, and a self-generated repair task do not provide the same kind of supervision, even when they all indicate that the current agent behavior should change." → 四种“你错了”的信号，监督力度完全不同。→ 画面：四种不同颜色的告警灯，都闪，但下游齿轮完全不同。
- 【金句·快慢取舍】"task-time evolution is fast and local, post-task evolution turns individual outcomes into reusable experience, and stage-wise evolution supports broader updates that may affect future agent versions." → 任务中快改（局部）、任务后复盘（沉淀）、攒批换代（影响未来版本）——三层时间尺度的接力。→ 画面：秒表、日记本、进化树三格漫画。
- 【金句·post-task 的本质】"the agent is no longer only using feedback to repair the current patch; it can reinterpret the completed trajectory as evidence for future behavior." → 任务结束后，反馈的用途从“修这一单”变成“为下一单改规则”。→ 画面：AI 合上一份工单，把它塞进“教科书”而非“废纸篓”。
- 【金句·选择压力】"it provides the selection pressure that decides which agent variants, workflows, skills, or policies should survive." → outcome 证据就是自然选择的选择压，决定哪个变体活下来。→ 画面：多个 agent 变体站在跑分榜下，低分者淡出。
- 【金句·outcome 的盲区】"it often identifies which agent is better without explaining why the improvement occurred." → 分数只说“谁更好”，不说“为什么”。→ 画面：成绩单上只有名次栏，评语栏一片空白。
- 【金句·轨迹的价值】"Such trajectories are especially valuable because they reveal not only whether an attempt worked, but how it unfolded." / "Its value lies in abstraction: it turns concrete software attempts into reusable experience, memory, skills, and curricula that can shape future agent behavior across tasks." → 轨迹珍贵在“怎么发生的”，价值兑现靠抽象。→ 画面：一条长录像带被剪辑成一张张“招式卡片”。
- 【金句·环境反馈的定位】"it does not only judge an entire attempt, but exposes the intermediate conditions under which the current strategy succeeds, stalls, or breaks." → 环境反馈不判整场胜负，而是直播“此刻策略是顺、是堵、还是崩”。→ 画面：仪表盘上实时跳动的编译器/测试/工具读数。
- 【作者自评边界句】"SWE-Gym and R2E-Gym are better understood as infrastructure for this form of evolution… they are not themselves complete self-evolving agents" + SWE-RL "is better understood as SWE-oriented model optimization unless the training signal is closed around the agent’s own evolving behavior" → 综述亲自画线：健身房是器材不是运动员；不闭环的训练只是模型优化。→ 画面：两个系统站在“自进化”门外，门上写着“信号必须来自你自己的尝试”。
- 【数据·Table 2 结构观察】Table 2 中标注 Task-time 的 5 个系统（Live-SWE-Agent、SEW、SEMAG、EvoMAC、AgentConductor）有 4 个属于 Workflow and topology 类；Model 类 7 个系统全部为 Stage-wise；Memory 类 6 个全部为 Post-task + Trajectory-derived。→ 时机与证据的耦合在表上肉眼可见：改组织可以当场改，改模型必须攒批，攒记忆靠复盘。→ 画面：Table 2 按列染色，出现整齐的色块带。
- 【金句·自博弈的清醒剂】"self-evolution requires learnable information gain across iterations; otherwise, the loop may simply generate more redundant data or reinforce existing biases" → 没有可学的信息增益，自博弈只是原地刷副本刷出更多冗余、还把偏见越练越深。→ 画面：仓鼠轮上堆满重复的纸卷，轮子并不前进。


---

## §5 Benchmarks and Evaluation · §6 Challenges and Open Problems · §7 Conclusion（附 Table 2 结构）

### 1. 章节综述

§5–§7 构成全文的「检验与收束」部分：§3 给出五分类（框架/记忆/技能工具/模型/工作流拓扑），§4 给出「何时进化、凭什么进化」两个正交维度，§5 则回答「拿什么证明它在进化」，§6 汇总四组未解挑战，§7 以一句话定调全篇。

**§5 的核心命题**：对自进化编码代理而言，评测具有双重角色——它既是性能的量尺，也是代理进化所依赖的证据来源之一。评测结果（一次跑分、一个失败测试、一个验证器判决、一条昂贵轨迹）本身就是决定「记忆该不该留、技能该不该复用、工作流该不该改、模型侧该不该更新」的信号。因此评测算的是三样东西：被解决的软件工程任务本身、执行中与执行后可得的证据、以及积累的经验是否带来**持续**（persistent）的改进。

**§5.1 基准分两层**：仓库级 issue 解决（SWE-bench 家族）是中心评测场景，要求代理在真实工程里读 issue、看仓库结构、定位文件、改代码、跑测试、按可执行反馈迭代补丁；函数级/竞赛级基准（HumanEval/MBPP/APPS/CodeContests/LiveCodeBench）角色不同，是**互补证据而非替代品**。**§5.2 指标分两层**：结果指标（pass rate、Pass@k 等）只是部分信号，分数涨了但说不出涨在哪里；更有信息量的评测要**暴露进化过程本身**（成本/时间约束下是否改进、变体档案、技能是否迁移），再加上效率（cost/runtime/token/步数/检索开销）与泛化（held-out 仓库、新基准、异模型、异语言）维度。

**§6 的组织逻辑**是一个递进因果链：自进化代理的行为随时间改变，所以**一个坏信号不只污染一个补丁**，而会被存进记忆、蒸馏成技能、选成工作流、写进模型——于是挑战从「性能是否提升」升维为「进化过程是否可靠（reliable）、可复现（reproducible）、符合软件工程约束（aligned）」。四组挑战依次是：① 可复现性/污染/基准过拟合；② 反馈可靠性/安全/工具依赖；③ 长期记忆/技能/协调；④ 超越短基准的评测。

**§7 结论**把全文定性为「一族扎根于可执行软件工件与仓库级上下文的适应过程」而非单一算法技术，落点在 KEY QUOTE（见第 4 段）。

**形式化定义**：论文未在 §5–§7 给出形式化定义（含符号的定义集中在 §2.3，不在本辖区）；本章最接近「定义性」的表述是评测双重角色的开篇句（原句见第 4 段第 1 条）。

### 2. 代表方法列表

**基准（§5.1）**

- **SWE-bench（Jimenez et al., 2023）**：从真实 GitHub issue 与对应 pull request 收集任务，配执行式验证（execution-based validation）——即「补丁跑过测试才算过」。（例：论文原文表述 "SWE-bench introduced this setting by collecting real GitHub issues and their corresponding pull requests, together with execution-based validation (31)."）
- **SWE-bench Lite / SWE-bench Verified / SWE-Bench Pro（论文统一引 31; 14，Pro 为 Deng et al., 2025）**：三个变体分别细化仓库级评测的难度、验证质量与长程性（difficulty, validation quality, long-horizon nature）；论文未单独分列 Lite/Verified 的各自引用。
- **SWE-Gym（Pan et al., 2025）**：把软件工程任务改造成可执行的训练与评测环境，供代理与验证器使用（"turning software-engineering tasks into executable training and evaluation environments for agents and verifiers"）。
- **HumanEval（Chen et al., 2021）**：从 docstring 做 Python 程序合成的功能正确性评测。
- **MBPP（Austin et al., 2021）**：短、入门级编程任务，带自然语言规约与测试。
- **APPS（Hendrycks et al., 2021）与 CodeContests（Li et al., 2022）**：转向更难的竞赛编程场景。
- **LiveCodeBench（Jain et al., 2024）**：强调防污染（contamination-aware）与持续更新（continuously updated）的代码评测；§6 再度引用它佐证「污染与基准特化适应是已知问题」。

**暴露进化过程的评测系统（§5.2）**

- **SICA（Robeyns et al., 2025）**：追踪代理的自我修改在成本与时间约束（cost and time constraints）下是否提升基准表现。
- **Darwin Gödel Machine（Zhang et al., 2025）**：维护改进后代理变体的档案（archives of improved agent variants）。
- **SWE-Exp（Chen et al., 2026）/ CODESKILL（Li et al., 2026）/ GSkill（Tan et al., 2026）/ Socratic-SWE（Xiao et al., 2026）**：评测积累的轨迹、学到的技能或仓库知识是否改进**后续**任务（论文合并引用 34; 53; 71; 11）。
- **可执行反馈即指标（引 66; 45; 65，即 self-play SWE-RL、SWE-Gym、SWE-RL）**：单元测试结果、回归避免（regression avoidance）、验证器判决与奖励信号，同时充当评测标准与进化证据。
- **效率与泛化指标引用集（引 48; 11; 56; 70 与 34; 71; 53）**：报告 cost、runtime、token usage、step counts、retrieval overhead；并测试进化出的能力能否迁移到 held-out 仓库、新基准、不同模型、不同编程语言（其中 56 为 Repository Memory、70 为 Live-SWE-Agent）。
- **SEMAG（Peng et al., 2026）与 SEW（Liu et al., 2025）**：函数级/竞赛级基准的典型使用者——用它们评测代码生成能力、算法推理与工作流优化。

**§6 挑战论证中点名的工作**：SICA（48）与 DGM（77）——用基准结果挑选自我修改/代理变体的系统对评测噪声与基准泄漏（benchmark leakage）特别敏感；SWE-RL（65）与 SWE-Gym（45）——依赖单测验证/环境奖励/学习型验证器的系统会继承这些信号的偏差与盲区；SWE-Exp（11）、CODESKILL（34）、Socratic-SWE（71）——经验库/仓库记忆/技能库会过期、冗余、过度绑定仓库、被失败轨迹污染；SEW（39）——多代理与工作流进化提高性能的同时增加成本、不稳定与责任模糊（responsibility ambiguity）。

### 3. 风险 / 挑战 / 防护

- **可复现性（Reproducibility）**：自进化使复现困难，因为代理会跨运行、跨任务、跨仓库、跨工具环境、跨模型版本地改变；用基准结果做变体选择的系统（SICA、DGM）对 evaluation noise 与 benchmark leakage 尤其敏感。防护方向（论文原话）："Future evaluations must distinguish genuine improvement from memorization, repeated benchmark tuning, or overfitting to public validation signals."——未来评测必须区分真实进步与「背题/反复调基准/对公开验证信号过拟合」。
- **污染与过拟合（Contamination / benchmark overfitting）**：代码评测中污染与基准特化适应已是已知问题（引 LiveCodeBench）。
- **反馈可靠性（Feedback reliability）**：tests、compilers、CI logs、generated tests、reward models 皆有缺陷；依赖 unit-test validation、environment rewards、learned verifiers 的系统会「inherit the biases and blind spots of these signals」。放大器效应：当代理修改工具、工作流或自身脚手架（scaffolds）时，"a misleading feedback signal can shape future behavior rather than only one output"——误导性反馈塑造的是**未来所有行为**，不止这一次输出。
- **工具依赖与安全**："Tool reliability, sandbox fidelity, and safety checks are therefore part of the self-evolution problem, not merely implementation details."——工具可靠性、沙箱保真度、安全检查本身就是自进化问题的一部分，不是实现细节。
- **长期记忆/技能的质量控制**：Experience banks、repository memory、skill libraries 可能 stale（过期）、redundant（冗余）、overly repository-specific（过度绑定仓库）、contaminated by failed trajectories（被失败轨迹污染）。
- **协调的代价**：进化角色、通信模式或拓扑结构可能提升性能，但也带来 cost、instability、responsibility ambiguity。
- **评测盲区**：现有证据大多只支持域内/近域泛化（跨编码基准、跨仓库、相关软件任务）；进化行为在原始基准或仓库之外是否依然鲁棒，未被充分检验。防护句式（论文原文）："Future work should therefore evaluate not only whether agents improve where they evolve, but also whether the evolved behavior remains robust beyond the original benchmark or repository setting."
- **§7 开出的防护清单**（结论段，逐字）：需要「validate feedback, revise stale memory, audit learned skills, constrain self-modification, and evaluate long-term software quality beyond immediate task success」这五类机制——验证反馈、修订过期记忆、审计学到的技能、约束自我修改、评估即时任务成功之外的长期软件质量。

### 4. 科普叙事素材（金句 / 比喻 / 例子）

- 【总纲·评测即进化燃料】"Evaluation plays a dual role in the study of self-evolving coding agents." → 「考试」对普通 AI 只是打分，对自进化代理还是饲料：考卷本身就是它学习的教材。画面：一张卷子被撕下来折成纸飞机飞进代理脑中，落地变成一块新的记忆积木。
- 【核心意象·四种信号四种去向】"A benchmark result, a failed test, a verifier judgment, or a costly trajectory may all serve as signals for deciding whether a memory item should be retained, a skill should be reused, a workflow should be revised, or a model-side component should be updated." → 一次跑分、一个挂掉的测试、一个裁判的判决、一条烧钱的轨迹——四种废料，四种再利用：留记忆、复技能、改流程、更新模型。画面：四条传送带把不同颜色的废料分别送进四个加工车间。
- 【反直觉断言】"evaluation for self-evolving coding agents must go beyond one-shot task success" → 自进化代理的评测必须超越「一次性任务成功」——一锤子买卖的分数说明不了任何进化。
- 【金句·分数不说人话】"A higher score shows that the agent performs better, but it does not explain whether the improvement comes from memory, skills, workflow changes, verifier feedback, or model-side adaptation." → 分数涨了，但分数不会招供：功劳属于记忆？技能？工作流？验证器？还是模型本身？——五个体面的「嫌疑人」都没不在场证明。画面：五个嫌疑人剪影站成一排，头顶只有一个孤零零的分数。
- 【互补定位】"they are best viewed as complementary evidence rather than substitutes for repository-level evaluation" → 函数级/竞赛基准是「体检指标」，仓库级基准才是「临床手术」——互补而非替代。
- 【具体评测手法】SICA 式追踪 = "improve benchmark performance under cost and time constraints"（在成本与时间约束下改进）；DGM 式档案 = "maintain archives of improved agent variants"（给每一代改进体建博物馆/族谱）。
- 【反直觉断言·坏信号会遗传】"An unreliable test result, noisy trajectory, weak verifier, or benchmark-specific shortcut may not only affect one patch, but also be stored as memory, distilled into a skill, selected as a workflow, or used to update a model." → 一个不可靠的测试结果不会只毁掉一个补丁——它会被存成记忆、蒸馏成技能、选成工作流、或写进模型，完成「跨代遗传」。这是 §6 的开题金句，自进化把单点错误升级为系统性错误。画面：一滴墨掉进水库，整个供水系统变黑。
- 【升维定义】"the key challenge is not only whether self-evolution improves benchmark performance, but whether the evolutionary process remains reliable, reproducible, and aligned with software engineering constraints." → 问题不再是「进化涨不涨分」，而是进化过程是否 reliable / reproducible / aligned（可靠、可复现、守软件工程的规矩）。
- 【金句·三个 R 假动作】"distinguish genuine improvement from memorization, repeated benchmark tuning, or overfitting to public validation signals" → 未来评测要学会辨「真进步」与三种假动作：背题（memorization）、反复刷榜（repeated benchmark tuning）、对公开验证信号过拟合。
- 【金句·误导反馈塑造未来】"a misleading feedback signal can shape future behavior rather than only one output" → 被污染的裁判不只错判这一球，还会改写球员今后的全部打法。
- 【金句·安全不是实现细节】"Tool reliability, sandbox fidelity, and safety checks are therefore part of the self-evolution problem, not merely implementation details." → 工具可靠性、沙箱保真度、安全检查不是工程杂活，它们本身就是自进化问题的正题。适合做段落落点。
- 【有名字的病·记忆库四宗罪】"Experience banks, repository memory, and skill libraries may become stale, redundant, overly repository-specific, or contaminated by failed trajectories" → 记忆银行四宗罪：过期、冗余、认死一个仓库、被失败轨迹污染。画面：图书馆里一半书发霉（stale）、一半是复印本（redundant）、还有一半是从错误现场带回的伪证。
- 【造词记忆点】"responsibility ambiguity"（责任模糊）——多代理系统进化拓扑后，出了 bug 说不清该谁负责；同段还有 cost 与 instability 三连。
- 【边界句·跨域未验证】"Whether evolution acquired from software-engineering feedback transfers to non-coding domains remains largely unexplored." → 从软件工程反馈里学到的进化，能不能迁移到非编码领域？——largely unexplored，几乎没人验证过。
- 【自评边界·评测强弱项】"current evaluations are strongest at measuring functional correctness and benchmark success, but weaker at assessing long-term maintainability, robustness, safety, and whether agents learn reliable behavior from incomplete or misleading software feedback." → 现有评测最擅长量「对不对」，最不擅长量「可维护性、鲁棒性、安全性，以及代理是否从残缺/误导性反馈里学到了可靠行为」。
- 【KEY QUOTE·全篇题眼，逐字】"The central challenge for future work is therefore not merely to make coding agents evolve, but to make their evolution trustworthy." → 未来工作的核心挑战，不只是让编码代理进化，而是让它们的进化**值得信赖**。上下文：紧接前句「软件工程为进化提供了具体的反馈，但那反馈常常是不完整的（incomplete）、含糊的（ambiguous）、昂贵的（costly）、或绑死在短期基准上（tied to short-term benchmarks）」——正是「让进化成为可能的东西，也让进化变得困难」（What makes this setting distinctive is also what makes it difficult）。画面：标题卡大字定格 trustworthy，其余词淡出。
- 【结论收束句】"Progress will require mechanisms that validate feedback, revise stale memory, audit learned skills, constrain self-modification, and evaluate long-term software quality beyond immediate task success." → 进步需要五个机制：验反馈、修记忆、审技能、限自改、评长期。可直接做成五格动画清单。
- 【终句】"Such foundations are necessary if self-evolving coding agents are to become adaptive, dependable, and genuinely useful in real software engineering workflows." → 唯有打好这些地基，自进化编码代理才能 adaptive、dependable、真正有用。

**Table 2 结构注记**（Table 2: Classification of representative self-evolving coding-agent papers，配合 Figure 2 的分类树）：

- 五列维度：Paper（论文名+引用号）｜Main object（进化的主要对象：Agent framework / Memory / Skill/tool / Model / Workflow and topology）｜Timing（Task-time / Post-task / Stage-wise）｜Evidence（Outcome / Environmental / Trajectory-derived，可组合如 "Trajectory-derived + environmental"）｜SWE task/domain（如 Coding-agent development、Repository issue resolution、Vulnerability repair、Code localization、Code efficiency optimization、Competition-level code generation 等）。
- 收录总数 30 条，按 Main object 分布：Agent framework 6（SICA、SIFT、STOP、Darwin/Mendel/Huxley Gödel Machine）、Memory 6（SWE-Exp、EvoCoder、Subtask-Level Memory、EvoRepair、Repository Memory、SAGE）、Skill/tool 5（CODESKILL、GSkill、Socratic-SWE、EffiSkill、Live-SWE-Agent）、Model 7（Self-play SWE-RL、Agent-RLVR、ReVeal、CURE、ZeroCoder、Sol-Ver、ACE）、Workflow and topology 6（SEW、AFlow、EvoAgentX、SEMAG、EvoMAC、AgentConductor）。按 Timing 计：Task-time 5、Post-task 10、Stage-wise 15。
- 收录标准（§3 开篇原文）："We include works whose central contribution changes an agent component or agent behavior through coding-specific feedback; benchmark-only datasets and static coding-agent systems are discussed later as evaluation context rather than as self-evolutionary methods."——只收「通过编码特定反馈改变代理组件或行为」的工作，纯基准数据集与静态代理不在此列（它们归入 §5 作评测语境讨论）。

---
