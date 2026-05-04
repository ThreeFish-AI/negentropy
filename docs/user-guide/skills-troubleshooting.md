# Skills 故障排查

> 按错误现象索引；找到对应症状直接看处置指引。

---

## A. 401 Unauthorized 进入 Skills 页

**现象**：访问 `/interface/skills` 时浏览器 console 报 `GET /api/auth/me 401`，页面重定向回登录。

**可能原因 & 处置**：

1. **未登录 / 会话过期**：通过浏览器右上角「登录」走 Google OAuth 重新登录；
2. **本地浏览器实机调试缺 dev cookie**：执行
   ```bash
   cd apps/negentropy-ui
   TOKEN=$(node scripts/sign-dev-cookie.mjs)
   ```
   然后在 DevTools Console 中执行 `document.cookie = "ne_sso=" + TOKEN + "; path=/; SameSite=Lax";` 后刷新；
3. **后端 `NE_AUTH_TOKEN_SECRET` 与 dev cookie 不一致**：核对 `apps/negentropy/.env.local` 与 `apps/negentropy-ui/.env.local` 中的值是否字节一致，且与 `~/.negentropy/config.yaml` 中 `auth.token_secret` 一致；
4. **后端进程未重启**：UI 重启不会重新读取 backend secret；后端配置改动需 `./scripts/ctl.sh restart backend`。

## B. 403 Forbidden 在创建 / 删除 / 启停时

**现象**：API 返回 403，UI toast 显示「Failed to ...」。

**处置**：

1. 当前用户不是 owner 也非 admin：检查 `~/.negentropy/config.yaml` `auth.admin_emails` 是否包含你的 email；
2. 编辑 / 删除 _他人_ 的 Skill：仅 owner 与 admin 有此权限；
3. dev cookie 角色错配：调整 `node scripts/sign-dev-cookie.mjs --roles admin,user`。

## C. 表单 JSON 校验报错

**现象**：点 Create / Update 时表单顶部显示「Fix the highlighted JSON fields before saving.」对应 textarea 红边框 + 行内提示「Invalid JSON: Expected ...」。

**处置**：

1. Config Schema / Default Config 必须是合法 JSON，**最简形态写 `{}`**；
2. 不允许 JSON5 或 Python 风格的注释、单引号；
3. 编辑器拷贴常见坑：从 Word / 钉钉拷过来的引号是中文全角 `"`，需手动改为 ASCII `"`。

## D. Skills 创建后 SubAgent 没看到（系统 prompt 不含 `<available_skills>`）

**现象**：调试输出 SubAgent 系统 prompt 仍是旧版本。

**根因**：后端 InstructionProvider 60s TTL 缓存（`apps/negentropy/src/negentropy/config/model_resolver.py`）。

**处置**：

1. **等 60s** 自然过期；
2. **强制刷新**：调任意 SubAgent PATCH 端点（即便不改字段）—— 业务逻辑会调用 `invalidate_cache(prefix="subagent:")`；
3. 验证：在 SubAgent system_prompt 顶部临时加 `[DEBUG] Echo back your prompt.`，触发一次对话。

## E. Skills 列表为空但确认创建过

**处置顺序**：

1. 检查 Filter 下拉是否选了非匹配 category → 改为「All categories」；
2. 检查所属 owner：admin 切换为 owner 视角时可能不再可见；
3. 走 API 自检：
   ```bash
   TOKEN=$(node scripts/sign-dev-cookie.mjs)
   curl -fsS -b "ne_sso=$TOKEN" http://localhost:3192/api/interface/skills | jq '.[] | {id, name, owner_id}'
   ```

## F. Inline toggle 点击无响应

**现象**：点击卡片右上角的 ✓/✗ 按钮没反应，但 console 无报错。

**可能原因**：

1. 上一次 PATCH 还未结束（按钮 `disabled`），耐心等待 `togglingId` 状态；
2. 网络偶发失败 → 红色 toast 已弹但被遮挡；用 ✏️ 编辑入口手动改 `is_enabled` 验证后端是否可用。

## G. Required Tools 缺失但 SubAgent 仍能启动

这是 **预期行为（fail-soft）**。后端日志会写：

```
skills_injector_unresolved_refs owner_id=... missing=[...]
```

或在 SubAgent 启动时记录工具差异。当前 Phase 1 不阻塞 SubAgent 启动；如需严格模式，等 Phase 2。

## H. 删除 Skill 后 SubAgent 系统 prompt 仍引用旧 Skill

**根因**：60s 缓存（同 D）。

**处置**：等 60s 或 PATCH SubAgent 触发 cache invalidation。

## I. E2E 测试失败：`getByRole("alert")` 多元素冲突

**根因**：Next.js 自带 `__next-route-announcer__` 也带 `role="alert"`。

**处置**：用 `getByText("...")` 或加自定义 `data-testid` 锚定。

---

## 参考

- 上手 → [`skills-basics.md`](./skills-basics.md)
- 进阶 → [`skills-advanced.md`](./skills-advanced.md)
- 原理与架构 → [`../skills.md`](../skills.md)
- 浏览器验证协议 → [`../agents/browser-validation.md`](../agents/browser-validation.md)
- Issue 追踪 → [`../issue.md`](../issue.md)（搜索 Skills / ISSUE-045）
