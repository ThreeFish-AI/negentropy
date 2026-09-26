---
sidebar_position: 9
title: "Agent Skills ↔ negentropy 机制映射（重学版）"
description: "以 210 重学精读为输入的本仓机制映射 12 条：三级披露三层载体 ✅、目录空集省略且优于官方 demo ✅、宽容 fail-soft ✅、离线 eval-suite holdout 门同构于描述工艺 evals ✅、R6-b 在线门已重设计离线优先（091-M4 二阶影响缓解）✅；真增量两条：expand_skill 仍未挂载 TOOL_REGISTRY（ISSUE-194 复核成立、严重度降级）🔶 与目录注入面无转义（X4 实测攻击面 + skills_ref.prompt html.escape 对照）🔶；遮蔽告警/压缩保护/禁自触发按触发条件暂缓"
---

# Agent Skills ↔ negentropy 机制映射（重学版）

> 声明：只分析不改码；锚点均经实际代码核验（2026-09-26，工作区 `dar-es-salaam-v2` @ `95f5a532`）。上游材料见 [210 精读笔记](./210-agent-skills-open-standard.md)。

## 结论先行

本仓已**结构性实现** Agent Skills 的核心机制面：三级渐进披露（Layer 1/2/3）、目录空集省略、宽容加载 fail-soft、离线 eval 驱动的技能进化——四处 ✅ 且两处**优于官方参考实现**（目录空集行为、离线门设计）。本轮真增量只有两条：**① `expand_skill` 仍未挂载 TOOL_REGISTRY（ISSUE-194 复核成立），但 R6-b 已重设计为离线门优先，悬空的严重度从「晋升门恒跳过」降级为「目录承诺的能力不可用」；② 目录构建无转义/行锚定（210 X4 已实测 description 通道可注入伪字段），官方 demo 的 `html.escape` 是现成参照**。12 条映射：✅5 / 🔶4 / ⏸3。

## 映射总表

| # | 材料机制（出处） | 本仓对应 | 锚点（grep 实测） | 判定 |
| --- | --- | --- | --- | --- |
| M1 | 三级渐进披露（spec §Progressive disclosure） | Layer 1 目录常驻 / Layer 2 模板按需 / Layer 3 资源懒载 | `agents/skills_injector.py:342`（format_skills_block）/ `agents/tools/skill_registry.py:120`（expand_skill）/ `agents/tools/__init__.py:14`（skill_resources） | ✅ |
| M2 | 无技能时省略目录块（client guide Step 3：omit, don't show empty） | 空列表 → 空字符串 | `agents/skills_injector.py:347-348` | ✅（优于 skills-ref：`skills_ref/prompt.py:32` 空集仍输出空 `<available_skills>` 块，与自家指南相悖） |
| M3 | 模型自主激活依赖工具真实挂载（client guide Step 4） | 目录末行教模型调用 `expand_skill`，但该工具从未进 TOOL_REGISTRY（ISSUE-194，2026-09-23 登记，至今未修） | `agents/skills_injector.py:357` / `agents/tools/__init__.py:28`（已导出）/ `agents/tools/registry.py:66,91`（仅 log_activity + preload_memory_tool）、`:105` | 🔶 做 |
| M4 | R6-b 在线门依赖真实调用样本（091-M4 二阶影响） | **已重设计**：离线 eval-suite holdout 门优先；在线门仅在 `expand_skill` 有数据时叠加，无数据 → None 交离线门 | `engine/evolution/handlers/skill.py:11`（「离线 held-out 优于噪声在线 canary」）、`:353`、`:428-433`（候选桶无数据 → 跳过在线门） | ✅（重设计落地；在线门成待激活死代码，M3 修复后自动复活） |
| M5 | 目录是注入面：需转义/行锚定（210 X4 实测 + client guide） | `format_skills_block` 直插 name/description，无 escape、无换行防御（对照 skills-ref `prompt.py` html.escape） | `agents/skills_injector.py:353-355` | 🔶 做 |
| M6 | 宽容加载 fail-soft（client guide：warn & load，deliberately relaxes） | `enforcement_mode="warning"` 默认；任何异常记录警告并跳过该条，不冒泡 | `agents/skills_injector.py:93`、`:117-118` | ✅ |
| M7 | 多作用域遮蔽 + shadowed 告警（client guide Step 1） | DB-first 单源解析（skills 表/definitions 表），无盘上多作用域扫描——遮蔽场景结构性不存在 | `db/migrations/versions/0098_seed_harness_skill_definitions.py:888`（DB 即唯一作用域） | ⏸（触发条件：引入盘上技能源或多租户技能库时须实现 project>user + 告警） |
| M8 | allowed-tools 空格分隔（spec，实验性） | 物化链提取 allowed-tools 入盘 frontmatter；但 CC CLI 调用层 `--allowed-tools` 是**逗号** join——同一概念两种语法分层并存 | `agents/definitions/harness_materializer.py:53` / `engine/claude_code/service.py:1025` / `db/migrations/versions/0026_skill_enforcement_and_resources.py:12`（enforcement 对应 Anthropic Skills allowed-tools） | 🔶 写 |
| M9 | 技能内容豁免上下文压缩（client guide Step 5） | 本仓交互式对话零压缩（Hermes 精读已证），无压缩器即无豁免需求 | `docs/research/agent-harness/190/191`（对话零压缩结论） | ⏸（触发条件：引入上下文压缩/摘要层时必须同步实现豁免标记，否则技能静默降级） |
| M10 | disable-model-invocation / 用户显式点名（生态扩展字段） | 无此开关；Layer 1 目录恒注入 | `agents/skills_injector.py:342`（无开关参数） | ⏸（YAGNI：单 owner 场景无确定性触发诉求） |
| M11 | 描述/技能质量用 eval 驱动迭代（optimizing-descriptions / evaluating-skills） | 技能进化：离线 EvalSuite holdout 零回归门 + visible_results_query 结构性排除 holdout（防 Goodhart）+ 无绑定 EvalSuite → reject | `engine/evolution/handlers/skill.py:7-15`、`:351` | ✅（形态不同、机理同构：离线验证优于在线噪声，与指南「trigger rate 协议」同一纪律） |
| M12 | metadata 是私货唯一正门（spec §metadata） | definitions 表 schema 专列承载（content/typing 等），私货不走 SKILL.md metadata 字段 | `db/migrations/versions/0098_seed_harness_skill_definitions.py:888`（仅提取三键）/ `agents/definitions/harness_materializer.py:53` | ✅（DB schema 即正门，强于规范层的弱约定） |

## 逐条说明（仅 🔶 与复核要点）

**M3 expand_skill 悬空（复核成立，严重度降级）**。材料怎么做：模型自主激活的两条实现路径（file-read / dedicated tool），前提是目录承诺的调用路径真实存在。本仓现状：`skills_injector.py:357` 在每个注入目录末行写死「To use a skill, call expand_skill(name)」，`tools/__init__.py:28` 已导出该工具，但 `registry.py` 的注册表（`:66`/`:91` 附近仅 log_activity、preload_memory_tool）从未收录——模型被教唆调用一个自己没有的工具。差异：与 091 相比**二阶影响已消失**——R6-b 改离线门后（M4），悬空不再阻塞技能晋升，只剩「目录承诺的能力不可用 + 文档漂移」一层。建议：做——挂载 `expand_skill`/`list_available_skills` 进 TOOL_REGISTRY（六翼工具集白名单 `_dynamic_tools.py` 同步），绑时机：任何一次 Agent 工具面变更的 PR；或在 091 登记的「模型驱动激活」路线重启时一并做。

**M5 目录注入面（新实测，建议做）**。材料怎么做：客户端指南把「目录构建转义」列为客户端责任，官方 demo `skills-ref/src/skills_ref/prompt.py` 对 name/description 做 `html.escape`；210 §7 的 X4 实验证明 description 通道可把 `allowed-tools: Bash(rm:*)` 伪字段混进元数据。本仓现状：`format_skills_block` 把 name/description 原样拼进 `- {name}: {desc}` 行——无转义、无换行拦截；一条带换行的 description 可在目录里伪造第二行指令。差异：仓内技能目前全部来自 DB 种子（受控），攻击面是「未来开放用户/项目级技能源」时才兑现。建议：做——在 format_skills_block 加行级清洗（换行折叠为空格 + 控制字符过滤），成本一行，防 X4 型注入；绑时机：与 M3 同一 PR（都在 skills 触发层）。

**M8 allowed-tools 双语法（写）**。规范面（SKILL.md frontmatter）要求空格分隔；仓内 CC CLI 调用层（`service.py:1025`）按 Claude Code CLI 自身约定逗号 join——两层各自正确，但**盘上物化的 frontmatter 必须按规范空格写**（harness_materializer 只透传不校验）。旧审计发现 DB 技能 frontmatter 存在逗号分隔写法（10/11），本轮盘上 `.agent/skills` 复核全 OK（210 lab `--audit-repo` 实测）——DB 存量无法离库复核，按旧结论标注。建议：写——在 091 已登记的 M2/M3（name/description/allowed-tools 校验）里加一条「allowed-tools 空格分隔」断言，一句话成本；触发即写。

## 落地建议汇总

- **做**（绑时机）：M3+M5 同一 PR——expand_skill 挂载 TOOL_REGISTRY + format_skills_block 行级清洗（`_dynamic_tools.py` 白名单同步）。
- **写**（一句话成本）：M8 在 definitions 校验断言中补「allowed-tools 空格分隔」；091 文档漂移清单若仍列「模型驱动激活已实现」表述，随 M3 修复一并订正。
- **暂缓**（写明触发条件）：M7——引入盘上/多租户技能源时实现 project>user + shadowed 告警；M9——引入上下文压缩层时实现技能内容豁免；M10——出现确定性触发诉求时加 disable-model-invocation 开关。

## 与 091 的对账（13 → 12 条的差异）

091 的 M4（expand_skill 悬空）= 本轮 M3，**二阶影响（R6-b 恒跳过）已被 M4 离线门重设计消解**；091 的 M5（目录注入防护未实测）→ 本轮 X4 已实测攻击面并收敛为可做项；091 的 M2/M3（name/description 无校验）并入 M8 的写档建议；091 的 M13（禁用技能盘上残留）随 M7 的触发条件一并暂缓；其余 ✅ 项结论一致。

## 交叉引用

- 精读笔记：[210-agent-skills-open-standard.md](./210-agent-skills-open-standard.md)（X1–X5 实测日志在 §3/§6/§7/§8）
- 上一轮：[090](./090-agent-skills-spec.md) / [091](./091-agent-skills-mapping-negentropy.md)（历史记录，不随本轮修订）
- Issue 台账：[ISSUE-194](../../.agents/issue.md)（expand_skill 悬空）；实验室副本 [assets/agent_skills_lab2.py](./assets/agent_skills_lab2.py)
