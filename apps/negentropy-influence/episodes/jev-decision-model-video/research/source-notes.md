# 事实源：《只填格的判读员：Jev 决策模型》（B 型 · source-notes）

> **本集口播的单一事实源**。逐字稿（`../script/narration.md`）里的每一条断言都必须能回溯到本文件的某一节；回溯不到的不得进入口播。信源台账（URL · 固定提交 · 指纹）见 [sources.toml](./sources.toml)，本文件只引用条目名，不重抄 URL。
>
> 总类比 SSOT：《类比计划》§4.3（角色单射表）· §4.4（故事线）· §4.5（失配边界）· §6（复述终检补录）。**角色只从 §4.3 取，禁止临场造角色**；本文件每节末尾给出该幕的类比锚点与失配拦截点。

## 证据三级（本集口径，映射「数字可信度」三级角标）

| 级 | 含义 | 口播允许的表述 | 可信度角标 |
|---|---|---|---|
| 【一】 | 仓库文件/代码实测，**可复算**：本仓钉提交原型与复刻实测、钉提交参考代码、本片在固定提交/固定快照上复算出的数字 | 可直接断言，但必须带对象限定（玩具原型 / 复刻模型·非 Jev / 复算） | 我们复算（实底） |
| 【二】 | 官方站点/文档正文（docs / blog / evals / 首页） | 可断言，属性能数字时须带「官方自报」口吻 | 官方自报（虚线） |
| 【三】 | 他人对闭源产品的分析与实测：实测类（Hume 探测、JevBench、LangChain、Hayashi、distil、nibzard、kev 对拍）与推断/论证类（Hume 架构推断、Di Zhang、Molas） | **前 3 句内必须出现归属句**（「有独立研究者测过，他说…」），不得说成产品既成事实 | 第三方实测（实线）／推断（灰斜体） |

- 复算过原始数据的第三数字，标【三·复算✓】：归属句照写，可加一句「他公开了原始数据，我们在固定提交上重算过，数字对得上」。
- 【一】中的两类数字必须带对象限定，防止观众把「机制演示」误听成 Jev 真机表现：**·原型**＝`jev_lab.py` 关键词打分 mock（验证机制自洽，不验证模型聪明）；**·复刻**＝laya 复刻模型实测（真实模型、非 Jev）。

### 信源条目一览（sources.toml 条目名 · 证据级）

- 主轨：【一】note-200（200 精读笔记，机制载荷与证据分级 SSOT，钉 `40bf690`）· lab（`jev_lab.py` 原型）· laya-replica-results（复刻实测 9 实验）· adapter-confidence（官方参考 adapter，MIT，钉 `e1d4cc9`）
- 上游一手：【二】api-docs · models-docs · confidence-docs · primitives-docs · jaggedness · primer · how-to-build · launch-blog · evals-site
- 复刻与第三方实测：【三】kev-readme · laya-readme · nibzard-readme · hume-reverse · langchain-judge · jevbench · dice · distil · molas
- **不进正片**：mapping-201（本仓机制映射，系列规则）；`.temp/jev-lab/sources/secondary/`（中文社区转述，15 处口径失真存档）

### 引用与行号规约（取证链）

- site 类条目的行号 = 2026-09-26 归档副本的行号（归档在 `.temp/jev-lab/sources/`，路径只作代码字面量、不作链接）。归档字节与台账 `raw_sha256` 的核验：blog / api / models / confidence / jaggedness / primer / how-to-build / primitives 八条前缀一致 ✔。**jevbench · distil · evals-site 三条归档与台账 raw 指纹不一致**（台账 19:48 抓的活页比归档更大——见「分歧清单」#11），故这三条的数字一律以钉提交仓库文件或 note-200 §8 为锚。
- repo 类条目：`lab` 引函数行号 + 本片复跑日志；`adapter-confidence` 引 `confidence_metrics.py` 行号；各 README 引 `README.md` 行号。
- 第三方原文（hume-reverse 等）引归档 txt 行号（HTML sha256 与台账一致 ✔）。
- 【一】复算件：`jev_lab.py` 已于 2026-09-26 在本 worktree 复跑，`--selftest` 与 `--break B1..B5` 输出与 note-200 §9 所引逐字一致；evals 倍数、K 依赖、公式代数等价为本次重算（算式记录在本文各条内）。

### 本集特有纪律（Stage ③④ 执法点）

1. **「零幻觉」只能紧跟「仅指格式与类型层」使用**；画面不得出现「不会错／零错误」字样（类比计划 §4.6 画面红线）。
2. **「集中度 0.9」不得说成「九成会对」**（conf ≠ 概率，K 依赖 + 官方分流示例压在 confidence 上而校准承诺落在概率上）。
3. 活数据不进口播：star 数、HN 分数、榜单排名（含「排名第 2」）、SDK 版本号、速率限制数值。
4. 对照模型不点名：官方博客正文与 evals 图例的模型命名不一致（Astra/Terra vs sol/luna），口播一律「最强的两个大模型／大模型对照组」。
5. 中文社区转述数字零引用（secondary 归档）；201 映射结论零引用。
6. 类比失配边界按 §4.5/§6 的「拦截幕」执行，逐条见各节末尾。
7. 「判读一次从一百块降到一分钱」是剧场化示意、**不是价格数据**：类比计划借 Jevons 用的修辞，口播不得念出具体钱数（真实量级另有官方口径，见数字卡 #12–14）。

---

## P0 主播早已超人，城市仍未自动化（观察与钩子）

**本节回答**：模型聊天早已超人，软件为什么没有自动化起来？一个不写稿、只填格的模型凭什么插进软件里？

- 【二】官方开篇之问：「Models have been superhuman at chat for years, so where is all the automation?」——launch-blog txt:31（CEO Diogo Almeida，2026-09-15）。
- 【二】产品定位：「Think of Jev as a frontier-intelligence function call: unstructured state in, typed probabilistic decisions out.」——launch-blog txt:41。
- 【二】新栈三件套：新模型架构 + parallel sampler + RLCD（Reinforcement Learning for Calibrated Decisions）——launch-blog txt:37。
- 【二】宣传句：「two orders of magnitude faster…can't hallucinate」——launch-blog txt:39（P0 只抛出、P6 裁决）。
- 【二】创始人与 RLHF 的关系：「RLHF was used to train InstructGPT and ChatGPT and was co-invented by Diogo Almeida」——primer:41（官方自述；InstructGPT 论文合著者身份可查 Ouyang et al. 2022, arXiv:2203.02155）。口播措辞用「官方文档自述」归属。
- 【二】口头置信的病灶（官方对比表）：「models tend to be overconfident and inconsistent. If a model can do a task 95% of the time but doesn't say when it's in the 5%, it can't automate that task.」——launch-blog txt:101。
- 【二】命名出处：System One 取自 Kahneman《Thinking, Fast and Slow》；官方自认「System 1 thinking 也有易出错的含义」，但称 System One Models 可以做得更可靠——launch-blog txt:247–249。
- 【三】「文字里的把握不是概率」：A. Hume（独立研究者，约 1 万次 API 黑盒探测）：An ordinary LLM generates "90% confident" as text; its probability of producing those words does not establish a 90% probability of being right——hume-reverse txt:42。
- 【类比锚点】暴雨夜演播室＝观察；主播口若悬河 vs 判读员只填格不写稿；「数字可信度」三级角标本幕首次亮出（图例 beat）。
- 【失配拦截】#8「System One ≠ 容易出错的直觉」：命名句紧跟「训练有素的快判，不是凭感觉」（launch-blog txt:249 官方自己的说法）。

## P1 四个病灶，四条硬要求（归因与设计规格）

**本节回答**：官方把「没法自动化」归因给哪四件事？新岗位的四条硬要求分别买什么？

- 【二】病灶①自由文本要兜底：「responses need to be parsed + validated. There is also always some risk that the AI goes off the rails.」——launch-blog txt:73。
- 【二】病灶③逐字慢贵：Sequential「one token at a time」vs Parallel「all outputs in a single query」——launch-blog txt:79–81；对比 LLM「3 to 329 seconds」vs TypeSafe「70ms–500ms」「40x-200x faster」——launch-blog txt:95–97（此两数属分歧清单 #1/#2，口播处置见彼处）。
- 【二】病灶④RLHF 讨好：「RLHF…can also reward sycophancy and confident-sounding hallucinations」；「Human preference and machine trustworthiness are different optimization targets.」——primer:67/78。官方立场：RLHF 仍是对话场景的正解（primer:91）——主播不丑化的依据。
- 【二】病灶②口头置信（P0 已立）→ 四条硬要求总纲（note-200 §1 表，L52–59）：只填格（闭合输出）× 报几成兑现几成（校准）× 一屏资料全单作答（并行）× 秒回且便宜（快廉）。
- 【二】交付契约：`POST /v1/systemone`；`state` 必填（string | object | array）；响应 `{model, answers, usage}`——api-docs:14/23/184–217（节段）。
- 【二】价格与限流：$42/Btok＝$0.042/Mtok，只按输入计费、输出免费；64k/请求、state+最长单题 ≤32k；仅文本输入；同一套权重服务所有账户（不做 per-account 微调）——models-docs:13/15/16/44。
- 【二】上下文计法：「Jev ingests the `state` once and evaluates every question against it in parallel.」——models-docs:20。
- 【三】多数查询的延迟量级：「Most queries complete in about 100 ms.」——how-to-build:290；独立延迟见 nibzard-readme:18（p50 264–276ms）。处置：口播说「零点几秒级」，不报单一毫秒数（分歧 #9）。
- 【类比锚点】主播四个病灶依次亮起（口播要人听写 /「应该不会下太大」/逐字念稿又慢又贵 / 讨观众喜欢）；应急办贴出四条硬要求（§4.3「设计规格四要求」行）。
- 【失配拦截】#1「预测未来 ≠ 判读当下」：预报单首现时行文用判读式（「资料显示…吗」），并明说「他判的是桌上的资料，不是替老天掷骰子」——骰子问题留到 P4。

## P2 预报单没有空白处（M1 闭合输出空间）

**本节回答**：答案空间怎么钉死？钉死之后买到什么、买不到什么？

- 【二】三种题型＝预报单三类行：Choice（单选行，criteria 至多 255 选项）· Score（等级行，有序数组至少 2 级、API 上限 10 级）· Noul（是否行，返回 P(yes)，**不带 confidence**）——api-docs:125/162–163/229–230；confidence 只出现在 Choice/Score——confidence-docs:145。
- 【二】Score 可落在两级之间：「The probability-weighted answer across the levels; can land between levels.」——api-docs:288（文档示例 1.05/0.92 带分布，api-docs:307–318 节段；等级行「小到中雨」的依据）。
- 【二】闭合保证原文：「The model returns a probability distribution over your options or levels, **never a value outside them**.」——primitives-docs:309。
- 【二】出单方责任：单选行要加一格「other / none of the above」——primitives-docs:283。
- 【二】question id 不送入模型、不参与推理（选项名与描述会送入）——api-docs:36。
- 【一·原型】契约真的会拒绝：256 选项被校验层打回「Too many choices. Must have at most 255 choices.」（S10）——lab（`selftest` L316；本片 2026-09-26 复跑一致）。
- 【三·复算✓】第三方同样撞墙：nibzard 基准原始响应里 256+ 选项 **225 条全被 400 拒绝**，254/255 可答——nibzard-readme:18/45–47（本仓在钉提交 `8404980` 上复算一致，note-200 §3 L107）。
- 【一·原型】形状保证 ≠ 内容保证：闭合输出下越界 0/6、内容错 2/6（S2）——lab L260。
- 【一·原型】集中也会集中地错：否定句陷阱单「There is no error… I just want my refund」被字面读成 technical（真值 billing）、conf 0.981、自动执行（S3b）——lab L269。
- 【一·原型】拆掉闭合输出的世界：自由文本 + 宽松解析 → 越界 6/6、下游 switch 全部落空（B1）——lab L328。
- 【二】官方自己的限定：「Jev guarantees the **shape** of its answers, not that every decision is correct… it can choose the wrong one.」（FAQ）——出处为首页 FAQ 归档 `framer-module__site-faq.faq.txt:31`，**未单列台账**，经 note-200 §3（L101）转引；见文末「台账缺口」。
- 【二】0% 幻觉的非实测声明：「Our number is not empirical. Schema matching is guaranteed, thus we can confidently add 0%.」——launch-blog txt:202。
- 【三】格子对、填错格的独立例：AbdelStark 基准 Emotion 任务 16% 样本对真标签给出零概率——经 note-200 §8 表 #15（L227）转引（原始仓 AbdelStark/jev-benchmarks 未单列台账）；画面角标级素材。
- 【类比锚点】预报单三类行 + 预印格子；单选行备「其他」格；高潮：窗外大雨、单上填「晴」——格式对了，天气没对（§4.4 §4 节点）。
- 【失配拦截】#4「不越界 ≠ 不会错」：本幕高潮即此边界；「零幻觉」句式执行纪律 1。

## P3 资料只放一遍，每行一张封卡（M2 共享读 · 隔离问）

**本节回答**：为什么多问近乎免费？并行的代价是什么？隔离的两层各在哪里？

- 【二】并行与隔离：「Every question in a request sees the same state, is evaluated independently」——primitives-docs:246；「Adding questions barely changes the response time and costs only the tokens for the extra questions」——primitives-docs:362。
- 【二】批量收益（官方 cookbook 自测）：13 题合一请求「12.2x cheaper, 10.0x faster」——出处为 parallel-questions cookbook 归档 `cookbooks__parallel_questions.md:7,329`，**未单列台账**，经 note-200 §4（L115）转引（官方自报口径，标「官方 cookbook 实测」）。
- 【三】行间互不可见（暗号实验）：秘密写进兄弟题读出 0.00，写进 state 升到 0.90–0.92（每条件 5 次重复）——hume-reverse txt:133–136。口播归属句：「有独立研究者做过一个暗号实验」。
- 【三】行内格子互相影响：加入无关选项后对数几率平均 −0.28（95% CI −0.36 ~ −0.19，IIA 被违背）；选项顺序也移动答案（参照项放末位 16/16 复现、放首位 12/16）——hume-reverse txt:237/193–205。
- 【二】无跨问题不变量（官方自列）：`refund` 0.72 + `not_refund` 0.47 = **1.19**；同一问题用 Noul 与 yes/no Choice 问法不一致（0.22 vs 0.01）——jaggedness:131–133/123–125。剧场化改写「会下雨 0.72 + 不会下雨 0.47」的原始案例即此（画面角标标官方原例）。
- 【二】依赖问题要二段请求：「Questions in the same request are independent…If a later judgment depends on an earlier answer, make a second request in code.」——primitives-docs:456。
- 【一·原型】隔离成立：加兄弟题不改本题答案（S5）；共享计费：1 问 19 tok → 3 问 36 tok，state 9 tok 只计一次（S6）；正反 Noul 相加 1.504 ≠ 1（S7）——lab L280/286/293。
- 【一·原型】拆掉隔离/共享的代价：兄弟题面把同一工单 billing 0.001 改写到 0.499（B2）；每题重收 state 计费 ×1.71（63→108 tok，B3）——lab L335/343。
- 【一·复刻】laya 上同样成立且暴露精度伪影：fp32 下单问与 5 题同请求**逐位相同**；出厂 fp16 分档差 0.0026（是精度分档、不是信息泄漏）；暗号探针：写兄弟题 0.080（基线 0.101）、写 state 0.865——laya-replica-results `experiments.E1`。
- 【一·复刻】复刻侧行内影响：无关选项使 top-2 对数几率移动 0.386——laya-replica-results `experiments.E6.iia`。
- 【二】上层用法（官方 pattern）：speculative fan-out——一次带上所有可能用到的题，由代码事后取舍——how-to-build patterns 节（经 note-200 §4 L127 转引）。
- 【类比锚点】大屏＝state 只放一遍；封卡＝每行一张、互不可见；「暗号写在别的卡上读不到，写进大屏人人读得到」；1.19＝两张正反封卡各填各的（§4.3 ⑤⑥⑬）。
- 【失配拦截】#6「封卡是剧场规则」：紧跟一句「真实机制的推断是共享前缀 + 各题独立后缀——这是第三方从外部行为推断的，官方没有披露」；#7 不画「专家小组 / 多人投票」——**画面恒为一人一桌一排封卡**（类比计划 §6.11）；行内/行间两层分两镜讲。

## P4 柱高分 100%，计算栏自动算（M3a 概率 · 校准 · confidence）

**本节回答**：概率和集中度是什么关系？校准承诺到底承诺了什么？

- 【二】两个对象：「`confidence` is a statistic computed from the probability distribution」「you are never locked into our definition」——confidence-docs:149/154。
- 【一】官方参考代码钉死的公式：Choice 为 `(p_max − 1/K)/(1 − 1/K)`，Score 为 `max(0, 1 − Σpᵢ·|i−mode|/D)`（D＝均匀分布平均绝对离差）——adapter-confidence `confidence_metrics.py:17-24/4-14`。
- 【一】文档 demo 公式 `(count × peak − 1)/(count − 1)`（confidence-docs:28–32）与 adapter 公式**代数恒等**（分子分母同乘 K 即得；本片验算）。分歧点不在公式，在「服务端是否同式」：对 nibzard 原始响应在「两位小数取整、不重归一化」假设下 80–100% 行能对上、残差 ≤0.029——**推断，不是证实**（note-200 §5 L135 + nibzard 复算，归【三·复算✓】语境）。口播措辞：「官方参考代码里是这条公式；服务端大概率同式，但这是推断。」
- 【一】K 依赖（本片算例）：conf 0.9 在 K=2 对应 p_max 0.95，在 K=10 对应 0.91——「集中度 0.9 ≠ 九成会对」的算术根基（0.9 = (p−1/K)/(1−1/K) 反解 p）。
- 【一】Score 公式算例（本片复算）：{0: 0, 1: 0.95, 2: 0.05} → D=2/3，1 − 0.05/0.667 = 0.925 ≈ 文档报 0.92（api-docs:307–318 示例）。
- 【二】校准是群体承诺：「Outcomes assigned a probability of 0.2 should occur about 20% of the time…groups of predictions, not a guarantee about any single answer.」——primer:59–63；concepts__system-one 归档同义（`concepts__system-one.md:21`，未单列台账）。
- 【三·复算✓】度量对象要盯住：第三方常引的「ECE 0.246」算在 confidence 字段上；同一批数据改用 p(chosen) 算是 **0.347**——nibzard-readme:50 与 note-200 §5（L135，本仓在钉提交复算 0.2461 ✓/0.347）。口播不报 0.246 为「总体校准水平」，只作「口径不同数字不同」一课（分歧 #5）。
- 【二】RLCD 只公开目标合同（模型不生成文本 / 返回决策与概率 / 高概率对应高命中），配方未公开——primer:51–55；「训练温度可以换成你自己的度量」——confidence-docs:154。
- 【一·原型】读数是纯算术：`probs=[0.996, 0.001, 0.001, 0.001] → conf=0.995`，公式逐位一致（S4）——lab L274。
- 【一·原型】温度缩放的边界：拟合 T*=0.9 后检验集准确率 0.867 纹丝不动（只改读数不改排序），Brier 0.350→0.326（S8）——lab L301。
- 【背景可引】proper scoring rules 的地基：Brier 评分 1950 年本就诞生于降水预报检验（Brier, *Mon. Weather Rev.*, 1950——学术锚，经 note-200 参考 [12]；剧场彩蛋「记分牌这套打法，气象台真的用了七十多年」）。
- 【类比锚点】柱高分 100%；行尾计算栏「咔哒」一声自动算出集中度，判读员的手从不碰这一栏；岗前实况记分牌：报七成按七成对账、虚高虚低都扣分（§4.3 ⑧⑨）。
- 【失配拦截】#3「confidence 不是自信心也不是第二次打分」＝计算栏一拍；#9「集中度 ≠ 校准过的概率」＝K 依赖一拍（官方分流示例压在 confidence 上、校准承诺落在概率上，两层不得混讲）。

## P5 调往高原：校准有领地（M3b 分布外失效 → 全片之「转」）

**本节回答**：同一套读数换个地方还算数吗？看不见台阶的时候靠什么发现？

- 【三·复算✓】分布内漂亮：独立研究者在 MMLU 1,200 题上十分箱 ECE **0.031**、990 题落在 0.9–1.0 箱——hume-reverse txt:299（其公开 calibration.json 经本仓重算 ECE 同为 0.0313，note-200 §5 L137）。
- 【三·复算✓】分布外出台阶：JevBench 密封集（308 题）准确率 **36.7%**（与公开集差 49.9pp）、ECE **0.220**、conf ≥ 0.9 的子集只对 **42%**（该子集仅占密封题 8.4%）——jevbench 条目下钉提交结果文件 `results/v1.4.2/jevbench-v1.4.2-results.json`（`sealed_accuracy`/`sealed_aggregate.ece`/`risk_coverage` 字段，本片直接读自其公开结果文件核对一致）；页面口径见归档 txt:64（534 公开 + 308 密封）。对照大模型密封集 95.5%（Luna）——同文件。
- 【三·复算✓】内在随机被压扁：公平骰子 Choice 报 **82.9%**、实际命中 19.0%（400 次）；硬币报 92% 对 52%；Noul 形态的骰子报 19.2% 接近 1/6——dice 条目 txt:82/109 + 钉提交 `data/summary/SUMMARY.md:9-12`（note-200：全集 1,941 条离线复算通过）。
- 【三】原理侧论证：「校准是模型 × 数据分布的联合性质；同一输入对不同公司给出相同概率 ⇒ 对所有人同时校准不可能」；建议把输出当排序分数、自行做重校准——molas txt:20/24/26（论证型，口播须「有研究者从原理上论证」）。
- 【二】结构性质而非实现瑕疵：同一套权重服务所有账户，定制靠 state/instructions/criteria 而非微调——models-docs:44（P1 已立，此处回扣）。
- 【一·原型】领地最小复现：同一 T*、同一门槛 p ≥ 0.8，分布内放行错 19% → 分布外放行错 **100%**，读数全程不报警（S11）——lab L307。
- 【一·原型】单看 ECE 会误判：拆掉校准温度后 ECE 反而从 0.252 降到 0.213，但 p ≥ 0.9 放行从 28 条错 0 → 48 条错 8（B4）——lab L352。
- 【一·复刻】出厂过度自信可在读数层修复：laya 分桶温度把 49 个 suite 的 ECE 均值 0.466 修到 **0.081**——laya-readme:877–887 区段（note-200 §9 §laya L272 复算 0.4656→0.0812 ✓）；同批无解题对照：laya ECE 0.348、高置信 4 条全错；Jev（第三方逐行数据）ECE 0.396、≥0.9 共 17 条全错——laya-replica-results `experiments.E4`。
- 【三】方向提醒（反直觉补注）：换分布不总是过度自信——独立研究者新生成的模幂题族上正确率 56%、平均自报概率只有 35%（**欠自信**）——hume-reverse txt:307 + `evidence.json freshMath`。本集高原镜头一律用过度自信例（密封集/骰子），此条只作画面角标「台阶方向不一定向上」。
- 【类比锚点】调令下达、调往高原：照样报「七成」，记分牌出现台阶，判读员自己不报警；**紧跟一句「现实里没有调令——分布漂移悄无声息，训练分布也不公开，能看见台阶的手段只有影子运行和抽样审计」**（类比计划 §6.10）。
- 【失配拦截】#2「岗前训练后不再学习」：记分牌＝出厂前训练，上线后不拿客户数据继续学；#5「校准只对一批预测、且只在受训分布内成立」；#10「现实中没有调令」。

## P6 应急预案三道闸（M4 快慢分工 · 收益在编排）

**本节回答**：判断便宜之后，它站在系统哪里？谁持有控制流？

- 【二】代码持有控制流：「code owns the workflow and AI handles narrow, structured decisions」——how-to-build:252；反面教材：「every loop introduces another opportunity to go off the rails」——how-to-build:260。
- 【二】三档分流：「High confidence: Act automatically / Medium: ask the user to confirm, flag for review / Low: Do not act, route to a human」——confidence-docs:165–173。
- 【二】门槛随风险伸缩：「A confidence threshold is not one number」；示例：0.5 下限接人，`approve_transfer` 高风险要 >0.9 才 confirm-then-execute；「Your code encodes the risk tolerance.」——confidence-docs:177–216。注意官方页与页之间示例不一（0.5 vs 0.6，分歧 #7）：口播说「官方示例把最低线画在五到六成之间，怎么画由你的代码按风险定」。
- 【二】System 2 兜底：「Escalate uncertain cases to a person or a more expensive reasoning model. Test thresholds by plotting confidence against accuracy on your data.」——how-to-build:787。
- 【二】三种架构对照：传统软件＝可靠基元的复杂决策树 / LLM agents＝「a person is monitoring」/ AI-powered software——how-to-build:255–262 区段（经 note-200 §6 L151 转引三架构 Tab）。
- 【二】官方 workflow evals 的真头条：「every model is more accurate, cheaper and faster in the workflow than it is with the same policy as a prompt」——evals-site（归档 index.txt:27–29）；Jev 四任务均值 67.8% / $0.0004 / 0.4s，低于对照 74.1%（sol）——evals-site 归档 `plot_points.tsv`（workflow 路线 4 行均值；四任务 240/117/150/204 例）。evals-site 归档与台账 raw 指纹不一致（分歧 #11），此两条同时锚 note-200 §8 #1（钉提交）。
- 【一·原型】分流演示：conf 0.8 时 reply 自动执行、refund 进复核（S9）；拆成一刀切后 refund 0.62 与 approve_transfer 0.7 全部 auto（B5）——lab L310/358。
- 【三】拆错维度，便宜也白搭：付款决策逐行拆问后 32/32 批准判断全对、16 例金额错误一例没抓到（「a total has no per-line decomposition」）——distil txt:104。
- 【二】Jevons 效应（官方 FAQ）：以 Jevons 与煤炭类比——效率提升导致需求增加，「Every order of magnitude drop in the cost of intelligence unlocks orders of magnitude more use cases.」——launch-blog txt:251；同方向表述「cheaper intelligence will create much more demand」——how-to-build:302。
- 【类比锚点】预案流程图墙 + 三道闸（带伞提醒门槛低 / 停课停航门槛高）；首席起草、接疑难；值班员复核；三种城市架构并排；Jevons：判断便宜后，城市沙盘冒出成千上万个询问气泡（§4.4 §7 节点）。

## P7 本台自评 ⇄ 外部抽检（证据对账 · 收束）

**本节回答**：193.6× 该信几分？材料没证明的五件事是什么？判读员到底是什么？

- 【二】193.6× 的来历与官方自评：首页「193.6x Faster, 444.6x Cheaper」（site 首页归档 index.txt:270–271，未单列台账）；博客：「This is where the claims…comes from, and we expect that these are **on the higher end** of real world gains.」——launch-blog txt:181。
- 【二】口径三件套（官方自列 nuance）：参照答案 = 两位最强模型的平均（偏向 OpenAI/Anthropic 系，官方自认可能低估自家）——launch-blog txt:187/168；题目出自自家能力团队——launch-blog txt:184；LLM 对照组套官方 wrapper 输出概率（更慢更贵、开推理）——launch-blog txt:190。
- 【一】公开数据点复算（本片算）：workflow 路线 LLM 均值点 vs Jev 点只有 **97.8× 时间 / 149.2× 成本**，全部配置 151.1×/229.4×——本片由 evals-site 归档 `plot_points.tsv` 复算（note-200 §8 #2 同值；首尾数字卡 #13）。evals-site 归档与台账 raw 指纹不一致（见分歧 #11），故此条锚定 note-200 §8 #2（钉提交）+ 归档数据点复算。
- 【二】首页 demo 的可复现量级：$0.000081/0.114s vs LLM $0.013880/8.566s ≈ **171× / 75×**——site 首页归档 index.txt:277–285（未单列台账，经 note-200 §8 #3 转引）。
- 【三】独立测速约 2–6×：LangChain 0.44s vs 对照 2.16–2.83s（约 5–6×）——langchain-judge（txt:137 + 钉提交 README:90–94 表）；JevBench p50 0.652s vs 对照 1.48s（约 2.3×）——jevbench。归并为「几倍」，不并成「两个数量级」。
- 【三·复算✓】稳定 ≠ 更准：LangChain judge 实验 does_pass 500/500、方差低 92–913×、$0.00035/0.44s——langchain-judge txt:215/221/137；但其公开 accuracy.json 里 Jev 的 quality MAE 0.106 为四模型最差——钉提交 `jev-as-a-judge` accuracy.json（经 note-200 §8 #9 与 thirdparty 归档 NOTES S2 转引，本仓读值复算）。
- 【三·复算✓】窄任务强、多跳弱：分诊 200/200、$0.029/千次；付款 79/100 vs 微调 4B 98/100——distil txt:56/60/84–88 区段（note-200 §8 #10）。
- 【三·复算✓】开源复刻对拍：kev 在 5% 错误预算下的自动化率 0.45–0.57，Jev 0.70——kev-readme:342/387（kev 通过网关真调过 Jev，dev 集 11 任务加权 0.857/Brier 0.211 经本仓钉提交复算一致）；laya 自陈「Jev figures are third-party published, never measured here」——laya-readme:875。
- 【二】中文只有定性：官方「English is the primary training language…CJK scripts are handled but not equally well」零量化——models-docs:52；唯一配对数据 feishu_zh 64 例为合成题（Jev 64/64 vs Laya 20/64，laya-readme 钉提交 `research/benchmarks/feishu_zh/README.md:20-26` 表）——处置：口播只说官方定性承认，不报 64/64。
- 【二】官方自列的毛病清单（jaggedness 九类，`Last reviewed 2026-09-17`）：字面阅读、数学/计数、日期比较、多跳指代、大 state 无关细节、对抗内容、题干与格子矛盾、跨问法不变量、生成——jaggedness:17–27；「Jev suffers from context rot」——jaggedness:151；「state 里的注入指令 can move the answer」——jaggedness:106。
- 【三】「新物种还是老组件」之争（不裁决）：官方博客 FAQ「neither small nor an LLM」——launch-blog txt:245 区段（cms 归档）；官方 primer 自述「从预训练语言模型出发加了第三条后训练路径」——primer:25；独立逆向者推断为已知组件组合（因果 Transformer + 共享 state 前缀 + 独立题分支 + 概率读出头，MoE 属推断）——hume-reverse txt:48/317–323。口播句式：「官方说不是 LLM；官方文档又说它是从预训练语言模型后训练出来的；独立逆向者看到的是已知组件的组合——这是一场还没落幕的命名之争。」
- 【二】「题间隔离 ≠ 不怕资料太大」两层口径（官方自陈）：「All three question types can be mixed…evaluated in parallel and in isolation」（introduction 归档:37）vs「Jev suffers from context rot」（jaggedness:151）——两层不矛盾、必须分开讲（分歧 #8）。
- 【收束】三问开放（类比计划 §4.4 §9）：①新岗位还是老式分类员？（命名之争，架构保密短期不可证伪——note-200 §7 争议 1）②高原上的「七成」还算数吗？（换分布先重标门槛——note-200 §2 闭环约束 L97）③自培判读员差在哪？（排序能力：5% 错误预算自动化率 0.70 vs 0.45–0.57，单一温度无法重排置信——kev-readme:387）。
- 【金句候选】「判读员不是更聪明的主播，而是一个让判断变便宜的新岗位。」（类比计划 §4.4 §9 原句）
- 【类比锚点】本台自评（两位首席平均当标准答案、同事出题、主播戴面具陪考、本台自认偏上限）；外部抽检员；毛病清单上墙；各城自培判读员；收束回扣城市沙盘的询问气泡。

---

## 分歧清单（官方自报 vs 第三方实测 vs 本仓复算）

| # | 分歧点 | 三方口径 | 处置 |
|---|---|---|---|
| 1 | **加速倍数** | 官方：193.6×/444.6×（首页，自认「偏上限」）＋40–200×（博客）＋首页 demo 171×/75×（我们复算）；本仓复算：evals 公开数据点只得 97.8×/149.2×；第三方实测：约 2–6×（LangChain 5–6×、JevBench 2.3×） | 口播只说「官方自报两个数量级、自认偏高；公开数据点复算约百倍；独立测速只有几倍」；画面给三枚角标并列的溯源图（P7） |
| 2 | **「LLM 需 3–329 秒」** | 官方博客 txt:95；所链数据源（AA 镜像页）发布当天 Wayback 快照最大 187.48s（`.temp` 归档 payload:83） | 不进口播；也不做画面角标（信源未登记台账且属活数据镜像）；分歧清单留证 |
| 3 | **「can't hallucinate / Zero Hallucinations」** | 官方博客/首页宣传语 vs 官方 FAQ 自限「guarantees the shape…not that every decision is correct」+ 博客自认 0%「not empirical」；原型 0/6 越界但 2/6 内容错；第三方 Emotion 16% 零概率 | 「零幻觉」句式只允许「格式与类型层」限定下出现；画面永不出现「不会错」 |
| 4 | **「All answers are accompanied with calibrated probabilities」** | 官方无分布限定（launch-blog txt:75）vs Hume MMLU ECE 0.031（分布内）vs JevBench 密封 ECE 0.220、≥0.9 只对 42% vs 骰子 82.9%/19% vs Molas 原理论证 | 口播固定为「分布在内成立，分布外出台阶且不报警」，逐个带角标与归属 |
| 5 | **ECE 0.246** | nibzard 头条（confidence 字段）vs 同批 p(chosen) 0.347（我们复算）；该批含刻意无解题 | 不把 0.246 当「Jev 总体校准」引用；只作「度量对象不同、数字不同」一课 |
| 6 | **confidence 公式** | 文档 demo「approximate」公式 vs adapter 公式 vs 服务端未知；laya 用 `1−H/log k` | 口播「官方参考代码里是这条公式；服务端大概率同式，是推断」；公式代数恒等由本片验算 |
| 7 | **门槛下限** | confidence 页示例 0.5 vs routing pattern 0.6 | 口播不落单一数值：「官方示例 0.5–0.6，怎么画由你的代码按风险定」 |
| 8 | **「隔离」两层口径** | introduction「并行且隔离」vs jaggedness「suffers from context rot」 | 分开讲：题与题之间不串味（真）；资料本身塞太大照样掉准（也真） |
| 9 | **延迟** | 官方 70–500ms / 「约 100ms」vs nibzard p50 264–276ms vs JevBench 0.652s（德国）vs LangChain 0.44s | 只说「零点几秒量级」，不报单一毫秒数（测点网络位置不同） |
| 10 | **补贴之争** | 博客「can't prove it isn't subsidized」vs 首页 FAQ「serve profitably」 | 不进口播（价格可持续性非本集主线） |
| 11 | **台账↔归档指纹漂移（取证链自查）** | jevbench / distil / evals-site 三条：台账 19:48 抓取的活页 raw 指纹 ≠ 本仓 16:39 归档（活页在两次抓取间变大） | 这三条的数字一律锚到钉提交仓库文件或 note-200 §8；`source_ledger verify` 的 B 轨 WARN 需人工复核本文仍成立；建议主代理补登记钉提交仓库条目（见「台账缺口」） |
| 12 | **「0.727」循环引用** | laya 表内 Jev 数字引自数据集卡（gold＝约 4B 教师模型 3 次采样均值，衡量一致性非正确性）且 verdict 又引自 laya | 不使用该数字（note-200 §9 laya 节已核） |
| 13 | **类比措辞 vs 原始案例** | 剧场化「会下雨 0.72 + 不会下雨 0.47 = 1.19」改写自官方退款案例（refund/not_refund） | 口播可用剧场版，但画面角标标官方原例（jaggedness:131–133）；不得说成「官方测过下雨」 |

## 数字卡（全片可用关键数字）

| # | 数字 | 口径 | 证据级 | 一句话读法 |
|---|---|---|---|---|
| 1 | 2026-09-15 | Jev 发布日 | 【二】launch-blog txt:25 | 上线刚满十来天的新接口（口播说「九月月中刚发布」） |
| 2 | 3 类题型 | Choice/Score/Noul | 【二】api-docs | 预报单三类行：单选 / 等级 / 是否 |
| 3 | ≤255 选项 | Choice criteria 上限（=2⁸−1） | 【二】api-docs:125 | 每行至多 255 格，多一格就要两段式 |
| 4 | 2–10 级 | Score 等级行 | 【二】api-docs:162–163 | 等级行至少 2 级、至多 10 级 |
| 5 | 225 条 400 | nibzard 256+ 选项全被拒 | 【三·复算✓】nibzard | 契约不是纸面话，真会拒绝 |
| 6 | 越界 0/6 · 内容错 2/6 | 原型 S2（六张工单） | 【一·原型】 | 格式保证买的是「不越界」，不是「填对」 |
| 7 | 0.981 自动执行 | 原型 S3b 否定句陷阱 | 【一·原型】 | 集中也会集中地错，错在高置信格 |
| 8 | 12.2× 便宜 · 10.0× 快 | 官方 cookbook 13 题合一请求 | 【二】（转引） | 多问近乎免费是官方实测（自报口径） |
| 9 | 0.00 → 0.90–0.92 | Hume 暗号实验（兄弟题 vs state，各 5 次） | 【三】hume | 卡与卡互不可见是真的 |
| 10 | 0.72 + 0.47 = 1.19 | jaggedness 自列两 Noul 之和 | 【二】jaggedness:131–133 | 正反两问各答各的，自洽要交给代码 |
| 11 | −0.28 | 加无关选项后 log-odds 平均移动（95% CI −0.36~−0.19） | 【三】hume | 同一行的格子互相影响（IIA 违背） |
| 12 | $0.042/Mtok | 输入价；输出免费 | 【二】models-docs:13 | 只按读资料收费，落笔免费 |
| 13 | 97.8× / 149.2× | workflow 路线均值点复算（本片算） | 【一】 | 官方公开数据点复算不出的 193.6×，只剩约百倍 |
| 14 | 171× / 75× | 首页 demo 两数之比（我们复算） | 【一】（转引） | 比宣传倍数更接近可复现量级 |
| 15 | 约 2–6× | 独立测速（LangChain 5–6×；JevBench 2.3×） | 【三】 | 真实世界的加速是个位数倍 |
| 16 | 67.8% vs 74.1% | 官方 evals 四任务均值（Jev vs 最强对照） | 【二】evals-site | Jev 不是最准的，占的是成本-时间前沿 |
| 17 | 0.031 | MMLU 1,200 题 ECE（990 题落 0.9–1.0 箱） | 【三·复算✓】hume | 分布内校准确实好 |
| 18 | 36.7% / 49.9pp | 密封集准确率 / 与公开集差 | 【三·复算✓】jevbench | 陌生题掉四成多 |
| 19 | ECE 0.220 · ≥0.9 只对 42%（占 8.4%） | 密封集校准 / 高置信子集 | 【三·复算✓】jevbench | 报九成的地方，台阶就在那里 |
| 20 | 82.9% vs 19% | 公平骰子 Choice 自报 vs 实际（400 次） | 【三·复算✓】dice | 内在随机被压扁成过度自信 |
| 21 | 19% → 100% | 原型 S11：同一门槛分布内/外放行错误率 | 【一·原型】 | 读数不报警的领地失效最小复现 |
| 22 | 0.252 → 0.213（反而更低） | 原型 B4 拆校准后 ECE | 【一·原型】 | 单看 ECE 会误判，Brier 与风险-覆盖才是对账对象 |
| 23 | 0.466 → 0.081 | laya 49 suite 温度修复 ECE 均值 | 【一·复刻】 | 出厂过度自信可在读数层修，排序不动 |
| 24 | K=2→0.95 · K=10→0.91 | conf 0.9 反解 p_max（本片算） | 【一】 | 同一个 0.9，格子数不同含金量不同 |
| 25 | 500/500 · MAE 0.106 | LangChain judge 二元判定全对 / 连续分最差 | 【三·复算✓】langchain | 稳定不等于更准 |
| 26 | 200/200 · $0.029/千次 | distil 分诊 | 【三】distil | 答案能从输入读出的窄判断，近乎全对 |
| 27 | 79/100 vs 98/100；32/32 与 0/16 | distil 付款：Jev 一遍 vs 微调 4B；逐行拆问的得与失 | 【三】distil | 拆对维度便宜兑现，拆错维度白搭 |
| 28 | 0.70 vs 0.45–0.57 | 5% 错误预算自动化率（Jev vs kev） | 【三·复算✓】kev | 自培判读员差在排序能力 |
| 29 | 64/64 vs 20/64 | feishu_zh 合成题配对（64 例） | 【三】laya | 中文差距真实存在，但样本是合成小集（不进口播数字） |
| 30 | 9 类 | jaggedness 官方自列失败模式 | 【二】jaggedness:17–27 | 毛病清单官方自己挂墙上 |
| 31 | 0.499 / ×1.71 | 原型 B2 泄漏后 billing 概率 / B3 计费膨胀 | 【一·原型】 | 拆掉隔离与共享编码各坏一处 |
| 32 | ~$7/小时 | Doom demo 10 查询/秒（官方自报，备选素材） | 【二】launch-blog txt:210 | 便宜判断的新玩法注脚（可用可不用） |

## 不进口播清单（画面角标 / 归档留证除外）

1. **201 映射全部结论**（mapping-201）：本仓实现的 16 条判定不进正片（系列规则），只作边界核对。
2. **中文社区二手转述**（secondary 归档，15 处失真）：微信六篇 + X 长文的一切数字与故事（Minecraft 速通、600 个开源项目、Vercel 采用率等）零引用。
3. **活数据**：star 数、HN 帖分（1981 分/520 评论）、JevBench 排名（含「排名第 2」「综合分 63.29」）、laya「9 天 28 个版本」、SDK 版本号、速率限制数值、AA 镜像页的实时延迟。
4. **架构细节（第三方推断）**：因果 Transformer、MoE、tokenizer 指纹、共享 KV cache / tree mask / 读取头、prefill 读出——只作画面角标「（独立研究者的）源码分析/推断」，带归属。
5. **「3–329 秒」**：未登记台账的活页镜像，且官方引用无法复现——只在分歧清单留证。
6. **TechCrunch/Vercel「快 5–18 倍」**：媒体转述、无数据。
7. **「Jev 0.727」/ laya 0.766**：循环引用 / 仓内无结果文件，不可复算。
8. **公式与度量数学**：confidence 两式本体、ECE/Brier 定义、reliability diagram 数学、温度缩放推导——只作画面角标（术语直讲区）。
9. **RLCD 训练配方**：官方未公开，只讲目标合同三句（primer:51–55）。
10. **Di Zhang 的 Plackett–Luce 重构与 IIA 预测**：理论细节不进口播（其「可证伪预测被 Hume 实测推翻」一节仅作 P7 命名之争的旁注素材）。
11. **CEO 在 HN 的发言**（「architecture is close to the chest」等）：论坛口头陈述，非文档；「架构保密」只说「官方没有公开架构细节」。
12. **Simon Willison 的城市偏见小试验、HN「逐字母拼出 Qwen」轶事**：未复核的轻量试验/逸闻。
13. **laya 安装细节**（权重 842MB、revision 钉版、trust_remote_code）：与本集主线无关。
14. **Doom/Wikiracing 演示画面**：不复刻、不截图；Doom 成本数字见数字卡 #32（备选）。

## 科普叙事素材（类比镜头 · 反直觉点 · 记忆点候选）

> 全部取自《类比计划》角色（§4.3/§4.4）；〔标〕＝建议用法：记忆点 / 反直觉 / 画面 / 归属句模板。

1. 〔记忆点〕暴雨夜：主播口若悬河，城市停课仍要人守着电视拍板——「主播早已超人，城市仍未自动化」。
2. 〔画面〕主播四病灶依次亮起：口播要人听写 /「应该不会下太大」/ 逐字念稿又慢又贵 / 讨观众喜欢偏报雨。
3. 〔反直觉〕RLHF 联合发明者之一亲手说：讨好与可信是两个优化目标（primer:41/78）——「作者本人开的回马枪」。
4. 〔记忆点〕预报单没有空白处：报不出「紫色的雨」，但照样可能把雨报成晴（primitives-docs:309）。
5. 〔画面〕256 个选项的那一行被校验层打回：契约真的会拒绝（S10 + nibzard 225 条）。
6. 〔记忆点〕窗外大雨、单上填「晴」——格式对了，天气没对（S2/S3b 0.981 自动执行）。
7. 〔画面〕大屏只放一遍；判读员一人一桌，对一排封卡同时落笔（隔离红线：不画多人）。
8. 〔记忆点〕暗号实验：写在别的卡上读 0.00，写进大屏读 0.90——归属句模板「有独立研究者做过一个暗号实验」。
9. 〔反直觉〕「会下雨 0.72 + 不会下雨 0.47 = 1.19」：两张封卡各填各的，自洽交给代码（官方自列）。
10. 〔画面〕计算栏「咔哒」自动算出集中度——判读员的手从不碰这一栏；是否行没有这一栏。
11. 〔反直觉〕同一个「集中度 0.9」：两格对应 95%，十格对应 91%——它量的是形状不是对错。
12. 〔记忆点〕记分牌：说七成的那批日子里约七成真下——承诺给一批，不给单日。
13. 〔转 · 记忆点〕调往高原：照样报「七成」，记分牌出台阶，他自己不报警；现实里没有调令。
14. 〔记忆点〕公平骰子：报 82.9%，实际 19%——世界本身的随机，压扁了报。
15. 〔画面〕三道闸：带伞提醒门槛低、停课停航门槛高；「停不停课从不由判读员决定」。
16. 〔反直觉〕官方自家考场：Jev 不是最准的（67.8% vs 74.1%），但每个模型进了流程都更准更快更便宜——收益在编排。
17. 〔画面〕Jevons：判断变便宜，城市沙盘冒出成千上万个询问气泡（不念具体钱数）。
18. 〔记忆点〕193.6× 的三种口吻：官方自报 193.6 / 我们复算 97.8 / 独立测速 2–6——「每个数字该信几分」的收官演示。
19. 〔画面〕毛病清单墙：九类失败模式官方自己挂出来（字面阅读、数数、日期、多跳、塞太满、被夹纸条带偏、题干与格子打架、1.19、别让他写散文）。
20. 〔收束金句〕判读员不是更聪明的主播，而是一个让判断变便宜的新岗位。

## 台账缺口与交接备注（给主代理，Stage ③ 前处理）

以下事实的一手出处**尚未登记** sources.toml，本文先经 note-200（钉提交）转引并标注；建议主代理补登（`source_ledger.py fetch`）后把本文对应条目的锚从「转引」改为直引：

1. 官方首页（193.6×/444.6×、demo $0.000081/0.114s、「Zero Hallucinations」）——site/index。
2. parallel-questions cookbook（12.2×/10.0×）。
3. 首页 FAQ（「guarantees the shape…not correct」）。
4. concepts__state / concepts__system-one / introduction 三页（panel of experts 句、校准群体承诺句、隔离 vs context rot 句）。
5. 第三方钉提交仓库：jevbench（tag `1df665e3`）、jev-does-not-play-dice（`2ef26b64`）、jev-as-a-judge（`adfea749`）、distil-invoice（`8aeb03f4`）、AbdelStark/jev-benchmarks（`0d610cc`）——五条现有 site/repo 混登会导致 verify 的 B 轨 WARN 与数字锚不稳（分歧 #11）。
6. 另：`docs/assets/**/jev--*` 两张既有 archify 图（shared-read-isolated-branches、calibration-territory）可作为 P3/P5 计划图的改造底稿（源 JSON 在 `.temp/jev-lab/diagrams/`）。
