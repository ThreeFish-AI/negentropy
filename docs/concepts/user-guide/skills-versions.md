---
sidebar_position: 13
---
# Skills · 版本锚定与历史快照（Phase 3）

> 让 SubAgent 引用 `arxiv-fetch@1.0.0`，避免上游 Skill 改动悄无声息影响下游 Agent。

## 1. SubAgent 引用语法（向后兼容）

| 语法                   | 含义                                           |
| ---------------------- | ---------------------------------------------- |
| `arxiv-fetch`          | 等价于 `arxiv-fetch@*`（最新；与之前完全一致） |
| `arxiv-fetch@1.0.0`    | 精确锁定 `1.0.0` 快照                          |
| `arxiv-fetch@~1.0`     | tilde range：`>=1.0,<2.0` 内最大版本           |
| `arxiv-fetch@^1.0`     | caret range：`>=1.0,<2.0`（npm 习惯）          |
| `arxiv-fetch@>=1.0,<2` | 原生 PEP 440 specifier                         |

无 `@` 后缀 = 用 Skill 当前字段（与 Phase 1/2 行为相同）。**所有现有 SubAgent 配置零迁移**。

## 2. 自动 snapshot 时机

- **新建 Skill**（POST `/skills` 或 from-template）：立即写入初始 SkillVersion；
- **PATCH `version`**：检测 `version` 字段变更，把当前所有字段 snapshot 到新版本；
- **手动 POST `/skills/{id}/versions`**：把当前字段 freeze 到指定版本（不传 version 则用 Skill 当前版本，重复则 409）。

## 3. UI 操作

`/interface/skills` 卡片右上紫色 ↗ 图标 → **Versions** 弹窗：

- 列表按 `created_at desc` 显示全部历史；
- 每条展示版本号 + 时间戳 + JSON snapshot（含 `prompt_template` / `required_tools` / `resources` / `enforcement_mode` 等所有字段）；
- 仅可读；回滚操作 Phase 4 路线。

## 4. API 速查

```bash
# 列出全部历史版本
curl -b "ne_sso=$TOKEN" http://localhost:3192/api/interface/skills/$SKILL_ID/versions

# 手动 freeze 当前字段为新版本
curl -X POST -H "Content-Type: application/json" -b "ne_sso=$TOKEN" \
  -d '{"version":"2.0.0"}' \
  http://localhost:3192/api/interface/skills/$SKILL_ID/versions
```

## 5. 解析逻辑（`skills_injector.resolve_skills`）

1. 拆 `name@spec` → (name, spec)；
2. 用 name/UUID 加载 Skill 行；
3. spec 不为 `*` → 在 `skill_versions` 表中按 `SpecifierSet` 匹配（取范围内最大版本）；
4. 找不到匹配 → fail-soft warning，退化为 Skill 当前字段。

## 6. 单元测试参考

`apps/negentropy/tests/unit_tests/agents/test_skills_injector.py` 提供 `_parse_skill_ref` / `_resolve_version_snapshot` 的覆盖。E2E 实机参见 `tests/e2e/skills/versions.authed.spec.ts`。

## 7. 引用

- SemVer 标准 https://semver.org/
- PEP 440（Python 版本规范） https://peps.python.org/pep-0440/
- packaging.specifiers `SpecifierSet` https://packaging.pypa.io/en/stable/specifiers.html
