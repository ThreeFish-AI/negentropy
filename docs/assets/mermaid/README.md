# Mermaid 文本源索引（archify 图的唯一可编辑源）

> 本目录是现役系统文档全部 Mermaid 图的**集中文本源 SSOT**。每张图四件套：
> `docs/assets/mermaid/<分类>/<slug>.mmd`（本文本源）→
> [archify](../../.agents/doc-media-assets.md) 重绘 `docs/assets/architecture/<分类>/<slug>.html` →
> [`scripts/capture-arch-diagram.mjs`](../../../scripts/capture-arch-diagram.mjs) 采集
> `<slug>-dark.png` / `<slug>-light.png`（文档内嵌一律用暗色 PNG）。
>
> **范围**：按**文档**而非目录界定。已纳入：现役系统文档（`docs/concepts/`、`docs/reference/{perceives,wiki}/`、根与 i18n README、
> `apps/` README、`docs/.agents/` 巡检文档），以及已走完本管线的研究文献——`docs/research/cognitive-context/` 的
> Horizon Context 精读、Context Layer 蓝图与 OpenViking 精读（下表 `cognitive-context/` 分节）、
> `docs/research/agent-harness/` 的五层 Harness 精读、AI Native 手册精读（180）与 Hermes Agent 精读（190，下表 `agent-harness/` 分节）、
> `docs/research/self-evolution/` 的 Dream-RSI 精读（下表 `self-evolution/` 分节）、
> `docs/research/agent-infra/` 的 Agent Skills 规范精读与 Jev（System One 决策模型）精读（下表 `agent-infra/` 分节）。未纳入：其余 `docs/research/`（第三方调研）与
> `docs/reference/cognizes/`（已退役遗产），**不在此管线**，原地保留渲染。

## 约定

- **修改一张图**：只改对应 `.mmd` → 用 archify 从新文本重新生成 HTML（整体替换，严禁手改 HTML）→
  跑采集脚本再生 PNG → 三者同一次提交。
- **`.mmd` 文件头**：`%% source / %% slug / %% type / %% derived` 溯源注释；头注释之后是
  从原文档逐字节抽取的 mermaid 体（携带 `%% fix:` 行的图例外，其体为修正后文本）。
- **源文档锚点**：以 § 章号 + 机制/实验稳定键（如 `§2 M1`、`D5`、`B4`）为准，**不记行号**——
  行号随文档编辑腐化（本目录 `%% fix:` 史里已五次重锚），2026-09-22 起弃用；历史 `%% fix:` 记录中的行号保持原样不追改。
- **archify 类型映射**：`flowchart/graph → workflow`（组件图用 `architecture`）、
  `sequenceDiagram → sequence`、`stateDiagram-v2 → lifecycle`；
  `erDiagram / timeline / mindmap / quadrantChart / gantt / pie / gitGraph / classDiagram`
  无对应类型，**原地保留**（下表 `in-place` 行，不建 `.mmd`，避免文本源双份）。
- **不合格式**（wiki 渲染约束，判据见 [doc-media-assets](../../.agents/doc-media-assets.md)）：
  进 wiki 的文档只用纯 markdown `![]()` 内嵌暗色 PNG；`<picture>` 双主题仅限根 / i18n README 与 `.agents`。

## 索引

> 各分类行由对应重绘波次登记；`产物` 列 ✓ = html + dark/light PNG 已入库。

### agent-harness/（Learn Claude Code 五层精读 · AI Native 手册精读 · Hermes Agent 精读）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [claude-code-harness--five-layer-dependency](./agent-harness/claude-code-harness--five-layer-dependency.mmd) | [170 总览 §1](../../research/agent-harness/170-claude-code-harness-overview.md) | workflow | ✓ | done | 五层依赖链总览（trace 动画）；随分部首批入库 |
| [claude-code-memory--memory-panorama](./agent-harness/claude-code-memory--memory-panorama.mmd) | [173 记忆层 §2](../../research/agent-harness/173-claude-code-memory-management.md) | workflow | ✓ | done | 收台四步与登记簿双链互不包含（trace 动画） |
| [claude-code-tooling--execution-panorama](./agent-harness/claude-code-tooling--execution-panorama.mmd) | [171 执行层 §2](../../research/agent-harness/171-claude-code-tooling-execution.md) | workflow | ✓ | done | 一圈主链 + 号码簿旁支 + 收工支路（trace 动画） |
| [claude-code-concurrency--timing-panorama](./agent-harness/claude-code-concurrency--timing-panorama.mmd) | [174 时机层 §2](../../research/agent-harness/174-claude-code-concurrency.md) | workflow | ✓ | done | 后台/通知/定时三支路汇回下一轮（trace 动画） |
| [claude-code-planning--planning-panorama](./agent-harness/claude-code-planning--planning-panorama.mmd) | [172 规划层 §2](../../research/agent-harness/172-claude-code-planning-coordination.md) | workflow | ✓ | done | 垫纸每轮重装配主链 + 副台/手册/补救梯旁支（trace 动画） |
| [claude-code-multiagent--collab-panorama](./agent-harness/claude-code-multiagent--collab-panorama.mmd) | [175 协作层 §2](../../research/agent-harness/175-claude-code-multi-agent-platform.md) | workflow | ✓ | done | 排工板/收件格/班次/隔间四组物件汇入同一循环（trace 动画） |
| [ai-native--handbook-panorama](./agent-harness/ai-native--handbook-panorama.mmd) | [180 AI Native 手册 §1](../../research/agent-harness/180-ai-native-handbook.md) | dataflow | ✓ | done | 三案例共同观察 → 五挑战 → 四层基础设施 → 可靠交付；组织配套虚线直达（非基础设施） |
| [ai-native--harness-control-loop](./agent-harness/ai-native--harness-control-loop.mmd) | [180 AI Native 手册 §2](../../research/agent-harness/180-ai-native-handbook.md) | workflow | ✓ | done | 三泳道（模型 / 确定性控制面 / 资源与证据）U 形闭环：PEP⇄PDP → 凭证代理 → 生产变更经 Guardrail 三态门控，Trajectory 旁路 |
| [hermes-agent--turn-loop](./agent-harness/hermes-agent--turn-loop.mmd) | [190 Hermes Agent §2/§3](../../research/agent-harness/190-hermes-agent.md) | workflow | ✓ | done | 三泳道（主循环 / 压缩 / 持久层）：三段式提示只装配一次，超阈值压缩→重建提示为唯一计划内断点，逐条落盘 state.db（trace 动画；新创作，无原文 mermaid 块） |
| [hermes-agent--learning-loop](./agent-harness/hermes-agent--learning-loop.mmd) | [190 Hermes Agent §2/§5](../../research/agent-harness/190-hermes-agent.md) | workflow | ✓ | done | 三泳道（前台 / 后台 review / 技能库与 Curator）：交付后分叉 → 分派侧白名单（越界得拒绝回执）→ skill_manage 记署名 → 下次会话进目录（trace 动画；新创作，无原文 mermaid 块） |

### self-evolution/（docs/research/self-evolution/ 的 Dream-RSI 精读）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [dream-rsi--two-phase-loop](./self-evolution/dream-rsi--two-phase-loop.mmd) | [144 §2](../../research/self-evolution/144-dream-rsi.md) | workflow | ✓ | done | 在线真实世界 ↔ 离线重放世界两相闭环（trace 动画） |
| [dream-rsi--replay-simulator](./self-evolution/dream-rsi--replay-simulator.mmd) | [144 §4](../../research/self-evolution/144-dream-rsi.md) | workflow | ✓ | done | 决策接口 + 确定性转移 + 重放目标 V 三分量；底部通道回环 |
| [dream-rsi--expedition-setup](./self-evolution/dream-rsi--expedition-setup.mmd) | [144 总类比](../../research/self-evolution/144-dream-rsi.md) | architecture | ✓ | done | 探险队/台账/沙盘/幕僚长三件套总装与回灌回路 |
| [dream-rsi--dilemma-cost](./self-evolution/dream-rsi--dilemma-cost.mmd) | [144 §1](../../research/self-evolution/144-dream-rsi.md) | workflow | ✓ | done | 固定章程砸空转 vs 在线改不起两难，汇流到成本结构与破局 |
| [dream-rsi--history-as-simulator](./self-evolution/dream-rsi--history-as-simulator.mmd) | [144 §1](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | 历史→免费模拟器→四条设计规格→回灌循环 |
| [dream-rsi--discovery-tree](./self-evolution/dream-rsi--discovery-tree.mmd) | [144 §3](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | 台账页 primary parent 长成树 + 共享决策接口批次 |
| [dream-rsi--determinism-proof](./self-evolution/dream-rsi--determinism-proof.mmd) | [144 §4](../../research/self-evolution/144-dream-rsi.md) | lifecycle | ✓ | done | 重放两条转移规则与终止计分（确定性） |
| [dream-rsi--four-charters](./self-evolution/dream-rsi--four-charters.mmd) | [144 §4](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | 同一棵 T1 树上四章程重放分高下 0.83/0.85/0.76/0.77 |
| [dream-rsi--v-three-terms](./self-evolution/dream-rsi--v-three-terms.mmd) | [144 §5](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | 重放分 V 三分量解剖 + 附录 B.2 口径分裂注记 |
| [dream-rsi--proto-two-rounds](./self-evolution/dream-rsi--proto-two-rounds.mmd) | [144 §5](../../research/self-evolution/144-dream-rsi.md) | lifecycle | ✓ | done | 两轮递归 0.90→0.92、探测 12→11 与收放批次 |
| [dream-rsi--teardown-d1-guard](./self-evolution/dream-rsi--teardown-d1-guard.mmd) | [144 §7](../../research/self-evolution/144-dream-rsi.md) | lifecycle | ✓ | done | D1 拆候选包含保证：0.77 上位、下轮退化 0.80 |
| [dream-rsi--teardown-d4-peek](./self-evolution/dream-rsi--teardown-d4-peek.mmd) | [144 §7](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | D4 越权跳读排名反转：0.76→0.86 反超 0.85 |
| [dream-rsi--teardown-d5-lockin](./self-evolution/dream-rsi--teardown-d5-lockin.mmd) | [144 §7](../../research/self-evolution/144-dream-rsi.md) | lifecycle | ✓ | done | D5 语义引导锁死 0.80 vs 重放改进 0.92 |
| [dream-rsi--evidence-162x-caliber](./self-evolution/dream-rsi--evidence-162x-caliber.mmd) | [144 §6](../../research/self-evolution/144-dream-rsi.md) | dataflow | ✓ | done | 317/550/51200 三柱 + 口径警示 + 数据集拆解 |
| [dream-rsi--behavior-adaptive](./self-evolution/dream-rsi--behavior-adaptive.mmd) | [144 §6](../../research/self-evolution/144-dream-rsi.md) | lifecycle | ✓ | done | 先省后探：110→50→回升与性能 0.427→1.898 |
| [dream-rsi--unproven-list](./self-evolution/dream-rsi--unproven-list.mmd) | [144 §8](../../research/self-evolution/144-dream-rsi.md) | workflow | ✓ | done | 论文未证明五件事清单（panel+编号反枚举） |

### agent-infra/（docs/research/agent-infra/ 的 Agent Skills 规范精读（090 + 重学 210）+ Jev 精读）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [agent-skills--progressive-disclosure](./agent-infra/agent-skills--progressive-disclosure.mmd) | [090 §2](../../research/agent-infra/090-agent-skills-spec.md) | workflow | ✓ | done | 运行相：发现→解析→Tier 1 目录→Tier 2 激活→Tier 3 资源，四泳道阶梯 + 预算/激活/契约三卡 |
| [jev--one-pass-decision](./agent-infra/jev--one-pass-decision.mmd) | [200 §2](../../research/agent-infra/200-jev-system-one-model.md) | dataflow | ✓ | done | 推理相：契约（422/255/10 级）→一次编码·分支隔离·选项读出→概率与 confidence 固定公式→阈值三档 + 类型安全≠正确/隔离代价/校准领地三卡 |
| [jev--fast-slow-harness](./agent-infra/jev--fast-slow-harness.mmd) | [200 §6](../../research/agent-infra/200-jev-system-one-model.md) | workflow | ✓ | done | 编排相：代码规则→System 2 规划→System 1 挑选→置信分流（执行/回规划/人工）+ 回写闭环 + 分流经济学/拆校准账单/System 2 出候选三卡 |
| [jev--sorting-center](./agent-infra/jev--sorting-center.mmd) | [200 总类比](../../research/agent-infra/200-jev-system-one-model.md) | architecture | ✓ | done | 分拣中心总览剧场（视频 E2 新绘）：调度员/老分拣员/面单/小票/格口墙/三去向总装 |
| [jev--question-contracts](./agent-infra/jev--question-contracts.mmd) | [200 §1 接口契约](../../research/agent-infra/200-jev-system-one-model.md) | workflow | ✓ | done | 契约解剖（视频 E2 新绘）：state+questions→校验 422→三题型→类型化答案四泳道 |
| [jev--slot-wall](./agent-infra/jev--slot-wall.mmd) | [200 §3](../../research/agent-infra/200-jev-system-one-model.md) | architecture | ✓ | done | 格口墙（视频 E2 新绘）：criteria 挂牌/255 上限两阶段/形式闸构造保证 vs 语义闸仍会投错/陷阱面单 |
| [jev--closed-vs-open](./agent-infra/jev--closed-vs-open.mmd) | [200 §3 B2](../../research/agent-infra/200-jev-system-one-model.md) | workflow | ✓ | done | 拆掉闭合（视频 E2 新绘）：闭合解码→类型安全 ✔ vs 生成+宽松解析→'Billing team' 越界 ✘ 三泳道对照 |
| [jev--isolation-probe](./agent-infra/jev--isolation-probe.mmd) | [200 §4 隔离探针](../../research/agent-infra/200-jev-system-one-model.md) | sequence | ✓ | done | 隔离探针时序（视频 E2 新绘）：暗号在兄弟小票 P=0.00 vs 在底单 P=0.90–0.92 两轮对照 |
| [jev--no-cross-invariant](./agent-infra/jev--no-cross-invariant.mmd) | [200 §4 跨问题无不变量 / B6](../../research/agent-infra/200-jev-system-one-model.md) | workflow | ✓ | done | 同一决策三种问法（视频 E2 新绘）：双 Noul 概率溢出 1.19/双执行 vs 单 Choice 和=1 + 代码兜底 |
| [jev--confidence-readout](./agent-infra/jev--confidence-readout.mmd) | [200 §5 confidence 公式](../../research/agent-infra/200-jev-system-one-model.md) | dataflow | ✓ | done | 把握读数数据流（视频 E2 新绘）：概率分布→Choice/Score 两公式（出处=官方 adapter 代码）→示例可复算 |
| [jev--calibration-ladder](./agent-infra/jev--calibration-ladder.mmd) | [200 §5 校准的领地](../../research/agent-infra/200-jev-system-one-model.md) | lifecycle | ✓ | done | 校准领地状态机（视频 E2 新绘）：分布内 0.03→分布外 0.107→强制不确定 0.246；温度缩放修不了排序；诚实重校准=闭嘴 |
| [jev--gate-thresholds](./agent-infra/jev--gate-thresholds.mmd) | [200 §6 S10](../../research/agent-infra/200-jev-system-one-model.md) | lifecycle | ✓ | done | 阈值三档状态机（视频 E2 新绘）：≥0.95 直投/0.6–0.95 复核/<0.6 人工 + 对账 118/346/136 与「有把握的大多数」 |
| [jev--benchmark-audit](./agent-infra/jev--benchmark-audit.mmd) | [200 §8 争议 2 / §9.2](../../research/agent-infra/200-jev-system-one-model.md) | dataflow | ✓ | done | 自报基准口径对账（视频 E2 新绘）：自出卷+LLM 平均答案+adapter 陪跑 → 头条 193.6×/444.6× vs 复算 75×/171× vs 第三方 1.2× |
| [jev--decision-vs-generation](./agent-infra/jev--decision-vs-generation.mmd) | [200 §1 定位 + §11 边界](../../research/agent-infra/200-jev-system-one-model.md) | architecture | ✓ | done | 判断/生成分工（视频 E2 新绘）：两通道+接口契约；四拿（结构红利）vs 四缺（证据与中文场景）+开放问题 |
| [agent-skills--package-and-validation](./agent-infra/agent-skills--package-and-validation.mmd) | [090 §3](../../research/agent-infra/090-agent-skills-spec.md) | architecture | ✓ | done | 作者相：技能包解剖 × skills-ref 三命令 × 规范↔实现 13 处分歧 |
| [agent-skills--disclosure-lifecycle](./agent-infra/agent-skills-disclosure-lifecycle.mmd) | [210 §4/§6](../../research/agent-infra/210-agent-skills-open-standard.md) | workflow | ✓ | done | 运行相（重学版）：发现→宽容解析→作用域→台账常驻→语义路由→整载→解释执行 + 压缩豁免/激活去重守护 |
| [agent-skills--governance-layers](./agent-infra/agent-skills-governance-layers.mmd) | [210 §3/§8/§9](../../research/agent-infra/210-agent-skills-open-standard.md) | architecture | ✓ | done | 治理相（重学版）：规范 MUST/建议/留白 × 指南层 × 生态四家抽样 × 48 PR 悬案三行网格 |
| [agent-skills--port-46-adoption](./agent-infra/agent-skills-port-46-adoption.mmd) | [分镜 0-A/0-B](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 生态采纳全景（视频 E1 重绘）：2025 捐出→竞对全接→整张牌桌（视频 E1 重绘新绘） |
| [agent-skills--two-old-roads](./agent-infra/agent-skills-two-old-roads.mmd) | [分镜 0-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 两条老路死法：盲航/超载/成本函数之问双泳道（视频 E1 重绘新绘） |
| [agent-skills--box-anatomy](./agent-infra/agent-skills-box-anatomy.mmd) | [分镜 1-A/1-C](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | architecture | ✓ | done | 技能包解剖：箱体/角件六字段/箱号=登记名/正文附件/选填验箱五章（视频 E1 重绘新绘） |
| [agent-skills--identity-registry](./agent-infra/agent-skills-identity-registry.mmd) | [分镜 1-B](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | sequence | ✓ | done | 身份登记处时序：无注册中心→文件系统即登记（视频 E1 重绘新绘） |
| [agent-skills--craft-real-tasks](./agent-infra/agent-skills-craft-real-tasks.mmd) | [分镜 1-D/1-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 正文工艺：真实任务长出→坑点上册→跑了再改→会的别写（视频 E1 重绘新绘） |
| [agent-skills--budget-flipboard](./agent-infra/agent-skills-budget-flipboard.mmd) | [分镜 2-D/2-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | dataflow | ✓ | done | 成本翻牌：玩具实测 39222vs2321/≈17×/OpenAI 2% 红线（视频 E1 重绘新绘） |
| [agent-skills--script-craft](./agent-infra/agent-skills-script-craft.mmd) | [分镜 2-F](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 箱内脚本工艺：钉版本+四条家规（视频 E1 重绘新绘） |
| [agent-skills--label-good-bad](./agent-infra/agent-skills-label-good-bad.mmd) | [分镜 3-A/3-B](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | architecture | ✓ | done | 好签差签并排：静默退化/没说关键词（视频 E1 重绘新绘） |
| [agent-skills--routing-eval-protocol](./agent-infra/agent-skills-routing-eval-protocol.mmd) | [分镜 3-C/3-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 货签的考试：近失配/20×3 触发率/六四分/一秒面试（视频 E1 重绘新绘） |
| [agent-skills--four-ports-charter](./agent-infra/agent-skills-four-ports-charter.mmd) | [分镜 4-A..4-C/4-F](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | architecture | ✓ | done | 四港章程：四联卡/四港画像/堆场锚点/验箱师/签名真空（视频 E1 重绘新绘） |
| [agent-skills--lenient-vs-strict](./agent-infra/agent-skills-lenient-vs-strict.mmd) | [分镜 4-D](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 宽容 vs 严格双泳道：警告照放/12 只实测门（视频 E1 重绘新绘） |
| [agent-skills--eval-twin-runs](./agent-infra/agent-skills-eval-twin-runs.mmd) | [分镜 4-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 双跑盲评：匿名两跑/断言记账（视频 E1 重绘新绘） |
| [agent-skills--experiment-scan-order](./agent-infra/agent-skills-experiment-scan-order.mmd) | [分镜 5-A/5-B](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | workflow | ✓ | done | 实验一：拆优先级→两港漂移→无报错（视频 E1 重绘新绘） |
| [agent-skills--shadow-warning](./agent-infra/agent-skills-shadow-warning.mmd) | [分镜 5-C](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | lifecycle | ✓ | done | 遮蔽生命周期：复制→项目域遮蔽→告警/静默双分支（视频 E1 重绘新绘） |
| [agent-skills--experiment-label-injection](./agent-infra/agent-skills-experiment-label-injection.mmd) | [分镜 5-D/5-E](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | sequence | ✓ | done | 实验二时序：缩进伪字段→误收→若当真→truthiness（视频 E1 重绘新绘） |
| [agent-skills--pending-wars](./agent-infra/agent-skills-pending-wars.mmd) | [分镜 6-B/6-C](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | dataflow | ✓ | done | 治理悬案流：四向压力→48 PR→停摆/对冲/互通三结局（视频 E1 重绘新绘） |
| [agent-skills--box-history-rhyme](./agent-infra/agent-skills-box-history-rhyme.mmd) | [分镜 6-D](../../../apps/negentropy-influence/episodes/agent-skills-video/script/storyboard.md) | lifecycle | ✓ | done | 集装箱史押韵：1956→CSI→先事实后条文（视频 E1 重绘新绘） |

> 各分类行由对应重绘波次登记；`产物` 列 ✓ = html + dark/light PNG 已入库。

### core/（framework 与总览）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [negentropy-architecture](./core/negentropy-architecture.mmd) | [framework.md §2.1](../../concepts/framework.md) | architecture | ✓ +svg/mp4/gif | 旗舰 | 11 源码深链；文本源自原 `<details>` 折叠块迁入 |
| [framework--faculties-orchestration](./core/framework--faculties-orchestration.mmd) | framework.md §3.2 | architecture | ✓ | done | 源码深链；边标签升级为逐系部委派意图 |
| [framework--agent-collaboration-sequence](./core/framework--agent-collaboration-sequence.mmd) | framework.md §3.4 | sequence | ✓ | done | |
| [framework--standard-pipelines](./core/framework--standard-pipelines.mmd) | framework.md §4.1 | workflow | ✓ | done | |
| [framework--bootstrap-sequence](./core/framework--bootstrap-sequence.mmd) | framework.md §6.1 | workflow | ✓ | done | fix: D-9 挂载点 4→8 组（/knowledge 16 子路由） |
| [framework--observability-dataflow](./core/framework--observability-dataflow.mmd) | framework.md §6.4 | dataflow | ✓ | done | |
| [framework--engine-interior](./core/framework--engine-interior.mmd) | framework.md §6.5（新增） | architecture | ✓ | done | fix: D-1/D-2/D-14 全新补齐引擎内部七子系统 |
| [framework--schema-domains](./core/framework--schema-domains.mmd) | framework.md §8.2 | architecture | ✓ | done | fix: D-8 cognizes 遗产 .sql → models/ 九域 76 表 |
| [framework--connection-lifecycle](./core/framework--connection-lifecycle.mmd) | framework.md §9.5 | lifecycle | ✓ | done | 设计层状态机；代码口径差已在正文注记 |
| [framework--testing-pyramid](./core/framework--testing-pyramid.mmd) | framework.md §10.1 | architecture | ✓ | done | 单元基座按端拆分承载各自覆盖率门 |
| [framework--ci-cd-pipeline](./core/framework--ci-cd-pipeline.mmd) | framework.md §10.4 | workflow | ✓ | done | fix: 补 perceives/wiki 质量门事实 |
| [a2ui--fact-source](./core/a2ui--fact-source.mmd) | a2ui.md §3 | workflow | ✓ | done | 13 节点全部代码实证 |
| [a2ui--main-rail](./core/a2ui--main-rail.mmd) | a2ui.md §4 | workflow | ✓ | done | |
| [conversation-foundation--architecture](./core/conversation-foundation--architecture.mmd) | conversation-foundation.md | workflow | ✓ | done | Guide 节点按 user-guide/ 目录实况改绘 |
| [readme--faculties-en](./core/readme--faculties-en.mmd) | README.md（根） | architecture | ✓ | done | 英文内容，locale=en |
| [readme-zh--faculties](./core/readme-zh--faculties.mmd) | docs/i18n/zh-CN/README.md | architecture | ✓ | done | |

### design/（docs/concepts/design/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [self-evolving--consolidation-loop](./design/self-evolving--consolidation-loop.mmd) | design/self-evolving-agents.md §7 |  | ✓ | done | fix: 1) 补码证负反馈闭环边：memory_retrieval_logs 的 irr |
| [self-evolving--four-layer-loop](./design/self-evolving--four-layer-loop.mmd) | design/self-evolving-agents.md §2 |  | ✓ | done | fix: 对照仓库代码修正三处：(1) 评测引擎删「Agent-as-a-Judge」（文 |
| [0002-ui--phase-roadmap](./design/0002-ui--phase-roadmap.mmd) | design/0002-ui-interaction-enhancements.md | workflow | ✓ | done | fix: 以代码为准修正五处：(1) 原图把 4.1-4.6 六项全部画成 RFC 000 |
| [qa-delivery--push-gate](./design/qa-delivery--push-gate.mmd) | design/qa-delivery-pipeline.md | workflow | ✓ | done | fix: 三处按代码修正：1) 原图 PRGate 子图只画「入口→reusable」两层 |
| [docker-release--pipeline](./design/docker-release--pipeline.mmd) | design/docker-release-pipeline.md | workflow | ✓ | done | fix: D-7 修正已核验并落入产物：workflow matrix 实际为 wiki← |
| [sso--auth-flow](./design/sso--auth-flow.mmd) | design/sso.md | sequence | ✓ | done | fix: validate 三轮收敛（18 err → 1 err → 0/0）：R1 修 |
| [browser-mcp--seed-migration](./design/browser-mcp--seed-migration.mmd) | design/browser-automation-mcp-integration.md | workflow | ✓ | done | fix: 源图 11 节点精简为 8（workflow v2 ≤8 预算）：三执行入口（R |
| [skills--management-ui](./design/skills--management-ui.mmd) | design/skills.md | workflow | ✓ | done | fix: (1) SkillFormDialog → SkillFormDrawer：实际 |

### operations/（docs/concepts/operations/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [development--workflow](./operations/development--workflow.mmd) | operations/development.md §3 | workflow | ✓ | done | fix: D-11：后端开发入口按真实流程用 uv run negentropy  |
| [docker-operations--compose-topology](./operations/docker-operations--compose-topology.mmd) | operations/docker-operations.md §1.1 | architecture | ✓ | done | fix: D-5/D-6 必改项均已落实并带 %% fix 行：(1) 移除幽灵边 |
| [docker-operations--troubleshooting](./operations/docker-operations--troubleshooting.mmd) | operations/docker-operations.md §6 | workflow | ✓ | done | fix: mmd 携带 3 条 %% fix：(1)「按启动顺序」实为 compo |
| [local-llm-ollama--setup-path](./operations/local-llm-ollama--setup-path.mmd) | operations/local-llm-ollama.md | workflow | ✓ | done | fix: 4 条 %% fix：(1) 原图云 Key 路径止于「对话」无对照终点 |

### subsystems/（docs/concepts/subsystems/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [025-memory--automation-gates](./subsystems/025-memory--automation-gates.mmd) | subsystems/025 §5 | workflow | ✓ | done | fix: 无需 %% fix: 修正（文档块与引用源码逐项核验一致：24h/5 会话阈值、 |
| [025-memory--session-summarizer](./subsystems/025-memory--session-summarizer.mmd) | subsystems/025 §5.4 | workflow | ✓ | done | fix: 两处 %% fix：(1) 源图「Session Summarizer」节点在代 |
| [025-memory--runner-sequence](./subsystems/025-memory--runner-sequence.mmd) | subsystems/025 §4 | sequence | ✓ | done | fix: 1) 事实修正（mmd 头部 %% fix: 三行 + notes）：简化路径由 |
| [025-memory--dedup-stages](./subsystems/025-memory--dedup-stages.mmd) | subsystems/025 §5.6 | workflow | ✓ | done | fix: mmd 头 %% fix 两项：(1) 补 Stage 3「判定无矛盾 → 通过 |
| [025-memory--hybrid-search-levels](./subsystems/025-memory--hybrid-search-levels.mmd) | subsystems/025 §6.1 | workflow | ✓ | done | fix: ①决策门「有 embedding_fn？」校正为「query 向量可用？」：代码 |
| [025-memory--forms-dimensions](./subsystems/025-memory--forms-dimensions.mmd) | subsystems/025 §1 | architecture | ✓ | done | fix: EX→FL 边标签由「instructions 表」改为「memories /  |
| [025-memory--dashboard-ui](./subsystems/025-memory--dashboard-ui.mmd) | subsystems/025 §3 | architecture | ✓ | done | fix: 五处文档-代码偏差校正（详见 .mmd %% fix 行与 .temp/arch |
| [025-memory--audit-api-sequence](./subsystems/025-memory--audit-api-sequence.mmd) | subsystems/025 §7.3 | sequence | ✓ | done | fix: 1) 幂等性检查从源图 MGS 自环改为 MGS→PostgreSQL 的 SE |
| [037-federated--cross-corpus-search](./subsystems/037-federated--cross-corpus-search.mmd) | subsystems/037 §4 | workflow | ✓ | done | fix: ① Stage 3 触发集合补 global_summary（hybrid_pl |
| [025-memory--lifecycle](./subsystems/025-memory--lifecycle.mmd) | subsystems/025 §2 | lifecycle | ✓ | done | fix: 无 %% fix: 行——代码核验未发现需改拓扑的文档-代码不一致（全部转换与  |
| [037-federated--kg-topology](./subsystems/037-federated--kg-topology.mmd) | subsystems/037 §3 | architecture | ✓ | done | fix: 1) KgRelation 原图是 Corpus-A 内孤立节点，实为 corp |
| [025-memory--retrieval-logging](./subsystems/025-memory--retrieval-logging.mmd) | subsystems/025 §6.5 | dataflow | ✓ | done | fix: 终点节点「调整 retention_score 权重」校正为「自进化调权」：代码 |
| [025-memory--control-plane](./subsystems/025-memory--control-plane.mmd) | subsystems/025 §8 | architecture | ✓ | done | fix: 4 处文档-代码不一致按当前实现修正（mmd 头 %% fix: 行）：1) p |
| [025-memory--telemetry-collection](./subsystems/025-memory--telemetry-collection.mmd) | subsystems/025 §11.4 | dataflow | ✓ | done | fix: 无内容级修正（faithful redraw，未加 %% fix 行）。结构性调 |
| [035-kb--search-functions](./subsystems/035-kb--search-functions.mmd) | subsystems/035 §3 | workflow | ✓ | done | fix: 三条 %% fix 已写入 .mmd 头部：(1) 文档 §6.1 模块 |
| [035-kb--ingestion-sequence](./subsystems/035-kb--ingestion-sequence.mmd) | subsystems/035 §5.1 | sequence | ✓ | done | fix: 5 条 %% fix 已写入 .mmd 头部：(1) 摄取入口已异步化— |
| [035-kb--retrieval-levels](./subsystems/035-kb--retrieval-levels.mmd) | subsystems/035 §6 | workflow | ✓ | done | fix: 1) 源图「L0 扇出 Semantic/Keyword/RRF 三路并 |
| [035-kb--multi-catalog](./subsystems/035-kb--multi-catalog.mmd) | subsystems/035 §15.4（设计态 ADR） | architecture | ✓ | done | fix: 设计态 ADR 如实标注（未实现） |
| [035-kb--catalog-page-ui](./subsystems/035-kb--catalog-page-ui.mmd) | subsystems/035 §13 | architecture | ✓ | done | fix: 未解诊断为 6 条纯标签几何冲突（3× composition/labe |
| [036-kg--perception-pipeline](./subsystems/036-kg--perception-pipeline.mmd) | subsystems/036 §2 | workflow | ✓ | done |  |
| [036-kg--api-layering](./subsystems/036-kg--api-layering.mmd) | subsystems/036 §4.2 | architecture | ✓ | done | fix: GRAG 状态修正（已落地端点补绘） |
| [036-kg--llm-extraction-sequence](./subsystems/036-kg--llm-extraction-sequence.mmd) | subsystems/036 §5 | sequence | ✓ | done |  |
| [036-kg--dual-write](./subsystems/036-kg--dual-write.mmd) | subsystems/036 §5.2 | workflow | ✓ | done | fix: 1) 源块「写 AGE Edge」/「读 AGE (优先)」与实现不符： |
| [036-kg--extraction-sequence](./subsystems/036-kg--extraction-sequence.mmd) | subsystems/036 §6 | sequence | ✓ | done | fix: .mmd 头部记录 5 条 %% fix（均为「源图 = §5.4 目标 |
| [036-kg--index-build](./subsystems/036-kg--index-build.mmd) | subsystems/036 §7 | dataflow | ✓ | done |  |
| [036-kg--retrieval-sequence](./subsystems/036-kg--retrieval-sequence.mmd) | subsystems/036 §8 | sequence | ✓ | done | fix: 两处文档-代码漂移已在 .mmd 头部以 %% fix 行记录（均不影响 |
| [036-kg--retrieval-lifecycle](./subsystems/036-kg--retrieval-lifecycle.mmd) | subsystems/036 §9 | lifecycle | ✓ | done |  |
| [036-kg--feedback-loop](./subsystems/036-kg--feedback-loop.mmd) | subsystems/036 §10 | dataflow | ✓ | done | fix: 根因不是「边穿节点」本身，而是 alert 与 feedback 被放在 |
| [036-kg--engine-integration](./subsystems/036-kg--engine-integration.mmd) | subsystems/036 §11 |  | ✓ | done | fix: 事实核验零修正：15 节点与 11 条边全部命中代码锚点（agent.p |
| [039-routine--architecture-overview](./subsystems/039-routine--architecture-overview.mmd) | subsystems/039 §2 | architecture | ✓ | done |  |
| [039-routine--iteration-lifecycle](./subsystems/039-routine--iteration-lifecycle.mmd) | subsystems/039 §4.1 | lifecycle | ✓ | done |  |
| [039-routine--decision-lifecycle](./subsystems/039-routine--decision-lifecycle.mmd) | subsystems/039 §4.2 | lifecycle | ✓ | done | fix: 1) 未解诊断（转移标签「评分写回」压盖 evaluating）：按建议 |
| [039-routine--inspector-heartbeat](./subsystems/039-routine--inspector-heartbeat.mmd) | subsystems/039 §5 | sequence | ✓ | done |  |
| [039-routine--orchestration-loop](./subsystems/039-routine--orchestration-loop.mmd) | subsystems/039 §6 | workflow | ✓ | done | fix: ① 工作分支名以代码为准：routine/&lt;sanitize(ke |
| [040-faculty--routine-bridge](./subsystems/040-faculty--routine-bridge.mmd) | subsystems/040 | architecture | ✓ | done | fix: 落地状态修正：FacultyBridge 真实调用已接 INJECT-2 |
| [041-transcript--full-view](./subsystems/041-transcript--full-view.mmd) | subsystems/041 | workflow | ✓ | done |  |

### user-guide/（docs/concepts/user-guide/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [chat-essentials--request-sequence](./user-guide/chat-essentials--request-sequence.mmd) | user-guide/chat-essentials | sequence | ✓ | done | fix: 原图 3 处失真已在 .mmd 头部以 %% fix: 标注并落图：(1 |
| [chat-essentials--agent-dispatch-sequence](./user-guide/chat-essentials--agent-dispatch-sequence.mmd) | user-guide/chat-essentials | sequence | ✓ | done | fix: 共 6 条 %% fix（已写入 .mmd 头部，均有代码行号佐证）：
 |
| [interface--plugin-system](./user-guide/interface--plugin-system.mmd) | user-guide/interface | architecture | ✓ | done | fix: 三处事实纠偏（均已写入 .mmd 的 %% fix: 行与 facts  |
| [interface--model-onboarding](./user-guide/interface--model-onboarding.mmd) | user-guide/interface | workflow | ✓ | done | fix: 依代码取证修正源图 4 处语义错位（均在 .mmd 以 %% fix:  |
| [knowledge-management--ingest-flow](./user-guide/knowledge-management--ingest-flow.mmd) | user-guide/knowledge-management | workflow | ✓ | done | fix: 对照代码核出原 Mermaid 三处失真，已写入 .mmd 的 %% f |
| [memory-automation--tasks-tab](./user-guide/memory-automation--tasks-tab.mmd) | user-guide/memory-automation | workflow | ✓ | done | fix: 三处修正（均已写入 .mmd 的 %% fix: 行）：(1) 结构性错 |
| [memory-basics--write-read](./user-guide/memory-basics--write-read.mmd) | user-guide/memory-basics | workflow | ✓ | done | fix: ①巩固管线步骤修正：原图 Segment→Dedup→Store→Ext |
| [papers-curation--sequence](./user-guide/papers-curation--sequence.mmd) | user-guide/papers-curation | sequence | ✓ | done | fix: 对照代码核出源图 4 处需修正/补全，已在 .mmd 头部以 %% fi |
| [quickstart--first-chat-sequence](./user-guide/quickstart--first-chat-sequence.mmd) | user-guide/quickstart | sequence | ✓ | done | fix: 共 8 条修正（全部写入 .mmd 头部 %% fix: 行，逐条证据见 |
| [transcript-view--studio-layout](./user-guide/transcript-view--studio-layout.mmd) | user-guide/transcript-view | workflow | ✓ | done |  |

### perceives/（docs/reference/perceives/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [framework--five-layers](./perceives/framework--five-layers.mmd) | perceives/framework.md | architecture | ✓ | done | fix: 对照代码核出 3 处修正，已写入 .mmd 头部 %% fix: 行并在 |
| [framework--engine-registry](./perceives/framework--engine-registry.mmd) | perceives/framework.md | architecture | ✓ | done | fix: 三处修正（均附 %% fix: 行）：1) 原图 R 节点 "app · |
| [framework--mcp-tools](./perceives/framework--mcp-tools.mmd) | perceives/framework.md | architecture | ✓ | done | fix: D-12 事实修正（均已写入 .mmd %% fix: 行与图内 amb |
| [framework--degradation-fallback](./perceives/framework--degradation-fallback.mmd) | perceives/framework.md | workflow | ✓ | done | fix: ① 按代码真实引擎集绘制降级链：Docling → OpenDataLo |
| [framework--pdf-stages](./perceives/framework--pdf-stages.mmd) | perceives/framework.md | dataflow | ✓ | done | fix: 引擎清单补齐：S2/S3/S4 补 opendataloader（con |
| [framework--webpage-stages](./perceives/framework--webpage-stages.mmd) | perceives/framework.md | workflow | ✓ | done | fix: mmd 携 1 条 %% fix：S3 短路语义补正——anti_det |
| [framework--engine-matrix](./perceives/framework--engine-matrix.mmd) | perceives/framework.md | architecture | ✓ | done | fix: ① R1 f3（MinerU→Marker）竖边"降级"标签与 Mine |
| [framework--prescan-strategy](./perceives/framework--prescan-strategy.mmd) | perceives/framework.md | workflow | ✓ | done | fix: 事实修正（写入 mmd %% fix: 行并落图/卡片）：1) 计划引擎 |
| [framework--lifecycle-sequence](./perceives/framework--lifecycle-sequence.mmd) | perceives/framework.md | sequence | ✓ | done | fix: 1) 「指标记录 (_observability)」幽灵引用修正：too |
| [framework--request-flow](./perceives/framework--request-flow.mmd) | perceives/framework.md | workflow | ✓ | done | fix: 1) "Memory Cache" 实为引擎 worker 子进程内 _ |
| [development--test-pyramid](./perceives/development--test-pyramid.mmd) | perceives/development.md | architecture | ✓ | done | fix: 单元测试文件数 40+ → 100（apps/negentropy-pe |
| [development--tool-anatomy](./perceives/development--tool-anatomy.mmd) | perceives/development.md | architecture | ✓ | done | fix: 事实修正（已写入 .mmd 头部 %% fix: 行并在图中更正）：1) |
| [development--ci-flow](./perceives/development--ci-flow.mmd) | perceives/development.md | workflow | ✓ | done | fix: 对照 monorepo 根 .github/workflows/nege |
| [apple-silicon--engine-pipeline](./perceives/apple-silicon--engine-pipeline.mmd) | perceives/agents/apple-silicon-tuning.md | workflow | ✓ | done | fix: (1)「扫描版→Marker」修正为 quick_scan 画像 is_ |
| [apple-silicon--vlm-auto-engine](./perceives/apple-silicon--vlm-auto-engine.mmd) | perceives/agents/apple-silicon-tuning.md | workflow | ✓ | done | fix: ① 判定序按代码校正：源图 pref=auto? 先于 is_apple |
| [pdf-engine--selection-matrix](./perceives/pdf-engine--selection-matrix.mmd) | perceives/agents/pdf-engine-selection.md | architecture | ✓ | done | fix: 3 条 %% fix: ① reason 串实际带 profile: 前 |
| [pdf-engine--reflow-chain](./perceives/pdf-engine--reflow-chain.mmd) | perceives/agents/pdf-engine-selection.md | workflow | ✓ | done | fix: 事实修正（写入 .mmd %% fix: 行）：1) reason 前缀 |
| [pdf-engine--fast-path](./perceives/pdf-engine--fast-path.mmd) | perceives/agents/pdf-engine-selection.md | workflow | ✓ | done | fix: ① reason 实串带 profile: 前缀（profile:sim |
| [readme-zh--five-layers](./perceives/readme-zh--five-layers.mmd) | perceives/zh-CN/README.md | architecture | ✓ | done | fix: 4 处修正（均有代码证据）：1) SDK 双模式——mode="mcp" |

### wiki/（docs/reference/wiki/）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [deployment--production-topology](./wiki/deployment--production-topology.mmd) | wiki/deployment.md | architecture | ✓ | done | fix: D-13 逐项核验并修正：(1) 生产出口改画 GitHub Pages |
| [deployment--local-build](./wiki/deployment--local-build.mmd) | wiki/deployment.md | workflow | ✓ | done | fix: 事实层零修正：8 节点/6 边全部对照 apps/negentropy/ |
| [kg--build-pipeline](./wiki/kg--build-pipeline.mmd) | wiki/design/knowledge-graph.md | workflow | ✓ | done | fix: 图体字节保持原样，修正以 5 条 %% fix 注释行随 .mmd 归档 |
| [ops--publish-flows](./wiki/ops--publish-flows.mmd) | wiki/ops.md | workflow | ✓ | done | fix: 源图 §2.1 为已作废的 SSG+ISR 架构，按仓库代码修正为现行纯 |
| [publishing--user-flow](./wiki/publishing--user-flow.mmd) | wiki/user-guide/publishing.md | workflow | ✓ | done | fix: 事实核验 6 节点/6 边全部与代码一致，无需语义修正（故 .mmd 未 |

### apps/（apps/*/ README）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [perceives-readme--five-layers](./apps/perceives-readme--five-layers.mmd) | apps/negentropy-perceives/README.md | architecture | ✓ | done | fix: Round 1 diagnostics: mcp→engines 自动路 |

> 迁出注记（2026-09-21）：influence--pipeline-layers / voice-cloning--architecture / indextts--synthesis-flow / indextts--reference-audio 四图已随科普视频流水线机制外置删除（源文档迁入 [to-video 技能](https://github.com/ThreeFish-AI/to-video) 仓），对应 .mmd/HTML/PNG 资产同步移除。

### agents/（docs/.agents/ 巡检与决策文档）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [patrol--doc-status-lifecycle](./agents/patrol--doc-status-lifecycle.mmd) | .agents/pdf-fidelity-patrol-status.md | lifecycle | ✓ | done | fix: ① 合格阈值默认已由 95 收紧至 99（PR #1080，config |
| [patrol--patrol-sequence](./agents/patrol--patrol-sequence.mmd) | .agents/pdf-fidelity-patrol-status.md | sequence | ✓ | done | fix: 见上 |
| [patrol--escalation-flow](./agents/patrol--escalation-flow.mmd) | .agents/pdf-fidelity-patrol-status.md | workflow | ✓ | done | fix: 三条 %% fix 随 .mmd 携带并落入图/cards：(1) 清  |
| [issue--session-stale-sequence](./agents/issue--session-stale-sequence.mmd) | .agents/issue.md（ISSUE-066 缩进块） | sequence | ✓ | done | fix: 1) 源图 SUS->>SUS 自环（POST /api/agui/se |
| [wiki-ordering--effective-rank](./agents/wiki-ordering--effective-rank.mmd) | .agents/wiki-docs-ordering.md | workflow | ✓ | done | fix: 源图与代码零偏差，无 %% fix: 行。重绘适配：① 5 泳道语义分组 |

### cognitive-context/（docs/research/cognitive-context/ 的精读笔记与设计蓝图）

| slug | 源文档锚点 | 类型 | 产物 | 状态 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [horizon-context--problem-to-mechanisms](./cognitive-context/horizon-context--problem-to-mechanisms.mmd) | cognitive-context/011-horizon-context.md §1 | dataflow | ✓ | done | 病因链与机制对位：三症状（对账崩塌/裸问准确率/密码列名）收于「语义无人治理」判词 → 三病灶 → M1（口径单点）/M2·M3·M6（治理执法）对位封堵（§10 富化回补长尾）→ M4 应答锚定与 §11–§12 送达；机制节点三合一（机制名/设计规格/类比装备），§15 边界由结论卡承载；2026-09-18 随合并按新 M 集重制 |
| [horizon-context--three-stage-governance](./cognitive-context/horizon-context--three-stage-governance.mmd) | cognitive-context/011-horizon-context.md §3 三阶段治理 | dataflow | ✓ | done | 三阶段治理骨架：三路并列汇聚 → Horizon Catalog 脊柱 → 三路并列富化 → AI-ready 上下文脊柱 → 三面并列激活；节点副标注成熟度与承重/降级锚点（M1·M5 / §10–§12），结论卡载「三阶段是供给不是承重」与本轮未采纳的校准；2026-09-21 抽源重制，原块三条串行链按 %% fix 修正为并列 |
| [horizon-context--collect-enrich-activate](./cognitive-context/horizon-context--collect-enrich-activate.mmd) | cognitive-context/011-horizon-context.md §10 供给富化 | dataflow | ✓ | done | 三段流水线：三源并列汇入目录 → 显式/隐式双轨（冲突浮出人工裁决）→ 四因子排序 → 三类消费者；2026-09-17 重评选后随 §10 嵌入 |
| [horizon-context--declaration-execution](./cognitive-context/horizon-context--declaration-execution.mmd) | cognitive-context/011-horizon-context.md §2 M1 语义视图 | workflow | ✓ | done | 双不变量：声明相（口径单点：五段式+结构校验门）→ 执行相（查询期重算：RBAC + 策略 A 聚合）；2026-09-17 重评选 M1+M2 合并后重制 |
| [horizon-context--autopilot-loop](./cognitive-context/horizon-context--autopilot-loop.mmd) | cognitive-context/011-horizon-context.md §10 富化 | workflow | ✓ | done | Autopilot 创作闭环：六路输入面 → 验证门（无效即弃）→ SV+VQR 受治理入库 → 激活 → 反馈回流 Suggestions；trace 动效版 |
| [horizon-context--engine-governance](./cognitive-context/horizon-context--engine-governance.mmd) | cognitive-context/011-horizon-context.md §2 M3 语义级治理 | workflow | ✓ | done | 语义级治理拓扑：定义与策略同体（defined-once-enforced-everywhere）+ 双层防线（检索过滤=体验/执行拒绝=底线）；2026-09-17 重评选一拆为三后重制（出口安检移 §12） |
| [horizon-context--resolve-activation](./cognitive-context/horizon-context--resolve-activation.mmd) | cognitive-context/011-horizon-context.md §2 M4 验证锚定 | sequence | ✓ | done | 应答层验证锚定时序：VQR 相似路由 → 以已验证 SQL 为生成依据 + 对账重算 / 未命中标「未经核准」/ no_governed_coverage 警告 + 评测闭环墙外边界；2026-09-17 重评选升格后重制 |
| [horizon-context--four-factor-ranking](./cognitive-context/horizon-context--four-factor-ranking.mmd) | cognitive-context/011-horizon-context.md §11 检索 | dataflow | ✓ | done | 四因子排序数据流：五路信号 → R/A/P/F 四因子 → 加权合成 + 显式 tie-break → top-k；trace 动效版 |
| [horizon-context--open-interop](./cognitive-context/horizon-context--open-interop.mmd) | cognitive-context/011-horizon-context.md §12 生态 | architecture | ✓ | done | 开放互操作双路径：Ossie/SYSTEM$ 静态互通（已交付转换器）+ MCP/OAuth 运行时受控供给 + Automatic Data Agents 生态分发，反馈回流 popularity；trace 动效版 |
| [horizon-context--component-panorama](./cognitive-context/horizon-context--component-panorama.mmd) | cognitive-context/011-horizon-context.md §4.1 组件全景 | architecture | ✓ | done | 组件全景：组件按重评选后四簇（口径与应答/治理执法/账本/供给与出口降级区+消费端）分段，机制锚点入节点；2026-09-17 重评选后重制（dataflow 行上限装不下 7 节点降级簇，改 architecture 渲染器） |
| [horizon-context--evolution-timeline](./cognitive-context/horizon-context--evolution-timeline.mmd) | cognitive-context/011-horizon-context.md §4.2 演进时间线 | dataflow | ✓ | done | 三阶段演进时间线：14 里程碑排入五段泳道，机制锚点按重评选后口径重标（含 MS14 2026-09 生态加码）；2026-09-17 重评选后重制 |
| [horizon-context--row-column-policy](./cognitive-context/horizon-context--row-column-policy.mmd) | cognitive-context/011-horizon-context.md §2 M2 行列级策略 | workflow | ✓ | done | 查询期行列级访问策略：masking/row access/aggregation/projection 四策略对象 + 策略所有者角色求值 + IS_AGENT_ACTIVATED 严拒面 + tag-based 衔接 M7；2026-09-17 重评选 M3 拆分后新增 |
| [horizon-context--lineage-ledger](./cognitive-context/horizon-context--lineage-ledger.mmd) | cognitive-context/011-horizon-context.md §2 M5 列级血缘 | dataflow | ✓ | done | 端到端列级血缘：引擎执行自动沉淀依赖边 + OpenLineage 三道闸摄取 → 内外单一账本 + GET_LINEAGE 取数 + 盲区如实；2026-09-17 重评选新晋机制新增 |
| [horizon-context--agent-identity](./cognitive-context/horizon-context--agent-identity.mmd) | cognitive-context/011-horizon-context.md §2 M6 Agent Identity | workflow | ✓ | done | Agent Identity：RSS 权限天花板（用户权限∩代理允许面·只减不增）→ 会话身份 → agent_type 归因审计 + 谓词衔接 M2；2026-09-17 重评选新晋机制新增 |
| [horizon-context--classification-tagging](./cognitive-context/horizon-context--classification-tagging.mmd) | cognitive-context/011-horizon-context.md §2 M7 分类标签 | workflow | ✓ | done | 分类与标签驱动策略传播：持续分类 → 系统标签 → 一次性映射（掩码不可直绑系统标签）→ 用户标签驱动 tag-based 策略 → 新列自动纳管；未映射=显式缺口；2026-09-17 重评选新晋机制新增 |
| [context-layer-blueprint--industry-landscape](./cognitive-context/context-layer-blueprint--industry-landscape.mmd) | cognitive-context/013-context-layer-blueprint.md §2 业界格局 | architecture | ✓ | done | 四路线格局（联邦低值边由卡片承载）；消费者居中辐射，蓝图落位独立可执行层 |
| [context-layer-blueprint--mcp-threat-model](./cognitive-context/context-layer-blueprint--mcp-threat-model.mmd) | cognitive-context/013-context-layer-blueprint.md §7.6 供给面威胁模型 | architecture | ✓ | done | 客户端→供给面→治理门→执行→数据主链 + 四类威胁注入点与拦截位；三边界分区 |
| [context-layer-blueprint--architecture](./cognitive-context/context-layer-blueprint--architecture.mmd) | cognitive-context/013-context-layer-blueprint.md §3 总体架构 | architecture | ✓ | done | 五正交层总体架构；重绘砍 2 条低值边（裁决/反馈环路由姊妹图与卡片承载） |
| [context-layer-blueprint--object-lifecycle](./cognitive-context/context-layer-blueprint--object-lifecycle.mmd) | cognitive-context/013-context-layer-blueprint.md §4.2 通用对象模型 | lifecycle | ✓ | done | 对象生命周期状态机；3 泳道并为 2（冲突与终态合流）保垂直容纳 |
| [context-layer-blueprint--layer-mechanism-map](./cognitive-context/context-layer-blueprint--layer-mechanism-map.mmd) | cognitive-context/013-context-layer-blueprint.md §3.1 spine 总映射 | architecture | ✓ | done | 五层×M1–M7×negentropy 实例脊柱（2026-09-20 全量重设计新增）：五列横向生命周期，上排机制锚/下排实例状态，M4 双落点与 M5 归位以节点标签承载 |
| [context-layer-blueprint--dual-track-roadmap](./cognitive-context/context-layer-blueprint--dual-track-roadmap.mmd) | cognitive-context/013-context-layer-blueprint.md §16 双轨演进路线 | architecture | ✓ | done | 样板间 P0–P3 × 本楼改造 Phase 1–3 双泳道（2026-09-20 全量重设计新增）：共享设计层居顶辐射，三虚线对齐边承载能力锚点 |
| [context-layer--auto-channel](./cognitive-context/context-layer--auto-channel.mmd) | cognitive-context/013-context-layer-blueprint.md §8.5（原 design/context-layer.md §5，已并入；2026-09-22 自 design/ 归位） | workflow | ✓ | done | fix: 1) 事实修正（以代码为准）：原图把 _collect_kg_context() |
| [context-layer--assembler-planner](./cognitive-context/context-layer--assembler-planner.mmd) | cognitive-context/013-context-layer-blueprint.md §8.5（原 design/context-layer.md §6，已并入；2026-09-22 自 design/ 归位） | workflow | ✓ | done | fix: 源 mermaid 块#4 本身与代码事实自洽（「既有」节点全部核对通过、「新增 |
| [context-layer--request-injection](./cognitive-context/context-layer--request-injection.mmd) | cognitive-context/013-context-layer-blueprint.md §12.1（原 design/context-layer.md §2，已并入；2026-09-22 自 design/ 归位） | workflow | ✓ | done | fix: 4 处以代码为准的修正（.mmd 携 %% fix 行、facts 笔记逐条锚点 |
| [context-layer--runtime-layering](./cognitive-context/context-layer--runtime-layering.mmd) | cognitive-context/013-context-layer-blueprint.md §12.2（原 design/context-layer.md §3，已并入；2026-09-22 自 design/ 归位） | architecture | ✓ | done | fix: ① 补全 Tools/Skills→PostgreSQL 两条边（builtin |
| [context-layer--evolution-levers](./cognitive-context/context-layer--evolution-levers.mmd) | cognitive-context/013-context-layer-blueprint.md §12.5（原 design/context-layer.md §7，已并入；2026-09-22 自 design/ 归位） | architecture | ✓ | done | fix: (1) 状态机补终态 rejected（代码 STATUS_REJECTED 存 |
| [context-layer--collect-phase](./cognitive-context/context-layer--collect-phase.mmd) | cognitive-context/013-context-layer-blueprint.md §3.4（原 design/context-layer.md §1.1，已并入；2026-09-22 起作为 §3.4 三相流水线总览图直接承载，自 design/ 归位） | dataflow | ✓ | done | fix: 原块把 Collect 三机制与 Enrich 三能力画成串行链；按产品页事实改为三源并列汇入、富化能力并列产出 |
| [openviking--ingest-phase](./cognitive-context/openviking--ingest-phase.mmd) | cognitive-context/014-openviking.md §4 图 1 | dataflow | ✓ | done | 编目相五段流水线：请求 → 解析落盘（0×LLM）→ 语义队列 → 摘要与派生（L1 1×LLM、L0 首段裁出 0×LLM）→ 索引与冒泡（L0 未变 NOOP / ≤32 立刷 / 宽目录攒 10%）；结论卡载成本公式、三道异步边界与新鲜度漏斗；2026-09-24 随 014 精读笔记新增 |
| [openviking--retrieval-phase](./cognitive-context/openviking--retrieval-phase.mmd) | cognitive-context/014-openviking.md §5 图 2 | workflow | ✓ | done | 检索相三泳道：默认档（QUICK 平铺，find 固定）vs 豪华档（配 rerank 才走：全局起点 top-10 → 每批 4 目录下钻 + 逐目录 rerank → 阈值剪枝 α=1.0 → 收敛刹车）→ 借阅推车（先广后深、降档不截断）；结论卡载「默认档才是常态/豪华档三件套/推车纪律」；2026-09-24 随 014 精读笔记新增 |
| [openviking--uri-scope-tree](./cognitive-context/openviking--uri-scope-tree.mmd) | cognitive-context/014-openviking.md §3（视频 P1） | architecture | ✓ | done | 一棵树三分区（resources/user/agent）+ 类型由 URI 结构推导（resources/memories 仍是 resource 反例）；结论卡「位置即语义/边界」；2026-09-24 视频第 3 集新增 |
| [openviking--tiering-l0-l1-l2](./cognitive-context/openviking--tiering-l0-l1-l2.mmd) | cognitive-context/014-openviking.md §4（视频 P2） | architecture | ✓ | done | 分层生成链：文件简介 → 采样闸 → 导览（1×LLM/目录）→ 首段裁剪（0×LLM）→ 标签 → 向量化；软上限 256/4000 字符语义；2026-09-24 视频第 3 集新增 |
| [openviking--freshness-bubbling](./cognitive-context/openviking--freshness-bubbling.mmd) | cognitive-context/014-openviking.md §4.3（视频 P2） | dataflow | ✓ | done | 新鲜度漏斗：digest 未变 NOOP / 变了上报 / 父级 ≤32 立即重印 / 宽分区攒 10%；代价=兄弟陪写与陈旧窗口；2026-09-24 视频第 3 集新增 |
| [openviking--intent-typed-queries](./cognitive-context/openviking--intent-typed-queries.mmd) | cognitive-context/014-openviking.md §5.2（视频 P3） | workflow | ✓ | done | 意图拆单三路（资料/记忆/技能）+ 两坑：各路独立递归成本 ×N、结果直接拼接不归一；2026-09-24 视频第 3 集新增 |
| [openviking--session-commit-two-phase](./cognitive-context/openviking--session-commit-two-phase.mmd) | cognitive-context/014-openviking.md §6.1（视频 P4） | lifecycle | ✓ | done | 两阶段提交状态机：Phase 1 同步装订 → Phase 2 异步整理 → .done 提交点 / .failed 终态；队列重投的幂等跳过；2026-09-24 视频第 3 集新增 |
| [openviking--memory-identity](./cognitive-context/openviking--memory-identity.mmd) | cognitive-context/014-openviking.md §6.3（视频 P4） | workflow | ✓ | done | 相似 ≠ 同一：预取提名 → 身份字段裁决 → 确定性卡名 → 落卡；残余风险=主题漂移双卡并存；2026-09-24 视频第 3 集新增 |
| [openviking--lab-break-matrix](./cognitive-context/openviking--lab-break-matrix.mmd) | cognitive-context/014-openviking.md §10（视频 P6） | architecture | ✓ | done | 六次破坏实验退化矩阵（B1 拔标签/B2 刹车/B3 身份/B4 冒泡/B5 父分/B6 提交点）+ 三条教训结论卡；2026-09-24 视频第 3 集新增 |

### 原地保留（无 archify 对应类型 / 不在本管线）

| 位置 | 类型 | 说明 |
| :--- | :--- | :--- |
| 025-the-memory-system.md（ER / timeline） | erDiagram / timeline | 无对应类型 |
| 035-the-knowledge-base.md（ER） | erDiagram | 无对应类型 |
| 036-the-knowledge-graph.md（timeline） | timeline | 无对应类型 |
| 039-the-routine-system.md（ER） | erDiagram | 无对应类型 |
| conversation-foundation.md（象限图） | quadrantChart | 无对应类型 |
| docs/research/**（247 块，cognitive-context/ 的 archify 图除外） | 各类 | 第三方系统调研，不进本管线 |
| docs/reference/cognizes/**（96 块） | 各类 | 已退役项目遗产，不进本管线 |
| apps/negentropy-influence/episodes/**/planning.md（8 块） | flowchart | 分集内容分镜，非架构图 |
| apps/negentropy-wiki/content.fixture/**（1 块） | flowchart | 测试 fixture |
