# Dream-RSI paper-notes（事实源 · Stage ① 产物）

> **信源**：T. Zheng, X. Wu, Z. Zhang, Z. He, C. Zhang, B. Coleman, *et al.*, "Dream-RSI: Recursive Self-Improvement through Evolving Worlds," arXiv:2609.14858, Sep. 2026.（Google × University of Maryland × Google DeepMind × University of Virginia；代码 github.com/zhengkid/Dream-RSI）
> **提取方式与日期**：2026-09-22，分章并行子代理精读 arXiv HTML v1（冻结 PDF 已存本目录 `dream-rsi-2609.14858.pdf`，gitignored），逐章四段式（主旨/方法/风险/科普素材）+ 数字口径表；与仓内精读笔记 [144-dream-rsi.md](../../../../../docs/research/self-evolution/144-dream-rsi.md) 交叉核对，出入见文末「§纪律」。
> **证据分级**：【论】= 论文原文（含逐字英文，可作字幕角标）；【原】= 本仓最小原型 [`dream_rsi_lab.py`](../../../../../docs/research/self-evolution/assets/dream_rsi_lab.py) 真跑输出（自家实测，一级证据）；【笔】= 144 笔记的引申/重组表述（**不可当论文原话引用**）。
> **本集口播的每一条断言都必须能回溯到本文档某节；回溯不到的不得进入逐字稿。**

---

## §S1+S2 导言与动机：两难与破局

### 主旨综述

§1 定义 RSI 的公共机制——「生成候选解、评估结果、吸收反馈、改进下一轮」的迭代发现循环（discovery loop），并指出发现日益需要在大搜索空间上做长程探索（动辄数千次提案-评估循环，转引 Ye et al. 2026 / OpenAI 2026），探索编排能力成为 RSI 效率与可扩展性的瓶颈。两难：主流系统依赖人工设计、基本固定（largely fixed）的探索策略，无法从累积经验变聪明、可能（may）反复把算力投向无效方向；在线优化策略又撞两个元级瓶颈——元级反馈延迟且昂贵（评估一个策略要看它如何塑造后续许多轮提案-评估），元策略空间巨大（候选可能差、要试多个）——合流即「每个候选策略都可能要一趟漫长在线推演才拿到有用反馈」。破局直觉【论】："our key intuition is simple: a fast and inexpensive simulator of discovery would allow many exploration policies to be evaluated before costly online deployment." → "Surprisingly, completed discovery histories already provide such a simulator." §2 以导航-地图类比（首次穿越记地图，规划不必重走）与 model-based RL / Dreamer 世界模型锚定方法论出处；定义重放模拟器【论】："an empirical replay simulator: a grounded model of the portion of the discovery space that has already been observed"（**逐字原句在 §2/Figure 2，不在 §3**）。§1 末给出框架（Figure 1/2）与 8 任务 3 域实证摘要。

### 形式化定义

| 符号 | 含义 | 白话 |
|---|---|---|
| discovery loop | generate candidates → evaluate → incorporate feedback → refine（§1 原句） | 提案-评估-反馈-再改进的转圈 |
| exploration policy | 决定 pursue 哪些方向 / refine 哪些候选 / 哪些分支并行 / 何时终止 | 领队章程：管方向、深挖、并行、收工 |
| discovery tree | a structured tree of past exploration decisions and their realized code-execution outcomes | 每次尝试记一页、按继承关系长成树的台账 |
| replay simulator（= worlds，脚注同义混用） | 已观测发现空间的经验重放模拟器 | 旧台账当免费试验场，只覆盖走过的地方 |
| dreaming | 在重放模拟器上做快速模拟式评估（"a fast, simulation-based 'dreaming' procedure"） | 脑内沙盘试新章程 |
| meta-exploration layer | RSI 闭环闭在元探索层（closing a RSI loop at the meta-exploration layer） | 改的不是解，是找解的方法 |

### 机制方法

- **轻量编排层**【论】："We first make exploration explicit and programmable through a lightweight orchestration layer that controls branching, parallel exploration, and stopping while leaving the underlying coding agent unchanged."（只管分支/并行/停止三件事，底层 coding agent 原封不动）
- **历史即重放模拟器**【论】："Because all execution outcomes are already saved in the tree, evaluating a new strategy requires only reading past records without rerunning the underlying discovery agent or evaluator."（免费的本质）
- **做梦式改进**【论】："This transforms meta-policy improvement from an expensive online trial-and-error process into a fast, simulation-based 'dreaming' procedure."
- **三阶段闭环**（Figure 1）：Online Exploration → Simulator Construction → Dreaming-based Policy Improvement → 重新上线扩充模拟器池。
- **成本不对称地基**【论】："Consequently, a single expensive online discovery run can support many inexpensive evaluations of alternative exploration strategies."
- **Figure 2 图注**【论】："Since all node outcomes are pre-stored, a single costly online run enables thousands of rapid, zero-execution-cost off-policy evaluations."

### 风险/边界（本章原文）

- 固定策略失败模式【论】："Fixed strategies cannot improve from accumulated discovery experience and may repeatedly allocate computation to ineffective search directions."（注意 may / cannot improve 的准确措辞）
- 在线优化两瓶颈【论】："feedback is delayed and expensive at the meta level" + "the meta-policy space is vast"；合流【论】："each policy may require a long online rollout before receiving useful feedback, making it difficult to efficiently close the self-improvement loop at the exploration layer."
- 保真边界写在定义里（只建模已观测部分）；更细缺口（单链冻结/根开枝序/realized-space 偏置）本章未展开。
- 与既有工作分界【论】："While prior work treats past discovery history merely as static textual context … or training data for weight fine-tuning …, a completed discovery process inherently records a structured tree…"

### 科普素材（金句/反直觉/画面建议）

| 标签 | 英文原句（逐字） | 中文白话 | 画面建议 |
|---|---|---|---|
| 破局句·题眼 | "a fast and inexpensive simulator of discovery would allow many exploration policies to be evaluated before costly online deployment." | 快又便宜的发现模拟器，让大量策略在烧钱上线前先被评估 | 左边真实实验烧币，右边沙盘瞬间亮分 |
| 反直觉 | "Surprisingly, completed discovery histories already provide such a simulator." | 已完成的历史本身就是这个模拟器 | 落灰旧台账掀开摊平成沙盘 |
| 免费本质 | "…evaluating a new strategy requires only reading past records without rerunning the underlying discovery agent or evaluator." | 评估=翻读旧记录，agent/评估器一次不重跑 | 手指沿树滑动抄分；两图标挂「未调用」 |
| 数字 | "a single costly online run enables thousands of rapid, zero-execution-cost off-policy evaluations."（Figure 2 图注） | 一次昂贵在线运行→成千上万次零成本评估 | 金币进机器出整棵树，回放计数器狂滚 |
| 论文原生类比 | "Once recorded, however, this experience becomes reusable: the resulting map supports planning without requiring the agent to physically revisit every location."（§2） | 走过的路记成地图，规划不必重走 | 首次穿越画线打叉，同图被多色笔反复规划 |
| 历史三用法 | （见上面分界句） | 同一本台账：贴 prompt / 训练漏斗 / 立体展开成树 | 三用法并排 |

### 数字（含口径）

| 值 | 断言 | 口径 | 出处 |
|---|---|---|---|
| thousands of cycles | 长程探索规模量级 | 描述性量级，转引 Ye 2026/OpenAI 2026 | §1 |
| up to 162× | Lasso 上 vs SimpleTES 调用节省 | §1 明写 **agent calls**、带 up to；无方差 | §1 |
| 1.7× | vs 固定探索基线调用节省 | 同句 agent calls 口径 | §1 |
| within 1k generations | 数学任务匹敌强基线 | generations 口径 | §1 |
| over 50× | 数学任务 vs SimpleTES 预算节省 | budget 单位（generations/evaluations）§1 未定义——口径未说明 | §1 |
| 1.79×–2.43× fewer generations | KernelBench 更少代数达目标 | generations；目标绝对值未给 | §1 |
| up to 2.09× | 同预算内核性能提升 | kernel performance（inverse runtime）；无绝对数值 | §1 |
| 8 tasks / 3 domains | 实证覆盖 | 论文自述计数 | §1 |

---

## §S3 方法核心：发现树 · 重放 · 重放分 · 改进与选择

### 主旨综述

外层迭代 t：在线阶段策略 πt（代码固定）跑真实 rollout——最多 K₁ 轮，每轮从 A(𝒯)={r}∪已见叶子选批次 C（|C|≤W）派给 W 个 worker，固定 discovery agent 生成、固定 evaluator 评分，转移**随机**；产出发现树 𝒯t 并入历史 ℋt。离线阶段历史冻结：每棵历史树是一个重放世界，重置到根、逐轮**确定性**揭示（非根→唯一记录子节点；根→最早创建的未揭示子节点），最多 K₂ 轮；按 Eq.1 三分量重放分打分，策略版本分 V^m 为 t 棵树平均；固定 LLM 的 policy-development agent 依重放轨迹与得分修订策略代码共 M 版，最后在**含现任策略**的候选集上 argmax（V*≥V⁰），胜者上线。全章不变量【论】："Only the exploration-policy code changes; the underlying models, evaluator, and execution interfaces remain fixed."

### 形式化定义（正文符号，全部无实验取值）

| 符号 | 含义 | 白话 |
|---|---|---|
| r | 根=初始 workspace 状态 | 出发前的空营地 |
| primary parent | 每个非根节点 v 恰有一个，标识尝试从哪开始；agent 恢复父 workspace 产出新尝试 | 每页台账唯一指认前一页 |
| s_v | 节点分，固定评分协议，越大越好 | 这次尝试值多少分 |
| A(𝒯)={r}∪已见叶子 | 可选节点集（叶子由当前观测树决定） | 根和已见叶子才可选 |
| C ⊆ A(𝒯)，|C|≤W | 动作=批次；W=并行 worker 数（例举并发 API 调用） | 一轮最多派 W 个出发点的编组 |
| ℋt = ℋt−1 ∪ {𝒯t} | 外层迭代后终树并入历史 | 越铺越大的沙盘册 |
| K₁ / K₂ | 在线 / 重放决策轮上限 | 进山回合上限 / 推演回合上限 |
| Child(v) | 重放转移：非根→唯一记录子（若存在）；根→最早创建未揭示子；无记录延续则 ∅ | 翻台账规则 |
| N_i^m = |终局子树|−1 | 揭示的非根节点数 = 轨迹代表的生成-评估请求数（**计费照旧**） | 推演折算真实计费的动作数 |
| V_i^m（Eq.1） | max s_v（质量）− β₁·N（成本）+ β₂·N/max{1,k}（并行奖，每轮平均尝试数） | 最好收获 − 翻页工钱 + 并行效率奖 |
| V^m = (1/t)ΣV_i^m | 版本分 = 全部历史树平均 | 候选章程跨全部沙盘的平均成绩 |
| M ≥ 1 | 离线构造并评估的策略版本数（πt^0=πt 起） | 幕僚长这轮改几版（含原版） |
| πt+1 = argmax_m V^m；V^m* ≥ V⁰ | 候选含现任 ⇒ 防回退下界 | 名单永远保留现任，改不动就不换 |

### 机制方法（含逐字锚点）

- **发现树**【论】："Node v preserves this inherited history and records the outcome of the new generation–evaluation attempt, including the resulting filesystem snapshot, generated artifact, evaluation diagnostics, and score s_v."
- **共享决策接口**【论】："Both the online and offline phases use this same decision interface but differ in the transition that follows a selected batch."（在线/离线同一接口，只差转移规则）
- **在线随机 vs 重放确定**【论】："This transition is stochastic because the discovery agent may generate different outcomes from the same starting workspace." / "Unlike online execution, replay returns recorded children of the selected nodes deterministically rather than generating new candidates."
- **重放封顶**【论】："These decisions may differ across policies, but each branch is traversed in its recorded parent–child order, and no outcomes beyond 𝒯_i are generated."
- **计费口径**【论】："Although replay itself does not execute new discovery attempts, N_i^m counts the generation–evaluation requests represented by its trajectory."（假装你花了钱的正文依据）
- **并行奖语义**【论】："For a nonempty replay, the third rewards the average number of attempts executed per decision round, favoring policies that batch useful continuations rather than execute them sequentially."
- **防回退**【论】："Because the candidate set includes the current policy, this selection satisfies V^{m⋆} ≥ V^{0}." / 限定语："the selected policy π_{t+1} is no worse than the current policy π_t **in average replay score on the fixed history ℋ_t**."（保证只覆盖固定历史重放分，不覆盖在线表现）
- **重放评估三问**【论】："replay evaluates how far to pursue each opened branch, how to group attempts into parallel batches, and when to open another branch or stop."
- **递归闭环**【论】："The selected policy is then deployed online to collect 𝒯_{t+1}, expanding the history available for the next offline improvement phase."

### 风险/边界

- 保真封顶：no outcomes beyond 𝒯_i；根只能按 earliest-created 开枝（策略无法在重放里选择先开哪条未开分支）。
- 在线/离线转移不对称：随机 vs 确定成对陈述；重放把随机性固化为已记录单一结果。
- **源文本内部差一**：修订循环句 "For each m = 0, …, M−1 … produce π_t^{m+1}"（逐字执行产出 M+1 版）与总结句 "from all M evaluated versions"（M 版）不一致——复述按总结句口径，**不逐一数版本数**。

### 科普素材

| 标签 | 英文原句 | 中文白话 | 画面建议 |
|---|---|---|---|
| 金句（昼夜） | "Dream-RSI alternates between online exploration and offline 'dreaming' to improve an executable exploration policy that allocates discovery computation."（§3 开篇） | 在线探索与离线做梦交替，改进一段分配发现算力的可执行策略 | 昼夜循环：白天进山，夜里沙盘 |
| 金句 | "The resulting discovery tree serves as a replay world in which alternative policies can be evaluated using recorded outcomes." | 发现树=重放世界 | 台账拼成立体树变沙盘 |
| 反直觉 | "Unlike online execution, replay returns recorded children … deterministically rather than generating new candidates." | 重放只翻档案抄结果，不生成新候选 | 分屏：左掷骰子长新枝，右翻档案抄分 |
| 数字（计费） | "Although replay itself does not execute new discovery attempts, N_i^m counts the generation–evaluation requests represented by its trajectory." | 推演免费、计价照旧 | 每翻一页计费器跳一格 |

---

## §S4 实验：三域证据（口径是本章最高纪律）

### 主旨综述

三域：算法工程（Lasso 路径求解器，§4.1）、数学优化（Sum-Diff/Circle Packing/Autocorrelation，§4.2，Table 1）、GPU 内核（KernelBench 四任务，§4.3，Figure 4）。主对照=受控基线 **Recursive Fixed Exploration**【论】："uses the same underlying discovery setting and initialization but keeps the exploration policy fixed across recursive discovery rounds"——同 discovery agent（Gemini-3.1 Pro / Gemini-3.7-Flash 经 Gemini CLI）、评估器、初始化、资源预算与同一人工初始「并行精炼」策略，首轮完全同轨 ⇒ 收益可归因到策略层。**§4.1 以 discovery-agent calls 计成本（"The discovery cost is quantified by the total cumulative number of discovery-agent calls."）；§4.2/§4.3 换用 generations；两者换算关系论文未定义。全章无方差/多种子/重复运行说明；kernel 结果只有曲线倍率无绝对数值。**

### 关键数字总表（逐条带口径）

| 值 | 断言 | 口径 | 出处 |
|---|---|---|---|
| **317** | Dream-RSI(Pro) Lasso 发现总成本 | 累计 discovery-agent calls（5 轮；每轮上限 110=10 工作区×至多 11 步；317<550 的逐轮分解论文未说明） | §4/Fig 3(a) |
| **550** | 受控基线(Pro) 同口径成本 | =5×110，累计 agent calls | Fig 3(a) |
| **51,200** | SimpleTES 预算 | **generations**（自报，模型 gpt-oss-120b）；51,200/317≈161.5 是换算值，原文只说 "roughly two orders of magnitude" | §4.1/§4.2 |
| 1879 / 3200 | Flash 组同口径对 | 累计 agent calls（每轮上限 640=32×20） | Fig 3(a) |
| **2931.0 vs 3587.1 ms** | Pro 组六留出集平均墙钟运行时（Dream-RSI 更低=更优） | ms，六值算术平均，越低越好 | Fig 3(a) |
| 2350.6 vs 2516.7 ms | Flash 组平均运行时 | 同上 | Fig 3(a) |
| 3804.8 / 8318.4 / 44180.3 / 13767.5 ms | SimpleTES / SimpleTES† / sklearn / glmnet 平均运行时 | SimpleTES†（dagger）含义**论文未解释** | Fig 3(a) |
| 逐数据集 | Gisette 2841.0 vs 3141.9（约 9.6% 优）；RCV1 14616.0 vs 19625.6（约 25.5% 优）；DNA 49.9 vs 15.9；Leukemia 30.2 vs 15.5；Colon 16.4 vs 11.6；Duke 32.5 vs 18.1——**四个生物小数据集全部劣于 SimpleTES**；对受控基线逐列仅 RCV1 占优 | ms vs SimpleTES；逐列对比为表内算术，论文未作此逐列表述 | Fig 3(a) |
| Breast（表头第 7 名） | 表头 7 个数据集名但每行仅 6 值且 Avg=六值均值；sklearn 行仅 5 个可见数值 | 表内不自洽，论文未展开 | Fig 3(a) 表头 |
| **1.145427**（↑） | Sum Diff 最佳（RFE 1.144047、SimpleTES 1.143975）；对 RFE 优势 0.00138（第 3 位小数） | 任务目标分数，越高越好；无方差 | Table 1 |
| **1.456375**（↓） | Autocorrelation：劣于 SimpleTES 1.453675（SOTA）与 RFE 1.456001（差 0.000374） | 越低越好；论文自评仅 "remaining competitive"；AlphaEvolve 1.455700、ShinkaEvolve 1.457800、EvoX 1.458900、OpenEvolve 1.460000、ThetaEvolve 1.493000 | Table 1 |
| **2.635983**（↑，并列最佳） | Circle Packing 与 RFE/SimpleTES/ThetaEvolve/TTS-Discovery/AlphaEvolveV2 并列；差异集中第 5-6 位小数 | 越高越好；无方差 | Table 1 |
| fewer than 1,000 generations | 数学任务 Dream-RSI 算力（10 轮、Pro） | **generations**（本章口径切换处）；只给上界无精确值 | §4.2 |
| **2.43× / 1.79× / 2.09× / 1.44×** | VGG16/LayerNorm 更少代数达可比性能；ConvDiv/ConvMax 同预算性能更高 | 倍率=曲线读数，**无绝对数值**；性能=inverse runtime(1/ms) 越高越好须过 correctness checks；kernel 轮数论文未说明 | Figure 4 |
| 5 轮 / 10 轮 | Lasso / 数学任务递归轮数 | recursive rounds | §4.1/§4.2 |
| 17 | Lasso 发现期合成训练实例数（与 SimpleTES 同） | 合成实例覆盖四维度；发现/评估分布分离 | §4.1 |
| （无） | 全 §4 无 error bar/种子/重复 | 单次运行口径（论文未说明） | §4 全节 |

### 关键原文

- 成本口径【论】："The discovery cost is quantified by the total cumulative number of discovery-agent calls."
- 162× 原句【论】："Compared with SimpleTES, which uses 51,200 generations, Dream-RSI achieves **lower average downstream runtime** with roughly two orders of magnitude fewer discovery-agent calls."（**是运行时更低（质量更优），不是「同质量」**）
- 每轮预算【论】："each round for Gemini-3.1 Pro executes 10 parallel workspaces with up to 11 refinement steps (10×11=110 discovery-agent calls), whereas Gemini-3.7-Flash operates 32 parallel workspaces with up to 20 refinement steps (32×20=640 calls)."
- 特化自评【论】："Notably, the program discovered by Gemini-3.1-Pro appears particularly well suited to large-scale matrices such as RCV1."（带 appears 限定）/ "Gemini-3.7-Flash discovers a more general-purpose program that performs consistently across different problem scales."
- 全六留出集胜标准实现【论】："the resulting solvers also outperform the standard sklearn and glmnet implementations on all six held-out datasets."
- Autocorrelation 原话【论】："For Autocorrelation, Dream-RSI obtains 1.456375, remaining competitive with existing discovery systems."（论文不说 matches/surpasses）
- 基线 SOTA 反例【论】："Notably, SimpleTES achieves state-of-the-art performance on Autocorrelation Inequalities, but requires 51,200 generations, significantly more than the fewer than 1,000 generations used by our approach."
- kernel 四倍率【论】："On VGG16 and LayerNorm, Dream-RSI reaches comparable performance with 2.43× and 1.79× fewer generations, respectively. On ConvDiv and ConvMax, it achieves 2.09× and 1.44× higher performance under comparable discovery budgets. Higher is better for all tasks."
- 收束【论】："These results show that adapting the exploration policy across recursive rounds can improve the efficiency and effectiveness of long-horizon discovery."

---

## §S5–S7 分析 · 相关工作 · 结论

### §5.1 语义引导消融（ConvDiv，等预算，Figure 5 四条件）

- 处理：把先前轨迹抽象成高层方向性洞见注入 prompt，同时施加于两种范式（Recursive Fixed Exploration 与 Dream-RSI）。
- 结论【论】："explicit directional guidance consistently underperforms its unguided counterpart across both paradigms under equivalent discovery budgets."
- 归因【论】："imposing strong semantic inductive biases regarding future search directions tends to over-constrain the search space and impede diverse exploration."
- 金句【论】："Using history as an interactive replay simulator outperforms using it only as guidance."
- 设置口径：横轴 0–1,000 generations、纵轴 0.4–2.0（1/ms）、四条件；具体预算数值论文未说明。

### §5.2 探索行为演化（ConvDiv，E0–E8 共 9 轮，Figure 6）

- 金句【论】："as performance improves, it initially conserves discovery compute (e.g., reducing the number of evaluated attempts from 110 to 50)" + "When progress subsequently plateaus, it increases exploration effort again, coinciding with further performance gains."
- 逐轮评估次数（图内数据，PDF 文本层逐点核验）：**110, 110, 87, 80, 50, 92, 80, 91, 86**。
- 逐轮最优性能（同法核验）：**0.427, 0.625, 0.855, 1.403, 1.488, 1.499, 1.770, 1.880, 1.898**。
- **口径警示**：纵轴单位 **Performance (1/ms)**（inverse runtime，越高越好，须过正确性检查），且是 round-best（每轮最优）口径——口播不得说成「准确率」；「evaluated attempt」的判定定义论文未说明；110 的锚点=每轮预算上限 110 次（10×11）。

### §6 Related Work（三段版图）

- AlphaEvolve 谱系（AlphaEvolve/OpenEvolve/CodeEvolve/ShinkaEvolve/PACEvolve/DeltaEvolve/MLEvolve）= LLM 迭代生成-评估-精炼候选解。
- 强调探索本身的新一代：SkyDiscover（自适应发现基础设施）、SwarmResearch（动态编排多分支）、**EvoX**（"explicitly optimizes search strategies rather than only candidate solutions"——元进化最近邻）。
- 经验复用三用法：语义增量结构化进化历史（DeltaEvolve）/ 跨分支回顾信息（SwarmResearch、MLEvolve）/ 上下文-库-技能存取改进。
- 自定位【论】："rather than using exploration history only as context or memory for the next decision, we organize it as a replay simulator in which many alternative exploration controllers can be evaluated cheaply" + "Dream-RSI makes this meta-level optimization recursive and off-policy by turning accumulated discovery history into replay simulators, allowing exploration controllers to be repeatedly evaluated, improved, and redeployed without rerunning the underlying discovery process."
- 元级瓶颈复述【论】："useful supervision for exploration strategies is expensive and delayed because their quality often becomes apparent only after long discovery rollouts."

### §7 结论

- 套娃金句【论】："We presented Dream-RSI, a framework for recursive self-improvement of exploration in recursive self improvement."
- 核心瓶颈句【论】："By converting accumulated discovery history from static context into an active, replayable simulator, Dream-RSI addresses the core bottleneck of meta-optimization: delayed and expensive feedback, which is especially severe in long-horizon discovery settings."
- 做梦句【论】："By 'dreaming' within replay simulators constructed from historical discovery trees, Dream-RSI evaluates candidate exploration policies rapidly and at negligible execution cost."
- **结论措辞带保留**【论】："achieves competitive or improved discovery quality while substantially reducing discovery cost **in several settings**"——非全面碾压表述。**§5–§7 无独立 limitation 段**（论文未展开边界讨论）。

---

## §A2 附录：实现口径的唯一窗口

### 附录 A 空壳（实证）

HTML 版提取文本仅 **77 字节 / 4 行**，唯一内容是重复两次的标题行；任务形式化定义完全缺失。正文引用为 §4.2 的**无字母** "Formal definitions of the three tasks are provided in Appendix."（§4.1 另有 "Appendix C"）。

### 正文 Eq.1 vs 附录 B.2 实际评估器（口径分裂，如实记录）

| 维度 | 正文 Eq.1 | 附录 B.2 实际 |
|---|---|---|
| 目标 | max s − β₁·N + β₂·N/max{1,k}（三项代数和） | `pareto.reward = pareto.auc − λ·parallel_penalty`（两项） |
| 并行 | 加法奖励（不除 W） | **减法罚** = effective_sequential_rounds/total_probes 对 beta 扫描取均值；串行罚≈1、满批→1/W（含 ceil(k/W)） |
| 系数 | 固定 β₁/β₂ | λ + 对策略内单一 **beta 旋钮做网格扫描**（beta 与 β₁/β₂ 无对应关系，三重角色：episode 内固定/离线扫描/下版默认选定） |
| 成本项 | 线性 β₁·N | 无独立项（折入 AUC 的 attainment–probes 权衡） |
| 环境 | 单根发现树 | 多根 branch×attempt 网格，plan_grid 先定 branch_count/refine_count |
| 预算 | 重放至多 K₂ 轮 | "Replay calls with `budget=None` … do not assume a budget cap exists" |
| 目标函数版本 | — | "A legacy AUC-only sweep … is not numerically comparable to the current reward"（评估器在演进） |

- 术语漂移：正文 **policy-development agent**，B.2 称 **controller-development agent**。
- prefix-only 硬约束全清单【论】："Never use unrevealed scores, a true optimum, hardcoded winning cell ids, absolute score targets, or internal trace data."
- 动态组合批次【论】："Build one **dynamic portfolio** batch of independent candidates, up to `question.max_parallelism`: exploitation (strong normal refinements), exploration (new roots or underexplored branches), and at most one recovery (an actual repairable failure)."
- λ 取值、beta 网格取点、hard_max_* 数值均无任何数字（引用符号不得配数值）。

---

## §原型 最小原型真跑输出（一级证据，2026-09-22 复跑核验）

> 自家玩具域（配方工坊五分支预录轨迹），纯标准库 489 行、确定性、秒级；`--selftest` 6 组断言全过（含重放确定性、V*≥V⁰ 成立）。**144 §3–§7 全部原型数字经复跑逐项核验一致，零不符。**

### T1 四策略重放分（同一棵 12 节点树）

```text
π1-parallel_refine  V=0.8280（N=12 rounds=5 max=0.90）
π*-adaptive         V=0.8520（N=8  rounds=5 max=0.90）← 最高
π-stop_early        V=0.7600
π-serial_depth      V=0.7700
```

### 两轮递归（dream_loop）

- t=1：π1 并行铺满，3 分支 12 探测，best=0.90。**首轮起第三轮批次 {root, B 叶, A 叶} 三 worker 并出**：#4 初始 s=0.50 / #5 陷阱方向 s=0.35 / #6 稳定突破 s=0.80（自测输出逐字）。
- 离线做梦：π1 得 0.8280、自适应修订版得 0.8520 → 自适应胜出。
- t=2：胜出章程上线，11 探测 best=0.92；第 5 轮批次 {7,8,0} 经分支归属核验 = **{C 分支叶, E 分支叶, root}**——exploit+explore+开新根（对应 B.2 动态组合批次）。

### 破坏性实验 D1–D5（全部真跑输出）

| # | 拆什么 | 实测 | 教训 |
|---|---|---|---|
| D1 | argmax 候选池排除现任 | 被迫选 serial_depth（V=0.7700，π1 的 0.8280 本应兜底）；t=2 五轮各单探测 {0}/{1}/{2}/{3}/{4}，**终局 max=0.80、仅 5 探测**（对照正常 t=2 的 0.92/11 探测） | 候选包含保证=零成本防回退保险 |
| D2 | β₂=0 | V(parallel) 0.8280→0.5400、V(serial) 0.7700→0.6500；排名 parallel>serial → serial≥parallel | 并行奖是唯一反映「批次即省墙钟」的项 |
| D3 | β₁=0 | adaptive 0.8520→1.0920、reveal_all 升至 1.1400（N=10）反超胜出 argmax | 成本罚是唯一约束预算的项，拔掉即只看 max 分 |
| D4 | 重放越权（跳读最优记录后代） | stop_early：honest V=0.7600（max=0.70，N=2）→ cheat **V=0.8600**（一步跳中 A2 max=0.80）**反超 adaptive 0.8520**——最弱策略被误判为最优 | 评估必须对真实探测成本负责；初版「想象分支」0.788 未复现反转（史实，现版代码已不可复跑） |
| D5 | 语义引导替代重放（「深耕香料最有前途」注入） | 引导版五轮全在分支 A（0.55→0.70→0.80→0.79→0.79）终局 **max=0.80 锁死**；重放改进版 t=2 终局 **0.92**（可达 E 分支） | 强语义偏置 over-constrain（论文 §5.1 的玩具域复现） |

---

## §纪律：与 144 笔记的出入 → 口播硬规则

> Stage ① 分章代理对照核验的出入清单。**写逐字稿前必读；每条都是禁写规则。**

1. **「四条设计规格」是笔记的重组，不是论文清单**：规格①②④在 §1 有逐字锚点，规格③（下界保证）**§1/§2 完全未出现**（是 §3 机制）。口播禁说「论文提出四条设计规格」；「探索策略=一段可执行代码」的代码形态是 §3 起的内容，介绍时要落在机制段。
2. **「元级评估的最忠实模拟器就是真实环境本身」是笔记引申句，S1/S2 无此表述**——不可作为论文原话引用（可作叙事转场话术，不带「论文说」）。
3. **系统名归属**：§1 现状句是作者-年份引用；逐字系统名位置——SimpleTES 在 §1，AlphaEvolve 在 §4，PACEvolve/MLEvolve/DeltaEvolve 在 §6。口播点名系统时的取证锚点须对号；角标呈现不受限。
4. **探险队/沙盘/章程总类比是本仓笔记自创教学类比**；论文原生类比是导航-地图（§2，引 Gupta 2017）与 model-based RL/Dreamer。两者不得混称为「论文的类比」。
5. **162× 口径**：原文 "roughly two orders of magnitude"，且是「**运行时更低**（质量更优）+ 调用少两个数量级」，**不是「同质量」**；≈162× 是换算值（51,200/317≈161.5）。数学任务还有第二处口径切换（agent calls → generations，<1,000）。
6. **Autocorrelation 论文自评只说 "remaining competitive"**（SimpleTES 才是该任务 SOTA）；"matches or surpasses" 短语不出现在 §4 正文。
7. **Figure 6(a) 纵轴是 Performance (1/ms)（inverse runtime，round-best），不是准确率**；「evaluated attempt」判定定义论文未说明。
8. **弱化词不可脱落**：固定策略是 "largely fixed"（基本固定）；算力投向无效方向带 "may"；数千次循环是转引量级（thousands of，非本文测量）。
9. **§5–§7 无 limitation 段**——批判性边界（相关性零消融/成本零报告/口径分裂/无方差/保真度缺口）是**笔记作者的批判分析**，口播框架必须是「论文没有证明/没有报告的事」（否定式），不得说成「论文承认的局限」（除 §4.1 成本口径与 §5.1 over-constrain 这两处论文自述外）。
10. **正文内部差一**（M 版循环句 vs 总结句）：复述一律「M 个已评估版本、argmax 含现任」，不逐一数版本。
11. **保真度声明逐字句锚定 §2/Figure 2**（不是 §3）。
12. **附录 A 空壳**实证 77 字节；正文引用是无字母 "Appendix"（§4.2）——「正文引用附录 A」是推断成立，口播说「附录里的任务定义其实是空的」即可，别说「正文点名引用附录 A」。
13. **B.2 深挖补充**（笔记未列）：环境结构差异（单根树 vs 多根网格）、budget=None vs K₂、目标函数有历史版本（AUC-only 不可比）——引用分裂时以「正文-附录在环境结构/预算语义上也有出入」为上限。
14. **附录 B.2 的 beta ≠ 正文 β₁/β₂**——引分裂时必须区分「正文目标系数」与「策略内行为旋钮」。
15. **D4 初版 0.788 是史实记录**（现版代码不可复现）——只作「以真跑输出为准」金句素材，不作反转证据。

### 验收记录

- 抽 10 条断言回溯：①162×→§S4 表（up to 162× 行）；②317/550→§S4；③110→50→§S5.2 金句；④0.427→1.898→§S5.2 数字行；⑤0.8280/0.8520→§原型；⑥D4 0.7600→0.8600→§原型；⑦grounded 声明→§S1+S2 定义行；⑧"Only the exploration-policy code changes"→§S3 综述；⑨pareto.reward→§A2 表；⑩七系统名→§S6。全部命中 ✅。
- 原型复跑：selftest + D1–D5 全过，144 数字零不符 ✅。
