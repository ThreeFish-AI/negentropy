# Skills 模块（Agent Skills 在 Negentropy 的工程实现）

> 项目内的 Skills 模块是「可复用 Agent 技能配置 + Progressive Disclosure 注入」的最小工程化落地。本文档汇总：理论锚点、与主流框架的对照、当前实现边界、未来演进路线。其它操作指引参见 [`docs/user-guide/skills-basics.md`](./user-guide/skills-basics.md) / [`skills-advanced.md`](./user-guide/skills-advanced.md) / [`skills-templates.md`](./user-guide/skills-templates.md) / [`skills-paper-hunter.md`](./user-guide/skills-paper-hunter.md) / [`skills-troubleshooting.md`](./user-guide/skills-troubleshooting.md)。

---

## 1. 理论锚点（Why Skills，Why Progressive Disclosure）

LLM Agent 的可控性与可扩展性，从根本上是**上下文工程**问题。一个长期运行的 Agent 在面对多任务时，将所有可能用到的工具说明、领域知识、调用示例 _全部塞进 system prompt_ 必然导致：

1. **Token 预算挤占**：长 prompt 头会压缩用户消息与对话历史的有效窗口；
2. **指令稀释（Instruction Dilution）**：相关与无关说明并置，模型对当前任务的指令对齐度下降<sup>[[1]](#ref1)</sup>；
3. **维护熵增**：技能定义散落在代码、Prompt 字符串、外部文档之间，难以审计和复用。

**Progressive Disclosure**（渐进披露）原则——「描述层常驻、模板按需」——是行业近一年来的共识方案：

- 描述层（短，~1 行）告诉 LLM「我有什么能力」（layer 1）；
- 调用层（长，完整 prompt_template + 资源）只有在 LLM 决定调用某个 Skill 时才展开（layer 2）；
- 资源层（脚本 / 参考文档 / 数据样例）按需挂载到工作目录或上下文（layer 3）。

理论根基可追溯到 Chain-of-Thought<sup>[[2]](#ref2)</sup> 与 ReAct<sup>[[3]](#ref3)</sup>：当 LLM 被赋予「先思考再调用工具」的结构化决策能力时，**对工具集合的"了解"不必等于"完全展开"**——一句简短的能力描述足以让模型做出"用 / 不用 / 用哪个"的判断。

---

## 2. 主流框架对照

| 维度 | Anthropic Claude Skills<sup>[[4]](#ref4)</sup> | Google ADK Skills<sup>[[5]](#ref5)</sup> | OpenAI Codex Skills<sup>[[6]](#ref6)</sup> | Negentropy（本仓） |
|------|-----------------------------------------------|------------------------------------------|--------------------------------------------|--------------------|
| 核心载体 | `SKILL.md` + frontmatter | Python/TS 类 + 装饰器 | Markdown spec + tool 契约 | DB 表（`skills`）+ 14 字段（含 `enforcement_mode` / `resources`） |
| Frontmatter 元数据 | ✓（`name`/`description`/`license`/`version`） | ✓（class metadata） | ✓ | ~（DB 列即元数据） |
| 描述常驻（Layer 1） | ✓ | ✓ | ✓ | ✓（Phase 1） |
| 模板按需（Layer 2） | ✓ | ✓ | ~ | ✓（**Phase 2**：`expand_skill` ADK tool + `POST /skills/{id}/invoke` REST + Jinja2 沙箱） |
| 资源文件挂载（Layer 3） | ✓（`scripts/` `references/` `assets/`） | ✓ | ~ | ✓（**Phase 2**：JSONB `resources` 数组 + `fetch_skill_resource` 路由到 KG/Memory/Knowledge corpus，不直接 fetch URL 防 SSRF） |
| 工具白名单 | ✓（`allowed-tools`） | ✓ | ✓ | ✓（**Phase 2**：`enforcement_mode=warning\|strict`，strict 抛 `SkillToolMissingError` → SubAgent 降级启动） |
| 模板分发 / 一键安装 | ✗（手动复制 SKILL.md） | ✗ | ✓（manifest 包） | ✓（**Phase 2**：YAML 模板 + `GET /skills/templates` + `POST /skills/from-template`） |
| 版本管理 | ✓（SemVer） | ✓ | ✗ | ~（字段保留，模板层 SemVer 强校验，DB 层尚无历史表） |
| RBAC / 可见性 | ~（Cloud 层） | ✓ | ✗ | ✓（owner/private/shared/public） |
| 在线编辑 / UI | ✗（文件系统） | ✗ | ✗ | ✓（`/interface/skills`：From Template / Preview / Inline toggle / 资源行编辑 / strict badge） |

**关键洞察**：主流框架 _强 Schema_（文件系统 + frontmatter）但 _弱 RBAC_，Negentropy 反过来 _强 RBAC + 在线 UI_ 但 _弱文件系统_。两者并非互斥——Phase 2 路线即「保留 DB 主权 + 增量支持 SKILL.md 双向同步」（详见第 6 节）。

---

## 3. Negentropy 实现边界

```mermaid
flowchart LR
  subgraph UI[/interface/skills - UI]
    A1[SkillsPage] -->|CRUD| A2[SkillFormDialog]
    A2 -->|JSON 校验<br/>字段级锚定| A3[ConfirmDialog]
    A1 -->|Inline toggle| A4[PATCH is_enabled]
  end

  subgraph BFF[Next.js BFF]
    B1[/api/interface/skills*]
  end

  subgraph Backend[FastAPI / negentropy]
    C1[/interface/skills CRUDL]
    C2[Skill ORM + permissions]
    C3[skills_injector]
    C4[_load_subagent_row]
  end

  subgraph Runtime[ADK Agent Runtime]
    D1[InstructionProvider]
    D2[LLM Call]
  end

  UI -->|cookie ne_sso| BFF
  BFF -->|Authorization 透传| Backend
  C1 --> C2
  C4 -->|fetch SubAgent.skills| C3
  C3 -->|Progressive Disclosure| D1
  D1 -->|system_prompt + <available_skills>| D2
```

### 3.1 Phase 1 已落地

- **CRUDL**：完整增删改查 + 分类过滤（`apps/negentropy/src/negentropy/interface/api.py`）；
- **权限模型**：admin > owner > visibility（PRIVATE/SHARED/PUBLIC）+ `PluginPermission` 表；
- **UI**：在线编辑 + Inline 启停 + ConfirmDialog + JSON 字段级错误锚定 + sonner toast；
- **Layer 1 描述常驻**：`agents/skills_injector.py` 在 `_load_subagent_row` 注入 `<available_skills>` 块到 SubAgent 系统 prompt；
- **自签 dev cookie 工具**：`apps/negentropy-ui/scripts/sign-dev-cookie.mjs` + `tests/e2e/utils/dev-cookie.ts`；
- **mocked E2E 覆盖**：5 个 sibling spec / 17 case。

### 3.2 Phase 2 增强（本 PR）

- **Layer 2 按需展开（P0）**：
  - `agents/tools/skill_registry.py:expand_skill(name, vars)`：ADK 内置工具，LLM 决定使用某 Skill 时调用即得到 Jinja2 渲染后的完整 prompt_template；
  - `agents/tools/skill_registry.py:list_available_skills`：兜底自校验，避免注入器漏掉时 LLM 失明；
  - `POST /interface/skills/{id}/invoke`：UI Preview / 外部系统的等价 REST 入口，服务端只渲染不调 LLM；
  - 用 `jinja2.sandbox.SandboxedEnvironment` + `StrictUndefined` 防注入与变量遗漏；
  - Feature flag `NEGENTROPY_SKILLS_LAYER2_ENABLED`（默认 true）一键关闭。
- **Layer 3 资源挂载（P1）**：
  - ORM 新增 `resources: JSONB`（`[{type, ref, title, lazy}]`），type ∈ `{kg_node, memory, corpus, url, inline}`；
  - `format_skill_resources` 默认 `lazy=True`：Layer 1 仅显示 `[N resources attached]` 后缀，避免常驻 prompt 膨胀；
  - `agents/tools/skill_resources.py:fetch_skill_resource(name, index)`：按 type 路由到 KG / Memory / Knowledge corpus 的现成读取路径；`url` 仅传字符串**不**远程 fetch，**防 SSRF**；
- **工具白名单 fail-close（P1）**：
  - ORM 新增 `enforcement_mode: warning\|strict`（默认 warning，向后兼容）；
  - `skills_injector.build_progressive_disclosure_prompt(agent_tools=...)` 在 strict 模式遇缺失工具抛 `SkillToolMissingError`；
  - `model_resolver._load_subagent_row` 捕获该异常 → 降级为无 system prompt 启动 + error 级别日志（明确比"装作没事"更安全）；
  - SkillCard UI 新增 `strict` 红 badge + `N missing` 工具差异 badge。
- **Skill 模板库 + Paper Hunter（P2）**：
  - `agents/skill_templates/__init__.py:load_all`：扫 `*.yaml`，`packaging.version.Version` 强制 SemVer 校验；
  - `paper_hunter.yaml`：内置 AI Agent 论文采集 Skill（required_tools=`[fetch_papers, save_to_memory, update_knowledge_graph]` + 3 类 resources + strict 模式）；
  - `GET /interface/skills/templates` + `POST /interface/skills/from-template`：UI "From Template..." 按钮一键安装（name 冲突自动追加 `-{owner_short}` 后缀）；
  - `agents/tools/paper_hunter.py:fetch_papers(query, top_n, days_back, categories)`：arXiv API（≥3s 间隔，topN 上限 20）。
- **9 个 authed E2E spec**：
  - `list/create/edit/delete/rbac/invoke/enforcement/resources/integration/paper-hunter.authed.spec.ts`，**全部连真实 backend + 真实 PostgreSQL**，通过 `applyDevCookie` 即时签 ne_sso 注入；
  - 浏览器 baseURL 从 ctl.sh 启动的 UI（`http://localhost:3192`）取，跳过 webServer 重新构建；
  - 现有 17 个 mocked case 全部不退化，加上 27 个 authed case = **44 case 全绿**。
- **浏览器实机回归**：通过 `mcp__chrome_devtools__` + dev cookie 注入完整走 「From Template → Install Paper Hunter → Preview Render」三步链路（截图存档 `.temp/skills-phase2-preview-real.png`）。

### 3.3 仍未覆盖（Phase 3+）

- **SemVer DB 历史表**：`skill_versions` 表 + SubAgent 锁定特定版本；
- **SKILL.md 双向同步**：仓库 `*.skill.md` ↔ DB 导入/导出；
- **资源真正 fetch**：`url` 类型的远程 HTTP 拉取（需安全沙箱）；
- **Skill marketplace**：跨用户公开 Skill 评分 / 使用频率统计；
- **arXiv 之外的论文源**：Semantic Scholar / Papers With Code（Paper Hunter 后续扩展）。

---

## 4. 设计决策：为什么不直接复刻 Claude Skills

| 决策 | 取舍 |
|----|----|
| **DB-first，非 file-first** | 本仓主用例是「在线协作 + RBAC」，文件 PR 流程对终端用户不友好；Phase 2 再补 SKILL.md 单向导入 |
| **不引入 SKILL 资源目录（Phase 1）** | 资源挂载需要文件 IO + 安全沙箱，复杂度远超 PR 范围；优先用 prompt_template 字符串覆盖 80% 场景 |
| **fail-soft 而非 fail-close** | Skills 是 _增强_ 而非 _依赖_：缺失工具或权限不应阻塞 SubAgent 启动；把决策权留给 LLM（看到工具不在白名单时会主动询问） |
| **Progressive Disclosure 原则一以贯之** | 即便未来引入资源文件，也将遵循「描述层 / 调用层 / 资源层」的三段披露顺序，避免一次性塞满 context |

---

## 5. 第一应用场景：自动收集 AI Agent Paper（演进示例）

> 用本模块支撑「定期采集 arXiv / OpenReview 上的 Agent 相关 Paper，入库到 Knowledge Base + Knowledge Graph」工作流。

完整端到端范式见 [`docs/user-guide/skills-advanced.md`](./user-guide/skills-advanced.md#案例-paper-自动收集-skill)；摘要：

1. 定义 `arxiv-fetch` Skill：description=「检索 arXiv 与 OpenReview 上 LLM Agent 相关论文」、prompt_template 含查询模板、required_tools=`["search_arxiv","fetch_pdf"]`；
2. 创建 `paper-curator` SubAgent，绑定 skills=`["arxiv-fetch", "knowledge-ingest"]`；
3. 系统每次调用 SubAgent 时，描述层（layer 1）告知 LLM 拥有这两个 Skill；
4. LLM 决定调用 → 触发器（Phase 2）展开 `prompt_template`（layer 2），传参执行 → 落 KB + KG。

---

## 6. Next Best Action（Phase 3 路线）

Phase 1 + Phase 2 完成 4 项 P0/P1/P2 缺口（Layer 2 / fail-close / Layer 3 / 模板库 + Paper Hunter）后，按价值密度降序的下一步：

1. **`skill_versions` 历史表**：在已有 SemVer 校验之上落 DB 历史，支持 SubAgent 锁定特定版本（如 `arxiv-fetch@0.1.0`）；
2. **`SKILL.md` 双向同步**：仓库内 `*.skill.md` 文件 → 启动时同步到 DB；DB Skill → CLI 导出 `*.skill.md` 用于 PR review；
3. **第二批模板**：`memory-distill`、`kg-summarize`、`mcp-tool-binding` 三类高频场景；
4. **arXiv 之外的论文源**：Semantic Scholar 引文图叠加 KG（Paper Hunter v0.2）；
5. **Memory 自动定时调度**：通过 `memory/automation/jobs` 注册每周一 09:07 跑 paper-hunter；
6. **Skill marketplace**：跨用户公开 Skill 评分 + 使用频率统计；
7. **资源真正 fetch**：`url` 类型在专用沙箱内远程 HTTP 拉取，绕开 SSRF 风险（默认仍传字符串）。

---

## 参考文献

<a id="ref1"></a>[1] J. Liu, D. Shen, Y. Zhang, B. Dolan, L. Carin, and W. Chen, "What makes good in-context examples for GPT-3?," *arXiv preprint arXiv:2101.06804*, 2021.

<a id="ref2"></a>[2] J. Wei, X. Wang, D. Schuurmans, M. Bosma, B. Ichter, F. Xia, E. H. Chi, Q. V. Le, and D. Zhou, "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models," *Adv. Neural Inf. Process. Syst.*, vol. 35, pp. 24824–24837, 2022.

<a id="ref3"></a>[3] S. Yao, J. Zhao, D. Yu, N. Du, I. Shafran, K. R. Narasimhan, and Y. Cao, "ReAct: Synergizing Reasoning and Acting in Language Models," in *Int. Conf. Learn. Represent. (ICLR)*, 2023.

<a id="ref4"></a>[4] Anthropic, "Agent Skills," *Claude Code Docs*, [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills), 2025.

<a id="ref5"></a>[5] Google, "Agent Development Kit – Skills," *ADK Documentation*, [adk.dev/skills](https://adk.dev/skills), 2025.

<a id="ref6"></a>[6] OpenAI, "Codex Skills," *OpenAI Codex Documentation*, [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills), 2025.

<a id="ref7"></a>[7] L. Wang, C. Ma, X. Feng, et al., "A Survey on Large Language Model based Autonomous Agents," *Front. Comput. Sci.*, vol. 18, no. 6, p. 186345, 2024.

<a id="ref8"></a>[8] T. Schick, J. Dwivedi-Yu, R. Dessì, R. Raileanu, M. Lomeli, L. Zettlemoyer, N. Cancedda, and T. Scialom, "Toolformer: Language Models Can Teach Themselves to Use Tools," *Adv. Neural Inf. Process. Syst.*, vol. 36, 2023.

<a id="ref9"></a>[9] N. Shinn, F. Cassano, A. Gopinath, K. R. Narasimhan, and S. Yao, "Reflexion: Language Agents with Verbal Reinforcement Learning," *Adv. Neural Inf. Process. Syst.*, vol. 36, 2023.

<a id="ref10"></a>[10] P. Lewis, E. Perez, A. Piktus, F. Petroni, V. Karpukhin, N. Goyal, H. Küttler, M. Lewis, W. Yih, T. Rocktäschel, S. Riedel, and D. Kiela, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," *Adv. Neural Inf. Process. Syst.*, vol. 33, pp. 9459–9474, 2020.

<a id="ref11"></a>[11] arXiv API Help, "API Basics," [info.arxiv.org/help/api](https://info.arxiv.org/help/api/index.html). 速率政策 ≥3s/req 直接驱动了 Paper Hunter `fetch_papers` 工具的间隔策略。
