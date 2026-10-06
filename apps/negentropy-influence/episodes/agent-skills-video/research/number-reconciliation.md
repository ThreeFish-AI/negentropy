# 数字对账：gl-notes × 原始信源 × lab2 复算（Stage ① C 型穿透抽查）

> 复算取数：2026-10-06。事实源 [gl-notes.md](./gl-notes.md)（冻结，未改动）。
> - **lab2 复算日志**（uv run --no-project，exit 全 0）：[lab2-selftest.log](./lab2-selftest.log)、[lab2-selftest.json](./lab2-selftest.json)、lab2-break-X1/X2/X3/X4/X5.log（各 6 件）
> - **信源台账**：[sources.toml](./sources.toml) 14 条，verify FAIL 0（WARN 2 条见下「活信源漂移附记」）；既有 10 条指纹零改动
> - **原始信源字节副本**（供 grep 复核，临时件）：`.temp/agent-skills-lab2/fetched/`；repo 类行号锚为钉点 `69ef37e9` 下的永久坐标，经 raw.githubusercontent.com 可随时重取
>
> 判定口径：**命中**＝实测/信源字节与 gl-notes 数字一致；**偏差**＝数字冲突；**转述**＝GL 侧自行测算或示意，本集未复算，按【二级】纪律计；**时点值**＝活数据，GL 取数时点成立、现值已变。

## 对账表

| 值 | gl-notes 锚(§) | 原始信源锚(文件:行 或 日志) | 口径 | 判定 |
| :--- | :--- | :--- | :--- | :--- |
| `name` 1–64 字符 | §3 字段表 | specification.mdx@69ef37e9:L61（「Must be 1-64 characters」）；validator.py@同钉:L10 | 规范 MUST | 命中 |
| `description` ≤1024 字符 | §3 字段表 | specification.mdx@钉:L28；validator.py@钉:L11 | 规范 MUST | 命中 |
| `compatibility` ≤500 字符 | §3 字段表 | specification.mdx@钉:L30；validator.py@钉:L12 | 规范可选上限 | 命中 |
| 六字段封闭集（name/description/license/compatibility/metadata/allowed-tools） | §3、§8 | specification.mdx@钉:L27–32 字段表；validator.py@钉:L15 `ALLOWED_FIELDS`；CC 新页打包报错原文「Allowed properties are: allowed-tools, compatibility, description, license, metadata, name」（cc-skills-fresh.html 字节 ~616074 起 when_to_use 表区） | 规范封闭集 | 命中 |
| 目录常驻 ~50–100 Token/项 | §4 ASCII 图、§10 表 | adding-skills-support.mdx@钉:L24（tier-1 表行「~50-100 tokens per skill」）、L184（「roughly 50-100 tokens」） | 官方 client 指南推荐指标 | 命中 |
| 正文 <5000 Token / <500 行 | §4 ASCII 图、§10 表 | adding-skills-support.mdx@钉:L25（tier-2「<5000 tokens (recommended)」）；best-practices.mdx@钉:L88（「under 500 lines and 5,000 tokens」） | 官方编写指南推荐上限 | 命中 |
| OpenAI 元数据目录 ≤2% 或 8000 字符，超限自动裁剪描述 | §4、§10 表 | codex 新页（learn.chatgpt.com/docs/build-skills，旧 URL 308 跳转）字节 :828「at most 2% of the model's context window, or 8,000 characters when the context window is unknown」+「shortens skill descriptions first」 | 厂商生产环境规则（活页复核） | 命中（页面已迁移，断言在新页仍成立，见附记①） |
| 20 技能全载 39,222 vs 目录 2,321 Token（16.9×） | §4「原型实景测算」、§10 表、§12-1 | **lab2 无此模式**（`--selftest`/`--break`/`--audit-repo` 三模式输出均无 39,222/2,321）；算术自洽：39222/2321=16.90 | GL 侧工程实测、本集未复算 | 转述【二级】 |
| X1 同名不同版漂移 2 项 ={'release-notes','same-scope-dupe'} | §3 实景日志 | [lab2-break-X1.log](./lab2-break-X1.log)（detail 与 gl-notes L98–99 逐字一致） | 本集破坏性实验复算 | 命中 |
| X1 §10 表「2/10 技能漂移」 | §10 表 | lab2-selftest.json：effective 10 项、drift 2 项 | 有效目录分母 10 | 命中 |
| X2 严格拒载 4/12（extra-field/name-mismatch/long-name/empty-desc）、宽容 12 全载、互操作损失 33% | §6 实景日志、§10 表 | [lab2-break-X2.log](./lab2-break-X2.log)（4 只拒载名单逐字一致，4/12=33.3%） | 本集复算 | 命中 |
| X3 `bool('false') == True` | §8 实景日志、§10 表 | [lab2-break-X3.log](./lab2-break-X3.log)（逐字一致） | 本集复算 | 命中 |
| X4 description 伪字段泄漏 allowed-tools/Bash(rm:*) = True | §7 实景日志、§10 表 | [lab2-break-X4.log](./lab2-break-X4.log)（注入进入 frontmatter=True、泄漏=True） | 本集复算 | 命中 |
| X5 有效目录 10 项、1 处遮蔽静默 | §6 实景日志、§10 表 | [lab2-break-X5.log](./lab2-break-X5.log)（10 项/1 处） | 本集复算 | 命中 |
| 46 家客户端（官方 Showcase 代码级清点） | §2 表、§8、§10 表 | clients.jsx@69ef37e9:L8 `export const clients`，L10–L409 恰 **46** 个 `name:` 条目（Claude Code / ChatGPT & Codex / Gemini CLI / VS Code / GitHub Copilot / Cursor 等全在）；main 分支现值仍 46 | 钉点仓 showcase 数据文件 | 命中 |
| 48 条 open PR | frontmatter 描述、§2 表、§8 | GitHub 活数据：GL 取数 2026-09-26；本集 2026-10-06 实测 **52**（`search/issues is:pr is:open total_count` 与 `pulls?state=open --paginate` 求和双法互证） | 活数据时点计数 | 时点值（GL 48 + 当前 52） |
| Claude Code 10+ 私有扩展字段（context: fork / agent / paths / hooks 等） | §8、§9 规律 3 争议引 | cc-skills-fresh.html（2026-10-06 抓取，text e0b22f7d7496f6cc）「Frontmatter reference」全表：CC-only 字段 **14 个**（when_to_use/argument-hint/arguments/disable-model-invocation/user-invocable/disallowed-tools/model/effort/context/agent/background/hooks/paths/shell）>10；四例锚字节 offset：agent@289299、hooks@289938、paths@290334、context:fork@262664 | 厂商自述（活页复核） | 命中（14>10，见附记②） |
| 20 组提问 + 多轮命中率 + 训练/验证 6:4 交叉评估 | §5 法则 3 | optimizing-descriptions.mdx@钉:L39（「about 20 queries: 8-10 that should trigger and 8-10 that shouldn't」）、L87–91（每条 3 跑共 60 次、trigger rate）、L133–140（「Avoiding overfitting with train/validation splits」「Train set (~60%)」「Validation set (~40%)」） | 官方指南 | 命中 |
| §1 示意算式：20 技能×3000 token ≈ 6 万 Token | §1 困境 2（「若」字假设句） | 自洽算术 20×3000=60,000；gl-notes 明示「若…则」，非实测 | 假设性示意算式（非实测） | 转述 |
| lab2 玩具环境 10 技能「目录数百 Token、全载 4 倍以上」 | §4「原型实景测算」前句 | lab2-selftest.json：catalog_tokens_approx=228（数百）、bodies_tokens_approx=2261（9.9×≥4×，脚本 assert 自证） | 本集复算（chars/4 近似口径，脚本显式声明） | 命中 |
| 配套原型纯标准库 354 行 | frontmatter 冻结登记 | `wc -l agent_skills_lab2.py` = 354 | 登记元数字 | 命中 |
| 规范仓钉点 2026-08-09 冻结 | frontmatter、§ 引言 | `gh api commits/69ef37e9` → committer.date=2026-08-09T20:36:04Z | 钉点元数据 | 命中 |
| 官方指南 6 篇（quickstart/best-practices/optimizing-descriptions/evaluating-skills/using-scripts/adding-skills-support） | frontmatter、§ 引言、§10 | [sources.toml](./sources.toml) 现含 6 篇全量钉点条目（guide-client/guide-best-practices/guide-descriptions/evaluating-skills-mdx/using-scripts-mdx/quickstart-mdx） | 台账完备性 | 命中 |
| （附）仅 Gemini CLI 默认提供激活确认 UI | §7 实测四客户端 | gemini-skills.md@778da08:L25（「Consent: You will see a confirmation prompt in the UI detailing the…」）、L108/L123（`--consent` 跳过旗标） | 定性断言的行级锚（非数字项，供 Stage ② 引用） | 命中 |

## 判定计数

命中 21 · 转述 2（39,222/2,321 与 §1 示意算式，均已在 gl-notes 文内自带「自建测算/若」口径声明）· 时点值 1（48 PR→现 52）· 偏差 0。共 24 行。

## 活信源漂移附记（Stage ② 引用时点须知）

1. **codex-skills-doc（既有条目，verify WARN 非 FAIL）**：`developers.openai.com/codex/skills/` 现 308 双跳转至 `learn.chatgpt.com/docs/build-skills`。新页「2% 或 8,000 characters」断言仍在（字节 :828）。既有 10 条指纹按纪律未改写。
2. **cc-skills-doc（既有条目，verify WARN 非 FAIL）**：正文自 2026-09-30 后已变；「10+ 私有扩展字段」断言在 2026-10-06 新页复核仍成立（实测 14 个）。
3. **vscode-skills-doc（新录条目）**：gl-notes 引用的 `/docs/copilot/customization/agent-skills` 已 301 改版至 `/docs/agent-customization/agent-skills`（SSG 预渲染实测成立）；台账按新规范 URL 登记并在 `via` 注明跳转链，gl-notes L13/L321 的旧 URL 属时点引用，Stage ② 改稿时留意。
