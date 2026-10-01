# 信源笔记骨架 · agent-skills-video（C 型承接 + B 型双轨台账）

> Stage ① 产物。断言→证据映射表为**空骨架**，由后续阶段（GL 冻结、穿透抽查、逐字稿回溯）逐条填。
> 活信源指纹唯一登记处：[sources.toml](./sources.toml)（工具 `source_ledger.py`）。

## 台账与鲜度

- 规范仓钉点：`69ef37e9424c0a7ea9dd2293b559e43ec8176379`（2026-08-09 main HEAD，此后零推送；GL 2026-09-30 探针双确认）。
- 取数日期：全部条目 `accessed = 2026-09-30`（GL 取数日；本骨架建立日 2026-10-01 补登，字节与 GL 快照同源同钉）。
- verify 基线：受检 10 · FAIL 0 · WARN 0（2026-10-01 跑出，repo 轨全绿）。
- 指纹交叉验证：`spec-mdx`（raw b9079c0c10b7930e）与 `guide-client`（raw e1a788f858766f4b）同 skills-supply-chain-video 集同钉指纹一致。

## 三级证据声明（口播表述的硬约束）

| 级 | 含义 | 口播允许的表述 |
|---|---|---|
| 【一】 | 仓库文件实测（固定 commit 上可复算） | 可直接断言 |
| 【二】 | 站点正文（agentskills.io / code.claude.com / developers.openai.com） | 可断言，属「文档的讲法」；厂商自述页须另注归属 |
| 【三】 | 他人对闭源产品源码的分析 | 必须带归属句（「他拆过源码，他说…」），不得说成产品既成事实 |

三级断言在逐字稿**前 3 句内必须出现归属语**（可机械检查）；画面角标同步压「（某人的）源码分析」。

## 承接：GL 在用信源 → 本集台账

| GL 源 | 内容 | 承接落点 |
|---|---|---|
| S0·S2 | 规范与指南全集 @钉点 | `spec-mdx` / `quickstart-mdx` / `guide-client` / `guide-best-practices` / `guide-descriptions`（repo）+ `agentskills-spec-site`（site） |
| S1 | skills-ref 参考实现 | `skills-ref-validator` / `skills-ref-prompt`（repo；其余文件按需再 fetch，同钉） |
| S3 | Claude Code 官方 skills 文档 | `cc-skills-doc`（site，厂商自述另注） |
| S4 | OpenAI Codex 官方 skills 文档 | `codex-skills-doc`（site，厂商自述另注） |
| S5 | gh api 仓库元数据（stars/提交史探针） | 活数据不进口播，不登台账；鲜度结论留 GL sources.md 新鲜度探针节 |

未登记备用（同钉可直接补 fetch）：`docs/skill-creation/evaluating-skills.mdx`、`docs/skill-creation/using-scripts.mdx`、`AGENTS.md`、`README.md`、`docs/docs.json`、`docs/snippets/clients.jsx`、skills-ref 其余 src/tests。

## 断言→证据映射（后续阶段填）

| 断言 id | 断言（口播句/事实点） | 证据级 | 信源条目（sources.toml 名） | 锚点（文件/节/行） | 备注 |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 数字对账（口径必须可复算，后续阶段填）

| 数字 | 口径（wc -l / 非空非注释 / 站点标注） | 实测值 @钉点 | 信源条目 | 复算命令 |
|---|---|---|---|---|
|  |  |  |  |  |

## 分歧清单（两轨漂移逐条记，处置默认取更可核验的 repo 轨）

| 分歧点 | 两轨各自说法 | 处置 |
|---|---|---|
|  |  |  |

## GL 已知分歧（承接备查，穿透时复核）

- `parser.py` 大小写兼收 `skill.md`（小写）vs 规范「exactly SKILL.md」。
- `prompt.py` 空列表仍输出空 `<available_skills>` 块 vs 指南「无技能应整块省略」。
- `validator.py` 六字段白名单多余字段报错 vs 规范未禁扩展字段。
- `.agents/skills` 跨客户端约定：Codex 原生采用，Claude Code 官方文档只列 `.claude/skills` 系（不对称）。
