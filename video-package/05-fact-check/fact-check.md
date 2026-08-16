# 事实核查表 ——《当 AI 开始给自己当老师》逐字稿 vs 论文 2607.13104

> **核查对象**：`video-package/02-script/script.md`（N0–N6 全部段落）
> **权威底本**：arXiv 2607.13104（HTML v1，2026-07-14 提交；arXiv Comments 标注 97 pages, 12 figures）——《Self-Improvements in Modern Agentic Systems: A Survey》
> **核查方法**：论文 HTML 抽取为纯文本（`.temp/factcheck/paper_full.txt`）后按 §/Fig. 切片；全部 quote 经归一化空白后**逐字精确匹配**验证，无一条凭记忆默写。
> **join 主键**：`narration_anchor` = 逐字稿段落 ID（N0/N1a/…/N6b）。

## 状态仪表盘

| 指标 | 值 |
|---|---|
| 断言总数 | 71 |
| fidelity：EXACT | 35 |
| fidelity：FAITHFUL | 32 |
| fidelity：SIMPLIFIED | 4 |
| fidelity：REWRITE | 0 |
| fidelity：RISKY | 0 |
| verdict：PASS | 68 |
| verdict：PASS_WITH_NOTE | 3（F036 / F054 / F061） |
| verdict：REWRITE | 0 |
| verdict：DROP | 0 |
| RISKY 清单 | 无 |
| 定稿门槛 | ✅ **已达标**：无 RISKY、无 REWRITE 条目；F058「反复强调」已按替代文案修订口播（2026-08-16，N5a/N6a 均删「反复」）转 PASS，F056 口播改为「比起请人类老师，它们又快又省」后升 PASS，全部 71 条断言 PASS/PASS_WITH_NOTE，可定稿 |

**2026-08-16 对抗式复核记录**：随机抽验 + 全量 59 组引文（约 80 个片段）在 `.temp/factcheck/paper_full.txt` 归一化匹配**全部命中，0 条编造引文**；修正 3 处引证瑕疵（F021/Q55 引文编号 420→336、F058/F068/Q53 主题句位置 §9.2 非 §10/「共 3 处」误判、F056「快」的证据锚点），F056 由 PASS 升为 PASS_WITH_NOTE。仪表盘数字已按 66/4/1 重算并一致。

**2026-08-16 口播修订联动复核**：逐字稿 N5a/N6a 已按替代文案修订（N5a「比起请人类老师，它们又快又省」+「在结尾的设计启示里强调」、N6a 删「反复」），F058 REWRITE→PASS、F056 PASS_WITH_NOTE→PASS（原 66/4/1 口径作废），仪表盘已按 68/3/0 重算并一致。

**口径说明**：核对基准采用论文正文的 § 编号体系（§1 引言 … §10 结论）。逐字稿口播的「第五节」即 §5 Foundation Model Improvement，两者一致。

---

## N0 冷开场

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F001 | 2026 年的 AI 正在大规模做「自己给自己当老师」的自我改进，且成绩（能力指标）真的在提升 | PAPER_FACT | N0 | Abstract / §1 | Self-improving autonomous agents are moving from research prototypes to deployed systems. … growing evidence demonstrating that FM-based self-improving agents can yield substantial empirical gains | 「正在大规模做」对应论文"从原型走向部署"；「成绩单在涨」对应"substantial empirical gains"，保义 | FAITHFUL | PASS | 两个分句分别锚 Abstract 与 §1 末句 |
| F002 | 这是一篇 2026 年的论文 | STAT | N0 | HTML 页眉（arXiv 水印） | arXiv:2607.13104v1 [cs.AI] 14 Jul 2026 | 论文 v1 提交于 2026-07-14，属 2026 年 | EXACT | PASS | 日期取自论文 HTML 的 arXiv 水印行 |
| F003 | 综述论文「近百页」 | STAT | N0 | arXiv abs 页元数据 | 97 pages, 12 figures.（arXiv Comments 字段） | 97 页称「近百页」准确 | EXACT | PASS | 页数以 arXiv abs 页 Comments 字段为准（HTML 正文无页码水印）；quote 来自 arXiv 元数据而非论文正文，特此注明 |
| F004 | 论文把各家「AI 自我改进」方法整理成统一体系 | PAPER_FACT | N0 | §1 / Abstract | We offer a system-level framework that represents a modern agent as a configuration coupling a foundation model with an operational scaffold of prompts, memory, tools, and control logic. | 「统一体系」= 论文的 system-level framework + 统一分类学，保义 | FAITHFUL | PASS | — |
| F005 | 最根本一类是 AI 不等人类训练、自己更新自己的「大脑」（模型参数） | PAPER_FACT | N0 | §1 / §3.2 | This approach targets the agent's core, namely the parameter set θt of its underlying FM, and updates these parameters to internalize new behaviors | FM improvement 被论文称为对 agent「核心」的直接更新路径；「最根本」为叙事评价，与论文 §1 的 slower/stable 定位相容 | FAITHFUL | PASS | — |
| F006 | 视频主线顺着论文第五节讲 | PAPER_FACT | N0 | §5 | Algorithm 1 Foundation-Model Improvement | 三条信号路径（出题/批卷/实验）确为 §5 的 5.1/5.2/5.3 | EXACT | PASS | — |

## N1 背景 + 三位老师总纲

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F007 | 会写代码、会上网的智能体由「大脑」+「装备」两大部分组成 | PAPER_FACT | N1a | §3.1 / Fig.5 | an agent At=(θt,Σt) … Σt denotes the agent's dynamic operational scaffold | 论文形式化定义 A=(θ,Σ) 二元组，保义 | FAITHFUL | PASS | 「大脑/装备」命名是本片类比，但二元结构本身是论文定义 |
| F008 | 大脑 = 大模型本身，出厂自带几十亿、几千亿参数 | PAPER_FACT | N1a | §3.1 | θt encapsulates the neural parameters of the foundation model | θ=FM 神经参数为论文原义；「几十亿、几千亿」为业界公认数量级（论文亦称 massive parameter scales） | FAITHFUL | PASS | — |
| F009 | 参数 ≈ 神经连接强弱；参数定了，AI 聪明程度基本就定 | ANALOGY | N1a | §3.1（映射对象） | its underlying capabilities remain bounded by its fixed initial setup | 参数量-能力映射为通俗化；论文原句「固定初始配置框住能力上限」支持后半句，映射不失真 | SIMPLIFIED | PASS | 类比为便于理解，非论文内容 |
| F010 | 装备 = 提示词、记忆库、工具箱、控制规则；大脑靠装备理解任务/调工具/行动 | PAPER_FACT | N1a | §3.1 Eq.(2) | pt denotes structured prompts or system instructions, mt denotes memory mechanisms … Tt denotes the set of external tools … gt denotes additional control logic such as routing, scheduling, or safety constraints | Σ=(p,m,T,g) 四件套与功能描述逐项对应 | EXACT | PASS | — |
| F011 | 论文管大脑叫 θ、管装备叫 Σ | PAPER_FACT | N1a | §3.1 Eq.(1) | At=(θt,Σt) | 符号属实 | EXACT | PASS | — |
| F012 | 大脑 θ 像出厂芯片+操作系统：焊死，升级=回厂重造 | ANALOGY | N1b | §3.2（映射对象） | Foundation model improvement typically operates on longer time scales, incurs substantial computational cost | 类比映射论文事实「改 θ 慢且贵、稳定全局」；芯片/焊死措辞是本片创造，方向不失真 | SIMPLIFIED | PASS | 类比为便于理解，非论文内容；画面已带角落标注 |
| F013 | 装备 Σ 像后装 APP：可装卸、快、可逆 | ANALOGY | N1b | §3.2 | scaffolding improvement is typically faster, more reversible, and more context-dependent | 类比映射论文原义「更快、更可逆」，失真度低 | FAITHFUL | PASS | 类比为便于理解，非论文内容；画面已带角落标注 |
| F014 | 自我改进分两条路：改装备快但本事不长在身上；改大脑慢贵但长在身上 | PAPER_FACT | N1c | §3.2 / §10 | foundation-model improvement as a parametric, slower loop … scaffolding improvement as a non-parametric, faster loop | 与论文结论段的双循环定性一致 | EXACT | PASS | — |
| F015 | 本片只讲第二条路（改大脑） | PAPER_FACT | N1c | §5 | Algorithm 1 Foundation-Model Improvement | 结构性事实：全片对应 §5 | EXACT | PASS | — |
| F016 | 更新大脑需要「学习信号」：要有老师告诉它对不对、好在哪 | PAPER_FACT | N1c | §3.2 / §5 | produces a learning signal (e.g., interaction trajectories, reflections, critiques, or proposed edits) | 学习信号 S 为论文核心概念；「老师告诉对不对」是对信号来源的拟人化，保义 | FAITHFUL | PASS | — |
| F017 | 学习信号可由 AI 自己产生，有三种当法（出题/批卷/实验） | PAPER_FACT | N1c | §5 开篇 | (i) Intrinsic generative demonstrations (§5.1) … (ii) Intrinsic evaluative feedback (§5.2) … (iii) Extrinsic exploratory experience (§5.3) | 三分类即论文三大子类，且均为 agent 自产信号 | EXACT | PASS | — |
| F018 | 这就是论文第五节的三条路径 | PAPER_FACT | N1c | §5 / Fig.6 | Fig. 6: Overview of foundation model improvement under agent-induced learning signals | 属实 | EXACT | PASS | — |

## N2 路径一：自己出题，自己刷题

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F019 | 传统训练靠真人写题+标准答案（标注数据），贵且永远不够用 | PAPER_FACT | N2a | §5.1 | massive parameter scales, which inherently demand vast quantities of high-quality training data … the costly acquisition of human annotations | 保义（论文强调瓶颈在人工标注的获取成本） | FAITHFUL | PASS | — |
| F020 | 让模型自己出题、自己作答、拿自产数据训练自己 | PAPER_FACT | N2a | §5.1 | FMs act simultaneously as the cognitive learner and the data synthesizer | 「学习者+数据合成器双重身份」为论文原句 | EXACT | PASS | — |
| F021 | 代表方法：Self-Instruct | PAPER_CITE | N2a | §5.1 / 参考文献 | The underlying techniques start with a small set of example seeds and then build a larger instruction-output pair corpus. (336; 420) | Self-Instruct（Wang et al. 2022，ref 336）在参考文献中且被 §5.1 引用（种子→自产语料的代表） | FAITHFUL | PASS | 论文正文以引文编号 (336;420) 指代，方法名经参考文献条目 + HTML bib 锚点二次验证（ref 336 = Self-instruct；ref 420 = Zhao et al. 2024b SELF-guide，同为种子→自产语料路线；2026-08-16 复核修正原「ref 420 = Self-instruct」误标） |
| F022 | 代表方法：Evol-Instruct | PAPER_CITE | N2a | §5.1 | Methods such as Evol-Instruct (365) go beyond simple volume expansion. | 名称与定位均原句 | EXACT | PASS | — |
| F023 | Evol-Instruct 不只堆量，还把题目越改越难（一元→三元方程式的排课类比） | PAPER_CITE | N2a | §5.1 | They drive complexity evolution by using LLM to rewrite instructions and gradually increase the difficulty of the instructions | 「一元/三元方程」是本片举例（类比），「越改越难」为论文原义 | FAITHFUL | PASS | 举例部分为类比性内容，非论文原例 |
| F024 | 更聪明版本会「挑食」：同一题写多个解答，只留最有把握的去训练 | PAPER_CITE | N2a | §5.1 | 124 employs self-consistency to filter high-confidence inference paths, while 293 uses external verifiers like unit tests to select only correct solutions from the model's attempts | 「挑食=高置信过滤」（self-consistency）与「稳赢=只留验证通过的」均有原文支撑 | FAITHFUL | PASS | — |
| F025 | 复印机效应：复印件印复印件，十代二十代越来越糊 | ANALOGY | N2b | §5.1（映射对象） | recursively training the model on the generated corpus introduces the risk of model collapse and forgetting | 复印机是本片类比；映射对象「递归自训练→模型坍缩」为论文原文，映射方向不失真 | FAITHFUL | PASS | 类比为便于理解，非论文内容；逐字稿自身已带行内免责标注 |
| F026 | 论文管这个风险叫「模型坍缩」 | PAPER_CITE | N2b | §5.1 Challenges and safeguards | the risk of model collapse and forgetting | 术语名与出处属实 | EXACT | PASS | — |
| F027 | 《自然》2024 年研究显示：反复吃自产数据会丢多样性、输出单一、偏差逐代放大 | PAPER_CITE | N2b | §5.1 / 参考文献 Shumailov et al. (2024b) | AI models collapse when trained on recursively generated data. Nature 631 (8022), pp. 755–759. | 论文确实引用 Nature 631 (2024) 的 Shumailov et al. 坍缩研究；「多样性丧失/偏差放大」为该文核心结论的通识转述 | EXACT | PASS | 特别校准点②已核：逐字稿「《自然》2024 年刊出」与论文引用条目（Shumailov et al. 2024b, Nature 631, §5.1 引用）完全一致 |
| F028 | 「知识气泡」：只出熟悉领域的题→更擅长→出更多同类题，越学越窄 | PAPER_FACT | N2b | §5.1 | agents may get trapped in knowledge bubbles and repeatedly generate data, which reinforces their existing biases and traits instead of generating genuine new capabilities | 「知识气泡」为论文原词，自强化循环描述保义 | EXACT | PASS | — |
| F029 | 保险丝一：别扔真人数据，自产与真数据掺着喂、随时对照校准 | PAPER_FACT | N2c | §5.1 safeguards | A simple and effective safeguard is to retain artificially generated benchmark data and accumulate generated demonstration data on top of it, which can prevent collapse under repeated training | 保义（保留原始/基准数据以防坍缩；§5.1 公式亦含 D = D_base ∪ D_gen 的掺混结构） | FAITHFUL | PASS | — |
| F030 | 保险丝二：外部裁判——代码跑通与否程序自动验证；数学推导交定理证明器 | PAPER_FACT | N2c | §5.1 safeguards | external validators specifically designed for model-generated content … formal systems for inference verification, such as theorem provers | 两类外部验证器均为论文原文 | EXACT | PASS | — |

## N3 路径二：自己批改自己的作业

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F031 | 练完对错传统上靠人批（人类反馈），贵 | PAPER_FACT | N3a | §5.2 | The bottleneck in traditional supervisory signal acquisition lies in the high cost of manually labeled preferences and human evaluation. | 保义 | FAITHFUL | PASS | — |
| F032 | 论文归纳三种自评姿势（规矩打分/投票/纠正反馈） | PAPER_FACT | N3a | §5.2 | Rubric feedback. … Consistency feedback. … Corrective feedback. | §5.2 恰为三小节三家族 | EXACT | PASS | — |
| F033 | 第一种：给 AI 成文评判原则（如「有用、无害、诚实」），照原则给自己的回答打分排名 | PAPER_CITE | N3a | §5.2 Rubric feedback | the same model-based evaluator can be conditioned to assess helpfulness, harmlessness, factuality, reasoning quality, or format compliance | 「有用、无害、诚实」直取论文 helpfulness/harmlessness/factuality；「打分/排名」对应原文 scored, ranked, or compared | EXACT | PASS | — |
| F034 | 代表方法叫 Constitutional AI | PAPER_CITE | N3a | §5.2 | Constitutional AI is a representative early example of this pattern. | 名称与「代表性早期范例」定位均原文 | EXACT | PASS | — |
| F035 | 《阅卷手册》类比：给 AI 发一本成文原则让它照章批卷 | ANALOGY | N3a | §5.2（映射对象） | the model critiques and ranks outputs according to a set of written principles | 「成文原则」映射 written principles，不失真 | FAITHFUL | PASS | 类比为便于理解，非论文内容 |
| F036 | 第二种靠投票：同一题独立做十遍，多数派答案当训练目标反过来强化自己 | PAPER_CITE | N3b | §5.2 Consistency feedback | TTRL (442) uses majority voting over multiple generated answers at test time to produce reward signals for reinforcement learning | 机制（多采样→多数投票→奖励信号→强化学习）与 TTRL 表述一致；「十遍/十个里七个相同」是本片具体化举例 | FAITHFUL | PASS_WITH_NOTE | 「独立做十遍、七个 42」为举例数字，论文只说 multiple/K 个采样；画面（十个答案卡、七个 42）按举例处理即可，不构成论文数字。特别校准点③已核 |
| F037 | 没有标准答案、无人工参与，答案间一致程度本身就是学习信号 | PAPER_CITE | N3b | §5.2 | When ground-truth labels or reliable external verifiers are unavailable, the agent can generate multiple candidate solutions … use agreement among them as an intrinsic signal | 与论文一致性反馈段完全一致 | EXACT | PASS | — |
| F038 | 这是 TTRL 这类方法的核心逻辑，论文称「一致性反馈」 | PAPER_CITE | N3b | §5.2 | TTRL (442) uses majority voting over multiple generated answers at test time | TTRL 属实、且被归入 Consistency feedback 小节 | EXACT | PASS | — |
| F039 | 直觉合理性：独立算十遍都是 42，答案大概率是 42 | ANALOGY | N3b | §5.2（映射对象） | majority voting can identify a consensus answer | 通俗举例成立；论文同时强调这只是弱信号（见 F040），逐字稿下一段即转折，不失真 | SIMPLIFIED | PASS | 42 为本片示例数字 |
| F040 | 风险「自信地错」：系统误解→十遍错同一处→投票投出 43 反而更自信 | PAPER_FACT | N3c | §5.2 | consistency is only a proxy for correctness. If a model is systematically biased or confidently wrong, repeated sampling may amplify the same error | 「confidently wrong」为论文原词；一致≠正确（proxy）、放大同一错误均原文 | EXACT | PASS | 特别校准点⑤已核：论文确用 confidently wrong 原词（§5.1 与 §5.2 两处） |
| F041 | 阅卷老师与做题学生同一脑子：盲区自己看不见、可能越练越强化 | PAPER_FACT | N3c | §5.2 Trade-offs | the evaluator is often tightly coupled with the policy to be improved, so this loop may reinforce common blind spots | 「评价器与策略紧耦合→强化共同盲区」为论文原文 | EXACT | PASS | — |
| F042 | 保险丝：出题/做题/批卷尽量用不同版本、甚至不同家族的模型 | PAPER_FACT | N3d | §5.2 safeguards | separating the generator and evaluator at different checkpoints or model families | 「不同 checkpoint 或不同模型家族」原文；「运动员/裁判」为类比修辞 | EXACT | PASS | 运动员-裁判类比：类比为便于理解，非论文内容 |
| F043 | 保险丝：保留一小批人类批改的「锚点题」定期校验 | PAPER_FACT | N3d | §5.2 safeguards | maintaining external anchors by retaining human annotations or context-based validation | 「人类标注锚点」为论文原义 | EXACT | PASS | — |
| F044 | 保险丝：评判器意见打架=不确定信号，别急着下结论 | PAPER_FACT | N3d | §5.2 safeguards | treating disagreements between evaluators as signals of uncertainty | 原文直译 | EXACT | PASS | — |

## N4 路径三：亲自下场做实验

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F045 | 写代码跑单元测试：全绿=好代码；报错记下来下一轮改进；无需人打分 | PAPER_FACT | N4a | §5.3.1 | Code generation is the canonical case, since unit tests provide direct pass or fail feedback for proposed programs … the agent can be trained without learning a separate reward model | 保义（论文以代码为典型场景，单元测试直供通过/失败信号） | FAITHFUL | PASS | — |
| F046 | Absolute Zero：AI 自己出题自己作答，答案放进环境执行验证，通过才留作训练数据 | PAPER_CITE | N4a | §5.3.1 | Absolute Zero (419) uses self-play to generate tasks and solutions in an open-ended environment, while execution-based validation determines which solutions are retained for learning. | 与论文表述逐点一致（自产任务 + 执行验证决定保留） | EXACT | PASS | 特别校准点④已核：「出题作答都由 AI、判卷靠执行验证」与 §5.3.1 表述一致 |
| F047 | 「出题的是我、答题的也是我、判卷的是客观世界」三角色表述 | PAPER_FACT | N4a | §5.3.1 | The agent may choose what to try, while the environment determines whether the attempt succeeds. | 三分句为该原句的口语化对仗，保义 | FAITHFUL | PASS | — |
| F048 | 有些实验现实做不起：真实网站试错几万次太慢、易闯祸 | PAPER_FACT | N4b | §5.3.2 | This internal simulation improves sample efficiency and reduces the cost or risk of exploration, especially when direct interaction is slow, expensive, or unsafe | 「太慢/易闯祸」映射 slow/expensive/unsafe，保义；「几万次」为修辞量级 | SIMPLIFIED | PASS | 论文 §5.3.2 提及 GLoW 以 100–800× 更少的真实交互达成效果，可佐证真实交互代价大 |
| F049 | 论文做法：给 AI 配「世界模型」=脑内环境模拟器，行动前先推演 | PAPER_FACT | N4b | §5.3.2 | a learned world model serves as a proxy for the task environment, generating predicted states, rollouts, or outcomes for policy improvement | 「世界模型」为论文术语，脑内模拟器为直译 | FAITHFUL | PASS | §5.3.2 标题即 Interaction with Simulated Proxy Environments |
| F050 | 推演可替代部分真实试错：省时省钱、敢放开手脚 | PAPER_FACT | N4b | §5.3.2 | This internal simulation improves sample efficiency and reduces the cost or risk of exploration | 保义；「错了不心疼」为修辞 | FAITHFUL | PASS | — |
| F051 | 棋手下棋先在脑内演：我走这步、对手应那步 | ANALOGY | N4b | §5.3.2（映射对象） | The policy can then obtain additional experience by interacting with this learned proxy instead of repeatedly querying the original task environment | 棋手推演映射「与内部代理交互替代真实环境」，不失真 | FAITHFUL | PASS | 类比为便于理解，非论文内容；逐字稿自身已带行内免责标注 |
| F052 | 风险一「奖励作弊」：专挑规则字面要求满足而不真解决问题（注水作文类比） | PAPER_FACT | N4c | §5.3.2 Challenges | a foundation-model agent can satisfy the literal condition of a verifier … without solving the underlying task | 「满足字面条件、不解底层任务」为原文；reward hacking 术语论文通篇在用（§5.3 开篇 verifiers can be gamed） | EXACT | PASS | 注水作文为类比：类比为便于理解，非论文内容 |
| F053 | 风险二「能力回退」：窄任务特训侵蚀预训练通用能力（特长生类比） | PAPER_FACT | N4c | §5.3.2 Challenges | Capability regression arises because extensive RL updates on narrow extrinsic rewards can erode the broader competencies the foundation model acquired in pretraining | 「能力回退」= Capability regression 论文原词，成因句直译 | EXACT | PASS | 特长生补数学为类比：类比为便于理解，非论文内容 |
| F054 | 「在窄任务上拼命特训」暗示长时间高强度投入 | PAPER_FACT | N4c | §5.3.2 | extensive RL updates on narrow extrinsic rewards | 论文用 extensive（大量）而非「时间长短」；「拼命特训」可读作强度修辞，保义但略带夸张 | FAITHFUL | PASS_WITH_NOTE | 求稳妥可改「大量特训」；不改亦不构成失实 |
| F055 | 风险三：模拟器不准 →「有幻觉的世界」，学得越认真偏得越远 | PAPER_FACT | N4c | §5.3.2 Challenges | Hallucinated dynamics pose a distinctive risk … generative simulators can fabricate plausible but incorrect transitions that the policy then learns to exploit | 「幻觉动力学」为论文原词；后半句为「策略学着利用错误转移」的修辞化，方向保义 | FAITHFUL | PASS | — |

## N5 保险丝总汇

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F056 | 三条路共同点：比起请人类老师又快又省，但都留着自欺欺人的口子 | PAPER_FACT | N5a | §5.1 / §5.2 / §5.3 / §9.2 | avoid falling into a degenerate, self-deceptive cycle | 「自欺欺人」映射论文 §9.2 self-deceptive cycle；「比起请人类老师，又快又省」指三条路径获取学习信号相对人工监督更快更省（§5.1 人工标注获取成本高、§5.2 人工评估成本高、§5.3 直接交互慢/贵/险），非指 θ 更新的绝对算力开销 | FAITHFUL | PASS | 2026-08-16 口播已按替代文案修订为「比起请人类老师，它们又快又省」，比较基准（人类老师）已显式给出，原歧义消除，升为 PASS |
| F057 | 论文在结尾的设计启示里强调：每次自我修改都要过安检（验证） | PAPER_FACT | N5a | §9.1 | Safety through Layered Gating. | 「结尾的设计启示」= §9.1 Implications for System Design，属实 | EXACT | PASS | 特别校准点⑧位置已核 |
| F058 | 「论文强调」——论文（于结尾设计启示处）强调每分提升靠反馈信号与安全门控 | SPEC | N5a | §9.2 | It necessitates robust feedback mechanisms, safe architectures for self-modification | 该主题句在全文仅出现 1 次（§9.2 末段 "In summary" 后）；口播修订后 N5a 为「在结尾的设计启示里强调」、N6a 为「论文强调」，单次强调与论文唯一命中一致，断言成立 | FAITHFUL | PASS | 2026-08-16 口播已按替代文案修订（N5a 与 N6a 均删「反复」），断言现已成立；REWRITE 闭环 |
| F059 | 流程：修改方案（新数据或新代码）→ 过「验证器」→ 通过才提交生效；通不过自动回滚 | PAPER_FACT | N5a | §9.1 Safety through Layered Gating / §5 开篇 | the proposed patch must pass verifier-gated checks … allowing validation and rollback to prior checkpoints when necessary | 「patch/验证器门控/回滚到 checkpoint」均为论文原文；「新训练数据或新代码」对应 θ/Σ 两类更新对象 | EXACT | PASS | 特别校准点⑥相关流程已核 |
| F060 | 安检不止一道，是一整套「分层门控」：单元测试→权限边界→人工审计层层设卡 | PAPER_FACT | N5b | §9.1 Safety through Layered Gating | layered gating—a strict permission system for self-modification … pass verifier-gated checks, covering functional correctness, tool permission boundaries, and robustness | 「分层门控」为原文小节标题；三道关卡对应 functional correctness / permission boundaries / audited boundaries（论文另有 gated by human audit trails 句支撑人工审计） | EXACT | PASS | — |
| F061 | 论文说：能自我改进的 AI 应当作「在不可信环境里运行的可疑代码」对待 | PAPER_FACT | N5b | §9.1 | a self-improving agent should be conceptualized as untrusted code executing in a protected runtime environment | 原文为 untrusted code（不可信代码）+ protected runtime（受保护运行时）；逐字稿「不可信环境」与原文「受保护运行环境」措辞互换，语义重心一致（不信任本体 + 环境隔离） | FAITHFUL | PASS_WITH_NOTE | 更贴原文的口播：「当作不可信代码，放进受保护的运行环境里执行」；「信任，但要验证」为本片修辞（trust but verify），保义可保留。特别校准点⑥已核 |
| F062 | 「快探索、慢固化」：小改进先在装备层快速试验，验证有效再花大成本固化进大脑参数 | PAPER_FACT | N5b | §9.1 | From Fast Exploration to Slow Consolidation. … Parametric consolidation (through distillation or fine-tuning) can be deferred until the new behavior has proven stable | 小节标题直译 + 策略句保义（先限制在 scaffold 验证、稳定后再参数固化） | EXACT | PASS | 特别校准点⑧已核：标题原文 From Fast Exploration to Slow Consolidation |
| F063 | 「试点随时叫停，转型难掉头」= 可逆性不对称 | ANALOGY | N5b | §9.1（映射对象） | Prompt edits, memory writes, and tool adjustments have minimal computational overhead and are reversible … a regression absorbed into model parameters is notoriously difficult to trace | 试点/推广类比映射论文「Σ 可逆 vs θ 回归难追溯」的原文对比，不失真 | FAITHFUL | PASS | 类比为便于理解，非论文内容 |

## N6 收尾

| fact_id | claim | claim_type | narration_anchor | paper_loc | quote | interpretation | fidelity | verdict | note |
|---|---|---|---|---|---|---|---|---|---|
| F064 | 「智能爆炸」概念：AI 越改越聪明、越聪明越会改 | PAPER_CITE | N6a | §1 / §2.1 | Good (94) introduced the visionary prospect of an "Intelligence Explosion," hypothesizing that machines might one day acquire the capacity to autonomously design more capable successors | 论文确在 §1/§2.1 回顾该思想史；滚雪球表述与原文相容 | EXACT | PASS | 特别校准点⑦已核 |
| F065 | 思想史从上世纪六十年代的猜想开始 | PAPER_CITE | N6a | §2.1 | In the 1960s, Good (94) introduced the visionary prospect of an "Intelligence Explosion" | §2.1 明写 In the 1960s；引言格言署名 I. J. Good (1966) 亦支持 | EXACT | PASS | — |
| F066 | 「哥德尔机」= 理论上完美的自我改进者 | PAPER_CITE | N6a | §1 / §2.3 | Establishing the theoretical ceiling of this pursuit, the Gödel Machine (265) introduced a fully self-referential algorithm designed to rewrite its own code whenever it can mathematically prove an expected-utility improvement | 「理论天花板/理论上最优」为论文原义（§2.3 另有 theoretically optimal） | EXACT | PASS | 特别校准点⑦已核：§1 与 §2.3 双锚 |
| F067 | 现实受限：验证器能力、数据多样性、算力成本 | PAPER_FACT | N6a | §5 Takeaway / §9.1 / §9.2 | success depends on managing the reliability of self-generated signals, mitigating distribution shift, and balancing the computational demands of iterative training | 三因素分别锚：信号可靠性/验证器（§5+§9.1 critic 瓶颈）、数据多样性（§5.1 collapse/knowledge bubble + §9.2 drift）、算力（computational demands/constraints） | FAITHFUL | PASS | — |
| F068 | 每分提升靠扎实反馈信号+严格安全门控，不是玄学滚雪球 | PAPER_FACT | N6a | §9.2（In summary 段） | It necessitates robust feedback mechanisms, safe architectures for self-modification, and a fundamental rethinking of evaluation | 保义（论文 §9.2 收束句的强化转述；原标 §10 有误，§10 结论无此句，2026-08-16 复核修正——「结尾强调」的口播表述不受影响，§9 与 §10 同属论文结尾部分） | FAITHFUL | PASS | paper_loc 已由 §10 修正为 §9.2；2026-08-16 口播 N6a 已删「反复」（「论文强调：AI 自我提升的每一分……」），与 F058 联动复核一致，PASS 不变 |
| F069 | 成绩单能信的四个条件：出题多样性有保障；批卷与做题不同脑子；每分成绩有现实验收；每次自我修改过安检 | PAPER_FACT | N6b | §5.1 / §5.2 / §5.3.1 / §9.1（保险丝归纳） | diversity-aware pooling expansion … separating the generator and evaluator … execution-based validation … layered gating | 四条件分别对应论文四组保险丝；为论文要素的收束式重组，非论文原句，但每项有据 | FAITHFUL | PASS | 视频总结句，锚定自 F029/F042/F046/F059 |
| F070 | 论文最漂亮洞察：大脑与装备=慢循环+快循环双轮驱动 | PAPER_FACT | N6b | §10 | (1) foundation-model improvement as a parametric, slower loop … and (2) scaffolding improvement as a non-parametric, faster loop | 「最漂亮」为评价性修辞，双循环本身为论文结论原文 | FAITHFUL | PASS | — |
| F071 | 金句「AI 正在学会当自己的老师；我们要学的是怎么当它的监考官」 | ANALOGY | N6b | N/A | N/A | 全片类比体系的收束修辞；「监考官」映射论文 §9.1 的 gating/audit/verifier 治理角色，不失真 | FAITHFUL | PASS | 类比为便于理解，非论文内容；S7 分镜已按规范带出处角标 |

---

## 引文出处对照（全部经归一化空白后逐字匹配验证，2026-08-15 于 .temp/factcheck/paper_full.txt）

| # | 论文位置 | 验证过的英文原句 |
|---|---|---|
| Q01 | Abstract | Self-improving autonomous agents are moving from research prototypes to deployed systems. |
| Q02 | Abstract | We offer a system-level framework that represents a modern agent as a configuration coupling a foundation model with an operational scaffold of prompts, memory, tools, and control logic. |
| Q03 | Abstract | self-improvement is formalized as a self-induced update operator that obtains and commits updates to model parameters or scaffold components |
| Q04 | §1 | growing evidence demonstrating that FM-based self-improving agents can yield substantial empirical gains |
| Q05 | §1 | Good articulated possible consequences of machine self-improvement (94), describing the possibility of an "Intelligence Explosion" once machines acquire the capacity to design more capable successors. |
| Q06 | §1 | Establishing the theoretical ceiling of this pursuit, the Gödel Machine (265) introduced a fully self-referential algorithm designed to rewrite its own code whenever it can mathematically prove an expected-utility improvement |
| Q07 | §2.1 | In the 1960s, Good (94) introduced the visionary prospect of an "Intelligence Explosion," hypothesizing that machines might one day acquire the capacity to autonomously design more capable successors |
| Q08 | §2.3 | 265 introduced the Gödel Machine, a fully self-referential, self-improving machine that is theoretically optimal. |
| Q09 | §3.1 Eq.(1)–(2) | θt encapsulates the neural parameters of the foundation model, and Σt denotes the agent's dynamic operational scaffold … pt denotes structured prompts or system instructions, mt denotes memory mechanisms and their retrieval and update policies, Tt denotes the set of external tools together with their invocation interfaces, and gt denotes additional control logic such as routing, scheduling, or safety constraints |
| Q10 | §3.2 | produces a learning signal (e.g., interaction trajectories, reflections, critiques, or proposed edits) |
| Q11 | §3.2 Foundation model improvement | Foundation model improvement typically operates on longer time scales, incurs substantial computational cost, and leads to stable, global changes |
| Q12 | §3.2 Scaffolding improvement | scaffolding improvement is typically faster, more reversible, and more context-dependent |
| Q13 | §5 开篇三分类 | (i) Intrinsic generative demonstrations (§5.1) … (ii) Intrinsic evaluative feedback (§5.2) … (iii) Extrinsic exploratory experience (§5.3) |
| Q14 | §5 开篇 | allowing validation and rollback to prior checkpoints when necessary |
| Q15 | §5 开篇 | the agent effectively serves as its own source of supervision |
| Q16 | §5.1 | massive parameter scales, which inherently demand vast quantities of high-quality training data |
| Q17 | §5.1 | the costly acquisition of human annotations |
| Q18 | §5.1 | FMs act simultaneously as the cognitive learner and the data synthesizer |
| Q19 | §5.1 Generation strategies | The underlying techniques start with a small set of example seeds and then build a larger instruction-output pair corpus. (336; 420) |
| Q20 | §5.1 Generation strategies | Methods such as Evol-Instruct (365) go beyond simple volume expansion. They drive complexity evolution by using LLM to rewrite instructions and gradually increase the difficulty of the instructions |
| Q21 | §5.1 Generation strategies | 124 employs self-consistency to filter high-confidence inference paths, while 293 uses external verifiers like unit tests to select only correct solutions from the model's attempts |
| Q22 | §5.1 Generation strategies | It can break down when the model is confidently wrong, because repeated reasoning may repeatedly converge to the same incorrect conclusion |
| Q23 | §5.1 Challenges | recursively training the model on the generated corpus introduces the risk of model collapse and forgetting |
| Q24 | §5.1 Challenges | Insufficient diversity in generated demonstrations also narrows the solution space and leads to pattern collapse during iterations. |
| Q25 | §5.1 Challenges | agents may get trapped in knowledge bubbles and repeatedly generate data, which reinforces their existing biases and traits instead of generating genuine new capabilities |
| Q26 | §5.1 safeguards | A simple and effective safeguard is to retain artificially generated benchmark data and accumulate generated demonstration data on top of it, which can prevent collapse under repeated training |
| Q27 | §5.1 safeguards | external validators specifically designed for model-generated content (383) and formal systems for inference verification, such as theorem provers (150) |
| Q28 | §5.2 开篇 | The bottleneck in traditional supervisory signal acquisition lies in the high cost of manually labeled preferences and human evaluation. |
| Q29 | §5.2 Rubric feedback | The criteria may be task instructions, grading rubrics, safety principles, constitutional rules, or domain-specific preferences … candidate outputs are scored, ranked, or compared |
| Q30 | §5.2 Rubric feedback | Constitutional AI is a representative early example of this pattern. Instead of relying only on direct human preference labels, the model critiques and ranks outputs according to a set of written principles |
| Q31 | §5.2 Rubric feedback | the same model-based evaluator can be conditioned to assess helpfulness, harmlessness, factuality, reasoning quality, or format compliance |
| Q32 | §5.2 Consistency feedback | When ground-truth labels or reliable external verifiers are unavailable, the agent can generate multiple candidate solutions for the same task and use agreement among them as an intrinsic signal |
| Q33 | §5.2 Consistency feedback | majority voting can identify a consensus answer … TTRL (442) uses majority voting over multiple generated answers at test time to produce reward signals for reinforcement learning. |
| Q34 | §5.2 Consistency feedback | consistency is only a proxy for correctness. If a model is systematically biased or confidently wrong, repeated sampling may amplify the same error |
| Q35 | §5.2 Trade-offs | the evaluator is often tightly coupled with the policy to be improved, so this loop may reinforce common blind spots |
| Q36 | §5.2 Trade-offs | separating the generator and evaluator at different checkpoints or model families, maintaining external anchors by retaining human annotations or context-based validation, treating disagreements between evaluators as signals of uncertainty |
| Q37 | §5.3 开篇 | verifiers can be gamed, and learned world models (258; 271; 194) may produce plausible but counterfactual transitions |
| Q38 | §5.3.1 | Typical settings include code interpreters for coding agents … The learning signal comes from the environment's response—such as state changes, execution traces, or unit tests |
| Q39 | §5.3.1 | Code generation is the canonical case, since unit tests provide direct pass or fail feedback for proposed programs … the agent can be trained without learning a separate reward model |
| Q40 | §5.3.1 | Absolute Zero (419) uses self-play to generate tasks and solutions in an open-ended environment, while execution-based validation determines which solutions are retained for learning. … The agent may choose what to try, while the environment determines whether the attempt succeeds. |
| Q41 | §5.3 开篇（引出 §5.3.2；正文表述 “For interaction with simulated proxy environments, …”） | a learned world model serves as a proxy for the task environment, generating predicted states, rollouts, or outcomes for policy improvement |
| Q42 | §5.3.2 | This internal simulation improves sample efficiency and reduces the cost or risk of exploration, especially when direct interaction is slow, expensive, or unsafe |
| Q43 | §5.3.2 | WebDreamer (99) leverages a web transition model for model-based planning to guide action selection … WMPO (434) learns a pixel-space world model and optimizes the policy over imagined rollouts to avoid costly physical trial-and-error. |
| Q44 | §5.3.2 Challenges | a foundation-model agent can satisfy the literal condition of a verifier (e.g., exploiting prompt loopholes in an LLM judge) without solving the underlying task |
| Q45 | §5.3.2 Challenges | Capability regression arises because extensive RL updates on narrow extrinsic rewards can erode the broader competencies the foundation model acquired in pretraining |
| Q46 | §5.3.2 Challenges | Hallucinated dynamics pose a distinctive risk … generative simulators can fabricate plausible but incorrect transitions that the policy then learns to exploit |
| Q47 | §9.1 From Fast Exploration to Slow Consolidation | Prompt edits, memory writes, and tool adjustments have minimal computational overhead and are reversible … a bad prompt is easily reverted, but a regression absorbed into model parameters is notoriously difficult to trace |
| Q48 | §9.1 From Fast Exploration to Slow Consolidation | When environmental feedback is noisy, it's better to confine updates within the scaffold and validate them through rigorous execution tests. Parametric consolidation (through distillation or fine-tuning) can be deferred until the new behavior has proven stable |
| Q49 | §9.1 The Critic as Governed Infrastructure | gated by human audit trails |
| Q50 | §9.1 Safety through Layered Gating | a self-improving agent should be conceptualized as untrusted code executing in a protected runtime environment … layered gating—a strict permission system for self-modification. Before any structural update is committed to Σt+1 or θt+1, the proposed patch must pass verifier-gated checks, covering functional correctness, tool permission boundaries, and robustness |
| Q51 | §9.2 | avoid falling into a degenerate, self-deceptive cycle |
| Q52 | §10 | (1) foundation-model improvement as a parametric, slower loop … and (2) scaffolding improvement as a non-parametric, faster loop |
| Q53 | §9.2（In summary 段；2026-08-16 复核修正，原标 §10 系误锚——§10 结论中无此句） | It necessitates robust feedback mechanisms, safe architectures for self-modification, and a fundamental rethinking of evaluation |
| Q54 | 参考文献 | I. Shumailov, Z. Shumaylov, Y. Zhao, N. Papernot, R. Anderson, and Y. Gal. AI models collapse when trained on recursively generated data. Nature 631 (8022), pp. 755–759.（Cited by: §5.1） |
| Q55 | 参考文献 | Y. Wang, Y. Kordi, S. Mishra, A. Liu, N. A. Smith, D. Khashabi, and H. Hajishirzi. Self-instruct: aligning language models with self-generated instructions.（§5.1 引用，编号 336；2026-08-16 复核经 HTML bib 锚点（bib.bib262）修正，原标 420 有误——编号 420 为 Zhao et al. 2024b SELF-guide） |
| Q56 | 参考文献 | Zhao et al. (2025a). Absolute zero: reinforced self-play reasoning with zero data.（§5.3.1 引用，编号 419） |
| Q57 | 参考文献 | Zuo et al. (2025). TTRL: test-time reinforcement learning. In The Thirty-ninth Annual Conference on Neural Information Processing Systems（§5.2 引用，编号 442） |
| Q58 | 参考文献 | Bai et al. Constitutional AI: harmlessness from AI feedback.（§5.2 引用，编号 19） |
| Q59 | 参考文献 | WizardLM: empowering large pre-trained language models to follow complex instructions.（Evol-Instruct 方法论文，§5.1 引用，编号 365） |

> **验证方法备注**：以上关键句均在 `paper_full.txt`（自 `.temp/paper-2607.13104.html` 抽取的纯文本）上以「归一化连续空白后的子串精确匹配」逐条跑通（共验证 106 条候选引文片段，全部命中，0 条凭记忆补写）；F069 的 diversity-aware 片段出自 §5.1 safeguards（diversity-aware pooling expansion and selection mechanisms）。页数（97 pages）与提交日期（2026-07-14）取自 arXiv abs 页 Comments 字段。
