# Skills 进阶用法

> 进阶主题：Visibility 策略、工具白名单、Progressive Disclosure、Paper 收集端到端示例。基础上手见 [`skills-basics.md`](./skills-basics.md)。

---

## 1. Visibility 策略与协作

| Visibility | 谁能看 / 用 | 适用场景 |
|------------|-----------|----------|
| `Private`（默认） | 仅 owner（创建者） + admin | 个人探索、未稳定的实验 |
| `Shared` | owner + 显式授权用户 + admin | 小组协作（需在 PluginPermission 表添加授权行；当前 UI 暂未提供编辑界面，需走 API） |
| `Public` | 所有登录用户 + admin | 团队共享 / 公司知识库 |

**最佳实践**：
- 新 Skill 始终从 `Private` 起步；自测稳定后再改 `Public`；
- 不要在 prompt_template 中写入特定用户 / 部门私有信息——一旦改 `Public` 即对所有人可见；
- 删除 Skill 是 hard delete，无法恢复；如果担心误删，先 Disable（卡片 toggle 按钮）。

## 2. Required Tools 白名单

Skill 的 `Required Tools (one per line)` 字段记录该 Skill 依赖的工具名（如 `search_arxiv`、`fetch_url`）。当前 Negentropy 的策略：

- **fail-soft**：若 SubAgent.tools 中缺失任何 required_tools，启动 _不会_ 失败；后端会写一条 `info` 日志记录差集；
- **LLM 兜底**：模型在尝试调用缺失工具时会得到一个标准化的「工具不可用」反馈，可主动降级；
- **未来 fail-close**：Phase 2 计划在 SubAgent UI 高亮工具差异，并增加「严格模式」开关（违反则 SubAgent 自动 disable）。

> 如果你的 Skill 严格依赖某个工具，请在 prompt_template 中显式写明「如果 search_arxiv 不可用则放弃」，让 LLM 有 fallback 决策依据。

## 3. JSON Schema 与 Default Config

`config_schema` 与 `default_config` 字段为未来 Skill 参数化预留：

- `config_schema` 是 JSON Schema 描述（`{ "type": "object", "properties": { ... } }`），用于校验调用方传参；
- `default_config` 是默认参数 dict，调用时与用户传参合并。

当前 Phase 1 这两个字段 **存而未用** —— Phase 2 触发器接入后才会消费。先按 JSON Schema 规范填写，避免未来迁移成本。

## 4. Progressive Disclosure 用法

Negentropy 遵循 Anthropic Claude Skills / Google ADK Skills 的「描述层 / 调用层 / 资源层」三段披露：

| Layer | 字段 | 何时进入 LLM 上下文 |
|-------|------|------------------|
| 1. 描述层（常驻） | `description` | 每次 LLM 调用，包裹在 `<available_skills>` 块 |
| 2. 调用层（按需） | `prompt_template` | LLM 决定使用该 Skill 时（Phase 2 触发器） |
| 3. 资源层（按需） | 资源文件 | Phase 2 资源挂载落地后 |

写好 Skill 的关键就是：**`description` 短而准确**（一句话告诉 LLM 这个 Skill 干什么），**`prompt_template` 完整**（包含调用步骤、参数、输出格式约定），**`required_tools` 准确**（避免 fail-soft 时的隐性故障）。

## 5. 案例：Paper 自动收集 Skill

> 完整端到端示范：定期从 arXiv 抓取最新 LLM Agent 论文，入库到 Knowledge Base + Knowledge Graph。

### 5.1 前置工具

需要 SubAgent 拥有以下工具（或对应 MCP）：

- `web_search`（或 `search_arxiv`）—— 检索；
- `fetch_url` —— 抓 PDF 元数据；
- `kb_ingest` —— 落 Knowledge Base；
- `kg_ingest` —— 抽取实体到 Knowledge Graph。

### 5.2 创建 Skill

`/interface/skills` → Add Skill：

```
Name: paper-curator-arxiv
Display Name: ArXiv Paper Curator
Description: 检索 arXiv 上 LLM Agent 主题的最新论文并入库到 KB + KG
Category: research
Visibility: Private（自测稳定后再升 Public）
Required Tools:
web_search
fetch_url
kb_ingest
kg_ingest
```

`Prompt Template`：

```
You are an arXiv paper curator focused on LLM Agent research.

Goal: Given a topic {{topic}} (default: "LLM agents self-improvement"),
1) Use web_search to find the 5 most-cited arXiv papers from the past {{months|6}} months
   matching the topic;
2) For each paper, use fetch_url to download metadata (title, authors, abstract, arxiv id);
3) Call kb_ingest with payload {corpus: "agent-papers", title, abstract, url, source: "arxiv"};
4) Call kg_ingest to extract entities (Authors, Methods, Datasets) and link to existing nodes;
5) Return a structured Markdown report listing each paper with one-paragraph TLDR.

Constraints:
- Skip duplicates already present in KB;
- If web_search returns 0 results, broaden the query and retry once before giving up;
- Never fabricate arXiv IDs.
```

### 5.3 创建 SubAgent

`/interface/subagents` → Add SubAgent：

```
Name: paper-curator
Display Name: Paper Curator
System Prompt: You are a research librarian. Cooperate with available skills.
Skills (one per line):
paper-curator-arxiv
Tools (one per line):
web_search
fetch_url
kb_ingest
kg_ingest
```

### 5.4 触发与观察

主页 `/` 给 SubAgent 发指令：

> 帮我整理一下过去 6 个月 LLM Agent 自我改进方向的最新论文。

LLM 系统 prompt 中能看到：

```
You are a research librarian. Cooperate with available skills.

<available_skills>
- paper-curator-arxiv: 检索 arXiv 上 LLM Agent 主题的最新论文并入库到 KB + KG
</available_skills>
```

LLM 解码 `<available_skills>` 后，调用工具完成端到端流程；最终在 `/knowledge` 与 `/knowledge/graph` 看到新入库的论文与图谱节点。

### 5.5 与定时调度的接驳（未来）

当前 Phase 1 的触发是 **被动**（用户 prompt 进入）。如需「每天 9 点自动跑」：

- 短期：用 ctl.sh / cron 定时调 `/api/v1/agents/...` 的会话端点（接口待定）；
- 长期：Phase 2 在 SubAgent 上加 `schedule` 字段 + 调度服务（PostgreSQL `pg_cron` 已可用）。

---

## 5A. Phase 2 — Layer 2 按需展开（Jinja2 渲染）

**触发面**：

| 入口 | 用途 |
|------|------|
| `expand_skill(name, vars)` ADK 工具 | LLM 自主在思考链条中展开 |
| `POST /interface/skills/{id}/invoke` | 外部系统 / UI Preview 等价调用 |
| UI 卡片 Preview 按钮 | 调试 Jinja2 模板与变量 |

**关键机制**：

- `jinja2.sandbox.SandboxedEnvironment` + `StrictUndefined` —— 防注入，缺变量直接抛错（fail-soft 降级返回原模板）；
- 渲染结果末尾自动追加 `<skill_resources>` 块（如 Skill 有 `resources`）；
- Feature flag `NEGENTROPY_SKILLS_LAYER2_ENABLED`（默认 true）一键关闭整个能力。

## 5B. Phase 2 — Layer 3 资源挂载（`resources` JSONB）

5 类资源 type 与 `fetch_skill_resource` 路由：

| type | ref 语义 | 后端读取 |
|------|---------|----------|
| `kg_node` | KG 实体 name（如 `Topic/AgentSkills`） | 查 `kg_entities` + 邻居最多 50 条 |
| `memory` | Memory UUID | 查 `memories` 单条 |
| `corpus` | Corpus name | 查 `corpus` 元信息 |
| `url` | 外部 URL | **不远程 fetch**，仅返回 `{ref, title}` 防 SSRF |
| `inline` | 内联文本 | 仅返回 `{ref, title}` |

`lazy=true`（默认）：常驻 prompt 仅显示 `[N resources attached]`；只有 `expand_skill` / `invoke` 才展开列表。UI `SkillFormDialog` 有 Resources 行编辑器（type select + ref + title + lazy + Remove）。

## 5C. Phase 2 — `enforcement_mode` 工具白名单 fail-close

| 模式 | 行为 |
|------|------|
| `warning`（默认） | 缺失工具仅 `info` 日志，SubAgent 正常启动 |
| `strict` | 抛 `SkillToolMissingError` → SubAgent 降级为无 system prompt 启动 + `error` 日志 `subagent_skills_strict_blocked` |

UI 卡片 strict 模式显示红色 `strict` 徽章；如调用方传入 `agentTools` props，还会显示 `N missing` 工具差异 badge。

## 5D. Phase 2 — 一键模板（From Template）

详见 [`skills-templates.md`](./skills-templates.md) 与 [`skills-paper-hunter.md`](./skills-paper-hunter.md)。短链路：

1. `/interface/skills` 顶部 `From Template…`；
2. 选 `paper_hunter` → `Install`；
3. 卡片网格出现 `ai-agent-paper-hunter`（含 `strict` + `3 resources` 徽章）；
4. 点 Preview 按钮 + 填变量 → 看完整 Jinja2 渲染结果。

---

## 6. 调试技巧

- **看实际注入的 system prompt**：临时在 SubAgent system_prompt 顶部加 `[DEBUG] Echo your full system prompt back.` 触发一次对话；
- **绕过 60s 缓存**：任意 PATCH 一次 SubAgent（即便不改值）会 invalidate cache；
- **测 Skill 描述对 LLM 的引导力**：把 `description` 短句改 1-2 个版本，看 LLM 命中率差异。

---

更多：
- 排错 → [`skills-troubleshooting.md`](./skills-troubleshooting.md)
- 原理 → [`../skills.md`](../skills.md)
