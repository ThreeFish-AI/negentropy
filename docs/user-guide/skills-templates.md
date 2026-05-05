# Skills · 一键导入模板（From Template）

> 本指南帮你在 30 秒内把内置 Skill 模板物化到工作区。理论锚点参见 [`docs/skills.md`](../skills.md) §3.2 「Phase 2 模板库」。

## 1. 入口

`/interface/skills` 顶部除了 `Add Skill`，还有 `From Template…` 按钮：

```
[ From Template… ]   [ Add Skill ]
```

点击后弹出 **Install from Template** 对话框，列出仓库内置的 `*.yaml` 模板（首发 1 个：`paper_hunter`）。

## 2. 操作 3 步

1. 点 `From Template…`；
2. 在卡片右侧点 `Install`（同名 Skill 已存在时后端自动追加 `-{owner_short}` 后缀，无需重试）；
3. 看到 toast `Installed template "..."` 即完成 — 卡片网格刷新可见新 Skill。

## 3. 内置模板速览

| template_id | name | 用途 | 关键 required_tools |
|------|------|------|---------------------|
| `paper_hunter` | `ai-agent-paper-hunter` | 检索 arXiv AI Agent 论文并写入 Memory + KG | `fetch_papers` / `save_to_memory` / `update_knowledge_graph` |

继续把第二批模板加进 `apps/negentropy/src/negentropy/agents/skill_templates/*.yaml` 即可，加载器自动扫描，无需重新部署后端代码（**热加载需要重启 backend**：模板在请求时才加载）。

## 4. 模板 YAML 规范

```yaml
template_id: my_skill           # 唯一 id（区别于 name；name 可被冲突重写）
name: my-skill                  # 默认 Skill 名（冲突时追加 owner_short）
display_name: My Skill          # 可选
description: 一句话能力描述      # 必填
category: research              # 必填，用于 UI 过滤
version: 0.1.0                  # 必填，packaging.version 强 SemVer 校验
visibility: shared              # private | shared | public
priority: 10                    # 数值越大排序越靠前
enforcement_mode: strict        # warning | strict（缺工具是否阻塞 SubAgent）
required_tools: [tool_a, tool_b]
prompt_template: |              # 支持 Jinja2 变量（{{ var }}）
  ...
config_schema:                  # JSON Schema for vars
  type: object
  required: [...]
default_config:                 # 默认变量值
  ...
resources:                      # 可选：Layer 3 资源挂载
  - type: corpus | kg_node | memory | url | inline
    ref: <ID 或 URL>
    title: 可读标题
    lazy: true                  # 懒加载，常驻 prompt 仅显示数量
```

字段缺失或 `version` 不是合法 SemVer 时，**整个模板被丢弃且仅记 warning**；其它模板不受影响。

## 5. API（外部系统直接使用）

```bash
# 列出所有内置模板
curl -b "ne_sso=$TOKEN" http://localhost:3192/api/interface/skills/templates

# 按 template_id 一键安装
curl -X POST -H "Content-Type: application/json" \
  -b "ne_sso=$TOKEN" \
  -d '{"template_id":"paper_hunter"}' \
  http://localhost:3192/api/interface/skills/from-template
```

返回的 Skill 立刻可用 — 包括关联到 SubAgent 的 `skills: ["ai-agent-paper-hunter-..."]`、UI Preview 渲染、`POST /skills/{id}/invoke` Layer 2 展开。

## 6. 与 Paper Hunter 一起用

完整端到端见 [`skills-paper-hunter.md`](./skills-paper-hunter.md)。
