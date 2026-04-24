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

## ISSUE-006 Knowledge / Memory 未登录引导页 Dark Mode 失效

- **表因**：未登录用户访问 `/knowledge/*`、`/memory/*` 时，展示的「需要登录以继续」引导页始终以亮色渲染（背景 `zinc-50`、标题黑字），即使站点 / 系统已切 Dark Mode；而 Home（`/`）页面同款引导在暗色下表现正常，整站风格割裂。
- **根因**：`apps/negentropy-ui/components/providers/AuthGuard.tsx` 的 `loading` 与 `unauthenticated` 两个分支硬编码 `bg-zinc-50` / `text-zinc-900` / `text-zinc-500` / `bg-black text-white` 等仅亮色 Tailwind 类，**未提供任何 `dark:` 变体**；Home 页 `app/page.tsx` L34–65 承载的同款引导却已补齐 `dark:bg-zinc-950` / `dark:text-zinc-400` / `dark:text-zinc-100` / `dark:bg-white dark:text-black`——两处 UI 形成事实上的双源漂移。Tailwind v4 `@variant dark (&:where(.dark, .dark *))` + `next-themes` `attribute="class"` 主题链路（`app/layout.tsx` L33–49、`app/globals.css` L2 / L73–93）本身正常，`AuthGuard` 的硬编码浅色类「截流」了 `.dark` cascade。Knowledge / Memory 仅通过各自的 `layout.tsx` 将子路由包裹进 `AuthGuard`，因此症状在该两个 section 必现、在不走 `AuthGuard` 的 Home / Admin / Interface / Settings 等处不可见。
- **处理方式**：在 `AuthGuard.tsx` 两个分支补齐 6 处 `dark:` 变体（loading 容器 `dark:bg-zinc-950 dark:text-zinc-400`；unauth 容器 `dark:bg-zinc-950`；eyebrow / 副文案 `dark:text-zinc-400`；主标题 `dark:text-zinc-100`；登录按钮 `dark:bg-white dark:text-black dark:hover:bg-zinc-200`），语义与 Home 页 `app/page.tsx` 逐字对齐；`app/knowledge/layout.tsx` / `app/memory/layout.tsx` 调用点零改动，已登录路径 `return <>{children}</>` 完全不受影响。
- **后续防范**：
  1. **路由级登录墙 UI 必须覆盖 Dark Mode**：所有 auth 守卫、empty state、error boundary 等「脱离业务内容树」的全屏渲染组件，CR 必须检查是否有 `dark:` 变体与根布局 `bg-zinc-50 dark:bg-zinc-950` 语义一致；
  2. **双源 UI 即是熵源**：`AuthGuard` 未登录分支与 Home 页未登录引导已完全重复，后续应抽取 `<LoginPrompt />` 共享组件（AGENTS.md「Reuse-Driven / Single Source of Truth」），避免后续再出现「一处修了另一处没修」的主题 / 文案漂移；
  3. 新增或复制「全屏容器」类组件时，优先从既有正确样例（如 `app/page.tsx`）拷贝类名而非从零写起，降低遗漏 `dark:` 的概率。
- **同类问题影响**：所有未走根布局 body 背景级联、而是以「全屏 fixed / `h-screen` 容器 + 自绘背景」方式渲染的组件（`AuthGuard`、潜在的 `ErrorBoundary` 全屏态、`MaintenancePage`、`UpgradeRequiredGate` 等）都应按相同原则复核；Tailwind v4 `@variant dark` 仅解决「可级联的 token」，对硬编码的 `bg-*` / `text-*` 字面量无能为力——这是 Tailwind 一直以来的「显式优于隐式」契约，不是 bug，而是编写规范问题。

---

## ISSUE-007 Catalog / Wiki BFF 代理上游前缀缺失导致 404

- **表因**：用户在 `/knowledge/catalog` 页选中 Corpus、点击「添加根节点」，填写 name 后点「创建」，前端弹出 `Failed to create catalog node: Not Found`；网络面板显示 `POST /api/knowledge/catalog` 的上游响应 `{"detail":"Not Found"}`。同批次 Wiki 新建发布 / 发布详情 CRUD / publish / unpublish / 条目列表 / Nav Tree / sync-from-catalog / entry content 亦全链路不可用，但此前因 Catalog 空态隐藏按钮（ISSUE-001 已修）、Wiki 列表零态等表现被噪声掩盖，未被发现。
- **根因**：`apps/negentropy-ui/app/api/knowledge/` 下 Catalog（5 个文件）+ Wiki（8 个文件）共 **13 个 BFF 代理** 的 `path` 参数误写为不含 `/knowledge` 前缀的裸路径（如 `/catalog/nodes`、`` `/wiki/publications/${pubId}/publish` ``）。`knowledge/_proxy.ts` 的 `new URL(path, baseUrl)` 仅拼接 baseUrl 与 path，**不在代理层补前缀**；而后端 `knowledge_router` 由 `APIRouter(prefix="/knowledge")` 声明、`engine/bootstrap.py` 以 `app.include_router(knowledge_router)`（不加额外 prefix）挂载，真实路由为 `/knowledge/catalog/**` / `/knowledge/wiki/**`——于是代理转发落到 `/catalog/**` / `/wiki/**`，直接被 FastAPI 404。对照 Memory 域 14 条、Interface 域 22 条、Knowledge 域既有 17 条（`base/*` / `dashboard` / `documents` / `graph` / `pipelines` / `stats` / `search`）全部遵循「path 自带域前缀」的跨域约定，本批漂移完全孤立，属于早期新建代理路由时复制粘贴自后端函数装饰器（`@router.post("/catalog/nodes")`）而漏写父级 prefix。**二阶不一致**：后端 `create_catalog_node(body: _CatalogNodeCreateReq, corpus_id: UUID = Query(...))` 将 `corpus_id` 声明为 Query 参数，`_CatalogNodeCreateReq` body schema 不含此字段；而前端 `features/knowledge/utils/knowledge-api.ts::createCatalogNode()` 把 `corpus_id` 和其它字段一起塞进 body——即使路径前缀修复，后端也会因缺失 query 参数返回 422。**三阶跨域不对称**：Knowledge / Memory / Interface 三个 `_proxy.ts` 的 `proxyGet` / `proxyDelete` / `proxyGetBinary` 都显式转发 `new URL(request.url).search` 至上游，但 `proxyPost` / `proxyPostFormData` / `proxyPatch` 全部遗漏该步骤（三域共 6 处缺失）——此前 3 域从未出现「POST/PATCH + Query 参数」组合，故该缺陷潜伏至今；`createCatalogNode` 改走 query 后立即将其暴露（新增集成测试的第一轮运行即命中）。
- **处理方式**：
  1. 批量补齐 13 处 `path` 参数为含 `/knowledge` 前缀的绝对路径（`/catalog/nodes` → `/knowledge/catalog/nodes` 等），与 Memory/Interface 域及 Knowledge 域既有 17 条正确路由 100% 同构；
  2. 改造 `createCatalogNode`：解构 `corpus_id` 到 `URLSearchParams` 构造 query string，剩余字段保留在 body，`fetch` URL 改为 `/api/knowledge/catalog?corpus_id=...`，对齐后端 Pydantic/FastAPI 契约；调用点 `CreateNodeDialog.tsx` 零改动（`CreateCatalogNodeParams` 入参形状不变）；
  3. 在 `apps/negentropy-ui/app/api/knowledge/_proxy.ts` 顶部沉淀 SSOT 约定头注释，明确「所有 `path` 参数必须含 `/knowledge` 前缀」，列出正反例并指向 Memory / Interface 同构参考；
  4. 在 Knowledge / Memory / Interface 三域 `_proxy.ts` 的 `proxyPost` / `proxyPostFormData` / `proxyPatch` 中补齐 `upstreamUrl.search = new URL(request.url).search`（共 6 处），与同域 `proxyGet` / `proxyDelete` / `proxyGetBinary` 结构对称；空 search 恒等 no-op，对任何既有调用零影响；
  5. 新增 `apps/negentropy-ui/tests/integration/knowledge-catalog-route.test.ts` mock-fetch 集成单测，断言 `POST` 上游落到 `http://localhost:3292/knowledge/catalog/nodes?corpus_id=<uuid>`（覆盖「路径前缀」与「search 转发」两条回归主线），并断言 404 错误体透传。
- **后续防范**：
  1. **建立 BFF 代理契约单测模板**：每个 `app/api/<domain>/**/route.ts` 至少一个 mock-fetch 单测断言上游 URL 精确形状（参考 `knowledge-stats-route.test.ts` / 本次新增的 `knowledge-catalog-route.test.ts`），把「路径漂移」这一类低级错误前移到 CI，Memory / Interface / Knowledge 三域均需覆盖；
  2. **前后端共享契约优先**：后端参数位置（body vs query vs path）与前端 API 客户端须严格对齐 FastAPI 函数签名这一唯一 SSOT，CR 时若见 `Query(...)` 类注解，同步检查调用侧；
  3. **新增代理路由时对照既有正确样例**：复制 `knowledge/documents/route.ts` / `base/route.ts` 这类已落地正确模板，不要从后端装饰器的 `@router.post("/...")` 逆推（后端 `APIRouter.prefix` 与端点 `path` 是分离的两段，裸看装饰器会遗漏前缀）；
  4. **禁止仅以「列表零态」掩盖 API 故障**：`fetchCatalogTree` / `fetchWikiPublications` 这类在数据为空时早退的函数，需在网络层把真正的 404/422 错误暴露到 UI 提示层（toast / inline banner），避免「页面看起来一切正常，实际后端完全不通」的症状潜伏期拉长。
- **同类问题影响**：
  1. 可选的「BFF 代理 SSOT 重构」——把 `/<domain>` 前缀内化到 `_proxy.ts`、让 path 参数只写 `/catalog/...` / `/wiki/...` / `/memory/...`；但需跨 3 域（Memory 14 / Interface 22 / Knowledge 30）同步推进，爆炸半径大，建议作为专题 issue；短期以头注释 + 契约单测守护即可；
  2. `fetchCatalogNodes` 与对应的 `GET /api/knowledge/catalog` 代理目前无调用方（`features/knowledge/index.ts` 仅 re-export），且后端不存在 `GET /knowledge/catalog/nodes` 端点（仅提供 `GET /knowledge/catalog/tree/{corpus_id}` 与 `GET /knowledge/catalog/subtree/{node_id}`），属于死导出；下一轮梳理时可删除或补后端分页列表端点，本次不扩大爆炸半径。

---

## ISSUE-008 python-dotenv 跨设备符号链接覆盖（CVE-2026-28684）告警

- **表因**：GitHub Dependabot 报告 Alert #87（[GHSA-mf9w-mj56-hr94](https://github.com/advisories/GHSA-mf9w-mj56-hr94) / [CVE-2026-28684](https://nvd.nist.gov/vuln/detail/CVE-2026-28684)，CVSS 3.1 = 6.6 Medium，CWE-59/61），受影响 manifest 为 `apps/negentropy/uv.lock` 中锁定的 `python-dotenv==1.2.1`。
- **根因**：上游 `dotenv/main.py::rewrite()` 在 `set_key()` / `unset_key()` 中先写 `/tmp` 临时文件再 `shutil.move()` 替换 `.env`；当 `/tmp` 与目标位于不同设备（Linux tmpfs 常态）时，`os.rename()` 失败回退到 `shutil.copy2()`（`follow_symlinks=True`），若 `.env` 是攻击者预置的符号链接，会**沿链接**写入真实目标文件，导致任意可写文件被 `.env` 格式内容覆盖；确定性触发，无需竞态。本仓库 `python-dotenv` 为**间接依赖**（`pydantic-settings` / `litellm` / `microsandbox` 传递引入），且 `grep -rn 'set_key|unset_key|from dotenv|import dotenv' apps/negentropy` 全仓零命中——实际利用面极小，但告警信号需闭合以维持 Security 面板基线。
- **处理方式**：
  1. `apps/negentropy` 工作目录执行 `uv lock --upgrade-package python-dotenv`，将锁文件中 `python-dotenv` 由 `1.2.1` → `1.2.2`（上游已在 1.2.2 中改为 `os.replace()` + 同目录临时文件 + 默认 `follow_symlinks=False`），仅锁文件三行 hash/版本变更；
  2. `uv lock --dry-run --upgrade-package python-dotenv` 预演证实零级联漂移，`uv sync --locked` 与 `importlib.metadata.version('python-dotenv')` 双向印证运行期落盘 1.2.2；
  3. 不新增 `python-dotenv` 为 `apps/negentropy/pyproject.toml` 直接依赖——约束由 `pydantic-settings>=2.12.0`（要求 `python-dotenv>=0.21`）传递满足，违反「最小干预」原则且徒增维护面。
- **后续防范**：
  1. **Dependabot 告警「间接依赖」的统一处理范式**：优先走锁文件 `uv lock --upgrade-package <name>` 单包定点升级，避免 `uv lock --upgrade` 引发的大范围漂移；验证闭环为 dry-run → sync → 运行期 `importlib.metadata.version` 三重交叉；
  2. **Negative Prompt**：严禁把本仓库未调用的间接依赖「提级」为直接依赖来绕过告警——上游 patch 版本升级才是唯一正解；
  3. **Defense in depth**：仓库中若未来引入 `dotenv.set_key` / `unset_key` 调用，须显式传 `follow_symlinks=False`（1.2.2 已是默认），并在 CR 中检查 `.env` 写入路径是否位于用户可控目录。
- **同类问题影响**：
  1. 所有「通过 `uv.lock` 传递锁定」的 pip 生态告警均可复用该范式；同类间接依赖 patch 升级应优先锁文件单包路径；
  2. `apps/negentropy/uv.lock` 中 `pydantic-settings` / `litellm` / `microsandbox` 是 `python-dotenv` 的上游引用方，未来若需进一步约束可在 pyproject 中加 `"python-dotenv>=1.2.2"` 作为安全下限（本次不做，等 Dependabot 后续再触发时再评估）；
  3. 对于**被项目代码直接调用**的安全告警（非本次形态），除锁文件升级外还需审计调用点语义是否需要补充 hardening 参数（如本 CVE 的 `follow_symlinks=False`）。

---

## ISSUE-009 Catalog 创建日志覆写 `LogRecord.name` 导致 500

- **表因**：用户在 `/knowledge/catalog` 创建目录节点时，接口返回 `{"error":{"code":"KNOWLEDGE_UPSTREAM_ERROR","message":"Internal Server Error"}}`，Uvicorn 堆栈落到 `CatalogDao.create_node()` 的 `logger.info("catalog_node_created", extra=...)`。
- **根因**：`apps/negentropy/src/negentropy/knowledge/catalog_dao.py` 直接使用标准库 `logging.getLogger(...)`，其 `extra` 会写入 `logging.LogRecord`；代码把业务字段 `name` 放进 `extra`，与 `LogRecord.name` 保留属性冲突，Python 直接抛出 `KeyError: "Attempt to overwrite 'name' in LogRecord"`。业务写库本身无误，真正把链路打断的是日志副作用。
- **处理方式**：
  1. 保持事件名 `catalog_node_created` 不变，仅将 `extra["name"]` 重命名为 `extra["node_name"]`，避免触碰标准库保留键；
  2. 在 `apps/negentropy/tests/unit_tests/knowledge/test_catalog_dao_unit.py` 新增回归测试，断言创建节点时日志上下文字段使用 `node_name`，且不再出现 `name`；
  3. 维持 DAO / Service / API 其它行为不变，不扩大为整域日志改造。
- **后续防范**：
  1. 只要仍在使用 stdlib logging，`extra` 一律禁止使用 `name`、`msg`、`args`、`levelname`、`pathname` 等 `LogRecord` 保留键；
  2. 结构化日志字段应优先使用业务语义前缀命名，如 `node_name`、`publication_name`、`corpus_name`，避免与 logging 框架元数据碰撞；
  3. 新增 DAO/Repository 日志时，应配套最小回归测试，优先验证“日志不会破坏主流程”这一非功能性约束。
- **同类问题影响**：
  1. `apps/negentropy/src/negentropy/knowledge/wiki_dao.py` 当前也存在 `extra["name"]` 用法，虽然暂未触发用户路径故障，但属于同型风险，后续应并入日志治理专题排查；
  2. 任何混用 `structlog` 与标准库 `logging` 的模块，都不能假设 `extra` 是“任意字典”，需明确区分框架保留键与业务键。

---

## ISSUE-010 KnowledgeDocument 文件名字段漂移导致 Catalog / Wiki 500

- **表因**：用户在 Catalog 中执行「添加文档 -> 分配」后，拉取节点文档列表接口报 `Failed to fetch node documents: Internal Server Error`；同时 Wiki 相关同步/内容读取链路存在潜在同型崩溃。
- **根因**：`KnowledgeDocument` 模型真实字段为 `original_filename`，但 `apps/negentropy/src/negentropy/knowledge/api.py`、`wiki_service.py`、`wiki_dao.py` 中仍残留历史字段 `doc.filename` / `KnowledgeDocument.filename`。这类字段漂移在运行时直接触发 `AttributeError`，属于典型“响应层/派生层引用已废弃属性”问题；同批扫描还发现 `wiki_dao.py`、`kg_entity_service.py` 继续使用 stdlib logging 的 `extra[\"name\"]`，存在与 ISSUE-009 同源的日志保留字段冲突风险。
- **处理方式**：
  1. 统一以 `KnowledgeDocument.original_filename` 作为唯一后端文件名事实源，修正 Catalog 文档列表、Document Provenance、Wiki 条目内容、Wiki 从 Catalog 同步时的 slug/title 推导；
  2. 保持外部响应中的 `filename` 字段名不变，只修正其来源，避免破坏前端契约；
  3. 顺手将 `wiki_dao.py` / `kg_entity_service.py` 的日志上下文字段 `name` 改为 `publication_name` / `entity_name`，闭合同型日志风险；
  4. 补充 API / Wiki / KG 单测，确保“字段映射正确”与“日志不破坏主流程”两类回归都能在 CI 中暴露。
- **后续防范**：
  1. ORM 模型字段一旦重命名，所有 API 序列化层、DAO 查询投影、Service 派生逻辑必须同步走一次全局 grep 审计，不能只改写入路径；
  2. 对外返回的 `filename` 这类展示字段应明确标注其内部来源（如 `original_filename`），避免“接口名未变、模型字段已变”造成双源认知；
  3. stdlib logging 的 `extra` 业务键继续禁止使用 `name`，与 ISSUE-009 的防线保持一致。
- **同类问题影响**：
  1. Catalog / Wiki 之外，任何直接读取 `KnowledgeDocument` 属性的 provenance、export、render、sync 路径都需优先检查是否误用了 `filename`；
  2. 这类问题具有”写路径正常、读路径崩溃”的二阶特征，UI 上常表现为操作成功后刷新列表/详情时才报错，排查时应优先检查响应序列化逻辑而非数据库写入。

---

## ISSUE-011 Catalog 全局化三阶段重构（corpus_id → catalog_id 解耦）

- **表因**：用户无法将来自不同 Corpus 的文档聚合到同一个 Catalog 目录；Wiki Publication 的可见范围被迫限制在单 Corpus 内，无法发布跨 Corpus 内容。
- **根因**：`doc_catalog_nodes.corpus_id NOT NULL` 将 **Catalog（人类可读组织视图）** 与 **Corpus（存储/检索单元）** 强绑定，违反 Orthogonal Decomposition（正交分解）原则：
  - Corpus 的职责是 embedding / 检索 / 存储隔离；
  - Catalog 的职责是文档的人工组织（类 MediaWiki Category N:M）；
  - Publication 的职责是将目录发布为面向用户的站点（类 GitBook Site）。
  三层被压缩到一根外键，导致 Catalog 无法跨 Corpus 聚合文档，所有下游（Wiki sync、前端 tree、BFF 路由）也随之错位。
- **处理方式**（三阶段原子化迁移，commits `ebe5a91`–`59be678`）：
  1. **Phase 1 / Revision 0003**：新建 `doc_catalogs`（全局顶层实体）、`doc_catalog_entries`（N:M 关联 + 树结构）、`wiki_publication_snapshots` 骨架，纯加法无锁；
  2. **Phase 2 / Revision 0004**：Chunked backfill（500 行/批）将 `doc_catalog_nodes` 平移到 `doc_catalog_entries`；回填 `wiki_publications.catalog_id` 与 `app_name`；
  3. **Phase 3 / Revision 0005**：施加 `NOT NULL` 约束、`UNIQUE(catalog_id, slug)`；DROP `doc_catalog_nodes` / `doc_catalog_memberships` / `wiki_publications.corpus_id`；含 downgrade 守卫（跨 corpus catalog 存在时拒绝降级）；
  4. **ORM / DAO / Service / API**：`WikiPublication.corpus_id` → `catalog_id`；`CatalogDao.create_node/get_tree` 改用 `catalog_id`；`catalog_service.assign_document` 强制断言 `document.corpus.app_name == catalog.app_name`（违反抛 `PermissionError(“cross-app assignment forbidden”)`）；
  5. **前端 / BFF / Wiki SSG**：`corpusId` → `catalogId` 全链路替换；BFF 13 条代理路由更新；`WikiPublication.catalog_id` 对齐；
  6. **测试**：新增 `test_catalog_cross_corpus.py`（跨 app 权限）、`test_wiki_publish_modes.py`（发布生命周期）、`test_catalog_tree_perf.py`（P99 基线）。
- **后续防范**：
  1. `DocCatalog.app_name` 字段通过数据库约束 + Service 层双重防护确保创建后不可变；不可通过普通 API 修改，需走专用 migration 端点并触发级联校验；
  2. `assign_document` 入口的跨 app 拦截是三级权限取交集的第一道闸；任何绕过此入口的直接 DAO 写入都属于权限放大，严禁；
  3. Migration downgrade 守卫应对所有”新旧语义不可对称映射”的 Revision 标准化——检测到不可逆状态时 `raise RuntimeError`，而非静默回滚；
  4. Phase 2 chunked backfill 的 `sleep(100ms)` 节奏需在高负载窗口前确认，避免长事务与 autovacuum 竞争；
  5. 前端所有「以 `corpusId` 作为前置条件」的 Hook/Selector 替换应配套 BFF 路由同步更新，参考 ISSUE-007 13 条路由的教训，改动后必须跑 `pnpm build` 验证。
- **同类问题影响**：
  1. 任何 `X_id NOT NULL` 强绑定导致多个关注点（concern）共享同一外键的模式，都是 Orthogonal Decomposition 的破坏信号；排查时看「能否在不修改 A 的情况下独立演进 B」，不能则解耦；
  2. `wiki_dao.py` 中仍有若干基于 `corpus_id` 的遗留查询路径（如 `get_publication_by_slug` 的兜底逻辑），需在后续 corpus 完全退出 Wiki 链路后一并清理；
  3. RAG 检索侧 `retrieval.search(catalog_ids=...)` 增量参数已在架构规划中定义，但未在本次 commits 中完整落地，后续补齐时参考 `catalog_dao.get_document_nodes` 的 backlink 查询路径。

---

## ISSUE-012 Alembic 0005 downgrade 在 PG 枚举列上直接调用 `LOWER()` 及回填 DOCUMENT_REF 时未守护父节点存在性

- **表因**：执行 `uv run alembic downgrade base` 从 Revision `0005` 回退到 `0004` 时，PostgreSQL 直接抛 `asyncpg.exceptions.UndefinedFunctionError: function lower(negentropy.catalogentrynodetype) does not exist` 并在加上显式 cast 后紧随其后暴露 `asyncpg.exceptions.ForeignKeyViolationError: insert or update on table "doc_catalog_memberships" violates foreign key constraint "doc_catalog_memberships_catalog_node_id_fkey"`；两者使 Catalog 全局化 Phase 3 的 downgrade 路径事实上不可逆，集成测试 `tests/integration_tests/db/test_migrations.py::test_migrations_stairway` 同步红。
- **根因**：
  1. **PG `LOWER()` 无枚举重载**：`doc_catalog_entries.node_type` 在 Revision 0003 建为原生枚举 `negentropy.catalogentrynodetype`；0005 downgrade 在反向回填 legacy `doc_catalog_nodes` 时写了 `LOWER(e.node_type)`。PostgreSQL 的 `lower(text)`/`upper(text)` 等 text-only 标量函数**不存在枚举重载**，而 `=` / `IN` 的隐式 text 强制转换仅限比较运算、**不适用于函数调用**——在 prepare/plan 阶段即失败，即使 `doc_catalog_entries` 为空也会触发。此外 legacy `doc_catalog_nodes.node_type` 为 `VARCHAR(20) NOT NULL DEFAULT 'category'`，与枚举存在根本类型错配，语义上需要 enum → text 显式 cast；
  2. **Phase 3 后新增了 legacy 无法表达的前向语义**：0004 upgrade 的 1:1 映射假设「DOCUMENT_REF 的 `parent_entry_id` 一定指向 CATEGORY/COLLECTION」，但 0005 upgrade DROP legacy 表后，应用层开始允许 DOCUMENT_REF 互为父子（文档嵌套）；downgrade 的 step 3c 回填 memberships 时未与重建的 `doc_catalog_nodes` JOIN，使不可表达的 `parent_entry_id` 穿透 FK 校验。
- **处理方式**：
  1. 在 `apps/negentropy/src/negentropy/db/migrations/versions/0005_catalog_global_phase3_enforce.py:223` 将 `LOWER(e.node_type)` 显式改写为 `LOWER(e.node_type::text)`——与 0004 upgrade `UPPER(n.node_type)::negentropy.catalogentrynodetype` 形成对称 cast 链路（enum ⇌ text）；
  2. 在同文件 step 3c 的 SELECT 上加 `JOIN negentropy.doc_catalog_nodes n ON n.id = e.parent_entry_id`，与 0004 upgrade step 3 的 `membership → node → catalog` 三连 JOIN 严格对称；legacy 无法表达的「DOCUMENT_REF 作为 DOCUMENT_REF 子节点」被显式过滤，与跨 corpus 守卫同构的「不可表达即不可回填」语义保持一致；
  3. ORM 层（`perception.py`、`catalog_dao.py`）、测试、前端、运维脚本零改动——最小干预原则。
- **后续防范**：
  1. 任何在枚举列上调用 text-only 标量函数（`LOWER` / `UPPER` / `INITCAP` / `LENGTH` / `SUBSTRING` 等）的 SQL（无论是迁移还是 DAO / Service 层的 `text()` 拼接）**必须**显式 `::text` cast；review 时搜索 `rg -E "(LOWER|UPPER|INITCAP)\\s*\\(\\s*[a-z_]+\\.[a-z_]*(type|status|visibility|mode)"` 可一网打尽；
  2. 反向回填类 downgrade 的每一个 INSERT…SELECT **必须**与其正向 upgrade 的 JOIN 链路形成结构对称；单方向 JOIN 不对称是「前向语义不可对称映射」的早期信号，应当或补齐 JOIN 过滤、或按现有跨 corpus 守卫样式 `RuntimeError` 拒绝；
  3. `test_migrations_stairway` 的 `upgrade → downgrade → upgrade` 回环测试是本类问题的天然回归闸门——任何修改迁移脚本的 PR 在 CI 中必须跑通该测试，避免仅凭 `upgrade head` 的半程绿误判为成功。
- **同类问题影响**：
  1. 全仓其它 `text()` SQL 拼接中对 `pluginvisibility`、`mcptransporttype`、`catalogentrystatus`、`wikipublishmode`、`wikipublicationvisibility` 等枚举列的字符串化调用都需按同一规则审计；本次仅修复 migrations 命中的两处，无其它站点；
  2. 所有三阶段迁移（add → backfill → enforce）的 Phase 3 downgrade 在 Phase 3 之后出现的「新语义」下都会遭遇「legacy 不可表达」问题——这是由 Phase 3 DROP 老表后应用层演进导致的数据不对称，不是本 bug 独有；新增该类迁移时应预先评估「Phase 3 后会不会出现 legacy 无法表达的前向语义」，若会，则 downgrade 必须显式以守卫（拒绝）或过滤（容忍丢失）二选一地声明语义，杜绝 FK 穿透；
  3. 数据库降级路径属于「灾难演练」类能力，默认应具备「空 DB → 正常 DB → 重度污染 DB」的三级可测性；未来若扩展 corpus / catalog 结构，建议在 `test_migrations_stairway` 外补充一组携带真实类 fixture（含不可表达关系）的回归用例，覆盖非空 DB 路径。

---
