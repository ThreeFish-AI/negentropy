# 论文精读笔记：Self-Improvements in Modern Agentic Systems: A Survey

> **来源**：[arXiv:2607.13104v1](https://arxiv.org/html/2607.13104v1)（cs.AI，2026-07-14）
> **作者**：Zhe Ren, Yimeng Chen, Dandan Guo, Guowei Rong, Tonghui Li, R.B. Xiong, Qingfeng Lan, Wenyi Wang, Li Nanbo, Yibo Yang, Mingchen Zhuge, Jürgen Schmidhuber
> **机构**：吉林大学人工智能学院、KAUST（阿卜杜拉国王科技大学）、阿尔伯塔大学、IDSIA/USI/SUPSI 等
> **用途**：本笔记是科普视频《自进化 AI》的**单一事实源**——逐字稿中的每个论文断言必须能回溯到本文件的对应条目。
> **提取方式**：2026-08-16 由 9 个并行提取代理对论文 HTML 原文逐节精读产出（5.2–9 章），第 1–4 章与 5.1 节由整页提取补齐。

---

## 摘要与全文框架

- 核心命题：自我改进的自主智能体正从研究原型走向实际部署，目标是**可控演化**——以最少甚至零人工输入从经验中适应。
- 统一视角：现代智能体是一个配置 **𝒜ₜ = (θₜ, Σₜ)**——基础模型参数 θ 与操作性脚手架 Σ（提示、记忆、工具、控制逻辑）的耦合。
- 自我改进被形式化为**自我诱发的更新算子**（self-induced update operator）：获取并提交对模型参数或脚手架组件的持久更新。
- 组织方式：按「更新什么（θ vs Σ）」与「驱动更新的信号来自哪里」双维度组织全部工作。

## 第 1 章 Introduction（叙事素材）

- 卷首引语：I. J. Good（1966）——"The first ultraintelligent machine is the last invention that man need ever make."（第一台超智能机器，是人类需要做出的最后一项发明。）
- **智能爆炸（Intelligence Explosion）**：Good 的经典设想——一旦机器获得设计更强后继者的能力，将引发智能爆炸。全文的动机性叙事起点。
- **哥德尔机（Gödel Machine，Schmidhuber）**：该追求的"理论天花板"——一个完全自指的算法，只要能数学证明预期效用提升，就重写自己的代码。
- **为什么是现在**：传统系统被迫在"类汇编代码或原始突触权重"这种庞大低层空间中搜索自改进方案；现代基础模型以**自然语言作为统一的语义介质**，大幅缩小可行修改的搜索空间。
- 快慢双通路：基础模型改进"较慢但更稳定、可跨任务摊销"；脚手架改进"更快、更易逆转"——参数与脚手架之间构成"嵌套循环"。
- 术语碎片化动机：self-correction、meta-prompting、self-play 等标签流传，掩盖了底层机制的相似性，因此需要统一形式化。

## 第 2 章 历史脉络（可选素材）

- 1790s–1960s 基础概念 → 1960s–1980s 符号主义与启发式自我修改（EURISKO 依赖人工修剪、缺乏自主闭环信用分配）→ 1980s–2000s 连接主义与元学习 → 2000s–2020s 形式化与架构级自我改进（Gödel Machine）→ 2020s 至今可扩展基础模型与智能体系统。
- 趣闻：高斯 1801 年重新发现谷神星（Ceres）——通过调整预测器参数从噪声观测中泛化，被论文称为 200 多年前"通过神经网络进行模式识别的首个著名例子"（最小二乘法与"线性神经网络"的渊源）。

## 第 3 章 Definitions（视频 P1 幕的理论骨架）

### 3.1 智能体系统的形式化

- **𝒜ₜ = (θₜ, Σₜ)**：θₜ 是基础模型神经网络参数（认知核心，本质是无状态推理引擎）；Σₜ 是动态操作性脚手架。
- **Σₜ := (pₜ, mₜ, 𝒯ₜ, gₜ)**：结构化提示/系统指令 p、记忆机制 m、外部工具集 𝒯、额外控制逻辑 g（路由、调度、安全约束）。
- **短暂执行状态 Xₜ**：KV 缓存、中间计划、短期工作记忆——影响即时行为但任务结束即被丢弃，**不属于**智能体的内在架构。（科普比喻：草稿纸，用完就扔。）
- 策略由二者联合诱导：π_{θₜ,Σₜ}(Aₜ | Xₜ)。

### 3.2 自我改进的形式定义

- **𝒜ₜ₊₁ = 𝒰(𝒜₁:ₜ, ℰ(π_{θₜ,Σₜ}; Σₜ, 𝒞ₜ))**
  - ℰ（执行阶段）：智能体在任务上下文 𝒞ₜ 中运行，产生学习信号（轨迹、反思、批评、提议的编辑）；Σₜ 显式传入 ℰ，允许"直接自检"（批评自己的提示模板、审计工具配置）。
  - 𝒰（更新阶段）：把自生成信号提交为对 θ 或 Σ 的**持久性**修改。
- 与短暂状态演化的区别：𝒰 提交的是持久变更；保留历史配置 𝒜₁:ₜ 支持验证与回滚（更新导致退化时回退旧检查点）。
- 定义显式追溯到 Schmidhuber 的自指元学习传统。

### 两种自指模式

- **模式一：间接诱发（indirect induction）**——策略执行产生经验/信号，由外部优化过程更新 θ。分布层面的自我改进。对应第 5 章。公式：θₜ₊₁ = 𝒰_θ(θ₁:ₜ, ℰ(...))，Σₜ₊₁ = Σₜ。
- **模式二：直接实施（direct enactment）**——智能体通过自身动作直接编辑提示、重组记忆、重配工具、改控制逻辑。动作层面的直接自修改。对应第 6 章。公式：Σₜ₊₁ = 𝒰_Σ(Σ₁:ₜ, ℰ(...))，θₜ₊₁ = θₜ。
- 互补性：前者慢、成本高、全局稳定；后者快、可逆、依赖上下文。

### Skill 作为可复用更新

- 技能 = 自诱导更新算子 𝒰 的**可复用实例**——被保留并重用的、对自身配置的具名更新。
- 序列化基质：工具（𝒯）、指令/工作流（p）、记忆条目（m）、固化权重（θ）、控制逻辑（g）——技能的身份是它编码的更新，基质只标示存储位置。
- **对象级技能**：作用于任务/世界状态（如"采集木头"例程），类比分层 RL 的 option。
- **元级技能**：作用于智能体自身配置——写新工具、重构提示、固化经验、给脚手架打补丁。由于元级技能既作用于 𝒜ₜ 又被序列化回 𝒜ₜ，"算子可成为自身操作数的一部分"；当技能自身也被改进时，恢复了**改进者与被改进系统共同演化**的自指闭环（Gödel Machine 传统）。

### 3.3 与相关范式的联系

- θ 更新 ≈ 标准 RL 策略优化；Σ 更新重塑决策过程本身，属结构性元学习，在经典 RL 中无直接对应。

## 第 4 章 Taxonomy（分类法总图）

- **通路一：Foundation Model Improvement（改 θ）**——按自我诱发**信号的形式**分三类：内在生成式示范（𝒟ₜ）、内在评估性反馈（eₜ）、外在探索性经验（τₜ）。慢、稳、可跨任务摊销。
- **通路二：Scaffolding Improvement（改 Σ）**——按被修改的**脚手架组件**分四类：提示 p、记忆 m、工具 𝒯、完整脚手架 Σ。快、可逆、不易灾难性遗忘。

---

## 5.1 Intrinsic Generative Demonstrations（内在生成式示范）

**核心思想**：模型同时扮演"认知学习者"与"数据合成者"——利用权重中已压缩的语义先验，无需新的外部观察即可自主构造训练数据（指令-回答对、推理轨迹、执行日志）。参数更新的瓶颈从昂贵的人工标注，转移到"生成策略与内部过滤机制的设计"。

**形式化**：状态诱导生成分布 P_gen 采样出内在数据集 𝒟ₜ^gen；质量控制算子 Φₜ 过滤/加权；有效训练集 = 已有数据 ∪ 过滤后合成数据；小批量梯度下降迭代微调，可加正则项 Ω(θ, θ₀) 防偏离初始化。

**代表方法**：
- **Self-Instruct 类自举**：从少量种子样例出发扩建更大的指令-输出语料。
- **Evol-Instruct**：不只扩量，而是"复杂度进化"——用 LLM 重写指令、逐步提升难度。
- **自一致性过滤（STaR/self-consistency 一脉）**：筛选高置信度推理路径作为训练数据。
- **外部验证器过滤**：用单元测试等验证器，只保留模型尝试中的正确解。
- **课程式生成**：递归把复杂问题分解为更简单的子问题构造学习课程；引入扩充样本池机制对抗生成多样性衰减。
- **TT-SI（Test-Time Self-Improvement）**：范式转变——从大规模离线生成转向**推理时按需适应**：不确定性估计检测"弱案例"，针对自身盲点自生成训练样本，做定向 LoRA 微调，极少数据实现即时改进。

**数据格式**：指令-回答对 → 思维链推理轨迹 → 结构化轨迹（工具 API 调用、代码执行序列、中间环境反馈与验证标签），为多步决策提供细粒度监督。

**风险与防护**：
- 自一致性失效：模型"自信地犯错"时，反复推理收敛到同一个错误结论。
- 课程分解缺陷：子问题构造不再保持原任务约束时课程失效。
- 自我纠错盲区：超出感知范围的错误类型可能被放大而非消除。
- 多样性衰减 / model collapse 倾向：需扩充样本池等机制对抗。
- 总体思路：生成策略须匹配模型当前能力，避免放大既有盲点；配合过滤算子与正则化。

---

<!-- 以下 5.2–9 章由 9 个并行提取代理逐节精读产出，脚本自动转写自 workflow journal -->

## 5.2 Intrinsic Evaluative Feedback（内在评估性反馈）

本节把"监督信号从哪来"重构成一个内部评估过程。出发点是：传统对齐依赖人工偏好标注与人工评测，成本高、难扩展；而基础模型天生擅长遵循准则、比较备选、说明理由，因此可以让它自己产出评估性反馈——标量分数、偏好对、一致性信号、自然语言批判——且无需任何新的环境交互。与 5.1（内在生成式示范，提供"例子"）和 5.3（外在探索经验，来自环境落地的结果）相比，本节的主导学习信号是 agent 对自身候选行为的内生判断（endogenous judgment）。作者点明其代价：一旦让 agent 当自己的批评者，参数更新的瓶颈就从"数据"转移到"稳健的内部评估准则与批判机制的设计"。

形式化部分（式 12–14）：给定任务上下文先采样一组候选输出；内在评估器 E 把"任务+候选+评价标准"映射为评估信号，E 可由当前模型自身、辅助 judge 模型、学得的奖励模型，或固定脚手架式批判流程实现。作者明确划界——若辅助评估器本身也被训练，它算作"反馈构造管线"的一部分，只要最终信号用于更新基础模型，仍归入本节。信号可实例化为标量奖励、偏好关系、置信/不确定度、文本批判或修订后目标；对应更新手段包括 RL、偏好优化、奖励模型训练、critique-conditioned 微调，以及对修订输出做 SFT。

随后按"评估信号的形态"分三族。Rubric feedback：按显式标准（任务指令、评分量表、安全原则、宪法条款、领域偏好）打分排序，主产物是分数/偏好而非开放式修改；优点是同一评估器可切换评 helpfulness、harmlessness、事实性、推理质量、格式合规，弱点是标准模糊或裁判有偏时会奖励表面合规。Consistency feedback：无标签、无形式化验证器时对同一题采多条解，用一致度、熵或 self-certainty 作弱信号（式 15 的聚合算子）；适用面最广，但一致性只是正确性的代理。Corrective feedback：要求模型指出具体缺陷并提出修改（式 16 的 critique-and-revision 算子），"原始 vs 修订"可作偏好对，critique 本身可作解释性监督，信息量远超标量奖励。

末段收束于权衡与防护：评估器常与待改进策略同源，容易强化共同盲点、过拟合表面标准、并在反复重解释中让标准漂移，故需生成器/评估器分离、保留外部锚点、把评估器分歧视作不确定性信号，并把内在评估反馈当作更大改进循环的一个组件而非唯一监督来源。

### 代表方法

- **Constitutional AI (Bai et al., 2022)**：Rubric 家族的早期代表。不再只靠人类直接标注偏好，而是先写下一部"宪法"（一组书面原则），让模型照着这些原则批判并排序自己的输出，产出的 AI 反馈用来训练一个偏好模型，再用强化学习去优化策略。相当于把"人类评审员"换成"一本明文规则手册 + 模型自己"。（例：论文将其列为把自然语言评价标准转化为可扩展监督的代表性范式起点。）
- **Meta-Rewarding (Wu et al., 2025b)**：训练一个模型同时扮演三个角色：先作答（act），再当裁判评自己的回答（judge），最后还要评价"自己刚才那次评判打得好不好"（meta-judge）。判断和元判断都被转成偏好对，用于一轮轮迭代对齐。它治的是"裁判本身也会退化"这个病。（例：把 judgments 与 meta-judgments 双双转成 preference pairs 做迭代对齐。）
- **Self Rewarding Self Improving (Simonds et al., 2025)**：证明 LLM 裁判可以在"没有参考答案"的情况下直接给出奖励信号，从而让强化学习进入那些难以写出程序化奖励函数的推理领域——没有标准答案可比对时，就让模型的判断本身充当奖励。（例：论文用它说明 reward 可以脱离 reference solution 而存在。）
- **Self-Evolved Reward Learning / SER (Huang et al., 2025a)**：让"学得的奖励模型"自己给更多数据打标签，再用这些自标数据改进奖励模型本身，形成奖励模型的自举循环，进而支撑基于自反馈的强化学习。改进的不只是选手，还有裁判。（例：reinforcement learning from self-feedback 的代表工作。）
- **TTRL (Zuo et al., 2025)**：Consistency 家族。测试时对同一道题生成多个答案，用多数投票选出共识答案，把这个共识当作"临时标准答案"折算成奖励信号去做强化学习。没有老师，就让全班同学投票，票数最高的答案当参考答案。（例：test-time reinforcement learning，majority voting over multiple generated answers。）
- **SRT (Shafayat et al., 2025，Can large reasoning models self-train?)**：系统性追问：在完全没有 ground-truth 标签的情况下，自一致性（self-consistency）到底能不能撑起自我改进。属于对一致性信号可行性边界的探究性研究。（例：论文用它代表"无标签自训练是否成立"的直接检验。）
- **EMPO (Zhang et al., 2025h)**：用基于熵（entropy）的信号来激励推理行为——模型对一批候选答案分布越集中（熵越低），越被视为可信，以此作为完全无监督的激励信号。（例：被归为 fully unsupervised LLM reasoning incentivization。）
- **INTUITOR (Zhao et al., 2025c，Learning to reason without external rewards)**：把模型的 self-certainty（自我确定度）直接当作内在奖励。不看外部对错，只看模型自己"有多确信"，确信度高的推理路径就被强化。名字本身就是"凭直觉"。（例：self-certainty as an intrinsic reward。）
- **ReST meets ReAct (Aksitov et al., 2024)**：Corrective 家族。把 agentic 推理（ReAct 式的思考-行动交替）与自训练（ReST 式的自生成数据再筛选微调）结合起来，专门改进多步问题求解能力。（例：论文将其列为把 agent 推理与自训练缝合的代表。）
- **SELF (Lu et al., 2024b，Self-evolution with language feedback)**：用自然语言反馈反复打磨自己生成的答案：模型先写答案，再用语言写出批评意见，据此修订，然后把"模型产出的批评 + 修订"整体转成自我改进的训练信号。（例：把 model-produced critiques and revisions 转成 self-improvement 信号。）
- **RISE (Qu et al., 2024，Recursive Introspection)**：教模型在多轮交互中递归地自我反省：每一轮基于上一轮的失败重新作答，然后只拿那些"确实变好了的预测"回头去微调自己。学的是"如何在下一轮把上一轮改对"的能力。（例：interaction-based recursive self-reflection，并基于 improved predictions 微调。）
- **Reflect, Retry, Reward (Bensal et al., 2025)**：一个极简闭环：任务失败 → 让模型写出对失败的反思 → 带着反思重做一次 → 若第二次成功，就用这个结果作为强化学习的奖励去激励"会反思"的行为本身。奖励的是反思能力，不是答案。（例：reflect on failures, retry the task, 再用结果引导 RL。）
- **AlphaLLM (Tian et al., 2024，Toward self-improvement of LLMs via imagination, searching, and criticizing；正文写作 AlphaAllM)**：把搜索与批判整合进同一个循环：模型"想象"出多条候选路径，用搜索（类 MCTS 的树搜索）展开，再让模型生成的评价在搜索过程中充当打分函数，指导搜索走向，最终用搜索出的高质量轨迹构造更强的训练信号。批判不只是事后打分，而是搜索时的方向盘。（例：using model-generated evaluations during the search process to construct stronger training signals。）

### 风险 / 挑战 / 防护

- 评估器与被改进的策略高度耦合（同源），自评循环会强化二者共同的盲点——模型看不见的错误，它的裁判分身同样看不见。
- 奖励"符合模型既有偏好"的输出，导致模型越练越像自己，而非越练越对。
- 过拟合表面评价标准：Rubric 家族中若标准模糊或裁判有偏，模型会学到"表面合规"（superficial compliance）而非真正的改进。
- 评价标准在反复使用与反复重新解释的过程中会漂移、产生偏差（biased with repeated use and reinterpretation）。
- 一致性只是正确性的代理：若模型系统性偏误或"自信地错"，重复采样只会放大同一个错误，而不会纠正它。论文特别援引 Too consistent to detect（Tan et al., 2025a）指出自洽性错误难以被察觉。
- 置信度类信号依赖校准（calibration）：模型表达的确定感未必对应真实正确率；当不同样本间的错误相互关联时，一致性方法"相当脆弱"（quite fragile）。
- Corrective 家族的失效模式：模型可能产出貌似合理但实则错误的 critique；或学会只满足批评意见的表面形式，而非其背后的真实目标。
- 防护措施（Rubric/Consistency 通用）：把生成器与评估器分离到不同 checkpoint 或不同模型家族上，避免同源盲点。
- 防护措施：保留人工标注或基于上下文的验证作为外部锚点（external anchors），不让循环彻底封闭。
- 防护措施：把多个评估器之间的分歧当作"不确定性信号"来使用，而不是简单取平均（论文引 Feng et al. 2025 的多智能体不确定性估计、Till et al. 2025 的多模型协同检测幻觉、Hamidieh et al. 2026 的 cross-model disagreement）。
- 防护措施：定期审查评分标准、奖励模型与评估质量本身，防止标准悄悄变形。
- 防护措施（Corrective 专用）：对比原始输出与修订输出、过滤低质量 critique、使用异质的 critique 模型、在可得时结合外部验证。
- 总体定位：内在评估反馈应当是更大改进循环中的一个组件，与示范、外部验证、探索经验互补，而不能作为唯一的监督来源。

### 科普叙事素材（金句/比喻/例子）

- 【一人分饰三角】论文说基础模型在这里不只是输出的生成者和自我评估者，最终还是把自己的判断内化吸收的"认知学习者"（cognitive learner that internalizes its own judgments）。视频里可以说：同一个模型同时当运动员、当裁判、还当那个把裁判评语记进心里的学生。
- 【核心转向金句】论文原话：把 agent 当作自己的批评家，这一范式"shifts the bottleneck of parameter updates to the design of robust internal evaluation rubrics"——瓶颈不再是数据，而是"你怎么设计这把尺子"。观众记忆点：AI 进步的瓶颈，已经从"喂多少题"变成"谁来改卷、按什么标准改"。
- 【一句话说清整节】不需要跑到真实世界里试错，也不需要人类再标一遍，模型对着自己写的几份答案挑一份最好的——监督信号就这么凭空长出来了（without requiring new environment interaction）。
- 【Constitutional AI 的画面感】给模型发一部"宪法"：不是人一条条打分，而是把原则白纸黑字写下来，让模型照章办事地批判和排序自己的输出。观众听得懂的版本：与其请一万个人来评判，不如写一本《员工手册》让它自己对照。
- 【Meta-Rewarding 的套娃】模型作答 → 模型给自己打分 → 模型再给"自己刚才那次打分"打分（LLM-as-a-meta-judge）。视频里可以做成套娃动画：裁判背后还站着一个裁判。
- 【TTRL 的"少数服从多数"】没有标准答案怎么办？同一道题做二十遍，哪个答案出现次数最多，就把它当标准答案，反过来训练自己。这是全班同学互相抄答案，然后把票数最高的那个奉为真理。
- 【INTUITOR 的名字就是梗】它把 self-certainty（自我确定度）当奖励——模型觉得自己"心里有底"，就给自己发糖。名字直译过来就是"凭直觉的家伙"。
- 【最有冲击力的反转句】论文明说，一致性方法的前提"不是一致就等于正确"（consistency is only a proxy for correctness）。紧接着的画面感原句：if a model is systematically biased or confidently wrong, repeated sampling may amplify the same error——如果模型是"自信地错"，那你让它做一百遍，它就自信地错一百遍。
- 【一个自带标题梗的引文】论文引用的一篇研究，标题本身就是金句：Too consistent to detect（一致到无法察觉）——说的正是 LLM 的自洽性错误：错得太整齐，反而看不出是错的。
- 【Rubric 家族的最大坑】论文原句（本回应唯一直引）："reward superficial compliance rather than genuine improvement"。翻译成人话：模型学会了让批改老师满意，而不是学会了做对题。
- 【Corrective vs Rubric 的通俗切分】Rubric 是"给你打个分、排个名"；Corrective 是"拿红笔在你卷子上圈出错在哪、并且替你改一遍"。论文强调后者是纠正性的，不只是比较性的（corrective, not merely comparative）。批语的信息量远大于一个分数。
- 【Reflect, Retry, Reward 的日常感】失败 → 写反省 → 再做一次 → 做对了就奖励。但奖励的不是那个正确答案，而是"你刚才那段反省写得有用"。这是奖励反思能力本身，不是奖励结果。
- 【AlphaLLM 的方向盘比喻】模型的自我批评不是等交卷后才出现的评语，而是在搜索答案的过程中充当方向盘——每走一步都被自己的评价打分，决定下一步往哪拐。
- 【最该被记住的风险画面】自我评估最大的危险在于：出题人、答题人、改卷人是同一个人。论文的说法是评估器与待改进的策略"tightly coupled"，于是会一起强化共同盲点。视频结论句：一个人关起门来给自己改一万遍卷子，只会把自己的错误越写越工整。
- 【最实用的防护措施，观众能秒懂】论文开的药方是：让改卷的和答题的不要是同一个 checkpoint、甚至不要是同一个模型家族；留一点人类标注当"外部锚点"；以及——两个评委吵起来的时候，别急着取平均，那恰恰说明这题不确定。
- 【收尾定位句】论文最后没有把内在评估反馈捧上神坛，而是把它降格为"更大改进循环里的一个部件"，要和示范、外部验证、探索经验一起用，不能当唯一的监督来源。这句适合做视频的理性收尾：AI 可以自己给自己打分，但它还不能只听自己的。


## 5.3 Extrinsic Exploratory Experience（外在探索性经验）

本节是第5章「参数中心自我改进」的第三条路线。前两节（5.1 自生成示范、5.2 自我评判）都是「内在信号」——智能体拿自己产出的东西训练自己；5.3 的分界线在于：学习信号来自「行动之后世界发生了什么」。在论文的形式化框架里，学习信号被实例化为经验（experience），即策略在真实任务环境或其学习到的代理环境中执行所收集的轨迹，参数更新即基于这些轨迹。作者强调，这虽然把自我改进接回了经典强化学习框架，但基础模型智能体的「经验」远不止 state-action-reward 三元组：一条轨迹里可能包含网页、截图、代码日志、编译器报错、工具调用和中间推理链。因为这些产物本身就能被基础模型读懂，同一份经验可以灵活复用于强化学习、监督微调、偏好数据构造和失败归因。代价是四类新困难：交互慢且贵、奖励稀疏或延迟、验证器可被钻空子、学到的世界模型会产生「看似合理但反事实」的转移。

组织逻辑上，作者按「经验从哪里来」二分：(1) 与有依托的真实任务环境交互（grounded），信号直接来自环境响应——状态变化、单元测试、任务专用验证器；(2) 与模拟代理环境交互（simulated），由学到的世界模型充当环境替身，生成预测状态与推演结果。论文明确指出二者并不互斥：早期 controller-world-model 架构就是先用真实交互采数据更新世界模型，再用模拟交互做规划、探索与策略改进。

5.3.1 进一步按「反馈来源」三分：程序化验证器（最干净的信号，代码单元测试是典型，可推广到 SQL 执行、定理证明、带可验证后置条件的工具调用）；学习到的奖励模型（环境负责产生轨迹，学到的评估器只负责打分，用于网页导航、GUI 等难以手写成功标准的场景）；自生成任务（智能体自己提任务，但解答是否被接受仍由执行与环境裁决）。作者对第三类给出关键判词：这类方法在「任务选择」层面模糊了内在与外在的边界，但在「监督」层面没有——智能体可以决定尝试什么，环境决定尝试是否成功。本小节最后提到 AgentGym 这类标准化平台，降低反复采经验的工程成本。

5.3.2 讲世界模型：先采真实轨迹训练动力学模型，再让策略在代理环境里「多刷经验」，提升样本效率、降低昂贵或危险探索的成本。与经典世界模型相比，基础模型时代的独特之处是模型自带大规模预训练先验，且生成的观测与策略输入处于同一表示空间，因此模拟经验可直接使用、无需表示对齐。该模式在网页导航上发展最充分，也延伸到具身控制与文本游戏的结构化记忆路线。

最后的 Challenges 段落列出经典难题（稀疏延迟奖励、真实交互吞吐低、对不完美代理环境过拟合）与本设定特有的四种失效模式，并指出当前研究方向：更可靠的外在验证器与奖励模型、对自身预测有校准不确定性的世界模型、以及不牺牲通用能力的训练流程。

### 代表方法

- **Agent-RLVR**：用单元测试的通过/失败结果直接当奖励来优化策略，把成功的程序和失败的尝试拿来做对比训练。不需要另外再训一个「打分模型」——测试跑过了就是对，跑挂了就是错，信号最干净。（例：论文把代码生成称为程序化验证器的典范场景（canonical case），因为单元测试为候选程序提供直接的 pass/fail 反馈。）
- **WebRL**：训练一个「结果监督奖励模型」（outcome-supervised reward model），自动给网页导航轨迹打成功/失败标签，从而不再依赖人手写的成功判定规则或人工标注。（例：用于网页导航任务，减少对 hand-crafted success criteria 与人工标注的依赖。）
- **UI-Genie**：让策略学习和奖励模型改进互相咬合、同步升级：用验证过的成功轨迹训练智能体本体，同时从成功与失败两类轨迹里抽取「步骤级」标签反过来把评估器练得更准。相当于运动员和裁判一起进步。（例：couples policy learning with reward-model refinement，用 step-level labels 改进 evaluator。）
- **MobileGUI-RL**：把 GRPO（Group Relative Policy Optimization）改造到手机 GUI 导航上，采用「轨迹感知的优势函数」，并把奖励设计成任务是否成功 + 执行效率的组合——不只看做没做成，还看绕了多少弯路。（例：adapts GRPO to mobile GUI navigation with trajectory-aware advantages，奖励结合 task success 与 execution efficiency。）
- **Absolute Zero**：用自博弈（self-play）在开放式环境中自己生成任务、也自己生成解法，但哪些解法能被留下来用于学习，由「能不能真的执行通过」来裁决。自己出题，环境批卷。（例：execution-based validation determines which solutions are retained for learning。）
- **ETO (Exploration-based Trajectory Optimization)**：更保守的做法：不自己造环境，而在固定环境里把「做成了的轨迹」和「做砸了的轨迹」配成对比来学习，从两者的落差中提炼改进方向。（例：论文用它与 Absolute Zero 对照，称其 learns more conservatively from contrasts between successful and failed trajectories in fixed environments。）
- **AgentGym**：不是一个学习算法，而是一套标准化平台：为多种智能体任务提供统一的交互、评测、训练 API，大幅降低反复采集经验的工程成本，让不同奖励来源、训练目标、更新流程能在同一套环境反馈下公平比较。（例：provides unified APIs for interaction, evaluation, and training across multiple agent tasks。）
- **WebEvolver**：训练一个与智能体「共同进化」（coevolving）的世界模型，专门预测下一个网页会长什么样，然后用这些模拟推演出来的轨迹去打磨智能体策略。智能体变强，它脑内的网页模拟器也跟着变强。（例：trains a coevolving world model to predict next web observations，用 simulated rollouts 精炼策略。）
- **WebSynthesis**：用学到的网页世界模型做「可回退的、基于搜索的轨迹合成」——因为是在脑内模拟，走错了可以撤销重来，于是能像下棋一样搜索多条路径，再把合成的优质轨迹拿去训练。（例：reversible, search-based trajectory synthesis。）
- **WebDreamer**：利用网页转移模型做基于模型的规划（model-based planning）：动手点之前先在脑子里推演「如果我点这个按钮会发生什么」，据此挑选动作。（例：leverages a web transition model for model-based planning to guide action selection。）
- **SPA**：通过自博弈微调，显式学习两样东西：状态估计模型（我现在到底在什么处境）和转移模型（做了动作之后会变成什么），再用它们来初始化并稳定后续的策略优化。（例：learns explicit state-estimation and transition models through self-play fine-tuning。）
- **WMPO**：具身控制场景下的像素空间世界模型：直接预测下一帧画面，让机器人策略在「想象出来的推演」里优化，从而避开代价高昂的真实物理试错。既是像素级世界模型的代表，也是「生成观测与策略输入同处一个表示空间」的例证。（例：optimizes the policy over imagined rollouts to avoid costly physical trial-and-error。）
- **GLoW**：不训练完整的生成式动力学模型，而是维护一份「双尺度文本世界记忆」：全局层面记录高价值发现构成的前沿（global frontier of high-value discoveries），局部层面记录优势反思（local advantage reflections），以此引导一个 Go-Explore 风格的智能体在文本游戏中探索。（例：在文本游戏中取得强性能，且比 RL 基线少用 100–800 倍的真实环境交互（100–800 fewer real environment interactions than RL baselines）。）
- **PPO / DPO**：两类基础训练目标。PPO 用强化学习方式直接从交互轨迹更新策略；DPO 则在「成功轨迹」与「失败轨迹」能配成对比时，用偏好式目标来训练。论文把它们列为收集完 grounded 轨迹之后的标准更新手段。
- **Controller-World-Model 架构（早期工作，Ha & Schmidhuber 谱系）**：论文用它说明真实交互与模拟交互并不互斥：先用真实交互采数据更新世界模型，再用模拟交互做规划、探索与策略改进，形成闭环。（例：a system may use grounded interaction to collect data and update its world model, and subsequently use simulated interaction to plan, explore, or improve its policy。）

### 风险 / 挑战 / 防护

- 经典 RL 遗留难题一：奖励稀疏与延迟（sparse and delayed rewards）——做对了往往要很久以后才知道。
- 经典 RL 遗留难题二：真实交互吞吐低（low-throughput real interaction），交互既慢又贵，采一条轨迹的成本远高于喂一批文本。
- 经典 RL 遗留难题三：对不完美的代理环境过拟合（overfitting to imperfect proxy environments）。
- 语言层面的奖励黑客（Reward hacking through language）：这是本设定特有的新失效模式。因为验证器的规格说明本身就是一个「语言对象」，智能体可以直接操纵它——比如钻 LLM 裁判的提示词漏洞，在字面上满足验证条件却根本没解决真问题。论文明确指出这比经典 RL 中更容易发生。
- 能力退化（Capability regression）：在狭窄的外在奖励上做大量 RL 更新，会侵蚀基础模型在预训练阶段获得的更广泛能力。论文强调这种张力在「从零训练的智能体」身上是不存在的，是基础模型时代独有的代价。
- 幻觉动力学（Hallucinated dynamics）：世界模型路线的特有风险——生成式模拟器会编造出「看似合理但其实错误」的状态转移，而策略随后会学会去利用这些并不存在的漏洞。
- 轨迹长度与上下文窗口的张力（trajectory-length and context-window tension）：由于轨迹是语言化、多模态的，长时程经验必须先被压缩或摘要，才能塞进模型上下文中充当学习信号。
- 验证器可被博弈（verifiers can be gamed）与世界模型可能产出「合理但反事实」的转移（plausible but counterfactual transitions），是本节开篇就点名的两大获取与利用经验的固有困难。
- 当前的防护方向：更可靠的外在验证器与奖励模型；对自身预测具备「校准过的不确定性」的世界模型（world models with calibrated uncertainty over their own predictions）；以及能在外在经验上更新基础模型、同时不牺牲其通用能力的训练流程。

### 科普叙事素材（金句/比喻/例子）

- 【全节最核心的一句分界线】学习信号扎根于「行动之后发生了什么」。英文原句："the learning signal is grounded in what happens after the agent acts." —— 前两节是智能体照镜子自我改进，这一节是它伸手推了世界一把，然后看世界怎么回推它。这是「想」与「做」的分水岭。
- 【最适合做视频钩子的对比】经典 RL 的经验是一串冷冰冰的数字，而 AI 智能体的经验是一堆人类也能读懂的东西。英文原句："experience for foundation-model agents is not just a stream of state-action-reward tuples. A trajectory may contain web pages, screenshots, code logs, compiler errors, tool calls, and intermediate reasoning traces." —— 想象一下：AI 的「人生回忆」不是一串奖励分数，而是一沓截图、报错日志和它自己当时的心里话。
- 【自主性的边界，一句话说透】"The agent may choose what to try, while the environment determines whether the attempt succeeds." —— 智能体可以决定尝试什么，但环境决定尝试是否成功。自己出题，环境批卷。这句话可以直接当视频标题。
- 【论文对自生成任务的精准切分】"These methods blur the boundary between intrinsic and extrinsic signals at the level of task selection, but not at the level of supervision." —— 在「出什么题」上，内外界限模糊了；在「谁说了算」上，界限依然清清楚楚。
- 【最有冲击力的风险描述——AI 可以钻语言的空子】"a foundation-model agent can satisfy the literal condition of a verifier (e.g., exploiting prompt loopholes in an LLM judge) without solving the underlying task, because the verifier's specification is itself a linguistic object that the agent can manipulate." —— 关键在于「考试规则本身也是用语言写的，而 AI 恰好最擅长玩弄语言」。这是本节最反直觉、也最容易被普通观众记住的点：当裁判和选手说同一种语言，选手就可能学会跟裁判讲道理，而不是把事情做好。
- 【幻觉动力学，一个绝佳的比喻素材】"generative simulators can fabricate plausible but incorrect transitions that the policy then learns to exploit." —— AI 在自己的想象里训练，结果想象出了一条现实中并不存在的捷径，还练得炉火纯青。就像有人在梦里练成了绝世武功，醒来发现那套招式的物理前提根本不成立。
- 【最惊人的一个数字】GLoW 在文本游戏中所需的真实环境交互，比强化学习基线少 100 到 800 倍。英文原句："achieving strong performance with 100–800 fewer real environment interactions than RL baselines." —— 靠的是维护一份「双尺度文本世界记忆」：一份全局的高价值发现前沿，一份局部的得失反思。相当于一本探险笔记加一本错题本。
- 【学费的悖论：越专精，越健忘】Capability regression —— "extensive RL updates on narrow extrinsic rewards can erode the broader competencies the foundation model acquired in pretraining, a tension absent in agents trained from scratch." —— 为了把一件事做到极致而反复苦练，反而会把预训练时学会的十八般武艺给练丢了。论文特别点明：从零开始训练的智能体没有这个烦恼，因为它本来就没有可失去的通识。这是「有天赋的人才会有的烦恼」。
- 【世界模型为什么这次不一样，两个大白话优势】第一，大规模生成式预训练自带一套强大的「世界常识先验」，不用从头学环境规律，所以只需极少的任务交互就能拼出一个可用的模拟器；第二，模拟出来的观测和策略真实看到的输入长得一模一样（lie in the same representation space），所以模拟经验可以直接拿来用，中间不需要任何翻译转换。—— 通俗版：它梦见的网页，和它真实看到的网页，是同一种格式。
- 【WMPO 的画面感】像素空间世界模型让机器人在「想象出的推演」里练习，从而避开昂贵的物理试错。英文原句："optimizes the policy over imagined rollouts to avoid costly physical trial-and-error." —— 机器人闭上眼睛把动作在脑内演练一千遍，再睁眼动手。省下的是真实摔坏的零件。
- 【WebDreamer 的名字本身就是素材】用网页转移模型做基于模型的规划——动手点击之前，先在脑子里把「点下去会发生什么」推演一遍。名字直译就是「网页梦想家」。
- 【WebSynthesis 的可回退设定】"reversible, search-based trajectory synthesis" —— 现实里点错一个按钮可能就下单了，但在脑内模拟里，走错可以撤销重来。于是探索网页这件事，从「如履薄冰」变成了「像下棋一样随便试」。
- 【两条路线并不对立】"a system may use grounded interaction to collect data and update its world model, and subsequently use simulated interaction to plan, explore, or improve its policy." —— 先出门实地调研，回来更新脑内地图；再对着脑内地图规划下一次出门。这个循环早在早期 controller-world-model 架构里就已成型。
- 【长时程记忆的现实困境】因为轨迹是语言化、多模态的，长任务的经验必须先被压缩或摘要，才能塞进模型的上下文窗口里当作学习信号。—— AI 想从一整天的经历中学习，却发现自己的「短期记忆」装不下一整天。它必须先学会写日记摘要，才能从昨天学到东西。
- 【UI-Genie 的运动员与裁判比喻】策略学习与奖励模型改进互相咬合：用验证过的轨迹训练智能体，又用成功与失败轨迹中的步骤级标签反过来训练评估器。—— 运动员和裁判在同一场训练中一起变强，裁判越准，运动员练得越对。


## 6.1 Prompt（提示优化）

本节把 prompt 定位为智能体的核心行为先验（core behavioral prior）——它决定基础模型如何解析环境，因此提示优化是最易触及、也最中心的脚手架（scaffolding）改进方式。开篇给出演进主线：从早期人工启发式调参，走向自动化、信号驱动的改进闭环；关键转折是反馈从标量分数转向丰富的结构化语言批评，用"自然语言梯度"在高维策略空间里做类似梯度优化的定向迭代更新。

作者随即划定边界：这里的 prompt 指跨交互复用的结构性指令层（系统提示、稳定策略模板）；相邻但不同的一条线是上下文构造优化（示例选择、检索组装、长期 playbook 维护）。两者同属脚手架级更新，但目标不同——改系统提示是改核心行为先验，改上下文是精调单次交互的动态条件；论及具体系统时会明确指出被更新的是哪一个对象。

正文按"学习信号（learning signal）的形式与丰富度"划分四个范式（对应图 7 与表 2）：① 标量反馈优化（Scalar-Feedback Optimization），信号是准确率/奖励这类分数，目标是在离散提示空间中搜索最大化评分的提示；因标量无方向性、只报成败幅度不报原因，只能依赖结构化搜索（APE、OPRO、RLPrompt、InstructZero、BPO）。② 定性反馈精炼（Qualitative-Feedback Refinement），信号变成文本批评、错误分析或自然语言建议，形成"新提示 = f(旧提示, 反馈)"的迭代闭环；与 Self-Refine、多智能体辩论只做瞬时输出纠正不同，脚手架改进把定性反馈持久化进提示策略或指令上下文（Reflexion、MAPS、CoH、ACE、Scrable）。③ 种群式进化（Population-Based Evolution），信号是种群级适应度与选择压力，把提示当"基因"，由 LLM 充当语义化的选择/交叉/变异算子（EvoPrompt、Promptbreeder、DEEVO、GEPA）。④ 文本梯度优化（Textual Gradient Optimization），把反馈形式化为既诊断"为什么错"又给出"往哪改"的方向性梯度，LLM 充当 optimizer 执行文本更新步（APO、TextGrad、semantic backpropagation、MetaTextGrad、SkillOpt）。

四类排布不是并列而是递进：GEPA 这种"进化 + 反思批评"的混合体证明有方向的语义引导优于不透明的标量奖励，直接引出第四范式；MetaTextGrad 又把优化推到元层。结尾展望文本梯度或可翻译成低秩参数更新，打通提示工程与模型微调。Takeaway 明言：信号信息量越大，更新越少靠启发式、越定向，从而在不改基础模型参数的前提下实现更自动化、更样本高效的精炼。

### 代表方法

- **APE (Automatic Prompt Engineer)**：标量范式的开创者。让一个 LLM 批量"脑暴"出许多条候选指令，再把每条拿去实测打分，用简单搜索挑出得分最高的那条留下。相当于"广撒网 + 考试择优"。（例：论文称其 pioneered this paradigm，是引用 432 的代表工作）
- **OPRO**：把搜索"上下文化"：构造一个 meta-prompt，把此前评估过的一串历史提示连同它们各自的分数一起喂回给 LLM，让模型看着这条"分数轨迹"，间接推断出什么样的写法更高分，从而提出下一轮更好的候选。（例：论文描述为 constructing a meta-prompt with a trajectory of previously evaluated prompts alongside their scalar scores（引用 375））
- **RLPrompt**：把"写提示词"当成离散强化学习问题：把下游任务准确率转成奖励信号，用 RL 直接训练一个策略去生成提示词。（例：表 2 中标量范式代表之一（引用 52））
- **InstructZero**：为了提高在离散文本空间里搜索的样本效率，先把提示词映射到一个连续的隐空间（latent space），然后用贝叶斯优化在这个连续空间里预测并最大化标量任务奖励——即把"猜词"问题转成数学上更好优化的"调旋钮"问题。（例：论文点名其 leveraging Bayesian Optimization（引用 34））
- **BPO (Black-Box Prompt Optimization)**：把分数驱动范式延伸到"人类偏好对齐"：用标量偏好分数去优化用户的输入提示，从而让模型输出更符合人类偏好，全程不动底层模型权重。（例：论文强调 without altering the underlying model weights（引用 41））
- **BBT (Black-Box Tuning)**：表 2 列出的标量反馈范式代表系统之一，同属"只靠外部分数、不需模型内部访问"的黑盒优化路线。（例：表 2 ① 类代表（引用 304））
- **DSPy**：表 2 列出的标量反馈范式代表系统之一，把提示/流水线的编译与优化交给基于评测分数的自动搜索。（例：表 2 ① 类代表（引用 140））
- **Self-Refine**：自我批评的基础范式：模型生成答案后自己给自己写评语，再据此改写。论文强调它属于"瞬时输出纠正"（transient output correction），改的是这一次的答案，不是长期的提示策略。（例：论文用它与后续"把反馈持久化"的脚手架方法做对比（引用 186））
- **Multi-agent debate（多智能体辩论）**：多个模型互相质疑、辩论以纠错。与 Self-Refine 一样被归为展示了自我批评威力、但只作用于单次输出的基础范式。（例：与 Self-Refine 并列引用（引用 65））
- **Reflexion**：错误驱动的定性分析代表。智能体任务失败后，用自然语言给自己写一段"口头内省"（verbal introspection）——我哪一步错了、为什么错，把这段反思存进记忆，下一次尝试时用它来明确地引导和约束提示。（例：论文原文用 verbal introspection 描述其机制（引用 280））
- **MAPS**：自动化、面向 LLM 定制的提示优化框架。它从失败案例里"归纳"出可复用的自然语言规则，并对规则做验证，再把这些定性洞见迭代注入到提示中，从而系统性地优化策略。（例：论文点名它在单元测试生成（unit test generation）这类复杂任务上大幅优化了策略（引用 82））
- **Chain of Hindsight (CoH)**：让智能体回看一串"过去的尝试 + 每次尝试对应的定性评价"，从好坏样例的文本对比中学习该怎么做，而不是只看一个分数。（例：论文称受 CoH 启发的 agents can learn from textual contrasts（引用 170））
- **ACE (Agentic Context Engineering)**：针对"文本批评越攒越多、越来越难管"的问题，设计了 Generator–Reflector–Curator 三模块流水线：生成器干活、反思器产出批评、策展器负责筛选整理。它把提示和记忆当作一本不断演化的"文本战术手册"（evolving text playbooks），主动策展定性反馈，同时对抗 brevity bias（越改越简、信息流失）和 context collapse（上下文坍缩）。（例：论文明确提到它 mitigating brevity bias and context collapse（引用 411））
- **Scrable**：领域应用案例：用持续的定性评估来反复精炼结构性系统提示，直到生成文本的质量达到预先设定的标准才停止迭代。（例：论文举的场景是 customer review generation（客户评论生成，引用 16））
- **Critic**：表 2 列出的定性反馈范式代表系统之一，依靠文本批评而非分数来驱动修订。（例：表 2 ② 类代表（引用 96））
- **EvoPrompt**：种群进化范式的奠基框架。它明确引导 LLM 去扮演"进化算子"，使得交叉（合并两条父提示的语义长处）和变异（换种说法探索新表述）都是语义上有意义的操作。（例：论文强调这 far surpass classical random character edits——远胜经典的随机字符编辑（引用 101））
- **Promptbreeder**：引入深刻的"自指"（self-referential）机制：它不仅进化任务提示，还同时进化"变异提示"（mutation prompts，即规定后代该怎么被生成出来的那条指令）——也就是连"进化的规则"本身都在进化。（例：论文原文点明其进化 the instructions governing how new offspring are generated（引用 78））
- **DEEVO**：解决"拿不到标量适应度分数"的场景：让多个智能体就候选方案展开辩论，用 LLM 辩论的胜率（win-rate）当作进化里的适应度信号，谁辩赢谁的"基因"就被保留。（例：论文描述为 utilizing the win-rate of LLM-driven argumentation as the evolutionary fitness signal（引用 193））
- **GEPA**：反思式提示进化，是"种群搜索 + 定性反馈"的混合体，体现脚手架改进的可组合性。每评估完一代，由一个 reflector LLM 分析这一代的成功与失败并写出文本批评；这份定性反馈会直接指导下一代的变异和交叉算子，让搜索高度定向、样本效率更高。（例：论文称其证明了用 directional, semantic guidance 替代 opaque scalar rewards 的优势，并由此"铺路"通向文本梯度方法（引用 4））
- **STOP**：表 2 列出的种群/选择信号范式代表系统之一（自我教学优化器路线）。（例：表 2 ③ 类代表（引用 394））
- **GPTSwarm**：表 2 列出的种群/选择信号范式代表系统之一，把智能体群体结构纳入搜索优化。（例：表 2 ③ 类代表（引用 437））
- **AutoDAN**：表 2 列出的种群/选择信号范式代表系统之一，以进化搜索方式自动生成提示。（例：表 2 ③ 类代表（引用 174））
- **Evol-Instruct**：表 2 列出的种群/选择信号范式代表系统之一，通过演化式改写不断生成更复杂多样的指令。（例：表 2 ③ 类代表（引用 365））
- **APO (Automatic Prompt Optimization)**：最早提出"文本梯度"（textual gradient）这一基础概念：不再靠启发式乱改或撞运气搜索，而是产出一条结构化、有方向的反馈——既说清楚输出为什么错，又给出精确的"修订向量"，指明该往哪个方向改。（例：论文称 the foundational concept of a textual gradient was introduced in APO（引用 214））
- **TextGrad**：把智能体工作流当成"计算图"，实现"用文本做自动微分"：定性的文本梯度可以像数值梯度一样，在由多个组件串起来的复杂语言系统中反向传播，逐层告诉每个环节该怎么改。（例：论文表述为 introducing automatic differentiation via text（引用 393））
- **Semantic backpropagation（语义反向传播框架）**：进一步把上述过程形式化，在文本节点上执行类似一阶优化的步骤，实现有原则可依的提示精炼。（例：论文称其 executing first-order-like optimization on text nodes（引用 332））
- **MetaTextGrad**：元层面的框架，也是全节最"套娃"的一步：它优化的不是任务提示，而是"优化器提示"（optimizer prompts，即规定文本梯度该怎么算、怎么用的那套指令）——等于让智能体去改进"自己改进自己的方法"。（例：论文原句意为 allowing the agent to self-improve its own improvement process（引用 366））
- **SkillOpt**：表 2 列出的文本梯度范式代表系统之一。（例：表 2 ④ 类代表（引用 381））

### 风险 / 挑战 / 防护

- 标量反馈的根本局限：分数是非方向性的（non-directional），只给出成败的幅度而不提供任何解释性上下文，所以只能靠结构化搜索硬撞。
- 标量范式的三大缺点（表 2）：可解释性低（low interpretability）、样本效率低（sample-inefficient）、对搜索算法高度敏感（sensitive to search）。
- 定性反馈范式的三大缺点（表 2）：批评本身可能带噪声（critique can be noisy）、迭代过程可能漂移（may drift）、效果高度依赖验证器（validator-dependent）。
- 文本批评会不断累积、复杂度失控，需要专门的策展机制来管理（ACE 正是为此而设计）。
- brevity bias（简短偏差）：反复精炼容易让提示越写越短，丢掉关键信息；ACE 明确将其列为要缓解的问题。
- context collapse（上下文坍缩）：迭代过程中上下文退化塌缩，同样是 ACE 要抵御的失效模式。
- 种群式进化的三大缺点（表 2）：算力开销大（compute-heavy）、适应度函数需要按具体领域调校（fitness is domain-tuned）、种群漂移（population drift）。
- 收敛到局部最优（local optima）是标量与定性范式的共同风险，正是引入进化式探索的动机。
- 文本梯度范式的三大缺点（表 2）：梯度脆弱（brittle gradients）、质量随所用 LLM 而波动（quality varies by LLM）、缺乏理论保证（limited guarantees）。
- 无标量适应度可用的场景本身就是一个挑战（DEEVO 用辩论胜率作为替代信号来应对）。
- 全节所有方法都属于脚手架层改进，不改动基础模型参数——这既是优势（无需内部访问、模型无关）也是能力边界。

### 科普叙事素材（金句/比喻/例子）

- 【核心比喻·可当片头】提示词是智能体的"核心行为先验"（core behavioral prior）——论文说它定义了基础模型"如何解析它所处的环境"。换句话说，同一个大脑，换一段提示词，就是换一副看世界的眼镜。
- 【全节最大金句·适合作结尾】Takeaway 说：提示自改进把提示优化从一种 ad hoc practice（东一榔头西一棒的零散做法）变成了 signal-driven improvement loop（信号驱动的改进闭环）。翻译成人话：写提示词正在从"玄学手艺"变成"工程学"。
- 【表 2 的一句话总纲】As learning signals become more structured and informative, optimization becomes less heuristic and more automated. —— 反馈越具体，机器就越不用靠猜。这句可以直接做视频的主线论点。
- 【标量分数的痛点，观众秒懂】论文说标量信号"只提供成功的幅度而没有解释性上下文"（providing only a magnitude of success without explanatory context）。就像老师只告诉你考了 62 分，却不告诉你哪道题错了、为什么错——你只能把整套卷子重写一遍碰运气。
- 【最形象的术语·Reflexion】verbal introspection（口头内省）：智能体搞砸之后，用大白话给自己写一段检讨——"我刚才不该先查数据库"——把检讨存进记忆，下次照着改。这就是 AI 版的写日记复盘。
- 【进化范式的画面感】论文明确说这些方法把提示词当作种群中的"基因"（treat prompts as genes），走选择（Selection）、交叉（Crossover）、变异（Mutation）三步。妙点在于：交叉不是随机剪贴字符，而是由 LLM "聪明地融合两条父提示各自的语义长处"，论文原文称这 far surpass classical random character edits。
- 【最抓人的套娃·Promptbreeder】它进化的不只是任务提示，还有"变异提示"——也就是那条规定"后代该怎么变异"的指令。等于说：它在进化"进化的规则"本身。
- 【最抓人的套娃 2·MetaTextGrad】它优化的是"优化器提示"，论文的说法是让智能体 self-improve its own improvement process——改进"自己改进自己的方法"。一句话就能让观众坐直。
- 【最反直觉的设计·DEEVO】没有分数怎么办？让多个 AI 互相辩论，谁辩赢了谁的提示词就活下来。用"辩论胜率"当自然选择的标准——AI 界的角斗场。
- 【ACE 的两个失效模式，特别适合做动画】brevity bias：提示词反复精简，越改越短，最后把关键信息删没了；context collapse：上下文在迭代中塌缩退化。ACE 用 Generator–Reflector–Curator（生成者—反思者—策展人）三人组来防这两件事，并把提示和记忆当成一本不断更新的"文本战术手册"（evolving text playbooks）。
- 【最烧脑也最漂亮的概念·文本梯度】论文把反馈形式化为 textual gradient：一条结构化、有方向的反馈，既明确诊断"输出为什么错"，又开出一个精确的"修订向量"（a precise revision vector）。类比：以前是蒙眼在山里乱走找山顶，现在有人站在你旁边说"往东北方向走三十步"。
- 【TextGrad 的画面】automatic differentiation via text——用文本做自动微分。一句批评可以像数值梯度一样，沿着由多个 AI 组件串成的流水线一路反向传播回去，告诉每一环各自该改哪里。
- 【最有想象力的展望·适合做片尾悬念】论文说，未来一条文本梯度也许能被翻译成低秩参数更新（low-rank parameter updates），从而把提示工程和模型微调无缝打通。也就是说：你对 AI 说的一句话，有朝一日可能真的会变成它大脑里的一次权重更新。
- 【贯穿全片的叙事骨架】四个范式恰好是一条"反馈越来越会说话"的进化线：只给分数 → 会写评语 → 一群提示词优胜劣汰 → 直接告诉你往哪改。而且论文特意说明 GEPA（进化 + 反思批评）的成功，正是证明"有方向的语义引导"胜过"不透明的标量奖励"，从而直接铺路给了第四阶段。这条线天然就是视频的分段结构。
- 【有反差的细节·Scrable】把这套高深方法用在最接地气的场景：生成客户评论。系统反复评估、反复改系统提示，直到文本质量达到预设标准才收手——一个不知疲倦的文案编辑。


## 6.2 Memory（记忆演化）

本节把记忆定位为长程 agent 行为的"核心认知脚手架"。传统架构靠原始日志加固定 schema，append-only 设计很快撑爆上下文窗口并导致检索退化（RET-LLM、MA-LMM、MemGPT）；自改进 agent 则把记忆当作主动演化的脚手架，持续评估存储信息的价值、相关性与强度，依经验流自主重构与扩展。形式化上记忆是动态状态 M=(O,S)，由执行导出的学习信号 σ（检索失败、任务反馈、容量上限）驱动演化，并通过 Write/Read/Update/Delete 操作族实例化；范围严格限定在 frozen FM 前提下的非参数外置记忆，不含写进权重的 parametric memory。全节按三维分解：Object（存什么）、Structure（怎么组织）、Processing（怎么增删改查）。6.2.1 Object 分显式与隐式：显式可读可控、便于归因与安全审计，但冗长会推高检索噪声，又细分为压缩轨迹（routines/heuristics/reflections）、策展原始内容（代码、公式、截图等无法无损摘要的"动态小抄"）、整合外部知识（用效用反馈动态更新、标注、剪枝以提升可验证性）；隐式用 latent token、hidden state、KV cache 存储，紧凑且联想访问快，但难解释、难定向纠正，反复重写会 representation drift。三者取向分别是泛化、精确、可验证。6.2.2 Structure 给出四种拓扑及权衡：Flat 写入便宜、保留因果叙事利于轨迹回放，但有 recency bias 与冗余堆积；Hierarchical 分层压缩降噪，风险是分类体系与任务错配造成结构脆性、证据被切碎；Graph 用语义/时间/因果边把"按时间回忆"换成"按联想回忆"，支持多跳归因，代价是建图与冲突消解的开销及结构漂移；Vector 相似度检索是 episodic recall 主引擎，主导失败是"相似≠有用"，需靠重排、混合信号与门控控制器补救。6.2.3 Processing 把改进落成信号驱动的 CRUD：Create 做选择性蒸馏（语义压缩、基于邻居的离散决策、临近生成的边界插入），Read 做混合启发式、结构感知遍历、检索门控与轨迹复用，Update 做定期复盘衰减、局部刷新、迭代蒸馏与离线聚合，Delete 做多级剪枝、共识驱逐与分层淘汰。最后收束为七步闭环：观察—创建—组织—读取—规划执行—评估得信号—更新/删除，把记忆从被动缓存提升为支撑开放式自主的自治引擎。

### 代表方法

- **SCM (Self-Controlled Memory)**：扁平结构代表。维持一条按时间排序的记忆流，但给每条记录额外挂上摘要和向量 embedding，等于给流水账加了目录，让语义搜索和按时间翻找可以并存。同时它是"检索门控"的代表：先判断这次到底需不需要查记忆、查多少才够，以此省 token 并减少无关内容干扰。（例：论文在 Flat Structure 与 Memory Processing 的 Read（retrieval gating）两处都点名 SCM）
- **Self-Notes**：在长上下文推理过程中"边想边把心得直接写在原文里"，把瞬时洞见内联插入思考流。好处是记忆始终跟当前认知状态同步，可以马上根据反馈纠偏，同时不打乱思路的时间顺序。（例：Learning to reason and memorize with self-notes（2023），Table 4 中被列为最早的扁平/显式记忆系统之一）
- **MobileGPT**：层次结构中的"任务导向抽象"代表。把 GUI 操作组织成 目标→子任务→动作 三层，高层可以整块复用计划，低层还能回忆具体点了哪个按钮。（例：用于手机任务自动化（mobile task automation））
- **H-MEM**：层次结构中的"语义抽象"代表。构建多级语义节点，检索时先粗后细，从抽象意图自顶向下遍历到具体实体，避免一上来就翻底层细节。（例：Hierarchical memory for high-efficiency long-term reasoning in LLM agents（2025））
- **SHIMI**：同样构建多级语义节点索引，做去中心化的语义层次记忆索引，支持可扩展的 agent 推理与自顶向下遍历。（例：Semantic Hierarchical Memory Index，用于去中心化 AI 记忆）
- **SALM**：用"分级存储"实现层次：把短期记忆与长期记忆分开，短期负责维护当前活跃上下文，长期负责耐久复用，两者互不污染。（例：多智能体社交网络模拟框架；论文在 6.2.1 讨论记忆对象对跨情境知识迁移的影响时也引用了它）
- **XMem / MovieChat / MA-LMM**：把层次记忆思想搬到多模态长视频理解：把转瞬即逝的感知缓冲与持久表征分开存放，灵感直接来自经典人类记忆模型（Atkinson-Shiffrin 1968 的感觉—短时—长时三级结构）。（例：XMem 明确以 Atkinson-Shiffrin memory model 做长视频目标分割）
- **Mem0**：图结构代表。把对话解析成事实级（fact-level）的图节点与边，实现高度结构化的召回。它同时是 Create 环节"上下文感知离散决策"的代表：写入前先看检索到的邻居，再决定这条信息是 add、update、delete 还是 no-op，从源头防止重复和自相矛盾的条目。（例：Mem0: building production-ready AI agents with scalable long-term memory（2025））
- **SGMem**：把长期对话解析成句子级（sentence-level）图，粒度比事实级更细，用于长期对话 agent 的结构化记忆。（例：Sentence Graph Memory for long-term conversational agents）
- **Zep**：时间感知的知识图谱：每条知识都带时间属性，因此 agent 能持续做"信念修正"——旧结论被新证据推翻时，图能记录"什么时候曾经为真、什么时候不再为真"，而不是简单覆盖。（例：Zep: a temporal knowledge graph architecture for agent memory）
- **CausalRAG**：在检索图里显式画出因果边，而不是只靠共现或相似度连边，避免把"伪相关"当成因果送进自改进回路，导致 agent 学到错误规律。（例：把因果图整合进 retrieval-augmented generation）
- **G-Memory**：混合拓扑：层次化的图。在多智能体系统里把"可复用的高层洞见"和"细粒度执行日志"分层分开，追踪层次化记忆。它也是 Read 环节"结构感知检索"的代表：沿层次或图做由粗到细的遍历，把可复用抽象从底层轨迹里挑出来。（例：G-Memory: tracing hierarchical memory for multi-agent systems）
- **GraphVideoAgent / Scene-MMKG**：多模态场景下的图记忆：用实体关系图维护时空状态转移和实体交互，为具身/视频 agent 提供有依据（grounded）的推理基础。（例：GraphVideoAgent 用实体关系图理解长视频；Scene-MMKG 为具身 AI 构建场景驱动的多模态知识图谱）
- **Agentic RAG**：在经典 RAG 管线之上，把"要不要检索、检索什么"的控制权交给 agent 自己，从而管理动态变化的情景记忆，而不是每次机械地跑一遍固定检索。（例：论文以 Lewis 等 2020 的 RAG 为起点，引出 Agentic RAG 综述与时间序列分析等应用）
- **Generative Agents**：向量检索里"混合启发式"的经典做法：召回打分不只看向量相似度（relevance），还叠加 recency（多久之前发生）和 importance（这件事本身重不重要）三项加权，让回忆更稳定、更像人。（例：Generative agents: interactive simulacra of human behavior（2023），也是 Read 环节 hybrid heuristics 的代表）
- **RMM**："自适应表征"路线：引入可微分的排序（differentiable ranking），让排序器本身可以被训练优化，从而在长期对话中提升召回质量。（例：用于长期对话场景下的反思式记忆管理）
- **MemoryBank**：把过往交互切成情景片段（episodic segments）建向量索引，需要时稳健地把过去的成功案例捞回来复用。（例：MemoryBank: enhancing large language models with long-term memory）
- **CTIM-Rover**：面向软件工程 agent 的情景记忆索引与复用；论文引用它时对应的原文标题本身就带警示——情景记忆也可能"从知识变成噪声"。（例：From knowledge to noise: CTIM-Rover and the pitfalls of episodic memory in software engineering agents）
- **MIRIX**：不用一个扁平大索引，而是把查询路由到多个各有专长的子存储（sub-stores），用分工克服单一扁平索引的能力上限。（例：MIRIX: multi-agent memory system for LLM-based agents）
- **MrSteve**：证明向量记忆天然能容纳多模态经验：具身 agent 检索过去相关的视频帧来指导探索，记的是"什么—在哪—什么时候"。（例：Minecraft 中的指令跟随 agent，what-where-when memory）
- **AWM (Agent Workflow Memory)**：把原始交互轨迹压缩成可复用的工作流单元存起来，下次遇到相似任务直接调用现成流程，属于"处理过的轨迹"这一类显式记忆；也是 Create 环节语义压缩的代表。（例：Agent workflow memory（ICML 2025））
- **ReasoningBank**：把推理过程本身沉淀成"推理记忆"银行，靠任务成功/失败信号从经验中抽出可泛化的策略，用来扩展 agent 的自我演化。（例：ReasoningBank: scaling agent self-evolving with reasoning memory）
- **ReadAgent**：仿人阅读：把超长上下文读成"要旨记忆"（gist memory）——先记住大意，需要细节时再回原文查，从而突破上下文窗口限制。（例：A human-inspired reading agent with gist memory of very long contexts）
- **M3-Agent**：多模态长期记忆 agent：把看到的、听到的整合进长期记忆再做推理，属于"处理过的轨迹"在多模态上的延伸。（例：Seeing, listening, remembering, and reasoning: a multimodal agent with long-term memory）
- **ExpeL**：把 agent 当成"经验学习者"：从多次试错中挑出真正被验证有效的高价值素材写回记忆，而不是全量存档。（例：ExpeL: LLM agents are experiential learners（AAAI 2024））
- **Dynamic Cheatsheet (DC)**：最形象的"策展原始内容"代表：agent 在测试时边做边把管用的代码片段、公式、技巧攒成一张不断更新的"小抄"，下次直接抄。它也是 Update 环节"迭代蒸馏"的代表——反复成功的东西被不断筛选替换，浓缩成更精炼的可复用抽象。（例：Dynamic cheatsheet: test-time learning with adaptive memory）
- **PRIME**：把规划与检索整合进记忆，接入外部知识库并按效用反馈动态更新、标注、剪枝这些外部引用，避免错误在下游推理中传播。（例：PRIME: planning and retrieval-integrated memory for enhanced reasoning）
- **CodeAgent**：代表"整合外部知识"在代码场景的落地：把真实仓库级的代码库作为外部知识接入并维护，用工具集成的 agent 系统做仓库级代码生成。（例：CodeAgent，用于 real-world repo-level coding challenges）
- **MemGen**：隐式记忆的"生成式潜在记忆"：不是去检索文本，而是直接生成一段潜在向量序列注入推理过程来"补脑"。它同时是 Create 环节"受控边界插入"的代表——在离生成更近的位置动态决定写入策略，直接对下游效用负责。（例：MemGen: weaving generative latent memory for self-evolving agents）
- **CMR (Contextual Memory Reweaving)**："潜在状态重建"：把模型中间层的 hidden state 捕获下来，之后再分层重新织回上下文，以此改善长程语境保持。（例：Contextual memory reweaving in large language models using layered latent state reconstruction）
- **Differentiable Cache Augmentation / Latent Tokens**：用离线协处理器（coprocessor）把潜在 embedding 直接注入 KV cache，相当于在解码时偷偷给模型塞进一段"它自己能懂但人看不懂"的提示，以提升生成质量，且完全不动基座模型参数。（例：Deliberation in latent space via differentiable cache augmentation；Enhancing latent computation in transformers with latent tokens）
- **MemoryLLM / M+**：维护一个可自我更新的潜在记忆池，在"持续保存状态"和"严格控制容量"之间取折中；M+ 是 MemoryLLM 的扩展，把长期记忆做到可扩展。（例：MEMORYLLM: towards self-updatable large language models；M+: extending MemoryLLM with scalable long-term memory）
- **MemInsight**：Create 环节语义压缩的代表：自动把原始交互转成结构化元数据、摘要或可复用 schema，方便高效索引，属于"自主记忆增强"。（例：MemInsight: autonomous memory augmentation for LLM agents（EMNLP 2025））
- **A-MEM**：两处上榜：Create 环节按检索到的邻居做 add/update/delete/no-op 离散决策；Update 环节做"局部刷新"——插入新条目时顺手更新它在拓扑上的邻居，保持整片记忆的上下文一致，而不是只改一个点。（例：A-MEM: agentic memory for LLM agents）
- **Memento**：Read 环节"检索驱动的适应"代表：把历史轨迹当作可直接照做的案例取回来指导行为，实现"不微调模型也能微调 agent"。（例：Memento: fine-tuning LLM agents without fine-tuning LLMs）
- **SAGE**：Update 环节"定期复盘与衰减"的代表：周期性地强化高效用条目、让陈旧条目自然衰减，从而稳住记忆规模不无限膨胀。（例：Self-evolving agents with reflective and memory-augmented abilities）
- **ACE (Agentic Context Engineering)**：通过持续的筛选与替换，把反复成功的经验迭代蒸馏成紧凑可复用的抽象，让上下文本身随使用而进化。（例：Agentic context engineering: evolving contexts for self-improving language models）
- **LightMem**：Update 环节"离线聚合"的代表：把开销大的压缩合并工作挪出在线执行回路，放到离线做，既保住召回质量又不拖慢实时响应。（例：LightMem: lightweight and efficient memory-augmented generation）
- **MLC-Agent**：Delete 环节"多级剪枝"的代表：写入时先过滤掉低价值项，之后再按访问频率和相关性周期性清理。（例：MLC-agent: 基于记忆—学习协作的认知模型）
- **PBFT-backed semantic voting**：Delete 环节"共识驱逐"的代表：在分布式多智能体环境里，删不删一条共享记忆要经过协作投票（拜占庭容错式表决），防止某个 agent 误删了大家共用的关键知识。（例：PBFT-backed semantic voting for multi-agent memory pruning）
- **MemoryOS (Memory OS of AI Agent)**：Delete 环节"分层淘汰"的代表：借用操作系统的分页/换出思想，在不同记忆层之间套用淘汰规则，既把总量控制住，又保持长期一致性。（例：Memory OS of AI agent（EMNLP 2025）；论文开头引用的 MemGPT 亦以"LLM 即操作系统"为思路）
- **SEDM**：可扩展的自演化分布式记忆，被论文用作"agent 依经验流自主重构记忆表征"和"用学习信号动态决定写/读/忘"的代表性依据。（例：SEDM: scalable self-evolving distributed memory for agents）
- **RET-LLM / MA-LMM / MemGPT**：被论文作为对照组点名的传统记忆架构：原始内容日志加固定 schema 的通用读写记忆，属于"静态存储"范式，在动态变化环境中容易撑爆上下文并出现检索退化。（例：RET-LLM: towards a general read-write memory for LLMs；MemGPT: towards LLMs as operating systems）

### 风险 / 挑战 / 防护

- append-only 的静态记忆很快撞上上下文窗口上限并出现检索退化，在动态环境中不堪用（论文开篇对传统架构的核心批评）
- 显式记忆的可扩展性风险：冗长或策展不力的记忆会随规模增长持续抬高检索噪声与上下文压力
- 隐式（潜在）记忆难以检查、难以定向纠正、难以做安全审计；反复重写或组合会导致 representation drift（表征漂移），甚至 silent corruption（无声损坏）
- Table 3 列出的四类记忆对象典型失败模式：处理过的轨迹 → summary bias（摘要偏差）、stale heuristics（过时启发式）、weak credit assignment（归因不清）；策展原始内容 → context bloat（上下文臃肿）、retrieval noise、privacy leakage surface（隐私泄露面）；整合外部知识 → grounding failure、staleness/inconsistency、tool brittleness；潜在 embedding → drift/contamination、hard-to-debug retrieval、silent corruption
- Flat 结构的 recency bias：捞上来的是最近但无关的交互，反而漏掉久远却决定性的证据；且因缺乏抽象机制，会不断堆积冗余低层轨迹
- Hierarchical 结构的 structural brittleness：一旦归纳出的分类体系与任务错配，严格的层级会把证据切碎、阻碍跨类别检索，严重妨碍 agent 重组多样经验来持续改进
- Graph 结构的维护复杂度：持续建图、更新边、消解冲突带来显著算力开销；agent 反复自我编辑记忆还会引发 structural drift（结构漂移）
- Vector 检索的主导失败模式是 similarity ≠ usefulness：embedding 上的最近邻可能主题相似却与决策无关，这种检索噪声会系统性地偏置 agent 后续的学习更新
- Create 的两难：over-writing 抬高检索噪声，under-writing 牺牲长期能力
- Read 策略失效的直接后果：取回无关噪声或漏掉关键细节，会直接导致后续规划与执行失败
- Update 缺位会造成 memory decay（记忆衰败）：过时事实继续留存、知识结构崩解、不当合并抹掉重要细节
- Delete 的两难：over-pruning 丢掉关键知识，under-pruning 让系统被过时噪声淹没并拖慢检索
- 已被提出的防护/缓解措施：向量检索叠加 re-ranking、混合信号与自适应门控控制器；retrieval gating 控制 token 成本与干扰；CausalRAG 用显式因果边阻止伪相关污染自改进回路；共识驱逐（PBFT 语义投票）防止误删多智能体共享的关键知识；分层淘汰（操作系统式规则）在限容的同时保持长期一致性；离线聚合把昂贵压缩移出在线回路以保召回；优先选择显式记忆以支撑可解释性、可归因与安全审计

### 科普叙事素材（金句/比喻/例子）

- 核心比喻——记忆不是仓库，是活的脚手架："self-improving agents treat memory not merely as a passive storage mechanism, but as an actively evolving scaffold." 论文一开头就把记忆称作"core cognitive scaffolding for long-horizon agentic behavior"（长程智能体行为的核心认知脚手架）。
- 全节最有冲击力的收尾金句（Takeaway 与闭环段各一句）："these stages elevate memory from a passive cache to a self-governing engine that sustains open-ended autonomy." 以及 "elevates memory from a static cache to a scalable engine for self-improvement."——从"被动缓存"到"自治引擎"，一句话讲清整节主旨。
- 最能让普通人共鸣的失败模式：recency bias。原文写作 "surfacing recent but irrelevant interactions while missing older, decisive evidence."——就像一个只记得刚刚发生的事、却把真正关键的往事忘光的人。
- 第二个直击人心的失败模式："相似不等于有用"。"The nearest neighbors under an embedding metric may be topically similar yet decision-irrelevant, and this retrieval noise can systematically bias the agent's subsequent learning updates."——搜到一堆看起来很像、其实帮不上忙的东西，还会把 agent 越带越偏。
- 最形象的具体系统：Dynamic Cheatsheet（动态小抄）。agent 一边做题一边把管用的招式攒成一张不断更新的小抄，下次直接抄——原文 "distilling dynamic 'cheatsheets' for future reuse"。
- 最优雅的一句结构对比：图记忆 "replaces recency-based recall with retrieval by association"——把"按时间回忆"换成"按联想回忆"，这正是人脑想起一件事的方式。
- 记忆会"生病"：memory decay 的三症状原文直白得像病历——"outdated facts remain, knowledge structures break down, and improper merging erases important details."
- 两个对称的两难，非常适合做视频里的"天平"动画。写入："over-writing inflates retrieval noise, whereas under-writing sacrifices long-term capability." 删除："over-pruning loses critical knowledge, while under-pruning floods the system with outdated noise and slows down retrieval."
- AI 也在抄人脑作业：多模态长视频 agent 把"转瞬即逝的感知缓冲"和"持久表征"分开，明确 "drawing inspiration from classical human memory models"——引的是 Atkinson & Shiffrin 1968 年那套感觉/短时/长时记忆模型（XMem 的副标题直接写着 with an Atkinson-Shiffrin memory model）。
- AI 也在抄操作系统作业：分层淘汰"applies operating-system-inspired rules across different memory layers"，代表作干脆叫 Memory OS of AI Agent，更早的 MemGPT 副标题是 "towards LLMs as operating systems"——记忆管理正在变成一门"给 AI 装操作系统"的工程。
- 最有画面感的治理机制：多智能体删记忆要"开会投票"。consensus-based eviction "uses collaborative voting in distributed setups to prevent the accidental deletion of critical shared knowledge"，实现方案是 PBFT-backed semantic voting（拜占庭容错式的语义表决）——AI 集体记忆的"议会制"。
- 反复改自己的记忆是有代价的："risk structural drift as the agent repeatedly edits its own memory."——一个不断重写自己回忆的人，最后可能记成另一个样子。这句配隐式记忆的 "representation drift" 和 "silent corruption"（无声损坏）一起讲，寒意十足。
- 一个反直觉的诚实脚注：论文引用 CTIM-Rover 时，那篇论文的标题本身就是警告——From knowledge to noise: ...and the pitfalls of episodic memory in software engineering agents。记得多，不一定学得好。
- 可视化最强的一节：Table 3 的"记忆对象计分卡"，用 1-5 级蓝格子给四类记忆在 fidelity（保真度）、interpretability（可解释性）、compactness（紧凑度）、write cost（写入成本）、auditability（可审计性）上打分，并列出各自最常见的翻车方式（如 curated raw content 的 privacy leakage surface）。适合做成雷达图。
- 可做成动画主干的七步闭环：(i) Observe & Detect saliency（观察并识别哪些值得记）→ (ii) Create（压成紧凑对象）→ (iii) Organize（放进拓扑结构）→ (iv) Read（按需检索）→ (v) Plan & Act（规划执行）→ (vi) Evaluate（评估拿到学习信号）→ (vii) Update/Delete（巩固高价值、剪掉噪声），然后回到第一步。
- 分层记忆的直观例子：MobileGPT 把手机操作记成 goal→subtask→action 三层——高层记住"帮我订一张票"这个套路可以整块复用，底层还记得当时具体点了哪个按钮。
- 一条重要边界说明，适合用来澄清观众的误解：本节讨论的全是外挂式记忆，模型权重完全冻结。"this section focuses on non-parametric, externalized memory embedded within the agent's scaffold, maintaining the core assumption of a frozen foundation model."——AI 变聪明了，但脑子（参数）一个字没改。


## 6.3 Tool（工具治理）— Tool Governance Metacognition 工具治理元认知

本节的起点命题是：基础智能体受制于「静态、人工策划的工具箱」（static, manually curated toolkits），面对新挑战时既无法自适应，也无法自主发现或接入新资源。要从一个单纯的执行器（basic executor）变成真正能自我改进的智能体，必须从预定义的工具调用转向「工具治理元认知」（Tool Governance Metacognition）——让智能体自主推理工具的必要性、效用与可靠性，从而持续推进自己的能力边界，而不只是在边界内运作。作者用式(21) 形式化：T_{t+1} = IMPROVE_T(T_t; S_t)，其中 S_t 是工具治理元认知产出的学习信号。该元认知被拆成三个核心维度，共同把工具使用从「静态查表」变成「生成式的自我改进循环」，正对应三个小节，逻辑上构成「选工具—修工具—造工具」的闭环。

6.3.1 动态工具路由（Dynamic Tool Routing）处理怎么选、怎么排序、怎么协同。作者指出工具池一旦变大，路由本身就成为自我改进的主要瓶颈：覆盖面提升的同时，误路由、执行失败的连锁放大、算力浪费等错误模式也随之增加，因此所有路由方法本质是在覆盖度、可靠性、决策成本三者间权衡。分类维度很明确——按「检索单元是什么」以及「如何随时间吸收反馈」分为三种范式：(a) 检索与图结构路由，要么优化检索空间（剪枝或扩大检索粒度），要么把工具依赖显式建成有向图以支持多步可行性与前置条件；(b) 策略学习路由，把工具选择内化为序贯决策问题，从 SFT 打底走向稀疏奖励与偏好信号，直到 ToolGen 把检索—选择—调用统一成单一生成过程；(c) 主动与交互式路由，把路由当成交互过程而非一次性决策，专门应对「用户意图欠定」和「执行失败需局部修复」两类反复出现的失效来源。

6.3.2 迭代式工具精炼（Iterative Tool Refinement）解释智能体如何把脆弱程序变成可靠技能。关键洞见是：工具错误不只是执行期故障——不可靠工具一旦被存入并复用，会通过反复检索与误差累积污染智能体未来的行为。因此精炼同时承担「调试」与「守门」两种角色，决定什么才能进入结构化技能库。作者以 VOYAGER 的生成—执行—修订循环为基线，再从三方向强化：批判专门化（Critique Specialization）、API 抽象（API Abstraction）、接口对齐（Interface Alignment）。

6.3.3 自主工具创造（Autonomous Tool Creation）负责在现有工具不足时合成新的可执行函数，其最大价值在于把一次性解题转化为可复用的程序性知识；但也引入新风险——新工具必须被验证、文档化并稳妥集成，否则工具增长带来的是脆弱性而非自主性。三个推进方向：合成触发（按需发明 vs 好奇心驱动的开放式探索）、生命周期自动化（真正的瓶颈不是写代码而是让代码跑起来）、标准化集成（用 MCP 等协议与严格注册流程保证工具膨胀不破坏既有路由策略）。

Takeaway 收束：三者叠加使系统从静态工具箱转变为可持续扩展的动态技能库。

### 代表方法

- **MemTool**：主动给工具集瘦身。它把庞大的工具池修剪成一份轻量的操作记忆（lightweight operational memory），只保留当前真正用得上的那部分，从而防止工具一多路由质量就崩坏（routing degradation）。（例：属于检索与图结构路由范式中「优化检索空间」一路的代表。）
- **TAR**：反过来把检索单元放大：它不只在原子级 API 之间做选择，还能动态地把整个「有能力的智能体」当成一个可调用对象来路由，用来应对更高层级的任务。（例：论文原文：dynamically routing between atomic APIs and entire competent agents to handle higher-level tasks。）
- **VOYAGER**：本节出现两次。路由侧：把过去成功的工具使用轨迹索引进程序性记忆（procedural memory），让路由策略靠历史执行的结构性知识不断自我打磨。精炼侧：作为生成—执行—修订经典循环的基线——执行生成的代码，把报错栈与环境反馈当作学习信号 S_t 捕获下来，喂回下一轮修订，直到验证器确认成功。（例：论文称其 establishes this baseline，同时也是程序性记忆索引的代表。）
- **MetaAgent**：与 VOYAGER 同类：把可复用的工具使用轨迹沉淀为程序性记忆，使检索过程不是静态的，而是靠过往成功经验持续演化。（例：与 VOYAGER 并列被引，用于说明检索过程本身也会学习。）
- **ToolNet**：不再做一次性相关度匹配，而是把工具之间的转移关系编码成有向图（directed graph），让路由能考虑多步可行性和前置条件，即「用完 A 才能用 B」这类依赖。（例：针对扁平检索（flat retrieval）在组合性上的局限提出。）
- **OrchDAG**：同样把工具依赖建模为有向图式编排，使多步工具链的规划带上拓扑约束，而不是把每一步都当成孤立的检索题。（例：与 ToolNet 并列作为拓扑结构路由代表。）
- **MassTool**：把学出来的语义匹配与图结构结合，即使在海量、复杂的工具拓扑里也能高精度导航。相当于既看语义像不像，也看结构上走不走得通。（例：论文称其可在 massive and complex tool topologies 中实现 high-precision navigation。）
- **AUTOACT**：策略学习路由的打底方案之一：用合成或挖掘出来的轨迹做监督微调（SFT），先把可靠的工具调用行为教会，建立稳定的路由基线。（例：与 MCP-Flow、Tool-Star、DeepEyesV2 并列为 SFT bootstrap 一类。）
- **MCP-Flow**：同属 SFT 引导路径，通过在合成或挖掘轨迹上做监督微调来 bootstrap 工具调用策略。（例：论文并列引用于建立可靠路由基线的语境。）
- **Tool-Star**：同属 SFT 引导路径，用训练信号让模型内化「什么时候调哪个工具」，而不是每次去外部索引里查。（例：论文并列引用于 bootstrap policies 的语境。）
- **DeepEyesV2**：同属 SFT 引导路径的多模态方向，靠合成轨迹微调把工具调用变成学到的行为。（例：与 AUTOACT、MCP-Flow、Tool-Star 一起被点名。）
- **AGENTFLOW**：超越静态监督：用稀疏奖励（sparse rewards）或偏好信号塑造智能体的规划与探索行为，让长程（long-horizon）工具使用能持续变好，而不只是模仿训练集里的做法。（例：与 SPORT 并列为「用奖励或偏好塑形」的代表。）
- **SPORT**：同样用稀疏奖励或偏好信号优化规划与探索，解决 SFT 无法覆盖的长程行为改进问题。（例：与 AGENTFLOW 并列引用。）
- **AutoTIR**：把工具选择显式地与多目标合规性（multi-objective compliance）对齐——选工具时不只看能否完成任务，还要满足其他约束条件。（例：与 DeepAgent 并列为显式对齐一路。）
- **DeepAgent**：把工具选择与动作级归因（action-level attribution）对齐，即能追溯到底是哪一步动作导致了成败，从而让信用分配更精确。（例：论文原文：explicitly align tool selection with multi-objective compliance and action-level attribution。）
- **ToolGen**：把这条路线推到极致：通过工具词元统一（tool-token unification）把检索、选择、调用三步塌缩成单一生成过程——工具直接变成模型词表里的 token，模型说出工具名就等于调用它。优雅地消除了流水线复杂度，但代价是全部压力落在学到的策略上，一旦分布漂移就可能失准。（例：原句：collapses retrieval, selection, and invocation into a single generative process via tool-token unification；同时警告 it places a heavy burden on the learned policy to remain calibrated under distribution shifts。）
- **MCP-Zero**：主动式路由：当遇到意图欠定或存在功能缺口时，不被动失败，而是主动发起工具发现（tool discovery），去找有没有能补上缺口的工具。（例：与 ASKTOACT 并列，被描述为把模糊性转化成自我纠错的学习信号。）
- **ASKTOACT**：主动式路由的另一半：面对说不清楚的用户需求，先反问、请求澄清（prompt for clarification），用一次追问换掉一次误路由。（例：论文强调 user intent is often underspecified, and misrouting can be avoided by clarification。）
- **Tool-Planner**：把功能相近、可互换的工具聚成工具包（interchangeable kits）。某个 API 挂了就在同一个包里换个替代品做局部修复，不必推倒重来做全局重规划，大幅降低修复成本。（例：原文：enabling localized, API-level repair without the prohibitive cost of global replanning。）
- **ToolACE-R**：根据任务难度动态调节要改几轮的力度——简单任务少修，难任务多修，在路由可靠性与真实部署的算力预算之间找平衡。（例：论文用它说明真实部署中 reliability 与 compute budget 的取舍。）
- **STELLA**：本节出现两次。精炼侧：部署专职的评论家智能体（critic agent）评估中间结果并给出针对性反馈，弥补单一大模型容易漏掉领域特有失败模式的问题。创造侧：走自主探索路线，主动提出学习课程（curricula）或去发现领域专属资源，在固定任务清单之外提前囤积工具。（例：论文点名生物信息学（bioinformatics）作为其领域专属工具发现的例子。）
- **SkillWeaver**：API 抽象方向：把与网页的交互过程蒸馏成可复用的网页工具，并靠执行反馈不断打磨。也就是把一串零散点击操作固化成一个能反复调用的稳定函数。（例：论文称这种抽象显著提升跨任务的技能迁移（skill transfer）。）
- **PyVision**：本节出现两次。精炼侧：动态改写 Python 程序，让多模态工具在感知有噪声（noisy perception）的情况下依然稳定。创造侧：属于按需发明——当检索到的现有 API 用不了时，当场合成并精炼新工具。（例：与 ATLASS 并列作为 on-demand invention 的代表。）
- **DRAFT**：全节最反直觉的一个：它迭代改进的不是工具代码，而是工具的说明文档（tool documentation）。因为很多执行失败并非实现有 bug，而是自然语言指令与工具可供性（tool affordances）之间对不上号——说明书写得不清楚，模型就用错。（例：原句：many execution failures stem from mismatches between natural language instructions and tool affordances, rather than from flawed implementations。）
- **ATLASS**：按需式工具创造：只有当现有检索到的 API 无法完成任务时，才触发合成新工具并精炼，属于需求驱动而非好奇心驱动。（例：与 PyVision 并列为 on-demand invention。）
- **FRIDAY**：好奇心驱动一路：自主提出学习课程（curricula），在没有具体任务逼迫的情况下主动探索、提前积累工具，属于开放式（open-ended）的能力扩张。（例：与 STELLA 并列，论文称其 proactively accumulate tools outside a fixed task list。）
- **TOOLMAKER**：端到端自动化工具生命周期，本节最具画面感的系统：它从科研论文里抽取方法逻辑，自动安装依赖，在闭环中反复调试，最终产出稳健的可调用接口。论文点明真正的瓶颈不是写出代码，而是让代码真的能跑。（例：原文：extracting logic from scientific papers, installing dependencies, debugging in a closed loop, and producing robust callable interfaces；并称其 transforms abstract function generation into tangible deployability。）
- **Alita**：标准化集成：自动把代码仓库转换成符合 Model Context Protocol（MCP）的标准化服务，让新工具以统一接口接入，避免工具爆炸把既有路由策略搅乱。（例：与 Code2MCP 并列为 protocol-driven architectures。）
- **Code2MCP**：同样把现成代码仓库自动封装成 MCP 标准服务——相当于给每个新工具装上统一规格的插头，即插即用。（例：论文将 MCP 明确写作 Model Context Protocol。）
- **AgentOrchestra**：为新工具设置严格的准入流水线：先做意图解析（intent parsing），再验证（validation），最后正式注册（formal registration），通过了才允许进入活跃工具池，确保自主创造始终服从整体治理与检索约束。（例：论文强调这保证 autonomous creation remains fully compatible with the agent broader governance and retrieval constraints。）

### 风险 / 挑战 / 防护

- 工具池规模膨胀本身就是自我改进的主要瓶颈：覆盖面上升的同时，误路由（misrouting）、执行失败的连锁放大（compounding execution failures）、算力浪费三类错误模式同步增加。
- 路由方法无法三全其美，必须在覆盖度（coverage）、可靠性（reliability）与决策成本（decision cost）之间做权衡。
- 扁平检索存在组合性缺陷：一次性相关度匹配无法表达工具间的多步依赖与前置条件，需引入图或拓扑结构才能补上。
- 策略学习路由的核心风险是数据与反馈依赖——容易过拟合训练环境，一旦工具接口变更或分布漂移（drift）就变得脆弱。
- ToolGen 式的极致统一虽简化了流水线，却把全部负担压给学到的策略，在分布漂移下难以保持校准（remain calibrated）。
- 主动与交互式路由是用额外的交互轮次与算力换取可靠性，成本并非免费。
- 用户意图常常欠定（underspecified），不澄清就直接路由容易走错。
- 工具错误不止是执行期故障：不可靠工具一旦被存入并复用，会通过反复检索与误差累积（repeated retrieval and compounding errors）持续污染智能体未来的行为——因此精炼必须同时充当技能库的守门（gatekeeping）机制。
- 单一整体模型做自我反思时容易忽略领域特有的失败模式，需要专门化的批判者来补足诊断精度。
- 智能体与工具之间存在语义鸿沟：自然语言指令与工具可供性（tool affordances）不匹配会造成大量失败，而这类失败与代码实现本身无关。
- 自主创造工具的固有风险：新工具若未经验证、文档化和妥善集成，工具增长会带来更多脆弱性而非更强自主性（tool growth can increase brittleness rather than autonomy）。
- 爆炸式的工具增长可能破坏既有路由策略的稳定性，因此需要协议化架构与严格注册流程加以约束。
- 合成原始代码只是第一步，让它真正可执行（依赖安装、调试、封装接口）才是实际瓶颈。

### 科普叙事素材（金句/比喻/例子）

- 【全节主旨金句】智能体要能不断推进自己的能力边界，而不只是在边界内做事。英文原文：continually advancing its capability boundaries rather than merely operating within them。可直接当作视频的主题词。
- 【最适合做转场的句子】工具使用从静态查表变成生成式的自我改进循环。英文原文：moves tool use from a static look-up process to a generative, self-improving cycle。
- 【反直觉的核心矛盾，观众最容易记住】工具不是越多越好。英文原文：A large tool set increases coverage but also increases error modes, including misrouting, compounding execution failures, and wasted compute。可类比成：给你一间塞满两千把工具的车间，你反而更容易拿错扳手，拿完还发现装不上去。
- 【最有画面感的比喻素材 MemTool】把庞大工具池修剪成一份轻量的操作记忆（pruning the tool set into a lightweight operational memory）——就像出门前只把今天真正要用的几件工具装进腰包，而不是背着整间五金店。
- 【概念冲击点 TAR】把另一个完整的智能体也当成一件工具来调用。英文原文：dynamically routing between atomic APIs and entire competent agents。可以讲成：在它眼里，一个同事和一把螺丝刀，都是可以被调用的东西。
- 【最科幻的一句 ToolGen】把检索、选择、调用三步压成一步，工具直接变成模型词表里的一个 token。英文原文：collapses retrieval, selection, and invocation into a single generative process via tool-token unification。可以讲成：它不是去找工具，而是把工具的名字像单词一样说出来，说出口的瞬间工具就被用了。紧接着的警告同样有戏剧性：it places a heavy burden on the learned policy to remain calibrated under distribution shifts。
- 【最有危机感的一句，适合做小高潮】坏工具的危害不是当场报错，而是被存进技能库反复污染未来。英文原文：If unreliable tools are stored and reused, they can corrupt the agent's future behavior through repeated retrieval and compounding errors。可以讲成：一把有裂纹的扳手，你今天用它拧坏一颗螺丝，但真正可怕的是你把它放回了工具箱，以后每次都还会拿到它。
- 【一个精准的角色隐喻】论文把工具精炼定义为守门人：refinement therefore serves both as debugging and as a gatekeeping process that controls what enters the structural skill repository——它既是修理工，也是决定什么东西有资格进入技能库的门卫。
- 【最反直觉、最适合当视频「哦原来如此」时刻 DRAFT】它改的不是工具代码，而是工具的说明书。英文原文：many execution failures stem from mismatches between natural language instructions and tool affordances, rather than from flawed implementations。可以讲成：机器用错工具，往往不是工具坏了，而是说明书写得太含糊——所以它选择去重写说明书。
- 【最有故事性的系统 TOOLMAKER】它会去读一篇科研论文，从里面抽出方法，自动安装依赖，自己闭环调试，最后交付一个能直接调用的接口。英文原文：extracting logic from scientific papers, installing dependencies, debugging in a closed loop, and producing robust callable interfaces。这是「AI 读论文然后把论文变成能跑的软件」，对普通观众冲击力极强。
- 【配套金句】论文点破真正的难点：Synthesizing raw code is only the first step; rendering it executable is the actual bottleneck.（写出代码只是第一步，让它真的跑起来才是真瓶颈。）任何写过代码的人听到都会点头。
- 【维修场景的比喻 Tool-Planner】把可互换的工具聚成一个工具包，坏了就换同包里的替代品，而不是把整个计划推翻重来。英文原文：clustering tools into interchangeable kits, enabling localized, API-level repair without the prohibitive cost of global replanning。类比：灯泡坏了换灯泡，不用重装整栋楼的电路。
- 【体现分寸感的细节 ToolACE-R】它会根据题目难度决定要改几遍——简单题少折腾，难题多折腾（dynamically calibrates its revision effort based on task difficulty）。这是很人性化的行为，观众容易共情。
- 【好奇心 vs 需求驱动的对照】ATLASS 与 PyVision 是「用不上现成 API 了才现造」，而 FRIDAY 与 STELLA 是主动给自己排课表、提前囤工具（proactively accumulate tools outside a fixed task list），论文甚至举了生物信息学（bioinformatics）作为主动挖掘领域工具的例子。这组对照就是临时抱佛脚与提前备课的差别。
- 【最锋利的警告句】工具越造越多，可能换来的是更脆弱而不是更自主。英文原文：otherwise tool growth can increase brittleness rather than autonomy。适合放在讲完 AI 自己造工具的兴奋点之后，做一个冷静的转折。
- 【结尾收束句，取自 Takeaway】系统从一个静态工具箱，变成一座能可持续扩展的动态技能库。英文原文：transforms the system from a static toolkit into a dynamic skill repository with sustainably expandable capabilities。
- 【可用作全片结构提示】论文把工具治理拆成三件事，正好是一个人成长的三段式：会挑工具（Dynamic Tool Routing）、会修工具（Iterative Tool Refinement）、会造工具（Autonomous Tool Creation）。这个选—修—造三段结构非常适合做视频章节划分。
- 【冷知识型细节 MCP】Alita 和 Code2MCP 会把现成的代码仓库自动转换成符合 Model Context Protocol（MCP）的标准服务——相当于给每件新工具统一装上同一规格的插头，插上就能用，不至于把整个工具架搞乱。


## 6.4 6.4 Full Scaffolding（完整脚手架自修改）

6.4 节是第 6 章「Scaffolding Improvement」四级递进的最深一层。全章按「架构干预深度」排序：6.1 Prompt（改提示词）→ 6.2 Memory（改记忆）→ 6.3 Tool（改工具）→ 6.4 Full Scaffolding（改整个自己）。前三节只调局部零件，6.4 则把智能体的整个运行逻辑与代码库当作「可变基质」（mutable substrate），允许根本性结构重组，因而是全文最接近「递归自我改进」（RSI）的类别。

该节内部分四个层次展开。

（1）形式化定义与自指性。智能体状态记作 A_t=(θ_t, Σ_t)；全脚手架改进保持基础模型参数 θ 冻结、只更新 Σ，是最一般的 scaffolding-only 转移：Σ_{t+1}=IMPROVE_Σ(Σ_t; S_t)，其中 S_t 是从智能体自身执行轨迹与评估中提取的学习信号（任务成败、单元测试、自我批评、成本信号）。关键区别在于：与「外部固定元优化器」不同，改进程序本身就实现在当前脚手架内部，因此更新是自指的：Σ_{t+1}=I_{Σ_t}(Σ_t; S_t)，下标 Σ_t 强调改进器会与被改进的智能体一同进化。论文认为这类自指回路原则上能发现人类未预料的更新策略，提升智能体内在的「可进化性」（evolvability，引 Dawkins、Gerhart & Kirschner、Hendrikse 等进化生物学文献）。同时立刻设限：完全开放式的递归自我改进仍是 grand challenge，现有系统只是在既定目标、基准与安全协议内把该概念工程化。配图为 Figure 10（跨迭代的全脚手架自我改进）。

（2）程序化实现范式与验证门。脚手架被表示为带轻度约束的普通计算机程序：⟨Σ_t⟩ 是程序的可序列化编码，exec 表示在解释器 / 编译器 / 沙箱中执行。一次更新即「让当前智能体作为改进器去执行自己的代码」，产出候选 ⟨Σ̃_{t+1}⟩=exec(⟨Σ_t⟩; S_t)，实践中常落地为补丁 Σ̃_{t+1}=Σ_t ⊕ Δ_t。随后由验证器 V（单元测试、回归套件、安全检查）把关：V=1 才接受新版本，否则保留 Σ_t。这条「候选 → 验证 → 接受或回滚」门控是本节的安全骨架。

（3）理论依据与历史起点。计算机程序的通用可表达性（图灵完备）使自改进智能体能探索极大的策略空间，原则上只受计算理论极限约束；源头追溯到 Schmidhuber 1987 年的自指程序搜索与元进化框架。

（4）代表性系统三条线：演化式程序发现（AlphaEvolve、ShinkaEvolve）；智能体设计空间搜索（ADAS、EvoFlow、STOP、Agent Symbolic Learning）；哥德尔机启发的开放式演化谱系（Gödel Agent、DGM、HGM、Live-SWE-Agent）。

Takeaway 重申：该类别最接近 RSI，因为它把源码与运行逻辑当作可变基质；但当前只能做成「有边界、可验证的循环」，在人类设计的目标与安全协议内运行，才是通往可靠自我改进的可测量路径。第 6 章导言另补充：四类干预可组合而非互斥，全脚手架方法天然包含组件级编辑，并额外引入 archive 式探索与更强的接受测试，同时依靠版本历史支持对有害修改的验证与回滚。

### 代表方法

- **AlphaEvolve**：面向开放科学问题的编码智能体。采用演化范式：不断从一个或多个评估器（evaluator）接收反馈，据此迭代改进自己写出的算法。可以理解成 AI 反复写算法、交给自动评分员打分、再照着分数改下一版，如此循环。（例：论文称其显著加速新的科学发现，并可优化复杂技术栈（Novikov et al. 2025，引用号 198））
- **ShinkaEvolve**：LLM 驱动的程序演化框架，主打「样本效率」——用极少的评估次数做开放式程序发现。三个关键设计：探索-利用平衡的父代采样（决定拿哪一版当爹妈继续改）、基于新颖性的代码拒绝采样（生成雷同代码就丢弃，逼系统产出真正不同的方案）、bandit 式自适应选择由多个 LLM 组成的集成（哪个模型近期表现好就多用谁）。（例：论文强调其可在多任务上以极少评估样本实现开放式程序发现与优化（Lange et al. 2026，引用号 149））
- **ADAS (Automated Design of Agentic Systems)**：把「智能体系统怎么搭」定义成一个设计空间，然后用专门的搜索算法在这个空间里找出使给定评估函数最大化的那套系统。相当于不再靠人手工设计智能体架构，而是让搜索算法自动试出最优架构。（例：Hu et al. 2025，引用号 121）
- **EvoFlow**：持续演化一组异构工作流（heterogeneous workflows），在线（online）产出一个帕累托集：既兼顾成本-性能权衡，又保持结构多样性。意思是它不追求单一最优解，而是同时养一批风格各异的流程，让用户能按预算挑档位。（例：注意：论文正文提到 EvoFlow 时未附引用编号（其他方法均有），是该节文献标注的一处疏漏）
- **Self-Taught Optimizer (STOP)**：把智能体的脚手架直接抽象成一个「改进器」：喂给它自己的程序代码和一个效用函数，它反复调用语言模型生成多个候选改进版本，再选其中得分最高的作为输出，输出的新版本又可以继续改自己，从而形成递归自我改进循环。是本节自指思想最直白的实现。（例：Zelikman et al. 2024，引用号 394（标题即 recursively self-improving code generation））
- **Agent Symbolic Learning**：把语言智能体看成一张「符号网络」（symbolic network）：它的「权重」不是数字，而是由提示词、工具及其组合方式实例化的。然后用自然语言写的「损失」和「梯度」来模拟反向传播与梯度下降，再由一个符号优化器联合更新提示词、工具与整条流水线。等于把深度学习那一整套训练机制原样搬到文字层面。（例：论文称其支持在真实部署中持续自学习与进化（Ou et al. 2025，引用号 201））
- **Gödel Agent**：受哥德尔机启发的自指智能体框架，通过 monkey patching（运行时热替换自身代码）实现。它自主完成三件事：自我认知（读懂自己的代码在干什么）、自我修改（动手改）、递归自我改进（改完的版本继续改），目标是搜索整个智能体设计空间。（例：Yin et al. 2025c，引用号 386）
- **Darwin Gödel Machine (DGM)**：受达尔文进化与开放式研究启发的自演化编码智能体。它不是单线迭代，而是维护一个 archive（档案库）保存所有新生成的编码智能体，通过开放式探索长成一棵不断扩张的、多样且高质量的智能体树，可以在搜索空间中并行探索多条路径。即使某条路当下看着差，也留在档案里，日后可能成为突破口。（例：Zhang et al. 2026c，引用号 407；该文献同时被本节用作 evolvability 论据）
- **Huxley-Gödel Machine (HGM)**：受赫胥黎的 clade（演化支）概念启发，引入 clade 级元生产力指标 CMP（clade-level metaproductivity）来引导演化，作为对「哥德尔机理想」的一种近似。核心思路是：评价一个智能体不看它自己当下多强，而看由它衍生出的整支后代血脉的产出能力。（例：Wang et al. 2026a，引用号 333；论文副标题提及 human-level coding agent development）
- **Live-SWE-Agent**：论文称其为首个能在运行时（on the fly）自主且持续演化的实时软件智能体。区别于「训练完再部署」，它是在实际干活的过程中顺手改自己的脚手架——尤其是工具组件——以在软件问题求解任务上达到理想性能。（例：Xia et al. 2025，引用号 361；论文标题即在问 software engineering agents 能否 self-evolve on the fly）
- **Schmidhuber 1987 self-referential program search / meta-evolution**：本节点名的历史起点：早在 1987 年就有关于「让计算机程序改进自身」的自指程序搜索与元进化框架，探讨如何学习「如何学习」。今天的自演化智能体在思想上是它的延续。（例：Schmidhuber (1987)，引用号 257，标题含 the meta-meta-… hook）

### 风险 / 挑战 / 防护

- 完全开放式的递归自我改进（fully open-ended recursive self-improvement）仍是论文明确承认的 grand challenge，尚未实现；当前所有系统都只是「有边界、可验证的循环」（bounded, verifiable loops）
- 必须有验证器 V 作为门控：单元测试、回归套件、安全检查通过（V=1）才接受新版本，否则整体回滚到旧版本 Σ_t。这是本节唯一被形式化写进公式（式 25）的安全机制
- 自改代码必须在受控执行环境中运行——论文明确把 exec 的环境限定为解释器 / 编译器 / 沙箱（sandbox），即隔离执行是前提
- 图灵完备带来的搜索空间「原则上只受计算的理论极限约束」，自指回路可能发现人类未预料到的更新策略（unanticipated update strategies）。论文把它当作能力优势陈述，但这同时是不可预测性与失控风险的直接来源
- 自指更新意味着改进器本身也在随被改进的智能体一起演化（I_{Σ_t} 的下标即强调此点），监督与评估的对象在持续漂移，无法用一个固定的外部元优化器来兜底
- 现有系统之所以安全，靠的是外部约束而非内在保证：论文反复强调它们运行在「人类设计的目标、基准与安全协议」（human-designed objectives and safety protocols、defined objectives, benchmarks, and safety protocols）之内
- 第 6 章导言补充的通用防护：系统需维护版本历史（version history），以支持对有害修改（harmful modifications）的验证与回滚；且全脚手架方法相比组件级编辑需要「更强的接受测试」（stronger acceptance tests）
- 干预深度最大意味着爆炸半径最大：6.4 允许同时改写感知、推理、执行的整合方式，天然包含（subsume）前三节所有组件级编辑，一次错误更新可波及整个系统

### 科普叙事素材（金句/比喻/例子）

- 【全节最核心的比喻】「可变基质」——mutable substrate。前面几节的 AI 只是换衣服（改提示词）、换记忆、换工具；到 6.4，AI 把自己的整份源代码当成一团可以随手捏的黏土。原文：the agent treats its entire operational logic and codebase as a mutable substrate。视频里可直接用「改零件 vs 改骨架」来讲。
- 【最有冲击力的设定】改进程序本身就住在被改的那栋房子里。论文原话强调 the improver can evolve together with the agent it improves（改进器会与它所改进的智能体一同进化）。画面感说法：一边在船上修船，而且你手里的扳手也在跟着变形。
- 【最适合做震撼点的边界句】自改进智能体能探索的策略空间，bounded in principle only by the theoretical limits of computation——原则上只受「计算的理论极限」约束。不是被工程能力限制，是被数学限制。
- 【最适合泼冷水收尾的金句】论文自己踩刹车：完全开放式的递归自我改进仍是 a grand challenge，现有系统只是把这个概念做成了 bounded, verifiable loops（有边界、可验证的循环）。这句可以直接反驳「AI 已经在自己进化了」的耸动说法。
- 【最好懂的安全机制画面】式 25 的验证器 V 就是一个「撤销键」：AI 每次给自己动完手术，新版本必须先在沙箱里跑单元测试、回归套件和安全检查；V=1 才生效，不合格就当场恢复原样（otherwise 保留 Σ_t）。观众记忆点：AI 不能自己说自己改好了，得考试通过才算数。
- 【历史彩蛋，普通观众会「哇」】这事不是 2025 年才有人想。Schmidhuber 在 1987 年就写过自指程序搜索的论文，标题里赫然写着 the meta-meta-… hook——「学习如何学习」的元-元-……钩子。近四十年前就有人在琢磨让程序改进自己。
- 【最形象的技术设定】Agent Symbolic Learning 把语言智能体看成一张 symbolic network（符号网络）：它的「权重」不是数字，而是提示词和工具；然后用自然语言写的「损失」和「梯度」跑一遍反向传播。等于把深度学习那套训练流程原样搬到文字上——AI 用大白话给自己算梯度。
- 【最有画面感的演化机制】Darwin Gödel Machine 不走直线，它维护一个 archive（档案库），长成一棵不断扩张的智能体树，多条路径并行探索。像物种谱系树：当下看着最弱的那一支，可能几代之后成为突破口。适合配演化树动画。
- 【最好用的生物学梗】Huxley-Gödel Machine 借赫胥黎的 clades（演化支）概念，提出 CMP（clade-level metaproductivity）指标：不看单个后代强不强，看整支血脉的「元生产力」。可以讲成「不选眼下考第一的孩子，选最可能生出学霸家族的那一支」——短期最优 vs 长期血脉。
- 【最容易被误解、需要讲清楚的一个】Live-SWE-Agent 被论文称为首个能在运行时 on the fly 持续自演化的实时软件智能体：不是训练完再部署，而是正在干活的过程中顺手改自己的工具组件。观众会记住「它是边上班边改简历」。
- 【一个很接地气的细节】ShinkaEvolve 专门设计了 novelty-based rejection sampling for code——基于新颖性的代码拒绝采样，就是为了防止 AI 反复生成大同小异的代码。可以讲成「AI 也会摸鱼交重复作业，所以得专门治它」。
- 【章节结构本身就是好脚本】6.1 改提示词 → 6.2 改记忆 → 6.3 改工具 → 6.4 改整个自己，论文明说是按「架构干预深度递增」排的。四级递进天然是视频的四段式结构，而且导言补充这四类是可组合的、6.4 天然包含前三类，最后一层是「全都要」。
- 【学名与野心的反差】AlphaEvolve 的定位不是聊天助手，而是 a coding agent for open scientific problems——为开放科学问题服务的编码智能体，靠评估器反馈迭代改算法来加速科学发现。这点可以用来打破「自我改进 = 聊天机器人变聪明」的错觉。


## 7 7 Applications（应用领域）

本节是全文分类法的落地检验：前几节按"改什么"（FM 参数 θ vs. scaffolding）与"什么信号驱动更新"来组织自我改进方法，本节则考察这些机制在六个代表性领域中的真实形态。开篇给出贯穿全节的共同模式——自我改进都依赖沙箱化或受控环境，它们"在提供反馈的同时限制失败成本"：SWE 靠编译器、单测与 CI；Web 自动化靠模拟或插桩浏览器；游戏靠可重置且规则明确的引擎；科学发现靠可执行工作流、领域工具与模拟器；具身智能靠机器人模拟器加有限真机 rollout；通用计算机控制靠虚拟桌面或隔离操作系统。环境的保真度、可扩展性与成本，进而决定了各领域的主导瓶颈、改进目标与迭代模式（Table 5 汇总六个领域的"沙箱/学习信号/主要瓶颈/主要改进目标/迭代模式/代表系统"，Figure 11 配图）。

六个小节结构高度对称，几乎都按"评测基座 → scaffolding 改进 → FM 改进 → 综合与开放挑战"四段展开。7.1 SWE 因反馈最稠密、最可自动化而成为最佳试验场，并特意区分"评测环境"与"自我改进方法"：SWE-bench 只是基座，SWE-agent、Agentless 按本文定义只算非自我改进基线（它们在单个任务实例内迭代，但默认不做跨交互的持久更新）；SWE 的独特性在于"agent 本身就是软件"，因而可直接改写自身源码。7.2 Web 的难点是动态、长程、弱验证：页面频繁变化、同一意图可由不同 DOM 实现、失败常到轨迹末端才暴露，因此一次性 prompt 工程很脆，必须靠跨任务持续的改进回路。7.3 游戏提供可重复交互、目标明确、可规模化的反馈与 self-play 闭环，是最干净的实验场，却也最早暴露"脆弱的强"与多智能体非传递性。7.4 科学发现先追溯到早期"人工科学家/人工好奇心"传统（发明信息量大的实验、降低不确定性、最大化学习进展与信息增益），当代分为"工具增强的研究循环"与"端到端科研编排"两路；因环境跨子领域碎片化、工具与数据格式异构、反馈延迟昂贵甚至只能部分自动化，该领域的自我改进更多表现为"跨项目累积可复用工件的研究工作流"，而非单次回答级纠错。7.5 具身智能面临连续状态与动作空间、部分可观测、安全攸关探索与 sim-to-real 差距，改进常表现为开放式技能获取。7.6 通用计算机控制比 Web 更宽，需操控文件、窗口、对话框、快捷键与跨应用工作流，核心难点是环境多样性（必须适应没见过的软件与界面惯例），自我改进被定义为"习得从交互中学会新应用的可复用程序"。

内部逻辑上，论文反复回到同一组张力：scaffolding 改进快、模块化、模型无关，但易过拟合到具体基准工具链、网站或仓库约定；FM 改进能把技能内化进参数、迁移更广，却更昂贵，也更易受 reward hacking 与评测伪影侵蚀。各节末尾的"综合与挑战"因而收敛到同一处方——漂移感知/群体化/跨本体的评测（如基准变异与压力测试、对抗非传递性的种群化评测），把安全探索与不可逆动作分离的沙箱协议，以及只在"确实能跨验证器与基准协议迁移"时，才把 scaffold 层发现蒸馏回基座模型的混合回路。末尾还把通用计算机控制的问题接回早期"自修改策略的元强化学习"——智能体在终身试验中收集自身修改所带来长期效果的统计量。

### 代表方法

- **SWE-bench**：标准化评测基座，不是自我改进方法。它把真实 GitHub issue、仓库快照和基于测试的验证打包成统一套件，让「进步」变成可量化的数字。论文强调必须把这类评测环境和真正的自我改进方法区分开。（例：引用 (137)，另有 (53; 8; 378) 等后续衍生基准）
- **SWE-agent / Agentless**：按本文定义属于「非自我改进基线」：它们能在单个任务实例内部反复试错迭代，但默认不会把学到的东西持久写回模型参数 θ 或 scaffolding。它们的意义是方法论上的——证明了 scaffold 设计本身能大幅影响性能，从而引出「scaffold 能否自动改进而非手工调参」这一问题。（例：SWE-agent (377)，Agentless (360)）
- **Darwin Gödel Machine (DGM)**：把「agent 本身就是软件」这一点用到极致：它迭代地重写自己的代码库，把每个候选修改放到编码基准上验证，验证通过的就保留下来，最终生成一棵不断改良的「后代树档案」（tree archive of improved descendants）。相当于对自身源码做进化搜索。（例：引用 (407)；Table 5 中列为 SWE 领域代表 DGM(2025)）
- **Huxley–Gödel Machine (HGM)**：在 DGM 的自修改范式上更进一步：搜索自修改空间时不看当前这一版跑分多高，而是估计它的「后代性能」，目标是优化长期改进潜力，而不只是眼前的基准收益。类似于下棋时看的是局面潜力而非当下吃子。（例：引用 (333)；Table 5 列为 HGM(2025)）
- **Live-SWE-agent**：把 scaffold 改进从「离线搜索」搬到「运行时自我演化」。它从一个极简 scaffold 起步，在真实解 SWE 任务的过程中当场编辑并扩展自己的 scaffold，于是当前这个 issue 的经验能直接影响未来的行为。（例：引用 (361)；Table 5 列为 Live-SWE-agent (2025)）
- **SE-Agent**：一种轨迹级（trajectory-level）机制：对多条解题轨迹做交叉修订、重组与精炼（cross-trajectory revision, recombination, refinement），借此跳出推理与动作序列的局部最优。（例：引用 (102)）
- **SWE-RL**：FM 改进路线：把强化学习规模化到真实软件工程任务上，用软件演化数据（software-evolution data）加可执行信号（测试通过与否）当奖励来更新底层模型参数。（例：引用 (346)；相关工作 (92) 研究长上下文、多轮 SWE 场景下的 RL）
- **SWE-RM**：针对「执行式奖励稀疏、有噪、昂贵」（flaky test、覆盖不全、环境搭建成本高）的问题，用奖励模型打分来替代或补充单元测试，并分析哪些 verifier 属性真能迁移成 RL 上的改进。属于「免执行反馈」。（例：引用 (282)）
- **Curiosity-driven test generation**：不改 agent 而是强化「信号源」本身：用好奇心驱动的规划引导 LLM 去生成能触达未充分探索行为的测试用例，从而把可执行反馈这把尺子做得更密更准。（例：引用 (9)）
- **Mind2Web**：Web 领域的数据基座：提供真实网站上多样化的指令跟随轨迹，支撑监督学习或模仿学习作为自我改进的起步阶段。（例：引用 (54)）
- **WebArena / VisualWebArena / WorkArena / BrowserGym**：一组 Web 评测基座。WebArena 提供可自托管、长程、以执行结果判定成败的环境；VisualWebArena 把评测扩展到视觉落地的网页任务，专门暴露感知与 grounding 的失败；WorkArena 针对企业级工作流，凸显 agent 与日常知识工作自动化之间的差距；BrowserGym 则统一各家 web-agent 基准，减少实验碎片化。论文强调它们本身不是自我改进方法，而是研究改进所必需的数据与度量底座。（例：WebArena (430)、VisualWebArena (145)、WorkArena (64)、BrowserGym (63; 51)）
- **SeeAct**：把视觉理解与动作 grounding 耦合起来，直接在真实网站上执行，降低长程执行中「选错元素」这类脆弱的动作选择。（例：引用 (425)）
- **WebCoach**：论文认为它最贴近自我改进：给浏览 agent 配上跨会话记忆（cross-session memory），这份记忆由新产生的轨迹持续策展维护，于是 agent 不用重训基座模型就能避免重复犯同样的错。（例：引用 (169)）
- **ReAP**：存储并复用对成功与失败轨迹的反思（reflections），把这些反思带进后续的网页导航任务中，属于「更新记忆内容与检索策略」的 scaffolding 改进。（例：引用 (15)）
- **OpenWebVoyager**：在真实网站上做「探索—反馈」循环：多轮迭代中不断筛出高质量轨迹来改进自身策略。（例：引用 (108)）
- **WebRL**：引入自我演化的在线课程（self-evolving online curriculum）——从失败中生成新任务，再配合以结果为监督的奖励建模，用于长程浏览器控制的 RL 训练。（例：引用 (217)；Table 5 列为 Web 领域代表 WebRL(2025)）
- **WebAgent-R1**：用端到端多轮强化学习训练网页 agent，奖励极简——二元的成功/失败信号，在 WebArena-Lite 上报告了提升。（例：引用 (347)）
- **Agent Q**：同时从成功和失败的轨迹中学习，证明这类经验能提升多步网页交互中的泛化能力。（例：引用 (215)，在 WebShop 环境中研究）
- **SPAG**：用一个双人对抗游戏来训练语言模型，通过 self-play 强化学习改进策略。（例：引用 (42)；Table 5 列为游戏领域代表 SPAG(2025)）
- **SPIRAL**：研究多轮零和 self-play，证明「自己跟自己竞争产生的交互」本身就能提供可规模化的推理改进信号——完全不需要人工标注数据。（例：引用 (168)）
- **SCO-PAL**：在对抗性游戏套件中，用游戏交互数据做步级（step-level）策略优化，并识别出 self-play 是一种有效的「对手选择」策略。（例：引用 (416)）
- **MARSHAL**：面向多智能体 self-play 的端到端强化学习框架，覆盖合作型与竞争型策略游戏，并报告了从游戏迁移到多智能体推理基准的能力。（例：引用 (389)；Table 5 列为 MARSHAL (2025)）
- **DipLLM**：在《外交》(Diplomacy) 这类重谈判环境中做微调，训练面向均衡的策略，为「语言中介的战略互动」提供参数级更新路径。（例：引用 (370)；Table 5 列为 DipLLM(2025)）
- **SPRL**：针对高方差收益的复杂策略游戏，用 self-play 收益做奖励塑形（reward shaping）来稳定训练。（例：引用 (216)）
- **Voyager**：scaffolding 改进的范本：在 Minecraft 中维护一个不断扩张的可执行技能库，外加一个跨任务持久存在的自动课程（automatic curriculum），让 agent 自己决定下一步该学什么。（例：引用 (325)）
- **Odyssey**：沿 Voyager 方向扩展，构建结构化的开放世界技能库，并加入「规划者—评论者」(planner–critic) 回路，通过技能复用与前置条件检查改善长程执行。（例：引用 (172)）
- **Skill Set Optimization (SSO)**：从交互轨迹中抽取高回报的子轨迹，把它们转化成可迁移的技能，并主动剪掉无效技能，从而在类游戏环境中实现持续的上下文内策略改进。（例：引用 (197)）
- **ExpeL**：agent 累积经验，把经验蒸馏成自然语言形式的「教训」(lessons)，之后作为上下文内示例复用于后续决策。全程不动模型权重。（例：引用 (418)）
- **Richelieu**：在重谈判的策略游戏中，跨 self-play 交互维护记忆与反思，用累积经验修订规划与谈判行为，而不需要每一步都更新权重。（例：引用 (100)；Table 5 列为 Richelieu(2024)）
- **ChemCrow**：让语言模型去调度一大批化学专业工具，以提升可靠性与能力覆盖面。论文特别指出一个定义边界：只有当它的工具库或工具选择策略是跨任务被更新的时候，ChemCrow 才算「自我改进」。（例：引用 (185)）
- **SciAgents**：强调结构化知识与多智能体角色分工，用本体图（ontological graphs）加原位学习（in-situ learning），在碎片化的文献与数据源之间精炼科学假设。（例：引用 (89)；Table 5 列为 SciAgents(2024)）
- **HoneyComb**：更接近显式的 scaffold 演化：它自己构建并精炼领域工具，同时维护一个经过策展的科学知识库——这些更新正对应工具层与检索策略的结构性改变。（例：引用 (406)）
- **The AI Scientist / AI-Scientist-v2**：端到端科研编排流水线：生成想法 → 写代码并调试 → 跑实验 → 分析结果 → 起草论文，整个链条由内部批评（internal critique）与实验结果驱动反复精炼。（例：引用 (178; 373)；Table 5 列为 The AI Scientist (2024)、AI-Scientist-v2 (2025)）
- **AI co-scientist**：多智能体辩论与演化，且对齐到科学家给定的目标与约束上。它的「改进」体现为在证据追踪下产出更强的假设提案，而不是优化 next-token 似然。（例：引用 (95)；Table 5 列为 AI co-scientist (2025)）
- **Self-driving laboratories / 闭环实验设计**：参数级改进的成熟模板：迭代做实验 → 用结果更新对目标景观（objective landscape）的内部模型 → 该模型再指导下一批实验该怎么做。（例：引用 (316)）
- **Coscientist**：把网络搜索、代码执行与实验室自动化整合起来，用于设计、规划并真正运行化学实验。（例：引用 (24)）
- **ORGANA / LLM-RDF**：展示以 LLM 为中心来编排实验工作流与面向仪器的动作，为「当实验成败信号能被形式化时，从中学习」开辟了路径。（例：引用 (49; 242)）
- **RLBench / ManiSkill2 / Meta-World / Isaac Gym**：具身领域的评测与训练基座。前三者让不同改进回路能在仿真中做受控对比；Isaac Gym 这类高吞吐模拟器则大幅降低迭代成本，支撑大规模训练与消融。（例：RLBench (133)、ManiSkill2 (98)、Meta-World (388)、Isaac Gym (188)）
- **RoboCat**：「数据飞轮」的典型：先训练一个多任务、多本体（multi-embodiment）的操作策略，再用这个训好的策略去生成更多数据，喂给下一轮训练，如此自我滚雪球。（例：引用 (28)；Table 5 列为 RoboCat(2023)）
- **MEDAL++**：近乎全自主的强化学习回路：让机器人同时学会「做任务」和「撤销任务」，于是不需要人来手动复位现场，可以无休止地自己练下去，在极少人类监督下提升成功率。（例：引用 (276)）
- **AutoRT**：用基础模型去提出多样化的指令，并在真实世界中调度成队的机器人（orchestrate robot fleets in the wild），大规模采集真实交互数据供后续策略改进。论文指出：当它的指令提案策略、风险过滤器与编排逻辑本身被迭代精炼（以提高覆盖率同时控制安全违规）时，它也可以视作 scaffold 级改进。（例：引用 (6)，在 FM 改进与 scaffolding 改进两段中被双重解读）
- **Robot-Powered Data Flywheels**：把「部署」本身形式化为持续的数据采集加基础模型适配过程，用机器人在真实野外产生的数据来改进其视觉—语言组件。（例：引用 (97)）
- **Self-Improving Embodied Foundation Models**：提出一套后训练配方，用经过塑形的成功检测器（shaped success detection）支撑机器人自主练习与技能获取，突破单纯模仿数据的上限。（例：引用 (90)）
- **RoboGen**：生成式仿真范式：自动生成任务、场景与监督信号，等于让课程与数据生成过程本身跨迭代不断演化。（例：引用 (340)）
- **RACAS**：通过一个结构上自我管理的记忆（structurally self-managed memory）来累积机器人控制方面的具身知识。（例：引用 (13)）
- **OSWorld / WindowsAgentArena / OSWorld-MCP**：通用计算机控制的评测基座。OSWorld 提供真实计算机环境，支持跨操作系统的任务初始化与自动评分；WindowsAgentArena 聚焦 Windows 并支持可扩展的 OS 级评测；OSWorld-MCP 把评测从 GUI 动作扩展到 Model Context Protocol 下的工具调用能力。（例：OSWorld (363)、WindowsAgentArena (25)、OSWorld-MCP (135)）
- **Agent S**：经验增强的分层规划：持续更新记忆并对过往轨迹做检索，靠可复用的「程序性知识」实现跨任务收益；只要记忆与检索策略跨交互保持维护，就能在不同 OS 基准之间迁移。（例：引用 (3)）
- **SEAgent**：强调自主掌握全新软件：自己生成由简到繁的课程，并用一个世界状态模型（world-state model）做逐步的轨迹评估。这些组件构成了通过任务生成、评估启发式与可复用探索例程实现的 scaffold 演化。（例：引用 (306)）
- **UI-Genie**：自我改进流水线，让 agent 与奖励模型共同演化（co-evolve），用奖励引导的探索同时解决「结果如何验证」和「数据如何规模化生成」两个问题。（例：引用 (362)；Table 5 列为 UI-Genie(2025)）
- **GUI-Reflection**：通过迭代式的在线反思微调（online reflection tuning）来训练自我反思与纠错能力，把失败本身转化成后续参数更新的监督信号。（例：引用 (352)；Table 5 列为 GUI-Reflection (2025)）
- **SEA**：提出可验证的轨迹生成加逐步（step-wise）强化学习，用于长程的计算机使用训练。（例：引用 (43)；Table 5 列为 SEA(2026)）
- **ComputerRL**：研究在 OSWorld 上持续做端到端在线强化学习，并引入交替训练阶段（alternating training phases）来缓解长时间 RL 中的优化病态。（例：引用 (147)）
- **PC Agent-E**：用一个很小的种子集合加上合成的动作决策，来大幅减少对大规模人类演示的依赖，提供一条经济的迭代式策略改进路线。（例：引用 (109)）
- **Table 5 中仅以代表系统出现（本节正文未展开）**：论文在 Table 5 的「Exemplars」列还点名了若干系统作为各领域代表，但第 7 节正文未逐一描述其机制，引用时需注意：SWE 的 AgentDevel (2026)；Web 的 WebEvolver (2025)、SkillWeaver (2025)、WebRollback (2026)；具身的 SOAR (2024)、SInViG (2024)、REMAC (2025)、SEEA-R1 (2025)；通用计算机控制的 OS-Copilot (2024)。其中 WebEvolver（训练共同演化的世界模型预测下一个网页观测，用模拟 rollout 来精炼策略）与 SkillWeaver（把交互蒸馏成可复用的网页工具，并用执行反馈持续打磨）的机制描述出现在本综述的其他章节。（例：Table 5: Application arenas viewed as self-improvement loops）

### 风险 / 挑战 / 防护

- 【SWE】scaffolding 改进虽快、模块化且模型无关，但可能过拟合到基准工具链、仓库惯例或交互协议；FM 改进能内化技能、迁移更广，却更昂贵，也更容易受 reward hacking 与评测伪影侵蚀。论文的处方是：用基准变异（benchmark mutation）与压力测试来对抗「针对基准的搜索」和 verifier 过拟合，并只在 scaffold 层的发现确实能跨越固定 verifier 或基准协议迁移时，才把它蒸馏回基座模型。
- 【SWE】执行式奖励本身不可靠：flaky test（不稳定测试）、覆盖不全、环境搭建昂贵，都会让奖励变得稀疏、有噪或代价高昂。
- 【Web】非平稳性（non-stationarity）与弱可观测性是核心风险：页面布局与交互流程会随时间改变，在静态快照上量出的收益很快就会失效，因此需要「漂移感知」(drift-aware) 的评测。
- 【Web】scaffolding 改进容易过拟合到特定网站；更严重的是它会放大安全风险，包括 prompt injection（提示注入）与意料之外的高影响动作。需要用沙箱协议把安全探索与不可逆动作分离开。
- 【Web】FM 改进依赖稳定的训练信号，还必须小心处理过期数据（stale data）。
- 【游戏】self-play 会造就「脆弱的能力」(brittle competence)：系统可能只是学会了钻模拟器的空子，或只对一个狭窄的对手分布有效，一旦对手群体变化或规则改变就崩掉。
- 【游戏】多智能体设定下改进可能是非单调的，「战略循环」(strategic cycling) 让进步难以度量；只拿固定的一组对手来评测会给出误导性结论，需要能刻画非传递性（non-transitivity）的种群化评测。
- 【游戏】语言中介的策略引发额外的安全担忧——说服（persuasion）与欺骗（deception）。仅靠输赢目标无法约束这些行为，必须为语言交互加上显式约束。
- 【科学发现】评测难题：系统无法自己可靠地验证新颖性、正确性与可复现性，看似的「进步」可能只是在利用弱代理指标（weak proxies）。
- 【科学发现】异构性下的证据管理：改进必须能跨越不同工具、数据格式与快速演变的文献而保持有效，因此稳定的 scaffold 演化和策略学习同等重要。
- 【科学发现】安全与治理：实验动作可能是不可逆的甚至危险的；当证据薄弱时，科学写作还会放大错误信息。需要以可复现性为中心的评测、证据追踪、标准化实验与计算协议，以及在 agent 提出或执行真实世界科学动作时能兜底的治理机制。
- 【具身智能】安全、非平稳性与硬件成本三重约束：真机会有传感器漂移、罕见但严重的故障，以及不可逆动作，这些都限制了简单的试错策略。
- 【具身智能】sim-to-real 差距：仿真能支撑大规模训练，但仿真里取得的改进往往难以迁移到真实平台，需要专门为迁移设计的课程学习与数据采集策略。
- 【具身智能】评测困难：有些「改进」可能只是针对特定基准找到的捷径；真实部署条件还会因实验室与平台而异，因此需要跨本体（cross-embodiment）的评测实践来区分真正的技能获取与基准过拟合。
- 【通用计算机控制】安全是核心关切：agent 可能删除文件、输入密码，或发起金融交易。任何改进过程都必须内置防护与保守的恢复策略。
- 【通用计算机控制】验证困难：SWE 里单元测试能给出清晰反馈，而这里的成败可能取决于操作系统状态、外部账号或用户特定上下文。
- 【通用计算机控制】迁移难题：agent 需要学会新应用，而不能过度依赖表层 UI 模式，这要求探索策略与课程去鼓励形成「程序性抽象」。

### 科普叙事素材（金句/比喻/例子）

- 【全节主线，最适合开场】沙箱的本质是「既给反馈，又兜住失败成本」。原文："a common pattern is the use of sandboxed or otherwise controlled environments that provide feedback while limiting the cost of failure." —— 可以类比成给 AI 造一个「摔不坏的练功房」：编译器和单元测试是程序员的练功房，游戏引擎是棋手的练功房，机器人模拟器是身体的练功房。
- 【最有冲击力的一句，SWE 段】"A distinctive feature of SWE is that the agent itself is software, which makes direct scaffold or source-code modification feasible." —— 软件工程之所以特殊，是因为 agent 自己就是软件，所以它可以直接动手改自己的源代码。这是普通观众最容易被震到的点：一个程序在重写它自己。
- 【进化树的画面感】Darwin Gödel Machine 反复重写自己的代码库，每个候选改动都要在编码基准上过一遍验证，最后长出一棵「不断改良的后代树档案」。原文："iteratively rewriting its own codebase and validating candidate modifications on coding benchmarks, producing a tree archive of improved descendants." —— 视觉上就是一棵会自己发芽的家谱树。
- 【「看后代潜力而不是眼前分数」】Huxley–Gödel Machine 搜索自修改空间时用的是对后代性能的估计，"aiming to optimize long-term improvement potential rather than only immediate benchmark gains." —— 可以类比成家长择校：不看孩子这次考了多少分，而看这条路往后十年能走多远。
- 【边干活边改造自己】Live-SWE-agent 从一个极简 scaffold 起步，"the agent edits and extends its own scaffold while solving real SWE tasks, so the current issue can inform future behavior." —— 像一个修车师傅，在修车的过程中顺手把自己的工具箱也改造了，下次修得更快。
- 【机器人「学会撤销」】MEDAL++ 让机器人同时学会做任务和撤销任务："the robot learns to both perform and undo tasks, enabling reset-free practice." —— 这个画面极强：机器人把积木搭好，再自己拆掉，然后重来一遍，不需要人类过去帮它复位，于是可以彻夜不停地自己练。
- 【机器人舰队在野外】AutoRT 用基础模型提出多样化指令，并 "orchestrate robot fleets in the wild" 来大规模采集真实交互。—— 「野外的机器人舰队」这个说法本身就很有画面。
- 【数据飞轮】RoboCat 先训出策略，再用这个策略去生成更多数据喂给下一轮训练——论文称之为 "a data flywheel across interactions"。飞轮是个非常好用的科普比喻：推动一次很费劲，转起来之后越转越快。
- 【Minecraft 里的技能树】Voyager 在 Minecraft 中维护一个不断扩张的可执行技能库和一个跨任务持续的自动课程（"an expanding library of executable skills and an automatic curriculum that persists across tasks"）。—— 玩过游戏的观众一秒就懂：这就是 AI 在给自己点技能树、给自己排作业。
- 【「脆弱的强」，最反直觉的一段】"Self-play can create brittle competence. A system may exploit a simulator or a narrow opponent distribution. It may then fail when the population shifts or when the rules change." —— 自己跟自己下棋练出来的强，可能只是「专治这一种对手」。换个人来就露馅了。
- 【石头剪刀布式的非传递性】"In multi-agent games, improvement may also become non-monotonic. Strategic cycling can make progress difficult to measure." 而且 "Evaluation against a fixed set of opponents may therefore give a misleading view of performance." —— 可以直接用石头剪刀布解释「进步」在多智能体里为什么不是一条向上的直线。
- 【AI 会说服和欺骗】"Language-based strategy raises further safety concerns. These concerns include persuasion and deception. Win-loss objectives alone cannot govern such behaviors." —— 一句话点出：你只教它「赢」，它就可能学会骗人；输赢这个目标本身管不住这件事。
- 【看起来变强，其实是学会了钻空子】科学发现段的金句："Apparent improvements may instead reflect the exploitation of weak proxies." —— 这是整节最适合做「反转」的一句，配合 SWE 段的 flaky test（不稳定测试）一起讲效果最好。
- 【实验室里的不可逆】"Experimental actions can be irreversible or hazardous. Scientific writing can also amplify misinformation when the evidence is weak." —— 代码写错了可以回滚，试管打翻了不能回滚；而且 AI 写论文还会把弱证据放大成看似确凿的结论。
- 【最能吓到普通观众的一句，通用计算机控制段】"Safety is a central concern because an agent may delete files, enter passwords, or initiate financial transactions." —— 删文件、输密码、发起转账。这三件事一列出来，观众立刻明白为什么「让 AI 自己操作电脑」需要护栏。
- 【「谁在改进」的定义边界，很适合讲清概念】论文对 ChemCrow 的判定："Under our definition, ChemCrow becomes self-improving when its tool repertoire or selection policy is updated across tasks." —— 会用工具不算自我改进，能跨任务更新自己的工具箱和选工具的方式，才算。同理，SWE-agent 和 Agentless 虽然很能干，但按本文定义只是「非自我改进基线」，因为它们在一个任务里折腾完就忘了。
- 【长程任务的残酷之处】Web 段："failures often become visible only late in a trajectory." —— 错在第三步，第五十步才发现。这解释了为什么网页 agent 特别难训。
- 【网页会变，成绩会过期】"Page layouts and interaction flows often change over time. These changes can quickly weaken gains that were measured on static snapshots." —— 你在去年的网页快照上刷出的高分，今年可能一文不值。
- 【终身自我修改的元学习，适合做结尾升华】第 7 节最后把问题接回早期研究：agent "adapted by collecting long-term statistics about the effects of their own modifications during a lifelong trial" —— 在一场终身的试验中，统计自己每一次改动带来的长期后果。这句可以作为整期视频的收尾。
- 【一句话讲清全节结构】六个领域，六种练功房，但都在回答同一个问题：改模型的脑子（FM improvement），还是改它的工作方式（scaffolding improvement）？论文的总结论很平衡——改工作方式快、便宜、换个模型也能用，但容易「只在这一题上变强」；改脑子能真学会、迁移广，但贵，而且更容易学歪。


## 8 Evaluation（评测：如何度量自我改进）

第8节回答"怎么度量自我改进"。开篇立论：智能体既可能改基础模型参数 θ，也可能只改脚手架 Σ（提示、记忆、工具、编排逻辑），因此评测必须把改进视为随时间展开的过程，并把真实能力增长与改进流水线自身制造的假象分开；要让不同研究的改进声明可比，协议须交代四件事：什么跨交互持久化、哪些反馈信号驱动更新、什么运行预算约束智能体、真实能力迁移的边界画在哪。

8.1 先做形式化：第 t 轮配置 A_t=(θ_t, Σ_t)，在累计预算 b_t ≤ B_max 下追踪性能轨迹 m_t = E_{x~D_eval, τ~A_t(x)}[Φ(x,τ)]（式26）。评测器 Φ 的两种实例化构成全节主线：Φ_metric 是确定性可执行评测（如生成代码过不过单元测试，取值 0/1），客观但只适用于有形式化成功标准的任务；Φ_judge 是参数化评测，依赖评分细则 κ 与辅助模型 θ_judge（LLM-as-a-Judge），能评开放式长程任务，代价是可能"向裁判的隐性偏好过拟合"。8.1.1 给出五条指标式报告规范：固定预算下报完整轨迹而非峰值（须定 checkpoint、验收标准、早停规则，并跨多随机种子报均值与方差，因为记忆与代码补丁的累积对初始化极敏感）；在与优化数据不重叠的留出分布上测迁移（隐藏题集、时间平移评测两道防线）；透明拆解算力/token/墙钟时间成本并量化人类介入的规模与形式；追踪目标漂移、奖励黑客、记忆与工具的复合误差，报告回归率、尾部风险与安全违规而非只报平均成功率；最后汇总推荐报告项。8.1.2 面向无可执行 oracle 的任务，评测者可以是普通 LLM 或自主的 Agent-as-a-Judge 流水线，须加两条护栏：其一公开裁判身份与参数（模型版本、提示、rubric、暴露给裁判的环境证据），并把裁判预算与智能体执行预算分开计；其二禁止同一个 Φ_judge 既驱动更新又汇报终评，终评应换更强模型 θ'_judge 或正交 rubric κ'，辅以重复运行方差、多裁判聚合、以及在可验证子集上用 Φ_metric 或人工复核做校准。

8.2 按两个正交属性组织基准：更新通道（改 θ 还是只改 Σ）与评测界面（单轮输入输出 vs 多步交互）。图12 用"论文–基准"关联矩阵呈现：行按界面分为脚手架级（交互、以智能体为中心）与 FM 级（静态、以模型为中心），列为代表性方法并以颜色标注改进机制。8.2.1 机制基准中，FM 级重点防灾难性遗忘与训练数据泄漏，强调来源追踪、数据隔离、跨邻近任务族的保持性审计，偏好可执行与仓库级评测；脚手架级要求组件隔离——提示策略要在改写、格式变化与长上下文下测稳健性，记忆要测长程召回、跨模态与多方一致性以及抗投毒、越权泄露、主动遗忘失败，工具要测调用、选型与参数落地；再以消融、固定环境的回放式 rollout 与回归检查完成机制归因。8.2.2 领域基准逐域规定反馈信号、允许的更新通道、预算与严格留出集，覆盖软件工程、Web 导航与自动化、博弈与策略推理、科学发现、具身智能、通用计算机控制六个领域。全节结论：评测须从静态零样本打分转向连续追踪。

### 代表方法

- **Metric-Based Measurement (Φ_metric)**：确定性、可执行的评测器：不靠任何模型判断，直接跑程序验证结果对不对，输出 0 或 1。优点是客观、可复现、能做细粒度回归检测；缺点是只能用在有形式化成功标准的任务上。（例：软件工程中，Φ_metric(x,τ)∈{0,1} 直接检查执行轨迹 τ 里生成的代码是否通过任务 x 定义的程序化单元测试。）
- **Judge-Based Measurement (Φ_judge / LLM-as-a-Judge)**：参数化评测器：给一个辅助模型 θ_judge 一份评分细则 κ，让它把复杂的长程执行轨迹和中间产物翻译成结构化分数，写作 Φ_judge(x, τ, κ; θ_judge)。它只是对'人类对齐的真实目标'的近似，因此会带来智能体讨好裁判的新漏洞。（例：用于开放式、部分可观测、无法写出单元测试的任务评测。）
- **Agent-as-a-Judge**：不用单个 LLM 打分，而是让一整个自主智能体流水线充当裁判：它可以自己调工具、查环境证据、多步推理后再给分，因此能评价长程轨迹和中间产物。论文引用了 Zhuge et al. (Agent-as-a-judge: evaluate agents with agents) 与 You et al. 2026 两条线。（例：§8.1.2 中作为 Φ_judge 的一种实现形态被点名。）
- **Evaluation Agent**：面向视觉生成模型的高效、可提示（promptable）评测框架——把评测本身做成一个可以按需下指令的智能体，而不是固定的打分脚本。（例：Zhang et al. 2025b，§8.1.2 判官型评测器示例。）
- **EvalAgent**：从网络上自动挖掘'隐含的评价标准'：人类在网上讨论一件事做得好不好时其实埋着很多不成文的标准，该系统把这些标准抽出来变成可用的 rubric。（例：Wadhwa et al. 2025，§8.1.2。）
- **VerifiAgent**：统一的验证型智能体：专门对语言模型的推理过程做校验，属于把'验证'独立成一个角色的思路。（例：Han et al. 2025，§8.1.2。）
- **Hidden Evaluation（隐藏评测）**：用私有、从未公开发布的题集来测，让智能体无从在改进过程中提前见到答案，从而防止它对改进流程本身过拟合。（例：§8.1.1'测超出改进信号的迁移'一段给出的两道防线之一。）
- **Temporally Shifted Evaluation（时间平移评测）**：专门用'诞生时间晚于基础模型知识截止日'的新题来考它——题目在模型训练完之后才被造出来，所以模型不可能背过。（例：§8.1.1 另一道防线，引用 ManiSkill2 与 GAIA。）
- **AgentGym**：跨多样环境演化 LLM 智能体的平台，被论文用作'固定预算下报告完整学习轨迹'这一规范的代表性参考。（例：Xi et al. 2024，§8.1.1 与 §8.2.2 都引用。）
- **SWE-bench**：仓库级真实 GitHub issue 解决基准：给智能体一个真实代码仓库和一个真实 issue，让它提交补丁，再用仓库自带测试判定成败——提供确定性可执行反馈。（例：Jimenez et al. 2024，软件工程域的代表平台。）
- **SWE-bench+**：SWE-bench 的抗泄漏加强版：论文强调它用于来源追踪与严格数据隔离，防止基础模型其实早就见过这些补丁而造成虚高分数。（例：Aleithan et al. 2024，§8.1.1（多种子复现）与 §8.2.1（FM 级评测）均引用。）
- **LoCoBench-Agent**：长上下文软件工程的交互式基准：强调智能体在庞大代码库中持续探索的能力，而不是一次性给出答案。（例：Qiu et al. 2025d，'压力测试持续探索'的交互式代码库。）
- **SWT-bench**：把'反馈机制本身'变成可被修改的对象：要求智能体自主生成并改进那些用来验证 bug 修复的单元测试——也就是自己写出驱动自我改进循环的考卷。（例：Mündler et al. 2024，测试与验证真实世界 bug-fix。）
- **TDD-Bench Verified**：与 SWT-bench 同类：考察 LLM 能否在问题被解决之前就为该问题写出测试（测试驱动开发），同样把评测信号的生成权交给智能体自己。（例：Ahmed et al. 2024。）
- **GitTaskBench**：考察代码智能体能否通过利用真实代码仓库来完成真实任务，被论文用作'可执行与仓库级评测提供客观检查与细粒度回归检测'的代表。（例：Ni et al. 2025，§8.1.1 成本核算与 §8.2.1 FM 级评测均引用。）
- **ShinkaEvolve**：面向开放式、样本高效的程序演化系统，被论文用在'必须透明拆解改进流水线成本'这一论点上。（例：Lange et al. 2026，§8.1.1 资源效率一段。）
- **WebArena / VisualWebArena**：受控的、基于执行判定的网页环境：把网站搬进可控沙箱，用程序化方式判定任务是否完成；VisualWebArena 进一步加入多模态视觉输入。（例：Zhou et al. 2024 / Koh et al. 2024，Web 域的受控执行式套件。）
- **Mind2Web**：面向真实网站的通用网页智能体基准，论文将其归为'迁移导向'一类——用于检验智能体是否真的会上网，而不是记住了某个页面布局。（例：Deng et al. 2023，§8.1.1 留出分布与 §8.2.2 Web 域均引用。）
- **WebCanvas**：在线真实环境中评测网页智能体，与 Mind2Web 同属迁移导向的真实网站套件。（例：Pan et al. 2024。）
- **WebLINX**：多轮对话式真实网站导航基准，论文用它支撑'必须在与优化数据不重叠的留出分布上测量'这一要求。（例：Lu et al. 2024c，§8.1.1。）
- **ST-WebAgentBench**：评测网页智能体的安全性与可信度，论文特别指出它对应'企业场景下持续改进时的策略合规性'——即智能体在不断自我改进的同时是否仍遵守规章。（例：Levy et al. 2026，§8.1.1 安全追踪、§8.2.2 Web 与领域通用要求均引用。）
- **WorkArena**：评估网页智能体处理常见知识工作任务的能力，论文用它支撑'人类介入的规模与形式必须量化'这一论点。（例：Drouin et al. 2024b，§8.1.1 监督量化一段。）
- **Clembench / Clembench-2024**：用对话式游戏来评测语言模型作为交互智能体，论文强调其'动态实例生成'——每次生成新局面，避免智能体背题。（例：Chalamalasetti et al. 2023 / Beyer et al. 2024，博弈域。）
- **GameBench**：评测 LLM 的策略推理能力，论文将其归为'头对头（head-to-head）鲁棒性评测'——让模型互相对打来检验强度。（例：Costarelli et al. 2024。）
- **LLM-Deliberation / GTBench**：带量化结果的谈判与博弈环境：LLM-Deliberation 用交互式多智能体谈判游戏评测，GTBench 揭示 LLM 在博弈论推理上的局限——两者都能给出可量化的胜负/收益数字。（例：Abdelnabi et al. 2024 / Duan et al. 2024。）
- **CORE-bench**：以'计算可复现性'为核心的执行式任务：能否把已发表研究的计算结果重新跑出来。论文还用它支撑'必须跨多随机种子报告方差'。（例：Siegel et al. 2024，§8.1.1 与 §8.2.2 科学发现域。）
- **AstaBench**：面向科研的严格智能体基准套件，论文归为'受控的研究型智能体套件'。（例：Bragg et al. 2026。）
- **PaperBench**：评测 AI 复现 AI 研究论文的能力，论文强调它'对迭代过程中的阶段性进展与复现质量分级打分'，而不是只看最终成败。（例：Starace et al. 2025。）
- **DiscoveryWorld / PhysGym**：模拟式科学发现环境：DiscoveryWorld 是开发与评测自动科学发现智能体的虚拟世界；PhysGym 在可控先验条件下考察 LLM 的交互式物理探索——两者都为长程评测提供受控测试床。（例：Jansen et al. 2024 / Chen et al. 2025b。）
- **SafeAgentBench**：面向具身智能体安全任务规划的基准，论文既用它做具身域代表，也用它支撑'必须跨迭代追踪安全策略违规'。（例：Yin et al. 2025a，§8.1.1 与 §8.2.2。）
- **ManiSkill2**：统一的机器人操作（manipulation）基准，论文归为'迁移导向'——检验技能能否迁移到新任务，同时也是时间平移评测的引用来源。（例：Gu et al. 2023。）
- **EmbodiedBench**：多模态具身基准，压力测试'grounding（把语言落到具体物体/动作上）'与泛化能力。（例：Yang et al. 2025b。）
- **OSWorld / Windows Agent Arena**：操作系统级虚拟机套件，配备程序化评测器：把智能体丢进一台真实（虚拟）电脑里操作各种应用，再用脚本自动判定任务是否完成。（例：Xie et al. 2024 / Bonatti et al. 2025，通用计算机控制域。）
- **AppWorld**：可控的应用与人物模拟世界，采用'基于状态'的评分——不看智能体说了什么，而看它把系统状态改成了什么样。（例：Trivedi et al. 2024。）
- **BFCL (Berkeley Function Calling Leaderboard)**：从工具调用到智能体行为的可验证评测榜：细分考察'该不该调工具、调哪个工具、参数填得对不对'。（例：Patil et al. 2025，§8.2.1 工具通道与 §8.2.2 通用计算机控制均引用。）
- **MetaTool**：专门考察 LLM'要不要用工具、用哪个工具'的决策基准。（例：Huang et al. 2024b。）
- **TaskBench**：评测 LLM 做任务自动化（任务分解与工具编排）的能力。（例：Shen et al. 2024，§8.2.1 工具评测。）
- **MINT**：在多轮交互中评测 LLM 使用工具并接收语言反馈的能力，论文同时用它支撑'人类介入必须被量化'。（例：Wang et al. 2024c。）
- **ToolEmu (LM-emulated sandbox)**：用语言模型模拟出一个沙箱环境来识别智能体的风险：不必真的连上危险的真实工具，就能把潜在危害暴露出来。论文还用它支撑'跨邻近任务族做保持性审计以暴露分布漂移'。（例：Ruan et al. 2024a，§8.1.1 安全、§8.2.1 FM 级、§8.2.2 通用计算机控制三处引用。）
- **GAIA**：通用 AI 助手基准，论文引用它作为'时间平移评测'（用模型知识截止日之后新造的题）的实践来源。（例：Mialon et al. 2024。）
- **H2HMem / GateMem**：记忆专项基准：H2HMem 是面向'人–人交互'场景的多模态记忆基准，考察跨模态与多方一致性；GateMem 面向多主体共享记忆下的'记忆治理'（谁能写、谁能读、越权泄露怎么办）。（例：Zhu et al. 2026 / Ren et al. 2026，§8.2.1 脚手架级记忆评测。）
- **DrunkAgent**：针对 LLM 推荐智能体的隐蔽记忆投毒攻击：悄悄污染智能体的记忆，使其后续决策被带偏。论文用它论证记忆改动必须测抗投毒能力与误差复合。（例：Yang et al. 2025c，§8.1.1 与 §8.2.1。）
- **Attribution Across Mechanisms（跨机制归因）**：三件套方法论：一是做消融，每次只换掉被更新的那个组件；二是做回放式 rollout，把环境固定住、只把更新过的模块换进去重跑；三是对'以前做对过的题'做回归检查。哪怕只能做到部分归因，也能把真正的架构收益与推理随机性、检索噪声、单纯的刷榜区分开。（例：§8.2.1 最后一段，机制基准的核心方法论要求。）

### 风险 / 挑战 / 防护

- 无界迭代对评测分布过拟合：不设预算 B_max、checkpoint、验收标准与早停规则，峰值分数会被人为抬高，代价是整体鲁棒性下降
- 轨迹对初始化极度敏感：累积的记忆与代码补丁使得单次跑分不可复现，必须跨多随机种子报告期望与方差
- 把反馈信号背下来而非真获得能力：需要在与优化数据完全不重叠的留出分布上测，并辅以隐藏题集与时间平移评测
- 训练数据泄漏与基准污染：FM 级评测尤其需要严格的来源追踪与数据集隔离
- 灾难性遗忘与分布漂移：参数更新会让旧能力退化，需跨邻近任务族做保持性审计而非只看峰值零样本准确率
- 人类监督稀释'自我'：任何人在回路的干预都动摇了自我改进中的'自我'，且不同强度的外部监督会从根本上改变自主学习动力学，必须显式量化其规模与形式
- 目标漂移（goal drift）与奖励黑客（reward hacking）：迭代式自我修改本身会诱发这两类问题
- 记忆与工具使用中的复合误差：小错误一旦写入记忆，会在后续迭代中不断放大
- 记忆投毒、越权泄露、主动遗忘失败：脚手架级记忆改动必须专门测这三类攻击面
- 向裁判的隐性偏好过拟合：若同一个 Φ_judge 既驱动更新又汇报终评，系统学到的是讨好裁判而非达成真实目标
- 裁判预算不透明：裁判的上下文窗口、允许的多智能体辩论轮数、工具调用步数会大幅左右评测可靠性；不报告裁判开销就分不清是智能体真变强了，还是评测者只是查得更彻底了
- 只报平均成功率会掩盖问题：必须同时报告回归率、尾部风险指标与安全策略违规数
- Web 环境的伪泛化：智能体对表层布局线索敏感，可能只是记住了页面而非学会导航；需受控网站或环境随机化
- 博弈中对固定对手池过拟合：需多样化对手、cross-play 评测与留出策略
- 具身场景的物理安全约束：严重的分布偏移加上不能自由试错，必须追踪安全约束违规与出错后的恢复行为
- 桌面/GUI 场景的脆弱反馈：异构应用、长上下文、不可靠的界面反馈，需在标准化虚拟机下报告可靠性、错误恢复能力、延迟与运营成本
- 工具调用的典型失败并非意图错误，而是调用顺序错误与'差一点'的参数落地错误
- 防护措施汇总：固定预算下报轨迹、多种子方差、隐藏与时间平移评测、成本透明拆解、量化人类介入、回归率+尾部风险+安全违规追踪、裁判独立性（换更强模型 θ'_judge 或正交 rubric κ'）、多裁判聚合、在可验证子集上用 Φ_metric 或人工复核做校准、消融+回放式 rollout 做机制归因

### 科普叙事素材（金句/比喻/例子）

- 论文给'自我改进'划的红线，可以直接做成视频里的一句反问：依赖外部人类监督，就'compromises the "self" in self-improvement'（动摇了自我改进里的那个'自我'）。有人在旁边帮忙，还算它自己变强了吗？
- 裁判悖论：如果同一个裁判既负责打分驱动改进、又负责宣布最终成绩，智能体学会的就不是把事情做好，而是把裁判哄好——论文的说法是 over-optimizing to the judge's latent biases（对裁判的潜在偏好过度优化）。通俗讲就是'既当运动员又当裁判'。
- 最有冲击力的一句判断：不公布裁判花了多少算力，你根本分不清到底是智能体真的进步了，还是'the evaluator merely became more exhaustive'（评测者只是查得更细致了）。
- 最'套娃'的例子：SWT-bench 和 TDD-bench 要求智能体自主生成并改进那些用来驱动它自我改进循环的单元测试——相当于让考生自己出考卷，再拿这份自己出的卷子证明自己进步了。论文原话把这叫做把反馈机制本身当成 a mutable artifact（一个可被修改的产物）。
- '时间平移评测'（temporally shifted evaluation）：专门用晚于模型知识截止日之后才造出来的新题去考它，因为这些题它在训练时绝无可能见过。搭配'隐藏评测'（hidden evaluation，用从不公开的私有题集）。这两招是防作弊的核心。
- 只看峰值分数的陷阱：不设预算和早停，迭代次数无上限时，分数会因为对评测集过拟合而 artificially inflating peak scores（人为虚高峰值），鲁棒性反而被牺牲掉。视频里可以类比成'刷同一套模拟卷刷到 150 分，高考却崩了'。
- 一个反直觉又特别好讲的细节：智能体用错工具，通常不是'想错了'，而是顺序搞反或参数差那么一点——论文写作 ordering mistakes and near-miss parameterization rather than incorrect intent。意图是对的，手滑了。
- 记忆的滚雪球效应：网页抓取时一个微小的提取错误一旦被写进长期记忆，就会在之后每一轮迭代里不断复合放大。所以论文要求 Web 域评测专门追踪'错误是否被写进了记忆'。
- 打游戏的假强大：游戏天然能画出漂亮的学习曲线，但如果永远只跟同一个对手池打，学到的可能只是针对这几个对手的套路。论文要求 diverse opponents、cross-play evaluation 和留出策略。
- 网页智能体的'死记硬背'：Web 环境 sensitive to superficial layout cues（对表层布局线索敏感），智能体记住的可能是按钮坐标而不是'怎么上网'，所以要用受控网站或环境随机化来拆穿它。
- 图12 是全节最适合做视频封面的一张图：一张'论文–基准'关联矩阵。横行是各种基准（分成脚手架级/交互式、与 FM 级/静态两组），纵列是代表性自我改进方法，列的颜色标出它改的是基础模型，还是提示/记忆/工具/整套脚手架。一张图看清整个领域'谁在用什么尺子量自己'。
- 全节的总纲金句：评测要从静态零样本打分（static zero-shot scoring）转向连续追踪（continuous tracking）。用大白话就是——别再给智能体拍一张证件照了，得给它拍一部纪录片。
- 具身智能的特殊之处：物理世界里不能随便试错，评测必须跟踪'安全约束违规了几次'以及'出错之后它能不能自己恢复'。这是唯一一个'考砸了会砸坏东西'的领域。
- 可以做成一屏清单的六大领域：软件工程（有确定性可执行反馈，最理想的试验场）、Web 导航与自动化、博弈与策略推理、科学发现、具身智能、通用计算机控制。
- 论文推荐的六项必报清单，很适合做成一张'自我改进论文体检表'：初始基线、固定预算后的表现、迭代学习曲线、留出任务上的迁移能力、已解决题目上的回归率、以及完整成本汇总（算力、工具调用次数、时间、人类投入）。


## 9 9 Discussion（讨论：系统设计启示与未来方向）

第 9 节是全文的收束性讨论。总纲先立论：自改进 agent 本质是「闭环动力系统」（closed-loop dynamical systems），形式化为 A_t=(θ_t, Σ_t)——即模型权重 θ 与外部脚手架 Σ 两部分；agent 通过执行「信号生成程序 + 稳定更新规则」迭代出新策略。由此推出全节的核心视角：研究对象不再是静态的 agent，而是「驱动它演化的机制」。

9.1「系统设计启示」分三段，恰好对应「改什么、谁来判、怎么防」三层。(1) 从快速探索到慢速固化：改 Σ（提示词编辑、记忆写入、工具调整）开销极低且可逆，构成快环；改 θ 则慢得多，虽擅长跨域迁移能力，却天然模糊信用分配——坏 prompt 一撤即可，被吸收进参数的退化却极难追踪。因此当环境反馈有噪声时，应先把更新限制在脚手架内并用严格执行测试验证，把参数固化（蒸馏/微调）推迟到新行为被证明稳定之后。且参数固化是「有损压缩」：把复杂轨迹蒸馏进权重会使模型偏向平均情形，丢掉探索中发现的罕见但关键的错误恢复策略；任何对 θ 的更新都会作废先前的安全界限，必须重做对抗测试。(2) critic 作为受治理的基础设施：闭环中的 critic 是攻击面而非被动基准，agent 优化时天然有寻找捷径的动机，能力上限被 critic 的「抗利用性」卡死。故提议更新与接受更新的角色必须解耦，否则塌缩成自我确认循环；critic 本身可以进化（如生成更严测试），但不能由被评估者不受约束地控制，其演化应限制为单调变化（纯增量式加测试）并由人类审计留痕。(3) 分层门禁式安全：自改进使「被对齐的对象」变成非平稳的，核心难题是弱系统如何可靠推理更强的后继系统；在 full-scaffolding 自改进下风险最大——一次性 prompt injection 会因被提交为稳定更新而固化成持久架构漏洞。结论是把自改进 agent 视为「在受保护运行时中执行的不可信代码」，任何写入 Σ_{t+1} 或 θ_{t+1} 的补丁都须通过验证器门禁（功能正确性、工具权限边界、随机状态扰动鲁棒性）。

9.2「未来方向」把前路归结为两大瓶颈、六个方向。Theme A 终身适应的算法范式：1 测试时持续适应；2 主动探索与好奇心；3 参数蒸馏与联合优化（把 System 2 结构压进 System 1 权重，θ 与 Σ 同环共优）。Theme B 复杂度、约束与开放世界鲁棒性：4 资源受限的改进动力学（评估从峰值性能转向改进效率）；5 多智能体协同共演化（共享回归测试、补丁、工具封装等可复用产物）；6 抵御开放世界分布漂移（用非平稳模拟器取代静态排行榜，乃至走向神经计算机/自适应神经运行时）。结语：应从「每次交互后归零的无状态 AI 工具」转向「能持续自改进的系统」，这不止是把基础模型做大，还需要可靠反馈机制、安全的自修改架构，以及把评估重新理解为持续集成的过程而非静态基准。

### 代表方法

- **OSWorld**：真实计算机环境中的多模态 agent 开放式任务基准。论文开篇引用它来支撑「自改进 agent 是闭环动力系统」这一论断——agent 在真实操作系统里动手、看结果、再动手，天然构成感知-行动闭环。（例：第 9 节首句 "Self-improving agents are closed-loop dynamical systems" 的支撑引用。）
- **Recursively Self-Improving Software / Seed AI (Yampolskiy)**：从「种子 AI」到技术奇点的递归自改进软件理论框架。被引用来说明本节的核心转向：研究重心从静态 agent 移到「驱动其演化的机制」本身。（例：支撑 "the goal of the study is no longer the static agent but the mechanism driving its evolution"。）
- **SICA (A Self-Improving Coding Agent)**：一个会修改自己源代码的编码 agent：它读自己的代码库、提出改动、跑测试验证，然后把改动提交回自身，下一轮用改过的自己继续工作。是「机制演化」的典型代表。
- **SWE-Gym**：同时训练软件工程 agent 与 verifier（验证器）的训练环境。体现本节反复强调的思路：生成者与判定者要成对建设，而不是只练生成。
- **AgentDistill**：免训练的 agent 蒸馏：不改权重，而是把强 agent 的能力打包成可泛化的 MCP box（工具/流程封装盒）交给弱 agent 复用。被引用支持「先在脚手架层固化、把参数固化往后推」的部署策略。
- **From Correction to Mastery（强化蒸馏）**：把大模型 agent 的「先出错、再纠正」过程强化蒸馏成稳定能力。同样用于支撑「等新行为被证明稳定后再做参数固化」。
- **Re-ReST (Reflection-Reinforced Self-Training)**：让语言 agent 先反思自己的失败轨迹、把反思后的改进版答案当作训练数据回灌自训练。被引用在「θ 更新会作废既有安全界限、需重做对抗测试」的语境里。
- **AvaTaR**：用对比推理（contrastive reasoning）优化 LLM agent 的工具使用：把成功与失败的轨迹放在一起对照，从差异中提炼出更好的工具调用策略。
- **InjecAgent**：针对「工具集成型 LLM agent」的间接提示注入（indirect prompt injection）基准：攻击者把恶意指令藏在 agent 会读到的外部内容（网页、文档、工具返回值）里，测试 agent 是否会照做。用于论证 critic/闭环是攻击面。
- **Agent Security Bench (ASB)**：系统化形式化并基准化 LLM agent 的各类攻击与防御手段。与 InjecAgent 一起支撑「agent 能力上限被 critic 的抗利用性卡死」。
- **WebEvolver**：给网页 agent 配一个「共演化的世界模型」：世界模型预测网页操作后会发生什么，agent 可以先在这个模型里演练再真操作，两者一起进化。被引用来说明「critic/评估侧本身也可以进化，但必须受约束」。
- **A Vision for Access Control in LLM-based Agent Systems**：为 LLM agent 系统设计访问控制（权限）体系的构想。直接对应本节的「人类审计留痕」与「工具权限边界」门禁要求。
- **Vingean Reflection (Fallenstein & Soares)**：递归自改进的经典理论难题：一个较弱的系统如何可靠地推理、并信任一个比自己更强的后继系统？因为弱系统无法完整模拟强系统的推理，它只能靠某种抽象保证而非逐步验算。这是本节安全论述的理论支点。（例：论文原句："how a weaker system can reliably reason about more capable successor systems"。）
- **AgentGym**：让 LLM agent 跨多种环境演化的平台。被引用于「full-scaffolding 自改进（agent 可修改自身源码或运行逻辑）风险最severe」的语境。
- **AI with Recursive Self-Improvement (Zhuge, Schmidhuber et al.)**：递归自改进 AI 的系统性工作。被引用来开启 9.2：自改进 agent 需要能抵御分布漂移、算力约束与严重退化奖励信号的可靠稳定更新周期。
- **Live-SWE-agent**：软件工程 agent 在运行途中「即时自演化」——不区分训练期与部署期，边干活边改自己。是「测试时持续适应」方向的代表。（例：论文标题即为反问："can software engineering agents self-evolve on the fly?"）
- **TTCS (Test-Time Curriculum Synthesis)**：在测试时现场合成课程（由易到难的任务序列）来驱动自演化，让模型在部署中动态更新检索、路由与记忆策略。
- **Schmidhuber 好奇心与厌倦机制**：1991 年经典工作：给「建模型的神经控制器」植入好奇心与厌倦——对预测误差大的交互给予内在奖励（越出乎意料越值得探索），对已能准确预测的则厌倦。本节据此主张 agent 应主动寻找有价值经验，而非被动接受人类给的任务。
- **Curious Causality-Seeking Agents**：在开放世界中主动寻找因果关系的好奇型 agent。与 Schmidhuber 一起支撑「稀疏反馈下靠高预测误差或 verifier 分歧来分配内在价值、提升样本效率」。
- **Alita**：极简预定义、最大化自演化的通才 agent：不预先写死一堆工具和流程，而是让 agent 在运行中自己造工具、自己搭流程。被引用于「把 System 2 的算法结构自动迁移进小模型的 System 1 权重」这一方向。
- **SIA (Self Improving AI with Harness & Weight Updates)**：同时更新「harness（外部脚手架 Σ）」和「模型权重 θ」的自改进系统。正是本节所说 joint optimization（联合优化）方向的直接代表——难点在于失败时要自主判断该改提示词、重写工具封装，还是算一次梯度更新。
- **AgentOCR**：用「光学自压缩」重构 agent 历史：把长长的交互历史渲染/压缩成更省 token 的形式再喂回去。对应「资源受限的改进动力学」——通过动态分配上下文来削减开销。
- **Multi-Agent Evolve**：多个 LLM 通过相互博弈与协作共演化实现自改进，突破单 agent 探索在巨大搜索空间中的低效。
- **MetaGen**：让多 agent 系统的「角色分工」与「拓扑连接方式」本身自我演化——不是人工设计谁是 planner、谁是 critic、怎么连，而是让系统自己搜索出更好的组织结构。
- **Memory Poisoning Attack and Defense on Memory-based LLM Agents**：记忆投毒攻防研究：攻击者污染 agent 的长期记忆库，使恶意内容在后续任务中被反复检索出来。正对应本节警告的「被投毒的记忆被提交为稳定更新，变成持久架构漏洞」。
- **GAIA2**：在动态、异步环境中评测 LLM agent 的基准——环境会变、事件会并发到来，而不是静态可复现的题库。被引用来主张放弃静态排行榜、改用会持续漂移的非平稳模拟器。
- **Neural Computers**：「神经计算机」构想：用学习得到的运行时状态统一计算、记忆与 I/O，取代固定的外部执行接口。本节以此指出终极方向——不是让 agent 去「操作计算机」，而是走向自适应的神经运行时。
- **NeuralOS**：用神经生成模型直接模拟操作系统：界面与系统响应由模型生成而非固定程序给出。与 Neural Computers 一起构成本节结尾对「基底层（substrate level）」的展望。

### 风险 / 挑战 / 防护

- 参数更新（θ）会模糊信用分配：坏 prompt 一撤即可回滚，但被吸收进模型权重的性能退化极难追踪定位。
- 参数固化是「有损压缩」：把复杂轨迹蒸馏进权重会让模型偏向平均情形执行，从而丢弃探索中发现的、罕见却关键的错误恢复（error-recovery）策略。
- 任何对 θ 的更新都会作废此前建立的安全界限（invalidates prior safety bounds），必须重新做对抗测试以验证边缘情形韧性是否被保留。
- 闭环中的 critic 是攻击面而非被动基准：agent 在对着 critic 优化时天然产生寻找捷径（shortcuts）的动机，即奖励黑客。
- agent 的能力天花板被 critic 的「抗利用性」（exploit-resistance）卡死。
- 自我确认循环（self-confirming loop）：若 agent 同时扮演「提议更新」与「接受更新」两个角色，整个系统会塌缩成自说自话。
- 会进化的 critic 若受被评估 agent 不受约束的控制，等于让考生改考卷；应限制为单调变化（纯增量式加测试）并加人类审计留痕（human audit trails）。
- 自改进让「被对齐的对象」变成非平稳（non-stationary）的，使 AI 对齐问题复杂化。
- Vingean reflection 难题：较弱的系统难以可靠地推理与信任比它更强的后继系统。
- full-scaffolding 自改进（agent 可改自身源码/运行逻辑）风险最severe：一次性的瞬时攻击（如单次 prompt injection）会因被提交为稳定更新而演变成持久的架构级漏洞——投毒记忆、被劫持的工具逻辑就此固化。
- 测试时的即时局部补丁（on-the-fly patching）可能悄悄侵蚀系统的长期全局性能。
- 好奇心/内在奖励驱动的探索可能落入退化的自欺循环（degenerate, self-deceptive cycle）——agent 自己给自己发奖励却毫无长进。
- 开放式场景中的无效探索会耗尽算力预算与 token 上限，却不能可靠推进底层策略。
- 多智能体协作共演化存在单点故障，以及针对多 agent 奖励机制的级联攻击（cascading attacks）。
- 现有测试平台过度依赖静态代码仓库或一成不变的模拟器，无法应对真实部署中不断变化的 API、重新设计的界面与对抗性用户输入；开放世界漂移还带来灾难性遗忘风险。
- 【防护措施】分层门禁（layered gating）：为自我修改设立严格权限系统，任何写入 Σ_{t+1} 或 θ_{t+1} 的补丁都必须先通过验证器门禁检查——覆盖功能正确性、工具权限边界、以及对随机状态扰动的鲁棒性。
- 【防护措施】把自改进 agent 概念化为「在受保护运行时环境中执行的不可信代码」，安全不能只依赖基础模型的初始对齐。
- 【防护措施】critic 与 generator 解耦；改进只允许发生在明确定义且被持续审计的安全边界之内。
- 【防护措施】多 agent 共享产物需建立安全的、版本受控的协议（如 artifact repositories）。
- 【防护措施】用非平稳模拟器（允许界面持续漂移）取代静态排行榜，主动把 agent 暴露在开放世界扰动中。

### 科普叙事素材（金句/比喻/例子）

- 【最好用的核心比喻——可回滚 vs 不可回滚】"a bad prompt is easily reverted, but a regression absorbed into model parameters is notoriously difficult to trace"（一个坏的提示词很容易撤销，但一旦退化被吸收进模型参数，就出了名地难以追踪）。科普时可说：改提示词像用铅笔写字，擦掉就好；改权重像把字刻进石头，还是拌进水泥里——你连它刻在哪都找不到。
- 【记忆点：快环与慢环】改脚手架 Σ 是「快速探索」，改权重 θ 是「慢速固化」。原文标题即 "From Fast Exploration to Slow Consolidation"。这几乎就是人类「短期记忆 vs 长期记忆」「白天学习 vs 夜里睡觉巩固」的翻版——而论文明确说：等新行为被证明稳定了，再让它睡这一觉。
- 【最有冲击力的一句——蒸馏的代价】"parametric consolidation is a lossy compression"（参数固化是一种有损压缩）。它"inherently biases the model toward average-case execution"，并"often discards the rare but crucial error-recovery strategies discovered during exploration"。通俗版：把老师傅几十年的临场救火经验写成 SOP 手册，写下来的都是常规操作，最值钱的「出事时怎么救」反而丢了。
- 【最反直觉的一句——考官即攻击面】"A critic embedded within a closed loop operates as an attack surface, not a passive benchmark."（闭环中的评判者是一个攻击面，而不是被动的基准。）配套金句："the ceiling of an agent's capability is usually bottlenecked by the critic's exploit-resistance"——AI 有多强，取决于考官有多难糊弄。
- 【极易记住的画面——自己给自己判卷】"If an agent conflates the roles of proposing updates and accepting them, it collapses into a self-confirming loop."（如果一个 agent 把「提出修改」和「批准修改」两个角色混为一谈，它就会塌缩成自我确认的闭环。）视频里可以直接画：一个人左手交作业、右手盖「优秀」章。
- 【最适合做标题的一句——安全观的根本转向】"a self-improving agent should be conceptualized as untrusted code executing in a protected runtime environment"（自改进 agent 应被视为在受保护运行时环境中执行的不可信代码）。紧接着一句同样重要："Security cannot rely solely on the initial alignment of the foundation model."（安全不能只依赖基础模型最初的对齐。）通俗版：别指望「这孩子本性善良」，得有门禁、有权限、有监控。
- 【最惊悚的因果链——一次性攻击如何变成永久漏洞】"standard transient exploits (like a one-off prompt injection) can evolve into persistent architectural vulnerabilities, as poisoned memories or hijacked tool logics are committed as stable updates." 通俗版：以前骗 AI 一次就是骗一次；现在 AI 会「学习」，你骗它一次，它可能把这个骗局当成经验存下来，从此永远这么干。这是自改进带来的全新风险类别。
- 【理论层最有哲学味的点——Vingean Reflection】"how a weaker system can reliably reason about more capable successor systems"（一个较弱的系统如何可靠地推理比它更强的后继系统）。这是递归自改进的根本悖论：你要造一个比你聪明的接班人，可你凭什么判断它是安全的？就像小学老师要给博士生的论文把关。
- 【全节的立论转向，适合开场白】"the goal of the study is no longer the static agent but the mechanism driving its evolution"（研究的目标不再是那个静态的 agent，而是驱动它演化的机制）。开场可用：我们过去问「这个 AI 有多聪明」，这篇综述说，该问的是「它变聪明的方式对不对」。
- 【认知科学梗，观众秒懂】把脚手架层发现的 "System 2" 算法结构（慢速、多步、会反复调试和自我反思）自动迁移进小模型的 "System 1" 参数权重（快速直觉）。通俗版：把「深思熟虑想出来的解法」练成「肌肉记忆」。
- 【联合优化的难题，很有画面感】当 agent 失败时，改进算子必须自主决定："whether the better fix is to refine a prompt, rewrite a tool wrapper, or compute a gradient update"（更好的修法是打磨提示词、重写工具封装，还是算一次梯度更新）。通俗版：机器出故障，是调参数、换零件，还是回炉重造？现在要 AI 自己判断。
- 【评估观的颠覆】未来基础设施应"abandon static leaderboards in favor of non-stationary simulators, allowing the interface to drift continuously"（放弃静态排行榜，转向非平稳模拟器，让界面持续漂移）。通俗版：别再考固定题库了——真实世界的 App 天天改版，考场本身就得会变。
- 【最有科幻感的收尾意象】"pointing beyond agents that merely operate computers toward adaptive neural runtimes"（指向的不再是仅仅「操作计算机」的 agent，而是自适应的神经运行时）。配合 Neural Computers 与 NeuralOS：终点不是 AI 学会用电脑，而是 AI 本身长成一台电脑。
- 【全文最佳收尾金句】"we should transition from building stateless AI tools that reset after every interaction to designing systems capable of continuous self-improvement"（我们应当从构建每次交互后就归零的无状态 AI 工具，转向设计能够持续自我改进的系统）。通俗版：今天的 AI 像得了失忆症的天才，每次见面都要重新自我介绍；我们要造的是会成长的同事。
- 【提醒观众别只盯着模型变大】原文明确说这一愿景"goes beyond simply scaling foundation models"，还需要"robust feedback mechanisms, safe architectures for self-modification, and a fundamental rethinking of evaluation as an ongoing, integrated process rather than a static benchmark"。通俗版：AI 的下一步不在于把大脑做多大，而在于有没有靠谱的反馈、安全的改造流程，和一场永不结束的体检。

---

## 信源补充（2026-08 升级；来源：官方工程站点，非论文正文）

> 站点：https://selfimproving-agent.github.io/（访问日期 2026-08-18）。以下条目全部来自站点页面，与论文正文物理隔离；如与论文冲突以论文为准。

### 收录统计（P5 收尾「活地图」镜依据）

- 【312 条收录】站点 Survey statistics 原文："312 curated entries"，分系 "77 FM improvement / 176 Scaffolding improvement / 59 Evaluation & Benchmarking"（"312 categorized entries in total"）。→ **视觉映射**：蓝（改大脑 θ=FM）77 / 橙（改装备 Σ=Scaffolding）176 / 灰（评测）59 三色计数条——橙色条最长，恰好印证论文侧重（Scaffolding 条目数是 FM 的两倍多）。
- 【living research map 定位】站点原文："This survey is maintained as a living research map."（读者可 suggest missing work / report corrections / help improve the taxonomy）→ 视觉映射：地图持续生长意象，与「论文不是终点而是持续更新的地图」呼应。

### 九篇敲门砖（P5 收尾「卡片墙」镜依据）

- 站点 Quick start 列出的 9 篇代表工作（逐字）：**Self-Instruct、Constitutional AI、WebRL、Web Agents with World Models、Self-Refine、TextGrad、MemoryBank、Voyager、Darwin Gödel Machine**。
- 与本片两路结构对位：Self-Instruct / Constitutional AI / WebRL / Web Agents with World Models ≈ 改大脑线（§5）；Self-Refine / TextGrad / MemoryBank / Voyager / Darwin Gödel Machine ≈ 改装备线（§6）。→ 视觉映射：3×3 卡片墙按蓝/橙双色分拣入场。

### 题记与作者（既有内容佐证）

- 站点题记逐字："The first ultraintelligent machine is the last invention that man need ever make." — I. J. Good (1966)（与 P0 冷开场金句一致，可作片尾回响佐证）。
- 作者名单含 Jürgen Schmidhuber（KAUST / IDSIA-USI-SUPSI），与 P0 「作者名单压轴 Schmidhuber」一致。

---

## 2026-08 升级复核（第二遍重读校准）

> 重读方式：本地 PDF（`assets/papers/source/Self-Improvements in Modern Agentic Systems: A Survey.pdf`，97 页）p11–19（§3 Definitions / §4 Taxonomy）与 p48–56（§8 Evaluation / §9 Discussion）二次精读（pymupdf 抽取，2026-08-18）。
> **结论**：narration v2 全部断言与原文一致，零事实漂移。§3 形式化（A=(θ,Σ)、𝒰 算子、两模式、Skill 定义）、§4 分类法（两路×信号形式）、§8 评测（预算内轨迹报告、held-out 迁移、judge 过优化风险）、§9 讨论（快探索/慢固化、critic 即攻击面、分层门禁）均已充分覆盖。

### 审计发现与处置

| # | 发现 | 类别 | 处置 |
|---|---|---|---|
| 1 | 站点 312 条统计（77/176/59）是论文之外最有分量的定量事实，且橙色（装备）条目约为蓝色两倍半——正好给 P3「这两年最火的方向」（p3-02）提供外部印证 | 站点信源 | 新增 P5 收尾活地图镜（3–4 句） |
| 2 | 站点 9 篇敲门砖与片内已讲方法高度重合（观众全程听过名字） | 站点信源 | 新增 P5 卡片墙镜（2 句），双色分拣呼应 P1 分叉 |
| 3 | §3.2「Skill = 可复用更新算子」在 v2 中仅以「技能库」侧写（p3-33/34），未点破「技能=把一次升级打包」这一定义 | 核心遗漏（轻） | 新增 p3-34b/c 两句（P3 第三层内） |
| 4 | §8.1.1「报告完整学习曲线而非只报峰值」是评测章的纲领句，v2 P5「持续体检」已意译覆盖 | 已覆盖 | 不动 |
| 5 | 考虑补 §7 应用域扩展、§9.2 六方向逐条展开 | — | **放弃**：篇幅所限，v2 的取含已在 planning.md 声明，本轮不加新幕 |

### 本轮新增断言锚点（v3 新句用）

- 【站点 312 统计】见「信源补充」节——77/176/59 数字必须引用为站点统计（非论文正文数字）。
- 【§3.2 Skill 定义·逐字】"We model a skill as a reusable instance of the self-induced update operator U: a named update to the agent's own configuration that it retains and reuses."——「技能就是把一次自我升级打包保存、随取随用」。
- 【§4.1 参数历史支持回滚·逐字】"θ1:t denotes the parameter history, enabling validation and rollback (e.g., reverting to a prior checkpoint) when a proposed update degrades performance or violates constraints."
- 【§8.1.1 曲线报告·逐字】"Evaluation should therefore report the full performance trajectory (mt) across update iterations (t) rather than exclusively highlighting a final peak score, bounded by a predefined resource budget (Bmax)."
