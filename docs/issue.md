# Issues 摘要

> 用于跨上下文留存问题处理经验，避免重复踩坑。新条目追加在末尾，同 Issue 只维护一处。
>
> 每条摘要包含：**表因 / 根因 / 处理方式 / 后续防范 / 同类问题影响**。

---

## ISSUE-001 Catalog 页空状态隐藏「添加根节点」入口

- **表因**：用户在 `/knowledge/catalog` 选中 Corpus 后，页面始终显示「暂无目录节点」，没有任何可点击的创建入口，陷入死胡同。
- **根因**：`apps/negentropy-ui/app/knowledge/catalog/_components/CatalogTree.tsx` 对 `nodes.length === 0` 进行了 early return，把「添加根节点」按钮与空态占位耦合在同一分支渲染，空态直接吞掉了主操作。
- **处理方式**：将操作区（`添加根节点` 按钮）拆为常驻 DOM，空态仅负责展示文案；同时让「添加子节点」hover 可见、事件 `stopPropagation` 与节点选中解耦。
- **后续防范**：UI 空态绝不允许隐藏“唯一可用主动作”。任何 early return 分支在评审时必须明确核对“有没有误伤用户入口”。
- **同类问题影响**：所有「列表 + 主动作」页面（Documents、Corpus、Wiki Publications 等）都需按此模式复核。

---

## ISSUE-002 `sync_entries_from_catalog` 死代码 + 契约缺口

- **表因**：Wiki 管理侧无法将 Catalog 已编撰的目录结构同步到 Publication；即使手工调用也丢失层级、索引顺序与首页标记。
- **根因**：
  1. `apps/negentropy/src/negentropy/knowledge/wiki_service.py` 的 sync 方法**不递归子树**、**不写 `entry_order`**、**无 Markdown 就绪校验**、**slug 冲突直接 `IntegrityError`**；
  2. `api.py` **未暴露** HTTP 端点，方法沦为事实上的死代码；
  3. `WikiDao.get_nav_tree` 仅返回扁平列表，前端无法还原层级。
- **处理方式**：
  1. 重写 `sync_entries_from_catalog`：递归 subtree、Materialized Path 输出 `entry_order` JSON 数组、校验 `markdown_extract_status == "completed"`、slug 冲突递增兜底（`-2`/`-3`/...）、幂等清理未覆盖的既有条目并返回 `{synced_count, removed_count, errors}`；
  2. `errors` 采用规范化前缀：`skip:<doc_id>:markdown_not_ready` / `skip:<doc_id>:no_content` / `renamed:<doc_id>:<old>→<new>`；
  3. 新增 `POST /knowledge/wiki/publications/{pub_id}/sync-from-catalog` 端点，使用 `async with AsyncSessionLocal() as db:` 对齐既有 Wiki 端点风格；
  4. `get_nav_tree` 改嵌套结构，为“仅因层级合成”的容器节点保留 `entry_id is None`（前端据此渲染不可点击的分组标题）。
- **后续防范**：
  1. Service 方法若长期未被 API 或调度链路消费，需在评审中显式标注 `# TODO: expose-later` 或直接删除，避免“看似完备、实则死代码”的虚假安全感；
  2. 契约型方法（sync / migrate / rebuild）必须配合端点 + 单元测试一并落地；
  3. 批量写入路径必须主动做“已用 key 集合”的冲突兜底，不能寄希望于 DB 约束直接抛错。
- **同类问题影响**：其它 `*_service.py` 中未被 `api.py` 调用的“契约型方法”需要同步排查是否同样沦为死代码。

---

## ISSUE-003 SSG 路由不支持层级 slug

- **表因**：Wiki 文档页 URL 含 `/`（如 `/docs/engineering/architecture/overview`）时，`negentropy-wiki` SSG 渲染 404。
- **根因**：`apps/negentropy-wiki/src/app/[pubSlug]/[entrySlug]/page.tsx` 使用单段动态路由，`entry_slug` 中的 `/` 被 Next.js 视作路径分隔符，无法命中单段参数。
- **处理方式**：
  1. 路由目录迁移为 catch-all：`[pubSlug]/[entrySlug]` → `[pubSlug]/[...entrySlug]`；
  2. `generateStaticParams` 把每个 entry 的 slug 按 `/` 分段：`entrySlug: entry.entry_slug.split("/")`；
  3. 页面通过 `const slug = Array.isArray(entrySlug) ? entrySlug.join("/") : entrySlug;` 还原查询键；
  4. 链接侧直接 `<Link href={`/${pubSlug}/${entry_slug}`}>`，浏览器会自动按 `/` 分段为 catch-all。
- **后续防范**：引入“层级化 URL”设计时，必须率先确认路由模式为 catch-all；包含 Materialized Path 的字段需有明确约定（`/` 作为层级分隔符而非字面量）。
- **同类问题影响**：其他 SSG 页面（如未来可能的 `/docs/[...path]`、`/blog/[...slug]` 等）若引入嵌套 slug，需同步审阅路由段形态。

---

## ISSUE-004 Frontend slug 字符集与后端正则不一致

- **表因**：用户以中文名创建 Catalog 节点后，前端生成的 slug 含中文字符，同步到 Wiki 时后端正则 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 拒收，整次 sync 报错。
- **根因**：`CreateNodeDialog.tsx` 的 `slugify()` 最初保留了 `\u4e00-\u9fff`（中文 Unicode 段），与 `wiki_service.py` 仅接收 ASCII 的约束矛盾。
- **处理方式**：前端 `slugify()` 统一为 ASCII-only：`[^a-z0-9]+ → "-"`；若结果为空则回退 `untitled`，UI 提示用户可手动覆盖。
- **后续防范**：当前后端对同一语义字段有独立正则时，需建立“契约一致性测试”或在 `schemas` 中提炼共享常量，防止双端漂移。
- **同类问题影响**：所有前端 slug/id 生成点（Publication、Entry、Node、Corpus）都需对齐统一字符集。

---

## ISSUE-005 废弃端口守护成为熵源

- **表因**：用户反馈「Google Auth 回调仍指向 `http://localhost:6600/auth/google/callback`」，怀疑本轮 PR 把后端端口从 `:3292` 回退到 `:6600`。
- **根因**：项目早期完成 `:6600` / `:6666` → `:3292` 迁移时，为保兼容在 `apps/negentropy-ui/lib/server/backend-url.ts` 引入 `applyLegacyPortMigration()`（localhost 自动改写 + 一次性告警），并在 `.env.example` / `docs/development.md` / `tests/unit/lib/server/backend-url.test.ts` 多处留存「历史端口会被自动迁移」的文案与白名单。迁移已完成数月，守护机制却仍让 `6600` 作为「合法白名单值」持续循环出现，与真正的配置残留（本地 `.env` / Google Cloud Console OAuth 授权重定向 URI 白名单）互相掩盖，形成典型「熵增陷阱」。经 `git log` 取证本轮 PR 的 7 个 commits 均未改动端口/回调/API_BASE 配置——用户看到的 `:6600` 实为环境侧残留，而非代码回退。
- **处理方式**：
  1. 彻底删除 `LEGACY_LOCAL_PORTS` / `applyLegacyPortMigration` / `isLegacyLocalhostUrl` / `__resetLegacyPortWarningsForTests` / `LOCAL_HOSTS` / `CURRENT_BACKEND_PORT` / `warnedUrls` 及配套的 `pickFirstNonEmpty` 辅助；`backend-url.ts` 精简为纯 SSOT（约 50 行）；
  2. 对应测试从 ~180 行精简至 ~95 行，仅保留「默认值」「优先级链」两组用例；
  3. `.env.example` 删除 2 行迁移守护注释；`docs/development.md` 删除整段「迁移守护」block quote；
  4. `docs/sso.md` 保留一行运维提示，指引同步更新本地 `.env` 与 Google Cloud Console OAuth 授权重定向 URI 白名单；
  5. CHANGELOG.md 在 `### Removed` 段落登记，与 Keep a Changelog 语义对齐。
- **后续防范**：
  1. 兼容层 / 守护层**必须**附带「退役期」——提前约定「迁移完成 N 版本后强制删除」，避免守护永久化沉淀为熵源；
  2. 废弃值本身即为熵源，不要以「测试夹具需要断言」为由保留白名单常量；
  3. 配置迁移完成时，CHANGELOG 须同步登记「守护退役」，而非只记录「迁移完成」；
  4. 线上故障排查先分清「代码层残留」与「环境层残留」再下判断——前者 `git log` / `git show` 可证伪，后者需检查本地 `.env` 与第三方控制台（Google Cloud Console、Auth0、AWS Cognito 等）。
- **同类问题影响**：所有「兼容旧值的运行时守护」（legacy API path 兼容、旧协议字段映射、deprecated flag 转译、历史 DB 列回退读取）都应按相同原则审视，不要在完成迁移后继续保留。

---
