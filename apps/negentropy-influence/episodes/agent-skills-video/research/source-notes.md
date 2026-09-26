# 信源取证笔记（Stage ① · B 型：文档/代码/站点）

> 台账：`research/sources.toml`（24 条 · verify FAIL 0 WARN 0，取数 2026-09-26/27）。上游规范仓钉点
> `69ef37e9`（2026-08-09 后零提交，与 210 重学同一钉点）；本仓研究三件钉 `72a657351`（210/211/lab2）。
> 证据四级：【一】钉点代码/原型实测 · 【二】官方文档 · 【三】厂商自报 · 【四】第三方（生态抽样报告）。

## 一、断言 → 证据映射（口播可引用的硬事实）

| # | 断言 | 证据级 | 出处（台账名） |
| --- | --- | --- | --- |
| A1 | 技能 = 目录 + SKILL.md（六字段，仅 name/description 必填） | 【二】 | spec-mdx `S:6-32` |
| A2 | name 必须 1–64 字符、小写字母数字连字符、等于目录名 | 【二】 | spec-mdx `S:58-65` |
| A3 | description ≤1024 字符、写「做什么+何时用」 | 【二】 | spec-mdx `S:91-96` |
| A4 | 三级渐进披露：元数据 ~100 token 常驻 / 正文 <5000 token 建议 / 资源按需 | 【二】 | spec-mdx `S:216-224`；guide-client 同口径 50–100/`G:22-28` |
| A5 | 20 技能不该预付 20 套完整指令的代价（成本随装机 vs 随使用） | 【二】 | guide-client `G:30` |
| A6 | 正文无格式限制（no format restrictions）；引用一层深 | 【二】 | spec-mdx `S:176-237` |
| A7 | allowed-tools 空格分隔、实验性、各实现可不支持 | 【二】 | spec-mdx `S:163-174` |
| A8 | 治理宪法「Keep the format small…demonstrated interoperability needs, not hypothetical completeness」 | 【二】 | repo-agents-md |
| A9 | project 覆盖 user 是 universal convention；同作用域撞名 first/last-found 任选须稳定 + log a warning（shadowed） | 【二】 | guide-client `G:83-88` |
| A10 | 宽容校验：name 不匹配/超长 warn & load；description 缺失才跳过（deliberately relaxes） | 【二】 | guide-client `G:128-141` |
| A11 | 信任仅 Consider：项目级技能来自不可信仓库，建议 trust gate | 【二】 | guide-client `G:89-91` |
| A12 | 压缩保护（exempt from pruning）+ 激活去重 + 子代理委托 | 【二】 | guide-client `G:314-333` |
| A13 | 触发工艺：20 query × 3 run trigger rate、0.5 阈值、train/validation 6:4、按验证集选优（最优未必最后） | 【二】 | guide-desc `D:39-160` |
| A14 | 近失配（near-miss）负例比无关负例有效 | 【二】 | guide-desc `D:52-64` |
| A15 | agents 只为超出自身能力的任务查技能（"read this PDF" 可能不触发） | 【二】 | guide-desc `D:17` |
| A16 | eval 双跑（with/without skill）+ assertions + benchmark delta + 盲评对照 | 【二】 | guide-eval |
| A17 | 客户端 Showcase 46 家（源码级清点 home.mdx clients 数组；含 ChatGPT&Codex 合并项） | 【一】 | home-mdx（数组逐项清点）；clients-mdx 同源 |
| A18 | 收录门槛：产品当下可发现并执行技能（不接受宣布意向），logo 由 Anthropic 团队审 | 【二】 | CONTRIBUTING（仓内，钉点同 spec） |
| A19 | 格式由 Anthropic 发起、后开放为社区标准 | 【二】 | home-mdx Open development 节 |
| A20 | Claude Code：描述常驻/调用才载全文；allowed-tools 不受 workspace trust 门控 | 【三】 | site-claude-code |
| A21 | OpenAI ChatGPT 侧技能元数据 ≤ 上下文 2% 或 8000 字符，超限截短 description | 【三】 | site-openai-codex（plugins/skills 页口径） |
| A22 | Gemini CLI：唯一默认逐技能激活确认门（展示技能名/用途/授权目录） | 【三】 | site-gemini-cli |
| A23 | VS Code：.github/.claude/.agents 三约定路径通吃 | 【三】 | site-vscode |
| A24 | 四家均无签名/来源校验 | 【四】 | 生态抽样对照（210 §7；四家文档逐页核对） |
| A25 | skills-ref 与规范 13 处口径分歧（字符集/未知字段/切分/小写回退等） | 【一】 | ref-validator/ref-parser/ref-prompt 源码逐行 + 090 §9 历史复现 6 处 |
| A26 | #254 .well-known 分发提案（digest/防解压炸弹）2026-03 开、停摆 7 个月 | 【三】 | pr-254-distribution |
| A27 | #573（放宽 allowed-tools 数组）与 #520（锁死空格串）对冲并存 | 【三】 | pr-573-520-tools |
| A28 | #546 为 MCP SEP-2640 保留 io.modelcontextprotocol/ 前缀 | 【三】 | pr-546-mcp |

## 二、原型实测（X1–X5，全部可重跑）

来源 as-lab2（`--selftest` / `--break X1..X5`，日志全文见 210 §3/§6/§7/§8）：

| 实验 | 退化结果 | 视频可用表述 |
| --- | --- | --- |
| X1 拆作用域优先级 | 2/10 技能跨客户端同名不同版（release-notes: project↔user；same-scope-dupe: project↔project2） | 身份由扫描顺序决定，行为跨端不可复现 |
| X2 严格 vs 宽容 | 严格口径拒载 4/12，宽容全载 12（互操作面损失 33%） | 严格门拒的是「为别人客户端写的技能」 |
| X3 metadata str() 强转 | `enabled: false` → `'false'` → `bool('false')==True` | 被禁用的技能被判为启用 |
| X4 换行伪字段注入 | `allowed-tools: Bash(rm:*)` 经 description 缩进行混入元数据（M5 首次实测） | 恶意预授权经由货签通道成立 |
| X5 去遮蔽告警 | 遮蔽仍发生但 0 可见 | 事故形态=知情权丢失而非数据丢失 |
| 090 引用 | 全载 39,222 vs 台账 2,321 token（16.9×）；B1 拆除（含破坏样本）16.3× | 台账与全载的成本比 |

## 三、数字纪律（ISSUE-164：他方数字一律自复算）

- **46 家**：本集从 home.mdx 源码 clients 数组逐项清点（含 "ChatGPT & Codex" 合并计 1、Junie…OpenClaw）；口播用「四十六家」前先自查此口径，**不引用** showcase 页面上的宣传语数字。
- **~100 token / <5000 token / 1024 字符 / 500 字符 / 64 字符**：全部为规范/指南原文常量（A3/A4/A7），非实测。
- **OpenAI 2%/8000 字符**（A21）：厂商自报【三】——口播必须带归属句「按 OpenAI 自己的文档口径」。
- **16.9×/16.3×/33%/truthiness 翻转**：自建玩具实测【一】，口播须带「我们自建玩具实测」限定。
- **「停摆 7 个月」**（A26）：2026-03-16 开 PR 至 2026-09-26 取数日的墙钟差，可复算。

## 四、三级证据归属句纪律

凡【三】级（厂商自报）进画面/口播必带归属（「按 Gemini 自己的文档」）；凡【四】级（生态抽样）表述为「四家官方文档逐页核对后的对照结论」；A24 类否定性结论（均无签名）注明「以四家公开文档为准，未见」。
