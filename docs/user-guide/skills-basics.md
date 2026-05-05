# Skills 基础上手

> 5 步从零创建一个 Skill 并让 SubAgent 用上它。

适用读者：管理员或团队 owner，已能登录 Negentropy UI（`/`）。

---

## 1. 进入 Skills 页

主导航 → `Interface` → 二级导航 → `Skills`，URL：`/interface/skills`。

新环境初次访问会看到「No skills defined yet.」+「Create your first skill →」。

## 2. 创建第一个 Skill

点击右上角「Add Skill」打开 Skill 表单，按以下顺序填写最关键的字段：

| 字段 | 必填 | 示例 | 说明 |
|------|----|----|----|
| Name | ✓ | `arxiv-fetch` | 唯一短标识（用于 SubAgent 引用） |
| Display Name | | `ArXiv Fetcher` | 卡片标题展示用 |
| Description | | `检索并下载 arXiv 上 LLM Agent 相关论文` | **会作为 description 常驻 SubAgent 系统 prompt**，写得简洁清晰最关键 |
| Category | | `research` | 用于列表页 Filter |
| Visibility | | `Private` | 默认仅自己可见；改 `Public` 可被其它 owner 引用 |
| Prompt Template | | 见下方 | 仅在 Skill 被实际调用时按需展开（Layer 2） |
| Required Tools (一行一个) | | `search_arxiv`<br>`fetch_pdf` | SubAgent 必须拥有这些工具，否则启动时 warning |
| Config Schema (JSON) | | `{}` | 预留 JSON Schema，未来用于参数校验 |
| Default Config (JSON) | | `{}` | 预留默认参数 |

`Prompt Template` 示例：

```
You are a research librarian. Given a topic {{topic}}, search arXiv for the most cited
papers in the past 12 months, fetch their PDFs, and produce a structured summary
covering motivation, method, experiments, and limitations.
```

> **Tips**：JSON 字段非法时会立即在对应 textarea 显示红色边框 + 行内错误（不会上送后端）。

点击「Create」，Skill 即落库；卡片立即出现在网格中，顶部右下角弹出绿色 toast「Created skill "..."」。

## 3. 验证已创建

回到 `/interface/skills`：
- 卡片显示 Name + 状态徽章（Enabled / Disabled）+ Category + Visibility；
- 卡片右上角有 3 个按钮：✓ 启停 toggle、✏️ 编辑、🗑 删除。

## 4. 关联到 SubAgent

主导航 → `Interface` → 二级导航 → `SubAgents`：

- 选择一个 SubAgent（或新建一个），打开编辑表单；
- 找到「Skills (one per line)」字段，输入 Skill 的 `name` 或 `id`，每行一个；
- 保存。

下次该 SubAgent 处理用户请求时，系统 prompt 会自动追加：

```
<available_skills>
- arxiv-fetch: 检索并下载 arXiv 上 LLM Agent 相关论文
</available_skills>
```

LLM 会读取该块决定是否调用对应能力。

## 5. 触发执行（观察）

在主页面（`/`）发起对话，给 SubAgent 一个能命中 Skill 的指令，例如：

> 帮我查一下 LLM Agent 自我改进相关的最新论文。

LLM 会通过工具调用使用 Skill 提示中的逻辑（`search_arxiv`、`fetch_pdf` 等）完成任务。如果工具未配置 / 不存在，LLM 会以自然语言报告，不会崩溃。

---

## 常见误解 & 防范

- **「我修改了 Skill 但 SubAgent 没看到」**：后端 InstructionProvider 有 60s TTL 缓存。等待 1 分钟，或在 `/interface/subagents` 触发 PATCH（任意小改即可，会调用 `invalidate_cache(prefix="subagent:")`）。
- **「列表为空但我刚创建过」**：检查 Filter 是否选了非匹配 category。点 `All categories` 重置。
- **「删除按钮一点就删了」**：本项目已替换原生 `confirm()` 为 ConfirmDialog，需要手动点「Delete」按钮二次确认；ESC 或点遮罩可取消。

---

## 进阶

- 工具白名单 / Visibility 策略 / Progressive Disclosure 详解 → [`skills-advanced.md`](./skills-advanced.md)
- 401 / 403 / JSON 错误等问题排查 → [`skills-troubleshooting.md`](./skills-troubleshooting.md)
- 设计原理与主流框架对照 → [`../skills.md`](../skills.md)
