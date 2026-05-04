# Skills 模块（Agent Skills 在 Negentropy 的工程实现）

> 项目内的 Skills 模块是「可复用 Agent 技能配置 + Progressive Disclosure 注入」的最小工程化落地。本文档汇总：理论锚点、与主流框架的对照、当前实现边界、未来演进路线。其它操作指引参见 [`docs/user-guide/skills-basics.md`](./user-guide/skills-basics.md) / [`skills-advanced.md`](./user-guide/skills-advanced.md) / [`skills-troubleshooting.md`](./user-guide/skills-troubleshooting.md)。

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
| 核心载体 | `SKILL.md` + frontmatter | Python/TS 类 + 装饰器 | Markdown spec + tool 契约 | DB 表（`skills`）+ 12 字段 |
| Frontmatter 元数据 | ✓（`name`/`description`/`license`/`version`） | ✓（class metadata） | ✓ | ~（DB 列即元数据） |
| 描述常驻 | ✓ | ✓ | ✓ | ✓（本 PR 落地） |
| 模板按需 | ✓ | ✓ | ~ | ✓（接口预留 `format_skill_invocation`） |
| 资源文件挂载 | ✓（`scripts/` `references/` `assets/`） | ✓ | ~ | ✗（Phase 2） |
| 工具白名单 | ✓（`allowed-tools`） | ✓ | ✓ | ~（warning，未 fail-close） |
| 版本管理 | ✓（SemVer） | ✓ | ✗ | ~（字符串字段，未校验） |
| RBAC / 可见性 | ~（Cloud 层） | ✓ | ✗ | ✓（owner/private/shared/public） |
| 在线编辑 / UI | ✗（文件系统） | ✗ | ✗ | ✓（`/interface/skills`） |

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

### 3.1 已落地（本 PR）

- **CRUDL**：完整增删改查 + 分类过滤（`apps/negentropy/src/negentropy/interface/api.py:1083-1227`）；
- **权限模型**：admin > owner > visibility（PRIVATE/SHARED/PUBLIC）+ `PluginPermission` 表（`interface/permissions.py:23-190`）；
- **UI**：在线编辑 + Inline 启停 + ConfirmDialog + JSON 字段级错误锚定 + sonner toast（`app/interface/skills/`）；
- **执行链路最小闭环**：`agents/skills_injector.py` 在 `_load_subagent_row` 注入 `<available_skills>` 块到 SubAgent 系统 prompt，遵循 Progressive Disclosure layer 1；
- **自签 dev cookie 工具**：`apps/negentropy-ui/scripts/sign-dev-cookie.mjs` + `tests/e2e/utils/dev-cookie.ts`，本地浏览器实机验证不再依赖 Google OAuth；
- **E2E 覆盖**：5 个 sibling spec（`tests/e2e/skills/{list,create,edit,delete,integration}.spec.ts`）。

### 3.2 当前限制

- **Layer 2 `prompt_template` 按需展开**：`format_skill_invocation` 接口已就位，但触发器尚未接入 LLM 工具选择回调（Phase 2）；
- **Layer 3 资源挂载**：暂无文件系统挂载；
- **Allowed-tools fail-close**：`validate_required_tools` 当前仅做 warning，不阻塞 SubAgent 启动；
- **SemVer 版本管理**：`version` 字段无格式校验，无历史表；
- **SKILL.md 双向同步**：未支持把仓库内 `*.skill.md` 文件入库、或把 DB 导出到文件。

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

## 6. Next Best Action（Phase 2 路线）

按价值密度降序：

1. **触发器接入 Layer 2**：让 LLM 通过工具调用（如 `expand_skill(name)`）按需展开 `prompt_template`；不需要重写 ADK，只需增加一个内置工具即可；
2. **`SKILL.md` 单向导入**：仓库内 `*.skill.md` 文件 → 启动时同步到 DB；
3. **SemVer 版本管理**：`version` 字段加格式校验 + `skill_versions` 历史表，支持 SubAgent 锁定特定版本；
4. **Allowed-tools fail-close**：UI 显式展示工具差异；启动时 `is_enabled=false` 自动降级；
5. **资源文件挂载**：`assets/`、`scripts/` 通过 GCS / 本地存储 + 沙箱执行；
6. **Skill marketplace**：跨用户公开 Skill 分享（基于既有 `visibility=public`）。

---

## 参考文献

<a id="ref1"></a>[1] J. Liu, D. Shen, Y. Zhang, B. Dolan, L. Carin, and W. Chen, "What makes good in-context examples for GPT-3?," *arXiv preprint arXiv:2101.06804*, 2021.

<a id="ref2"></a>[2] J. Wei, X. Wang, D. Schuurmans, M. Bosma, B. Ichter, F. Xia, E. H. Chi, Q. V. Le, and D. Zhou, "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models," *Adv. Neural Inf. Process. Syst.*, vol. 35, pp. 24824–24837, 2022.

<a id="ref3"></a>[3] S. Yao, J. Zhao, D. Yu, N. Du, I. Shafran, K. R. Narasimhan, and Y. Cao, "ReAct: Synergizing Reasoning and Acting in Language Models," in *Int. Conf. Learn. Represent. (ICLR)*, 2023.

<a id="ref4"></a>[4] Anthropic, "Agent Skills," *Claude Code Docs*, [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills), 2025.

<a id="ref5"></a>[5] Google, "Agent Development Kit – Skills," *ADK Documentation*, [adk.dev/skills](https://adk.dev/skills), 2025.

<a id="ref6"></a>[6] OpenAI, "Codex Skills," *OpenAI Codex Documentation*, [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills), 2025.

<a id="ref7"></a>[7] L. Wang, C. Ma, X. Feng, et al., "A Survey on Large Language Model based Autonomous Agents," *Front. Comput. Sci.*, vol. 18, no. 6, p. 186345, 2024.
