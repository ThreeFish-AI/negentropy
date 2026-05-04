# Skills · AI Agent Paper Hunter 端到端

> 自动检索 arXiv 上 AI Agent 领域最新最有用的论文，并通过 Skills 内化到本项目 Memory + Knowledge Graph 的最小可跑通范式。理论锚点见 [`docs/skills.md`](../skills.md) §3.2 「Phase 2 缺口 4」。

## 1. 链路总览

```
用户 → /interface/skills "From Template…" 选 paper_hunter → Install
   ↓
Skill 落库（required_tools=[fetch_papers, save_to_memory, update_knowledge_graph]，
           enforcement_mode=strict，3 类 resources）
   ↓
路径 A — UI Preview：点 Skill 卡片的 Preview 按钮，填变量即看 Jinja2 渲染结果（不调 LLM）
路径 B — SubAgent：把 ai-agent-paper-hunter 关联到 SubAgent.skills，启动后 LLM
        在 system prompt 中看到该 Skill 描述 → 自主调用 expand_skill → 触发 fetch_papers
        → save_to_memory + update_knowledge_graph
```

## 2. 准备（一次性）

```bash
# 1) 启动服务（已启则跳过）
./scripts/ctl.sh start backend ui

# 2) 三步自检：dev cookie + skills 端点
TOKEN=$(NE_AUTH_TOKEN_SECRET=<hex> node apps/negentropy-ui/scripts/sign-dev-cookie.mjs --quiet)
curl -fsS -b "ne_sso=$TOKEN" http://localhost:3292/auth/me
curl -fsS -b "ne_sso=$TOKEN" http://localhost:3192/api/auth/me
curl -fsS -b "ne_sso=$TOKEN" http://localhost:3192/api/interface/skills
```

## 3. 路径 A — UI Preview

适合调试 Jinja2 模板与变量。**不会**真的拉论文 / 写库。

1. 浏览器访问 `http://localhost:3192/interface/skills`；
2. 点 `From Template…` → 选 `AI Agent Paper Hunter` → `Install`；
3. 卡片网格中找到 `AI Agent Paper Hunter`，点眼睛图标 (Preview) 打开预览对话框；
4. Variables (JSON) 输入：

   ```json
   {
     "query": "ReAct agent reasoning",
     "top_n": 3,
     "days_back": 14,
     "topic_tag": "ai-agent"
   }
   ```

5. 点 `Render`，下方 RENDERED PROMPT 区块即显示 Jinja2 渲染后的完整 prompt（含 `<skill_resources>` 块）；
6. RESOURCES 区块列出 3 类资源：`corpus:ai-papers-2026` / `kg_node:Topic/AgentSkills` / `url:https://arxiv.org/list/cs.AI/recent`；
7. "Heads up" 框说明该 Skill 声明了 3 个 required tools — 这是给 SubAgent 配置者的提醒（路径 B 触发时 strict 模式下缺工具会阻塞）。

## 4. 路径 B — SubAgent 自动触发（生产链路）

> 路径 B 需要后端配置 LLM provider（OpenAI / Anthropic / Vertex AI 至少一个 vendor key）。本 PR **不引入新 LLM 配置**，复用既有 ADK runtime。

1. 在 `/interface/subagents` 创建一个 SubAgent（如 `paper-hunter`）：
   - `tools: ["fetch_papers", "save_to_memory", "update_knowledge_graph"]`（必须包含 strict 模式声明的 3 个）；
   - `skills: ["ai-agent-paper-hunter-{owner_short}"]`（精确名，可在 Skills 卡片上看到）；
2. 启动 SubAgent，发送 user message：`"采集本周 ReAct agent 相关 arXiv 论文 5 篇"`；
3. ADK runtime 在 SubAgent 启动时调 `_load_subagent_row`：
   - `resolve_skills` 加载 Skill；
   - `build_progressive_disclosure_prompt(agent_tools=...)` 检测 strict 模式 + 全部 required_tools 在 SubAgent.tools 中 → 通过；缺一即抛 `SkillToolMissingError` → SubAgent 降级为无 system prompt 启动（明确"工具不全无法运行"）；
4. LLM 在 system prompt 中看到 `<available_skills> - ai-agent-paper-hunter: ... [3 resources]`；
5. LLM 决定使用：调 `expand_skill("ai-agent-paper-hunter", { query, top_n, days_back, topic_tag })` → 服务端 Jinja2 渲染完整模板 + 资源列表回灌；
6. LLM 按渲染结果指引依次：`fetch_papers` → 每篇 `save_to_memory` + `update_knowledge_graph`；
7. 进 `/memory/timeline?metadata.tags=paper` 与 `/knowledge/graph` 即可看到结果。

## 5. 排错

| 现象 | 可能原因 | 处理 |
|------|---------|------|
| Preview 渲染 `{{ query }}` 没替换 | Variables JSON 缺 `query` 键 | 补齐变量；StrictUndefined 模式下缺失变量 fail-soft 返回原模板 |
| invoke 返回 503 | feature flag `NEGENTROPY_SKILLS_LAYER2_ENABLED=false` | 移除该 env 或设为 true 重启 backend |
| invoke 返回 409 | Skill `is_enabled=false` | 卡片上点眼睛图标启用 |
| SubAgent 起不来且日志 `subagent_skills_strict_blocked` | strict 模式 + SubAgent.tools 缺工具 | 把缺失工具补齐到 SubAgent；或临时把 Skill 改 warning 模式 |
| arXiv 0 篇返回 | `days_back` 太短 / 关键词太冷 | 放宽到 30 天，或用更通用 query |
| Memory/KG 无写入 | LLM 没真的调 save_to_memory（提示词理解偏差） | 把 prompt_template 改更命令式；或在 Preview 内调试新模板再覆盖 Skill |

## 6. 进阶：多论文源 / 定时调度

| 扩展 | 落点 |
|------|------|
| Semantic Scholar 引文图叠加 | 新增 ADK tool `agents/tools/semantic_scholar.py:fetch_citations`，把它加入新模板 `paper_to_kg.yaml` 的 required_tools |
| Papers With Code benchmark | 同上，新增 `fetch_pwc_benchmark` |
| 每周一定时跑 | 通过 `memory/automation/jobs` 注册 cron `7 9 * * 1`（参考 `docs/agents/automation.md`） |

## 7. 引用

- arXiv API Help, "API Basics," [info.arxiv.org/help/api](https://info.arxiv.org/help/api/index.html). — `fetch_papers` 严格遵守 ≥3s/req 速率与 Atom feed 解析约定。
- D. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," *NeurIPS*, 2020.
- S. Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models," *ICLR*, 2023.
