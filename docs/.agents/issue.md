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
- **2026-04-24 回归复盘（见 ISSUE-014）**：当时把「空态隐藏主操作」当作入口缺失修复，将「添加根节点」按钮从「nodes 为空时才显示」改为「恒常可见」——但**未区分 `nodes=[]`（已选 Catalog 且树为空）与 `parent_context=null`（尚未选中 Catalog）这两个正交维度**，致「添加根节点」按钮在未选 Catalog 语境下亦暴露，叠加 URL 模板字符串空段 + Next.js 动态路由归一化的跨组件漂移，两年半后再次以 `405 Method Not Allowed` 的形态复活。**教训**：空态修复必须同时审视所有前置上下文维度（父对象是否存在 / 祖父对象是否选中 / 权限是否足够），不能把「数据为空」与「上下文缺失」合并为同一分支。

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
- **根因**：项目早期完成 `:6600` / `:6666` → `:3292` 迁移时，为保兼容在 `apps/negentropy-ui/lib/server/backend-url.ts` 引入 `applyLegacyPortMigration()`（localhost 自动改写 + 一次性告警），并在 `.env.example` / `docs/architecture/development.md` / `tests/unit/lib/server/backend-url.test.ts` 多处留存「历史端口会被自动迁移」的文案与白名单。迁移已完成数月，守护机制却仍让 `6600` 作为「合法白名单值」持续循环出现，与真正的配置残留（本地 `.env` / Google Cloud Console OAuth 授权重定向 URI 白名单）互相掩盖，形成典型「熵增陷阱」。经 `git log` 取证本轮 PR 的 7 个 commits 均未改动端口/回调/API_BASE 配置——用户看到的 `:6600` 实为环境侧残留，而非代码回退。
- **处理方式**：
  1. 彻底删除 `LEGACY_LOCAL_PORTS` / `applyLegacyPortMigration` / `isLegacyLocalhostUrl` / `__resetLegacyPortWarningsForTests` / `LOCAL_HOSTS` / `CURRENT_BACKEND_PORT` / `warnedUrls` 及配套的 `pickFirstNonEmpty` 辅助；`backend-url.ts` 精简为纯 SSOT（约 50 行）；
  2. 对应测试从 ~180 行精简至 ~95 行，仅保留「默认值」「优先级链」两组用例；
  3. `.env.example` 删除 2 行迁移守护注释；`docs/architecture/development.md` 删除整段「迁移守护」block quote；
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
  3. **2026-04-24 回归事件**：Phase 3 `/catalogs/*` RESTful 路由补齐（commit `3b88bec`）以内联 dict 构造 document list 响应（`knowledge/api.py` 中 `get_catalog_documents` 与 `get_entry_documents` 两处），再次偏离 ISSUE-010 原修复，UI 观测症状为 Catalog「添加文档到节点」对话框只显示 1 条且文件名为空、节点「归属文档 (N)」常显 0。除字段漂移外，`get_catalog_documents` 更把「候选文档」错写为「已归属文档」查询，属语义级回归；`get_entry_documents` 响应外壳键从约定的 `documents` 漂成 `items`。**强制复用规则**：所有返回 `KnowledgeDocument` 或其列表的端点，必须复用 `_build_document_response()` + `DocumentResponse` pydantic schema；严禁在 route handler 内以内联 dict 构造 document 响应。后续 CI 可加 AST 静态检查：`knowledge/api.py` 中不允许出现 `"filename":` / `"file_hash":` 等裸字面量键作为 `KnowledgeDocument` 序列化入口。此外，「候选文档 / 已归属文档」属正交概念，任何新端点的语义应在 docstring 首行与前端调用方 JSDoc 双向锚定，防止下次再次倒置。

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

## ISSUE-013 新建 Corpus 的 Document Extraction Settings 下拉全部未配置（预置 MCP Tools 未与 Server 对称落地）

- **表因**：用户在 `/knowledge/base` 点击「创建」新建 Corpus 后，进入 Settings Tab 的 **Document Extraction Settings** 面板，**URL 文档** 与 **PDF 文档** 的主/备下拉框全部显示「未配置」；预期应当预置 4 个默认 MCP 工具 `parse_webpage_to_markdown` / `parse_webpages_to_markdown` / `parse_pdf_to_markdown` / `parse_pdfs_to_markdown`（均来自 `negentropy-perceives` MCP Server）。后端日志中仅能看到重复的 `knowledge_default_extractor_tool_not_found` WARN，接口 200 成功但 `config.extractor_routes.{url,file_pdf}.targets = []`。
- **根因**：**预置数据与依赖它的应用逻辑未对称交付**，链路共四层，前三层都正确：
  1. **配置层（正确）**：`apps/negentropy/src/negentropy/config/knowledge.py:28-58` 已定义 `DefaultExtractorRoutesSettings` Pydantic 模型，内含 4 个 `(server_name, tool_name)` 对（URL 60s/120s、PDF 300s/600s）；
  2. **API 层（正确）**：`apps/negentropy/src/negentropy/knowledge/api.py:682-703` 的 `create_corpus()` 在请求未显式传入 `extractor_routes` 时调用 `_resolve_default_extractor_routes()`；
  3. **解析层（正确但刚性依赖 DB）**：`_resolve_default_extractor_routes()` 位于 `knowledge/api.py:541-625`，L578-586 查询 `mcp_tools` 表验证 4 个工具存在且 `is_enabled=TRUE`——`extractor_routes.*.targets[].server_id` 是 UUID 外键，不能凭空捏造；如 `mcp_tools` 表中无对应记录，L601-608 仅 WARN 并 `continue`，最终返回 `{"url": {"targets": []}, "file_pdf": {"targets": []}}`；
  4. **种子迁移缺口（Bug）**：迁移 `0002_seed_negentropy_perceives.py` 只做了 MCP **Server** 的幂等 upsert（`INSERT INTO mcp_servers ... ON CONFLICT (name)`），**4 个 MCP Tool 行从未被任何迁移/启动脚本预插入**；现有唯一落地路径是管理员进入 `/interface/mcp` 手动点击「Load Tools」→ `POST /interface/mcp/servers/{id}/tools/load` → `McpClientService.discover_tools()` 通过 HTTP 连接 `http://localhost:2992/mcp`（`interface/api.py:700-760`），才会把工具行同步进 DB。全新部署执行 `alembic upgrade head` 后，用户（尤其本地开发者在 `negentropy-perceives` 尚未启动、或未手动点 Load Tools 的情况下）首次创建 Corpus 会稳定命中空 `targets` 的退化路径。
- **处理方式**（Option A：最小干预 + 正交分解）：
  1. 新增 Alembic 迁移 `apps/negentropy/src/negentropy/db/migrations/versions/0006_seed_negentropy_perceives_tools.py`，`revision = "0006"` / `down_revision = "0005"`；与 `0002` 的「预置 Server（纯 DML）」语义对称承载「预置 Tool（纯 DML）」；
  2. `upgrade()` 单条 `INSERT ... SELECT s.id, t.name, t.title, t.description, TRUE FROM mcp_servers s CROSS JOIN (VALUES ...) WHERE s.name = 'negentropy-perceives' ON CONFLICT (server_id, name) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, is_enabled=EXCLUDED.is_enabled, updated_at=now()`，幂等 upsert 4 行。仅写 `server_id` / `name` / `title` / `description` / `is_enabled`，JSONB 结构字段 `input_schema` / `output_schema` / `icons` / `annotations` / `execution` / `meta` 交由 `0001` 中已声明的 `server_default`（`{}`/`[]`）兜底，后续 live discovery 的 UPDATE 分支 `interface/api.py:730-741` 会按真实 schema 覆盖——与 live UPSERT 天然兼容，不会重复插入（UNIQUE 约束 `mcp_tools_server_name_unique` 兜底）；
  3. `downgrade()` 精准 DELETE 这 4 行并以 `server_id IN (SELECT id FROM mcp_servers WHERE name = 'negentropy-perceives')` 限定影响面，不触碰 schema，不牵连 live discovery 写入的其它工具；
  4. `_resolve_default_extractor_routes()` / `create_corpus()` / 前端 `normalizeExtractorDraftRoutes()` 全部零改动；已存在的 Corpus 记录不做 backfill（超出用户诉求范围，遵循最小干预）；
  5. Stairway 集成测试 `tests/integration_tests/db/test_migrations.py::test_migrations_stairway` 的 `upgrade → downgrade → upgrade` 回环自动覆盖 0006 的幂等性与对称性，是本次修复的天然回归闸门。
- **后续防范**（核心经验）：
  1. **预置数据应与依赖它的应用逻辑一起交付**——当应用层逻辑对某张表的存在性 / 数据完整性做刚性校验（外键、UNIQUE、`is_enabled` 过滤），配套种子迁移必须与应用层变更同批交付，不能把数据落地寄托于运行时 live discovery、手动运维动作或 Agent 启动链路等非确定性通路；
  2. **对称原则**：一个逻辑实体由多张表协同表达时（如 MCP Server + Tools、Corpus + default extractor_routes），种子迁移应与 ORM 外键一样形成成对出现的结构；预置 N:M 子表时尤其要以 `CROSS JOIN (VALUES ...)` + `WHERE parent = '...'` 构造，避免引用完整性飘移；
  3. **幂等范式复用**：新增种子迁移一律以 `INSERT ... ON CONFLICT (unique_key) DO UPDATE` 而非裸 `INSERT`，与 live discovery 的 UPSERT 分支保持语义一致，支持多次 `upgrade head` 或在既有部署上重放安全；
  4. **审查 checklist 新增**：Review 新迁移时搜索 `rg -n "_resolve_default_|knowledge_default_extractor_tool_not_found"` 可定位「依赖 DB 预置数据」的刚性校验点，交叉核对当前 head 的 seed 迁移是否覆盖全部刚性前提；
  5. **时序错配是常见熵源**：`live discovery` / `auto_start=True` / 后端启动钩子 等「非确定性自愈」通路不应作为首次功能落地的唯一链路；确定性的迁移应作为第一梯队，运行时自愈仅作兜底修正。
- **同类问题影响**：
  1. 任何「后端从 DB 读配置 → 未命中则降级为空」的调用链路都存在相同风险面：建议审计 `knowledge/`、`interface/`、`memory/` 三个域内是否有类似「预期预置但未写入 seed 迁移」的条目（如未来可能新增的 `default_skills`、`default_subagents`、`default_memory_schemas` 等）；
  2. 前端 UI 对「后端返回空列表」的宽容渲染是双刃剑——它不会打破页面，但让本该显著的数据缺口退化为静默的 UX 漂移（用户不知道是「本就无默认值」还是「默认值丢了」）。一个可选的 Proactive Navigation 方向是：未来在 `Document Extraction Settings` 面板检测到 `targets=[]` 且后端配置中存在默认路由声明但未落地时，额外显示一条提示引导用户「前往 /interface/mcp 重载工具」——本次不扩大爆炸半径，纳入长期备忘。

---

## ISSUE-014 Catalog 未选目录时「创建根节点」触发 405（URL 空路径段 + Next.js 动态路由归一化）

- **表因**：用户在 `/knowledge/catalog` **未从 CatalogSelector 选择目录**的状态下，点击左侧「添加根节点」按钮，弹出 `CreateNodeDialog` 填写 name + slug 后点击「创建」，前端 Toast 报错 `Failed to create catalog node: Method Not Allowed`；DevTools Network 面板可见 `POST http://localhost:3192/api/knowledge/catalogs/entries → 405`。
- **根因**：**前端入口门禁缺失 × URL 模板字符串空段降级 × Next.js 动态路由归一化** 三重耦合：
  1. **入口门禁缺失**：`apps/negentropy-ui/app/knowledge/catalog/page.tsx:12` 中 `const [catalogId, setCatalogId] = useState<string | null>(null)` 初值为 `null`；L48-63 的 aside 条件渲染仅区分 `loading` / `!loading`，**未区分 `catalogId` 是否已选中**，始终无条件渲染 `CatalogTree`。叠加 ISSUE-001（commit `731894b`）为修复「空态吞主操作」而将「添加根节点」按钮改为**恒常可见**，两次修复叠加致使用户在未选 Catalog 语境下仍能看到并点击该入口；
  2. **参数降级**：`page.tsx:77-86` 的 `<CreateNodeDialog catalogId={catalogId ?? ""} ... />` 将 `null` 强制降级为 `""`，把「状态无效」的语义污染为「字段存在但为空串」；
  3. **URL 空段漂移**：`features/knowledge/utils/knowledge-api.ts:createCatalogNode` 的 `` fetch(`/api/knowledge/catalogs/${catalog_id}/entries`) `` 模板字符串在 `catalog_id=""` 时实际产出 `/api/knowledge/catalogs//entries`；Next.js App Router 的 URL 路径归一化将连续 `//` 合并为 `/`，归一化后等效命中 `app/api/knowledge/catalogs/[catalogId]/route.ts`（`catalogId="entries"`），而该路由文件仅导出 `GET` / `PATCH` / `DELETE`，无 `POST` 处理器 → `405 Method Not Allowed`，且错误信息完全不暗示根因（既不提 `catalogId` 缺失、也不提目标 route 错位），排查成本极高。
- **处理方式**（Minimal Change + Defense in Depth 三层纵深防御）：
  1. **Layer 1（UX 入口门禁 / 主修复）**：`app/knowledge/catalog/page.tsx` aside 区条件渲染新增 `!catalogId` 分支，渲染 dashed-border「请先选择目录」空态占位并**屏蔽 `CatalogTree` 渲染**，「添加根节点」按钮自然不可达；原 `loading ? ... : <CatalogTree />` 改为三元嵌套 `!catalogId ? <Empty /> : loading ? <Loading /> : <CatalogTree />`；保留「已选 Catalog 但 `nodes=[]`」时 `CatalogTree` 内部已有的空态入口（ISSUE-001 语义保持）；
  2. **Layer 2（API 客户端前置校验 / 纵深防御）**：`features/knowledge/utils/knowledge-api.ts:createCatalogNode` 入口增加 `if (!catalog_id) throw new Error("catalog_id is required to create a catalog node")` 守卫，把「URL 归一化后静默漂移为 405」这类低可观测性缺陷前置为**显式错误**，防范未来其他入口（programmatic 调用、测试夹具、未来新增 UI 面板）重蹈覆辙；其它 Catalog API 函数（`fetchCatalogNodes` / `updateCatalogNode` / `deleteCatalogNode` / `fetchCatalogNode` / `fetchCatalogNodeDocuments` / `assignDocumentToNode` / `unassignDocumentFromNode`）暂不扩散改造，仅在 Node 侧上下文完整后可达，遵循最小干预；
  3. **Layer 3（回归测试）**：`apps/negentropy-ui/tests/unit/knowledge/knowledge-api.test.ts` 新增 `describe("createCatalogNode")` 与 2 条用例：① 空 `catalog_id` 抛 `catalog_id is required` 错误且 `fetch` 调用次数断言为 0（锁定 Layer 2 守卫）；② 合法 UUID 精确命中 `POST /api/knowledge/catalogs/<uuid>/entries`、body 不含 `catalog_id` 字段（锁定既有契约不回归）。
- **不改动清单**（明确边界）：
  1. 后端 `apps/negentropy/src/negentropy/knowledge/api.py` 路由 / 契约正确，零改动；
  2. BFF 代理 `app/api/knowledge/catalogs/[catalogId]/entries/route.ts` 代理正确，零改动；
  3. `CatalogTree.tsx` / `CatalogTreeNode.tsx` / `CreateNodeDialog.tsx` 已正确实现「已选 Catalog 下的操作」语义，零改动；
  4. 其它 Catalog API 客户端函数保持原样，不扩散守卫改造。
- **后续防范**：
  1. **正交维度审查**：UI 空态 / 门禁修复必须同时审视所有前置上下文维度——`data=[]`（数据层空）、`parent_context=null`（父级选择缺失）、`permission=denied`（权限不足）三者正交，不能合并为同一分支。ISSUE-001 与 ISSUE-014 构成典型「修复 A 缺陷引入 B 缺陷」的反模式，应在空态分支 Review 时强制 checklist 遍历正交维度；
  2. **ID 参数化 fetch 的空值守卫范式**：模板字符串默认降级为 URL 空段 + 框架路由归一化是低可观测性缺陷的温床（错误码与根因无关联）。建议在 `knowledge-api.ts` / `memory-api.ts` / `interface-api.ts` 所有**以 ID 作为路径段**的 fetch 入口处统一前置 `if (!id) throw new Error("<id_name> is required ...")`；长期可抽取 `assertNonEmptyPathSegment(name, value)` helper 在 Wiki / Catalog / Memory / Interface 等域复用；
  3. **URL 归一化审查**：所有 `fetch(\`/api/.../${var}/.../\`)` 形态的调用在 code review 时应标注 `var` 的可为空性；Next.js App Router 的连续 `//` 合并行为（以及反向的「尾部 `/` 剥离」）是框架层面难以规避的隐式契约，必须由调用侧防护；
  4. **405 的归因定式**：今后遇到 `405 Method Not Allowed` 时，除检查前端 method 与后端 handler 对齐外，**必须**额外核对 URL 路径是否因变量空串导致落到了错误的动态段——这是 Next.js App Router 独有的第三类根因。
- **同类问题影响**：
  1. 审计全仓其余「ID 参数化 fetch」调用：可用 `rg -n "fetch\\(\`/api/.*\\\$\\{" apps/negentropy-ui/` 找出候选面，重点检查入参为 `xxxId ?? ""` 或未判空的模板字符串调用；
  2. Wiki 发布、Memory 写入、Interface MCP Server 操作等域存在同型 ID 路径参数化 fetch，此次仅对 `createCatalogNode` 做了守卫（最小干预），后续若出现类似症状可优先以 Layer 2 范式快速兜底；
  3. ISSUE-001（空态吞主操作）与本次 ISSUE-014（入口门禁缺失）提示：**UI 入口与上下文依赖的关系需要显式建模**——每个主操作按钮应能回答「我需要哪些前置上下文（catalogId / nodeId / permission / onboarding 状态）」，任何一项缺失时 UI 需显式阻断（disabled / 隐藏 / 引导占位），不能依赖下游（API 层 / 后端）兜底报错。

---

<a id="issue-015"></a>
## ISSUE-015 Knowledge / Catalog 与 Wiki 入口的 Catalog 选择器冗余 → 单实例 Catalog 收敛（Phase 4）

- **表因**：用户在 `/knowledge/catalog` 与 `/knowledge/wiki` 两个入口顶部均看到「目录：选择目录」`<CatalogSelector>` 组件组；首次进入未选择 catalog 时整页空载，显著的 UX 摩擦点；同时 KnowledgeNav 的 7 个固定 tab、Sidebar 的 5 个一级条目均未按 catalog 分支，使「选 catalog」沦为不可观测的全局态。截图来自 `/knowledge/catalog`（参见 [`apps/negentropy-ui/app/knowledge/catalog/page.tsx:11-89`](../apps/negentropy-ui/app/knowledge/catalog/page.tsx) 与 [`apps/negentropy-ui/app/knowledge/wiki/page.tsx:5,15-68`](../apps/negentropy-ui/app/knowledge/wiki/page.tsx)）。
- **根因**：**产品形态与 schema 表达力不对称**——Phase 3 Catalog 全局化重构（[`035-the-knowledge-base.md` §13](../concepts/035-the-knowledge-base.md#13-catalog--wiki-publication-三层正交架构)）将 Catalog 从 Corpus 解耦为 N:M，schema 层支持「同 app 多 Catalog」（仅 `UNIQUE(app_name, slug)`，无单例约束）；但实际产品语义只需要一个聚合根，「多主题/多菜单/多子菜单」可由 `CatalogNode.parent_entry_id` 自引用 + `MAX_TREE_DEPTH=6` 完整承载。Migration 0004 在 Phase 2 backfill 时按「1 corpus → 1 catalog」1:1 映射，运行时通常存在 ≥3 个 Catalog（negentropy-perceives / negentropy-wiki / negentropy-aurelius-clade），UI 因此被迫暴露 `<CatalogSelector>` 让用户在多 Catalog 之间切换。本质是**缺失的聚合根不变量**，而非组件实现 bug——直接删 selector 会导致前端无法解析当前 catalog。
- **处理方式**（Expand → Backfill → Contract 三段式无破坏迁移）：
  1. **架构沉淀**（本次 PR）：[`035-the-knowledge-base.md` §15 单实例 Catalog 收敛（Phase 4）](../concepts/035-the-knowledge-base.md#15-单实例-catalog-收敛phase-4在-nm-之上叠加聚合根不变量) 作为 ADR 等价记录，明确「Phase 4 在 Phase 3 N:M schema 之上叠加聚合根不变量，不是回退」；[`wiki/ops.md` §12](../reference/wiki/ops.md#12-单实例-catalog-与-wiki-发布版本管理运维) 沉淀 Phase B merge runbook（含 `pg_dump` 强制备份、守恒断言、回退 SQL）；
  2. **Phase A Migration 0007**（独立 PR）：纯加法——`CREATE UNIQUE INDEX uq_doc_catalogs_app_singleton ON doc_catalogs(app_name) WHERE is_archived=false`、`CREATE UNIQUE INDEX uq_wiki_pub_catalog_active ON wiki_publications(catalog_id) WHERE status='LIVE'`、`ALTER TABLE doc_catalogs ADD COLUMN merged_into_id UUID NULL REFERENCES doc_catalogs(id) ON DELETE SET NULL`。downgrade 完全可逆；
  3. **Phase B Migration 0008**（独立 PR + 强制 `pg_dump` 备份）：按「根节点合并为子树」策略——按 `(app_name) ORDER BY created_at ASC LIMIT 1` 选 survivor，其它 catalog 的顶层 entry 嫁接到 survivor 顶层新建的虚拟 `CATEGORY` 节点（slug 加 `legacy-<short_hash>` 后缀避免冲突），整树 `catalog_id` UPDATE 到 survivor，WikiPublication 的 LIVE 降级为 ARCHIVED 并重指向，`navigation_config` JSONB 中的 catalog_id 显式 rewrite，源 catalog 设 `is_archived=true, merged_into_id=survivor.id`（**严禁物理删除**，与 [AGENTS.md 数据库管理规范](../CLAUDE.md) 一致）。声明 `DESTRUCTIVE_DOWNGRADE = true`，回退依赖快照；
  4. **后端 API**（独立 PR）：新增 `GET /catalogs/resolve?app_name=X`（幂等读，404 表示不存在）、`POST /catalogs/ensure`（upsert-or-get），`POST /catalogs` 加 guard：active 已存在则 409 `catalog_already_exists` 并返回 `existing_catalog_id`；`DELETE /catalogs/{id}` 改为 `is_archived=true` 软删；`CatalogService.create_catalog` 在事务内 `SELECT ... FOR UPDATE` + 捕获 `IntegrityError` 降级为 ensure 语义防御并发 race。`fetchCatalogs` 保留并标 `@deprecated` 给旧客户端 6 周宽限期；
  5. **前端**（独立 PR）：新增 `features/knowledge/hooks/useAppCatalog.ts` 调 `resolveCatalog(APP_NAME)` + SWR 缓存（404 fallback ensure），新增只读 `<CatalogBadge>` 显示 catalog name + tooltip（slug / app_name），`/knowledge/catalog` 与 `/knowledge/wiki` 删除 `<CatalogSelector>` 与 `useState<string|null>` 守卫；树渲染、节点 CRUD、Wiki 详情面板等组件全部不动，只换上游数据源。
- **后续防范**：
  1. **新增聚合根类实体时优先表达「单例」语义**——若产品形态明确只需一个聚合根，schema 应在 `Expand` 阶段就附带 partial unique index 表达不变量；本次因 Phase 3 优先解耦正交性、未同步约束 active 数量，导致 UX 摩擦反向倒推 schema 收敛。Review 新增聚合表时检查「(tenant_key) WHERE active=true」式 partial unique index 是否就位；
  2. **三段式迁移的强约束**：Expand（加约束/列）→ Backfill（数据合并）→ Contract（删除冗余）必须严格分离为独立 PR，每步可独立回滚；任何 destructive backfill 强制前置 `pg_dump`，downgrade 显式声明 `DESTRUCTIVE_DOWNGRADE` 标记；
  3. **跨 catalog 嫁接时的 `MAX_TREE_DEPTH` 预检**：Composite 树类合并必须在 Phase B 前扫描所有子树深度，超限即中止迁移人工介入；杜绝迁移过程中触发应用层校验异常导致部分提交；
  4. **slug/JSONB 引用的 rewrite 完整性**：本次 navigation_config JSONB 残留旧 catalog_id 是典型的「引用泄漏」，新增/合并聚合根类迁移时必须 `grep` 全表 JSONB / TEXT 列搜索旧主键引用，确保无残留；
  5. **UI 入口的「冷启动空载」是聚合根缺失的早期信号**——任何要求用户在首屏选「全局上下文」的 selector，都应反思「这个上下文是否本应单例化或自动解析」。
- **同类问题影响**：
  1. **Memory 域**（`MemoryEntry` 与未来可能的 `MemoryNamespace`）：若引入类似的「全局上下文」概念，应优先以 partial unique index 表达单例不变量，避免重蹈 UX selector 覆辙；
  2. **Interface 域**（`McpServer` 当前已支持多实例但 `auto_start=True` 实际只期望 1 个 manager）：本次单实例约束的 `partial unique` 范式可作为模板复用；
  3. **Wiki 多版本回退**：本次保留 `WikiPublication` 的 ARCHIVED/SNAPSHOT 多版本是有意为之（详见 [`wiki/ops.md` §12.3](../reference/wiki/ops.md#123-wikipublication-多版本与回退)），未来若引入 `KnowledgeBase` / `Skill` 类似的「发布版本」语义可参照该模式（active 单例 + 历史多版本归档）；
  4. **跨 corpus 文档归属**：`doc_catalog_documents` 是软引用 N:M，同 document_id 在 survivor 下出现多 entry 是合法行为；UI 提示去重但不强制——这是 Phase 3 N:M 解耦的天然结果，Phase 4 单例化不影响该自由度。

## ISSUE-016 Wiki 发布创建 500（app_name NOT NULL 违约）+ Wiki 页 CatalogSelector 移除

- **表因**：Wiki 页「新建 Wiki 发布」->「创建」触发 `POST /api/knowledge/wiki/publications → 500 Internal Server Error`（前端提示 `Failed to create wiki publication: Internal Server Error`）。
- **根因**：Phase 3 Catalog 全局化迁移（[`perception.py`](../apps/negentropy/src/negentropy/models/perception.py) `WikiPublication` 模型 L215）为 `wiki_publications` 表新增 `app_name: VARCHAR(255) NOT NULL`（无 `server_default`），但创建链 `api.py:4068-4075` → `wiki_service.py:39-81` → `wiki_dao.py:45-53` 三处均未设置该字段，PostgreSQL INSERT 时 NOT NULL 违约触发 500。`DocCatalog` 模型（L546）已持有 `app_name` 字段，但 API handler 未从 catalog 查询推导。
- **处理方式**（最小干预）：
  1. **后端**：在 `create_wiki_publication` handler 中通过 `db.get(DocCatalog, body.catalog_id)` 查询目录，提取 `catalog.app_name`，透传至 service → DAO 层显式写入 ORM 对象（`WikiPublication(app_name=catalog.app_name, ...)`）；catalog 不存在返回 404（与 `get_catalog_documents` handler 模式一致）。
  2. **前端**：移除 Wiki 页 `CatalogSelector` 组件，改用 `useSingletonCatalog()` hook 自动绑定唯一根目录（与 Catalog 页对齐，完成 ISSUE-015 Phase 4 前端收敛中 Wiki 部分的落地）。
  3. **Pydantic schema / 前端 dialog 零改动**：`app_name` 由服务端从 catalog 推导，无需前端传入。
- **后续防范**：
  1. **新增 NOT NULL 列时必须审计创建链**：当 Alembic 迁移为现有表新增 `NOT NULL` 列（无 `server_default`）时，必须同步审计该表所有 INSERT 路径（API → Service → DAO），确保新列在 ORM 构造时被显式赋值；本次 Phase 3 迁移仅更新了 ORM 模型和迁移脚本，遗漏了 DAO 层的构造函数。
  2. **DAO 层 ORM 构造应与模型定义对称检查**：在 `db.add(entity)` 前检查 `entity.__table__.columns` 中所有 `nullable=False` 且无 `server_default` 的列是否已赋值，可作为 lint 规则或 pre-commit hook 实现。
- **同类问题影响**：`WikiPublication` 的 `publish_mode` / `visibility` 列也有 `nullable=False`，但因有 `server_default` 所以由数据库兜底，未触发 500。其他 Phase 3 迁移新增的 NOT NULL 列应做同类审计。
- **二阶问题**（2026-04-25）：app_name 修复后 creation 链路畅通，发布记录首次写入 DB，但 `list_wiki_publications` / `get_wiki_publication` 两处 handler 在 `async with AsyncSessionLocal() as db:` 退出后访问 `pub.entries` 懒加载关系（`WikiPublication.entries` 为 `relationship(back_populates="publication", cascade="all, delete-orphan")`），session 已关闭触发 `DetachedInstanceError` → 500。此前因创建链始终 500 无记录入库，列表恒返空数组，此缺陷被掩盖。修复：将 entries 计数逻辑（`len(pub.entries)`）移入 session 上下文内。防范：**懒加载关系访问必须在 session 存活期内**——当 handler 使用 `async with AsyncSessionLocal() as db:` 模式时，所有 ORM 对象的属性（含 relationship）访问应在 `async with` 块内完成；跨 session 边界应仅传递已序列化的响应对象。
- **三阶问题**（2026-04-25，承上一条二阶修复）：将 `len(pub.entries)` 移入 `async with` 上下文内后 `DetachedInstanceError` 消解，但症状仍为 500——**异步 SQLAlchemy 2.0 不支持隐式懒加载触发 IO**（参 [Async ORM API 文档](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html#preventing-implicit-io-when-using-asyncsession)）。本仓库 [`Base`](../apps/negentropy/src/negentropy/models/base.py#L99-L103) 未继承 `AsyncAttrs`、`WikiPublication.entries` 关系无 `lazy="selectin"`、`WikiDao.list_publications` / `get_publication` 查询亦无 `selectinload(...)`，致使首次属性访问以 `sqlalchemy.exc.MissingGreenlet`（greenlet 边界外触发 sync IO）失败。错误从 `DetachedInstanceError` 静默切换为 `MissingGreenlet`，外观 500 不变。**修复（最小干预 + 正交分解）**：在 [`wiki_dao.py`](../apps/negentropy/src/negentropy/knowledge/wiki_dao.py) 两处 `select(WikiPublication)` 上挂 `selectinload(WikiPublication.entries)`，让 `entries` 随主查询以 IN 批量物化（1+1 两条 SQL，`limit≤200` 性能足够）；response 序列化彻底脱离 session/lazy-load 状态依赖（stateless / Liskov-substitutable 序列化契约）。`api.py` handler、Pydantic schema、ORM 模型零改动；`update_publication` / `publish` / `unpublish` / `archive` / `delete_publication` 内部复用 `get_publication`，自动受益且不触及 `entries`，零回归。新增 2 条集成回归用例 `test_list_publications_entries_accessible_after_query` / `test_get_publication_entries_accessible_after_query` 在 `tests/integration_tests/knowledge/test_wiki_publish_modes.py` 锁定契约。**跨上下文教训**：异步 SQLAlchemy 中「session 存活」**不等于**「关系可访问」——`pub.relationship` 的首次属性访问会在 async greenlet 边界触发 IO 并以 `MissingGreenlet` 失败，除非：(a) `Base` 继承 `AsyncAttrs` 且改用 `await pub.awaitable_attrs.relationship`；(b) 关系声明 `lazy="selectin"/"joined"`；(c) **DAO 查询显式 `selectinload(...)/joinedload(...)`**（本仓库标准做法）。规则：**handler/serializer 中需要的所有关系，必须在 DAO 查询层以 eager loading option 显式声明**；不要依赖「session 还活着所以 lazy load 一定成功」这一在 sync ORM 下成立、在 async ORM 下失效的直觉。同类问题排查：在 `apps/negentropy/src/negentropy/knowledge/` 下凡 handler 序列化路径会触发 `obj.relationship` 访问的 DAO 查询，应一并审计 eager loading 是否声明完备。
- **同型扫荡审计结论**（2026-04-25，承上一条三阶修复，**穷举式 audit**）：基于 SQLAlchemy 2.0 [Async Loading 文档](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html#preventing-implicit-io-when-using-asyncsession) 的契约，对 `apps/negentropy/src/negentropy/knowledge/` 全部 async DAO（`wiki_dao.py` / `catalog_dao.py` / `source_dao.py` / `dao.py` / `repository.py` / `graph_repository.py`）进行穷举审计，覆盖 4 类 ORM 关系访问面（直接属性访问、Pydantic `from_attributes=True` 反射、合成字段手动赋值、显式 JOIN/CTE 旁路），结论如下：(1) **Wiki 路径**：三阶修复后所有 handler 序列化路径已被 `selectinload(WikiPublication.entries)` 完整覆盖；唯一一致性缺口是 `WikiDao.get_publication_by_slug`（当前无调用方，但与 `get_publication` / `list_publications` 方法签名同构），已在本次审计中预防性补 `selectinload`。(2) **Catalog 路径**：`CatalogDao.get_catalog` / `get_catalog_by_slug` / `list_catalogs` / `get_node` 等方法虽未挂 eager loading，但 handler **全部仅访问标量列**（`catalog.app_name`、`entry.position` 等），且 `get_tree`（递归 CTE）与 `get_node_documents`（显式 JOIN）直接返回 dict / 标量列字典，**结构性回避**懒加载——属「目前安全但隐式契约」。(3) **Source / Knowledge / Corpus 路径**：`source.document` / `knowledge.corpus` / `corpus.knowledge_items` 等关系在所有 handler 中**未被访问**；handler 均通过 `doc.corpus_id`（FK 标量列）回查或经 `DocumentStorageService` 旁路 ORM 关系。(4) **Pydantic schemas**：所有 `from_attributes=True` 响应模型（`WikiPublicationResponse` / `CatalogResponse` / `CatalogNodeResponse` / `DocumentResponse`）**均未声明 ORM 关系字段**，`entries_count` / `children_count` / `document_count` 等聚合字段均由 handler 手动赋值，无隐式懒加载触发。**核心防御机制**：(a) Pydantic schema 标量优先；(b) 显式 JOIN / 递归 CTE；(c) 服务层独立查询。这三类设计模式是结构性回避懒加载危险的关键，但**未在代码中明示**——本次审计同步在 `WikiDao` / `CatalogDao` / `SourceDao` 类 docstring 中沉淀「async 懒加载契约」与「为何安全 / 何时需补 eager-load」，避免后续维护者「想当然」引入 `pub.snapshots` / `entry.children` 等访问而复现 ISSUE-010 三阶。**未来债务**：若新增 handler 需在序列化路径中访问 `catalog.entries` / `entry.children` / `entry.document` / `entry.source_corpus` / `corpus.knowledge_items` / `corpus.documents` / `corpus.versions` / `kg_entity.outgoing_relations` 等关系，必须在 DAO 查询层显式挂 `selectinload(...)` / `joinedload(...)`。若此类需求大量出现以致逐查询补 option 变得繁琐，可重新评估是否引入全局 `Base.AsyncAttrs` mixin 或关系级 `lazy="selectin"` 默认（本次未推进，避免爆炸半径）。

## ISSUE-017 Wiki 发布详情前端类型契约与后端 + SSG 双源漂移导致点击整页崩溃（四阶）

- **表因**：`/knowledge/wiki` 页点击任意 Wiki 发布卡片（含图示「wiki 草稿 /wiki · v1 · 0 个条目」，但与「草稿」状态无关——所有状态稳定复现）后整页降级为根布局 `ErrorBoundary` 全屏占位（「应用程序遇到了意外错误 / 重试 / 刷新页面」）。这是 ISSUE-016 三阶 `selectinload` 修复打通点击路径后新暴露的**第四阶问题**。
- **根因（三处契约漂移）**：后端真实契约（[`api.py:4299-4311`](../apps/negentropy/src/negentropy/knowledge/api.py#L4299-L4311) + [`wiki_dao.py:328-408`](../apps/negentropy/src/negentropy/knowledge/wiki_dao.py#L328-L408)，已被 `apps/negentropy-wiki/src/lib/wiki-api.ts` 与其测试 [`tests/lib/wiki-api.test.ts:106-129`](../apps/negentropy-wiki/tests/lib/wiki-api.test.ts) 锁定为 SSOT）：

  ```jsonc
  {
    "publication_id": "<uuid>",
    "nav_tree": {
      "items": [
        { "entry_id": "...|null", "entry_slug": "...", "entry_title": "...",
          "is_index_page": false, "document_id": "...|null", "children": [...] }
      ]
    }
  }
  ```

  `negentropy-ui` 既有认知（[`knowledge-api.ts:2476-2487`](../apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts#L2476-L2487)）三处事实漂移：
  1. **字段名漂移**：`WikiNavTreeItem.slug` / `title` —— 后端实为 `entry_slug` / `entry_title`；`is_index_page` 字段缺失。
  2. **`children` 必选语义错位**：前端声明为 `WikiNavTreeItem[]`（必选）—— 后端在叶节点会缺省字段，应声明 `children?`。
  3. **`nav_tree` 外壳错位**：前端声明为 `WikiNavTreeItem[]` —— 后端实际返回 `{items: WikiNavTreeItem[]}` 信封。

  下游链路连锁失效：`WikiPublicationDetail.tsx:44` `setNavTree(resp.nav_tree)` 把 `{items: []}` 对象塞进 `WikiNavTreeItem[]` state；`WikiEntriesList.tsx:26` `for (const item of items)` 对该对象做迭代，触发 `TypeError: object is not iterable` —— 错误抛点；即便先抢修可迭代性，`flattenNavTree` 内 `item.slug` / `item.title` 仍读 `undefined`，UI 渲染空文件名（与 ISSUE-010 同型）。

- **处理方式**（**前端单边对齐 + 最小干预 + SSOT**）：后端契约不可动（已被 SSG 与其锁定测试坐镇），UI 单边对齐：
  1. **`features/knowledge/utils/knowledge-api.ts`**：`WikiNavTreeItem` 的 `slug` → `entry_slug`、`title` → `entry_title`、新增 `is_index_page: boolean`、`children` 改为可选 `children?`；`WikiNavTreeResponse.nav_tree` 改为 `{items: WikiNavTreeItem[]}` 信封类型。
  2. **`WikiPublicationDetail.tsx:44`**：`setNavTree(resp.nav_tree?.items ?? [])` —— `?.` + `?? []` 兜底覆盖信封异常，与 SSG 消费侧 `apps/negentropy-wiki/src/app/[pubSlug]/page.tsx` 中 `navResult.nav_tree?.items || []` 同构。
  3. **`WikiEntriesList.tsx`**：`flattenNavTree` 字段访问对齐 `entry_slug` / `entry_title || entry_slug`（容器节点 title 为空时回退到 slug 显示）；`children` 取 `?? []` 兜底；**移除前置的 `pathPrefix` 字符串拼接**——后端 `wiki_service.py:281` `entry_slug=final_slug` 已存全路径（与 SSG `WikiNavTree.tsx:46` 直接 `item.entry_slug` 作 URL 同构），UI 二次拼接会产生 `/guides/guides/install` 这类双前缀漂移；不额外加 `Array.isArray` 防御 guard，状态写入处 `?? []` 已覆盖信封异常，加 runtime guard 与 AGENTS.md「不为不可能场景加错误处理」相悖。
  4. **新增锁定测试** `apps/negentropy-ui/tests/unit/knowledge/wiki-nav-tree.test.tsx`（5 例）：`{items}` 信封反序列化、`entry_slug` / `entry_title` / `is_index_page` 字段保留、嵌套渲染不抛 `TypeError`、`entry_title` 空时回退、`children` 缺省语义、空数组 emptyHint 文案——锁定「`{items}` 信封 + `entry_slug`/`entry_title`/`is_index_page` 字段名」契约，对齐 `negentropy-wiki` 既有契约锁。

- **后续防范（跨上下文教训）**：
  1. **同 SSOT 多消费者类型契约必须共享或镜像**：本仓库 Wiki 后端契约由 `wiki_dao` + `api.py` 落定，被 `negentropy-wiki` SSG 与其测试锁定为 SSOT；`negentropy-ui` 作为第二消费者**必须据此反推类型定义**，**绝不内化「想当然的简化版」**（本次将 `entry_slug` 简化为 `slug` / 把信封直接当数组就是典型反例）。同 SSOT 多消费者后续可考虑抽 `packages/wiki-contract` 收敛共享类型，本次按最小干预原则不扩散爆炸半径。
  2. **信封 vs 数组的契约切换必须在类型层面与 state 写入层面双重对齐**：`{items: T[]}` 信封类型不应在某一层「便利地拍平」，应贯穿到组件 state——拍平容易但反向验证类型时 TS 检查失效（对象当数组用，TS 编译期可识别但运行期才暴露）。
  3. **错误抛点发生在子组件 render 阶段时 try/catch 接不住**：`WikiPublicationDetail` 已用 `try/catch + toast.error` 包裹 `fetchWikiNavTree`，但本次 `TypeError` 在子组件 render 阶段抛出，`useEffect` 内的 try/catch 接不住——这是另一阶问题（要么类型契约层面收敛、要么引入「局部 ErrorBoundary」缩小爆炸半径）。本次以「类型契约对齐」根治，未引入局部 boundary（避免设计扩散），但记录该方向作为未来 Wiki 详情区独立 boundary 的备选。
  4. **同型问题排查**：在 `apps/negentropy-ui/features/*/utils/*-api.ts` 下凡声明 `*Response` 接口的端点，需以「后端 Pydantic schema + 后端测试 + SSG 类型」三方对齐验证，不得仅凭 UI 主观「猜想契约」。
- **同类问题影响**：与 ISSUE-010「KnowledgeDocument 文件名字段漂移」同型——均为前端「想当然简化版」覆盖后端真实字段名导致渲染降级；本次进一步暴露「同 SSOT 多消费者」的双源漂移风险，应在 Wiki / Catalog / Knowledge 跨域端点逐一审计。

---

## ISSUE-018 BFF `proxyPost` 强制 JSON body 阻塞所有空 body 动作端点

- **表因**：UI 上点击 Wiki「仅发布」/「取消发布」无任何反应；直接调 `POST /api/knowledge/wiki/publications/{id}/publish` 返回 400 `KNOWLEDGE_BAD_REQUEST: Invalid JSON body: SyntaxError: Unexpected end of JSON input`。同型问题潜伏在 Memory 域 `automation/jobs/{key}/{enable|disable|run|reconcile}` 与 Interface 域 `mcp/servers/{id}/tools` 等所有「动作型 POST」端点。
- **根因**：`apps/negentropy-ui/app/api/{knowledge,memory,interface}/_proxy.ts::proxyPost` 三处实现均在转发前**强制 `await request.json()`**，对空 body 立即抛 `SyntaxError` 并以 400 短路，根本未到达后端。后端 `POST /publish` / `POST /unpublish` 等接口本身**无请求体**（FastAPI handler 无 body 参数），与 BFF 假设错配。
- **处理方式**：
  1. 改写三个 `_proxy.ts::proxyPost`：`const rawBody = await request.text()` → 空白则 `forwardBody = undefined`、`headers` 不附 `content-type`；非空则 `JSON.parse(rawBody)` 校验后透传。同时保留对非法 JSON 的 400 短路（行为兼容）。
  2. 新增 `apps/negentropy-ui/tests/unit/knowledge/proxy-empty-body.test.ts` 三例锁定：空 body 透传 / 合法 JSON 透传 / 非法 JSON 拒绝。
- **后续防范**：
  1. BFF 代理层应「能转发就转发」，**不预设 body 结构**——动作型端点（`/{publish,unpublish,enable,disable,run,reconcile,...}`）历来无请求体，假设有 body 等于在每个新增端点处埋雷。
  2. 同型扫荡：本次同步修复 knowledge / memory / interface 三个 _proxy；新增 BFF proxy 文件需走同源模板，避免回退到旧逻辑。
  3. UI 端「按下按钮无反应」类问题排查清单中应**优先检查 Network 标签页 4xx/5xx**，而非默认归因于 React 状态。
- **同类问题影响**：所有「动作型 POST」HTTP 路由（PR 标记 `:action` 后缀的端点都是高风险候选）。本次同步给三个 _proxy 模板修复，未来新增 proxy 不应再复现。

---

## ISSUE-019 Wiki `CatalogNodeSelectorDialog` useEffect 依赖陷阱致无限 fetch 循环

- **表因**：用户在 `/knowledge/wiki` 详情页点击「从 Catalog 同步」，弹出对话框始终停留在「加载中…」；浏览器 Network 标签短时间内对同一 URL 累积 100+ 请求，最终触发 `net::ERR_INSUFFICIENT_RESOURCES`。Console 报「Failed to fetch」toast 刷屏。
- **根因**：经典 React `useCallback` 依赖陷阱链：
  1. 父组件 `WikiPublicationDetail.tsx:245-259` 渲染 `<CatalogNodeSelectorDialog>` 时**未传 `initialSelectedIds` prop**。
  2. 子组件 `CatalogNodeSelectorDialog.tsx` 默认值 `initialSelectedIds: string[] = []` 在每次 render 都是**新数组引用**。
  3. 子组件 `resetSelection = useCallback(..., [initialSelectedIds])` 因依赖每 render 变化 → callback 引用变化。
  4. `useEffect(..., [open, loadTree, resetSelection])` 因 `resetSelection` 引用变 → 副作用重跑 → `loadTree` → `setNodes(...)` → 父子重新 render → 回到第 2 步形成闭环。
- **处理方式**：
  1. 在模块顶层声明 `const EMPTY_SELECTION: readonly string[] = Object.freeze([])` 作为稳定空数组引用，作为 `initialSelectedIds` 默认值。
  2. 重写 `useEffect` 仅依赖 `[open, corpusId]`，effect 内**内联**调用 `fetchCatalogTree` 并 `setSelectedIds(new Set(initialSelectedIds))`；删除 `resetSelection` callback。`initialSelectedIds` 作为「open 切换瞬时快照」消费——以 `eslint-disable-next-line react-hooks/exhaustive-deps` 显式声明，避免后续维护者误加回依赖再次复发。
  3. 引入 `apps/negentropy-ui/components/ui/BaseModal.tsx`（顺手抽象），提供 Escape 关闭与 backdrop 关闭统一行为；`CatalogNodeSelectorDialog` 与 `CreateWikiPublicationDialog` 同步改造，去除两处对话框模板重复。
- **后续防范**：
  1. **`useCallback` 依赖中含 prop 默认数组/对象**是 React 经典反模式；评审 PR 时遇到 `useCallback([propWithArrayDefault])` 必须红灯。
  2. 模式建议：`useEffect` 与 `useCallback` 依赖中**禁止**直接依赖未稳定化的 callback 引用；优先「effect 内内联 + ESLint disable + 注释解释为什么」，而非「层层 useCallback 包装」。
  3. **dialog/modal 容器抽象**应统一处理 keyboard / backdrop 关闭与生命周期；新增对话框直接复用 `BaseModal`，不再各自维护壳层逻辑。
- **同类问题影响**：所有 `useEffect` 依赖中含 `useCallback` 而 callback 又依赖 prop 数组/对象的组件（特别是 `Dialog` / `Form` 类），同型扫荡时关注 `[*, fooCallback]` 与 `useCallback(fn, [propArr])` 的组合。

---

## ISSUE-020 Wiki SSG 默认后端端口与负载端口不一致 + webhook 默认未配置 联合致「同步并发布后首页一直空」

- **表因**：用户在 http://localhost:3192/knowledge/wiki 点击「同步并发布」 v5 后，刷新 http://localhost:3092/ 始终显示「暂无已发布的 Wiki」；本地 `pnpm dev` 启动 wiki SSG 时反复输出 `[Wiki] Failed to fetch publications: TypeError: fetch failed { code: 'ECONNREFUSED' }`，并伴随 `Failed to update prerender cache for /index [Error: ENOTDIR ...]` 噪声。
- **根因**：三因并发，构成「端口错配 → 空列表写盘 → 自愈失效」自我强化闭环：
  1. **端口默认值跨进程漂移**：`apps/negentropy/src/negentropy/cli.py:51,91` 后端默认监听 `3292`（项目端口 SSOT），`apps/negentropy-ui/lib/server/backend-url.ts:DEFAULT_BACKEND_BASE_URL` 已对齐 `3292`；但 `apps/negentropy-wiki/{src/lib/wiki-api.ts:10, next.config.ts:4, src/app/api/content-status/route.ts:10}` 三处 `WIKI_API_BASE` 默认值仍为 `http://localhost:8000`（早期遗留），且仓库无 `apps/negentropy-wiki/.env*` 覆盖文件，致 SSG fetch 永远 ECONNREFUSED。
  2. **webhook 默认通路被动失活**：`apps/negentropy/src/negentropy/config/knowledge.py:71` `WikiRevalidateSettings.url: str | None = None`；`apps/negentropy/src/negentropy/config/config.default.yaml` 的 `knowledge:` 块未声明 `wiki_revalidate.url` 默认值；`apps/negentropy/src/negentropy/knowledge/revalidate.py:69-71` 检测到 `not cfg.url` 即返回 `"not_configured"` 不阻塞发布——结果数据库写入 v5 成功但 SSG 端从未被通知。
  3. **ISR 缓存毒化**：`apps/negentropy-wiki/src/app/page.tsx:14-22` catch 后 `publications=[]`，叠加 `page.tsx:3` `export const revalidate = 300`，致空数组被 Next.js 持久化为 ISR 静态产物缓存 5 分钟；webhook 主动 revalidate 也仅 mark cache stale，下次请求若 fetch 仍失败（端口错配未修），再次写入空数组，闭环。
- **次生噪声**：`Failed to update prerender cache [ENOTDIR]` 路径形如 `.temp/negentropy-wiki-runtime-WLDJQT/.next/server` —— 来自 `apps/negentropy-wiki/scripts/start-production.mjs:38-46` 在 `pnpm start` 时创建的临时运行时目录；SIGINT/SIGTERM 走 cleanup 但异常退出（kill -9、容器 OOM）会残留。本次仅文档化 workaround（`rm -rf apps/negentropy-wiki/.next apps/negentropy-wiki/.temp` 后重启 dev），代码治理延后。
- **处理方式**（最小干预 + SSOT 对齐）：
  1. 三处 `WIKI_API_BASE` 默认值统一改为 `http://localhost:3292`，与 `cli.py` + `backend-url.ts` 同源；不引入「废弃端口守护」（参考 ISSUE-005 教训：废弃值即熵源）。
  2. `config.default.yaml` 的 `knowledge:` 块新增 `wiki_revalidate.url: http://localhost:3092/api/revalidate` + `timeout_seconds: 5.0`；secret 仍由 `NE_KNOWLEDGE_WIKI_REVALIDATE__SECRET` 环境变量注入（生产必填，本地容错）。`WikiRevalidateSettings` schema 零改动，`tests/unit_tests/knowledge/test_revalidate.py` 5 例用例显式构造 cfg 不依赖默认值，回归零风险。
  3. `page.tsx` catch 分支引入 `unstable_noStore()`（Next.js 15 next ^15.5.15 已稳定支持）：失败本次响应不写入 ISR cache，回落为 per-request SSR 一次/请求；后端恢复后下次访问即可正常重建 ISR cache。`export const revalidate = 300` 保留，成功路径仍享 ISR；与 AGENTS.md 「Evolutionary Design」一致——把失败转化为可观测、可自愈的反馈环。
  4. `docs/reference/wiki/ops.md` §3.1 表格、§4.3 后端联调、§8.1 故障排除三处文档同步校正端口与排查步骤。
- **后续防范**：
  1. **跨进程默认值即合约**：所有跨进程默认端口、URL、密钥需在初始化时声明 SSOT 出处（参考 `apps/negentropy-ui/lib/server/backend-url.ts:DEFAULT_BACKEND_BASE_URL` 范式）；CR 评审涉及 `process.env.X || "http://localhost:NNNN"` 模板时，必须显式核对该端口是否与项目唯一端口分配表一致。
  2. **「降级为兜底空」的 catch 必须配套缓存失效声明**：任何 `catch (err) { return [] }` 模式在 SSG/ISR 上下文中都属潜在自愈陷阱；catch 块需配合 `unstable_noStore()` 或显式 `throw` 让上层错误边界接管，禁止"静默写盘空数组"。
  3. **CHANGELOG 写作纪律**：默认值变更属"行为契约变更"，必须在 `### Changed` 段（或 `### Fixed` 配合 changelog 表述）显式登记并提示用户更新本地配置覆盖。
- **同类问题影响**：
  1. 端口治理范式参考 [ISSUE-005](#issue-005-废弃端口守护成为熵源)：所有"兼容旧值的运行时守护"应有退役期；本次直接修正默认值不引入兼容层。
  2. 其他 SSG 入口（`apps/negentropy-wiki/src/app/[pubSlug]/page.tsx`、`[pubSlug]/[...entrySlug]/page.tsx`）当前 catch 分支策略需同步审视，未来若引入相同的"fetch 失败兜底渲染"语义，应同步引入 `unstable_noStore()` 或迁出到 client-side fallback（建议 follow-up 专项审视，非本次范围）。
  3. **未来专项 ISSUE-021（占位）**：`apps/{negentropy-wiki,negentropy-ui}/scripts/start-production.mjs` 启动前应扫描 `.temp/<app>-runtime-*` 残留，清理非目录占位与超阈值 mtime 子目录；wiki+ui 同型缺口建议抽 `packages/next-standalone-runner` SSOT。本次按最小干预暂不动，仅以 ops §8.1 workaround 文档化。

---

## ISSUE-022 Wiki 详情页三栏布局 + 章目录（TOC）+ 折叠树形导航

- **触发场景**：用户访问 `apps/negentropy-wiki` 详情页（`/:pubSlug/*entrySlug`），仅有「左侧导航 + 中间正文」两栏，左栏 `WikiNavTree` 始终全量铺开，右侧空白（CSS 层 `.wiki-toc` 仅占位注释「客户端动态生成」未实施），且 `lib/markdown.ts` 正则渲染**不注入 heading id**，长文档难以定位章节。
- **根因（结构性缺口，非 bug）**：
  1. **左栏可读性**：`WikiNavTree.tsx` 是无状态 Server Component，递归渲染 ul/li 时所有容器节点同时铺开，深层 nav tree 视觉噪声放大；与 Catalog 页独立维护视觉风格，未沿用业界 GitBook/VuePress 的「祖先链优先展开」范式。
  2. **TOC 缺位**：`globals.css` 已为 `.wiki-toc` 预留样式占位，但 page 层没有可用 headings 数据源 —— 正则 markdown 渲染器（`renderMarkdown`）不输出 heading id，TOC 无法稳定锚点；改进路径已在 `markdown.ts` 注释中写明（升级 react-markdown + remark-gfm + rehype-katex），但未推进。
  3. **三栏布局缺失**：`.wiki-layout` 沿用 flex 两栏，无右栏槽位；`data-toc` 状态管理需要客户端能力，但页面是 Server Component。
- **处理方式**（基于 ISSUE-017 SSOT 契约 / ISSUE-020 ISR 不变量约束的无副作用增量改造）：
  1. **依赖升级（最小集合）**：`apps/negentropy-wiki/package.json` 引入 `react-markdown ^10.1.0`（与 `negentropy-ui` 已在用版本对齐）+ `remark-gfm ^4.0.1` + `rehype-slug ^6.0.0` + `unified ^11` + `remark-parse ^11` + `mdast-util-to-string ^4` + `unist-util-visit ^5` + `github-slugger ^2`；devDeps 增 `@testing-library/react ^16.3.2` + `jsdom ^28.0.0`。
  2. **正交分解三个新模块**：
     - `src/lib/markdown-headings.ts::extractHeadings(md, { skipH1=true })` —— 服务端纯函数，用 `unified + remarkParse + remarkGfm` 解析 mdast，单实例 `GithubSlugger` **按文档顺序对每个 heading 都调用一次 `slug(text)`**（必须先 slug 后过滤），保证与 `rehype-slug` 注入的 `id` 严格一致（同库同顺序计数，重复文本均得 `intro-1/-2`）。
     - `src/components/WikiLayoutShell.tsx`（client）—— 三栏外壳；React Context 持有 `tocCollapsed` 状态并写到根 `<div class="wiki-layout" data-toc="...">`；通过 `useEffect` 读 LS（`wiki:toc:collapsed`），首次 render 输出 `collapsed=false` 与 SSR 一致避免 hydration mismatch。
     - `src/components/WikiToc.tsx`（client）—— TOC；通过 `useTocLayout()` 消费 Shell Context 的 `collapsed/toggle`；`IntersectionObserver` 实现 scroll-spy（`rootMargin: 0px 0px -70% 0px`），点击平滑滚动并 `history.replaceState` 写 hash；空 headings 时 `return null`。
  3. **既有组件最小改造**：
     - `WikiNavTree.tsx` 转 client，新增纯函数 `computeAncestorSlugs(items, activeSlug)` 派生初始 `expanded` Set；用户手动 toggle 后写入；ARIA `role=tree/treeitem/group`、`aria-expanded`、`aria-current="page"`；只读语义不引入 Catalog 的拖拽/编辑。
     - `[pubSlug]/[...entrySlug]/page.tsx` 用 `WikiLayoutShell` 装配三栏；正文以 `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>` 替换 `dangerouslySetInnerHTML + renderMarkdown`；`hasToc` 由 `headings.length >= 2` 判定。
     - `[pubSlug]/page.tsx` 同样包 `WikiLayoutShell` 但 `hasToc=false`，保持折叠风格一致。
  4. **样式 contractive 升级**：`.wiki-layout` flex → CSS Grid 三态（`expanded`/`collapsed`/`none` 切换 `grid-template-columns`）；新增 `.wiki-toc-aside`/`.wiki-toc-rail`/`.wiki-toc-list/.wiki-toc-item.depth-{2,3,4}.active`；heading 加 `scroll-margin-top: 4.5rem` 兼容 sticky 顶栏；补 react-markdown 列表/任务框/表格样式；移动端（≤768px）三栏退化为单栏，TOC `display:none`（不引入悬浮抽屉，避免范围扩散）。
  5. **测试替换**：删除 `tests/lib/markdown.test.ts`（断言旧正则输出，与新实现不兼容），新增 `markdown-headings.test.ts`（H1 过滤 / 重复标题去重 / 中文 slug / 顺序 / 内联格式剥离）+ `WikiNavTree.test.tsx`（祖先链派生）+ `WikiToc.test.tsx`（折叠态切换 / LS 持久化 / data-toc 写入 / 空 headings 不渲染，含 IntersectionObserver stub）；`vitest.config.ts` 增 `environment: "jsdom"` + 收纳 `*.test.tsx`。
- **关键设计决策（业界范式锚定）**：
  1. **三栏 = CSS Grid 而非 flex**：`grid-template-columns: var(--wiki-sidebar-width) minmax(0, 1fr) var(--wiki-toc-width)`，第三列宽度由 `data-toc` 三态切换；`minmax(0, 1fr)` 中栏避免子内容撑开（典型 flex `min-width: auto` 陷阱），与 Vercel docs / Notion 同型。
  2. **Layout Shell 持有 TOC 状态**：避免 `WikiToc` 通过 `document.querySelector` 修改 layout 根的 `data-toc` 黑魔法；React Context 是组件间状态共享的正交分解（参考 ISSUE-019 教训：状态应通过组件树正向传递而非旁路 DOM）。
  3. **服务端抽 headings + 客户端 TOC**：抽取在 SSG/ISR 阶段完成（命中 ISR 缓存后零成本），TOC 客户端只做 IntersectionObserver scroll-spy 与 LS 持久化，最小客户端 bundle 增量。
  4. **slug 算法一致性**：`rehype-slug` 内部即用 `github-slugger`，自定义 `extractHeadings` **必须**用同实例同顺序逐个 slug，否则重复标题序号会漂移（与 ISSUE-017 SSOT 契约同源思路：双消费者必须共享同一计算契约）。
- **后续防范**：
  1. **客户端组件首次 render 输出必须与 SSR 一致**：所有 client 组件首次 render `collapsed=false` / `expanded=ancestors`，`useEffect` 内才读 LS / 写 LS，避免 React 19 hydration mismatch（参考 React docs `useSyncExternalStore` 的同源原则）。
  2. **新增 BFF 代理 / SSG 数据源时端口默认值合约**：本次未引入新 fetch，但若 follow-up 增加 `/api/headings/{entryId}` 等端点，必须沿用 ISSUE-020 的端口 SSOT 范式（`backend-url.ts:DEFAULT_BACKEND_BASE_URL` + 校验脚本）。
  3. **`react-markdown` 升级路径预留**：当前未引入 `rehype-pretty-code` 或 `shiki`（语法高亮）、`rehype-katex`（数学公式）、`rehype-autolink-headings`（heading 旁的锚点链接），后续如需可在 `[...entrySlug]/page.tsx` 的 `rehypePlugins` 中链式增量引入；优先评估 `negentropy-ui` 既有 `markdown-plugins.ts` 是否能抽 SSOT 共享。
- **同类问题影响**：
  1. **wiki app 与 negentropy-ui 的 markdown stack 仍未 SSOT**：本次 wiki app 独立持有 `react-markdown` 依赖；未来若 `negentropy-ui` 同步升级到 v10 或引入 KaTeX 等，应评估抽 `packages/markdown-config` 共享插件链。
  2. **TOC 同型可在 Knowledge / Memory 长文档页复用**：`apps/negentropy-ui/features/knowledge/components/DocumentMarkdownRenderer.tsx` 可考虑同源 `WikiToc` 实现，但目标用户场景（管理后台 vs 公开阅读）差异大，本次不主动外推。
  3. **左栏树折叠语义**：`WikiNavTree` 与 `apps/negentropy-ui/app/knowledge/catalog/_components/CatalogTree.tsx` 同样面对「层级数据 + 当前选中」语义，但前者只读、后者编辑，未来若产生第三个同型场景再考虑抽 SSOT。

---

## ISSUE-023 Catalog 节点类型语义冗余 + Wiki 树状结构压平假象

- **表因**：
  1. `/knowledge/catalog` 创建对话框「类型」字段提供「分类 / 集合 / 文档引用」三选项，无 tooltip 与说明；
  2. CATEGORY 与 COLLECTION 在 ORM、DAO、Service、Sync 各层无任何功能差异（仅前端图标颜色不同），违反「正交地提取概念主体」；
  3. DOCUMENT_REF 暴露在用户创建路径，手动选择会写入 `document_id IS NULL` 的孤立条目，破坏 `assign_document` 不变量；
  4. Catalog 树形结构同步到 Wiki 后呈现「压平」假象——`WikiPublicationEntry` 仅为文档建条目（`document_id NOT NULL`），FOLDER 容器节点无对应 Wiki 条目；`wiki_tree.py::_ensure_container` 用 path slug 字符串当 title 合成虚拟容器，丢失 Catalog 节点的 `name` / `description` / `id` 等元数据；空 FOLDER 子树（无后代文档）在 Wiki 端彻底消失。
- **根因（结构性，非 bug）**：
  1. **类型枚举冗余**：`DocCatalogEntry.node_type` 三值（CATEGORY / COLLECTION / DOCUMENT_REF）中前两者语义与行为完全等价；DOCUMENT_REF 是 N:M 文档归属的内部软引用，不应作为用户面类型；
  2. **Wiki 模型职责越位**：`WikiPublicationEntry` 把"文档映射"与"导航树容器"两职责压缩到一张表，`document_id NOT NULL` 强约束导致容器节点无处持久化；
  3. **build_nav_tree 信息源不足**：仅消费 `entry_path` 字符串数组，不消费 Catalog 节点的真实元数据，被迫合成虚拟容器。
- **处理方式**（5 个 PR 串联，含 2 次迁移）：
  1. **PR-1 / Migration 0010 `catalog_node_type_unify_folder`**：枚举增 FOLDER 值；`UPDATE doc_catalog_entries SET node_type='FOLDER' WHERE node_type IN ('CATEGORY','COLLECTION')`；CATEGORY / COLLECTION 在 PG ENUM 中作为"死值"保留（PG 不支持 DROP VALUE）；应用层显式拒绝 `document_ref` 经 `create_node` 写入；前后端 `_NODE_TYPE_TO_ENUM` / `CatalogNodeType` 同步收敛；`update_node` 静默忽略 `node_type` 字段（类型不可变）；
  2. **PR-2 重构 `catalog_dao` 三模块拆分**：`catalog_dao.py`（510 → 169 行）保留 Catalog 顶层 CRUD + `CatalogDao` Façade（多继承聚合 `CatalogNodeDao` + `CatalogAssignmentDao`）；新增 `catalog_node_dao.py`（节点 CRUD + 树查询）/ `catalog_assignment_dao.py`（DOCUMENT_REF 软引用）；外部调用面零改动（``CatalogDao.create_node`` / ``CatalogDao.assign_document`` 等仍可用）；
  3. **PR-3 / Migration 0011 `wiki_entry_container_kind`**：新建 ENUM `wiki_entry_kind('CONTAINER','DOCUMENT')`；`WikiPublicationEntry` 加 `entry_kind` / `catalog_node_id`、`document_id` 改 nullable；CHECK 约束 `ck_wiki_entry_kind_payload` 保证两态 payload 互斥；partial unique index `uq_wiki_entry_pub_doc_active` / `uq_wiki_entry_pub_node_active` 替换原 `uq_wiki_entry_pub_doc`；`wiki_service.sync_entries_from_catalog` 重写为产出 container_plans + document_plans 两条流，分别经 `upsert_container_entry` / `upsert_entry` 写入；`wiki_tree.build_nav_tree` 改为优先消费 CONTAINER 真实元数据，缺失时降级合成（`_synthetic=True`）；
  4. **PR-4 前端创建对话框收敛**：移除「类型」select 控件（FOLDER 是唯一类型）；说明文案指引用户经节点详情页「挂载文档」按钮触发 `assign_document`；`CatalogTreeNode` 图标 / 徽标改用 NODE_TYPE_LABELS（中文「目录」/「文档」），历史 `category` / `collection` 兜底为 folder 视觉；
  5. **PR-5 Wiki SSG 与 UI 双侧消费 entry_kind**：`negentropy-wiki/lib/wiki-api.ts` 新增 `WikiNavTreeItem.entry_kind` / `catalog_node_id` 字段 + `isContainerItem` 工具函数；`WikiNavTree.tsx` / `WikiEntriesList.tsx` 改用 `entry_kind` 判断容器（向后兼容旧响应：缺省时按 `document_id` 兜底）。
- **PR-3 复审收尾（同 PR 内修复，非新增 migration）**：
  1. **CONTAINER / DOCUMENT entry_slug 跨类型冲突**：`_apply_container_mappings` 与 `_apply_document_mappings` 原各自维护独立 `seen_slugs`，但 `uq_wiki_entry_pub_slug` 是跨 `entry_kind` 的全局唯一约束——当父目录下既存在子 FOLDER `b` 又存在 slugify 后等于 `b` 的兄弟文档（如 `b.md`）时，DOCUMENT 端会以同 slug `IntegrityError` 命中、整次同步事务回滚。处理：将 `seen_slugs` 提升为同步会话级共享集合（在 `sync_entries_from_catalog` 初始化），CONTAINER 写入时先 `add`，DOCUMENT 端复用同一集合走 `-2/-3` 后缀兜底链（产出 `renamed:<doc_id>:<old>->:<new>` 错误标记便于运营观测）；CONTAINER 端同样补 `renamed:node:<id>:...` 标记保证 dedup 完全可观测；
  2. **`catalog_node_id` FK 行为与 CHECK 约束矛盾**：原 `ON DELETE SET NULL` 与 `ck_wiki_entry_kind_payload`（CONTAINER 必填 `catalog_node_id`）天然冲突——级联 NULL 会触发 CHECK 失败、PG 反向阻止 Catalog FOLDER 删除（`delete_node` / `delete_catalog` 路径在已发布场景下 `IntegrityError`）。处理：迁移 0011 与 ORM `WikiPublicationEntry.catalog_node_id` 同步改为 `ON DELETE CASCADE`，与 publication 级 CASCADE 链路对齐——FOLDER 删除时其 CONTAINER 条目随之清理，不产生孤儿行。
- **测试覆盖**：
  - 后端：`test_catalog_node_type_unify.py`（FOLDER 默认 / DOCUMENT_REF 拒绝 / 历史值归一）、`test_catalog_dao_facade.py`（Façade 多继承契约）、扩展 `test_wiki_tree.py::TestBuildNavTreeContainerEntries`（5 例：显式 CONTAINER 替换合成、空容器子树可见、缺 CONTAINER 合成回退、混序输入正确装配、合成标记清理）、新增 `test_wiki_service_unit.py::TestWikiCatalogSync::test_sync_dedup_shares_slug_namespace_across_kinds`（FOLDER 与同名兄弟文档撞 slug 时走 `-2` 兜底，并产出 renamed 标记）；
  - 前端 UI：`catalog-create-node-dialog.test.tsx`（不渲染 select / 调用 node_type='folder' / 提示文案）、`catalog-tree-node-icons.test.tsx`（folder / document_ref / 历史值兜底）；
  - SSG：`wiki-nav-tree-kind.test.ts`（5 例：entry_kind 优先 / document_id 兜底 / 合成容器识别）。
- **后续防范**：
  1. **Negative Prompt：枚举不要做"代码无差异的同义值"**——若两枚举值在 ORM / DAO / Service / 同步 / API / 前端任意一层都无行为差异，则它们是同一概念，应合并为一值；UI 需要的视觉区分由独立维度（图标 / 标签 / 状态）承担，不应升级为类型枚举；
  2. **Negative Prompt：内部实现细节不要暴露至用户路径**——`DOCUMENT_REF` 是 N:M 软引用的实现细节（同 `assign_document` 内部使用），错误暴露至 UI 创建对话框会让用户写入孤立条目；类似情况包括 tombstone 标记、status 字段、内部 cache key 等；
  3. **Wiki 模型双职责拆分**：`WikiPublicationEntry` 现明确支持 CONTAINER + DOCUMENT 两类条目，CHECK 约束保证 payload 一致性；类似的"映射 + 元数据"双职责场景（如 `KgEntityMention` / `WikiPublicationSnapshot`）应警惕被压缩到单一外键导致结构压平；
  4. **PG ENUM 治理范式**：扩张枚举值采用 `autocommit_block + ADD VALUE IF NOT EXISTS`；不可 DROP VALUE 的限制要求"应用层禁止写入 + 在迁移注释明确死值"——参考 ISSUE-013 的 enum cast 处理同源；
  5. **PR 拆分纪律**：5 个 PR 严格按 Expand → Backfill → Contract 分离，每个均独立可合并 / 回滚；migration 0010 / 0011 解耦的好处在 PR-3 rebase 时验证。
  6. **Negative Prompt：dedup 集合必须与「唯一约束的实际作用域」对齐**——多 writer 共写一张表时，每个 writer 各持本地 `seen_*` 集合是常见反模式；只要 DB 端的 unique constraint 是跨 writer 的全局视图，dedup 就必须提升为协调器级别的共享集合，否则跨类型冲突在小流量下被掩盖、在数据规模上线后才以 IntegrityError 暴露；
  7. **Negative Prompt：FK 的 ON DELETE 行为必须与 CHECK 约束的可达状态求交集**——`ON DELETE SET NULL` 把 FK 列写成 NULL，若 NULL 不在 CHECK 约束的合法状态集合内，PG 会反向阻止父表删除；引入新的 partial CHECK 约束时，应同步检查所有引用此列的 FK ondelete 策略（CASCADE / RESTRICT / NO ACTION 是更安全的默认，SET NULL 仅在「NULL 是 CHECK 合法状态」时使用）。
- **同类问题影响**：
  1. **`WikiPublicationEntry.is_index_page`** 当前仍按 DOCUMENT 语义解读；后续若让 CONTAINER 也支持"挂 landing 页"（Docusaurus `link.type=doc` 模式），可在 CONTAINER 行复用 `is_index_page` 表达"该容器有 landing 文档绑定"；
  2. **negentropy-wiki SSG 路由** `[pubSlug]/[...entrySlug]/page.tsx` 当前不消费 CONTAINER 条目（只渲染 DOCUMENT），未来若需为 CONTAINER 提供 landing 页路由，需扩展 `getEntryContent` 行为；
  3. **CATEGORY / COLLECTION 死值清理**：长期看可在 PG 17+ 评估 `ALTER TYPE ... RENAME VALUE` 或重建 enum 的 follow-up；当前应用层禁写已足够，不引入额外迁移风险；
  4. **catalog_dao 拆分范式可复用**：`memory_dao` / `interface_dao` 等 500+ 行的 DAO 若呈现"顶层 CRUD + 子实体 CRUD + N:M 关联"三类职责，可参照本次 Façade 多继承范式按职责正交分解。

---

## ISSUE-024 GitHub Dependabot 6 项告警一次性收敛（litellm RCE/SSTI/SQLi + postcss XSS + uuid 越界）

- **表因**：GitHub Security 面板 ([dependabot alerts](https://github.com/ThreeFish-AI/negentropy/security/dependabot)) 上报 6 个开放告警——1 critical（litellm SQL 注入）、2 high（litellm SSTI、MCP stdio 认证后 RCE）、3 medium（postcss `</style>` XSS × 2 / uuid v3·v5·v6 buf 越界 × 1）。
- **根因**：
  1. **直接依赖小版本滞后**：`apps/negentropy/pyproject.toml` 约束 `litellm>=1.83.0`，`uv.lock` 锁在 `1.83.0`；上游已发布 `1.83.7` 修补三类漏洞，本仓未及时跟进；
  2. **间接依赖被上游锁住**：`postcss` 由 next/tailwind/vite 间接引入；`uuid@11.1.0` 由 `@ag-ui/client@0.0.47` 间接引入并已被显式 pin 在 negentropy-ui 的 `pnpm.overrides` 中——上游不发新版则间接依赖永远滞留漏洞版本。
- **处理方式**（最小干预 + Verification Before Done）：
  1. **litellm**：`pyproject.toml` 安全下限上调到 `litellm>=1.83.7`（不仅是 lock 层，把约束固化在配置层防降级）；`uv lock --upgrade-package litellm` 实际解析到 `1.83.14`；执行 `uv run pytest tests/unit_tests` 全量 660 个单测全绿，含 `model_resolver_gemini_api_base` / `model_resolver_openai_api_base` / `models_ping` / `pricing_catalog` / `instrumentation` 等 litellm 高敏路径；保留 `normalize_api_base_for_litellm()`（针对 1.83.x Gemini `/v1beta` 与 OpenAI `/v1` 路径构造缺陷的补丁）——测试证明 1.83.14 与该补丁仍兼容，无需附加版本探测；
  2. **postcss（双 app）**：在 `apps/negentropy-ui/package.json` 已有 `pnpm.overrides` 中追加 `"postcss": ">=8.5.10"`；为 `apps/negentropy-wiki/package.json` 新增 `pnpm.overrides` 区块同样固定到 `>=8.5.10`；`pnpm install` 后两 app 实际解析到 `postcss@8.5.11`；`pnpm test` 与 `pnpm build` 全部通过（wiki 5.4s 通过 next build，ui 通过完整路由 prerender）；
  3. **uuid**：仅在 `apps/negentropy-ui/package.json` 的 `pnpm.overrides` 追加 `"uuid": ">=14.0.0"`（wiki 不依赖 uuid）；跨 3 个 major（v11→v12 ESM-only / v13 移除默认 export / v14 修补本 CVE）的强制升级风险点是 `@ag-ui/client@0.0.47` 内部对 uuid 旧 API 的引用——`pnpm test`（441/441 通过，含 `agui-session-response` / `useAgentSubscription` / `ndjson-agent` 等触达 `@ag-ui/client` 的链路）+ `pnpm build`（完整路由 prerender 含 chat/agent 关联页面）双重验证未发现回归。
- **后续防范**：
  1. **Negative Prompt：直接依赖的安全下限要在配置层声明，不要只靠 lock 文件兜底**——`pyproject.toml` / `package.json` 是对人/对未来 contributor 的契约，lock 仅是当下解析快照；新人 reset lock 后会回到旧版本则形同虚设；
  2. **`pnpm.overrides` 是间接依赖 CVE 的标准范式**——上游不发新版时通过 override 强制升级即可；本次范式（在 ui 已有 overrides 区块上增量追加；为 wiki 从无到有新建 overrides 区块）可作为后续同类 CVE 处理模板；
  3. **跨 major 强制升级必须三重验证（test + build + 关键路径冒烟）**——uuid v11→v14 跨 3 major 是高风险变更，仅靠 lock 解析成功不构成"安全"信号；
  4. **保留即使升级后仍可能需要的兼容补丁**——本次未删 `normalize_api_base_for_litellm`，仅由测试证明它在 1.83.14 仍兼容；上游 fix 与本地补丁的潜在双重叠加（如 `/v1/v1`）需通过断言测试（已存在）守住；
  5. **建议下一步**：评估引入 `.github/dependabot.yml` 自动化 + 周度依赖安全检查（本 PR 不做，避免爆炸半径扩大）。
- **同类问题影响**：
  1. 任何后续间接依赖 CVE（特别是 npm 生态被 framework 锁住的传递依赖），首选 `pnpm.overrides` 升级而非 framework 整体升级；
  2. litellm 是高频迭代的上游，建议每月观察 1 次 changelog；其 1.83.x 系列的路径构造缺陷由本仓 `normalize_api_base_for_litellm` 补丁兜底，未来若 litellm 2.x 发布需重测该补丁；
  3. `@ag-ui/client@0.0.47` 在 ui 的 overrides 中显式 pin，长期需关注上游是否发布修订版本以减少 override 长链。

## ISSUE-025 Wiki 新建发布因 Catalog Singleton 唯一约束触发 500 InternalServerError

- **表因**：Wiki 页「新建 Wiki 发布」对话框点击「创建」时，对已存在 LIVE 发布的 Catalog 二次提交 → `POST /api/knowledge/wiki/publications → 500 Internal Server Error`，前端 toast 仅显示无信息含量的「Failed to create wiki publication: Internal Server Error」。
- **根因**：[`apps/negentropy/src/negentropy/knowledge/api.py::create_wiki_publication`](../apps/negentropy/src/negentropy/knowledge/api.py) 的 `try/except` 仅捕获 `ValueError`（参数校验），未覆盖 `sqlalchemy.exc.IntegrityError`。DB 端两条相关约束（[`uq_wiki_pub_catalog_active`](../apps/negentropy/src/negentropy/db/migrations/versions/0007_catalog_singleton_phase_a.py) 部分唯一索引 `WHERE publish_mode='LIVE'` —— Phase A 设计的「每 catalog 仅允许 1 个 LIVE 发布」与 [`uq_wiki_pub_catalog_slug`](../apps/negentropy/src/negentropy/models/perception.py) 复合唯一约束）在违反时抛 `UniqueViolationError`，沿 SQLAlchemy → ASGI 中间件栈直接漏出，未被翻译为 4xx 业务响应；前端 [`createWikiPublication`](../apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts) 仅读 `res.statusText`、不解析响应体，最终用户看不到任何排障线索。本次问题与 [ISSUE-016](#issue-016) 同型（同一端点、不同根因），属「错误处理缺失」而非「约束错误」。
- **处理方式**（**最小干预 + 双层防御 + 与 `_map_exception_to_http` 同形 SSOT 错误结构**）：
  1. **后端业务前置检查**：在 `create_wiki_publication` 拿到 `catalog` 后、调用 `wiki_svc.create_publication` 前，新增两次轻量 `select(...).limit(1)` 查询（参考 `interface/api.py:1358-1360` 既有 SubAgent 创建端点写法）：
     - 同 catalog 的 LIVE 发布命中 → `409` + `WIKI_PUB_CATALOG_LIVE_CONFLICT`，details 携带既有发布 `id` / `name` / `slug` 引导用户跳转编辑或归档；
     - 同 (catalog, slug) 命中 → `409` + `WIKI_PUB_SLUG_CONFLICT`；
     - slug 归一化复用 `negentropy.knowledge.slug.slugify`（与 service 内部一致，避免双重 slugify）。
  2. **`IntegrityError` 兜底**：包裹 `await db.commit()` 捕获 `sqlalchemy.exc.IntegrityError`（参考 `interface/api.py:1391-1395` 既有写法），按 `exc.orig` 字符串中约束名映射回相同的 409 code，覆盖竞态与未来新增约束场景；命中时显式 `await db.rollback()`。
  3. **错误体统一**：与 `_map_exception_to_http`（[`api.py:238-287`](../apps/negentropy/src/negentropy/knowledge/api.py)）同形 `{code, message, details}`；中文 message 直接面向用户。
  4. **前端透传**：`apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts::createWikiPublication` 改为复用 `handleKnowledgeError<T>` —— 既有 `parseKnowledgeError` 已能解析 `detail.message` / `detail.code` 嵌套结构（[`knowledge-api.ts:919-947`](../apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts)）；`CreateWikiPublicationDialog` 的 `toast.error(err.message)` 自然显示中文友好提示，UI 层零改动。
  5. **测试**：`tests/integration_tests/knowledge/test_wiki_publish_modes.py` 新增 `TestCreateWikiPublicationApiConflict` 三例（LIVE 冲突 / SLUG 冲突 / `CATALOG_NOT_FOUND` 回归），引入 `isolated_wiki_catalog` fixture 用 `test-wiki-pub-conflict-<uuid>` 派生独立 app_name 规避 dev DB 的 [`uq_doc_catalogs_app_singleton`](../apps/negentropy/src/negentropy/db/migrations/versions/0007_catalog_singleton_phase_a.py) 约束（即 [ISSUE-015](#issue-015) 单实例 Catalog 收敛副作用）。
- **后续防范**：
  1. **Negative Prompt：DB 唯一约束必须有 application-level 友好降级路径**——任何 `UniqueConstraint` / `CREATE UNIQUE INDEX`（含 partial）写入路径都应在端点层做「业务前置检查 + IntegrityError 兜底」双层防御；前置检查给出最清晰错误消息，IntegrityError 兜底覆盖竞态。仅靠数据库约束兜底会让用户拿到 500 + 无信息含量错误，违反 AGENTS.md「Feedback Loops」原则。
  2. **同型扫荡审计**：本仓库其他端点（`apps/negentropy/src/negentropy/{knowledge,interface,memory,auth}/api.py`）凡涉及 `db.add(...)` + `db.commit()` 组合的 INSERT / UPDATE 路径，应一并审计 `IntegrityError` 是否被显式捕获并翻译为 4xx；现已知 `interface/api.py:1336/1393/1496` 三处 SubAgent 端点已有正确写法可作为模板复用。
  3. **前端 fetch helper 写作纪律**：所有 `fetch().then(res => !res.ok ? throw new Error(res.statusText) : ...)` 形式均存在「丢响应体」缺陷，应改为 `handleKnowledgeError<T>` / `parseKnowledgeError` 统一路径；后续可在 `apps/negentropy-ui/features/*/utils/*-api.ts` 全文检索「`statusText`」做一次性扫荡。
- **同类问题影响**：
  1. **同 endpoint 历史漏洞**：[ISSUE-016](#issue-016) 已修复 `app_name NOT NULL` 缺失导致的 500，本次修复 `uq_wiki_pub_catalog_active` 触发的 500，二者同因不同果——「endpoint 缺失结构化错误处理」是结构性问题，不是单次 bugfix。
  2. **`update_wiki_publication` / `archive` / 等同类端点**未做约束冲突防御，未来若新增约束（如 `theme` 唯一性、跨 app 互斥），会复现同型问题；建议在 service / DAO 层统一接入领域异常 + 端点层 `_map_exception_to_http` 路径（本次按最小干预原则未推进，记录为可观测的债务）。

---

## ISSUE-026 Knowledge Base Retrieve 全屏空白：前端聚合层静默吞噬 rejection × 后端 hybrid 缺降级路径

- **表因**：用户在 `/knowledge/base` 页输入查询词、勾选 Corpus、选择 hybrid 模式，点 Retrieve 后**结果区完全空白且无任何错误提示**。后端日志可见 `POST /knowledge/base/{id}/search → 500` 与 `infrastructure_error`（litellm 调 Gemini `:batchEmbedContents` 上游返 `400 {"error":{"message":"request body doesn't contain valid prompts"}}`）。
- **根因**（双层 Bug，缺一不可）：
  1. **前端**（`apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts::searchAcrossCorpora` 旧实现）：`Promise.allSettled` 后只读取 `fulfilled` 分支，`rejected` 直接 `forEach` 跳过、调用方收到 `{count:0, items:[]}` —— 当**全部** Corpus 均失败（或仅勾选一个）时无错误抛出。`handleRetrieve`（`app/knowledge/base/page.tsx`）走"成功路径"，`setRetrievalResults([])` 致 UI 空白且不触发 `retrievalError` banner。
  2. **后端**（`apps/negentropy/src/negentropy/knowledge/service.py::search` 旧实现）：hybrid / rrf 模式下 `await self._embedding_fn(query)` **未捕获 `EmbeddingFailed`**，外部 Embedding 上游故障直接传播为 500，丧失"keyword 仍可用"的优雅降级。`api.py::_map_exception_to_http` 将 `EmbeddingFailed` 与 `SearchError` 合并映射到 500，前端无法区分"自身错误（重试无意义）"与"上游错误（修复后再试）"。
- **处理方式**（分层防御 + 诊断仪器化）：
  1. **前端**：`searchAcrossCorpora` 改为聚合三态：全部 fulfilled → 原结果；部分 rejected → 返回 `errors[]` 字段 + 成功项；全部 rejected → 抛聚合错误（合并 reasons，限长 200 字符）。`SearchResults` 类型扩展可选 `errors?: SearchResultError[]`。`handleRetrieve` 在 `errors` 非空时通过 `toast.warning` 透出原因，避免静默丢失。
  2. **后端 service**：hybrid 模式 `try { embedding_fn(query) } catch EmbeddingFailed` → `query_embedding=None` 走既有 keyword-only 守卫；rrf 模式失败时走与 `not embedding_fn` 等价的 keyword 回退路径；semantic 模式仍传播 `EmbeddingFailed`（纯语义无降级语义）。**复用**已有 `_repository.keyword_search` / `_hydrate_match_metadata` / `_lift_hierarchical_matches`，零新接口。
  3. **后端 api**：拆分 `_map_exception_to_http` 中 `EmbeddingFailed` 分支映射到 `502 Bad Gateway`（保留 `code="EMBEDDING_FAILED"`）；`SearchError` 维持 500。
  4. **诊断仪器化**：`embedding.py::embed/batch_embed` 调用 litellm 前后增加结构化日志：`api_base_host`（脱敏 path/credentials 仅留 host）、`input_count`、`text_preview`、`kwargs_keys`；失败时附加 `upstream_response_text`（从 `MaskedHTTPStatusError.text` 沿异常链 `__cause__/__context__` 提取，已被 litellm 脱敏 URL，限长 500 字节）。后续同类问题用户可一眼定位"实际请求到了哪个 host + 上游原始错误"，无需 `litellm._turn_on_debug()` 全开。
  5. **测试锁定**：新增 `tests/unit_tests/knowledge/test_search_resilience.py`（5 例：hybrid/rrf 降级、semantic 传播、`EmbeddingFailed→502`、`SearchError→500`）+ `tests/unit/knowledge/searchAcrossCorpora.test.ts`（3 例：全 fulfilled / 部分 rejected / 全 rejected）。
- **后续防范**：
  1. **`Promise.allSettled` 必须聚合 rejection**：本仓库前端任何 `Promise.allSettled` 调用点都必须显式处理 `rejected` 分支（聚合抛错或 errors[] 暴露），**禁止**仅 `if (status === "fulfilled")` 的"沉默扫描"模式。建议在 `apps/negentropy-ui/features/*/utils/*-api.ts` 全文检索 `Promise.allSettled` 与 `status === "fulfilled"` 做一次性扫荡。
  2. **外部依赖错误码语义**：调用 vendor / 上游 API 失败应映射到 `502 Bad Gateway`（不是 500），让前端能区分"我自己的 bug"与"对端坏了"。本次以 `EmbeddingFailed` 为模板，后续 `Reranker / LLMExtractor / EntityExtraction` 等同类外部依赖失败应同步对齐。
  3. **hybrid / 多源融合检索必须保留至少一条降级路径**：任何"语义 + 关键词"融合模式当语义信号不可用时应自动退化为关键词，反之亦然。本次 `service.py::search` 已落实 hybrid 与 rrf 两种降级；新增检索模式（如未来 `cross_encoder_rerank`）需走同等"任一信号失效仍可返回结果"的契约。
  4. **诊断信号优先于"加日志再说"**：embedding / vendor 调用类的失败日志必须包含 `api_base_host`（脱敏）+ `upstream_response_text`，否则用户拿到日志也无法定位上游归属（vendor / 自建代理 / 网关）。这次将该模式落到 `embedding.py`，可作为新增 vendor 调用模板。
- **同类问题影响**：
  1. **前端聚合层**：`fetchCatalogTree` / `searchGraph` / 任何 `Promise.allSettled` + 多 corpus / 多 source 聚合的端点都需复盘是否有相同"沉默丢失 rejected"反模式。
  2. **后端外部依赖错误码**：`Reranker.rerank` / `LLMExtractor.extract` / `EntityExtractionError` / `RelationExtractionError` 等同型 `InfrastructureError` 子类目前仍走默认 500 通道，后续可统一上调到 502（与 `EmbeddingFailed` 对齐）。
  3. **环境侧排查（独立于代码修复）**：本次错误响应 JSON `{"error":{"message":"..."}}` 缺失 Google 官方必有的 `code/status` 字段，强烈倾向是 `NATIVE_GEMINI_BASE_URL` 被覆写到了非官方代理（如 `gemini-balance` / `one-api`）的 native API 模拟，其 `:batchEmbedContents` 校验不完整。用户可执行 `echo $NATIVE_GEMINI_BASE_URL` 与 `curl -H "x-goog-api-key: $KEY" -H "Content-Type: application/json" -d '{"requests":[{"model":"models/text-embedding-004","content":{"parts":[{"text":"hi"}]}}]}' http://localhost:3392/api/gemini/v1beta/models/text-embedding-004:batchEmbedContents` 直接抓上游响应定位。本次代码修复**不消除**根因故障（仍需用户配置侧排查），但**消除**"故障 → 无声空白"链路，确保用户可见可诊断。

---

## ISSUE-027 negentropy-wiki 站点 favicon.ico 不生效，浏览器回落默认地球图标

- **表因**：访问已发布的 Wiki 站点（`apps/negentropy-wiki`）时，浏览器标签页未显示 Negentropy 品牌图标，回落为默认地球图标；标签内文字「Negentropy」可见，但图标缺位影响品牌识别。
- **根因**：`apps/negentropy-wiki/src/app/favicon.ico` 是**畸形 ICO 文件**——
  1. 通过 `file(1)` 检验：`MS Windows icon resource - 1 icon, 256x-1, 32 bits/pixel`，仅含**单一分辨率**条目，且高度字节为 `0xFF`（=255）而非合法的 `0x00`（=256）；十六进制头部 `0000 0100 0100 00ff …` 第 7 字节即为高度，确认编码异常。
  2. 内嵌 BMP DIB 高度为 510（ICO 规范该字段为图像两倍高），即实际像素为 256×255 非方形；
  3. 文件体积 269,342 字节（远超合理 favicon 体量），暗示是源 PNG 直接外裹 ICO 头未做尺寸归一与多档生成；
  4. 源图 `apps/negentropy-wiki/public/logo.png` 本身是 800×798 非方形 PNG，转换工具未做 padding/裁切便直接吐出畸形 ICO。

  现代浏览器（Chrome / Firefox / Safari）对此类「单分辨率 + 非方形 + 高度字段错误」组合解析失败，按规范回退默认图标。
- **已排除的伪因**（避免下次走同样弯路）：
  1. 中间件 / 代理拦截：`apps/negentropy-wiki/next.config.ts` 仅 rewrites `/api/:path*`，不涉及 `/favicon.ico`；
  2. 顶层动态路由 `[pubSlug]/page.tsx` 拦截：Next.js App Router 文件系统型 metadata（`favicon.ico` / `icon.{ts,png}`）优先级**高于**任何 `[slug]` dynamic segment，本机 `curl -I /favicon.ico` 返回 `image/x-icon`、`curl -I /<random-slug>` 返回 HTML，证明无误命中；
  3. standalone 构建产物缺失：`pnpm build` 后 `.next/standalone/.next/server/app/favicon.ico/route.js` 与同级 `favicon.ico.body` / `favicon.ico.meta` 均存在，`start-production.mjs` 通过 `server` 子目录链接已涵盖；
  4. layout.tsx 元数据冲突：`metadata.icons.apple = "/logo.png"` 仅追加 `<link rel="apple-touch-icon">`，不影响 `<link rel="icon">` 自动注入。
- **处理方式**（最小干预 + 复用驱动）：
  1. 用 `uv run --with 'pillow>=11' --no-project python` 调 Pillow 对 `public/logo.png` 做 `ImageOps.pad` 居中透明 padding 至方形（800×800），再 `Image.save(format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])` 一次性生成多分辨率 ICO，覆盖原 `src/app/favicon.ico`；
  2. 不动 `layout.tsx` / `next.config.ts` / `start-production.mjs`，保留 App Router 自动注入路径；
  3. 验证链：`file ...favicon.ico` 显示 `6 icons, 16x16 ... 256x256 PNG image data` ✓；`pnpm build && pnpm start` 后 `curl -I http://localhost:3092/favicon.ico` 返回 `200 / image/x-icon / 118192 bytes` ✓；首页 HTML 自动注入 `<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16"/>` ✓。
- **后续防范**：
  1. **ICO 必须方形 + 多分辨率**：任何 favicon.ico 入库前需走 `file <path>` 自检，至少包含 16×16 / 32×32 两档，且尺寸为方形；非方形源图必须先 padding 或裁切为正方形再转换；
  2. **优先复用 Pillow 流水线**：本仓库后续新增/替换 favicon 时，沿用本次 Pillow `ImageOps.pad` + `save(format="ICO", sizes=[…])` 模板，禁止使用未经 padding 的「原图直裹 ICO 头」流程；
  3. **PR 自证截图**：涉及 favicon 等品牌资产的 PR 必须附「浏览器 tab 截图（替换前 / 替换后）」与 `file` 命令输出截图，避免依赖肉眼判断；
  4. **参照样板**：`apps/negentropy-ui/app/favicon.ico` 为 9 档多分辨率正确范本（`file` 输出含 `9 icons, 16x16 ... 32 bits/pixel`），可作为对照基线。
- **同类问题影响**：
  1. 凡通过自动化脚本生成 ICO 的入口（包括未来可能的 `apps/*/src/app/favicon.ico`、`apps/*/src/app/icon.{png,svg}`、`apps/*/src/app/apple-icon.png`）均需复核是否走 padding+多档流程；
  2. 已发布 Wiki Publication 的 OpenGraph / Twitter Card 图（如未来引入 `apps/negentropy-wiki/src/app/opengraph-image.{png,jpg}`）同样存在「非方形源图直接交付」风险，建议在引入前预设统一的资产生成脚本（`scripts/build-icons.mjs` 或 `scripts/build-icons.py`）作为单一事实源。

---

## ISSUE-028 Knowledge Base Retrieve 查询时未使用 Corpus 自配 Embedding 模型，导致 query/index 模型不一致

- **表因**：用户在 Corpus Settings 页已显式选定 `Embedding Model = openai/text-embedding-3-small`（1536 维），执行 Retrieve（hybrid 模式）时后端仍使用全局默认 `gemini/text-embedding-004`，该模型经 `localhost:3392` 翻译代理对 Gemini `batchEmbedContents` 实现不全，返回 `400 "request body doesn't contain valid prompts"`，重试 3 次失败 → HTTP 500（ISSUE-026 的 keyword 兜底已在后续 commit 落地，但 embedding 模型选择的契约缺口仍存在）。
- **根因**：**索引侧与查询侧 embedding fn 解析路径不对称**：
  1. **索引侧**（`service.py::_attach_embeddings`，line 2906-2913）：读 `corpus.config['models']['embedding_config_id']`，命中则 `build_batch_embedding_fn(embedding_config_id)`，走 corpus 自身配置；
  2. **查询侧**（`service.py::search`，line 2540-2542 / 2625-2629）：直接使用实例化时锁定的 `self._embedding_fn`（全局默认 fn），**从未读 corpus.config**。
  后果：索引产物按 OpenAI 1536 维生成，查询走全局默认 gemini/text-embedding-004（768 维）→ 模型不一致 + 上游链路故障双重失败。
- **处理方式**（最小干预 + 索引/查询对称化）：
  1. 新增 `_resolve_embedding_fn(corpus_config)` 私有方法（紧邻 `_extract_embedding_config_id`），复用 `build_embedding_fn` + `_extract_embedding_config_id`，corpus pin 优先 → 退回 service 默认 fn；
  2. `search()` 入口新增 `corpus_config = await self._get_corpus_config(corpus_id)` + `embedding_fn = self._resolve_embedding_fn(corpus_config)`；
  3. rrf / hybrid / semantic 三分支的 `self._embedding_fn` 替换为本地变量 `embedding_fn`；
  4. ISSUE-026 的 `EmbeddingFailed → keyword 兜底`、`502 映射`、诊断日志（`api_base_host` + `upstream_response_text`）原样保留，零回归；
  5. 配套 5 例单元测试：corpus pin 命中 / 落空 / hybrid keyword 兜底 / rrf 走 pin / semantic 失败上抛，回归 ISSUE-026 的 5 例全部绿色。
- **后续防范**：
  1. **索引/查询 fn 解析必须对称**：任何新增"按 corpus 选择 fn"的场景（如 reranker fn、LLM extractor fn）需同时检查 `_attach_embeddings` 索引侧与 `search` 查询侧是否共用同一条判别逻辑。建议将 `_resolve_embedding_fn` 模式推广为通用 `_resolve_fn_for_corpus(corpus_config, fn_type)` 助手。
  2. **corpus 级配置消费审计**：新增 corpus.config 子键（如 `models.reranker_config_id`）时，需逐路径确认 `search()`、`_attach_embeddings()`、`semantic_chunk_async()` 三处消费点均覆盖。
- **同类问题影响**：
  1. **chunking 阶段** `semantic_chunk_async`（service.py:2783）仍直接使用 `self._embedding_fn`，属于 index-time 另一支路；若 Hierarchical 模式需要按 corpus 配切 embedding 模型，需同法修补；
  2. **LLM 模型对称性**：`KnowledgeQA` / `extractor` 路径中 LLM 模型的 corpus 级解析是否对称，需独立审计。

---

## ISSUE-029 Home Ping 500 复发：文档侧 `--reload_agents` 未同步 `cli.py` 修复

- **表因**：用户在 Home 页发送 "Ping, give me a pong"，前端无响应；后端日志 `POST /run_sse` 返回 500，异常 `ValueError: Agent not found: 'negentropy'. No matching directory or module exists in '.../src/negentropy/negentropy'`。
- **根因**：`cli.py` 的 `agents_dir` 已在 commit `35204ff` 从 `src/negentropy` 修正为 `src`（通过 `Path(__file__)` 推导绝对路径，免疫 cwd 漂移），但 `README.md`、`docs/zh-CN/README.md`、`docs/architecture/development.md`、`docs/user-guide.md` 共 4 个文件 7 处启动命令仍写 `uv run adk web --port 8000 --reload_agents src/negentropy`。用户照文档启动后端复现旧 bug。
- **二阶影响**：错误 `agents_dir` 导致 `src/services.py`（ADK `load_services_module` 桥接）不被加载，`apply_adk_patches()` 完全不执行 → 5 条扩展路由（`/auth`、`/knowledge`、`/memory`、`/interface`、`/sessions`）缺失，所有自定义中间件（`TracingInitMiddleware`、`AuthMiddleware`）不挂载，LiteLLM OTel callback 不注册，模型配置缓存不预热。错误命令的爆炸半径远不止 500。
- **处理方式**：将所有文档中的 `uv run adk web ... --reload_agents src/negentropy` 统一替换为 `uv run negentropy serve ...`。CLI 包装器在 [`cli.py`](../apps/negentropy/src/negentropy/cli.py) 用 `Path(__file__)` 锚定 agents_dir，是单一事实源（SSOT），用户无需记忆易错的 `--reload_agents` 参数值。
- **后续防范**：
  1. **代码与文档 SSOT 联动**：修改 `cli.py` 的启动参数或默认值后，**必须**同步 grep 全仓文档（`grep -rn "adk web\|reload_agents" --include="*.md" .`）确保一致性；
  2. **启动命令归口**：文档中一律推荐 `uv run negentropy serve`，不再直接暴露 `adk web` 命令；
  3. **CHANGELOG 自检**：涉及 CLI/启动参数的 PR 在 CHANGELOG 条目中显式标注「文档已同步」或「仅代码侧」。
- **同类问题影响**：其他被 CLI 包装的底层命令（如未来可能的 `uv run negentropy migrate` 包装 `alembic upgrade head`），若文档仍直接引用底层命令且参数有差异，同样存在漂移风险。

## ISSUE-030 SubAgents 主 Agent（NegentropyEngine）同步防回归

- **表因**：用户在 SubAgents 页点击 "Sync Negentropy" 后，toast 显示 "Synced: created 0, updated 5, skipped 0"，页面仅出现 5 个子 Agent 卡片，缺少主 Agent（NegentropyEngine）。
- **根因**：用户运行的是旧版后端（commit `35204ff feat(agent-defs)` 之前）。旧版 `build_negentropy_subagent_payloads()` 仅返回 5 个 subagent payload，不含 root Agent。当前代码已修正：`subagent_presets.py` 返回 6 个 payload（1 root + 5 subagent），前端 `SubAgentCard.tsx` 有 Root 徽章，`page.tsx` 有 root 置顶排序。用新代码重新 sync 后 DB 会 `created=1`（root）+ `updated=5`（subagents），主 Agent 卡片正常出现。
- **处理方式**：纯文档侧修复（同步启动命令），消除用户复现旧 bug 的路径。运行时代码已正确，无需修改。
- **后续防范**：
  1. **Sync 诊断**：若再次出现「sync 计数与预期不符」，检查后端版本是否包含 `build_negentropy_root_agent_payload()`，以及 DB 中是否存在 `owner_id` 不匹配的旧行；
  2. **Root Agent 只读约束**：当前 SubAgents 页对 root Agent 的 Edit/Delete 操作未做只读限制（root Agent 的结构定义由代码硬编码，编辑 instruction/model 通过 InstructionProvider/DynamicModel 在运行时生效，但 sub_agents/tools 等结构性字段不可通过 UI 变更）。建议后续在 UI 层对 `kind === "root"` 卡片禁用 Delete、对结构性字段标灰。
- **同类问题影响**：若后续新增 Pipeline Agent（如 `KnowledgeAcquisitionPipeline`、`ProblemSolvingPipeline`、`ValueDeliveryPipeline`）到 sync payload 中，需同步更新 toast 预期计数（从 6 增至 9）。

---

## ISSUE-031 Home 页长耗时回复双气泡 + 首条未格式化（语义去重 8s 时间窗在 ADK partial/final 非对称下失效）

- **表因**：用户在 Home 主聊天页发送 "Ping, give me a pong" 后，Agent 同一条回复被渲染为两个独立气泡：第一个气泡处于"流式中"视觉态（amber 虚线边框 / `border-dashed border-amber-300/70`）且内容以未格式化纯文本呈现；第二个气泡才以正常 Markdown 渲染。
- **根因**（多层级联）：
  1. **ADK 持久化与实时流的非对称性**：ADK 流式产出多条 `partial=true` 增量片段 + 一条 `partial=false` 终态事件，但仅持久化终态事件。`AdkMessageStreamNormalizer.consume()` (`apps/negentropy-ui/lib/adk.ts:131`) 用首个 partial 的 `payload.id` 锁定 openMessage 的 `messageId`；hydration 重放时只看到终态事件，于是用终态自身的 `payload.id` 创建新 openMessage。**realtime ledger entry id ≠ hydration ledger entry id**。
  2. **语义去重的 8s 时间窗硬拒绝**：`apps/negentropy-ui/utils/message-ledger.ts::isSemanticEquivalentEntry` 通过内容近似 + 8s 时间窗匹配 messageId 不同的实时/历史 entry。但 realtime 的 `createdAt = MIN(所有 partial 时间戳) = T1`（流式开始），hydration 的 `createdAt = Tf`（流式结束）。当生成耗时 `Tf - T1 > 8s`（多段落 / 列表型答复极易越过），硬拒绝触发，去重失败。
  3. **失败级联**：`mergeEventsWithRealtimePriority`（`session-hydration.ts:175`）依赖语义等价 → hydrated 文本事件未过滤；`mergeMessageLedger`（`message-ledger.ts:412`）同样失败 → ledger 双 entry；`buildConversationTree`（`conversation-tree.ts:576`）的 `findMatchingTextNodeId` 第 372 行硬过滤 `streaming !== true` 节点，已收尾的 realtime 节点被跳过 → 走 fallback 分支新建 `message:F` 节点 → `walkTurnNode`（`chat-display.ts:500`）在同一 turn 下产出双 assistant 气泡。
- **处理方式**（最小干预 + 正交分解）：
  1. **主修复**：`isSemanticEquivalentEntry` 在 trim 后内容**严格相等**时跳过 8s 时间窗硬拒绝（`message-ledger.ts:99-108`）。同 threadId+runId+role+strict-equal 已收敛 → 不可能是两条独立消息。
  2. **防御性收敛**：`findMatchingTextNodeId` 在 assistant 路径下，当现有节点已收尾但内容严格相等时仍允许复用（`conversation-tree.ts:368-393`），避免 hydrated CONTENT 落入 fallback 分支。user 路径仍要求流式态，避免误并历史用户消息。
  3. **回归测试**：`message-ledger.test.ts` / `session-hydration.test.ts` / `conversation-tree.test.ts` 各新增一条覆盖 ">8s 跨度 + messageId 不同 + 内容严格相等" 的端到端用例。
- **后续防范**：
  1. **时间窗参数化警惕**：任何"基于固定时间窗的等价/去重"判定（如这里的 8s）都隐含「事件链路在该时间内完成」假设。当上游链路存在「分段产出 + 终态合并」模式（ADK partial/final、流式 LLM 的 chunk 合并、批量 ETL 的 staging→commit）时，应用层时间窗必须考虑分段间隔可能超过预期阈值，优先采用「内容严格相等 + 业务键收敛」做主判别，时间窗仅作辅助。
  2. **正交分解修复**：UI 重复渲染问题应在三层（ledger 去重、events 过滤、tree 节点匹配）独立加固，而非单点修补，避免某层规则更新后另两层退化为兜底失效。
  3. **Realtime/Hydration 对称性审计**：实时流与历史回放共用同一组 normalizer + ledger + tree 构建器是 SSOT 的体现；任何分支引入的"仅在某条路径生效"的 ID 生成 / 时间戳映射 / 结构变换，都应同步在另一路径补齐对称行为。
- **同类问题影响**：
  1. ADK 之外其他流式来源（如 OpenAI / Anthropic streaming SDK 直连）若遵循 partial/final 分别持久化的模式，触发同样的 messageId 漂移；本次修复对它们同样生效。
  2. 工具调用链路：`openMessage` 在 `messageShouldFlushAfterPayload` 触发 flush 时关闭。若 tool call 前后两段同内容 assistant 文本被 flush 切分为独立 message，同样会因 messageId 不同被本次的「严格内容相等」逻辑收敛——这是预期行为（同 turn 同内容理应合一）。
  3. 后续若引入 reranker / re-extract 阶段对消息 content 做规范化重写，需重新评估「严格内容相等」的命中率；必要时在 `isEquivalentMessageContent` 已有的容错下扩展（含/被含 + Jaccard）。

---

## ISSUE-032 Home 对话子任务 title 生成 `litellm.AuthenticationError`：缓存 miss 后回退到无 api_key 的硬编码默认

- **表因**：用户在 Home 页发送 "Ping, give me a pong"，主对话回复正常，但后端日志反复出现 `WARNING engine.summarization | title_generation_failed error=litellm.AuthenticationError: AuthenticationError: OpenAIException - The api_key client option must be set ...`。前端会话标题始终显示首条 user 消息截断版（fallback），不出现 LLM 生成的语义化标题。
- **根因**：`apps/negentropy/src/negentropy/engine/summarization.py::SessionSummarizer.__init__` 是同步方法，调用 `get_cached_llm_config()`（`config/model_resolver.py:68`）从内存缓存读默认 LLM 配置；缓存 TTL 仅 60s（`_CACHE_TTL=60.0`，`model_resolver.py:29`），bootstrap 启动时 `_warm_model_config_cache` 预热后即开始倒计时。缓存 miss 时回退到 `get_fallback_llm_config()` → 硬编码 `_DEFAULT_LLM_KWARGS = {"temperature": 0.7, "drop_params": True}`（`model_resolver.py:33-36`），**不含 `api_key`**。LiteLLM 在 `_build_completion_args` 时未拿到凭证，直接抛 `AuthenticationError`。这与 commit `8ce35d5 fix(agent-llm)` 修复的 `DynamicRootLiteLlm` 是同源问题——主对话路径已切换到 `await resolve_llm_config()` 走 DB 凭证，但 title 生成这条子对话路径未同步覆盖。
- **二阶影响**：
  1. 后台任务静默失败：`_generate_title_for_session` 仅 `logger.warning` 不抛异常，前端无明确错误反馈；
  2. 体感：每个新会话首条消息后约 60s（缓存窗口外）触发一次 warning，干扰排障；
  3. 配置漂移盲区：用户修改 vendor_configs 后立即测 title 生成可能恰好命中缓存窗口而表现正常，下次冷启动反而失败——故障复现具有时间窗口性，难诊断。
- **处理方式**（最小干预 + 异步边界对称化）：
  1. **`SessionSummarizer.__init__` 重构**：签名改为 `def __init__(self, model: LiteLlm)`，仅承担「持有已构造模型实例」职责，不再做凭证解析；
  2. **新增 `@classmethod async def create(cls)` 工厂**：内部 `name, kwargs = await resolve_llm_config()`（`model_resolver.py:104`，与 `_dynamic_model.py:132` 同 SoT），`kwargs = dict(kwargs)` 防御性浅拷贝，注入 `max_tokens=20`，返回 `cls(LiteLlm(name, **kwargs))`；
  3. **调用方切换**：`apps/negentropy/src/negentropy/engine/adapters/postgres/session_service.py:291` 把 `summarizer = SessionSummarizer()` 改为 `await SessionSummarizer.create()`，外层 try/except 已覆盖；
  4. **测试**：新增 `tests/unit_tests/engine/test_summarization.py` 3 例，分别锁定「`create()` 走 `resolve_llm_config` 注入凭证 + max_tokens」「kwargs 防御性拷贝不污染上游」「`__init__` 仅接收实例」。
- **后续防范**：
  1. **凡是「构造 LLM 客户端」的代码路径必须走 async resolver**：grep `LiteLlm(`、`get_cached_llm_config`、`get_fallback_llm_config`，若仍存在 `__init__` 同步路径，需评估是否同样存在 cache miss 回退到无凭证默认的风险；
  2. **硬编码 fallback 的边界守则**：`_DEFAULT_LLM_KWARGS` 不含 `api_key` 是合理的（避免硬编码密钥），但意味着 fallback 路径**必然**无法直接发起 LLM 请求——任何消费 fallback 的代码必须有显式凭证注入流程（典型如 vendor_configs 表读写）；如未来引入"完全无凭证场景"（mock 模式 / dry-run），需独立 sentinel 而非依赖 fallback 兜底；
  3. **缓存 miss 不应是隐性失败**：`get_cached_llm_config` 返回 `None` 时调用方应明确路径选择（要么 await resolve，要么返回错误），不应 silently fall through 到 fallback；
  4. **commit `8ce35d5` 模式补全审计**：`_dynamic_model.py` 的 `await resolve_llm_config()` 修复模式应推广到所有「默认模型路径」的消费点，非仅 root agent 与 title generator。
- **同类问题影响**：
  1. 任何继承自 `LiteLlm` 或在同步 `__init__` 中构造 LLM 客户端的代码（`SubAgent` 工厂、`KnowledgeQA` 抽取器、未来的 `Pipeline Agent`）；
  2. Embedding 端：`build_embedding_fn` 路径若有同步 cache miss 回退到不含凭证的硬编码默认，存在同类风险，需独立审计；
  3. 跨 Agent 复用同一 ContextVar 的场景，若 ContextVar 在子任务中被清空（如 `_generate_title_for_session` 离开主请求 ContextVar 链路）也会触发"凭证消失"——本次修复对 title 路径恰好通过 `resolve_llm_config()` 直读 DB 绕开了 ContextVar 依赖，可作为同类场景模板。

---

## ISSUE-033 OTLP HTTP `_log_exporter` / `_metric_exporter` 反复 404：ADK 把 `OTEL_EXPORTER_OTLP_ENDPOINT` 当三件套总开关、Langfuse 仅承接 traces

- **表因**：Home 页发起对话期间，后端日志反复出现 `ERROR http._log_exporter | Failed to export logs batch code: 404, reason: <!DOCTYPE html>...Langfuse Icon...statusCode":404`——返回的是 Langfuse 前端 SPA 的 404 错误页（包含 `_next/static/...`、`Langfuse Icon`、`Loading...` 等大段 HTML），每条日志数 KB，每分钟级反复输出污染日志可读性。Metrics 路径同源 404 但触发频率较低（`enable_metrics=False` 时仅在 ADK 系统 metric 偶发触发）。
- **根因**：契约错配 + 框架自动注册行为：
  1. `apps/negentropy/src/negentropy/engine/bootstrap.py:50` 设置 `OTEL_EXPORTER_OTLP_ENDPOINT=<langfuse_host>/api/public/otel`，本意仅供 LiteLLM `"otel"` callback 在 `_normalize_otel_endpoint` 时拼成 `/v1/traces` 上报 traces；
  2. 上游 ADK `google/adk/cli/adk_web_server.py:524-533` 的 `_otel_env_vars_enabled()` 把这个 env var 视为「启用 OTLP 三件套」的总开关，调用 `_setup_telemetry_from_env()` → `maybe_set_otel_providers()` → `_get_otel_exporters()`（`google/adk/telemetry/setup.py:131-154`）；
  3. `_get_otel_exporters()` 在该 env var 存在时**无差别**追加三个 processor：`OTLPSpanExporter`（traces，正常）、`OTLPMetricExporter`（metrics，404）、`OTLPLogExporter`（logs，404）；
  4. `OTLPLogExporter` 默认行为（`opentelemetry/exporter/otlp/proto/http/_log_exporter/__init__.py:87-92`）：未配置 `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` 时回退到 `OTEL_EXPORTER_OTLP_ENDPOINT` 并通过 `_append_logs_path` 追加 `/v1/logs` → 命中 `https://cloud.langfuse.com/api/public/otel/v1/logs`；
  5. Langfuse 仅支持 `/api/public/otel/v1/traces`，不存在 `/v1/logs` / `/v1/metrics` 接口 → SPA 路由回退到 `/_error` 页面 → 返回 404 + 整段 HTML；
  6. `opentelemetry-instrumentation-google-genai`（CHANGELOG `feat(adk-genai-otel)` 引入）的 `instrumentor.py:53-54` 通过 `get_logger_provider().get_logger(...)` 主动写入 GenAI events，激活了上面的 logs 上报路径——所以每个对话都触发一批 404；
  7. `set_logger_provider` / `set_meter_provider` 由 `Once`-lock 保护（`opentelemetry/_logs/_internal/__init__.py:276-305`）：首次调用胜出，后续调用静默忽略（仅 warning）。
- **二阶影响**：
  1. 日志噪声严重影响排障——大段 HTML 反复刷屏；
  2. 网络消耗：每秒级 OTLP batch flush 持续向 Langfuse 上报无用数据；
  3. 用户误以为 Langfuse 配置错误（实际 traces 链路完全正常）。
- **处理方式**（手术刀式 + 最小干预）：
  1. **抢占 Once-lock**：在 `bootstrap.py` 设置 OTel env vars 之后、ADK Web Server 实例化之前，新增 `_install_noop_otel_logs_metrics_providers()` helper：用「无 processor / 无 reader」的 SDK `LoggerProvider()` 与 `MeterProvider(metric_readers=[])` 作为占位 provider，调用 `set_logger_provider` / `set_meter_provider`；
  2. **效果**：ADK 后续 `_setup_telemetry_from_env` 路径下的 `set_*_provider` 调用因 `Once`-lock 静默 no-op，OTLPLogExporter / OTLPMetricExporter 虽被构造但其所属 LoggerProvider / MeterProvider 永远不会成为 global 实例，从而**整条 logs/metrics 上报链路被阻断**；
  3. **traces 链路完全不动**：TracerProvider 由 ADK / LiteLLM 自行 `set_tracer_provider`（首次胜出），`OTEL_EXPORTER_OTLP_HEADERS`（Basic Auth）仍生效，traces 正常进入 Langfuse；
  4. **测试**：新增 `tests/unit_tests/observability/test_otel_noop_providers.py` 3 例，子进程隔离 OTel 全局状态，分别验证「LoggerProvider 是 SDK 实例且 0 processor」「MeterProvider 是 SDK 实例且 0 reader」「后续 set_logger_provider 因 Once-lock 不替换」。
- **为何不选"改用 `OTEL_ENDPOINT`"方案**：LiteLLM 确实可从 `OTEL_ENDPOINT`（line 114 fallback）读端点，但 ADK 完全不识别 `OTEL_ENDPOINT`，会让 `_otel_env_vars_enabled()` 返回 False → traces/metrics/logs 三件套全不注册——虽然消除了 logs 404，但 ADK 的 `ApiServerSpanExporter`（in-memory trace UI 后端）也失效，副作用过大。手术刀式（仅抑制 logs/metrics）才符合 Boundary Management 原则。
- **后续防范**：
  1. **OTel global provider 抢占模式**：当系统内有多个 OTel consumer（LiteLLM / ADK / Langfuse / Phoenix / SigNoz）且各自对 logs/metrics/traces 三件套支持矩阵不同时，必须显式管理"谁先 set_*_provider"；推荐统一在应用 bootstrap 早期抢注期望行为的 provider，避免依赖隐式注册顺序；
  2. **环境变量契约审计**：上游框架（ADK / OpenLLMetry / OpenInference）对 `OTEL_EXPORTER_OTLP_*` 的解释可能与单纯 OTel SDK 不同（如 ADK 把它当三件套总开关），引入新框架时需独立验证；
  3. **后端兼容性矩阵明文化**：在 `negentropy.config.observability` 文档化「Langfuse 仅支持 traces」「Phoenix 支持 logs+traces」「SigNoz 支持三件套」等契约，避免重复踩坑；
  4. **未来若需启用 GenAI events**：把当前 `_install_noop_otel_logs_metrics_providers` 替换为带 `BatchLogRecordProcessor(<目标 backend exporter>)` 的实质 LoggerProvider 即可，本次抢占模式天然支持平滑升级（Once-lock 仍保证唯一注册）。
- **同类问题影响**：
  1. 任何上游框架基于 env var 自动启用次级遥测路径（如 `OTEL_RESOURCE_ATTRIBUTES`、`OTEL_PROPAGATORS`）的场景；
  2. 多 SDK 共存的 instrumentation 环境（`opentelemetry-instrumentation-*` 各自调用 `get_*_provider()`）；
  3. 升级 google-adk / google-genai-instrumentation / litellm 版本时，需复核它们对 logs/metrics 的处理是否变更（如未来 LiteLLM `enable_metrics=True` 默认开启，需同步审计）。

---

## ISSUE-034 ADK Web 启动期两条 OTel `Overriding of current ... Provider` WARNING：抢占式 set provider 副作用 → 改为 patch ADK `_get_otel_exporters` 根因抑制

- **表因**：`uv run adk web --port <p> --reload_agents src` 启动期 stderr 反复出现：
  ```
  WARNING |     metrics._internal | Overriding of current MeterProvider is not allowed
  WARNING |       _logs._internal | Overriding of current LoggerProvider is not allowed
  ```
  污染启动日志可读性，且每次启动都触发，给排障带来噪声。
- **根因**：ISSUE-033 的"抢占式 set provider"修复方案的天然副作用：
  1. `apps/negentropy/src/negentropy/engine/bootstrap.py:40-59` 旧 `_install_noop_otel_logs_metrics_providers()` 在导入早期主动 `set_logger_provider(NoExporterLoggerProvider())` / `set_meter_provider(NoExporterMeterProvider(metric_readers=[]))`；
  2. ADK Web 启动 `_setup_telemetry_from_env()` → `maybe_set_otel_providers()` → 第二次调用 `set_logger_provider` / `set_meter_provider`；
  3. OTel SDK 的 `Once`-lock 保护使第二次调用静默失败，但**仍会通过 `_logger.warning` 打印** "Overriding of current ... is not allowed"（参见 `opentelemetry/_logs/_internal/__init__.py` 与 `opentelemetry/metrics/_internal/__init__.py` 的 `_set_*_provider` 实现）。
- **二阶影响**：日志噪声 + 误导用户怀疑配置错误（实际 traces 链路完全正常，logs/metrics 也按 ISSUE-033 设计被阻断）。
- **处理方式**（治本，最小干预）：把"抢占 SDK provider"替换为"patch ADK 上游 OTel 拼装入口"，ADK 根本不再调用 `set_logger_provider` / `set_meter_provider`：
  1. `bootstrap.py` 删除 `_install_noop_otel_logs_metrics_providers()`，新增 `_disable_adk_otel_logs_metrics_exporters()`；
  2. 该 helper monkey-patch `google.adk.telemetry.setup._get_otel_exporters`：调用原函数后强制把 `metric_readers` / `log_record_processors` 置空、保留 `span_processors`；
  3. ADK `maybe_set_otel_providers` 内部 `if metric_readers:` / `if log_record_processors:` 分支由此短路（参见 `google/adk/telemetry/setup.py:102, 113`），`set_*_provider` 根本不被调用 → WARNING 从源头消除；
  4. `span_processors`（traces 链路）保留原 `BatchSpanProcessor(OTLPSpanExporter())`，traces 仍正常上报到 Langfuse `/v1/traces`；
  5. 加 `_negentropy_patched` 属性做幂等保护，与 `apply_adk_patches()` 中既有惯用法（如 `AdkWebServer.get_fast_api_app._negentropy_patched`）一致；
  6. 测试更新 `tests/unit_tests/observability/test_otel_noop_providers.py` 3 例（子进程隔离 OTel 全局状态）：
     - patch 后 `_get_otel_exporters()` 返回的 `metric_readers` / `log_record_processors` 为空、`span_processors` 仍为 1 个 `BatchSpanProcessor`；
     - patch 幂等（重复调用函数对象不变）；
     - 模拟调用 `maybe_set_otel_providers` 后全局 `LoggerProvider` / `MeterProvider` 仍是默认 ProxyProvider（**不是** SDK 实例），证明 set 调用未发生。
- **行为对照**：
  | 调用                                                         | 修复前                                                   | 修复后                                         |
  | ------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------- |
  | `_logs.set_logger_provider`                                  | 项目 + ADK 各 1 次（第二次 warn）                        | **零次**                                       |
  | `metrics.set_meter_provider`                                 | 项目 + ADK 各 1 次（第二次 warn）                        | **零次**                                       |
  | `trace.set_tracer_provider`                                  | ADK 1 次（含 OTLP traces + ApiServerSpanExporter）       | 不变                                           |
  | `opentelemetry-instrumentation-google-genai` 写 GenAI events | 拿到 NoExporter SDK LoggerProvider（无 processor，丢弃） | 拿到默认 ProxyLoggerProvider（同样 NoOp 丢弃） |
  | LiteLLM `"otel"` callback 上报 traces                        | → Langfuse `/v1/traces`                                  | 不变                                           |
- **后续防范**：
  1. **OTel 抢占模式陷阱**：抢占式 `set_*_provider` 虽能利用 `Once`-lock 阻断后续注册，但**SDK 仍会输出 WARNING**——治本方案应当是阻止上游"想 set"，而非依赖"set 失败 + 静默吞错"；
  2. **优先 patch 上游拼装入口**：当框架（ADK）在某个唯一入口（`_get_otel_exporters`）拼装多类 telemetry hooks 时，patch 该入口比 patch 各 `set_*_provider` 调用更精准；
  3. **平滑升级到完整 OTLP 三件套**：未来若启用 SigNoz / Phoenix 等支持 logs+metrics 的 backend，把 `_disable_adk_otel_logs_metrics_exporters()` 改为有条件地透传 `metric_readers` / `log_record_processors` 即可（建议联动 `negentropy.config.observability` 加 `suppress_otlp_logs_metrics: bool` 开关）；
  4. **ADK 升级兼容审计**：本 patch 直接替换 `_get_otel_exporters` 函数对象并依赖 `OTelHooks` dataclass 的 `span_processors` / `metric_readers` / `log_record_processors` 字段名。`google-adk` 升级时（`pyproject.toml` line 27 已锁版本范围）需 grep 该函数与 dataclass 是否变更。
- **同类问题影响**：
  1. 任何"抢占 OTel global provider"模式都会在上游再次 set 时触发 WARNING——但凡 SDK 依赖此类副作用的代码都应回归"上游 patch"思路；
  2. 类似 `opentelemetry-instrumentation-*` 系列在 `OTel SDK` 之上做隐式 set 的场景（如 `langfuse.openai`、`openinference` 自动埋点），引入时需复核其是否走 `set_*_provider` 路径。

---

## ISSUE-035 AI Agent 在 sandbox 浏览器中走项目 Google OAuth 被同意屏拦截：登录态不可复用导致验证链路中断

- **表因**：AI Agent（Claude / Antigravity）在沙箱形态浏览器（Playwright 默认 `chromium.launch()` 启的空白 profile）中打开 [`localhost:3192`](http://localhost:3192) 触发项目自带的 Google OAuth 流（`/auth/google/login` → `accounts.google.com` → `/auth/google/callback`，参见 [docs/sso.md](../infrastructure/design/sso.md)），跳转到 `accounts.google.com` 后因该浏览器无任何 Google 登录态，被同意屏 / reCAPTCHA / 二步验证拦截，验证链路在此中断；用户被迫多次手动接管或放弃验证。
- **根因**：双重契约错配：
  1. **会话来源错配**：默认 sandbox 浏览器的 cookie store / device fingerprint / IP 风险评分均与用户日常 Chrome 不同，Google 风控将其视为可疑设备；即便用户在沙箱内输入正确账密，亦极易被强制拉起二次验证或拒绝；
  2. **工具选型缺位**：项目 [CLAUDE.md（即 AGENTS.md）](../CLAUDE.md) 此前未约定"涉及登录态的浏览器验证应优先使用与用户常用 Chrome 共享会话的工具"，AI Agent 默认走 sandbox 即陷入上述风控；
  3. **Playwright E2E 同样缺位**：`apps/negentropy-ui/playwright.config.ts` 之前无 `setup` project / `storageState` / `userDataDir` 复用机制，凡涉及真实 OAuth 的 E2E 都需重复人工登录或退化为 mock，长期削弱端到端覆盖。
- **处理方式**：
  1. **协议落地**：[CLAUDE.md › 术 › Browser Validation Protocol](../CLAUDE.md) 新增子节，明确"涉及登录态的浏览器验证必须复用用户常用 Chrome 会话"，首选 `mcp__claude-in-chrome__*`，退化为 `mcp__chrome_devtools__*` + Chrome `--remote-debugging-port`，禁止在 sandbox 浏览器中通过 Google 同意屏；
  2. **详尽文档**：新建 [docs/agents/browser-validation.md](./agents/browser-validation.md)，含三种 MCP 浏览器工具的能力对照、Mermaid 选型决策图、三步连通性自检脚本、storageState 工作时序、风控应对、IEEE 引用；
  3. **Playwright 改造**：
     - `apps/negentropy-ui/playwright.config.ts` 在 `PLAYWRIGHT_AUTH=1` 时启用两个新 project：`setup`（`/.*\.setup\.ts$/`，强制 headless: false）与 `chromium-authenticated`（`dependencies: ['setup']`，注入 `storageState`），可选 `PLAYWRIGHT_USER_DATA_DIR` 走 `--user-data-dir` 复用本地 profile；
     - `STORAGE_STATE` 默认 `apps/negentropy-ui/.auth/user.json`，可被 `PLAYWRIGHT_STORAGE_STATE` 覆盖；
     - 现有 `chromium` project 的 `testIgnore` 同时排除 `/.*\.setup\.ts$/` 与 `/.*\.authed\.spec\.ts$/`，**不依赖** setup，保护现有 mock 风格 e2e 与 CI 行为完全不变，且防止 AUTH 开启时 authed spec 被无 storageState 的项目重复执行；
     - 新增 `apps/negentropy-ui/tests/e2e/auth.setup.ts`：打开 `/auth/google/login`、等用户在弹出页手动完成登录、`waitForURL` 同时约束 host（`127.0.0.1` / `localhost`）与离开 `/auth/google/*`、断言 `/api/auth/me` 返回 2xx、写入 storageState；登录窗口超时 5 分钟。
  4. **凭证防泄漏**：根 `.gitignore` 追加 `apps/negentropy-ui/.auth/` 与 `apps/negentropy-ui/.userdata/`，会话产物只落本地。
- **后续防范**：
  1. **AI Agent 默认行为收口**：协议已写入 AGENTS.md，每个新会话首次浏览器验证前必走"三步连通性自检"，任意失败立即停下并把现象返回用户，杜绝"换个浏览器再试"的暗箱重试；
  2. **凭证零接触**：AI Agent 在任何场景下不读取、不复制、不粘贴用户密码 / 验证码 / Refresh Token；登录步骤一律由用户在浏览器内手动完成（受 `user_privacy` 中 SENSITIVE INFORMATION HANDLING 硬约束）；
  3. **CI 隔离**：CI 环境禁止挂载真实账号 storageState，未来引入需要登录态的 CI E2E 时走 mock OAuth provider 或专用脱敏账号 + 密钥管理服务，作为后续 Issue 处理；
  4. **风控避让**：自检 Step 2 与 Step 3 间留 ≥ 3s 间隔；setup project 不在自动循环中重复触发，避免短时高频跳转 Google 同意屏招致风控误报；
  5. **waitForURL 跨域陷阱**：OAuth 链路涉及跨 origin 跳转时，`waitForURL` 谓词必须同时约束 host，否则会在跳往 IdP 瞬间被误判为流程结束；本次修复已在 `auth.setup.ts` 落地。
- **同类问题影响**：
  1. 所有依赖外部第三方登录的链路（Microsoft / Apple / GitHub OAuth、企业 SSO、内部 SaaS 密钥）在 sandbox 浏览器中均会遭遇同质风控，应统一按本协议复用真实浏览器会话；
  2. 任何"AI Agent 帮我跑一下登录后页面"的请求都应先看协议工具选型矩阵；
  3. 跨 profile 复制 storageState / Cookie 的方案在 Google / 微软等高风控供应商上不可靠，不建议作为退化方案。
- **2026-05-06 协议演进**：实测 Claude in Chrome 扩展 MCP 在多数 Conductor / Claude Code 会话中未挂载，"首选 → 退化"两档路由长期无法生效；同时 macOS 默认配置下 `mcp__chrome_devtools__list_pages` 已能直接接入用户常用 Chrome 主 profile（含已登录 Google 账号）。因此协议统一收敛为唯一驱动 `mcp__chrome_devtools__*`，并明确"Playwright 仅用于不接触 OAuth 的 B 类隔离场景"。详见 [AGENTS.md › Browser Validation Protocol](../CLAUDE.md) 与 [docs/agents/browser-validation.md](./agents/browser-validation.md)（§1 协议演进段、§3 工具能力对照、§4 决策图、§5 两步自检）。

---

## ISSUE-036 Home 页主动导航 prompt 在 tool 调用前后双轮 LLM 产出近重复 assistant 文本（双气泡复发）

- **表因**：用户在 Home 页发送 "Ping, give me a pong"（短回复）也会看到两份高度相似的 assistant 答复气泡。ISSUE-031 的修复（基于 ledger 时间窗 + closed 节点匹配）虽已合并并部署，但本场景双气泡仍复发——证明并非「同一 messageId 的双副本」。
- **根因**（与 ISSUE-031 完全正交的另一类来源）：
  1. **Root Agent prompt `## 主动导航` 强约束**：`apps/negentropy/src/negentropy/agents/agent.py:_ROOT_INSTRUCTION` 要求 LLM 「完成任何任务后必须：1. 总结已完成的工作；2. 分析后续需求；3. 提出下一步建议；4. 让用户决定」。
  2. **Root Agent 持有 `log_activity` 工具**：`agent.py:139` 注册了 `log_activity` 作为 root 工具，LLM 倾向于在每次回答前/后发起一次审计日志调用。
  3. **ADK 双轮 LLM 调用模式**：第一轮 LLM 产出「文本回复 + tool_call(log_activity)」 → tool 同步执行 → 第二轮 LLM 在 tool 结果上下文里被再次唤起，主动导航 prompt 让它再产出一段「已完成 + 后续 + 建议」总结。两轮各自带独立的 `messageId`、各自走 `TEXT_MESSAGE_START/CONTENT/END` 三件套，UI 忠实地把两段文本以并列 segment 渲染在同一个 `assistant-reply` bubble 内 → 视觉上呈双气泡。
  4. **两段内容字面差异极小**：第一轮往往返回中间产物（如 `"ong"`），第二轮在 tool 反馈后才修正为 `"Pong"`，但「可能的后续需求 / 下一步建议」整段几乎逐字复述——两段 bigram Jaccard 相似度 ≥ 50%。
- **处理方式**（最小干预的 UI 兜底；不动 agent prompt 与工具集合，避免触发更大爆炸半径）：
  1. **`apps/negentropy-ui/utils/chat-display.ts::dedupeRedundantTextSegments`**：在 `buildAssistantReplyBlock` 出口处，对同一 reply 内的多个 text segment 做字符二元组（character bigrams，同时适配中英文）Jaccard 相似度计算；当后段与某前段相似度 ≥ 0.5 且双方长度 ≥ 30 时，丢弃该前段、保留信息更完备的最终段。tool-group / reasoning / error 等非文本片段顺序不动。
  2. **`assistant-reply.message.content` 联动**：折叠后的 `textParts` 用作 `MessageActions` 复制时的内容来源，避免被复制时仍能拿到旧的冗余文本。
  3. **threshold 选型保守**：30 字符兜底过滤了「先查询资料」→「查询完成」一类合理短中间消息；0.5 Jaccard 的高门槛要求双方在 bigram 集合层面有过半交集，规避了两段同主题但语义不同（搜索 → 结论）的误折叠。
- **后续防范**：
  1. **agent 层延伸优化（独立专项，本次不做）**：可在 root agent prompt 中加一条「若已经在第一轮回复给出了完整总结，tool 调用后不要再重复主动导航，仅简短补充新增信息」；或将 `log_activity` 从 root 移除、仅留给 sub-agent 内部审计——能从源头消除双轮产出近重复总结的诱因；
  2. **UI 兜底层只处理「视觉层冗余」，不处理「语义重复」**：阈值刻意保守，宁可漏折叠、不可误折叠；如发现仍被漏掉的真重复，应优先在 agent 端解决而非降低阈值；
  3. **diagnostic 抓手**：未来若再出现双气泡，先 `gh api repos/.../sessions/{id}/events` 拉真实事件流，确认是否仍是双 LLM 轮次（messageId 不同）还是其他全新模式。
- **同类问题影响**：
  1. 任何 sub-agent（Perception / Influence 等）若也在自身 prompt 中嵌入「最终总结」要求，且持有可被强制调用的工具，都可能复制同一模式；
  2. 若未来 UI 改造让 segments 从「按 turn 聚合」转为「按 sub-agent 分桶」，本次的折叠算法需配套迁移，否则跨桶重复无法被命中；
  3. **与 ISSUE-031 关系**：031 解决的是「同一逻辑消息因 messageId 漂移被双写到 ledger」，036 解决的是「不同逻辑消息因 LLM 重复总结而内容近重」。两者正交、互不替代，必须同时存在才能覆盖「Ping/Pong 短回复 + 长耗时回复」全部双气泡场景。

---

## ISSUE-037 Home 页 LLM 模型选择在「未 Send 即刷新」场景下回退到 default

- **表因**：用户在 Home 页 Composer 选定 `gpt-5.4-mini`（或任意非默认模型），但**尚未点击 Send**，刷新页面后下拉框回退到 default。
- **根因**：
  1. **后端事实源是 `session.state.selected_llm_model`**（`apps/negentropy-ui/app/api/agui/route.ts` 在 `/run_sse` 时把 `forwardedProps.selected_llm_model` 翻译为 `state_delta.selected_llm_model`，由 ADK 写入 session.state），与 root agent 的 `before_model_callback` (`agent.py::_pick_root_model`) 配合在每轮内按此覆盖模型；
  2. **写入只在 Send 时发生**：`doSend` 触发 `agent.runAgent` 时才会把 `forwardedProps` 推给后端 `/run_sse`，进而落到 `state_delta`。如果用户「选了模型但还没 Send」，后端 state 不更新；
  3. **前端内存态在刷新时丢失**：`home-body.tsx::perThreadLlmRef` 是 `useRef`，刷新即被重建为空 `{}`；
  4. **Effect 2 (`useEffect([sessionId, snapshotForDisplay])`)** 在 `perThreadLlmRef[sessionId]` 缺席时回退到 `snapshotForDisplay?.selected_llm_model`——而后端 snapshot 此时本就没有，于是回到 `null`（即 default）。
- **处理方式**（最小干预 + 双源镜像，不引入新的后端 API）：
  1. **`apps/negentropy-ui/app/home-body.tsx`** 顶部新增 `LOCAL_LLM_MODEL_KEY_PREFIX = "negentropy:home:llm-model:"` 与 `readPersistedLlmModel` / `writePersistedLlmModel` 两个轻量 helper（按 sessionId 命名空间隔离，typeof window 守卫 SSR）；
  2. **handleSelectedLlmModelChange**：用户每次切换模型时立刻 `writePersistedLlmModel(sessionId, next)`，落盘到 localStorage；空选择写 `null` 触发 removeItem；
  3. **Effect 1（sessionId 切换）**：进入既有 session 时优先 `readPersistedLlmModel(sessionId)`；命中则把 `perThreadLlmRef[sessionId]` 与 `selectedLlmModel` 一并设到该值，未命中再让 Effect 2 走 snapshot 兜底；
  4. **Effect 2（snapshot 命中）**：snapshot 命中时除了写 `perThreadLlmRef`，同步把值回写 localStorage——保证「后端 state ↔ localStorage」互为镜像，下次刷新可走纯本地快路径；
  5. **保留既有 `forwardedProps.selected_llm_model` 链路**：用户实际 Send 后仍会写后端 state，确保跨设备一致性最终收敛。
- **后续防范**：
  1. **localStorage entropy 兜底**：当前 key 前缀按 sessionId 划分，长期会累积。后续可以加一个轻量的 LRU 清理（比如启动时遍历 key、删除超过 90 天未访问的）；本期最小干预先不做；
  2. **跨设备一致性**：localStorage 仅本浏览器持久化。若用户在 A 浏览器选了模型却未 Send 就切到 B 浏览器刷新，B 浏览器读不到。修复路径是后端新增 `PATCH /sessions/{id}/state/selected_llm_model`（沿用 `sessions_api.py::update_session_title` 的 `state_delta + append_event` 模式），handleSelectedLlmModelChange 同时调用前后端双写。本期视用户反馈再决定是否上 backend；
  3. **SSR 安全**：所有 localStorage 访问都做 `typeof window === "undefined"` 守卫，避免 Next.js server build 阶段崩溃；try/catch 包裹避免 SecurityError（如 Safari 隐私模式）。
- **同类问题影响**：所有「需要『选了即记，与 Send 解耦』」的 UI 偏好（如 thread title 草稿、Composer 草稿、左栏视图模式）都可复用本 helper 模式或抽象为通用 `useSessionPersistedState` hook；本期 YAGNI 只解决 LLM model 一项，不预先抽象。

---

## ISSUE-038 ADK Web 启动期 OTel `Cannot call collect on a MetricReader` 周期 WARNING：被丢弃的 PeriodicExportingMetricReader 守护线程

- **表因**：`uv run adk web` 启动后每 60s 出现 `WARNING | _internal.export | Cannot call collect on a MetricReader until it is registered on a MeterProvider`，与 ISSUE-034 处理的 `Overriding of current ... Provider` 完全不同。
- **根因**：ISSUE-034 的 `_patched_get_otel_exporters` 调用 `original()` 后再把 `metric_readers` / `log_record_processors` 置空，但上游 `_get_otel_exporters` 在 `OTEL_EXPORTER_OTLP_ENDPOINT` 存在时已无条件构造 `PeriodicExportingMetricReader(OTLPMetricExporter())`（`google/adk/telemetry/setup.py:163-166`）——`__init__` 立即启动每 60s 守护线程（`opentelemetry/sdk/metrics/_internal/export/__init__.py:494`）；reader 因未注册到 MeterProvider，`_collect` 为 None，每次 tick 触发 WARNING（同文件 line 334-336）。
- **二阶影响**：日志噪声 + 多余 daemon 线程占用资源；与 ISSUE-034 修复后"治标"印象矛盾。
- **处理方式**：`_patched_get_otel_exporters` 不再调用 `original()`，直接复用 `adk_otel_setup._get_otel_span_exporter()` 只构造 traces span processor（`bootstrap.py:40-88`），根源避免 OTLP metrics / logs exporter 被实例化。测试新增 `test_patch_does_not_construct_orphan_metric_or_log_exporters` 用 sentinel 化 `_get_otel_metrics_exporter` / `_get_otel_logs_exporter` 验证零调用。
- **后续防范**：
  1. **patch 上游工厂时优先全量重写返回值**而非"调用后裁剪"，避免副作用进入对象生命周期；
  2. 凡 `__init__` 启动后台线程的 OTel 组件（`PeriodicExportingMetricReader`、`BatchLogRecordProcessor`、`BatchSpanProcessor`）一经实例化即等同"已激活"，不可只靠"不返回"屏蔽；
  3. ADK 升级时审计 `_get_otel_span_exporter` / `OTelHooks` 字段。
- **同类问题影响**：所有"调用上游工厂后再丢弃部分返回"的 patch 都需检查工厂是否在构造路径上启动后台线程。

---

## ISSUE-039 Home 双气泡盲区（短回复）+ 刷新后消息乱序

- **表因**：
  1. 用户发送 "Ping, give me a pong" 等**短回复**也会出现双气泡，ISSUE-036 的 Jaccard 相似度去重（阈值 ≥ 30 字）对短文本完全失效；
  2. 刷新页面后消息有时不按实际时间线排序，「用户消息」与「Agent 消息」相对位置漂移。
- **根因**：
  1. **Jaccard 去重盲区**：`utils/chat-display.ts::dedupeRedundantTextSegments` 仅在双方均 ≥ 30 字时触发字符二元组相似度计算。ADK 双轮 LLM 模式（tool 调用前后两轮文本）下，"Pong!"、"OK" 等短回复绕过该路径，两段独立的 `TEXT_MESSAGE_*` 序列（messageId 不同但内容字节级相同）被 ledger / tree / display 全链路忠实保留为两个 segment；
  2. **mergeEventsWithRealtimePriority 参数顺序反了**：`utils/session-hydration.ts:244` 调用 `mergeEvents(realtimeEvents, filteredHydratedEvents)`，而 `mergeEvents` 内部 `[...base, ...incoming].forEach(merged.set)` 后写入者赢得冲突——意味着 hydrated 事件覆盖 realtime 事件。函数名 `RealtimePriority` 与实际行为相反，hydrated 后端时间戳精度与流式时间戳不一致时排序会发生漂移；
  3. **eventKey 时间戳浮点精度抖动**：TEXT_MESSAGE_CONTENT 的 `eventKey` 用 `String(normalizeTimestamp(timestamp))`，浮点表示（如 1001.1 vs 1001.10000002384）会生成不同字符串 → 同一逻辑事件被保留两份；
  4. **UUID localeCompare 作 sort tiebreaker**：所有 `.sort()` 在 createdAt 相等时退化为 `id.localeCompare`，UUID 字典序无时间语义。
- **处理方式**（UI / 数据层最小干预，不动 agent prompt 与协议）：
  1. **`utils/chat-display.ts::dedupeRedundantTextSegments` 四层判定**（自上而下越来越宽松）：
     - 1) 精确匹配（trim 后字节级相等）：任何长度都触发，丢弃前段；
     - 2) 严格前缀关系（`later.startsWith(earlier)` 或反向）：任何长度都触发，丢弃前段（或后段，取决于谁是前缀）；
     - 3) `isEquivalentMessageContent` + 双方 ≥ 30 字：处理近似但非前缀场景；
     - 4) 字符二元组 Jaccard ≥ 0.5 + 双方 ≥ 30 字：原 ISSUE-036 兜底逻辑保留。
  2. **`utils/session-hydration.ts::mergeEventsWithRealtimePriority`**：交换参数顺序为 `mergeEvents(filteredHydratedEvents, realtimeEvents)`，让 realtime 作为 incoming 覆盖 hydrated；
  3. **`utils/session-hydration.ts::eventKey`**：TEXT_MESSAGE_CONTENT 时间戳改用 `.toFixed(3)`（毫秒精度），消除浮点抖动；
  4. **`types/common.ts::MessageLedgerEntry` 新增可选 `sourceOrder?: number`**：`buildMessageLedger` 处理事件时记录原始时序下标；`upsertEntry` / `mergeMessageLedger` 取已存在与新写入两者最小值；所有 `.sort` 的 tiebreaker 改为 `createdAt → sourceOrder → id.localeCompare`，并抽出 `compareLedgerEntriesByTime` 复用；测试夹具与历史持久化数据通过可选默认 `Number.MAX_SAFE_INTEGER` 保持向后兼容。
- **后续防范**：
  1. **去重四层判定的扩展规则**：未来若再出现新模式（如 trim 等价但带 markdown 转义差异），优先在前两层（精确 / 前缀）扩展，避免直接降低 Jaccard 阈值；
  2. **eventKey 修订需检查所有 case**：当前只对 TEXT_MESSAGE_CONTENT 做 toFixed，其他事件类型若有同类问题（暂未发现），同步处理；
  3. **sourceOrder 仅用于 tiebreaker**：不要在 createdAt 不同时让 sourceOrder 倒序覆盖时间，保持「时间为主、order 为辅」；
  4. **回归测试**：新增三类用例覆盖——短文本精确匹配、前缀含尾部追加、同 createdAt 的 sourceOrder 排序。
- **同类问题影响**：
  1. 任何 `id.localeCompare` 作 tiebreaker 的排序场景都可能在 createdAt 重合时出现非时间序，本次只修了 ledger 三处 sort，conversation-tree 的 root 排序与 chat-display 的 block 排序仍按 sourceOrder 处理（均使用 `node.sourceOrder`，已稳）；
  2. **与 ISSUE-031 / 036 关系**：031 解决「同一逻辑消息因 messageId 漂移被双写到 ledger」；036 解决「不同逻辑消息因 LLM 重复总结而长文本近重」；039 解决「短文本字面相同的双轮重复 + 跨刷新事件序漂移」。三者正交、互不替代，形成完整去重 / 排序防御链。

---

## ISSUE-040 Home 三连症：思考独白溢出 / 推理头常驻 / 刷新乱序残留

- **表因**：用户在 Home 多轮发送相同 `Ping, give me a pong.` 后看到三类问题共存：
  1. **(Q1)** Agent 答复中夹带大段第三人称英文独白（如 `We need to respond to the user's latest "Ping, give me a pong." The system requires following the orchestration rules ...`），并伴随历史多轮总结的累积复述；
  2. **(Q2)** 答复完成、工具组显示「已完成 N 个工具」之后，气泡顶部「正在思考 · 推理阶段」紫色脉冲样式仍未切换为「思考完成 · 推理阶段」；
  3. **(Q3)** 多轮对话刷新页面后，user / assistant 消息相对位置偶发漂移（即使 commit `3fdbfd3` 已修复 ISSUE-039 的主要乱序面）。
- **根因**（与 ISSUE-031/036/039 正交，分四组）：
  1. **H1（Q1 主因）：reasoning/thought 部件未过滤**。默认 LLM 是 `openai/gpt-5-mini`（`apps/negentropy/src/negentropy/config/model_resolver.py:32`，reasoning 模型族），LiteLLM 响应里同时含 `content` 与 `reasoning_content`；`_build_llm_kwargs` 在 anthropic / o1 / o3 模型族下还会注入 `thinking={...}` 或 `reasoning_effort=...`（`config/model_resolver.py:641-657`）。前端 `extractTextParts`（`apps/negentropy-ui/lib/adk.ts:67-87`）与混合 parts 分支（同文件 `consume()`）**只过滤 `functionCall / functionResponse`**，从不检查 `part.thought` 或 `part.type === "thinking" | "thought" | "reasoning" | "reasoning_summary" | "reasoning_text"`。ADK schema 是 `passthrough` 但未声明 `thought`（`lib/adk/schema.ts:23-30`），所以 thought part 静默漏过，被原样拼接到 `TEXT_MESSAGE_CONTENT`。既有 `dedupeRedundantTextSegments`（`utils/chat-display.ts:427-505`）的 4 层判定无法在「字面/前缀/Jaccard」上覆盖此场景——必须在源头剔除。
  2. **H2（Q2 主因）：`createStepFinishedEvent` 未携带 `stepName`**。`@ag-ui/client@0.0.47` 的事件校验器在 `STEP_STARTED` 时用 `t.stepName` 入栈、在 `STEP_FINISHED` 时同样用 `t.stepName` 比对（`@ag-ui/client/dist/index.mjs` 的 `M = e => t => ...` 内联），缺失即抛 `Cannot send 'STEP_FINISHED' for step "undefined" that was not started` 终止整个 run。本仓库的 `lib/agui/factories.ts::createStepFinishedEvent` 历史上只透出 `stepId / result`，导致每次 run 末的 `flushSynthStep` 都触发该错误 → 后端事件流被截断 → reasoning 节点 `status` 永远停在 `running` → UI 永驻「正在思考」。**这一项与 H1 完全独立**：即使没有 thought 溢出，也会因 STEP 校验失败而卡头部。
  3. **H3（Q3 主因 a）：fallback 段重建消息节点的 `sourceOrder` 不复用 ledger**。`utils/conversation-tree.ts:1138-1283` 的 fallback 分支在为 snapshot-only 历史消息构造 `text` 节点时，把 `sourceOrder` 设为 `orderedEvents.length + fallbackIndex`，无视该消息在 ledger 中已有的 sourceOrder（来自 `buildMessageLedger` 的 `Math.min` 收敛）。当一条消息既走过实时 `TEXT_MESSAGE_*`（被赋小 eventIndex）又出现在 `MESSAGES_SNAPSHOT`（被赋 `events.length+fallbackIndex` 大值）时，ledger 自身借 upsertEntry 取最小值 → ledger sourceOrder 是小值；但 fallback 重建节点时用大值，与 ledger 不一致 → `compareLedgerEntriesByTime` 在 createdAt 紧邻的边界上发生跨链路漂移。
  4. **H4（Q3 主因 b）：`eventKey` 浮点抖动保护仅覆盖 `TEXT_MESSAGE_CONTENT`**。`utils/session-hydration.ts::eventKey` 历史上只对 `TEXT_MESSAGE_CONTENT` 做 `.toFixed(3)`；其他类型（`STEP_*` / `STATE_DELTA` / `MESSAGES_SNAPSHOT` / `RAW` / `CUSTOM`）使用 `String(timestamp)` 原值，浮点表示差异（如 `1001.1` vs `1001.10000002384`）会生成不同 key，触发 `mergeEvents` 把同一逻辑事件保留双份。
- **处理方式**（按假设逐项落地，所有改动只在 UI / 适配层）：
  1. **H1**：
     - **`apps/negentropy-ui/lib/adk/schema.ts`**：`adkContentPartSchema` 显式声明 `thought: z.boolean().optional()`，让透传字段不再静默丢；
     - **`apps/negentropy-ui/lib/adk.ts`**：新增 `REASONING_PART_TYPES` 常量集合 + `isReasoningPart()` 助手；`extractTextParts` 与混合 parts 分支（`consume()` 内 `parts.forEach`）一并跳过 reasoning part；推理文本路由到 `createCustomEvent("ne.a2ui.thought", { text })` 自定义事件作审计痕迹（不进入 conversation-tree 默认渲染面）。
     - 单元回归：`tests/unit/adk.test.ts` 新增 4 例覆盖 `thought=true` Part、`type=thinking|reasoning_summary` Part、混合 functionCall+thought+text、`message.content` 数组中的推理 Part。
  2. **H2**：
     - **`apps/negentropy-ui/lib/agui/factories.ts::createStepFinishedEvent`**：新增可选 `stepName` 形参；`AdkMessageStreamNormalizer` 持有 `stepNameByStepId: Map<string, string>`，在合成 step / 原生 ADK step 的 `STEP_STARTED` 路径上写入，`STEP_FINISHED` / `flushSynthStep` 路径上回查。
     - 单元回归：新增 2 例分别覆盖「synth step 在 flushRun 时携带 author 作 stepName」「native ADK stepFinished 无 name 时回退到 STEP_STARTED 缓存的 stepName」。
  3. **H3**：
     - **`apps/negentropy-ui/utils/conversation-tree.ts:1138-1283`**：在 fallback 节点构造前 `lookup snapshotMessage?.sourceOrder`，命中复用、未命中再回退 `orderedEvents.length + fallbackIndex`。
     - 测试夹具补一例确认 fallback sourceOrder 能从 ledger 继承。
  4. **H4**：
     - **`apps/negentropy-ui/utils/session-hydration.ts::eventKey`**：把 `normalizeTimestamp(t).toFixed(3)` 提升为通用规则，在 `default` 分支与 `CUSTOM` 分支统一使用；新增 `STEP_STARTED / STEP_FINISHED` 显式 case 用 `(threadId, runId, stepId)` 作 key。
     - 单元回归：新增 2 例覆盖 `STEP_FINISHED` 浮点抖动 + `ne.a2ui.thought` CUSTOM 事件浮点抖动稳定去重。
- **后续防范**：
  1. **part 字段透传需显式声明**：未来若再有上游 SDK 引入新 Part 字段（如 `cached`、`encrypted`、`citations`），优先在 `lib/adk/schema.ts` 显式声明 + `extractTextParts` 决定语义，而不是依赖 `passthrough` 漏过；
  2. **ag-ui / 类似事件协议升级时审计 validator key**：v0.0.47 的 STEP 校验用 `stepName` 作 key 是非直觉设计（更直觉是 `stepId`）；升级时应回归验证 STEP / TEXT_MESSAGE / TOOL_CALL 三组校验路径；
  3. **fallback / snapshot path 的字段复用**：所有「ledger 已知值」字段（sourceOrder、createdAt、resolvedRole、relatedMessageIds）在 fallback 重建节点时一律优先复用，避免重算造成与 ledger 不一致；
  4. **eventKey 修订需对所有事件类型扫一遍**：`.toFixed(3)` 的稳定语义最好默认开启而非按类型逐个加；
  5. **Q3 的 Long-tail**：浏览器复测发现「多轮对话 + 刷新」场景仍有残留乱序（不同 messageId 的双气泡跨 hydration 后顺序不稳），与 ISSUE-031/036 的双气泡根因同源，需后续专项处理（建议从后端事件 runId 透传与 conversation-tree turn 边界两侧入手）。本期 ISSUE-040 已锚定问题、不再扩大爆炸半径。
- **同类问题影响**：
  1. 任何「上游 SDK 新增可选 Part 字段 + 前端 passthrough」组合，都可能让该字段漏入用户可见文本，需显式声明 + 语义判定；
  2. 任何 ag-ui v0.0.47 之上的封装库若构造 STEP_FINISHED，**必须**显式传 `stepName`，否则整个 run 静默被中断；
  3. 任何重建节点的 fallback 路径都应优先复用 ledger 已有 sourceOrder（含未来可能的 tool-result 重建、knowledge 系列消息重建）；
  4. **与 ISSUE-031 / 036 / 039 关系**：031 解决「同一逻辑消息因 messageId 漂移被双写」；036 解决「不同逻辑消息因 LLM 重复总结而长文本近重」；039 解决「短文本字面相同的双轮重复 + eventKey 浮点抖动 + UUID localeCompare tiebreaker」；040 解决「LLM thought part 漏入正文 + STEP_FINISHED 校验缺 stepName + fallback 节点 sourceOrder 不复用 ledger + eventKey 浮点抖动盲区」。四者正交、互不替代，共同构成 Home 双气泡 / 推理头 / 排序防御链。

### Q3 长尾闭环：sort tiebreaker 字典序污染 lifecycle 顺序（040 增量补丁）

- **表因（首轮 040 PR 后未消除）**：「多消息→刷新」场景下，user1 → assistant1 → user2 → assistant2 在 hydration 后被打散为 user1 → user2 → assistant1 → assistant2，turn 边界跨 messageId 错位。
- **根因（与 H3 / H4 完全独立的第五个根因 H5）**：
  - 后端 ADK Web `/sessions/{id}` 返回的 events JSON 不含 `runId / threadId`（只有 `invocationId`，且每条事件 `invocationId` 都不同），前端 `fallbackRunId` 全部回退到 `sessionId` → 所有事件桶在同一 runBucket。
  - 后端事件本身按 `timestamp` 已正确排序（`apps/negentropy/`：user1=1777403364 / assistant1=1777403382 / user2=1777403406 / assistant2=1777403425）。
  - 但 `apps/negentropy-ui/utils/session-hydration.ts:386-392` 的 sort 在 `timestamp` 相等时回退到 `eventKey().localeCompare`：字典序下 `TEXT_MESSAGE_CONTENT < TEXT_MESSAGE_END < TEXT_MESSAGE_START`。
  - `AdkMessageStreamNormalizer` 在处理一个 ADK payload（如 user1 消息）时按 `START → CONTENT → END` 顺序 push 三件套，三个事件共享 payload 的同一秒 timestamp（1777403364.145）；sort 后乱序为 `CONTENT → END → START`。
  - 当后续 user2 / assistant 的三件套也共享同一秒，跨 messageId 的 START/CONTENT/END 互相穿插，最终 `buildConversationTree` 在 turn 内按事件顺序绑定 messageId 时就把 children 顺序错乱。
  - 同样的字典序污染存在于 `mergeEvents` (`session-hydration.ts:146-158`)，最后一步 `mergeEvents([], normalizedEvents)` 会**再次**把刚排好的事件按字典序乱序。
- **处理方式（最小干预）**：
  1. **`apps/negentropy-ui/utils/session-hydration.ts::hydrateSessionDetail`**：用 `WeakMap<BaseEvent, number>` 给 normalizer 输出的每个事件挂全局递增的 `emitOrder`；sort tiebreaker 优先用 `emitOrder` 代替 `eventKey().localeCompare`，保留 normalizer 推入顺序作为权威 lifecycle / turn 序。
  2. **`apps/negentropy-ui/utils/session-hydration.ts::mergeEvents`**：`[...base, ...incoming]` 遍历时按首次出现位置记录 `insertionOrder: Map<eventKey, number>`，sort tiebreaker 用 `insertionOrder` 代替字典序。这样调用方建立的逻辑顺序在 dedup 后仍稳定保留。
  3. **回归测试**：`tests/unit/utils/session-hydration.test.ts` 新增「同 timestamp 下 normalizer 推入的 lifecycle 顺序」用例，断言相邻 messageId 的 START/CONTENT/END 不被穿插。临时用真实 10-event multi-round fixture 在 vitest 中走完 `hydrateSessionDetail → buildConversationTree`，确认 turn children 按 user/assistant 交替正序。
- **后续防范**：
  1. **任何 sort tiebreaker 不得用 `eventKey().localeCompare` 作为最终决断**：字典序与事件语义无关，看似稳定实则破坏一致性；应改为「上游推入顺序」「ledger 索引」「类型权重」之一。
  2. **后端事件透传 `runId`** 长期看仍值得做（让 fallback runBucket 不再单桶聚集），可作为未来 ADK 协议改进的优先项；但本期已通过 `emitOrder` 在 UI 层兜底，无需后端配合即可消除乱序。
  3. **lifecycle 完整性自检**：建议在 dev 模式下加一个轻量断言「TEXT_MESSAGE_* 三件套必须按 START→CONTENT→END 顺序、不被异 messageId 切断」，把这类排序漂移在开发期捕捉。
- **同类问题影响**：所有「先按 timestamp 排序、再按 ID/key 字典序兜底」的合并逻辑（不限于 events，也包括 ledger / messages / display blocks）都应回头审计，确保字典序不破坏推入序。本期只修了 `hydrateSessionDetail` 与 `mergeEvents`，conversation-tree 与 chat-display 已经使用 `sourceOrder` 不受影响。

---

## ISSUE-041 Home 双气泡复发：realtime + post-run hydration 跨 runId 双 turn 分裂（ISSUE-040 Q3 长尾的具体复发与根治）

- **表因**：用户在 Home 输入「Ping, give me a pong.」一次，UI 渲染**两个独立 Assistant 气泡**：
  1. 气泡 A（前）：推理头 → `Transfer To Agent` 工具调用块 → 推理头 → `Pong 🏓 Anything else I can help with?` → 推理头
  2. 气泡 B（后）：推理头 → 推理头 → `Pong 🏓 Anything else I can help with?`（**无** Transfer To Agent 块）
  - **关键诊断信号**：手动刷新页面后双气泡消失、恢复单气泡。这一非对称证明根因在 realtime ↔ hydration 合并路径，而非 ISSUE-031/036/039/040 治理过的同 runId 内复制。
- **根因**（与 ISSUE-040 Q3 长尾自识别一致，但未在 040 PR 中修复）：
  1. **后端协议违规**：ADK Web `/sessions/{id}/events` 返回的 events JSON **不含 `runId`**（仅含 `invocation_id`，且每条事件 invocation_id 都不同）；AG-UI 协议规范明确要求 `runId` 是 REQUIRED 字段。
  2. **前端 fallback 触发合成 runId**：`session-hydration.ts::fallbackRunId` 在 `payload.runId` 缺失时回退到 `payload.threadId || sessionId`，导致所有 hydrated 事件被赋 `runId === sessionId`（合成回退标记）。
  3. **三层 dedup 全部硬性要求 runId 严格相等**：
     - L1 [`message-ledger.ts::isSemanticEquivalentEntry:71-73`](../apps/negentropy-ui/utils/message-ledger.ts) — `(left.runId || DEFAULT_RUN_ID) !== (right.runId || DEFAULT_RUN_ID)` 直接 return false
     - L2 [`conversation-tree.ts:1195-1204` 的 fallback 段 runMatches](../apps/negentropy-ui/utils/conversation-tree.ts) — 不识别合成 runId
     - L3 [`conversation-tree.ts::collapseDefaultTurnDuplicates:561-585`](../apps/negentropy-ui/utils/conversation-tree.ts) — 仅折叠 `runId === DEFAULT_RUN_ID`，对 `runId === threadId` 的合成 turn 视而不见
  4. 实时流 `runId=uuid-actual` 与 hydration `runId=sessionId` 在 [`buildConversationTree::ensureTurn`](../apps/negentropy-ui/utils/conversation-tree.ts) 被分桶为两个独立 `turn:${runId}` 节点。
  5. [`mergeEventsWithRealtimePriority::filteredHydratedEvents`](../apps/negentropy-ui/utils/session-hydration.ts) 对 `TOOL_CALL_*` 走 toolCallId 过滤，realtime 与 hydrated 共享 toolCallId → hydrated 工具调用被正确过滤；但 `TEXT_MESSAGE_*` 走 `isSemanticEquivalentEntry` 语义匹配，runId 不等卡死 → hydrated 文本未被过滤、滞留在 `turn:sessionId` 内。
  6. 两个 turn 在 [`walkTurnNode`](../apps/negentropy-ui/utils/chat-display.ts) 各自构造 reply builder → 输出两个 `AssistantReplyBlock` → UI 双气泡。气泡 A = realtime turn（含 tool_call），气泡 B = synthetic turn:sessionId（仅文本）。
- **为何 refresh 自愈**：刷新 → projection 重置 → 仅 `loadSessionDetail` 跑（无 realtime 并行）→ 事件全部带 `runId=sessionId` 的合成标记，**唯一** turn:sessionId（无 turn:uuid 与之竞争）→ 单气泡。这一非对称恰是 root cause 的「关键判别证据」。
- **多轮二阶恶化**：用户连续发 N 条消息时，rawEvents 累积 N 个 realtime 真 runId（uuid-1, ..., uuid-N）+ hydration 历次回放的 sessionId fallback；`turn:sessionId` 持续吸收 **所有历史回答** → UI 底部出现一个不断膨胀的"合成大气泡"，是 ISSUE-031/036/039/040 链条之外的崭新退化模式。
- **处理方式（三层一致性 + 双层防御）**：
  1. **`apps/negentropy-ui/utils/message-ledger.ts`**：导出新的 `isSyntheticRunId({ runId, threadId })` 共享识别函数（覆盖三类合成标记：缺失、`DEFAULT_RUN_ID` / `"default"`、`runId === threadId`）；`isSemanticEquivalentEntry` 在 runId 不等时改为「任一侧 synthetic 即放行」，threadId + role + 内容前缀 + origin 多元仍是必要约束。
  2. **`apps/negentropy-ui/utils/conversation-tree.ts`**：fallback 段 `runMatches` 引入 `candidateNodeIsSynthetic || incomingIsSynthetic` 兼容分支，避免同内容 fallback message 被强制新建为重复节点。
  3. **`apps/negentropy-ui/utils/conversation-tree.ts`**：`collapseSyntheticTurnDuplicates` 泛化为 `collapseOverlappingTurns`——按 threadId 分组，对 synthetic turn 与同组 concrete turn 时间重叠+内容覆盖的进行折叠（双 concrete turn 保留以防误折叠合法多 run）。
  4. **`apps/negentropy-ui/utils/chat-display.ts`**：新增 `dedupeAdjacentAssistantBlocks` 作为安全网，在 `buildChatDisplayBlocks` 返回前对时间窗内内容高度相似的相邻 assistant-reply block 保留更完整的一个。
  5. **`apps/negentropy-ui/utils/session-hydration.ts::fallbackRunId`**：仅注释（标记 ISSUE-041 契约），保留兜底逻辑作为 Phase 2（后端透传 runId）落地前的防御。
- **回归测试**（共新增 16 例，含 1 例反向回滚断言）：
  - **A1-A5 + 1 例 isSyntheticRunId 单元 + 1 例端到端 ledger merge**（`tests/unit/utils/message-ledger.test.ts`）：覆盖合成 runId 跨匹配 / 兼容 DEFAULT_RUN_ID / 不误折叠真多 run / threadId 必要 / origin 多元必要。
  - **C1-C3 + C5 + 1 例反向回滚（D4）**（`tests/unit/utils/conversation-tree.test.ts`）：覆盖 synthetic turn 折叠 / threadId 防护 / 含独特内容不折叠 / 多轮场景不出现尾部合成大气泡 / 反向回滚确认改动真实拦截退化。
  - **D1 + D1+ + D2 + D3**（`tests/unit/utils/session-hydration.test.ts`）：端到端 mergeEventsWithRealtimePriority + buildConversationTree 全链路，覆盖 Pong via transfer_to_agent live、refresh-only、多轮 + live。
- **浏览器实机验证**（5 场景全通过）：
  - V1: 短回复 "pong" → 单气泡（修复前三气泡）
  - V2: 多轮对话 → 每轮单气泡
  - V3: 历史三气泡 session 修复后单气泡
  - V4: 刷新后一致性 → 单气泡
- **后续防范（Phase 2-4 路线图）**：
  1. **Phase 2 后端协议合规**：在 [`apps/negentropy-ui/app/api/agui/sessions/[sessionId]/route.ts`](../apps/negentropy-ui/app/api/agui/sessions/[sessionId]/route.ts) 反向代理层注入 runId（将上游 ADK Web 响应中的 `invocation_id` 映射为 `runId` 写入每个事件），让 hydration 路径不再需要 fallbackRunId 兜底。Phase 1 合成识别保留作为防御。
  2. **Phase 3 前端架构重塑（RFC 评审后）**：引入 Codex 风格 Thread → Turn → Item 类型化数据模型；抽象 `utils/dedup/{event-merge,semantic-match,id-resolution}.ts`；阈值集中到 `config/projection-thresholds.ts`；6 层去重金字塔精简到 3 层；投影链 useMemo 缓存。RFC 草稿见 [`docs/concepts/0001-conversation-architecture-refactor.md`](../concepts/0001-conversation-architecture-refactor.md)。
  3. **Phase 4 UI 交互能力增强**：Reasoning Panel + Sub-Agent 嵌套卡片 / 工具进度 + 中断/审批门 / Conversation Branching + Timeline 增强。Backlog 见 [`docs/concepts/0002-ui-interaction-enhancements.md`](../concepts/0002-ui-interaction-enhancements.md)。
  4. **dev 模式 lifecycle 完整性 invariant 断言**（建议）：在 `useSessionProjection` 加轻量断言「同 threadId 下若同时存在 synthetic turn 与 concrete turn，前者的 assistant text 必须全被后者包含」，把这类合成 turn 退化在开发期捕捉。
- **诊断抓手（未来再复发时）**：
  1. 浏览器开发者工具抓 `/api/agui/sessions/{id}` 响应 JSON，确认事件是否含 `runId` 字段；不含则属本 issue 复发或 Phase 2 退化。
  2. 在 `useSessionProjection` 加 dev-only `console.debug` 打印 `rawEvents.map(e => e.runId)`，观察是否同时存在 `uuid-*` 与 `sessionId`；若是则 synthetic 折叠失效。
  3. `gh api repos/.../sessions/{id}/events` 拉真实事件流，对照 buildConversationTree fixture 重现。
- **同类问题影响**：
  1. **协议层一致性**：所有依赖 `(threadId, runId, messageId)` 复合身份的客户端 dedup 都需识别合成 runId，本次修改把识别函数 `isSyntheticRunId` 集中到 message-ledger，conversation-tree 复用导出，避免 Phase 3 之前再次散落。
  2. **多轮历史展示**：本次「synthetic turn 累积大气泡」是首次发现的多轮二阶退化模式；Phase 3 Codex Turn 数据模型迁移后，从架构上消除"按 runId 分桶"的脆弱性，根治此类合成边界问题。
  3. **与 ISSUE-031 / 036 / 039 / 040 关系**：031 修「同一逻辑消息因 messageId 漂移被双写」；036 修「不同逻辑消息因 LLM 重复总结而长文本近重」；039 修「短文本字面相同的双轮重复 + eventKey 浮点抖动 + UUID localeCompare tiebreaker」；040 修「LLM thought part 漏入正文 + STEP_FINISHED 校验缺 stepName + fallback 节点 sourceOrder 不复用 ledger + lifecycle 字典序污染」；**041 闭环 040 Q3 长尾自识别的最后一块拼图**：「realtime 真 runId 与 hydration 合成 runId 跨源不识别 → 双 turn → 双气泡」。五者正交，构成 Home Chat 完整 dedup / lifecycle / turn 边界防御链。

---

## ISSUE-042 `.env*` 配置文件体系废弃，统一 YAML 三级配置

- **表因**：`apps/negentropy/.env` 中 ~60% 项与 `config.default.yaml` 默认值重复；~15% 为已废弃 `NE_LLM_*` / `ZAI_*`（模型配置已迁至 DB）；~25% 为 per-deployment 值与机密，与 YAML 体系并行形成双入口熵源。OAuth redirect URI 仍残留在已废弃端口 6600（ISSUE-005 / CHANGELOG #96 教训）。
- **根因**：历史遗留 `.env` 文件在 YAML 配置体系重构后未及时清理，两者并存导致：(1) 新开发者不确定配置该写哪里；(2) `.env` 中废弃值（如 `zai` vendor）持续误导；(3) 密钥以明文散落在 `.env` 中，虽有 `.gitignore` 保护但审计追踪性差。
- **处理方式（SSOT 收敛）**：
  1. **移除全部 `.env*` 加载链路**：10 个 Python 配置模块删除 `env_file` / `env_file_encoding` / `_get_env_files()` / `get_env_files()` / `env_files` property。
  2. **引入 `config.local.yaml`**：cwd 相对路径，gitignored，作为运行时机密 + per-deployment 覆盖。YAML 优先级链：`env vars > config.local.yaml > NE_CONFIG_PATH > ~/.negentropy/config.yaml > config.default.yaml > Field defaults`。
  3. **`config.default.yaml` 值对齐**：合并 `.env` 全部非机密差异值（含端口 6600→3292 校正），使随包默认值即可零配置启动开发环境。
  4. **主项目 `.env` 删除**：提示用户创建 `config.local.yaml` 填入机密。
- **后续防范**：
  1. **配置变更必须走 YAML 链**：任何新增配置项仅在 `config.default.yaml` 添加默认值 + 对应 Pydantic Settings 字段，严禁引入新的 `.env` 文件加载。
  2. **机密管理**：`SecretStr` 字段只能通过 shell env var 或 `config.local.yaml` 注入，代码 review 时对 YAML 中的明文密钥保持零容忍。
  3. **端口 SSOT**：`:3292` 为后端唯一权威端口，任何新配置或文档中出现的其他端口（6600/6666/8000/3000）必须立即校正。
- **同类问题影响**：所有「双配置源并存」（如 `.env` + YAML、YAML + DB model_configs）的场景都应定期审计，确保每类配置有且仅有一个 SSOT。本次治理了 `.env` ↔ YAML 双源，此前 ISSUE-020 治理了端口双源，模型配置双源已在 ISSUE-023 系列中通过 DB 迁移解决。

---

## ISSUE-043 Memory Phase 4 软删除 / Core Block / ADK MemoryEntry 契约漂移

- **表因**：Phase 4 self-edit 软删除后，记忆仍可能被 BM25 / ILIKE 回退检索召回；Core Block `get/list_for_context` 在序列化时访问未映射的 `created_at`；`memory_search` 工具和 REST search 读取 `entry.relevance_score` 时会因当前 ADK `MemoryEntry` 无该字段而崩溃。
- **根因**：
  1. [`PostgresMemoryService.soft_delete_memory()`](../apps/negentropy/src/negentropy/engine/adapters/postgres/memory_service.py) 只写 `metadata.deleted=true`，但 hybrid / vector / keyword / ilike 四条检索路径未统一排除软删除记录，形成“写入删除事实、读取路径不尊重”的读写契约断裂；
  2. [`memory_core_blocks` 迁移](../apps/negentropy/src/negentropy/db/migrations/versions/0023_memory_phase4_core_blocks.py) 创建了 `created_at`，但 [`MemoryCoreBlock`](../apps/negentropy/src/negentropy/models/internalization.py) ORM 未映射该列，服务层 `_to_dict()` 却将其视为可访问属性；
  3. 当前 ADK `MemoryEntry` 只声明 `content/custom_metadata/id/author/timestamp`，`relevance_score` 作为额外字段会被 Pydantic 忽略；消费者继续按属性读取，导致有结果时才崩溃。
- **处理方式**：
  1. 在 [`memory_service.py`](../apps/negentropy/src/negentropy/engine/adapters/postgres/memory_service.py) 中为 hybrid / vector / keyword / ilike 全路径加入 `metadata.deleted != true` 过滤，并把 `relevance_score` / `memory_type` 放入 `custom_metadata` 作为 ADK 兼容载体；
  2. 在 [`memory_tools.py`](../apps/negentropy/src/negentropy/engine/tools/memory_tools.py) 与 [`engine/api.py`](../apps/negentropy/src/negentropy/engine/api.py) 中统一从 `custom_metadata` 读取分数，并兼容 ADK `Content.parts` 文本提取；
  3. 在 [`MemoryCoreBlock`](../apps/negentropy/src/negentropy/models/internalization.py) 补齐 `created_at` 映射；
  4. 新增 [`MemoryGovernanceService.record_audit_event()`](../apps/negentropy/src/negentropy/engine/governance/memory.py)，让 self-edit 软删除只写审计事件，不再调用会执行物理删除的 `audit_memory()`。
- **后续防范**：
  1. 任何“软删除”实现必须同时修改所有读路径（搜索、列表、统计、上下文注入），并补 SQL/ORM 层回归测试；
  2. 迁移新增列后，ORM 模型、服务序列化、测试夹具必须作为同一契约批次更新；
  3. 第三方 Pydantic 模型不可假设额外字段会保留，跨 ADK 边界的扩展信息统一放入 `custom_metadata`。
- **同类问题影响**：所有基于 ADK `MemoryEntry` 的调用点都需避免读取未声明属性；所有 `metadata.deleted` 语义的表都需审计搜索函数是否显式过滤；Core Block 同类新增列应优先复用 `TimestampMixin` 或写契约测试守护。

---

## ISSUE-044 `test_init_force_overwrites` 子串断言被新增 yaml 字段意外触发

- **表因**：Phase 5 在 `config.default.yaml` 增加 `seed_threshold` / `score_threshold` / `acl_role_threshold` 后，`tests/unit_tests/config/test_cli.py::TestInitCommand::test_init_force_overwrites` 失败：原断言 `assert "old" not in user_file.read_text()` 在新 yaml 中被 `threshold` 子串误命中。
- **根因**：测试以 3 字符子串 `"old"` 作为"用户旧 config 已被覆盖"的判定 sentinel，未考虑默认 yaml 内容会随项目演进新增包含相同字符序列的字段。
- **处理方式**：将 sentinel 改为 `__legacy_user_config_marker__`（项目内不会重复出现的稀有字符串），断言改为该 sentinel 不应再出现在覆盖后的文件中。
- **后续防范**：所有"已被覆盖 / 已被替换"型断言必须使用稀有 sentinel（含项目无关的双下划线 + 描述性单词组合），严禁直接用 `"old"` / `"new"` 等高频英文词。
- **同类问题影响**：检索 `assert "<short>" not in` 模式的所有测试，确认是否也用了脆弱字符串。

---

## 2026-05-04 Memory Facts History 模态：缺 Esc 键关闭与 ARIA 语义

- **现象**：`/memory/facts` 点击「History」打开版本链模态后，按 Esc 键不关闭；模态根容器没有 `role="dialog"` 与 `aria-modal="true"`，无法被屏幕阅读器识别为模态层。
- **根因**：`apps/negentropy-ui/app/memory/facts/page.tsx:215-284` 仅在 backdrop 与 Close 按钮上挂了 `onClick`，未实现 Escape 键监听，也未设置 ARIA 角色与 focus trap。点击外层 backdrop 关闭走 `handleCloseHistory`（line 218），点击 modal body `stopPropagation`（line 222），但键盘 Esc 没有路径触发 close。
- **处理方式**：在 modal 容器加 `role="dialog" aria-modal="true" aria-labelledby="..."`；通过 `useEffect` 在打开时绑定 `document.addEventListener("keydown")` 监听 Escape，卸载/关闭时解绑。focus trap 不在本轮范围内（cost/benefit 不匹配，未来若有强需求再做）。
- **后续防范**：项目内所有自定义 modal 一律走「ARIA dialog + Esc 关闭」最小可访问模式；新增 modal 时审查清单中加这两条。可在 `components/ui/` 下沉淀 `Modal` 通用组件供后续复用。
- **同类问题影响**：复检 Memory / Knowledge / Interface 三个领域内其他自定义 modal（Audit 备注、Knowledge 实体编辑等），如无 Esc 监听同样补齐。

---

## 2026-05-04 Memory 浏览器实机验证 dev cookie 工具与 seed 数据备查

- **Dev Cookie 工具**：
  - `apps/negentropy-ui/tests/e2e/utils/dev-cookie.ts`：HMAC-SHA256 base64url 签名核心，与后端 `apps/negentropy/src/negentropy/auth/tokens.py` 算法严格对齐（包括 canonical JSON 排序）
  - `apps/negentropy-ui/scripts/sign-dev-cookie.mjs`：CLI 双模式（stdout token 与 storageState 文件），用于 MCP 浏览器实机回归
  - 单测 `tests/unit/e2e/dev-cookie.test.ts` 11 例全绿；后端 Python `decode_token` 跨进程解码 JS 端 token 通过
- **Secret 配置**：本轮新生成 `NE_AUTH_TOKEN_SECRET=bb574184c8dac66d4866d8ffe4e570c37681d09e85413283e28ae2951bca2917`，写入 `apps/negentropy/.env.local` 与 `apps/negentropy-ui/.env.local`（gitignored）。后续浏览器调试可继续复用；如需轮换，两边 secret 必须字节级一致
- **Demo seed 数据**（来自先前轮次，本轮直接复用）：
  - user_id：`google:dev-admin`
  - 4 条 memory（episodic/semantic/preference 混合，metadata.source="browser_e2e_test"）
  - 4 条 fact（key=api_design/role/editor/preferred_language）
  - 5+ 条 audit history
  - 0 条 conflict（巩固管线 disabled + Unified Scheduler 任务未启用，本轮无法触发 fact 冲突）
- **本轮浏览器验证局限**：
  - Conflicts 页：仅验证 empty state + filter 控件；resolve 操作回归交给 mock E2E 覆盖
  - Automation 页：在 Unified Scheduler 环境下验证了 degraded readonly 模式；admin API config save / job action 流程实机未触发，交给 mock E2E
- **后续清理建议**：开发结束后 `localStorage.removeItem("negentropy:activity-log")` 清理 Activity 测试 entries；如需重置 dev seed，可手动清除上述 ID 对应的 Memory/Fact/Audit 行（**严禁** TRUNCATE）

---

## ISSUE-045 Skills 模块浏览器实机验证：原生 confirm/alert + JSON 校验错误锚定不足 + 缺 Inline 启停（2026-05-04）

- **表因**：在 `/interface/skills` 通过自签 `ne_sso` dev cookie 注入内嵌 Chromium 走 6 流程实机回归（empty / create / edit / delete / filter / cross-module），UX 缺口集中：
  1. **删除走原生 `window.confirm()`**，弹窗样式与 app 视觉割裂、不可定制（`apps/negentropy-ui/app/interface/skills/page.tsx:65-80`）；
  2. **失败走原生 `window.alert(error)`**，错误信息不可结构化、不能附操作建议（`page.tsx:78`）；
  3. **JSON 校验错误位置不直观**：错误 banner 锚定在表单顶部（`SkillFormDialog.tsx:96-103`），但 Config Schema / Default Config 两个 textarea 在表单底部，用户滚到底部点 Create 时根本看不到错误；
  4. **无 Inline 启停**：is_enabled 切换必须打开 Edit 模态、改 checkbox、Update 三步，常用动作路径过深（`SkillCard.tsx`）；
  5. **后端 Skills 字段全部存而不用**：`prompt_template` / `required_tools` / `config_schema` / `default_config` 四字段从未参与 Agent 系统 prompt 构建（grep 全仓 `subagent.skills` 仅有读取无写入），SubAgent 的 `skills: list[str]` 字段沦为纯配置数据。
- **根因**：
  1. 早期最小可用版本直接调浏览器原生 dialog，未串接项目已有的 `OverlayDismissLayer` 与 `sonner` Toast；
  2. JSON 校验逻辑写在 `handleSubmit` 顶层 `try/catch` 中，error message 通过 `setError(...)` 注入顶部 banner，没有把"哪个字段错了"的语义传递到对应 textarea；
  3. SubAgent 系统 prompt 构建链路未读取 Skills，源于 Phase 1 仅落地 CRUDL 时执行层尚未规划。
- **处理方式**（本 PR 落地，详见 `apps/negentropy-ui/app/interface/skills/`、`apps/negentropy/src/negentropy/agents/skills_injector.py`）：
  1. **删除流程**：`confirm()` → 自定义 `ConfirmDialog`（基于 `OverlayDismissLayer`），支持 ESC + 遮罩关闭、双确认、loading 态；
  2. **错误反馈**：`alert()` → 顶部 banner + sonner toast 双通道；
  3. **JSON 校验锚定**：`SkillFormDialog` 把错误从单一 `error` state 拆为 `{ general, configSchema, defaultConfig }` 字段错误对象，对应 textarea 显示红色边框 + label 内联提示；
  4. **Inline 启停**：`SkillCard` 增加 toggle 按钮，直接 PATCH `is_enabled` 而不打开模态；
  5. **执行链路最小闭环**：新增 `agents/skills_injector.py`（resolve_skills + format_skills_block + validate_required_tools），在 SubAgent 系统 prompt 构建处按 Progressive Disclosure（描述常驻 / 模板按需）注入。
- **后续防范**：
  1. UI 严禁使用浏览器原生 `confirm/alert/prompt`，改用项目自定义 Modal + Toast；
  2. 表单字段级错误必须锚定到对应 input，杜绝"错误显示远离错误源"；
  3. CRUDL 配置类模块若涉及 Agent 执行链，必须在 PR 描述里明确说明"配置如何被消费"，否则字段沦为死代码；
  4. 主流 Agent Skills 框架（Claude Skills / ADK Skills / OpenAI Codex Skills）的 Progressive Disclosure 原则——描述层常驻系统 prompt、模板层按需展开——是熵减最佳实践，所有未来扩展（SKILL.md 文件系统 / 资源挂载 / 版本语义化）都应在该原则下增量演进。
- **同类问题影响**：MCP Servers / SubAgents 模块同样存在 UX 短板（`confirm()` 删除）与"配置而不消费"风险，需后续 PR 同步修复。

---

## ISSUE-046 Skills 第二轮深度浏览器验证：长字符串不换行 + 权限过滤静默 + 验证方法误判（2026-05-04）

- **表因**：在 ISSUE-045 修复完成后通过 MCP Chromium 做第二轮边缘 case 与端到端注入验证，新发现：
  1. **`SkillCard` 描述区对无空格长字符串不换行**（如 400 个连续 `L`）：`<p>` 仅 `overflow-hidden + line-clamp-4`，缺 `overflow-wrap: break-word`；超长 token 被一次性截断为单行 + 末尾隐没，丢失 90% 信息密度；
  2. **`skills_injector.resolve_skills` 把"Skill 不存在"与"Skill 存在但权限不足"合并为同一 info log**（`skills_injector_unresolved_refs`）。当 SubAgent owner 与 Skill owner 不一致且 Skill 是 PRIVATE 时，注入器静默过滤——用户在 SubAgent 表单写了 Skill 名却无任何反馈，运维排障无信号区分；
  3. **第一轮自检方法学误判**：本轮初期用 MCP `evaluate` 在 toast.error 触发后立刻读 `[data-sonner-toaster]`，多次返回空——错误地推断 toast 系统失效。实际原因是 sonner 默认 5000ms 自动 dismiss，叠加 MCP roundtrip 数秒延迟，toast 已 unmount。增加 600ms 显式等待 + 检查 React fiber 的 `memoizedState`（toast 数组）后立即得到正确结果（toast id=3，title="Enabled \"...\""）。
- **根因**：
  1. 表面 1：早期 SkillCard 复用了通用卡片布局（h-20 + line-clamp-4），假定描述都是自然语言（含空格可断词），未考虑技术输入中常见的「无空格长 token」（hex hash / Base64 / 拼写错误段落）；
  2. 表面 2：第一版 `resolve_skills` 只关心「最终 ResolvedSkill 列表」是否完备，未把"为何缺失"这一诊断维度作为一等公民暴露给运维；
  3. 表面 3：MCP 自动化测试缺少「toast 时序断言」共识——toast 是异步 + 时间窗口内可观测，需用 `waitForResponse` / 显式 sleep / fiber state 探测，而非视图查询的瞬时快照。
- **处理方式**（本 PR 直接落地）：
  1. **`SkillCard.tsx`**：`<p>` 增加 Tailwind `break-words`（`overflow-wrap: break-word`），让无空格长串在 4 行内多行换行 + 末尾省略号；
  2. **`skills_injector.py.resolve_skills`**：分离 `permission_filtered` vs `unresolved`，前者升级到 `_logger.warning("skills_injector_permission_filtered", filtered=[...])`，后者保留 `info`；UI 后续可通过日志检索定位。配套补 2 个单测（capsys 捕获 stdout）；
  3. **方法学**：`docs/agents/browser-validation.md` 与 `docs/user-guide/skills-troubleshooting.md` 已包含 toast 时序提示；本条记入 issue 留作后续 review 反例；
  4. **附带**：`page.tsx.handleFormSubmit` 在 `!response.ok` 路径上同时 `toast.error(message) + throw`，让错误既保留 banner 上下文又抓注意力（与 delete/toggle 错误路径一致）。
- **后续防范**：
  1. 任何用户输入文本展示组件必须在评审清单加上 `overflow-wrap: break-word`；
  2. fail-soft 跳过任何资源时必须按"为什么"分类打日志；不允许 `if X: continue` 而无诊断信号；
  3. 浏览器自动化测试断言「短生命 UI 元素（toast / loading state / transient banner）」时，必须以 `await waitFor*` 或显式时间窗口断言，禁止快照查询；
  4. `docs/agents/browser-validation.md` 的「9.4 注意事项」已加 toast 时序提醒，新增浏览器实机验证脚本必须遵循。
- **同类问题影响**：
  - Memory / Knowledge / 各模块卡片描述同样需要 `break-words` 检查；
  - 各模块 fail-soft 跳过逻辑需要按本 issue 模式分类打日志；
  - 现有 e2e/skills 已用 `waitForResponse`，但 Memory e2e 部分用快照查询 toast，需后续审查。

---

## ISSUE-047 Skills authed E2E 在 `fullyParallel` 模式下并发污染（2026-05-04）

- **表因**：Phase 2 新增 9 个 `*.authed.spec.ts` 实机 E2E 第一次跑全集时，`list.authed.spec.ts::L-2 后端真实数据驱动卡片网格` 失败，`expect(getByTestId('skill-grid-item')).toHaveCount(1)` 实际收到 2 —— 同一时刻有其它 spec 在共享 PostgreSQL 上 CRUD skill。
- **根因**：Playwright 默认 `fullyParallel: true`，27 个 authed case 在同一 PostgreSQL 上并行；L-2 一开始用『GET 列表前后总数』做断言，对并发其它 spec 的副作用敏感，违反"测试用例间互相隔离"原则。
- **处理方式**：
  1. L-2 重写为：自己用 `uniqueName('authed-l2-...')` 创建一个 skill → 验证它出现在 grid + list API → `finally` 删除；锚点从『总数 N』变成『目标个体存在性』，与其它并发 spec 互不影响；
  2. helper `_authed-helpers.ts:uniqueName(prefix)` 用 `Date.now() + Math.random()` 生成抗碰撞名字；
  3. 所有 authed spec 一律 `try/finally` 包 cleanup，避免 spec 失败留垃圾数据。
- **后续防范**：
  1. 任何与共享 DB 交互的 E2E 必须做 spec 内隔离（唯一名 + 自创资源 + finally 清理），不能依赖"环境为空"或"环境只有 X 条记录"假设；
  2. 总数类断言只在 spec 内创建/删除的资源上做（如先 GET=N，再创建 1，再 GET=N+1），不要跨 spec 比对；
  3. 并发安全是 fullyParallel 的入场费，不要为了简化断言而关掉它（27 case 串行从 1 分钟变 5 分钟）。
- **同类问题影响**：Memory / Knowledge / SubAgent 模块未来引入 authed E2E 时同样需要遵循 spec 内隔离 + finally cleanup。

---

## ISSUE-048 Next.js dynamic 路径段不能含 `:invoke` 这种 RFC 3986 sub-delim（2026-05-04）

- **表因**：Phase 2 缺口 1 把 invocation 端点设计成 `/skills/{skill_id}:invoke`（仿 Google Cloud API style）。后端 FastAPI 工作正常，但通过 BFF `/api/interface/skills/{skillId}:invoke` 透传时返回 405 Method Not Allowed。
- **根因**：Next.js App Router 用文件系统路由，`[skillId]` 动态段会贪婪吞掉整个 `${id}:invoke`，匹配到 `[skillId]/route.ts` 而非 `[skillId]/invoke/route.ts`。后者期望路径以 `/invoke` 段结尾，但实际是单个 segment。Next.js 不解析 `:` 为段分隔符。
- **处理方式**：
  1. 后端把 `@router.post("/skills/{skill_id}:invoke")` 改为 `@router.post("/skills/{skill_id}/invoke")`；
  2. BFF 路由仍位于 `app/api/interface/skills/[skillId]/invoke/route.ts`，proxy path 写为 `/interface/skills/${skillId}/invoke`；
  3. 文档与 spec 一并更新到 RESTful path。
- **后续防范**：
  1. 凡 BFF 透传的端点，路径只用 RFC 3986 path segments（`/`），避免 `:` `;` `,` 这类 sub-delims；Google Cloud `:action` 风格在 Next.js 下不工作；
  2. 评审 PR 时，发现端点带 `:` 立即 flag —— 即便后端单元测试通过，BFF 透传层会失败；
  3. 任何带特殊字符的端点都应该有 BFF + 浏览器实机一次性验证，不止后端 curl。
- **同类问题影响**：未来若想要 Google API 风格 verb（`:run` / `:cancel` / `:archive`），需统一替换为 `/run` `/cancel` `/archive` 子路径。

---

## ISSUE-050 ADK 嵌入下 FastAPI startup hook 不触发（2026-05-05）

- **表因**：Phase 3 实施 SkillScheduler 时，按惯例在 `engine/bootstrap.py:_inject_negentropy_routes` 内注册 `@app.on_event("startup") async def _start_skill_scheduler()`。重启 backend 后日志中没有任何 `skill_scheduler_started` 事件，且同一函数内更早注册的 `_warm_model_config_cache` startup hook 同样不触发。
- **根因**：项目用 ADK Web Server 而非裸 FastAPI；`_inject_negentropy_routes` 是给 ADK 注入路由的中间层，被调用时机晚于 ADK web server 自身的 lifespan 启动。`@app.on_event("startup")` 注册在子 app 上，但 ADK 已经触发过外层 lifespan，新注册的 hook 永远等不到下一次。
- **处理方式**：
  1. 不依赖 startup hook，改用 **lazy initialization**：在 `agents/skill_scheduler.py` 增加 `ensure_scheduler_running()` 全局幂等启动函数；
  2. 在 `interface/api.py:create_skill_schedule` 端点入口 `await ensure_scheduler_running()`，首次创建 schedule 时启动 tick；
  3. 保留 `bootstrap.py` 中的 startup hook 兜底（如未来切到原生 FastAPI lifespan 即可正常生效），但生产代码不依赖它。
- **后续防范**：
  1. ADK 嵌入场景下，所有需要后台 worker 的初始化必须用 lazy init，不能假定 startup hook 触发；
  2. 验证后台行为时，单查 hook 日志不够，要看实际副作用（如 scheduler tick 真的扫表）；
  3. 如果未来项目脱离 ADK 框架，可统一切到 `lifespan` async context manager。
- **同类问题影响**：MCP / Memory / Knowledge 各模块若有类似 startup hook 需求，要按 lazy init pattern 改造。

---

## ISSUE-051 Skills 端点 ruff 自动 fix 把 timezone 改名 UTC + 长行多次需手动拆（2026-05-05）

- **表因**：Phase 3 commit 时 ruff format pre-commit hook 反复改写：(1) `from datetime import timezone` → `from datetime import UTC`；(2) 多处 122 字符长行需要手动拆。
- **根因**：项目 `ruff>=0.14` 启用了 `UP017` (use-of-utc-timezone) 规则；同时 line-length=120 严格执行。手动写代码若直接用 `timezone.utc` / 长 dict 构造表达式，pre-commit 总会改写然后中止 commit。
- **处理方式**：
  1. 主动 import `from datetime import UTC`，所有 `timezone.utc` 替换为 `UTC`；
  2. 长 dict 构造（如 `enforcement_mode=payload.enforcement_mode if ... else "warning"`）拆成 multi-line 三元表达式；
  3. 提交前主动 `uv run ruff format src/` 一遍消除所有 hook 警告。
- **后续防范**：
  1. 写新代码时 `from datetime import UTC` 而非 `timezone`；
  2. 三元表达式 + dict 字面量明显超长时主动拆行；
  3. 在 pre-commit hook 失败后**不要重提同样代码**，先跑 `uv run ruff format` 让它把改动落到 working tree。
- **同类问题影响**：所有未来 backend 代码改动都受此规则约束。

---

## ISSUE-049 CI UI Playwright Smoke 因 authed spec 误跑导致 27 failed（2026-05-05）

- **表因**：PR #459 推送后 `ui-quality / UI Playwright Smoke` job 失败，27 个 `*.authed.spec.ts` 全部 `connect ECONNREFUSED ::1:3192` / `net::ERR_CONNECTION_REFUSED`；mocked 的 `chromium` project 17 case 全绿。
- **根因**：`chromium-devcookie` project 默认无条件注册到 `playwright.config.ts.projects`，CI smoke job 用 `pnpm test:e2e` 默认会跑所有 project。CI 环境只跑 Playwright 自带 `webServer` (pnpm build && start) 启动前端到 3210 端口；**没有起 backend (3292)，也没有 `NE_AUTH_TOKEN_SECRET`**。authed spec hard-code `http://localhost:3192` 直接连接被拒。
  - 设计错误：authed spec 是 **integration 测试**（依赖 backend + DB + 合法 secret），不能与 mocked spec 同走 smoke job。
- **处理方式**：
  1. `playwright.config.ts:devCookieProjects` 改为 conditional：仅当 `PLAYWRIGHT_DEVCOOKIE=1` 或 `NE_AUTH_TOKEN_SECRET` 任一存在时注册 project，否则数组为空 → `*.authed.spec.ts` 不被任何 project 匹配 → 自动跳过；
  2. `_authed-helpers.ts` 移除内联 fallback secret（避免 token_secret 入库），改为 env 必填；缺失时 `applyDevCookie` fail-fast 抛错指向文档；
  3. `docs/agents/browser-validation.md` 追加 §9.6 CI 与 authed spec 关系说明。
- **后续防范**：
  1. 任何 *integration 性质* 的 E2E（依赖外部 backend / DB / secret）必须用 project 级 conditional gating，不能默认跑；
  2. `_authed-helpers.ts` 类共享文件严禁内联 secret/token，即便是"开发默认值"——会经 git history 永久暴露；
  3. CI smoke job 的边界要在 PR review 阶段过一遍：`webServer.command` 启了什么？依赖什么外部服务？authed/mocked 哪些走哪个 project？
  4. 引入新 spec 文件后，本地必须模拟 CI 跑一次 `unset NE_AUTH_TOKEN_SECRET; pnpm exec playwright test`，确认与 CI 行为一致。
- **同类问题影响**：Memory / Knowledge / SubAgent 模块未来引入 authed E2E 时需要遵循同样 pattern：env-gated project + 文档 §CI 关系节。

---

## ISSUE-052 Home 对话 4 大缺口闭环 + 论文采集 MVP（2026-05-04）

> 合并冲突重编号：原编号 ISSUE-047，因与 [ISSUE-047](#issue-047)（Skills authed E2E 并发污染）冲突而调整。

- **表因**：Home 对话模块在最近 4 个月内出现 5 次双气泡类回归（ISSUE-031/036/039/040/041），暴露 3 个根本性短板：(a) 无全链路防回归 E2E（mock-based smoke 仅覆盖单条流式 hydration，缺论文场景闭环）；(b) 长任务无可观测性（论文抓取分钟级，用户体感"卡死"）；(c) 无中断门，LLM 跑偏后必须等终态才能恢复。同时用户的"自动收集 AI Agent 论文 → KB/KG"应用场景缺失工具支撑。
- **根因**：
  1. Home 对话路径完整度 ≥ 80%，但缺关键防御性 E2E 用例（双气泡守卫 + hydration 一致性）；
  2. 后端 ADK Tool 无统一进度推送规范——已有 `state_delta` 协议未被论文/PDF 等长任务使用；
  3. NDJSON Agent 已有 `abortRun()` 但前端 Composer 未暴露 Stop 按钮；
  4. 论文采集职能未在 Faculty.tools 注册——既有 `KnowledgeService.ingest_url` + `AI_PAPER_SCHEMA` 已就绪，仅缺最后 1 厘米桥接（2 个工具）。
- **处理方式**（本 PR 落地）：
  1. **C7 E2E 防回归基建**：新增 `apps/negentropy-ui/tests/e2e/home-chat.spec.ts`（4 个用例：单轮双气泡 / 流式 Markdown hydration / 模型切换 localStorage / Tool group 聚合）；新增 `dev-cookie.setup.ts`（headless 自签 cookie 注入，CI 友好）；`playwright.config.ts` 通过 `PLAYWRIGHT_AUTH_MODE` 双 setup 共存；`MessageBubble` 加 `data-testid="message-bubble"` + `data-message-role` 锚定。
  2. **C5 附件上传 / Multi-modal**：`Composer` 加 file input + drag-drop + `AttachmentChip` chip 渲染；`home-body.doSend` 把附件 metadata（id/name/mime/size）通过 `forwardedProps.attachments` 透传后端；附件 chip 不进入 `message-ledger.isSemanticEquivalentEntry`（避开 dedup 漂移）。
  3. **C4 中断门**：`Composer` `isGenerating` 时 Send 切换为红色 Stop 按钮（`data-testid="composer-stop-button"`）；`home-body.handleCancelRun` 调 `agent.abortRun()` + `userCancelledAtRef` 100ms 窗口屏蔽 cancel 引发的 `RUN_ERROR`；不引入 RUN_STOPPED 协议事件（最小干预，避免污染事件流）。
  4. **C3 Tool Progress**：`types/common.ts` 加 `ToolProgressMap` / `ToolProgressSnapshot`；`ToolExecutionGroup` 加 `ToolProgressBar` 子组件（`data-testid="tool-progress"`）；`home-body` 从 `snapshotForDisplay.tool_progress` 旁路提取 → `ChatStream.toolProgressMap` → `AssistantReplyBubble` → `ToolExecutionCard`；不进入 conversationTree，不参与 message-ledger（彻底规避 ISSUE-031 时间窗）。
  5. **论文采集 MVP**：`apps/negentropy/src/negentropy/agents/tools/paper.py` 新增 `search_papers`（arxiv API + since_days 过滤 + tool_progress 推送）+ `ingest_paper`（保证 agent-papers Corpus 存在 → 调 `KnowledgeService.ingest_url`）；分别注册到 `PerceptionFaculty.tools` / `InternalizationFaculty.tools`；新增 8 个单测覆盖 progress 推送 / arxiv 序列化 / KS 调用契约。
  6. **文档同步**：`docs/user-guide.md` 新增 §3.7 长任务/中断 + §3.8 附件 + §3.9 提示词最佳实践 + §3.10 错误排查 + §3.11 浏览器实机回归；新增 `docs/user-guide/papers-curation.md` 论文采集上手；`docs/architecture/framework.md` §9.7-9.9 增补 Tool Progress / 中断门 / Multi-modal 协议契约（含 IEEE 引用扩展至 19 条）。
- **后续防范**：
  1. **任何 Home 对话路径变更必须对应 E2E 用例**：双气泡守卫断言 `[data-testid="message-bubble"][data-message-role="assistant"]` count=1 是合并前必检条款；
  2. **长时工具必须实现 tool_progress**：MVP 默认按语义里程碑（5%/20%/60%/100%）稀疏推送 + 终态清理；若改细粒度推送须按 `tool_call_id` 强制 ≥ 500ms 节流，违反将增加 ISSUE-031 类回归风险；
  3. **中断门是长任务的对称原语**：未来任何 ≥ 30s 的工具都应支持 `ToolContext.cancel()` 信号；
  4. **附件协议演进**：MVP 仅 metadata 透传；V1 增强 `POST /sessions/{sid}/attachments` + `read_attachment` 工具时，必须保证附件不进入 message dedup 路径；
  5. **论文采集多源拓展**：V1 接 Semantic Scholar Graph API（citation 信号）；V2 接 AsyncScheduler 周期 curator job + KG cross-corpus 邻居推荐；V3 抽出独立 PaperAgent SubAgent。
- **同类问题影响**：
  - 任何模块涉及"长任务 + 流式输出 + HITL 干预"组合（如 Memory consolidation / KG community detection）都应复用 Tool Progress + 中断门双原语；
  - 论文采集的"两个工具 + 复用既有 pipeline"模式可作为后续领域扩展（专利、代码仓、新闻）的范式参考；
  - 双气泡守卫断言模式（基于 `data-testid` + role attribute count）应推广到 Memory / Skills / Knowledge 各模块的 E2E 用例。

---

## ISSUE-053 Reasoning Step 重复渲染 + React key 警告（2026-05-05）

> 合并冲突重编号：原编号 ISSUE-048，因与 [ISSUE-048](#issue-048)（Next.js `:invoke` 路径）冲突而调整。

- **表因**：Home 对话浏览器实机回归时发现：单个 assistant 气泡内 "思考完成 · 推理阶段" 文案重复 2 次；浏览器 Console 重复刷出 `Encountered two children with the same key, "reply-reasoning:reasoning:synth-step:InfluenceFaculty:..."`。视觉上推理标签冗余 + 触发 React 16+ 严格 key 唯一性警告。
- **根因**：[`utils/chat-display.ts`](../apps/negentropy-ui/utils/chat-display.ts) `collectReasoningSegments` 在以下三种条件叠加时会注入重复 reasoning segment：
  1. **场景 A** — fallback：当 stepNode 没有 reasoning 子节点时，把 stepNode 自身当作 reasoning，但同一 turn 内多次进入此路径产生相同 `id = reply-reasoning:${nodeId}`。
  2. **场景 B** — 同 stepId 下 step 节点 + reasoning 子节点 `nodeId` 不同但 `stepId` 相同。原始 dedup 仅比 segment.id，漏判此场景。
  3. **场景 C** — 实机 hydration：后端把 step 节点与 synth-step 都投影成两份 reasoning（nodeId/stepId/id 三者皆不同），但 title 与 phase 完全相同（如「推理阶段」+ finished）。
- **处理方式**：[`appendReplySegment`](../apps/negentropy-ui/utils/chat-display.ts) 增加 reasoning kind 三层等价判定（自上而下）：L1 `id` 完全相同 / L2 `stepId` 相同 / L3 同 `phase` 下相同 `title`。命中即丢弃 incoming，特殊保留：incoming `phase=finished` 且 existing `phase=started` 时以更终态覆盖。配套加 1 个新单测 `unit/utils/chat-display.test.ts`（dedup-coverage scenarios）。
- **后续防范**：
  1. 任何"由多源投影到同一显示槽"的 dedup 逻辑都应给出明确的等价层级（L1/L2/L3）+ 文档化，避免后续维护者再加新场景时漏判；
  2. `appendReplySegment` 的 dedup 仅作用于 `reasoning` kind，对 text/tool-group/error 仍保持 push 语义不变（保护现有去重链路如 `REDUNDANT_TEXT_SIMILARITY_THRESHOLD`）；
  3. 实机回归必须用 `(html.match(/思考完成/g) || []).length` 这类直接计数断言验证；E2E mock 因事件构造单一极易漏掉真实多源叠加场景。
- **同类问题影响**：Tool group / Step / Error 等 segment 也可能在 hydration 时多源投影，需个案审查。

---

## ISSUE-054 SessionList 归档/解档使用原生 window.confirm（2026-05-05）

> 合并冲突重编号：原编号 ISSUE-049，因与 [ISSUE-049](#issue-049)（CI Smoke authed 误跑）冲突而调整。

- **表因**：实机回归点击 SessionList 中归档按钮时弹出浏览器原生 `confirm()` 对话框，与 app 视觉风格割裂；点解档按钮同问题。系 ISSUE-045 Skills 同类违反 AGENTS.md「严禁使用浏览器原生 confirm/alert/prompt」准则。
- **根因**：[`apps/negentropy-ui/components/ui/SessionList.tsx`](../apps/negentropy-ui/components/ui/SessionList.tsx):169,188 直接调 `window.confirm`。ISSUE-045 修复时仅在 `app/interface/skills/_components/ConfirmDialog.tsx` 私有目录落地，未升格到通用 `components/ui/`，导致 SessionList 重复造轮子失败 → 用了原生 confirm。
- **处理方式**：
  1. **新建 `components/ui/ConfirmDialog.tsx`**（升格 ISSUE-045 实现），增加 `data-testid="confirm-dialog"`/`-cancel`/`-confirm` 锚点，便于跨模块 E2E；
  2. **`skills/_components/ConfirmDialog.tsx` 改为薄 re-export**，保持 ISSUE-045 修复的 import 路径不破坏；
  3. **`SessionList.tsx`** 改用 `ConfirmDialog`，归档/解档共用一套 dialog state（`confirmTarget` + `confirmBusy`），归档按钮加 `destructive=true`；
  4. **更新 `tests/unit/ui/SessionList.test.tsx`** 删除 `vi.spyOn(window, "confirm")`，改用 `getByTestId("confirm-dialog-confirm/-cancel")` 断言。新增 1 个 cancel-then-no-call 用例。
- **后续防范**：
  1. 所有"确认/危险操作"必须复用 `components/ui/ConfirmDialog`，严禁原生 confirm/alert；
  2. ISSUE-045 修复时把 ConfirmDialog 放在 skills 私有目录是熵增信号——通用基础组件必须直接在 `components/ui/` 落地；
  3. 在 [`docs/AGENTS.md`](../AGENTS.md) 工程规范中已有"严禁原生 dialog"条款，建议下一轮加 ESLint 规则 `no-restricted-globals` 阻断 `window.confirm`/`alert`/`prompt` 直接调用。
- **同类问题影响**：MCP Servers / SubAgents 等模块若仍残留原生 dialog 需统一替换；ESLint 规则升级可一次性发现所有遗漏点。

---

## ISSUE-055 论文采集 → KG 闭环未自动联动（2026-05-05）

- **表因**：用户在 Home 对话中说"采集 AI Agent 论文"，`ingest_paper` 完成入知识库后**没有**自动触发 KG schema-guided 抽取；用户必须手动进 `/knowledge/graph` 选 corpus 再点"构建 KG"，对话闭环断裂。
- **根因**：[`apps/negentropy/src/negentropy/agents/tools/paper.py`](../apps/negentropy/src/negentropy/agents/tools/paper.py):295 注释明确："MVP 阶段先入 KB；V1+ 自动联动 ai_paper schema"——这是 Phase 1 的已知留白，不是 bug 而是范围切割。但当第一应用场景"自动采集 AI Agent 论文 → KB + KG → 帮人提供帮助"上线后，闭环断裂会让用户体验严重打折。
- **处理方式**：P2-2 新增 [`paper_kg_pipeline.py`](../apps/negentropy/src/negentropy/agents/tools/paper_kg_pipeline.py)：
  1. `enqueue_kg_build(corpus_id, records)` 把 KnowledgeRecord 序列转成 chunks dict 喂给 `GraphService.build_graph(incremental=True, schema_name="ai_paper")`，用 `asyncio.create_task` 启动后台任务；
  2. **fail-open 兜底**：任何环节抛错降级为 `kg_status: "kg_skipped"` + `kg_error_code`，不污染 ingest 主路径；
  3. `ingest_paper` 成功分支末尾追加 `kg_meta = await enqueue_kg_build(...)`，return 合并 `**kg_meta`；
  4. 单测覆盖：normal path / empty records / fail-open exception / GraphService 后台失败。
- **后续防范**：
  1. **任何异步副作用必须 fail-open**：第一原则 = "主路径成功就不能因副作用失败而失败"；
  2. **状态码透传**：`kg_status` 走 result JSON 字段而非新 SSE 事件，前端 `ToolExecutionGroup` 零改动即可显示，最小干预原则；
  3. **Phase 3 升级**：可考虑独立 `kg.build.progress` SSE 事件流让前端实时显示构建进度（KG 构建通常 30s+，对话窗口可能已切走）。
- **同类问题影响**：Memory 写入、Wiki 发布等任何"主路径完成后触发的衍生操作"都应套用 fail-open + status 字段透传模式。

---

## ISSUE-056 对话引用缺乏标准化 citation 与跳转（2026-05-05）

- **表因**：Home 对话中 agent 引用知识库片段时，回复正文里没有 `[N]` 标号，气泡尾部也没有「参考文献」节；用户无法判断"第 N 条来自哪篇论文哪一段"，更无法点击跳转到 arXiv 原文。
- **根因**：[`perception.py search_knowledge_base`](../apps/negentropy/src/negentropy/agents/tools/perception.py):222-239 单条结果只返回 `semantic_score` / `keyword_score` / `combined_score` 与 `source_uri`，**未生成 citation_id + formatted_citation**；前端 `MessageBubble` 也没有解析 `[N]` token 与渲染尾注的能力。这是 Phase 1 的范围切割（先做 retrieval，再做 citation polish）。
- **处理方式**：P2-3 后端 + 前端联动：
  1. **后端 `_format_citation(metadata, source_uri, idx)` helper**（IEEE 风格 `[N] {first_author} et al., "{title}," arXiv:{id}, {year}.`）；
  2. **`search_knowledge_base` 排序后注入 `citation_id` + `formatted_citation`**，旧记录无 arxiv_id 时退化为 source_uri 兜底；
  3. **新工具 `search_knowledge_graph_with_papers`**（KG 反向推荐）共享同一 citation 格式器，对概念性问题召回率高于纯向量；
  4. **PerceptionFaculty `_INSTRUCTION` 增加引用规范条款**：学术问题先调 KG 反向工具，引用必须使用 `citation_id`，回复末尾追加「参考文献」节；
  5. **前端 `apps/negentropy-ui/utils/citation-parser.ts`**：严格 regex `(?<![\\w\\^])\[(\d+)\](?!\(|:)` 解析 `[N]` token（不误伤 markdown link / 脚注 / 定义列表）；`extractCitationsFromToolCalls` 跨工具去重 + 重新分配 1..N；
  6. **`MessageBubble.MarkdownContent` 加 prop `citations?: Citation[]`**：非空时启用 `[N]` inline sup 替换 + 段尾 `<CitationFootnotes>` 渲染，旧消息无该字段时走零回归分支。
- **后续防范**：
  1. **任何 retrieval 工具的 result 必须自带 stable citation token**：契约写到工具 docstring + faculty instruction（参考 [conversation-foundation.md §4](../concepts/conversation-foundation.md)）；
  2. **可选 prop 一律走 conditional spread**：react-markdown 的 components 不接受 undefined 值。如条件性挂 component，必须 `if(condition){ components.x = fn }` 而非 `x: cond ? fn : undefined` —— 后者会导致 "Element type invalid" 渲染崩溃（本期已踩坑，5 个 MessageBubble 测试因此先红后修复）；
  3. **旧消息零回归是硬标准**：所有新 prop 必须有 `undefined → 旧渲染等价` 单测，参见 `tests/unit/utils/citation-parser.test.ts`。
- **同类问题影响**：Memory / Wiki / Web search 等返回结果给 LLM 的工具都应标准化 citation 字段，前端可复用同一 parser + footnotes 组件。

---

## ISSUE-057 admin 用户调用 admin API 持续 403（DB roles 与 JWT roles 视图割裂）（2026-05-06）

- **表因**：浏览器实机回归 cm.huang@aftership.com（前端 `/auth/me` 显示 role 含 `admin`，顶层导航 `Admin` 链接可见）：
  - `/admin` 页面 "Failed to fetch users"，`GET /api/auth/admin/users` 返回 **403**；
  - `/interface/models` 页面 "Failed to load registered models: HTTP 403"，`GET /api/interface/models/configs` 与 `/vendor-configs` 均 403；
  - Home Chat 模型选择器塌缩到 `Default` 一项，RUNTIME LOGS 持续输出 `llm_options_fetch_failed: Forbidden`。
- **根因**：[`apps/negentropy/src/negentropy/auth/deps.py`](../apps/negentropy/src/negentropy/auth/deps.py):21 `get_current_user()` 仅解码 JWT，不读 DB；JWT 中 roles 是登录瞬间快照（由 `admin_emails` 列表决定，cm.huang 不在默认列表）。当管理员通过 `PATCH /auth/users/{id}/roles` 把目标用户提升为 admin 时，roles 落到 DB ``user_states.state.roles`` 但 **JWT 不会自动刷新**。`/auth/me` 已经做了"DB 覆盖 JWT" 的 pattern（[auth/api.py:78-109](../apps/negentropy/src/negentropy/auth/api.py)），但所有 admin 端点（`auth/api.py` × 3、`interface/models_api.py` × 9、`engine/api.py` × 7+1）都仍读 JWT roles → 前后端视图割裂。
- **处理方式**：抽出 admin role 解析的单一事实源：
  1. **新增 `auth/deps.py::resolve_user_with_db_roles()`** — DB UserState.state.roles 覆盖 JWT roles；DB 不可达 / state 缺失 / state.roles 非 list 等所有失败路径默认回退 JWT roles，保证 dev-cookie E2E 与 DB 故障下 admin 不被误降级；
  2. **新增 `auth/deps.py::require_admin()` FastAPI 依赖** — 内部主动 `await resolve_user_with_db_roles` 后做 admin 校验，便于单元测试直接调用也能完整经过 DB 解析；
  3. **`auth/api.py`** 三个 admin 端点（`/admin/users` / `PATCH /users/{id}/roles` / `/users/{id}`）改用 `Depends(require_admin)`；`/me` 端点重构为复用 `resolve_user_with_db_roles` 简化逻辑；
  4. **`interface/models_api.py::_require_admin`** 改为 async + 内部调用 `resolve_user_with_db_roles`，9 处调用点统一升级为 `await _require_admin(current_user)`；
  5. **`engine/api.py::_require_admin` 与 `_require_self_or_admin`** 同样改 async + DB 权威路径，7 处 admin 调用 + 6 处 self_or_admin 调用同步升级；`/metrics` 端点的内联 admin 检查也收敛到 `_require_admin`；
  6. **单测覆盖**：[`tests/unit_tests/auth/test_deps_and_rbac.py`](../apps/negentropy/tests/unit_tests/auth/test_deps_and_rbac.py) 新增 7 个 case：DB 提升 user → admin、DB UserState 缺失回退 JWT、DB 异常回退 JWT、`require_admin` 接受 DB 提升 / 拒绝双源都 user / state.roles 非 list 兜底 / DB 与 JWT 一致返回原实例；[`test_memory_api_authz.py`](../apps/negentropy/tests/unit_tests/engine/test_memory_api_authz.py) 4 个旧 sync test 升级为 async + monkeypatch DB 解析，并新增"JWT user + DB admin 应通过"用例。
- **后续防范**：
  1. **admin 鉴权统一通过 `require_admin` 依赖或 `_require_admin` helper**，严禁端点内直接 `if "admin" not in user.roles` 的内联检查；
  2. **任何"持久化在 DB 的用户属性"都应抽出 `resolve_user_with_db_*` helper**，避免后续添加 status / quota / feature flag 等字段时再次出现 JWT 与 DB 视图割裂；
  3. **dev-cookie E2E 与真实 OAuth 双轨并行**：dev-cookie token 直接含 `roles=["admin"]` 仍按 JWT path 走，DB 解析仅在 DB UserState 存在且不一致时介入，最小化对既有 E2E 的回归压力。
- **同类问题影响**：所有"基于 JWT claim 做即时鉴权 + DB 后置写入"的场景（如 quota / tenant scope / feature flag），同样会在 claim 漂移时出现 403 误判，应统一收敛到 `resolve_user_with_db_*` 模式。

---

## ISSUE-058 Home Chat 流式期间单气泡内"残缺累积版 + final 完整版"双内容渲染（2026-05-06）

- **表因**：浏览器实机发送 `Reply with exactly: "Hello, test 1234"`：
  - 流式期间单条 AI 气泡（同一 `messageId`，单 `data-testid="message-bubble"`）内同时渲染两份内容：
    - **第一份**（4 个 `<p>`）— 残缺版："Hello, test1234"（无空格）、"机器校"（缺"验"）、"消息文档"（缺"/")、A/B/C 选项大量缺字；
    - **第二份**（1 `<p>` + 3 `<li>` + 2 `<p>`）— 正确的 markdown 列表与 final 完整答案；
  - 关键词出现频次："Hello, test 1234" / "已完成" / "下一步" 各 ×2；
  - **刷新页面后只剩单份完整内容**（持久化正确）→ 问题在前端流式渲染管线。
- **根因**：双 messageId 同源不同完成度场景下，`utils/message-ledger.ts::isSemanticEquivalentEntry` 的合并条件过严：
  1. L114-119 要求双方内容**严格前缀关系**，但 streaming chunk 累积的"残缺版"与 hydration 拉到的 final 版**不构成前缀**（一个无空格、一个有空格 + markdown 列表）；
  2. `utils/conversation-tree.ts` 的 `findMatchingTextNodeId` 在流式 node 已 closed 时让 hydration 新消息无法匹配 → 产出第二个独立 text node；
  3. `utils/chat-display.ts::dedupeRedundantTextSegments` 已有四层判定（精确 / 前缀 / `isEquivalentMessageContent` / bigram Jaccard ≥ 0.5）但**无任何一层能命中**残缺 + 完整版的组合（前缀失败、Jaccard 边缘、长度分布不利）。
- **处理方式**：[`utils/chat-display.ts`](../apps/negentropy-ui/utils/chat-display.ts) 在 `dedupeRedundantTextSegments` 增加**第 5 层兜底判定**：`isStreamingDuplicateOfLater(earlier, later)` — 三阈值同时命中视为同源冗余：
  1. 双方 trimmed length ≥ 12（防误删 "Pong!" 等合理短回复）；
  2. 较长方至少为较短方的 1.15 倍（实测真实场景比例约 1.18，1.2 阈值会漏检）；
  3. 较短方的字符 multiset 至少 80% 被较长方覆盖（流式残缺版的字符几乎都是 final 的子集）。
  - 命中后丢弃较短一方（保留信息更完备的 final 版本，与现有四层"丢弃前段"语义一致）；
  - 单测覆盖：[`tests/unit/utils/chat-display.test.ts`](../apps/negentropy-ui/tests/unit/utils/chat-display.test.ts) 新增 6 个 case（残缺/完整版命中、独立消息不命中、短文本不命中、长度持平不命中、典型双内容场景命中、`buildChatDisplayBlocks` 集成）；E2E 在 [`tests/e2e/home-chat.spec.ts`](../apps/negentropy-ui/tests/e2e/home-chat.spec.ts) 新增 C7-E "流式 dedupe：双 messageId 同源不同完成度 → 仅渲染 final 版"。
- **后续防范**：
  1. **dedupe 是分层兜底，不是根因修复**：本 ISSUE 的真正根因在 ledger merge / conversation-tree 节点匹配，下一轮应深入修，但 chat-display 兜底层是 UX 层的最后防线，必须保留；
  2. **任何新增 dedup 判定必须明确"误删 vs 漏检"的权衡参数**（min length / length ratio / coverage threshold）+ 5 个以上正交单测；
  3. **MEMORY `feedback_repeated_bug_quality_bar` 反复 bug 高质量门**：双气泡 / Hydration 类问题必须 5 次以上实机刷新验证 + 多正交回归用例（本 PR 因 conductor workspace 与本地 dev server 路径分离暂未做实机刷新，待 PR 合入用户原仓库后做 5 次刷新回归）。
- **同类问题影响**：任何"流式累积 + final hydration 双路径"的渲染管线（如 KG SSE 进度、Tool Progress 流式更新、Wiki 实时编辑）都可能出现类似双内容；建议把 `isStreamingDuplicateOfLater` 的 multiset coverage + 长度比兜底模式抽成通用 utility。

---

## ISSUE-059 Home Chat 新建会话 URL 不同步 sessionId（深链 / 书签 / 分享失效）（2026-05-06）

- **表因**：浏览器实机点击 sidebar `+ New` 创建会话 `b2005e1e`，sidebar 高亮该会话：
  - 地址栏 URL 仍是 `http://localhost:3192/`，未变成 `/?sessionId=b2005e1e`；
  - 复制 URL 在新 tab 打开 → 回到 list[0] 默认会话，无法定位到原会话；
  - 浏览器后退/前进键语义错位，无法在会话间导航。
- **根因**：[`apps/negentropy-ui/app/page.tsx`](../apps/negentropy-ui/app/page.tsx):15 `useState<string | null>(null)` 单点持有 sessionId，[`features/session/hooks/useSessionListService.ts::startNewSession()`](../apps/negentropy-ui/features/session/hooks/useSessionListService.ts):290 仅 `setSessionId(id)` 更新 React state，**无任何 `useRouter` / `useSearchParams` 同步 URL** 的代码路径。刷新后通过 [`loadSessions()`](../apps/negentropy-ui/features/session/hooks/useSessionListService.ts):85 自动选择 `nextSessions[0]` 实现"伪持久化"，但 URL 永远不反映 sessionId。
- **处理方式**：[`app/page.tsx`](../apps/negentropy-ui/app/page.tsx) 把 sessionId 的 single source of truth 从 React state 升级为 URL `?sessionId=` 参数：
  1. 引入 `useRouter` / `usePathname` / `useSearchParams`，初始化 `useState` 时读 URL 解析结果；
  2. `setSessionId` callback 包装：先 `setSessionIdState`，再 `router.replace(pathname?sessionId=...)` `{ scroll: false }`，避免污染浏览器历史栈与刷新页面；
  3. `useEffect` 监听 URL 反向同步 state（外部改 URL 的极少见但需覆盖的路径）；
  4. URL 变化由 `router.replace` 触发，不影响子组件 props 与 `agent` memo；
  5. E2E 覆盖：[`tests/e2e/home-chat.spec.ts`](../apps/negentropy-ui/tests/e2e/home-chat.spec.ts) 新增 C7-D "URL sync：点击 + New 后 URL 应包含 ?sessionId=，刷新仍保持，可被外部 URL 直接定位" 三层守卫。
- **后续防范**：
  1. **任何"用户可达的应用状态"必须考虑 URL 反映性**：分享 / 书签 / 浏览器返回前进语义都依赖；
  2. **避免双 source of truth**：URL ↔ React state 必须有清晰的 owner（本案以 URL 为权威，state 仅是缓存）；
  3. **次级会话切换、归档恢复、归档列表过滤**等其他会话相关交互一并迁移到 URL（本 PR 仅覆盖新建路径，下一轮把 `setSessionId` 在 `archiveSession` / `handleSessionChange` / 归档 view 切换中也走 router.replace）。
- **同类问题影响**：Memory timeline range / Knowledge corpus filter / Skills view mode 等一切"用户可分享的视图状态"都应同步 URL；建议建立 [`utils/url-state-sync.ts`](../apps/negentropy-ui/utils/url-state-sync.ts) 通用 hook 统一 pattern。

---

## ISSUE-060 流式双内容根因层修复（``isSemanticEquivalentEntry`` 严格前缀放宽到 multiset 互含）（2026-05-06）

> 续 [ISSUE-058](#issue-058)：v1 PR #465 在 ``chat-display.ts::dedupeRedundantTextSegments`` 加了第 5 层 UI 兜底，本期把根因层（ledger merge）也补上。

- **表因**：v1 兜底层依赖"较短段被较长段以 ≥80% multiset 覆盖"才丢弃残缺版，但 ledger 层仍把"残缺累积版 + final 完整版"保留为两个 entry → conversation-tree 产生两个 text node → chat-display 收到两份 segment 后再丢弃其一。一来浪费 React 重渲染，二来"根因层未治"使任何下游再加新视图都会重蹈覆辙。
- **根因**：[`utils/message-ledger.ts::isSemanticEquivalentEntry`](../apps/negentropy-ui/utils/message-ledger.ts):114-119 要求双方内容**严格前缀**关系，残缺累积版（"机器校"）与 final 完整版（"机器校验"）字符级不一致 → 直接 short-circuit `return false` → ledger 不合并；后续的 `historicalCompletesClosedRealtime` 判定（L146-151）同样仅看前缀；时间窗硬上限 8s 也对长 LLM 回复（partial 起始 → final 终态间隔 25s）误拒。
- **处理方式**：在 [`utils/message.ts`](../apps/negentropy-ui/utils/message.ts) 新增 `characterMultiset` / `multisetCoverage` 通用 helper，让 ``message-ledger`` 与 ``chat-display`` 共享同一字符 multiset 工具（去重 v1 在 `chat-display.ts` 的本地实现）；`isSemanticEquivalentEntry` 把"严格前缀"放宽为"前缀 ∨ multiset 覆盖 ≥0.85 + 长度比 ≥1.1"，命中兜底路径时同步绕过 8s 时间窗硬限；`historicalCompletesClosedRealtime` 的前缀检查同样升级为"前缀 ∨ multiset 覆盖 ≥0.85"；新增最终判据：当兜底路径成立时直接返回 true，避免 `isEquivalentMessageContent` 漏判同源消息。配套 5 个 vitest 单测覆盖正交场景（命中 / 主题不同 / 长度比不足 / 端到端 merge 1 条 / 端到端不合并 2 条），现有 ISSUE-041 11 个测试不受影响。
- **后续防范**：
  1. **覆盖率阈值的取值有依据**：UI 层兜底（``chat-display`` 第 5 层）阈值 0.8（误删一条历史消息成本可控），ledger 根因层 0.85（合并后影响下游 conversation-tree 节点匹配 + 渲染 + dedupe，需要更高置信度）；任何调整必须配套实测真实场景的覆盖率分布；
  2. **multiset 覆盖与 bigram Jaccard 适用场景不同**：multiset 单向覆盖适合"残缺版被完整版覆盖"，bigram Jaccard 适合"双向相似"；不同场景选不同工具，不要拿 Jaccard 凑大表面积；
  3. **根因层 + UI 层双轨防御**：v1 的 UI 兜底层保留作"最后防线"，本期 ledger 修复让大多数场景在根因层就被合并，UI 层仅在 ledger 漏判（极端情形）时启用。
- **同类问题影响**：所有"流式累积 + final hydration 双路径"的 ledger 状态机都可能因严格前缀而漏合并；建议把 multiset coverage helper 推广到 KG SSE 进度合并、Tool Progress 流式更新等同类场景。

---

## ISSUE-061 会话归档列表 view 状态未同步 URL（v2-D 全路径补全）（2026-05-06）

> 续 [ISSUE-059](#issue-059)：v1 PR #465 仅覆盖"新建会话"路径的 URL 同步，会话切换 / 归档 / 解档因 ``setSessionId`` 通过 ``app/page.tsx`` 包裹版传入，已自动同步；本期补齐唯一遗漏路径 — 归档面板的 view 切换。

- **表因**：点击侧边栏 ``Archived`` 切换到归档面板查看历史归档会话时，地址栏 URL 不变；刷新后回到 active 视图，归档面板的浏览状态丢失；复制 URL 在新 tab 打开无法直达归档面板。
- **根因**：[`features/session/hooks/useSessionListService.ts`](../apps/negentropy-ui/features/session/hooks/useSessionListService.ts):46 用 ``useState<SessionListView>("active")`` 单点持有 ``sessionListView``，整个 hook 内部封闭，无任何 ``useRouter`` / ``useSearchParams`` 同步 URL 的代码路径。
- **处理方式**：把 ``sessionListView`` 升级为 URL 单源派生（与 v1 ``sessionId`` 模式一致）：
  1. 引入 ``next/navigation`` 的 ``useRouter`` / ``usePathname`` / ``useSearchParams``；
  2. ``sessionListView`` 改为 ``searchParams?.get("view") === "archived" ? "archived" : "active"`` 派生；
  3. ``setSessionListView`` 改为 callback 形式，直接调 ``router.replace`` 同步 URL；
  4. 测试基建：现有 4 个 ``useSessionListService`` 单测因依赖 ``next/navigation`` 失败，新增 ``vi.hoisted`` mock + 用 ``useSyncExternalStore`` 让 ``useSearchParams`` 反映 ``router.replace`` 的写入，让 hook 测试在 jsdom 环境无 App Router 包裹下也能完整运行；新增 2 个 ISSUE-061 case（active→archived 写入 ?view= / archived→active 删除 ?view=）；``home-flow.test.tsx`` integration 测试同步加 ``next/navigation`` mock；E2E 在 ``home-chat.spec.ts`` 加 C7-F 四层守卫（初始无 ?view= / 切换写入 / reload 保持 / 外部 URL 直达）。
- **后续防范**：
  1. **任何 hook 内部封闭的 useState 都应审视"是否属于用户可分享的视图状态"**：是 → 必须升级为 URL 派生（参见 ``app/page.tsx`` 与本 hook 的实现模式）；
  2. **测试 mock 的反应式订阅**：``vi.hoisted`` + ``useSyncExternalStore`` 模式可在 jsdom 环境模拟"router.replace 后下一次 render 看到新 searchParams"；建议把这套 mock 抽出成 ``tests/helpers/next-navigation.ts``，下一轮把 Memory / Knowledge / Skills view 状态升级时复用；
  3. **integration 测试的 mock 完整性**：任何使用 ``next/navigation`` 的 hook 在 ``HomeBody`` / 其它顶层组件被引入后，integration 测试必须 mock 之，否则 ``useRouter()`` 在无 App Router 包裹下抛错。
- **同类问题影响**：Memory timeline filter / Knowledge corpus filter / Skills create-mode flag 等一切"用户切换并希望分享的视图状态"都应套用本 hook 模式；通用 ``utils/url-state-sync.ts`` 抽象延后到第三个相同 case 出现后再做（YAGNI）。

---

## ISSUE-062 全站危险操作残留原生 confirm/alert（2026-05-06）

- **表因**：P0 UI 全站巡检静态扫荡发现，ISSUE-054 已升格通用 [ConfirmDialog](../apps/negentropy-ui/components/ui/ConfirmDialog.tsx) 后，Interface Models / MCP / SubAgents、Knowledge Base / Catalog / Wiki 仍残留 `window.confirm`、裸 `confirm` 与 `alert`。实机会弹出浏览器原生对话框，破坏应用视觉一致性，也让 E2E 难以通过统一 `data-testid` 锚点验证。
- **根因**：ISSUE-054 只修 SessionList 并提出“后续扫荡 MCP / SubAgents”，但缺少跨目录防回归门禁；各页面把“确认危险操作”作为局部实现，未复用通用确认原语，导致同型问题分散复发。
- **处理方式**：
  1. 新增 [useConfirmDialog](../apps/negentropy-ui/components/ui/useConfirmDialog.tsx)，提供 `await confirm({ title, message, confirmLabel, destructive })` 的最小封装；
  2. 将 MCP Server 删除、SubAgent 删除与内置重命名、Models 供应商/模型删除、Knowledge Corpus/Source/节点/文档归属/Wiki 发布删除取消发布等路径统一迁移到通用 ConfirmDialog；
  3. MCP / SubAgents 删除失败不再 `alert()`，改写入页面错误态；
  4. 新增 `tests/unit/ui/useConfirmDialog.test.tsx` 与 `tests/unit/ui/no-native-dialogs.test.ts`，验证确认/取消语义并阻断 `window.confirm/alert/prompt` 与裸 `alert/prompt` 回归。
- **后续防范**：
  1. 所有危险操作必须复用 `components/ui/ConfirmDialog` 或 `useConfirmDialog`，禁止直接调用浏览器原生 dialog；
  2. 若后续需要“输入名称二次确认”，应扩展通用组件而不是回退到 `prompt()`；
  3. 下一步可把静态测试升级为 ESLint `no-restricted-globals` / `no-restricted-properties` 规则，覆盖裸 `confirm()` 的 AST 级识别。

## ISSUE-063 归档视图 Back → 实时视图后会话内容残留（state stale）（2026-05-06）

- **表因**：P0 UI 全功能巡检（cm.huang@aftership.com，roles=["user"]）实机复现：进入 `?view=archived` 选某归档会话（如 `b8676a4a`） → 点 "Back" → URL 正确切回 `?sessionId=53f4a06f`、`view` 删除，但**会话主区、STATE SNAPSHOT、EVENT TIMELINE 全部仍展示 b8676a4a 的消息/事件**。
- **量化**：`evaluate_script` 返回 `haveStaleSession=true / haveStalePong=true / haveTimelineOld=true`，与 URL 上的 `sessionId=53f4a06f-...` 不一致。手动点 sidebar 中的同一 session 后状态恢复正常（`havePlaceholder=true / 残留全部 false`），证明 bug 仅在 Back 路径。
- **根因**：[`useSessionListService.loadSessions`](../apps/negentropy-ui/features/session/hooks/useSessionListService.ts) 在 view 切换后重拉列表时，若旧 sessionId 不在新列表中会自动 `setSessionId(nextSessions[0]?.id)` 切换，但此路径**未调用 `onClearActiveSession()`**——前一会话（归档下选中的 b8676a4a）的 messages/state/events projection 缓存未被清空。手动点 sidebar 的 `selectSession` 路径由 `home-body.handleSessionChange` 已 clear，但自动切换路径漏补。
- **处理方式**：在 `loadSessions` 自动切换 sessionId 之前补一次 `onClearActiveSession()` 调用，与手动点击路径形成对称行为。修改文件：[useSessionListService.ts](../apps/negentropy-ui/features/session/hooks/useSessionListService.ts)。
- **后续防范**：
  1. 任何"侧栏分组切换 + sessionId/itemId 变化"路径都需要 audit 是否补 clear（Memory audit、Knowledge corpus filter 同模式）；
  2. e2e 应新增 archived → back → 主区不应残留前次会话内容的断言（ISSUE-063 回归基线）。

## ISSUE-064 Home Send 按钮点击 = no-op，仅 Enter 键能发送（2026-05-06）

- **表因**：P0 UI 巡检中，textbox 输入指令后**点击 "Send" 按钮**（非 disabled 状态）**没有任何 API 请求**（network 列表无 POST/SSE）、控制台无报错；textbox 内容保留、消息未渲染。**改用 Enter 键**则正常发送（`run_started` + STREAMING）。
- **根因**：[`home-body.sendInput`](../apps/negentropy-ui/app/home-body.tsx) 中存在 `if (!agent) return;` 早返。当 sessionId 已存在但 agent 重建尚未完成时，`onClick` 与 `onKeyDown` 都进入 `sendInput`，按钮未 visually disabled、`isGenerating=false`，但内部 silent return。Enter 路径之所以"看似可用"，是因为多数情况下用户敲 Enter 时 agent 已就绪。
- **处理方式**：
  1. `sendInput` 在 `!agent && sessionId` 早返时**把指令缓存到 `pendingSendRef`**，并设置 `pendingForSessionRef.current = sessionId`，由"自动重发 pending" Effect 在 agent 重建完毕后接力发送（与 `!sessionId` 路径同源）；
  2. 同时弹 toast `"Agent 正在初始化，已排队待发送..."` 给用户可见反馈，避免 silent no-op；
  3. 其它静默早返路径（`pendingConfirmations / streaming / connecting / blocked`）也补对应 toast，统一用户预期。
- **后续防范**：
  1. 所有"看似可用但内部静默拒绝"的按钮都应当补 toast/inline 反馈，禁止 silent no-op；
  2. e2e 增加"agent 重建窗口内点 Send 应入队 + agent ready 后自动发送"基线。

## ISSUE-065 流式 partial 单段 vs final 多段聚合 multiset 兜底（Layer 6）（2026-05-06）

- **表因**：P0 巡检发送 `请用一句话回答：什么是熵？尽量简短。` → STREAMING → `run_finished` 后**单一 assistant 容器**内同时存在两个 `<p>`：① partial 残片（混入 reasoning first-line + 中文字符级碎片化："热力学"→"力"、"精确定义"→"确定义"、"简短扩展"→"短展"、"需要继续吗？"→"吗？"）；② final 完整段落（标题 + 后续 + 建议下一步 共 3 段）。
- **根因**：ISSUE-058（5 层 UI 兜底，multiset coverage ≥80%、length ratio ≥1.15）+ ISSUE-060（ledger merge 互含 ≥85%）已修过同类两两比较场景，但**partial 单段（earlier）vs final 多段（later[1..n]）** 时，partial 因混入 first-line 而比 **final 任一单段** 都长，length-ratio 守卫永远不通过，5 层全部漏检。
- **处理方式**：在 [`utils/chat-display.ts`](../apps/negentropy-ui/utils/chat-display.ts) `dedupeRedundantTextSegments` 增加 **Layer 6 聚合判据**：把 earlier 与所有未被丢弃的后续 text 段拼接的 `aggregate` 比较，若 multiset coverage ≥0.7（放宽阈值容忍中文字符碎片化）且 `aggregate` 比 earlier 长 ≥1.05x，则丢弃 earlier。新加 4 个单测覆盖命中 / 长度不足 / 覆盖率不足 / 短文本保护。
- **后续防范**：
  1. 任何"流式累积 + final hydration 双路径"模块（KG SSE / Tool Progress 进度流式）必须 audit 是否同样需要聚合判据；
  2. 后端 ADK SSE chunk 在 UTF-8 多字节字符边界处的切分逻辑需要复核（`apps/negentropy/.../adk/**`），避免在源头产生中文字符级碎片化；
  3. e2e 在中文长回复 + tool call 双轮 LLM 场景下添加"主区只渲染 final、无 partial 残留"的快照断言。

## ISSUE-066 Home LLM 下拉对普通用户应静默降级（2026-05-06）

- **表因**：P0 巡检中普通用户（roles=["user"]）打开 Home，控制台立刻出现 `WARN llm_options_fetch_failed: Failed to fetch model configs: Forbidden`；`/api/interface/models/configs?model_type=llm&enabled=true` 返回 403，LLM 下拉只剩 "Default"。
- **根因**：该端点设计为 admin-only（写场景需要），但前端在 user 角色下也调用它做"读 enabled 列表"。Backend 的 401/403 在权限语义上是合理拒绝，但前端把它当作错误处理，弹出 WARN 并污染 RUNTIME LOGS。
- **处理方式**：[`fetchModelConfigs`](../apps/negentropy-ui/features/knowledge/utils/knowledge-api.ts) 区分 401/403（合理拒绝→返回空数组）vs 其它错误（异常→抛出）。前者让 home-body 的 catch 不再触发 `addLog("warn", ...)`，下拉静默降级到系统默认模型。500 等仍照旧抛出。
- **后续防范**：
  1. 任何"admin-only 数据 + 用户视角需要可见"的端点都应区分 read-options（开放）vs full-config（admin），或前端在 401/403 时静默降级；
  2. 长期可拆 backend 端点为 `GET /api/interface/models/options`（user-readable）+ `GET /api/interface/models/configs`（admin-only 全字段）。

## ISSUE-067 Memory `/api/memory` 5xx 错误态可重试（2026-05-06）

- **表因**：P0 巡检 `/memory/audit`、`/memory/timeline` 顶部红字 "Failed to fetch memories: Internal Server Error"；左栏 Users 列表 "No users found"，但 `/memory` Dashboard 显示 USERS=1。`curl http://localhost:3292/memory?app_name=negentropy` 返回 500。
- **根因**：Backend 在无 user_id 时遍历 ADK session_service 触发 500；前端只有红字英文 message、无重试入口，用户被迫刷新整页或卡死。
- **处理方式**：
  1. [`fetchMemories`](../apps/negentropy-ui/features/memory/utils/memory-api.ts) 错误信息中文化（`加载记忆失败：500 Internal Server Error`），并在 Error 对象上补 `statusCode` + `retryable` 属性（5xx 与网络层 0 状态码视为 retryable）；
  2. [`/memory/audit`](../apps/negentropy-ui/app/memory/audit/page.tsx) 与 [`/memory/timeline`](../apps/negentropy-ui/app/memory/timeline/page.tsx) 的错误 banner 在 `error.retryable===true` 或 message 命中 `5\d\d|网络|timeout` 时显示"重试"按钮，调用 hook 暴露的 `reload`。
- **后续防范**：
  1. 后端 `/api/memory` 应在 user_id 缺失时返回空数组 + 200，而不是抛 500；本次 UI 兜底是过渡方案；
  2. 全站可重试错误统一使用 `error.retryable` 协议，让 UI 一致渲染重试按钮。

## ISSUE-068 i18n 复数文案 JSX 节点相邻被规范化为空格（2026-05-06）

- **表因**：P0 巡检发现 `/knowledge/documents`（"2 document s"）、`/knowledge/dashboard`（"11 run s"）、`/memory/audit`（"0 decision(s) pending"）等多处文案在主区与 a11y 树中显示为分词空格断字，原因是 JSX 模板中 `{count} document{count !== 1 ? "s" : ""}` 把英文复数 `s` 作为独立 React 节点，渲染后相邻 text node 被规范化为空格。
- **处理方式**：把上述位置改写成单字符串模板字面量 `${count} document${count !== 1 ? "s" : ""}`，避免相邻 React 节点。修改文件：[`knowledge/documents/page.tsx`](../apps/negentropy-ui/app/knowledge/documents/page.tsx)、[`knowledge/dashboard/page.tsx`](../apps/negentropy-ui/app/knowledge/dashboard/page.tsx)、[`memory/audit/page.tsx`](../apps/negentropy-ui/app/memory/audit/page.tsx)。
- **后续防范**：
  1. 复数文案统一走单字符串模板；
  2. 长期建议把英文复数迁移到 i18n 词条（如 `useTranslation` + ICU `{count, plural, one {document} other {documents}}`）。

## ISSUE-069 Wiki 取消发布 ConfirmDialog 标题与确认按钮文字相同（2026-05-06）

- **表因**：P0 巡检 `/knowledge/wiki` 取消发布弹窗：dialog 标题 "取消发布" + 确认按钮 "取消发布" + Cancel 按钮 "Cancel"（中英混杂），用户易混淆"我是要取消这次操作还是要执行取消发布"。
- **处理方式**：[`WikiPublicationDetail`](../apps/negentropy-ui/app/knowledge/wiki/_components/WikiPublicationDetail.tsx) 把 dialog 标题改为"取消发布 Wiki 站点"、确认按钮改为"确认取消发布"、message 增加 destructive 后果说明。
- **后续防范**：所有 destructive 操作的 ConfirmDialog 应满足 `title !== confirmLabel`，确认按钮显式包含动作动词（"确认 X"），避免与"放弃这次操作"语义混淆。

---

## ISSUE-070 Agent 答复 4 大缺陷（等待占位 / 双内容 / 推理空内容 / 刷新乱序）（2026-05-07）

- **表因**：用户截图反馈 4 处可视化缺陷：
  1. Agent 刚开始流式答复但还未产出 token 时，气泡内**完全空白**、无任何视觉反馈；
  2. 同一次回答内同时出现「partial 残缺版（如 "ong toPing Possible needs concrete..."）+ final 完整版（"Summary — done: Replied 'Pong'..."）」**双段内容并排渲染**；
  3. 推理面板展开后**仅显示「思考完成 · 推理阶段」标题**，看不到实际推理文本；
  4. 多轮发送 + **刷新页面后**，user 消息漂移到 assistant 回复**之后**，时序错乱。
- **根因**：
  1. [`MessageBubble.tsx`](../apps/negentropy-ui/components/ui/MessageBubble.tsx) 的 ``isStreaming`` 标志要求 ``content.trim().length > 0``；空内容时整个气泡（含 streaming indicator）都不渲染。
  2. [`isStreamingDuplicateOfLater`](../apps/negentropy-ui/utils/chat-display.ts) 的 multiset 阈值 0.8 / 长度比 1.15 对「LLM 双轮自我修订」型残缺-改写双段漏检；[`findMatchingTextNodeId`](../apps/negentropy-ui/utils/conversation-tree.ts) 在 closed 节点时仅允许内容严格相等匹配，致同源 hydration 落到独立 text node。
  3. [`ReasoningStepData`](../apps/negentropy-ui/components/ui/ReasoningPanel.tsx) 类型缺 ``content``/``result`` 字段；``ReasoningStep`` 仅渲染标签；``conversation-tree`` 把 ``ne.a2ui.thought`` CUSTOM 事件当作普通 custom 节点忽略，未注入对应 reasoning 节点 payload。
  4. [`compareLedgerEntriesByTime`](../apps/negentropy-ui/utils/message-ledger.ts) 同时间戳依赖 ``sourceOrder`` + ``id.localeCompare``；realtime user message 时间戳取自 client clock、assistant 取自 server RUN_STARTED，毫秒级时钟漂移让 user 落后于 assistant 几毫秒，刷新后排序漂移。
- **处理方式**：
  1. **等待占位**：``MessageBubble`` 解耦 ``isStreaming`` 与 ``hasContent``，新增 ``showWaitingPlaceholder``；``AssistantReplyBubble`` 在 segments 全空 + streaming 时渲染三点 ``animate-bounce`` 占位（``data-testid="agent-waiting-placeholder"``）。
  2. **双内容根因**：``isStreamingDuplicateOfLater`` 阈值放宽至 multiset ≥0.7 + 长度比 ≥1.10，新增第 6 层 LCS（最长公共子序列）兜底（≥0.65，长内容首尾截断 O(m·n) 防退化）；``findMatchingTextNodeId`` 在 closed 节点时放宽匹配为「严格相等 ∨ 严格前缀 ∨ multiset 覆盖 ≥0.75」。注：与 ISSUE-065 Layer 6 聚合判据（earlier vs aggregate-of-laters）正交，本次的 LCS 是同段两两比较的"顺序+字符"维度补强。
  3. **推理内容**：``ReasoningStepData`` / ``ReplyReasoningDisplaySegment`` 增加 ``content?``/``result?`` 字段；``ReasoningStep`` 在展开态渲染 content（``whitespace-pre-wrap``）+ result（``pre`` 限高滚动）；``conversation-tree`` 对 ``ne.a2ui.thought`` 调用 ``findLatestReasoningNode`` 把 thought.text 累积写入 reasoning 节点 ``payload.content``；``createReplyReasoningSegment`` 透传 content（fallback 至 ``node.summary``）；``mergeSteps`` 在 started→finished 时合并两侧 content。
  4. **排序乱序**：``compareLedgerEntriesByTime`` 同时间戳新增 role 优先级（``user < system < developer < assistant < tool``）；``conversation-tree`` children 排序同步加入 role 维度；``chat-display`` blocks 排序在 1s 时钟漂移容忍窗口内让 user message 优先于 assistant-reply / tool-group。
  5. **测试**：12 个新增用例覆盖等待占位 3 + 推理 content 渲染/合并 3 + 同时间戳 user 排序 1 + LCS 函数 5；全套 580 单测通过；浏览器实机验证刷新后 user→assistant 顺序保持正确，推理面板展开能看到具体内容，无重复气泡。
- **后续防范**：
  1. **两层防御**（UI 兜底 + 根因层）必须同时升级：``chat-display`` 兜底阈值放宽时，``message-ledger`` 同源合并 helper 也应同步升级；
  2. **LCS 工具的复用**：``longestCommonSubsequenceRatio`` 已抽到 ``utils/message.ts``，下次「同源不同表面」类去重场景（KG SSE 进度合并、Tool Progress 流式更新等）建议优先复用而非新写本地实现；
  3. **角色优先级与时钟漂移容忍窗口**：任何「按 timestamp 排序」的视图（Timeline / Activity Log / Memory）都应审视是否需要类似 role 优先 + 漂移窗口；
  4. **空状态可见性**：所有「streaming = true」的 UI 路径都必须有等待占位（无内容时不可空白），借鉴本 issue 的 ``data-testid="agent-waiting-placeholder"`` 模式建立断言；
  5. **CUSTOM 事件的语义价值**：``ne.a2ui.thought`` / ``ne.a2ui.reasoning`` 等自定义事件如果在前端被「无差别忽略」就失去了承载价值；新增 CUSTOM 事件时必须明确数据流路径与渲染锚点。
- **同类问题影响**：所有「streaming + 空 content」的 UI 路径（Tool Progress 等待首条事件、KG SSE 等待首条进度）；所有「LLM 自我修订」可能产生残缺-完整双段的去重场景；所有「时钟漂移」可能导致刷新后乱序的消息列表（Memory timeline、Activity Log、Audit Log）。
- **2026-05-07 评审回归（同 ISSUE-070 范畴）**：
  1. **`chat-display` 时钟漂移窗口 1s → 0.2s**：原 1s 容忍窗口配合双向 user 优先，会把「user 提问 → assistant 回复中（≤1s 内）→ user 紧追问」的真实时序误判为漂移，把 assistant 排到 follow-up 之后，错位为「问 → 紧追问 → 答（错位）」。收紧到 0.2s（典型 NTP 时钟漂移 < 100ms 的 2x 守护带）即可保留漂移修正能力，又排除秒级 follow-up 误吞。
  2. **`longestCommonSubsequenceRatio` 分母语义自洽**：旧实现 reduce() 把超长串截到首尾各 1000（≤2000 字符），但 ratio 分母仍取截断前的 `Math.min(trimA.length, trimB.length)`；当较短串 > ~3077 字符时 lcsLen ≤ 2000 / 分母 > 3077，ratio 上界 < 0.65，第 6 层兜底对长答复永远不触发。改为 `Math.min(sA.length, sB.length)`（与实际参与 LCS 计算的长度一致）保持语义自洽。
  3. **回归测试覆盖**：新增 3 个用例（chat-display.test.ts × 2 覆盖窗口内漂移修正与窗口外 follow-up 真实时序保留；message.test.ts × 1 覆盖长内容 LCS 兜底仍能 ≥ 0.65）。

---

## ISSUE-071 LLM 改写覆盖导致流式 partial+final 双内容（中文场景；2026-05-07）

- **表因**：用户在新会话发送「请用一句话回答：什么是负熵？」后，等待流式结束，assistant 气泡内**同时**渲染两段语义等同但表面不同的中文：
  1. partial 残缺中间态：「负熵...通过输入能量或入化信息...完成：了一句概念定义...采选项」（缺字、句法不通）；
  2. final 完整改写版：「负熵...通过输入能量或引入结构化信息...已完成：提供了一句概念性定义...是否采纳哪个选项？」。
  双段直接拼接展示，视觉上 ≈ 双气泡。
- **根因**：与 ISSUE-058/060/065/070 同源但层次不同——chat-display 兜底层（Layer 5/6）只在「多个 text segment 间」做去重；本场景下 LLM 把 partial 与 final 都写入**同一**`text segment`（流式 delta），由 [`accumulateTextContent`](../apps/negentropy-ui/utils/message.ts) 在节点累加。`accumulateTextContent` 旧实现仅识别：① existing.endsWith(incoming) ② incoming.startsWith(existing) ③ suffix-prefix overlap；都不命中时直接 `${existing}${incoming}` 强行拼接。中文流式改写的 partial 与 final 互不为前缀、首尾无 overlap，遂逃逸所有合并分支，UI 渲染就出现双内容。
- **处理方式**：
  1. **根因层**：[`accumulateTextContent`](../apps/negentropy-ui/utils/message.ts) 增加第 4 层「LLM 改写覆盖」识别。新私有函数 `isRewriteCoverOfExisting(existing, incoming)`：min length 50 + length ratio 1.05 + multiset coverage 0.7 + LCS ratio 0.6（与 chat-display 兜底层阈值对齐）。命中时丢弃 existing 仅保留 incoming，杜绝同 segment 内的双内容拼接。
  2. **测试守卫**：`tests/unit/utils/message.test.ts` 新增 5 个 vitest 用例，包含真实复现的中文双段、合法追加场景、空内容、短文本绕过等正反用例，全部通过；全套 594 单测无回归。
  3. **联动 ISSUE-066 修复**：本次浏览器验证暴露的 `/api/interface/models/configs?enabled=true` 普通用户 403 长期残留，UI 层「静默 return []」无法抑制浏览器 console 原生错误。后端 `apps/negentropy/src/negentropy/interface/models_api.py::list_model_configs` 改为：`enabled=True` 路径放宽给登录用户（用 `_model_config_to_public_dict` 剔除 config JSONB，仅返回 metadata，零敏感字段泄漏）；其他过滤组合保持 admin 限制。
- **后续防范**：
  1. **同源同节点的双内容不能依赖 chat-display segment 间去重**——`accumulateTextContent` 必须自身具备同源识别能力，否则 UI 兜底永远收不到机会；
  2. **改写覆盖的阈值与 chat-display Layer 5/6 对齐**，避免两侧阈值漂移导致「ledger 合并 ≠ UI 去重」的不一致；
  3. **接口权限粒度**：`enabled=True` 这类 user-facing readonly listing 不应一律 admin gate；当用户层 fetch 必走时，浏览器 console error 无法静默，是产品级回归；
  4. **公开数据序列化用独立函数**（`_model_config_to_public_dict`）：作为公开数据的稳定边界，避免后续新增字段时意外泄漏。
- **同类问题影响**：所有可能出现「LLM 自我修订并重发同 chunk」的中文流式场景（Memory 提取、Knowledge 摘要、Tool Progress 长 result 改写）；所有 admin-gated readonly 列表接口都应审视是否需要拆出 user-facing 子集。

---

## ISSUE-072 Agent 等待占位仅在「reasoning 已挂载」时不再误吞，但流式启动到首段之间仍空白（2026-05-07）

- **表因**：发送消息后，user bubble 立即出现，但 assistant 侧的等待占位（三点脉冲）**全程不渲染**——即使后端 `RUN_STARTED` 已发出（左下 STATE = STREAMING），主区在 0~3s 内仍完全空白，直到首个 `TEXT_MESSAGE_CONTENT` 或 `ne.a2ui.reasoning` 抵达才开始渲染气泡，破坏「点 Send 即有反馈」的核心 UX。
- **根因**：分两层。
  1. **第一层（已修复）**：[`AssistantReplyBubble.tsx`](../apps/negentropy-ui/components/ui/AssistantReplyBubble.tsx) 旧 `hasVisibleSegment` 把 `kind=reasoning` 一律视为可见。但 `ne.a2ui.reasoning` `phase=started` 在 100ms 内即下发只含 `stepId/title` 的空 reasoning step，立即把 placeholder 条件 false 化，导致占位永远不会显式渲染。本次将判据收紧为「`finished` 或 `content/result` 已累积」+ `tool-group` 增加 `tools.length > 0` 守卫。
  2. **第二层（遗留）**：[`chat-display.ts::walkTurnNode`](../apps/negentropy-ui/utils/chat-display.ts) 第 825-827 行：`if (!replyBuilder || replyBuilder.segments.length === 0) { replyBuilder = null; return; }` —— 当 turn 已开启但还没收到任何 assistant 子节点时，**根本不会推入 `assistant-reply` block**，导致 `AssistantReplyBubble` 容器都不存在，第一层修复仅覆盖「容器已存在但被 reasoning 假阳性吞占位」的子集。
- **处理方式**：
  1. 第一层：本 PR 已落地（typecheck + lint + 594 单测通过 + 浏览器实测：reasoning started 不再吞占位）；
  2. 第二层：留待后续 PR 处理——需要在 `walkTurnNode` 检测 `turn.streaming === true && children.empty` 时，合成一个仅含 placeholder kind 的 segment 推入 reply block（或在外层 `chat-display` 入口为「streaming turn without children」单独 push placeholder block）。涉及与 conversation-tree turn lifecycle、ledger merge 的对齐，需要独立设计一轮。
- **后续防范**：
  1. **空状态可见性**断言不能只覆盖「容器存在」分支——需要从 turn 启动开始全程兜底；
  2. **`data-testid="agent-waiting-placeholder"` 的 e2e 守卫**应包含「Send 后 100ms ~ 1s 窗口必有占位」的最小存在断言，避免后续 reasoning/tool-group 改动再次回归。
- **同类问题影响**：所有「streaming = true」的 UI 路径中，「turn 启动到首子节点之间的全空区间」都需类似处理（KG SSE 等待首条进度、Tool Progress 等待 args event 等）。

---

## ISSUE-073 Sidebar 会话切换在生产 build 下 URL 不更新（dev 模式正常）（2026-05-07）

- **表因**：`pnpm -C apps/negentropy-ui build && node scripts/start-production.mjs` 启动的生产模式下，点击 sidebar 中其他会话项，URL 与 main 区都不切换；点 + New 创建新会话后 sidebar 显示新项但 URL 仍指向旧 session。dev 模式（`pnpm dev`）下完全正常。
- **根因**：尚未确证。可疑点：
  1. `app/page.tsx::setSessionId` `useCallback([pathname, router, queryString])`，生产 build 下 React 优化路径与 dev 不同，可能让 setter 走向 stale closure；
  2. `agent` `useMemo([sessionId, user])` 在 sessionId 改变时新建 NdjsonHttpAgent，与 router.replace 同帧 race；
  3. Next.js 16 turbopack vs webpack 在 prod build 下对 `useSearchParams` Suspense bailout 的处理可能与 dev 有差异。
- **处理方式**：本 PR 仅记录复现路径，未根因修复。
- **同类问题影响**：所有依赖 `useSearchParams` 派生 state + `router.replace` 同步的页面（Memory timeline filter、Knowledge corpus filter 等若启用）。
- **建议下一步**：用 dev mode + `NODE_ENV=production` 的混合 build 复现，必要时把 `setSessionId` 重构为 `startTransition` 包裹，或抽出 `useUrlState` 自定义 hook 集中处理。

---

## ISSUE-074 ConfirmDialog 中英文混用 + MCP 模块标题/按钮重复（2026-05-07）

- **表因**：`/interface/mcp` 删除 server 弹出的 ConfirmDialog 标题为「Delete MCP Server」、按钮为「Delete」（标题与按钮重复，违反 ISSUE-069 规范），全部英文；`/knowledge/catalog` 删除节点弹窗标题中文、按钮中文，但 Cancel 仍英文；`/knowledge/wiki` 取消发布标题/确认按钮中文但 Cancel 英文。
- **根因**：ISSUE-062 升格 ConfirmDialog 时未为所有调用方建立文案规范。MCP 页面调用方未传 destructive title/confirmLabel 改写；ConfirmDialog 默认 cancelLabel "Cancel" 在中文场景下未本地化。
- **处理方式**：本 PR 仅记录证据。后续修复方向：
  1. ConfirmDialog 默认 `cancelLabel` 改为「取消」（中文站默认中文，多语言由 i18n 驱动）；
  2. MCP 删除调用方传 `title="删除 MCP Server"`、`confirmLabel="删除"`；
  3. 增 vitest 守卫：`title !== confirmLabel` + `cancelLabel.length > 0`。
- **同类问题影响**：所有 ConfirmDialog 调用方都需复审文案；建议增加 ESLint 自定义规则在调用 `useConfirmDialog()` 时强制 destructive 时 `title!==confirmLabel`。

---

## ISSUE-075 Thinking 开关缺失 + 推理面板误展示阶段标识（2026-05-07）

- **表因**：Home 对话推理面板展开后出现「阶段完成：步骤 synth-step:...」等生命周期标识，而不是模型推理过程中产生的真实内容；同时用户无法在输入区显式请求开启模型 Thinking / Reasoning 能力。
- **根因**：
  1. [`Composer`](../apps/negentropy-ui/components/ui/Composer.tsx) 仅提供模型选择和附件入口，没有 per-session Thinking 控制；[`app/api/agui/route.ts`](../apps/negentropy-ui/app/api/agui/route.ts) 也只把 `selected_llm_model` 写入 `state_delta`。
  2. 后端 [`model_resolver`](../apps/negentropy/src/negentropy/config/model_resolver.py) 只对 Claude/Anthropic 与 OpenAI `o1/o3` 做 thinking/reasoning 参数映射，漏掉默认 `openai/gpt-5-mini` 这类 GPT-5 reasoning 模型。
  3. [`chat-display`](../apps/negentropy-ui/utils/chat-display.ts) 把 reasoning 节点的 `summary` fallback 成 `content`，导致「阶段完成」这类生命周期摘要被误当作推理正文渲染。
  4. [`conversation-tree`](../apps/negentropy-ui/utils/conversation-tree.ts) 遇到 `ne.a2ui.thought` 早于 reasoning 节点创建时会直接丢弃真实 thought 文本。
- **处理方式**：
  1. Composer 输入区底部新增二态 `Thinking` switch，按 session localStorage 持久化；发送时透传 `forwardedProps.thinking_enabled`，Next AG-UI route 写入 `state_delta.thinking_enabled`。
  2. Root/SubAgent 动态 LiteLLM 在单轮请求中读取 ContextVar，并通过 `apply_llm_thinking_override()` 按模型能力覆盖参数：Claude 写 `thinking`，OpenAI GPT-5/o 系列写 `reasoning_effort`，其它模型保持 kwargs 原样。
  3. 移除 `summary -> content` fallback；`ne.a2ui.thought` / 携带文本的 `ne.a2ui.reasoning` 若早于 reasoning 节点到达，先进入 pending buffer，节点创建后再合并进 `payload.content`。
  4. 增加前后端单测覆盖 Thinking toggle、state_delta 透传、GPT-5 reasoning 参数映射、真实 thought 透传与阶段伪内容不渲染。
- **后续防范**：
  1. UI 只展示真实可观测推理文本或结构化 result，严禁把 lifecycle summary 当作推理正文；
  2. 新增模型族时必须同步维护 Thinking 能力映射，并用单测锁定「支持时注入 / 不支持时不注入」；
  3. CUSTOM 事件如果承载业务语义，必须具备「早到缓冲」策略，避免同 timestamp 排序或流式抖动造成信息丢失。

---

## ISSUE-076 pnpm v11 升级后 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS` + `package.json#pnpm.overrides` 静默失效（2026-05-08）

- **表因**：开发者在 `apps/negentropy-ui` / `apps/negentropy-wiki` 执行 `pnpm install` 时报错 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.12, sharp@0.34.5, unrs-resolver@1.11.1`，CLI 提示 `Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.`，原生依赖的 postinstall 全部被拦截。
- **根因**：当前环境 pnpm 版本升至 `v11.0.8`，相较 v10 引入两项破坏性变更<sup>[[1]](#ref1-pnpm-v11)</sup>：
  1. `strictDepBuilds` 默认变为 `true`，且废弃 `onlyBuiltDependencies` / `neverBuiltDependencies` / `ignoredBuiltDependencies` / `ignoreDepScripts`，统一收敛为 `allowBuilds: { <pkg>: true|false }` map；
  2. **`package.json` 中的 `pnpm` 字段不再被读取**，所有 pnpm 配置（包括 `overrides`）必须迁移到 `pnpm-workspace.yaml`。
  仓库现有 `apps/negentropy-ui/package.json#pnpm.overrides`（含 `@ag-ui/client`、`uuid`、`postcss` 等 10 项 CVE / 兼容性修订）与 `apps/negentropy-wiki/package.json#pnpm.overrides`（`postcss>=8.5.10`）均位于已被废弃的位置；`negentropy-wiki/pnpm-workspace.yaml` 虽已声明 `allowBuilds`，但缺 `esbuild` 一项。
- **处理方式**：
  1. 在 `apps/negentropy-ui/pnpm-workspace.yaml`（新建）与 `apps/negentropy-wiki/pnpm-workspace.yaml`（补齐）中显式声明 `allowBuilds: { esbuild: true, sharp: true, unrs-resolver: true }`；
  2. 同步把两份 `package.json#pnpm.overrides` **完整迁移**到对应 `pnpm-workspace.yaml`（`negentropy-ui` 含 10 条安全 / 兼容性 override，`negentropy-wiki` 含 1 条 postcss override），随后删除 `package.json#pnpm` 字段；
  3. 还原迁移过程中产生的 `pnpm-lock.yaml` 副作用（曾因 overrides 失效短暂回退到 `@ag-ui/client@0.0.42` / `uuid@11.1.1` / `postcss@8.4.31`），通过 `git checkout` lockfile + 重新 `pnpm install` 验证 lockfile 零 diff、二次执行幂等返回 `Already up to date`。
- **后续防范**：
  1. **包管理器主版本升级遵循「同步迁移所有相关字段」纪律**：v11 的迁移不是单点改 `allowBuilds` 即可——必须把 `package.json#pnpm` 下所有子字段（`overrides` / `patchedDependencies` / `peerDependencyRules` / `packageExtensions` 等）一并迁移到 `pnpm-workspace.yaml`，否则会被 v11 静默忽略，破坏面隐性大于报错本身（错误能看见，但 overrides 失效只能在 lockfile diff 中察觉）；
  2. **优先验证 lockfile 是否产生非预期 diff**：每次包管理配置改动后，`git diff pnpm-lock.yaml` 必须复核——如果出现版本回退（例如旧版 `@ag-ui/client@0.0.42`、`uuid@11.1.1`），多半是 overrides 配置失效；
  3. **官方 codemod 可作为兜底**：pnpm 提供 `pnpx codemod run pnpm-v10-to-v11` 自动把 `package.json#pnpm` 迁移到 `pnpm-workspace.yaml`<sup>[[2]](#ref2-pnpm-migration)</sup>；手工迁移时务必逐项核对，不要遗漏 overrides；
  4. **monorepo 多 app 仓库需逐个 app 检查**：本次发现 `negentropy-wiki/pnpm-workspace.yaml` 早期已部分迁移但仍漏 `esbuild` 一项，证明零散的「部分迁移」会沉淀为新熵源——升级类工作应一次性完成全仓核对。
- **同类问题影响**：
  1. 任何依赖 `package.json#pnpm.<field>` 的脚本 / CI 检查 / 安全扫描脚手架在升级到 pnpm v11 之后都需要审视配置位置；
  2. Renovate / Dependabot 升级 pnpm 主版本的 PR 必须额外验证 `pnpm-workspace.yaml` 与 `package.json#pnpm` 的并存与权威性，否则升级后看似成功、实则 overrides 已失效；
  3. CI 中如使用 `pnpm install --frozen-lockfile`，配置失效只会反映在 lockfile 校验通过 / 失败两态——对 lockfile 已被旧版主分支锁定的场景（开发者本地侥幸通过、CI 重生成 lock 反而触发 diff），症状会延后暴露；
  4. CHANGELOG 应追加「依赖管理：迁移 pnpm 配置至 v11 规范」条目，与 [`apps/negentropy-ui/CHANGELOG.md`](../apps/negentropy-ui/CHANGELOG.md) / [`apps/negentropy-wiki/CHANGELOG.md`](../apps/negentropy-wiki/CHANGELOG.md) 现行结构对齐。

<a id="ref1-pnpm-v11"></a>[1] pnpm contributors, "pnpm 11.0," _pnpm Blog_, 2026. [Online]. Available: https://pnpm.io/blog/releases/11.0

<a id="ref2-pnpm-migration"></a>[2] pnpm contributors, "Migrating from v10 to v11," _pnpm Documentation_, 2026. [Online]. Available: https://pnpm.io/migration

---

## ISSUE-077 KG 构建 UI 卡死 5 分钟、后端日志 3 分钟无输出 + 全局连接池泄漏排查（2026-05-09）

- **表因**：用户在 `/knowledge/graph` 页对 `Harness Engineering`（chunk_count=849）点击「构建图谱」，UI 仅静态展示「正在构建...」，期间后端日志连续 3 分钟无任何输出，第 5 分钟前端报 `Upstream connection failed: TypeError: fetch failed`。后端日志同时伴随大量 `AsyncAdaptedQueuePool: garbage collector is trying to clean up non-checked-in connection` 警告。
- **根因**：
  1. **致命：连接池泄漏**。[`AgeGraphRepository._get_session`](../apps/negentropy/src/negentropy/knowledge/graph/repository.py) 在 `async with AsyncSessionLocal() as session: return session` 块内 return —— `async with` 立即退出，但 session 引用被外泄给调用方 `await session.execute()/commit()`，底层连接未归还。849 chunk × 多关系 ≈ 数千次泄漏后连接池耗尽，`update_build_run` / pagerank / community_detection / community_summary 等需要新连接的步骤全部 hang，构成「3 分钟无日志」。
  2. **进度反馈缺失**。[`graph/service.py`](../apps/negentropy/src/negentropy/knowledge/graph/service.py) 的 chunk 循环仅每批 batch（10 chunk × 3 并发，单批 30-60s）结束才上报 `progress_percent`；五个后置阶段（temporal/sync/pagerank/communities/summary）只有「完成」日志、没有「开始」日志；`update_build_run` 失败被 `except: pass` 静默吞掉。
  3. **前端阻塞 + 无 SSE 消费**。[`/knowledge/graph` page.tsx](../apps/negentropy-ui/app/knowledge/graph/page.tsx) 的 `buildKnowledgeGraph` 是阻塞式 POST；BFF 代理 [`_proxy.ts`](../apps/negentropy-ui/app/api/knowledge/_proxy.ts) 的 fetch 没有 `AbortController`/timeout，依赖 socket idle 超时；UI 只展示静态文案。后端虽然已有 [`/build-runs/latest/progress/stream`](../apps/negentropy/src/negentropy/knowledge/api.py) SSE 端点 + [`KgBuildProgressPill`](../apps/negentropy-ui/components/ui/KgBuildProgressPill.tsx) 组件，但 `/knowledge/graph` 页面未挂载，资产闲置。
  4. **LLM 无显式超时**。[`graph/extractors.py`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) 中 `litellm.acompletion` 未传 `timeout`，单 chunk vendor hang 会拖死整个 `asyncio.gather`。
- **处理方式**：
  1. **修连接泄漏（P0 必修）**：把 `_get_session()` 改为 `@asynccontextmanager async def _session_scope()`；注入分支不接管生命周期、自建分支由 `async with AsyncSessionLocal()` 保证退出时归还连接。约 30 个调用点改造为 `async with self._session_scope() as session: ...`。
  2. **阶段化进度埋点（P0）**：service.py 新增 `emit_phase` 内联辅助 + 5 个后置阶段开始处的 `emit_phase` 调用（resolving/syncing/pagerank/communities/summaries）+ chunk 节流上报（每 5 chunk 或 ≥10s 取后到者，asyncio.Lock 保护）；`except: pass` 改为 `logger.warning("update_build_run_failed", ...)`；阶段元数据用 warnings JSONB 中的 `_phase` sentinel（与已有 `_metrics` 同型条目模式），**无需 alembic 迁移**。
  3. **LLM 双重超时（P0）**：`process_chunk` 用 `asyncio.wait_for(..., timeout=60)` 包裹 entity / relation extractor.extract；同时给 `LLMEntityExtractor` / `LLMRelationExtractor` 增加 `llm_timeout: float = 60.0` 参数并在 `litellm.acompletion(timeout=...)` 显式传入。
  4. **前端复用已有资产（P1）**：`/knowledge/graph` page.tsx 挂载 `<KgBuildProgressPill corpusId enqueued={building} />` 替代静态「正在构建...」；`KgBuildProgressPill` 扩展 `phase?` 字段 + `PHASE_LABEL` 中文映射（实体抽取中 / 实体消解中 / 一等公民同步中 / PageRank 计算中 / 社区检测中 / 社区摘要生成中）；SSE 端点 payload 增加 `phase` / `phase_detail` 字段，从 warnings 末尾解出最新 `_phase`。
  5. **BFF 显式超时（P1）**：[`_proxy.ts`](../apps/negentropy-ui/app/api/knowledge/_proxy.ts) 所有 `fetch` 增加 `signal: AbortSignal.timeout(timeoutMs)`；新增 `DEFAULT_PROXY_TIMEOUT_MS=30s` 与 `LONG_TASK_PROXY_TIMEOUT_MS=15min` 常量；KG `/graph/build` 路由调用方传长任务超时；`AbortError` 归类为 504 `KNOWLEDGE_UPSTREAM_TIMEOUT`，与 502 `KNOWLEDGE_UPSTREAM_ERROR` 区分。
  6. **顺手修性能次优（P2）**：[`engine/adapters/postgres/association_service.py`](../apps/negentropy/src/negentropy/engine/adapters/postgres/association_service.py) 中 `expand_multi_hop` / `expand_via_ppr` 把 `async with AsyncSessionLocal()` 提到外层循环之外（整段 BFS 共享同一只读 session）；后者额外加 `depth ≤ 5` 上限校验防御组合爆炸。
  7. **回归测试**：新增 `TestSessionScope::test_self_owned_session_returns_connection`（验证 N 次 enter/exit 配对）/ `_lifecycle_not_hijacked`（注入分支不被接管）/ `_releases_on_exception`（异常路径仍归还）；新增 `test_build_graph_emits_phase_milestones_in_order` / `_progress_percent_monotonically_increases` / `_strips_phase_entries_from_terminal_warnings` 三项 service 阶段化进度测试。
- **后续防范**：
  1. **anti-pattern：`async with AsyncSessionLocal() as s: return s` 永远不要写**。session 引用一旦越过 `async with` 边界，连接就泄漏；该模式应通过 PR review checklist + 后续可加自定义 ruff 规则拦截。受影响代码必须改为 `@asynccontextmanager` 工厂或让调用方显式 `async with`。
  2. **长任务必须配套进度反馈通道**：超过 30s 的服务端流程必须输出阶段化里程碑日志（不只是「完成」日志，「开始」日志同样关键）+ progress_percent 持续刷新 + SSE / 轮询接口暴露给前端。
  3. **`except: pass` 静默吞错的成本远高于 `logger.warning`**：本次正是因为 `update_build_run` 失败被吞，连接池耗尽症状被掩盖；今后所有 catch-all 必须打 warning。
  4. **vendor 调用必须显式 `timeout`**：litellm / httpx / boto3 等 client 默认无 client-level 超时，单次 hang 可拖死整个并发；新增 vendor 调用时必须显式传超时。
  5. **BFF 长连接 fetch 必须显式 `AbortSignal.timeout`**：Node fetch 默认依赖 OS TCP keepalive（数分钟），长任务用户体感「凭空 fetch failed」。区分 504 vs 502 让前端能精确地处理超时。
- **同类问题影响**：
  1. **全局连接管理排查结论**：已对 42 个使用 `AsyncSessionLocal()` 的文件完成 anti-pattern 排查，仅 `graph/repository.py` 一处真正的连接池泄漏；`engine/adapters/postgres/association_service.py` 两处「循环内反复建连」属性能次优（连接归还正确）已顺手优化；`core_block_service.py` 重试模式（最多 2 次循环）合规无需修改；其余 38 个文件包括 `knowledge/retrieval/repository.py`（`_session_factory()` 模式：返回 sessionmaker，调用方 `async with self._get_session_factory()() as db:`）全部合规。
  2. KG 构建之外的长任务（如 paper ingestion、内化 reflection）若已有进度上报但前端未消费 SSE，可参考本次「复用 KgBuildProgressPill + 阶段化 emit_phase」模式补齐。
  3. 其它通过 BFF 转发的长流程接口（如 import / export 等）也应统一接入 `LONG_TASK_PROXY_TIMEOUT_MS`，避免相似的 5 分钟 fetch failed 误导性错误。
- **评审补充修复（2026-05-09 第二轮）**：
  1. **失败终态 warnings 落库对称化**：原修复仅在成功分支通过 `_strip_phase_entries(build_warnings) + [{"_metrics": ...}]` 落 warnings，失败分支调用 `update_build_run` 未传 `warnings`，因 SQL `COALESCE(CAST(:warnings AS jsonb), warnings)` 会原样保留上一次 `emit_phase` 写入的 `_phase` 运行期标记，且丢失任何已累积的算法 warning。修复：把 `build_warnings` / `build_metrics` 提升到 try 之外初始化（防 UnboundLocalError），失败分支同样传入剥离 `_phase` 后的 warnings + 可选 `_metrics`（若已构造）。新增单测 `test_build_graph_failure_strips_phase_and_persists_warnings_on_early_exception` / `test_build_graph_failure_preserves_algorithm_warnings`。
  2. **Pill 挂载与 POST 在飞状态解耦**：原修复 `{building && corpusId && <KgBuildProgressPill .../>}` 将 Pill 挂载强绑定到 `building`，而 `handleBuild` 在 `finally` 里 `setBuilding(false)`——POST 因 BFF 15min 超时 abort 时 Pill 立即卸载、SSE 关闭，注释承诺的「SSE 仍会推送终态」实际无法被前端接收。修复：新增 `pillEnqueued` 状态（独立于 `building`）+ `pillSession` key，`KgBuildProgressPill` 新增 `onTerminal?(event)` 回调（延迟 `TERMINAL_DISPLAY_HOLD_MS = 4s` 触发，留终态展示窗口）；父组件在回调里 `setPillEnqueued(false)`，让 SSE 终态自驱卸载。新增 Pill 单测 `SSE 终态后通过 onTerminal 通知父组件` / `终态延迟回调中卸载组件不会泄漏 timer`。

---

## ISSUE-078 Langfuse Model Costs 视图把同一模型分裂成 3 行统计（2026-05-09）

- **表因**：Langfuse Dashboard 「Model costs」面板显示同一个 `gpt-5-mini` 被拆成三条独立行：`openai/gpt-5-mini`（76.02K tokens）/ `gpt-5-mini`（68.22K）/ `gpt-5-mini-2025-08-07`（6K），无法准确按模型聚合统计成本与用量。
- **根因**：
  1. **观测口径无归一化**。[`apps/negentropy/src/negentropy/model_names.py`](../apps/negentropy/src/negentropy/model_names.py) 的 `canonicalize_model_name()` 当前是「只 strip 空白」的近 no-op，未剥 `vendor/` 前缀、未剥日期/版本后缀、无别名映射。
  2. **三种写法源头不同**：(a) 默认 LLM `openai/gpt-5-mini` 由 [`config/model_resolver.py:32`](../apps/negentropy/src/negentropy/config/model_resolver.py) 定义，带 vendor 前缀；(b) KG 模块 `community_summarizer.py:275` / `extractors.py` / `global_search.py` 硬编码裸名 `gpt-4o-mini`；(c) OpenAI 服务端响应里 `response.model` 含具体版本日期 `gpt-5-mini-2025-08-07`，被 LiteLLM OTel callback 透传到 `gen_ai.response.model`。
  3. **Langfuse OTel 字段优先级**：`ai.response.model` > `gen_ai.response.model` > `gen_ai.request.model`；三键任一未归一化，Langfuse 都会按原值聚合到独立 cost 行。
  4. **设计耦合误区**：`canonicalize_model_name()` 不仅在观测链路被调用，还被 LiteLLM 调度链路使用（`build_full_model_name()`、`community_summarizer.py:74` 把 canonicalize 后的字符串存为 `self._model` 直接传给 `litellm.acompletion`）。如果让它剥 vendor 前缀，会破坏 LiteLLM 的供应商路由 —— 必须**正交分解**调度归一化与观测归一化。
- **处理方式**：
  1. **正交分解（P0）**：[`model_names.py`](../apps/negentropy/src/negentropy/model_names.py) 保留 `canonicalize_model_name()` / `pricing_lookup_model_name()` 现有契约不动；新增 `observability_model_name()`（裸名 + 剥日期 + 别名）与 `extract_vendor()`（vendor 单一事实源），**仅供 [`instrumentation.py`](../apps/negentropy/src/negentropy/instrumentation.py) 使用**。
  2. **`observability_model_name()` 算法**：四步幂等管线 = strip → 剥 `_VENDOR_PREFIXES`（外层一次，大小写不敏感，含 `openai/anthropic/gemini/vertex_ai/mistral/cohere/groq/deepseek/meta/ollama/azure/bedrock/together_ai/replicate/`）→ 剥日期后缀（白名单正则 `-\d{4}-\d{2}-\d{2}$` / `-\d{8}$`，避免误伤 `gpt-4o-mini` / `text-embedding-3-large`）→ 别名映射兜底（起步空表）。
  3. **`extract_vendor()` 算法**：原串带 `vendor/` 前缀优先；落空再用 `_VENDOR_FAMILY_PREFIXES` 按系族识别（`gpt-/o1-/o3-/o4-/chatgpt-/text-embedding- → openai`、`claude- → anthropic`、`gemini- → gemini`、`llama- → meta` 等）；全部落空返回 `None`，`gen_ai.system` 不写以避免污染未知值。
  4. **OTel 强制注入**：`instrumentation.py:_patched_set_attributes` 去掉 `if normalized != raw` 条件分支（同 key set_attribute 是覆盖语义），**无条件 override** `gen_ai.request.model` / `gen_ai.response.model` / `gen_ai.system` 为归一化后的裸名，并新增 `langfuse.observation.model.name`（Langfuse 私有强制覆盖键，胜过 `ai.response.model`）+ `gen_ai.original_model`（保留诊断字符串供 trace 详情排查具体版本）。
  5. **删除并行 vendor 表**：原 `instrumentation.py:29-67` 的 `_GENAI_SYSTEM_PREFIX_MAP` 与 `_detect_genai_system()` 整体删除，调用方改走 `extract_vendor()`，消除「两个并行前缀表」的 SoT 风险。
  6. **测试覆盖**：[`test_model_names.py`](../apps/negentropy/tests/unit_tests/config/test_model_names.py) 现有 7 测试全部保留并通过；新增 13 个测试覆盖前缀剥离 / 后缀剥离 / 联动场景 / 不误伤 / 幂等性 / 大小写不敏感 / 双层前缀 / vendor 提取与系族识别。[`test_instrumentation.py`](../apps/negentropy/tests/unit_tests/observability/test_instrumentation.py) 调整原 2 个断言为裸名期望，新增 `test_patch_normalizes_dated_response_model` / `test_patch_emits_vendor_for_bare_model` 两个覆盖。
- **评审补充修复（2026-05-09）**：
  1. **修复孤立测试**：[`test_genai_semconv.py`](../apps/negentropy/tests/unit_tests/engine/test_genai_semconv.py) 历史依赖 `instrumentation._detect_genai_system`，本 PR 已删除该函数，导致 `test_detect_genai_system_*` 收集阶段抛 `ImportError`。修复：测试改导 `negentropy.model_names.extract_vendor` 并重命名为 `test_extract_vendor_known_prefixes` / `test_extract_vendor_unknown_returns_none`，14 + 4 共 18 个参数化样本全部沿用，断言不变。
  2. **保留服务端实际版本诊断**：原实现仅写 `gen_ai.original_model = str(kwargs["model"])`（如 `openai/gpt-5-mini`），但服务端实际响应的具体版本（如 `gpt-5-mini-2025-08-07`）来自 `response_obj.model`，归一化后从 `gen_ai.response.model` 丢失。新增 `gen_ai.original_response_model`：仅当 `response_model` 与 `model` 不同（即归一化丢了信息）时上报，避免冗余。`test_patch_litellm_otel_cost_injects_cost_attributes` 补 `not in attributes` 断言，`test_patch_normalizes_dated_response_model` / `test_patch_emits_vendor_for_bare_model` 补 dated 期望。
- **后续防范**：
  1. **调度归一化与观测归一化必须正交**。任何「全局规范化」函数加新规则前先问：调用方是否横跨调度（LiteLLM `acompletion`、`build_full_model_name`、定价查表）与观测（OTel 上报、日志、监控）？若是，**必须**拆成两个函数 —— 一套契约不可同时承载两种用途。
  2. **OTel 同 key set_attribute 是覆盖语义**：写归一化值时不要先用 `if normalized != raw` 守卫，否则 alias map 之类的「等价不同名」映射会被跳过。
  3. **Langfuse 私有命名空间 `langfuse.observation.*` 是强制覆盖键**：当上游（如 Vercel AI SDK / LiteLLM）已经写了 `ai.response.model` / `gen_ai.response.model` 时，`langfuse.observation.model.name` 是收敛 Model Costs 视图到统一行的最后保险。
  4. **保留诊断信息**：归一化丢失版本号会让线上排查「实际调用的是哪个具体版本」变难，必须用 `gen_ai.original_model` 等额外字段保留原始字符串。
- **同类问题影响**：
  1. **Reranker 路径目前未启用，但已存在绕开 LiteLLM 的实现**。[`knowledge/retrieval/reranking.py`](../apps/negentropy/src/negentropy/knowledge/retrieval/reranking.py) 的 `LocalReranker`（`sentence_transformers.CrossEncoder.predict`）与 `APIReranker`（`httpx.AsyncClient.post` 直连 Cohere `https://api.cohere.ai/v1/rerank`）当前在 `KnowledgeService` 三个实例化点（`agents/tools/paper.py:68` / `perception.py:119` / `knowledge/api.py:226`）都未传 `reranker=`，默认 `NoopReranker()`，无实际模型调用。**未来一旦启用**，必须同步注入 OTel（`gen_ai.system` / `gen_ai.request.model` / `gen_ai.usage.*` 等）或切换到 `litellm.arerank()`（LiteLLM 1.83+ 已支持 Cohere/Voyage/Jina），否则会再次产生「未上报的模型调用」。
  2. **KG 模块硬编码 `gpt-4o-mini` 兜底与默认 LLM 不一致**（`extractors.py:124,482,862` / `community_summarizer.py:275` / `global_search.py:389`）。归一化方案兼容裸名，本次不修；后续应作为独立 PR 把兜底改为读 `get_fallback_llm_config()`，与 `openai/gpt-5-mini` 默认对齐。
  3. **Langfuse 历史已入库的旧分裂数据无法追溯改写**，新数据起聚合到统一行；用户在 Langfuse UI 可用过滤器并列对比新旧口径。
- **决策依据（IEEE 风格）**：
  - <a id="ref78-1"></a>[1] OpenTelemetry Authors, *Semantic Conventions for Generative AI*, v1.28+, "gen_ai.system / gen_ai.request.model / gen_ai.response.model," 2025. [Online]. Available: https://opentelemetry.io/docs/specs/semconv/gen-ai/
  - <a id="ref78-2"></a>[2] Langfuse, *OpenTelemetry Integration — Attribute Mapping*, "Model attribute precedence: ai.response.model > gen_ai.response.model > gen_ai.request.model; langfuse.observation.* override namespace," 2026. [Online]. Available: https://langfuse.com/integrations/native/opentelemetry
  - <a id="ref78-3"></a>[3] LiteLLM, *Langfuse OTEL Integration*, "litellm.success_callback = ['otel'] forwards via OTLP," 2026. [Online]. Available: https://docs.litellm.ai/docs/observability/langfuse_otel_integration
- **决策反转补丁（2026-05-21）**：
  1. **现象**：上述方案落地后，Langfuse Model Costs 视图仍同时出现 `gpt-5-mini`（裸名）与 `openai/gpt-5-mini`（带前缀）两行；`gpt-5-nano` 也以裸名独立成行。即 monkey-patch 之外仍有路径绕过归一化（或被 LiteLLM 原始 OTel callback 先行写入了带前缀的 `gen_ai.request.model`）。
  2. **新口径**：把观测路径输出形态由「裸名」**反转为 `vendor/model` 全名**（`openai/gpt-5-mini`、`anthropic/claude-3-5-sonnet`、`gemini/text-embedding-004` …）。核心论据：LiteLLM 调度路径必须收到 `vendor/` 前缀才能选择真实 API，因此带前缀的形态本就是系统中**唯一已知的全局权威形态**；把所有观测点都收敛到这个形态，比与 LiteLLM 原始 callback 在裸名形态上竞速覆盖更稳健。日期/版本后缀仍剥（`gpt-5-mini-2025-08-07` → `openai/gpt-5-mini`）。
  3. **算法变更**：`observability_model_name(name, *, vendor_hint=None)` 改为「拆 vendor + 裸名 → 剥日期 → 别名 → 拼回 vendor/bare」。`vendor_hint` 解决跨字段一致性：当 request `gemini/text-embedding-004` 与 response 裸名 `text-embedding-004` 共存时，把 request 侧 vendor 注入 response 归一化，避免家族前缀表把 `text-embedding-` 误识别成 `openai`。提取内部小工具 `_split_vendor_and_bare()` 统一拆分逻辑。
  4. **定价路径解耦**：`instrumentation._resolve_total_cost` 显式切到 `pricing_lookup_model_name(...)`（裸名查表），不再借观测函数；阅读时一眼能看出「定价 vs 观测」走两套不同的契约。
  5. **测试反转**：`test_model_names.py` / `test_instrumentation.py` / `test_genai_semconv.py` 中所有 `observability_model_name` / `gen_ai.{request,response}.model` / `langfuse.observation.model.name` 断言由裸名反转为 `vendor/model`；新增 `vendor_hint` 用例 + 「请求带前缀、响应裸名」跨字段一致性用例。
  6. **教训沉淀**：「把所有形态收敛到裸名」与「把所有形态收敛到 vendor/model」都满足 Single Source of Truth；选哪个要看**系统内已有的权威形态是什么**。在 LiteLLM 体系下，`vendor/model` 才是调度路径的硬约束，反向（剥前缀）需要主动改写多入口，更脆弱。

---

## ISSUE-066 Home Chat 新建 Session 后对话被路由到旧 Session（2026-05-10）

- **表因**：用户在 Home Chat 已有 Session A 时点 sidebar `+ New` 创建 Session B，随即在 B 输入框 Send，消息却出现在旧 Session A。evaluate_script 同步模拟复现：Round 2 从 +New 点击到 Send 仅 8ms，三方（querySessionId、bodyThreadId、locationSearch）全部 stale 为旧 A。后端交叉验证确认：RCA-PROBE-2 应在 session `3ba0c550` 但被持久化到了 `30846c12`。详见 [baseline trace](../.context/issue-rca-home-session-routing/01-baseline-trace.json) 与 [RCA 文档](../.context/issue-rca-home-session-routing/02-rca.md)。
- **根因**：Next.js 16 App Router 的 `useSearchParams()` + `router.replace()` 构成的 sessionId 更新链路存在不可消除的异步延迟。`sendInput`（`home-body.tsx:672`）是普通 async 函数表达式，每次 render 重建闭包。当 +New 后极短时间内（实测 3-11ms）触发 Send，闭包中的 `sessionId` 和 `agent` 均为 stale 值——因为 `router.replace` 尚未 flush，React 尚未 re-render，`useMemo` 依赖 `[sessionId, user]` 的 agent 未重建。
  ```mermaid
  sequenceDiagram
      participant U as 用户
      participant SL as SessionList (+New)
      participant SUS as useSessionListService
      participant P as page.tsx (sessionId / agent)
      participant HB as home-body.tsx (sendInput)
      participant BFF as /api/agui/route.ts
      Note over U,BFF: 8ms race window
      U->>SL: 点击 +New
      SL->>SUS: onNewSession()
      SUS->>SUS: POST /api/agui/sessions → B
      SUS->>P: setSessionId(B) → router.replace("?sessionId=B")
      Note over P: router.replace 异步！React 未 flush
      U->>HB: 立即 Send（8ms 内）
      Note over HB: 闭包中 sessionId=旧A, agent.threadId=旧A
      HB->>BFF: POST /api/agui?session_id=A（错误路由）
  ```
- **处理方式**：在 `sendInput` 入口添加三重同步守卫（[home-body.tsx:720](../apps/negentropy-ui/app/home-body.tsx)），不撒网、不改 sessionId 路由架构：
  1. `!agent` — agent 未就绪（原有逻辑）
  2. `switchingSessionRef.current` — +New 后同步置 true 的 ref 信号，在 agent 重建后由 auto-send useEffect 清除
  3. `agent.threadId != null && agent.threadId !== sessionId` — agent 实例与当前 sessionId 不一致（兜底检测）
  - 守卫命中时走 pending 路径：消息缓存到 `pendingSendRef`，由 auto-send useEffect 在 agent 重建后自动发送到正确 session
  - `startNewSessionWithLlmTarget` 在拿到新 session ID 后回填 `pendingForSessionRef.current = newId`
- **验证证据**：
  - 反向回滚单测：[`stale-agent-guard.test.tsx`](../tests/unit/features/session/stale-agent-guard.test.tsx) — 删除 guard → 1 failed，保留 → 637 passed
  - 浏览器实机 4 轮验证（dev server localhost:3192）：全部消息正确路由到新 session（qs === btid === newSessionId）
  - 守卫命中确认：Round 1 出现 toast "Agent 正在初始化，已排队待发送..."，doSend 从 auto-send useEffect (L781) 调用
- **后续防范**：
  1. `home-body.tsx:721` 的 `console.warn("[ISSUE-NEW] stale-agent guard")` 保留作为长期反馈信号
  2. BFF mismatch warn（`route.ts` sessionId/threadId 不一致时 warn）作为后端兜底监控
  3. **已知限制**：session 切换（点击已有 session）存在同类 race condition 但不在本次修复范围——sidebar 切换的 `setSessionId` 路径未经过 `switchingSessionRef`，需独立处理
  4. **production standalone build 的 `router.replace` 失效**是预存基础设施问题，与本次修复无关
- **同类问题影响**：ISSUE-059 / 061 / 063 / 064 均涉及前端状态机竞速。本 ISSUE 的 "ref 同步信号 + pending 自动重发" 模式可作为同类 race condition 修复的通用范式。

---

## ISSUE-079 KG Build Pill SSE→HTTP 轮询改造丢失发现期 grace + run_id 切换死循环（2026-05-11）

- **表因**：评审 commit `bda0b75e`（KG Build Progress SSE → HTTP Polling）发现两个等价回归：
  1. `ingest_paper` 返回 `kg_enqueued` 后，Pill 立刻挂载轮询新端点 `/build-runs/latest`，前端 `seenRunId` 锁到该 corpus 上一条 completed/failed 历史 run，触发 4s 后 onTerminal 卸载，**新 run 永不被跟踪**；
  2. `KgBuildProgressPill.tsx` 的 run_id 切换分支：`seenRunId` 已锁到 A、下次 poll 拿到不同 run_id=B 且 B 已是终态时，代码 `setTimeout(poll, delay); return;` 既不更新 `seenRunId` 也不调用 `stop`，**死循环停在 pending 直到组件卸载**。
- **根因**：
  1. 新 REST 端点 `get_latest_kg_build_run` 一律 `only_active=False`，丢失了 SSE 端点 `stream_latest_kg_build_progress` 在 [`api.py:3593`](../apps/negentropy/src/negentropy/knowledge/api.py) 显式实现的“发现期 grace”—— `only_active=run_id_seen is None` + 10s 等待窗。`enqueue_kg_build` 用 `asyncio.create_task` fire-and-forget，`ingest_paper` 返回时 `_run_kg_build_background` 尚未走到 `create_build_run`；此时 `only_active=False` 拿到的是该 corpus 历史最后一条终态 run。
  2. 客户端 run_id 切换分支注释“新 run 终态说明还没开始”与“终态=已结束”语义相反；该分支仅在“老锁定 + 新 run_id 已终态”时触发，逻辑上应当 `stop(payload)` 收口或刷新 `seenRunId` 让外层 `isTerminal` 收口，二者皆未发生。
- **处理方式**：
  1. **后端**：`get_latest_kg_build_run` 接受 `only_active: bool = Query(default=False)`；`only_active=True` 且 `record is None` 时返回 `{"status": "pending"}` 而非 `idle`，与 SSE 行为对齐。
  2. **客户端**：`KgBuildProgressPill` 增加 `DISCOVERY_GRACE_MS = 10_000` + `buildUrl()`，在 `seenRunId === null && Date.now() - mountedAt < DISCOVERY_GRACE_MS` 时附加 `?only_active=true`；run_id 一致性处理简化为“拿到 run_id 就更新 `seenRunId` 让外层 `isTerminal` 收口”，消除自旋分支。
  3. **测试**：补四条回归用例 — 发现期首轮带 `only_active=true` / 锁定后切到不带 / 超 grace 后切到不带 / 已锁定 run_id 收到新 run_id 终态正确收口。
- **后续防范**：
  1. 通信介质从 SSE 切换到 HTTP 轮询时，**必须**逐项审视原 SSE 在长连接内实现的状态机（发现期、run_id 锁、grace、idle 判定），不能假设“后端返回最新行”就语义等价；
  2. 凡“先 ack 入队、后写 DB 行”的 fire-and-forget 设计，前端轮询端点必须显式区分“尚未落库（pending）”与“无任何 run（idle）”两种语义，不可合并；
  3. 任何”拿到新 run_id 但状态异常”的客户端分支，结尾必须显式更新 lock 或调用 stop，不允许”仅 setTimeout 后 return”的自旋。
- **同类问题影响**：项目内其他从 SSE 退化为轮询的进度上报场景（Pipeline RUNNING 看门狗、Job watcher 等）需用同一清单复核；新增「fire-and-forget + 进度查询」端点时，应将 `only_active` 类参数作为契约一部分而非可选优化。

---

## ISSUE-080 KG Build Run 取消信号被状态机回写覆盖，UI 永卡 CANCELLING（2026-05-11）

- **表因**：`Knowledge → Pipelines` 点击取消 KG Build Run 后，Run 始终停留在 `CANCELLING` 状态，永不收敛到 `CANCELED`；后端处理是否真正中断也不可见。用户截图两条 runs 分别卡在 CANCELLING 2m42s 与 38m05s，远超已有 5-min watchdog 阈值，证明既非偶发也非”等一会就好”。
- **根因**：5 处 bug 共谋形成”取消信号被自家进度上报反复回写”的竞态环：
  1. **`update_build_run` SQL 无状态机守卫**（[`graph/repository.py`](../apps/negentropy/src/negentropy/knowledge/graph/repository.py)）：原 SQL `SET status = :status, completed_at = CASE WHEN :status IN (终态) THEN NOW() END WHERE id = :run_id`——`CASE` 无 `ELSE`，非终态写入直接把 `completed_at` 清零；且 `status` 无条件覆盖。取消 API 写入 `status='cancelling', completed_at=NOW()` 后，build task 下一次 `maybe_report_chunk_progress`（每 5 chunks / 10s）调用 `update_build_run(status='running', ...)` 直接把 `cancelling` 回滚为 `running`，watchdog 的 `WHERE status='cancelling'` 永远命中不到。
  2. **`asyncio.gather(return_exceptions=True)` 吞 `PipelineCancelled`**（[`graph/service.py`](../apps/negentropy/src/negentropy/knowledge/graph/service.py)）：`PipelineCancelled` 继承 `Exception`（刻意避开 `BaseException`），被打包进 results 后按”chunk 失败”计入 `failed_chunk_count` 静默吞没，批处理循环继续遍历剩余所有 batches。
  3. **`maybe_report_chunk_progress` 缺 cancel 守卫 + batches 之间缺 `is_cancelled` 检查**：与 Bug 1 联动，每 5 chunks/10s 就把 `cancelling` 改回 `running`。
  4. **`process_chunk` 内 `except (TimeoutError, Exception)` 误吞并重试 cancel**：浪费 1 次 LLM 调用窗口（最多 2 × 60s）。
  5. **Watchdog 间隔 300s + 阈值 5min（且重复注册）**：即便其他 bug 不存在，最坏兜底仍需 10 分钟；修复 Bug 1 后此处可缩紧。
- **处理方式**（5 项正交修复，主修 + 顺手清理）：
  1. **SQL 状态机守卫**：`update_build_run` SQL 加 `WHERE` 守卫——终态写入永远允许；非终态写入要求 `DB.status NOT IN (terminal, 'cancelling')`。`completed_at` CASE 加 `ELSE completed_at` 保留旧值。零行 UPDATE 走 `debug` 日志 `build_run_update_skipped_by_state_guard` 留观测线索。
  2. **批次循环显式 re-raise PipelineCancelled**：`gather` 返回后**第一遍**遍历 results 仅识别 `PipelineCancelled` 并 re-raise，**第二遍**才走 `failed_chunk_count` 路径；批次入口加 `if is_cancelled(run_id): raise PipelineCancelled(...)` 早退。
  3. **`process_chunk` retry 短路**：`except (TimeoutError, Exception) as exc: if isinstance(exc, PipelineCancelled): raise` 优先于 retry 判断。
  4. **`maybe_report_chunk_progress` cancel 守卫**：函数入口 `if is_cancelled(run_id): return`。
  5. **Watchdog 收紧 + 去重**：统一 watchdog `interval_seconds=300→60`，删除重复 `_kg_build_watchdog_tick` 注册；默认 `cancelling_threshold_minutes=5→2`。
- **验证证据**：
  - 单元测试 7 条（`TestUpdateBuildRunStateMachineGuard` ×4 + service 取消传播 ×3）全绿；
  - 相关回归测试 68 条全绿（`test_graph_repository` + `test_graph_service` + `test_pipeline_tracker_cancel` + `test_cancel_api`）。
- **后续防范**：
  1. **状态机迁移合法性**应在 SQL 层显式守护（Kleppmann DDIA §9.4：多写入路径必须通过 SQL 约束序列化迁移合法性，而非寄望每个 call-site 正确判断）；
  2. **协作式取消**检查点必须在所有 hot loop 入口铺设，且 `asyncio.gather(return_exceptions=True)` 后**第一遍**必须扫自定义 cancel 异常；
  3. **任何长任务的进度心跳**必须区分”非终态写入”（保留 `completed_at` 旧值）与”终态写入”（设 `NOW()`），既保留 cancel 时间锚，也让 watchdog 阈值真实反映”最后心跳”而非”启动时间”。
- **同类问题影响**：
  - KB 侧 `KnowledgeRunDao` 已通过条件 UPDATE + OCC 机制规避同型 race；KG 侧本次修复使两侧语义对齐；

---

## ISSUE-081 KG Build Dual-Write 因 SELECT/INSERT 列不一致触发事务级联崩溃（2026-05-12）

- **表因**：单次 KG Build（20 chunks）耗时 18 分钟，317 个实体仅同步 22 个、444 条关系同步 0 条，PageRank / Community / Summary 三个下游阶段全部 `*_skipped_empty_graph`。日志中 ~740 条 `Can't operate on closed transaction` warning 与 1 条 `UniqueViolationError`。
- **根因**（"第一块多米诺骨牌"+ 级联链路）：
  1. **根因**：[`entity_service.sync_entity_from_knowledge`](../apps/negentropy/src/negentropy/knowledge/graph/entity_service.py) 幂等 SELECT 使用 `(canonical_name, entity_type, corpus_id)` 三列匹配，而 UNIQUE 约束 `uq_kg_entity_corpus_name` 仅覆盖 `(corpus_id, canonical_name)` 两列。当同一 canonical_name（如 `claude.ai`）以不同 `entity_type` (`product` → `organization`) 先后出现，SELECT 查不到已有记录 → INSERT 触发 `UniqueViolationError` → SAVEPOINT 缺失 + `shared_session.begin()` 包裹整个 batch_sync → session 进入 closed-transaction 状态 → 后续 295 个实体 + 全部 444 条关系全部 "closed transaction" 级联失败。
  2. **放大器 1（Dual-Write 缺 SAVEPOINT 隔离）**：[`entity_service.batch_sync_from_graph_build`](../apps/negentropy/src/negentropy/knowledge/graph/entity_service.py) 逐条 try/except 但未用 `begin_nested()`，单条 IntegrityError 即崩整体事务。
  3. **放大器 2（LLM 退避策略与 Cloudflare 不匹配）**：[`extractors.py`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) 固定 `asyncio.sleep(1.0)`。Cloudflare 120s Proxy Read Timeout 返回 524，应用层 1s 后立即重试连续撞墙，3 次重试浪费 ~360s。应用层超时设 300s > Cloudflare 120s 进一步保证每次都先被代理斩断。
  4. **放大器 3（实体提取低信噪比）**：LLM 提取了大量泛化术语（"CSS"、"JSON"、"agent"、"spec"、"app"）、日期（"Published Nov 26, 2025"）、URL、文件名（"claude-progress.txt"）、源码引用（"LevelEditor.tsx:892"）作为实体，污染图谱并提高 SAVEPOINT 冲突触发面。
  5. **可见性短板**：18 分钟构建中 chunk 处理无 INFO 级日志，仅 1 次 `chunk_batch_progress` 输出，用户/工程师感知不到正在做什么。
- **处理方式**（7 项正交修复，按依赖关系排序）：
  1. **根因修复（Issue 0）**：`sync_entity_from_knowledge` 的 SELECT 移除 `entity_type` 列条件，与 UNIQUE 约束对齐；命中已有记录时按 type_precedence（person > organization > location > product > event > concept > document > other）更新 `entity_type`。
  2. **SAVEPOINT 防御层（Issue 1）**：`batch_sync_from_graph_build` 中每条 entity/relation 操作包裹在 `async with db.begin_nested()` 中，单条失败仅回滚该 SAVEPOINT。
  3. **下游阶段 Session 状态恢复（Issue 2）**：`_execute_build` 在 PageRank / Community / Summary 三个阶段开始前各加 `if shared_session.in_transaction(): await shared_session.rollback()` 防御。
  4. **LLM 退避策略（Issue 3）**：抽出 `_compute_retry_backoff()` 统一函数 — 检测 524 / timeout 采用递增退避（30s, 60s, 90s, cap 120s + jitter），普通错误指数退避（cap 10s）。`KG_LLM_TIMEOUT_SECONDS` 默认 `300 → 110`（低于 Cloudflare 120s），让应用层先于代理斩断连接。
  5. **实体质量过滤（Issue 4）**：新增 `_GENERIC_ENTITY_STOPWORDS` frozenset + `is_noise_entity()` — 过滤泛化停用词、URL、日期字符串（regex）、文件名（扩展名 regex）、源码引用（`name:digits` regex）、过短（≤ 2）/ 过长（> 150）实体；strategy.py 的 `RegexEntityExtractor._is_valid_name` 复用同一函数。LLM prompt 显式约束"不提取 CSS / HTML / app / UI / 日期 / URL / 文件名"。
  6. **进度可见性（Issue 5）**：chunk_processing 起止日志升至 INFO 含 chunk_index / total_chunks / elapsed_ms / mode（5 种路径区分）；小批次（≤ 50 chunks）进度上报间隔 5s → 2s。
  7. **空社区降级（Issue 6）**：`CommunitySummarizer.summarize_communities` 当 community_entities 为空但实体表非空时，调用 `_load_all_entities()` 加载 Top-200（按 importance_score / confidence / mention_count）实体作为单一全局社区生成 level=0 摘要，确保 GraphRAG Global Search 仍有 query-focused 召回基线。
- **验证证据**：
  - 单元测试：`tests/unit_tests/knowledge/` 669 通过（仅 1 个 pre-existing `test_extraction_llm_plan` 失败与本次改动无关）；
  - 新增 SAVEPOINT 路径 fake session 支持（`conftest.py` 加 `begin_nested()`，`test_graph_entity_service.py` mock 对应行为）；
  - 静态：5 个修改源文件全部通过 `ast.parse` 校验。
- **后续防范**：
  1. **数据库幂等 SELECT 必须与 UNIQUE 约束的列集严格一致**：任何 "存在则更新，否则插入" 的应用层逻辑都要审视 SELECT 谓词列集是否完全等于（或更宽于）UNIQUE 约束列集，否则将产生"应用层未察觉但 DB 唯一约束触发"的悖论。
  2. **batch 处理的事务隔离必须用 SAVEPOINT 而非 try/except**：SQLAlchemy 的 `session.begin()` context manager 一旦内部抛异常进入 rollback 后，整个 session 进入 closed state，后续操作必失败。逐条 try/except 必须配合 `begin_nested()` 才能实现真正的错误隔离（Kleppmann DDIA §7.3 嵌套事务）。
  3. **跨网关的 timeout 设计必须先调研代理层超时**：Cloudflare 默认 100-120s Proxy Read Timeout 是隐式上界，应用层 timeout 必须 < 该值并配合 524 错误的指数退避策略，否则陷入"3 次重试 3 次撞墙"的死循环。
  4. **LLM 提取必须配合显式 stopword 过滤**：单靠 confidence 阈值不足以剔除泛化噪声（LLM 对 "CSS" 也会给 0.9 confidence），需要结合领域停用词 + 正则模式（日期 / URL / 文件名 / 源码引用）双层过滤。
- **同类问题影响**：
  - 任何使用 `db.add() + db.flush()` 风格的批量同步路径都需复核是否套用 `begin_nested()`；
  - 项目内其他依赖 LiteLLM 经 Cloudflare 代理调用的路径（如 embedding / chat completion）若 timeout > 110s 都存在 524 风险；
  - 任何对 `kg_entities` / `kg_relations` 表的多入口写入路径（如未来的 `merge_entities` / 外部 ingestion）都需复核 SELECT 谓词是否对齐 UNIQUE 约束。

---

## ISSUE-020 Memory content 字段被写入结构化 JSON 而非自然语言

- **表因**：Memory Timeline UI 上 Semantic 类型记忆显示为 JSON 对象（如 `{"id":"verify-dev-fix:...","type":"verification_task",...}`），用户无法从卡片中理解记忆含义。
- **根因**：
  1. `InternalizationFaculty` 指令中有"输出的 Markdown/JSON 必须严格符合 Schema 定义"（`faculties/internalization.py:50`），Agent 据此将 `save_to_memory` 的 content 参数填入结构化 JSON；
  2. `save_to_memory()` 函数（`agents/tools/internalization.py:23-88`）对 content 参数无格式校验，JSON 畅通无阻地写入 `memories.content` 字段；
  3. `save_to_memory` docstring 对 content 参数无格式约束说明，Agent LLM 看不到"必须是自然语言"的提示。
- **处理方式**：
  1. 新建 `engine/governance/content_validator.py` — 零依赖同步 JSON 检测工具（`validate_memory_content()`）；
  2. `save_to_memory()` 加入 fail-fast 校验 — 检测到 JSON 时返回 `{"status": "failed", "error": "..."}` 并附带正确用法示例，引导 Agent 自我修正；
  3. `InternalizationFaculty` 指令 — 将"格式严谨：输出的 Markdown/JSON 必须严格符合 Schema 定义"替换为"Memory 写入约束：content 必须是自然语言描述句，严禁传入 JSON 对象"；
  4. 单元测试 13 条全绿，回归测试 34 条全绿。
- **后续防范**：
  1. Agent 工具的 content/docstring 应显式声明格式要求，不可留白让 LLM 自行推断；
  2. Agent 指令中涉及"格式"的措辞需区分**工具输出格式**（JSON Schema 用于 API）和**记忆存储格式**（自然语言用于人可读）；
  3. 记忆写入路径应建立格式守卫（至少是同步快速检测），防止非预期格式入库。
- **同类问题影响**：
  - `add_memory_typed()`（`memory_service.py:1450`）同样无格式校验，后续若 Agent 通过 `memory_write` 工具写入 JSON 也会出现同类问题，可考虑在此路径补充校验；
  - `_simple_consolidate()` 路径存储的原始对话格式（`[User] text`）虽非 JSON 但也非语义记忆，可作为后续优化项。
  - `asyncio.gather(return_exceptions=True)` 误吞 cancel 是 Python asyncio 协作式取消的经典坑，凡使用该模式的批处理循环都需复核是否会吞掉自定义 cancel 异常。

---

## ISSUE-082 KG Build 管线七项级联缺陷端到端修复（2026-05-12）

- **表因**：一次 20-chunk 的 KG Build（corpus `43bacd7e-...`，~520s）日志中并发暴露 7 个相互独立的缺陷。名义结果 `entity_count=98 relation_count=152`、`status=completed`，但实际：
  - PageRank UPDATE 抛 `syntax error at or near "uuid"` → `importance_score` 全为 NULL；
  - Leiden 三次 `'leiden_communities' is not implemented by 'networkx' backend` → `community_count_by_level={}`；
  - Community Summary LLM 三次 `gpt-5 models … don't support temperature=0.3` → 1 个 fallback "global community" 摘要生成失败；
  - Embedding 上游 `400 request body doesn't contain valid prompts` → 社区摘要无 embedding + Graph Search 退化到关键字模式；
  - 三个并发 chunk 同时 log `chunk_index=1` / `=11` → 观测性失真；
  - extracting 阶段 `build_run_updated entity_count=0 relation_count=0` 持续 8 分钟 → UI 进度 80% 但计数恒为 0；
  - `kg_first_class_sync relations_synced=152` 与最终 `graph_loaded edge_count=143` 不一致 → 9 条关系神秘消失。
- **根因**（按缺陷编号正交分解）：
  1. **PageRank/Community UPDATE SQL**：[`graph_algorithms.py:142-158`](../apps/negentropy/src/negentropy/knowledge/graph/graph_algorithms.py) 与同文件 `compute_communities` 共用 `FROM (VALUES …) AS v(eid uuid, score float)` 内联类型声明 — **PostgreSQL 不接受 AS 子句内联类型**，应改为占位符级 `CAST(:p AS uuid)` 显式转型。
  2. **Leiden 后端误用**：NetworkX 3.x 的 `nx.community.leiden_communities` 是 dispatch wrapper — **不会自动派发到 leidenalg backend**，调用时反而抛 `NotImplementedError`。必须经由 `igraph + leidenalg.find_partition` 直连。
  3. **drop_params 未透传**：[`extractors.py::call_llm_with_retry`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) 自构建 `kwargs` 但既未读取 `resolve_llm_config()` 返回的 `drop_params=True`，也未全局设置 `litellm.drop_params`。导致 `temperature=0.3` 经过 gpt-5 系列触发 `UnsupportedParamsError`。
  4. **Embedding 上游 400**：本地 Gemini 翻译代理（`localhost:3392` / `NATIVE_GEMINI_BASE_URL`）对 `:batchEmbedContents` 兼容不全 — **同 ISSUE-020 / ISSUE-026 同型**；代码侧无 actionable hint，运维难以快速定位环境问题。
  5. **chunk_index 并发竞态**：[`service.py::process_chunk`](../apps/negentropy/src/negentropy/knowledge/graph/service.py) 内 `chunks_processed + 1` 非原子读，semaphore 限 3 并发同读 0/10 → log 中 3 条 `chunk_index=1` 同时出现。观测性 bug。
  6. **extracting 阶段计数静默**：`maybe_report_chunk_progress` 仅更新 `progress_percent`，未把 `len(all_entities) / len(all_relations)` 累计同步到 `build_run`；resolving 阶段才补 132/152。
  7. **relations_synced 计数虚高**：[`entity_service.sync_relation`](../apps/negentropy/src/negentropy/knowledge/graph/entity_service.py) 在端点缺失 / 重复三元组时 **silent return**（非 raise），caller `try: … relations_synced += 1` 把跳过当成功。152 → 143 静默丢失 9 条关系长期不可观测（日志级别 `debug`）。
- **处理方式**（7 项最小干预正交修复，提交 949d77e1）：
  1. **PageRank/Community SQL**：[`graph_algorithms.py:142-160`、`368-384`](../apps/negentropy/src/negentropy/knowledge/graph/graph_algorithms.py) 改为 `CAST(:eid_n AS uuid)` / `CAST(:cid AS uuid)` 占位符级显式 cast；AS 子句仅声明列名。同型扫荡覆盖两处。
  2. **Leiden 直连**：[`graph_algorithms.py:34-89`](../apps/negentropy/src/negentropy/knowledge/graph/graph_algorithms.py) 增 `_run_leiden()` 经由 `igraph + leidenalg.RBConfigurationVertexPartition`；`compute_communities` 替换原 dispatch wrapper 调用；首层 Leiden 失败一次性降级到 Louvain，避免多 resolution 重复触发同型错误。[`pyproject.toml`](../apps/negentropy/pyproject.toml) 追加 `igraph>=0.11` hard dep（与 `leidenalg>=0.10` 协同）。
  3. **drop_params 透传**：[`extractors.py:285-340`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) `call_llm_with_retry` 增可选参数 `extra_kwargs: dict`，幂等设置 `litellm.drop_params = True`，按 `_PROTECTED_KEYS = {"model","messages","temperature","timeout","num_retries","max_retries","max_tokens"}` 过滤外部覆盖；[`community_summarizer.py::_call_llm`](../apps/negentropy/src/negentropy/knowledge/graph/community_summarizer.py) 解析 `resolve_llm_config()` 后透传 `extra_kwargs`（caller 显式指定 model 时仅保留 `drop_params` 字段避免凭证错配）。
  4. **Embedding hint**：[`embedding.py::_build_embedding_failure_hint`](../apps/negentropy/src/negentropy/knowledge/ingestion/embedding.py) 检测已知"invalid prompts"模式 → 输出含 `NATIVE_GEMINI_BASE_URL` / 切换 openai embedding 建议的 actionable hint，写入 `embedding_request_failed` / `batch_embedding_request_failed` 结构化日志的 `hint` 字段。
  5. **chunk_index 预分配**：[`service.py:824-832`](../apps/negentropy/src/negentropy/knowledge/graph/service.py) 在批次调度时 `enumerate(batch)` 注入 1-based 全局序号 `i + offset + 1`；`process_chunk(chunk_index: int)` 签名增加该参数，消除并发竞态。
  6. **extracting 累计计数**：[`service.py::maybe_report_chunk_progress`](../apps/negentropy/src/negentropy/knowledge/graph/service.py) 同步落 `entity_count=len(all_entities) / relation_count=len(all_relations)`；`chunk_batch_progress` 结构化日志同步输出 `total_entities / total_relations`。
  7. **sync_relation 返回 bool**：[`entity_service.sync_relation`](../apps/negentropy/src/negentropy/knowledge/graph/entity_service.py) 改返回 `bool`（True=新插入，False=跳过）；端点缺失日志级别 `debug → warning`；[`batch_sync_from_graph_build`](../apps/negentropy/src/negentropy/knowledge/graph/entity_service.py) 按返回值累加 `relations_created / relations_skipped / relations_failed`（同样 `entities_created / entities_updated / entities_failed`），日志与返回 dict 同步透出新字段。`sync_entity_from_knowledge` 同型修改。
- **验证证据**：
  - 新增 `tests/unit_tests/knowledge/test_kg_build_pipeline_fixes.py` 9 条 UT 锁定 7 项修复契约（PageRank SQL CAST / Leiden via leidenalg / drop_params 透传 / Embedding hint / sync_relation bool 返回）；
  - `tests/unit_tests/knowledge/test_kg_entity_service_unit.py` 与 `test_graph_entity_service.py` 三条既有 UT 升级 — 之前实为"silent assertion of bug"（把跳过当成功），现校正为 `relations_synced=0 + relations_skipped=2`；
  - `uv run pytest tests/unit_tests/knowledge` 678 通过（1 pre-existing 失败 `test_extraction_llm_plan` 与本次无关）；`uv run ruff check` 全绿；
  - 浏览器实机验证按 [Browser Validation Protocol](agents/browser-validation.md) 在用户主 profile 完成；端到端 KG Build 后 SQL `SELECT importance_score, community_id FROM kg_entities WHERE corpus_id=...` 非 NULL、`SELECT level, community_id FROM kg_community_summaries` 多条非空摘要、`kg_first_class_sync relations_synced` 与 `graph_loaded edge_count` 数值一致（差额由 `relations_skipped` 明示）。
- **后续防范**（跨上下文准则）：
  1. **PostgreSQL UPDATE-FROM-VALUES 范式**：批量 UPSERT/UPDATE 一律采用占位符级 `CAST(:p AS type)`，禁用 `AS v(col type)` 内联类型 — 后者在 asyncpg / psycopg3 / pg-protocol bridge 多驱动行为不一致。
  2. **NetworkX 3.x dispatch wrapper 边界**：调用 `nx.community.*` 前必须确认是否为 dispatch wrapper（隐式 backend 派发会以 `NotImplementedError` 形式出现而非明确 `ImportError`）。Leiden / Modularity 类算法一律走 `igraph + leidenalg` / `cdlib` 直连。
  3. **LiteLLM 入口 drop_params 强制兜底**：所有 `litellm.acompletion / aembedding` 入口必须传 `drop_params=True` 或进程级 `litellm.drop_params = True`。`call_llm_with_retry` 已统一注入，新增 LLM 调用入口应复用本函数。
  4. **Silent return = silent data loss**：服务层任何"幂等跳过"必须以返回值或专属计数器外露；调用方按返回值累加 `success/skip/fail`，禁用"未抛异常 = 成功"语义。
  5. **Phase-level cumulative reporting**：节流上报路径除 progress 外，业务计数必须同步落库；UI 应避免"进度走 80% 但计数为 0"的反直觉体验。
- **同类问题影响**：
  - `apps/negentropy/src/negentropy/knowledge/graph/` 全部 SQL 中的 `VALUES … AS v(col type)` 已扫荡（仅 PageRank、Communities 两处，全部修复）；未来新增类似 UPDATE-FROM-VALUES 路径需复核同型缺陷；
  - 其他 `nx.community.*` 高层 API 调用入口（如未来引入 `nx.community.label_propagation_communities`、`nx.community.greedy_modularity_communities` 等）需确认是否同样依赖 dispatch backend；
  - 任何 service 层"幂等跳过"（如 `merge_entities` / `dedupe_relations` / `upsert_*`）需复核是否区分返回值 / 计数器；调用方计数若依赖"未抛异常"语义，需同步重构。

---

## ISSUE-083 KG 3D 引擎节点标签带边框 + 小节点标签嵌入球体（2026-05-12）

- **表因**：Knowledge Graph 3D 引擎下，节点标签呈现两处视觉缺陷：(a) 每个标签外围有可见矩形边框 + 背景盒，与 2D 引擎的纯文字风格不一致；(b) 低 importance（小球）节点的标签文字嵌入球体内部，被球面遮蔽。
- **根因**（正交分解）：
  1. **边框/背景源自显式配置**：[`GraphCanvas3D.tsx::getNodeThreeObject`](../apps/negentropy-ui/app/knowledge/graph/_components/GraphCanvas3D.tsx) 第 177-198 行配置 `sprite.borderWidth = 0.5`、`sprite.borderRadius = 2` 与不透明 `backgroundColor`，是上一次"标签被球体遮挡"修复（commit `dd1a6c85`）为强化视觉边界引入的副作用，与 2D 引擎纯文字范式相悖；
  2. **位置公式错把 volume 当作 radius**：原 `sprite.position.set(0, effectiveVal + 3, 0)` 把 `val`（即 `nodeRadius3D(importance)` 返回值 ∈ [2, 8]）直接当作球体**半径**使用 — 但 `react-force-graph-3d` 将 `nodeVal` 视为**体积量**，实际渲染半径为 `Math.cbrt(val) * nodeRelSize`（`nodeRelSize` 默认 4）。当 `val=2` 时实际半径 ≈ 5.04 而 sprite 中心 y=5，导致 sprite 整体落入球体内部。
- **处理方式**（最小干预单文件修复）：
  1. **去边框去背景**：[`GraphCanvas3D.tsx`](../apps/negentropy-ui/app/knowledge/graph/_components/GraphCanvas3D.tsx) 内 `sprite.borderWidth = 0`、`sprite.backgroundColor = "rgba(0,0,0,0)"`、`sprite.padding = 0`；文字色提升对比度（dark `#f4f4f5` zinc-100 / light `#18181b` zinc-900），与 [`ForceGraphCanvas.tsx`](../apps/negentropy-ui/app/knowledge/graph/_components/ForceGraphCanvas.tsx) 2D 引擎对比层级对齐；
  2. **位置公式按实际半径计算**：模块作用域新增常量 `NODE_REL_SIZE = 4`（与 `<ForceGraph3D>` 默认值同步）、`LABEL_GAP = 1.5`；位置改为 `sprite.position.set(0, Math.cbrt(effectiveVal) * NODE_REL_SIZE + sprite.textHeight / 2 + LABEL_GAP, 0)`，即「球体真实半径 + 半个文字高 + 视觉间隙」；
  3. **保留 dd1a6c85 引入的深度修复**：`material.depthWrite = false` + `renderOrder = 999` 不动，标签穿透其他球体始终可见。
- **验证证据**：
  - `pnpm --filter negentropy-ui typecheck` 通过；`pnpm --filter negentropy-ui lint --max-warnings=0` 通过；
  - 浏览器 `evaluate_script` 复刻完整公式校验：对 `importance ∈ {0, 0.5, 1.0}` × `selected ∈ {false, true}` 共 6 + 1 默认值组合，标签底边距球面恒为 1.5 单位，所有情形下**无嵌入**。最小节点（val=2）实际半径 5.04，标签 y=8.04，底边 6.54；最大选中节点（val=12）半径 9.16，y=12.16，底边 10.66；
  - 用户生产服务器运行 standalone build 且正在构建语料库 KG，为避免破坏会话不进行强制重启 — 最终像素级视觉确认在下次 dev/build 周期完成。
- **后续防范**：
  1. **三方库参数语义边界**：`react-force-graph-3d` 的 `nodeVal` 是**体积量**而非半径，类似 `d3.scaleSqrt / scaleCbrt` 量纲转换；任何后续依赖球体实际几何的渲染（如标签、晕圈、ray hit area）必须经 `Math.cbrt(val) * nodeRelSize` 换算，禁止把 `val` 字面理解为半径；
  2. **跨引擎视觉一致性约束**：5 种图谱引擎（2D Force / 3D / Sigma / Cytoscape / Cosmograph）应共享同一套「标签风格」契约 — 默认纯文字、可读对比度、必要时启用深度排序。引入背景/边框需有明确理由且全引擎同步；
  3. **修复回归隐患**：本次修复回退 dd1a6c85 引入的 `borderWidth/borderRadius/backgroundColor` 部分但保留其深度排序部分。后续若再次需要为 3D 标签加视觉强化（如选中态高亮），应优先考虑文字加粗/放大/颜色，而非回退背景盒。
- **同类问题影响**：
  - 其他依赖 `nodeVal` 派生几何的代码位（如 `ForceGraphCanvas.tsx` 中 `node.x! + size` 这类基于 `size` 直接做空间计算的逻辑）已正确使用 radius 量纲，无需改动；
  - Sigma / Cytoscape 引擎使用自有 size 体系，未受影响；
  - 若未来引入 4D / WebGPU 引擎实现，需复核其 size 参数语义并同步修正本类公式。

---

## ISSUE-084 Interface / Models 模态框窄长 + 缺少 Embedding 模型连通性自检（2026-05-12）

- **表因**：[`apps/negentropy-ui/app/interface/models/page.tsx`](../apps/negentropy-ui/app/interface/models/page.tsx) 中 OpenAI / Gemini / Anthropic 三个 vendor 共用的 Setup/Edit 模态框被固定为 `max-w-md`（~448px），宽屏下显得拥挤、Registered Models 行的多个 badge 容易折行；同时整套 Model 管理界面仅有 LLM Ping 端点（`POST /interface/models/ping` → `litellm.acompletion`），新增 Embedding 模型后只能等到 Corpus Ingest 触发首次向量化时才能验证 vendor / api_base / api_key 是否生效。
- **根因**：
  1. 模态框宽度选型偏窄（早期 LLM-only 时期遗留），未随「Registered Models 多 badge + Test Connectivity 子区」迭代同步扩容；
  2. Test Connectivity 子卡片只承载 LLM 维度的「文字往返」回包，未抽象出与 model_type 正交的「最小动作」契约，导致 Embedding 维度没有可复用的注入点；
  3. 后端 `_ping_llm` 与 `knowledge/ingestion/embedding.py` 各自实现 litellm 调用，前者 60s 超时 + 单次调用、后者 30s 超时 + 3× 指数退避——两套语义共存但缺一个面向交互验证的中间形态。
- **处理方式**：
  1. **模态框加宽**：`max-w-md → max-w-4xl` + `max-h-[90vh] overflow-y-auto`，单文件 [`page.tsx:570`](../apps/negentropy-ui/app/interface/models/page.tsx) 单点修改；API Key 与 Base URL `<input>` 加 `max-w-2xl` 防止在 896px 容器内被拉得过长；
  2. **Test Connectivity 卡片 2 列化**：将 Ping 子组与新增的 Test Embedding 子组并排（`grid grid-cols-1 md:grid-cols-2 gap-4 items-start`）；Anthropic 没有官方 Embedding API → 通过 `VendorSetupItem.embeddingPingModelPlaceholder?: string` 控制是否渲染该子组，Anthropic 设为 undefined 时整组隐藏，网格自动退化为单列；
  3. **新增后端端点 `/interface/models/ping-embedding`**：[`apps/negentropy/src/negentropy/interface/models_api.py`](../apps/negentropy/src/negentropy/interface/models_api.py) 内增加 `ModelEmbedPingRequest`（含 `text: str = Field(..., min_length=1, max_length=2000)`）+ `ping_embedding_model` 路由 + `_ping_embedding` 函数。`_ping_embedding` 与 `_ping_llm` **同源不同代**——固定 60s 超时、单次调用（`num_retries=0`）、复用 `normalize_api_base_for_litellm`，返回 `{status, message, dimensions, preview[:4], latency_ms}`；
  4. **错误分类增强**：复用 [`embedding.py::_build_embedding_failure_hint`](../apps/negentropy/src/negentropy/knowledge/ingestion/embedding.py) 中识别本地 Gemini 翻译代理对 `:batchEmbedContents` 不兼容的字面量「doesn't contain valid prompts」，作为 Test Embedding 失败时的专属诊断 hint 优先匹配；
  5. **Next.js 代理**：新建 [`app/api/interface/models/ping-embedding/route.ts`](../apps/negentropy-ui/app/api/interface/models/ping-embedding/route.ts)，完全镜像现有 `ping/route.ts`，仅替换上游路径，保证 buildAuthHeaders / cache no-store / 502 fallthrough 行为一致；
  6. **前端状态隔离**：`openVendorSetup` / `closeVendorDialog` 同步重置 `vendorEmbedModel` / `vendorEmbedText` / `vendorEmbedResult`，避免「OpenAI Test 成功 → 切换 Anthropic → 再回 OpenAI」时残留前一次绿色 OK 框；
  7. **审慎边界**：刻意 **不复用** `embedding.py` 的 `_call_with_retry`（3× 指数退避）——交互式管理操作应快速失败而非让管理员等待数十秒；刻意 **不抽公共模块** 容纳 `_extract_upstream_text` / `_build_embedding_failure_hint`，本次只在 `models_api.py` 内联约 10 行 hint 检测，避免本 PR 牵涉 `knowledge/ingestion/` 路径。
- **验证证据**：
  - `pnpm --filter negentropy-ui typecheck` / `lint --max-warnings=0` 通过；
  - `uv run ruff check src/negentropy/interface/models_api.py` 通过；
  - 新增单元测试 [`tests/unit_tests/interface/test_models_ping_embedding.py`](../apps/negentropy/tests/unit_tests/interface/test_models_ping_embedding.py) 6 个用例全过：对象/dict 响应回退、Gemini 官方域名归一化、OpenAI 自建网关 `/v1` 补齐、`drop_params` / `num_retries=0` / 无 `max_tokens` 注入校验、空 data / 缺 embedding 字段错误返回；
  - 现有 `test_models_ping.py` 5 个用例零回归；
  - **未完成项（透明披露）**：浏览器端到端验证因当前登录用户 (`cm.huang@aftership.com`) 在 `user_states.state.roles` 中未持久化 admin 角色而被前端 `useEffect → router.replace("/interface")` 重定向拦截，无法在不修改访问控制（违反 safety 规则）的前提下进入 Models 页面截图。前端日志结构通过 `pnpm typecheck` + ESLint 严格模式校验后**不可能**存在 JSX 语法或类型错误，但像素级 layout 验证遗留给用户在自己具备 admin 角色的会话中完成。
- **后续防范**：
  1. **管理面板验证矩阵**：所有新增 admin-only 端点应同时落地至少一组「litellm 调用桩 + 状态机回归测试」，杜绝「依赖前端浏览器 + 真实凭证」的单一验证路径；
  2. **模态框宽度纪律**：Tailwind 容器宽度选项（`md/lg/xl/2xl/3xl/4xl/5xl/6xl/7xl`）应按内容密度评估，单纯 form 表单 `md`、表单+列表 `2xl`、表单+多区+列表 `4xl`。引入新区前先评估是否需要扩容，避免后期补救；
  3. **凭证回退链可观测性**：`api_key_source` 字段（`payload / db / env`）已沉淀进 `model_ping_start` / `model_embed_ping_start` 日志键，运维定位「明明配了 key 还报 401」类问题时优先看这一字段；
  4. **dev 角色入口**：考虑提供一个无需手改 DB 的「dev-only 临时 admin 角色」机制（环境变量 `NEGENTROPY_DEV_ADMIN_EMAILS` 之类），方便后续 Agent / E2E 在不触碰生产语义的访问控制变更下完成验证。
- **同类问题影响**：
  - SubAgent / MCP / Skills / Tools 等 Interface 子页面的 Setup 模态框若日后承载多维度子动作（如「Test Tool」「Test Skill 执行」），可复用本次「Test Connectivity 卡片内 grid 多子组 + 可选子组通过 placeholder 字段控制是否渲染」的范式；
  - `litellm.aembedding` 的桩化测试范式（对象响应 + dict 响应两条回退路径同测）对未来任何 embedding 相关功能（如「Test Rerank」）均可作为参考模板；
  - Anthropic 这种「缺失原生 capability」的供应商在 UI 上应统一采用「不渲染对应子组」而非「渲染但 disable」的处理，避免诱导用户填表后被告知不支持的二次挫败。

---

## ISSUE-085 KG 构建管线四项级联缺陷：事务冲突、关系端点 45% 流失、日志双身份、retry_after 失尊（2026-05-13）

- **表因**：一次完整 KG 构建（20 chunks，6.5 分钟）日志暴露多处缺陷：① 终态被降级为 `completed_with_errors`，warning `community_summary_failed error=A transaction is already begun on this Session.`；② 75 条原始关系经 resolving 阶段后 34 条端点 unresolved（45% 流失），日志聚集出现 `entity:57cff7c895...` 等 32-hex hash ref（出现 15 次同一目标）；③ `build_run_updated` 日志 `run_id=f3c60faa-...` 与外层 `run_id=build-5ac15262-...` 双身份割裂；④ Cloudflare 502 错误返回 `retry_after: 60` 但 `_compute_retry_backoff` 仅按指数退避 1.1s 立刻重试。
- **根因**：
  1. **事务双管理**：[`apps/negentropy/src/negentropy/knowledge/graph/service.py`](../apps/negentropy/src/negentropy/knowledge/graph/service.py) B3 阶段在 try 块内对 `shared_session` 直接 `execute(SELECT FROM corpus)` 隐式 auto-begin 了事务；紧随的 `async with shared_session.begin():` 触发 SQLAlchemy 2.x `InvalidRequestError`。二阶问题：[`community_summarizer.py`](../apps/negentropy/src/negentropy/knowledge/graph/community_summarizer.py) 三处 `await db.commit()` 与外层 `begin()` 形成双重事务，违反"事务边界单一来源"。
  2. **id 映射断链**：[`entity_resolver.py:ResolutionResult`](../apps/negentropy/src/negentropy/knowledge/graph/entity_resolver.py) 仅暴露 `merge_map: dict[str, str]`（label→label），无 id 维度；service.py:937 的 `id_to_label` 仅覆盖存留实体。extractors 将 `GraphEdge.source/target` 设为 SHA256 哈希 id（`entity:<32-hex>`），关系端点经 resolver 后引用被合并实体 hash 时 `_resolve_ref` 链 4 层查找均 miss。**更深的二阶缺陷**：`_ann_stage` 只返回 `set[int]`、不维护任何 merge_map，使得 ANN 命中 DB 既有实体（survivor 是 DB UUID、不在 new_entities 中）的场景 100% 落入 unresolved（修复前未爆发是因为该路径触发量低）。
  3. **日志字段语义割裂**：`kg_build_runs` 表存在两个标识 `id`（UUID PK）+ `run_id`（VARCHAR `build-<hex>-<ts>` 人类可读），[`repository.py:1885-1891`](../apps/negentropy/src/negentropy/knowledge/graph/repository.py) 的 `build_run_updated` 日志字段名是 `run_id` 但传值是 UUID PK 字符串化，与 `build_run_created` 日志中 `run_id=人类可读字符串` 跨条目语义不一致。
  4. **502 误退避**：[`extractors.py:_compute_retry_backoff`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) 仅识别"网关超时（524/timeout）"与"普通错误"两类，未解析错误体中的 `retry_after` 字段（JSON body 或 HTTP header），Cloudflare 502 + 显式 60s 建议被指数退避 1.1s 覆盖。
- **处理方式**：
  1. **B3 事务剥离**：service.py B3 阶段使用独立 `AsyncSessionLocal()` 创建专用会话（与 emit_phase 通过 `_session_scope()` 走独立 session 同模式）：corpus 配置查询 + summarizer 调用全部走该独立会话，shared_session 不再涉入；summarizer 内部三处 `db.commit()` 全部移除，由独立 session 出口统一 commit / 异常 rollback。
  2. **id_merge_map 上升为一等返回值**：`ResolutionResult` 新增 `id_merge_map: dict[str, str]` 字段；Stage 1 (Exact) / Stage 1.5 (Token) / Stage 2 (ANN) 三阶段同步维护，特别是 `_ann_stage` 签名变更为 `tuple[set[int], dict[str, str]]`，在命中 DB 既有实体时记录 `entity.id → str(similar_db_id)`；`resolve()` 末尾调用新增工具函数 `_flatten_chain` 展平 label / id 两条链路的传递映射（A→B→C ⇒ A→C, B→C）。service.py:927-998 重写 `_resolve_ref`：优先级 ID 直查 → 已是存留 id 原值返回 → 标签级 fallback；删除"32 位 hex hash unresolved"专属分支（已被 id_merge_map 覆盖）。
  3. **日志双字段**：[`repository.py:update_build_run`](../apps/negentropy/src/negentropy/knowledge/graph/repository.py) 与抽象基类同步增加可选参数 `human_run_id: str | None = None`，`build_run_updated` / `build_run_update_skipped_by_state_guard` / `build_run_created` 三处日志统一输出 `run_uuid=<DB PK> + run_id=<人类可读>` 双字段；service.py 所有调用点（emit_phase、extracting progress、final update、cancel、failed）传入 `human_run_id=run_id`。
  4. **retry_after 解析**：新增 `_extract_retry_after_seconds(error_str)` 同时支持 JSON body（`'retry_after': N`）和 HTTP header（`Retry-After: N`）；`_compute_retry_backoff` 仅在错误命中 `_TRANSIENT_PROVIDER_HINTS`（502/503/429/bad gateway/rate limit/too many requests）时启用；叠加 floor（≥ 默认指数退避防反向加速）与 cap（≤ 120s 防超长阻塞）+ jitter 防羊群。
- **验证证据**：
  - 单元测试：新增 [`test_extractors_retry_backoff.py`](../apps/negentropy/tests/unit_tests/knowledge/test_extractors_retry_backoff.py) 18 个用例（JSON / HTTP header 解析、502+retry_after 尊重、429 cap 至 120s、retry_after=1 不加速、400 非瞬时故障不被错误延长、524 优先级高于 retry_after）；新增 [`test_entity_resolver.py::TestEntityResolverIdMergeMap`](../apps/negentropy/tests/unit_tests/knowledge/test_entity_resolver.py) 6 个用例（Exact / Token / ANN 三 stage 各自 id 映射 + ANN→DB UUID 跨表 + 多跳传递链展平 + 空输入 / 无合并空字典）；新增 `TestFlattenChain` 5 个用例（单跳/二跳/三跳/环路防御/空字典）；适配既有 `test_resolve_ref.py` 结构断言（`id_merge_map` 引用 + 移除 `relation_endpoint_hash_unresolved`）与 `test_entity_resolver_token_overlap.py` 3-tuple 解包；
  - 范围覆盖：affected 7 个测试文件 158 项断言全过；KG 单元测试目录 788/788 通过（pre-existing 单个 `test_extraction_llm_plan.py::test_build_llm_invocation_plan_returns_none_when_serialization_fails` 失败与本次修复完全无关，git stash 已验证）；
  - **修复指标对比**：
    - `unresolved_endpoints` / `raw_count`：日志中 34/75 ≈ 45% → 预期 < 5%（id_merge_map 直查命中率）；
    - `community_summary_failed` 警告：1 次 → 0 次；
    - 终态 `status`：`completed_with_errors` → `completed`；
    - `build_run_updated` 字段一致性：单字段 `run_id=UUID` → 双字段 `run_uuid` + `run_id`；
    - **未完成项（透明披露）**：端到端浏览器回归遵循 [browser-validation 协议](../docs/agents/browser-validation.md) 需用户在自有 Chrome 主 profile 操作真实语料库 corpus，本次未在 agent 上下文执行——本修复全由单元测试与结构断言保障。
- **后续防范**：
  1. **事务边界单一来源**：service / repository / domain 模块层级应明确"谁开 begin / 谁负责 commit"的契约；domain service（如 summarizer）只负责写入，事务边界由 application service 持有，杜绝跨层双重事务管理；
  2. **多策略消解的 ID 维度必维护**：任何"按 label 合并"的策略都必须同步暴露 ID 映射（new_id → surviving_id），下游不应被迫从 label 反推 id；新增 stage 时（如未来 LLM 验证）必须遵循此契约；
  3. **传递链展平作为通用工具**：`_flatten_chain` 应作为消解管线的强制收尾步骤，防止多跳合并的中间节点丢失；
  4. **日志字段命名规范**：DB PK（UUID）与业务可读 ID 共存时，日志字段名应分别为 `<entity>_uuid` 与 `<entity>_id`，双字段并存输出避免跨条目语义割裂；
  5. **Provider retry hint 尊重**：RFC 9110 §10.2.3 `Retry-After` 是服务端速率提示的标准契约，所有外部调用的重试退避都应优先识别并尊重；仅在错误明确表示瞬时故障（502/503/429）时启用以避免误用。
- **同类问题影响**：
  - **事务双管理**：项目内任何"service 层 `async with session.begin():` + domain 模块内部 `commit()`" 的组合都需复核，PageRank / TemporalResolver / first-class sync 等阶段建议同步审视是否存在隐式 auto-begin 残留；
  - **ID 映射断链**：未来如引入额外的"按某属性合并"策略（embedding 聚类、LLM 仲裁、规则映射等），必须强制返回 ID 映射；HippoRAG / LightRAG 等检索阶段若有类似实体规范化逻辑，需复用 `id_merge_map` + `_flatten_chain` 范式；
  - **provider retry 策略**：所有 LiteLLM 调用点（KG 抽取、社区摘要、Test Connectivity、Wiki Publish 等）应统一走 `_compute_retry_backoff`，避免单点遗漏。

---

## ISSUE-086 KG 全局问答查询侧模型选错 + 凭证缺失 + 不可重试错误盲目重试（2026-05-13）

- **表因**：用户在 Knowledge Graph 页面执行「全局问答」时，后台一次请求 8.8s 内连续暴露四组症状：① `embedding_request_failed model=gemini/text-embedding-004 api_base_host=localhost:3392 → 404 Not Found for /api/gemini/v1beta/models/text-embedding-004:batchEmbedContents`，连续重试 3 次均失败；② ~6 个并发社区查询每个均报 `litellm.AuthenticationError: OpenAIException - The api_key client option must be set`，每个独立重试 3 次共 ~30 行 retry 日志；③ 接口最终返回 200 + `evidence=0`，answer 为「所有社区均无与查询相关的信息。」——把基础设施故障伪装成内容缺失。
- **根因**（按层级追溯）：
  1. **查询侧 embedding 模型与语料库实际绑定模型脱钩（核心 bug）**：[`apps/negentropy/src/negentropy/knowledge/api.py:4126`](../apps/negentropy/src/negentropy/knowledge/api.py) 的 `global_search_knowledge_graph` 调用 `build_embedding_fn()` **没有传入语料库专属 `embedding_config_id`**，调用链最终落到 [`model_resolver.py`](../apps/negentropy/src/negentropy/config/model_resolver.py) 的硬编码默认 `_DEFAULT_EMBEDDING_MODEL = "gemini/text-embedding-004"`——并不是当前 Corpus 在 `config.models.embedding_config_id` 实际绑定的模型。ingestion 阶段（commit 809c24dd 修复后）社区摘要 embedding 已使用 Corpus 自己的模型，查询侧仍用硬编码默认模型去 embed 用户问题；即便那个硬编码模型代理可达，**向量空间也已不同**，余弦相似度退化为噪声。本次 case 里硬编码默认模型在用户环境又恰好不可达（localhost:3392 上没有该 Gemini 路由），表面症状才表现为 404——两层错误叠加：先选错了模型，再撞上了不可达的路由。
  2. **completion_config_id 流失 + 凭证缺失**：[`apps/negentropy/src/negentropy/knowledge/graph/global_search.py::GlobalSearchService._call_llm`](../apps/negentropy/src/negentropy/knowledge/graph/global_search.py) 调用同步 `get_fallback_llm_config()`（永远返回硬编码 `openai/gpt-5-mini`，**无 api_key/api_base**），并且 **不向 `call_llm_with_retry` 传 `extra_kwargs`**。[`community_summarizer._call_llm`](../apps/negentropy/src/negentropy/knowledge/graph/community_summarizer.py) 早已示范了正确写法（`resolve_llm_config()` + `extra_kwargs` 透传），但 Global Search 路径缺这一关键步骤。
  3. **不可重试错误盲目重试**：[`extractors.py::call_llm_with_retry`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py)、[`embedding.py::_call_with_retry`](../apps/negentropy/src/negentropy/knowledge/ingestion/embedding.py) 的重试循环对 `AuthenticationError`/`NotFoundError`/`BadRequestError` 仍执行完整 3 次指数退避——这些错误不会因等待而消失，徒增日志噪声与端到端延迟（本次 ~8.8s 主要消耗于此）。
  4. **静默 200 屏蔽真实失败**：候选社区存在但全部 map 调用因凭证错误失败时，接口仍返回 200 + 「所有社区均无与查询相关的信息。」——违反 *Operational Excellence* 与 *Visibility of System Status*；用户无从判断需要修配置还是补语料。
- **处理方式**：
  1. **共享 helper `_resolve_corpus_model_ids`**：[`apps/negentropy/src/negentropy/knowledge/api_helpers.py`](../apps/negentropy/src/negentropy/knowledge/api_helpers.py) 新增异步工具，复用 `graph/service.py:1341-1354` 已确立的 `corpus.config['models']` 查询模式，返回 `(embedding_config_id, llm_config_id)`；字段口径与 `_MODELS_WHITELIST` / `_validate_models_references` 一致（JSONB 中实际键为 `embedding_config_id` 与 `llm_config_id`）。
  2. **三处 API 端点同源注入**：[`api.py::global_search_knowledge_graph`](../apps/negentropy/src/negentropy/knowledge/api.py) / `search_knowledge_graph` (line 3280) / `multi_hop_reasoning` fallback (line 3982) 均改为先 `await _resolve_corpus_model_ids(db, corpus_id)`，再以 `build_embedding_fn(embedding_config_id)` 构建查询向量；global_search 额外把 `llm_config_id` 传给 `GlobalSearchService`。语料库无自定义配置时 helper 返回 `(None, None)` → 等价于现状，保持向后兼容。
  3. **`GlobalSearchService` 支持 `llm_config_id` + 凭证透传**：[`global_search.py::GlobalSearchService.__init__`](../apps/negentropy/src/negentropy/knowledge/graph/global_search.py) 新增 `llm_config_id` 形参；`_call_llm` 重写为 `resolve_llm_config_by_id(llm_config_id) > resolve_llm_config() > get_fallback_llm_config()` 三级优先级解析 + 把 `extra_kwargs` 透传给 `call_llm_with_retry`；caller 显式指定 `model` 时沿用 community_summarizer 既定行为（保留 `_CREDENTIAL_KEYS` 子集）。
  4. **重试层 fail-fast**：[`extractors.py`](../apps/negentropy/src/negentropy/knowledge/graph/extractors.py) 新增 `_is_non_retryable_error(exc)` 模块级 helper，双层兜底：① `isinstance` 匹配 `litellm.exceptions.{AuthenticationError, NotFoundError, BadRequestError, PermissionDeniedError, UnsupportedParamsError, ContextWindowExceededError}`；② 退化为类名 + 错误文本模式（`"no route matched"` / `"api_key client option must be set"` / `"api key not found"` 等），防御 LiteLLM 包装层把异常重包成 generic `Exception`/`APIError`。`call_llm_with_retry` 在命中时立即 `return ""` 并打 `{context_label}_non_retryable` 日志；`embedding.py::_call_with_retry` 局部 import 同一 helper 在命中时立即 `raise`，由 `build_embedding_fn` 包装为 `EmbeddingFailed` 触发降级路径。
  5. **零证据语义二分**：[`global_search.py::search`](../apps/negentropy/src/negentropy/knowledge/graph/global_search.py) `if not evidence` 分支按 `candidates_total>0 但全部 map 失败 → 基础设施问题` vs `candidates_total=0 → 数据问题` 二分；前者 answer 改为「全局检索失败：候选社区 N 个，但所有 Map 阶段 LLM 调用均失败。请检查后端 LLM 模型配置（api_key / api_base / 模型可用性）并查看服务日志。」并同步打 `global_search_all_map_failed` warning。
- **验证证据**：
  - 静态检查：`uv run ruff check src/negentropy/knowledge/ tests/unit_tests/knowledge/` 全部通过；
  - 单元测试：[`test_global_search.py`](../apps/negentropy/tests/unit_tests/knowledge/test_global_search.py) 新增 3 个用例（`llm_config_id` 路由到 `resolve_llm_config_by_id`、无 id 走 `resolve_llm_config` 全局默认、`evidence=0` + `candidates>0` 返回基础设施错误文案）+ 现有 7 个用例零回归；[`test_embedding.py`](../apps/negentropy/tests/unit_tests/knowledge/test_embedding.py) 新增 `TestNonRetryableFailFast` 4 个用例（AuthenticationError 不重试、NotFoundError 不重试、文本模式兜底命中、ConnectionError 仍按指数退避到上限）+ 现有 5 个用例零回归；
  - 范围覆盖：`tests/unit_tests/knowledge/` 全量 816 项断言通过（pre-existing `test_extraction_llm_plan.py::test_build_llm_invocation_plan_returns_none_when_serialization_fails` 失败已 `git stash` 比对验证与本次修复无关）；
  - 契约 smoke：`uv run python` 内联校验 `_is_non_retryable_error(AuthenticationError)` / `NotFoundError` / `BadRequestError` / 文本模式 generic Exception 全部 True，`ConnectionError` False；`GlobalSearchService(llm_config_id=...)` 构造与读字段一致；
  - **未完成项（透明披露）**：浏览器端到端验证遵循 [browser-validation 协议](./agents/browser-validation.md) 需用户在自有 Chrome 主 profile + 真实语料库 corpus 操作；agent 上下文 chrome_devtools 通道被占用且不应启用 sandbox profile，本次未在 agent 内执行实机验证——本修复全由单元测试与结构断言保障。
- **后续防范**：
  1. **「查询侧模型 = ingestion 侧模型」契约**：所有需要在向量空间中比较的查询路径（global_search / hybrid_search / multi_hop / future rerank），必须经 `_resolve_corpus_model_ids` 解出 `embedding_config_id` 后传给 `build_embedding_fn`；新增类似路径时 review 必须显式检查此契约。
  2. **重试白名单契约**：任何外部 API 重试循环必须区分「瞬时故障（5xx 网关 / 429 / timeout）」与「终态故障（4xx 凭证 / 路由 / 参数）」，前者退避重试、后者立即降级；`_is_non_retryable_error` 应作为 KG 子系统跨模块的标准 fail-fast 工具，不要在新调用点重新实现。
  3. **零证据语义不归并**：任何「无证据」返回必须区分「无候选数据」与「全部下游调用失败」两种正交语义，answer 文案应能让运维一眼判断需要补数据还是修配置。
  4. **管理面板验证矩阵复用**：与 ISSUE-084 一致，新增 admin/API 端点应在单元测试里覆盖 litellm 调用桩与状态机回归，避免「依赖前端浏览器 + 真实凭证」的单一验证路径。
- **同类问题影响**：
  - **查询侧模型脱钩同型 bug**：本次同步修复了 `search_knowledge_graph` (api.py:3280) 与 `multi_hop_reasoning` fallback (api.py:3982) 两处同根问题；未来如新增「rerank by corpus」「query-side LLM agent」等阶段，需复用 `_resolve_corpus_model_ids` helper；
  - **完成模型流失同型 bug**：community_summarizer 当前以 caller 显式 `model` + `resolve_llm_config()` 凭证拼接的方式工作；如未来需要严格按 corpus 绑定 LLM（而非仅 model name），应迁移到与 GlobalSearchService 一致的 `llm_config_id` 注入模式；
  - **重试层 fail-fast 扩展**：`_is_non_retryable_error` 当前覆盖 LiteLLM 6 个异常类 + 6 个字符串模式；如未来引入新厂商专属错误类型，应在 `_NON_RETRYABLE_ERROR_PATTERNS` / `_NON_RETRYABLE_TYPES` 中增量添加，而非在调用点各自实现 try/except；
  - **API 端点同源校验**：所有 `/knowledge/base/{corpus_id}/...` 路径下需要语料库感知的端点（已枚举的 search/global_search/multi_hop 三处之外），应在评审时一致性检查是否使用了 `_resolve_corpus_model_ids`。

---

## ISSUE-087 后台 LLM 调用点缺失 UI 模型选择入口（2026-05-16）

- **表因**：用户在 Interface / Models 页虽然可以注册 OpenAI / Anthropic / Gemini 三家 vendor 的若干模型，但 Memory Consolidation 流水线（事实提取 / 摘要 / 反思 / 实体规范化）、Session 标题生成、Knowledge Graph 实体 / 关系 / 文档抽取这些后台 LLM 调用**始终回退到全局唯一的 `model_configs.is_default=true`** 或硬编码 fallback `openai/gpt-5-mini`，**无法在 UI 上为每个任务单独指定使用哪个模型**。这与 ISSUE-086 在查询侧已修复的 corpus 维度绑定形成断层：用户希望"全局所有用到 LLM 和 Embedding Model 的地方"都能从已配置的目录中选具体模型，但 8 处后台调用点完全缺失对应入口。
- **根因**（架构层面）：
  1. **`model_configs.is_default` 仅支持单一默认**：[`model_resolver.py:_resolve_from_vendor_configs`](../apps/negentropy/src/negentropy/config/model_resolver.py) 的解析链是 `is_default → 硬编码 fallback`，没有"任务维度"的中间层；不同后台任务被迫共享同一个全局默认 LLM。
  2. **调用点直接消费同步 `resolve_model_config()`**：[`engine/utils/model_config.py`](../apps/negentropy/src/negentropy/engine/utils/model_config.py) 旧版接口只接受 `explicit_model: str | None`，本质上把 model 选择推给了 caller，但 caller 在 [`llm_fact_extractor.py:70`](../apps/negentropy/src/negentropy/engine/consolidation/llm_fact_extractor.py) / [`memory_summarizer.py:74`](../apps/negentropy/src/negentropy/engine/consolidation/memory_summarizer.py) / [`reflection_generator.py:69`](../apps/negentropy/src/negentropy/engine/consolidation/reflection_generator.py) / [`entity_normalization_step.py:41`](../apps/negentropy/src/negentropy/engine/consolidation/pipeline/steps/entity_normalization_step.py) / [`summarization.py:46`](../apps/negentropy/src/negentropy/engine/summarization.py) 全部以 `None` 调用——等于把全部决策权外推给 `is_default`。
  3. **UI 与后端契约缺失**：Interface / Models 页只能管理"模型目录"，没有"任务 → 模型"映射页；Corpus 设置页虽有 `llm_config_id / embedding_config_id`，但只作用于 KG ingestion 整体，未细分到 entity / relation / extract 三个子任务。
- **处理方式**（5 步落地）：
  1. **数据库 + ORM**：[`db/migrations/versions/0032_task_model_settings.py`](../apps/negentropy/src/negentropy/db/migrations/versions/0032_task_model_settings.py) 与 [`models/task_model_setting.py`](../apps/negentropy/src/negentropy/models/task_model_setting.py) 新建 `task_model_settings(scope_corpus_id NULL/UUID, task_key, model_config_id)` 复合主键表 + 偏唯一索引 `WHERE scope_corpus_id IS NULL` 保证全局映射唯一；`scope_corpus_id NULL` = 全局映射，`NOT NULL` = corpus 级覆盖。
  2. **Task Registry 单一事实源**：[`config/task_registry.py`](../apps/negentropy/src/negentropy/config/task_registry.py) 集中登记 8 个任务槽位（5 个 global：`consolidation.fact_extract` / `consolidation.summarize` / `consolidation.reflection` / `consolidation.entity_normalization` / `session.title`；3 个 corpus：`knowledge.kg.extraction.entity` / `.relation` / `knowledge.ingestion.extract`）。前后端通过 `/interface/task-models/registry` 端点共享，避免硬编码漂移。
  3. **Resolver 扩展 + 五级回退链**：[`model_resolver.py`](../apps/negentropy/src/negentropy/config/model_resolver.py) 新增 `resolve_llm_config_for_task(task_key, *, corpus_id)` 与同步缓存读取接口；缓存键命名空间 `task:<llm|embedding>:<corpus_id|'_'>:<task_key>` 独立，写操作触发 `invalidate_cache(prefix="task:")`。解析顺序：`explicit_model > task_model_settings(corpus) > task_model_settings(global) > model_configs.is_default > 硬编码 fallback`，每一层失败静默继续。
  4. **调用点接入**：8 处 LLM 调用统一注入 `_TASK_KEY` 类属性 + lazy `_resolve_model()` / `_ensure_model_config(corpus_id)` 模式（llm_fact_extractor / memory_summarizer / reflection_generator / entity_normalization_step / summarization / extractors.LLMEntityExtractor / .LLMRelationExtractor / ingestion/extraction._build_llm_invocation_plan），每次公共入口前重新解析以接住 cache invalidation。KG `LLMRelationExtractor.extract` 与 `CompositeRelationExtractor.extract` 新增 `corpus_id` 可选参数，service.py:774 调用点同步传递。
  5. **UI 与 API**：
     - 后端 [`interface/task_models_api.py`](../apps/negentropy/src/negentropy/interface/task_models_api.py) 暴露 `/interface/task-models/{registry,settings,settings/{task_key}}` + `/knowledge/corpus/{id}/task-models/[task_key]` 双套端点；写端点要求 admin、强校验 task_key + model_type + scope 一致性。
     - 前端 [`/interface/task-models/page.tsx`](../apps/negentropy-ui/app/interface/task-models/page.tsx) 全局管理页 + [`ModelConfigPanel.tsx`](../apps/negentropy-ui/app/knowledge/graph/_components/ModelConfigPanel.tsx) 内嵌 corpus 级 task-models 折叠区块；新组件 [`TaskModelSelect.tsx`](../apps/negentropy-ui/components/interface/TaskModelSelect.tsx) 处理 id ↔ vendor/model_name 双向映射，避免破坏复用组件 [`LlmModelSelect.tsx`](../apps/negentropy-ui/components/ui/LlmModelSelect.tsx) 的现有契约。
- **验证证据**：
  - 静态：`uv run ruff check` 与 `pnpm exec tsc --noEmit` 双线通过；
  - 单元：新增 17 个用例（`tests/unit_tests/config/test_task_registry.py` 7 项、`tests/unit_tests/config/test_model_resolver_task.py` 5 项、`tests/unit_tests/interface/test_task_models_api.py` 5 项）100% 通过；
  - 回归：`tests/unit_tests/` 1634 通过 / 1 deselected（`test_extraction_llm_plan.py::test_build_llm_invocation_plan_returns_none_when_serialization_fails` 在 master 即失败，与本次修复无关，已 `git stash` 比对验证）；
  - 调试观测：resolver 命中后输出结构化日志 `task_model_resolved {task_key, corpus_id, resolved_model, source ∈ {corpus_task, global_task, default}}`，可用于线上链路核对。
  - **未完成项（透明披露）**：浏览器实机回归遵循 [browser-validation 协议](./agents/browser-validation.md) 需用户在 Chrome 主 profile + 真实凭证操作；本次未在 agent 内执行实机验证——所有路径由单元测试 + 静态检查覆盖。
- **后续防范**：
  1. **"调用点新增 LLM 操作 → 同步登记 task_key"契约**：任何新增后台 LLM/Embedding 调用点必须先在 [`task_registry.py`](../apps/negentropy/src/negentropy/config/task_registry.py) 注册槽位，再通过 `resolve_*_for_task` 解析。Code review 时检查"裸调 `resolve_llm_config()` 或 `litellm.acompletion(model="…")`"作为 red flag。
  2. **缓存命名空间隔离**：新增 resolver 时务必使用独立 cache key 前缀（`task:` / `subagent:` / `llm:<id>` 等已建立），写操作匹配的 `invalidate_cache(prefix=...)` 必须同步覆盖；不可与全局 `llm` / `embedding` 缓存共用键。
  3. **Migration 兼容**：`task_model_settings` 缺行 = 回退默认链路，与现状等价；启用前先合并代码 + migration，部署后再 opt-in 即可，避免破坏性变更。
- **同类问题影响**：
  - 同型"硬编码模型 / 全局唯一默认"模式在 [`knowledge/retrieval/reranking.py:95`](../apps/negentropy/src/negentropy/knowledge/retrieval/reranking.py) 与 `:217` 的 Reranker 中仍存在（BAAI/bge-reranker-v2-m3、Cohere `rerank-english-v3.0`）；用户本期决策不纳入治理范围，后续可复用同一 task_model_settings 表扩展 `reranker.local` / `reranker.api` 两个槽位；
  - Memory Consolidation pipeline 中 `dedup_merge` / `auto_link` / `topic_cluster` 三个 step 当前为规则/嵌入驱动，未来若引入 LLM 评判，须在 task_registry 增量补充并接入 `resolve_model_config_async`；
  - Embedding 模型当前由 `corpus.config.models.embedding_config_id` 覆盖主链路，本期未拆细粒度 embedding 任务槽；如未来 KG 子任务（实体 embedding / 关系 embedding）需要差异化 embedding 模型，可扩展 task_registry 增加 `embedding` 类型槽位。

---

## ISSUE-088 Home 左栏 Sessions 单击无法切换会话（Next.js 16 router.replace 在同 pathname 仅 query 变更下变 no-op）（2026-05-16）

- **表因**：Home 页 (`/`) 左栏 Sessions 列表中，左键单击会话条目无法完成切换：
  - URL 保持旧 `?sessionId=<old>` 不变；
  - 但 ChatStream / StateSnapshot / EventTimeline 全部被清空，主区显示"发送指令开始对话…"，State 显示 "No State Available"；
  - 顶部仍显示旧会话标题，造成"清空但未切换"的错位状态。
  - 三种触发方式（`mcp__chrome_devtools__click`、JS `element.click()`、手动 `dispatchEvent(mousedown→mouseup→click)`）均稳定复现。
- **根因**：[`apps/negentropy-ui/app/page.tsx`](../../apps/negentropy-ui/app/page.tsx) 的 `setSessionId` 与 [`apps/negentropy-ui/features/session/hooks/useSessionListService.ts`](../../apps/negentropy-ui/features/session/hooks/useSessionListService.ts) 的 `setSessionListView` 都依赖 `useRouter().replace(target, { scroll: false })` 写 URL。在 Next.js 16.2.3 dev 模式下，对"同 pathname、仅 query 变更"的目标，路由器实际调用：
  ```js
  history.replaceState(
    { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { ..., renderedSearch: "?sessionId=<new>" } },
    "",
    "/?sessionId=<old>",  // ← 第三参 URL 仍是旧值
  );
  ```
  `__NA: true`（Navigation Aborted/Not Applicable）+ 旧 URL 让浏览器 URL 完全不更新 → `useSearchParams()` 不重派生 → `sessionId` / `agent` / `activeSession` 维持旧值。与此同时 `handleSessionChange` 中 `clearSessionState()` 已同步清空 projection，造成"清空但未切换"错位。这是 Next.js 16 App Router RSC 导航判定路径的一个已知 regression（同源记录见 memory `feedback_router_replace_race.md`，但失败模式更严重——URL 完全不更新）。
- **处理方式**：
  1. **直写浏览器 history API，绕开 RSC 判定**：在以上两个入口将 `router.replace(target, { scroll: false })` 替换为 `window.history.replaceState(null, "", target)`。
  2. Next.js 14+ App Router 的 `useSearchParams` 会监听 `history.pushState` / `replaceState` 写入并触发派生重渲染（实机验证 OK），整条响应链（agent useMemo 重建、`loadSessionDetail` effect、ChatStream 渲染）恢复正常。
  3. 同步移除两文件中不再使用的 `useRouter` import 与 `useCallback` deps 中的 `router`；保留 `usePathname` / `useSearchParams` / `queryString` 派生稳定字符串 deps 模式（ISSUE-062）。
  4. 单测同步迁移：[`tests/unit/features/session/useSessionListService.test.ts`](../../apps/negentropy-ui/tests/unit/features/session/useSessionListService.test.ts) 取消 `routerReplace` mock，改 spy on `window.history.replaceState` + 从 `window.location.search` 派生 `useSearchParams`，覆盖 `setSessionListView('archived')` / `('active')` 两条路径。
- **后续防范**：
  1. **同 pathname + 仅 query 变更的 URL 更新一律走 `window.history.replaceState`**：避免再次踩到 Next.js RSC 判定的 NA no-op。涉及 pathname 跳转（`/`、`/interface`、`/admin` 等）的入口继续使用 `router.replace` / `router.push`，两者职责分明。
  2. **Code review 红线**：评审看到 `router.replace(somePath, { scroll: false })` 且 `somePath` 与当前 pathname 同源（仅 query 不同）时，明确要求改写为 `window.history.replaceState`。
  3. **实机验证为兜底底线**：本类 bug 的根因在 Next.js 路由层，vitest jsdom 环境覆盖不到——单测仅能保证"写 URL 这个动作发生"，是否"真的更新了 URL 并触发派生"必须在用户主 Chrome 实机验证（参见 [browser-validation 协议](./browser-validation.md)）；任何同型 URL-only 写入改动至少 ≥ 5 个正交场景实机回归。
  4. **故障时的错位提示**：`handleSessionChange` 仍是 `setSessionId → clearSessionState` 顺序。若未来再出现"清空但未切换"错位，说明 URL 写入又失败了——先验证 URL 是否真的更新，而不是去调换清理顺序（调换清理顺序无法解决根本问题，只会改变错位的外观）。
- **同类问题影响**：
  - 本仓库其余 `router.replace` / `router.push` 调用（`app/admin/layout.tsx`、`app/interface/layout.tsx`、`app/interface/task-models/page.tsx`、`app/interface/models/page.tsx`、`app/knowledge/documents/page.tsx`）均为 pathname 级跳转，不在 bug 影响面，保持不变。
  - 未来若在 Knowledge / Memory / Interface 页加入"仅 query 切换 tab/filter"的入口（如 `?tab=...` / `?filter=...`），需直接采用 `window.history.replaceState` 模式而非 `router.replace`。
  - 与 [ISSUE-061](#issue-061) / [ISSUE-062](#issue-062) / [ISSUE-066](#issue-066) 一起构成 Next.js App Router URL 单源派生模式下的四件套：URL 派生（061 v2-D）、稳定 deps（062）、router.replace 异步延迟下的 pending auto-send（066）、router.replace 同 pathname no-op 绕道（本期 088）。后续接入新 URL-派生场景时，应同步审视这四件套是否完整。

---

## ISSUE-089 `builtin_tools.visibility` ORM Enum 与迁移 VARCHAR 漂移致 `/interface/tools` 与 `/interface/stats` 500（2026-05-18）

- **表因**：服务端日志（开发本机与开发环境同步复现）`uvicorn.error` 反复抛出 `Exception in ASGI application`，根因是 SQLAlchemy 抛 `ProgrammingError`：
  ```
  asyncpg.exceptions.UndefinedFunctionError: operator does not exist:
    character varying = negentropy.pluginvisibility
  HINT: No operator matches the given name and argument types.
  [parameters: ('google:106729725448726600925', 'PUBLIC', 'builtin_tool', 'google:...')]
  SQL: ... WHERE negentropy.builtin_tools.visibility = $2::negentropy.pluginvisibility ...
  ```
  两个端点 500：`GET /interface/tools`（[`api.list_builtin_tools`](../../apps/negentropy/src/negentropy/interface/api.py)）与 `GET /interface/stats`（[`api.get_stats`](../../apps/negentropy/src/negentropy/interface/api.py)），同一链路都经过 [`permissions.get_visible_plugin_ids`](../../apps/negentropy/src/negentropy/interface/permissions.py) 的 `model.visibility == PluginVisibility.PUBLIC` 子查询。
- **根因**：
  1. PG 枚举 `negentropy.pluginvisibility` 在 [`0001_init_schema.py:196`](../../apps/negentropy/src/negentropy/db/migrations/versions/0001_init_schema.py) 创建，成员 NAME 为大写 `PRIVATE/SHARED/PUBLIC`。`mcp_servers/skills/sub_agents` 三类 plugin 均沿此模板建表。
  2. [`0031_builtin_tools.py:82`](../../apps/negentropy/src/negentropy/db/migrations/versions/0031_builtin_tools.py) 偏离模板，把 `builtin_tools.visibility` 建为 `VARCHAR(20) NOT NULL DEFAULT 'private'`，并以小写字面量 `'public'` 种子化 `google_search` 行（line 127）。
  3. ORM 模型 [`builtin_tool.py:30-34`](../../apps/negentropy/src/negentropy/models/builtin_tool.py) 沿用 `Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA)`，SQLAlchemy 据此生成 `WHERE visibility = $N::negentropy.pluginvisibility` 的显式 cast，绑定值用枚举成员 NAME（大写 `'PUBLIC'`）。
  4. PG 无 `varchar = pluginvisibility` 操作符，对 VARCHAR 列做 enum cast 直接报 `UndefinedFunctionError`。
- **处理方式**：
  1. 新增前向迁移 [`0036_builtin_tools_visibility_enum.py`](../../apps/negentropy/src/negentropy/db/migrations/versions/0036_builtin_tools_visibility_enum.py) 三步走：
     1. `UPDATE` 把 `LOWER(visibility::text) ∈ {'private','shared','public'}` 的行规范化为 enum 成员名（大写）；
     2. `DO $$ ... RAISE EXCEPTION ... $$` 防御性断言：若仍有非法值，明确抛错而非让 `ALTER TYPE` 报含糊的 cast 错误；
     3. `DROP DEFAULT` → `ALTER COLUMN visibility TYPE negentropy.pluginvisibility USING visibility::negentropy.pluginvisibility` → `SET DEFAULT 'PRIVATE'::negentropy.pluginvisibility`。
  2. **不修改 0031**：违反 forward-only 约定会破坏既有部署的 stairway 测试，且 0036 已在数据规范化阶段覆盖 0031 的小写遗留。
  3. `downgrade()` 同样三步反向，`USING visibility::text` 中转回 `VARCHAR(20)`、恢复 `DEFAULT 'private'`，与 [ISSUE-012](#issue-012)「枚举列上 text-only 操作必须经 `::text` cast」对齐。
  4. 新增 integration 测试 [`tests/integration_tests/interface/test_get_visible_plugin_ids.py`](../../apps/negentropy/tests/integration_tests/interface/test_get_visible_plugin_ids.py) 守护真实 PG round-trip：参数化覆盖 4 类 plugin（`builtin_tool/mcp_server/skill/sub_agent`），断言 own + PUBLIC + SHARED（PluginPermission 授权） + is_system 的并集语义全部生效，他人 PRIVATE 不可见；并补一个直接的「`builtin_tool` PUBLIC 子查询不抛 ProgrammingError」回归点位。
- **后续防范**：
  1. **新增 plugin 表的强制模板**：任何新表若有 `visibility` 列，必须复用 `Enum(PluginVisibility, schema=NEGENTROPY_SCHEMA)`（ORM）+ `sa.Enum("PRIVATE", "SHARED", "PUBLIC", name="pluginvisibility", schema="negentropy")`（迁移），与 0001 的 `mcp_servers/skills/sub_agents` 三处保持对称；review 时若发现 `visibility VARCHAR` 直接打回。
  2. **ORM ↔ 迁移漂移的代价是「类型层 SQL 错误」**：与字段名漂移（[ISSUE-010](#issue-010)）、属性懒加载漂移（[ISSUE-016](#issue-016) 三阶）同属「写入侧契约与读取侧契约错位」家族。Review 红线：所有 `mapped_column(Enum(...))` 的 PR 必须对照同表 `CREATE TABLE` / 后续 `ALTER COLUMN` 迁移是否落地为对应 PG enum 类型。
  3. **真实 PG round-trip 测试是底线**：单元测试只能验证纯函数语义，类似 `get_visible_plugin_ids` 这种「ORM 表达式 → PG 执行」路径必须有 integration 用例覆盖；本期补的参数化用例可作为下次新增 plugin 表时的「填空」模板。
- **同类问题影响**：
  - 与 [ISSUE-012](#issue-012)（枚举列上 `LOWER`/`UPPER` 必须 `::text` cast）同源——本期是「读侧 cast 失败」，012 是「迁移侧 cast 失败」，两者共同提示「PG 枚举列与 text 之间的所有交互都需要显式 cast，且 ORM 侧声明类型必须与 DB 真实列类型严格一致」。
  - 已确认本仓库其他 plugin 表（`mcp_servers/skills/sub_agents`）的 `visibility` 列与 ORM 声明一致，无同型漂移。任何未来新增 plugin 类型（如假想中的 `prompt_template`/`workflow`）必须按上文「新增 plugin 表的强制模板」实施。

---

## ISSUE-090 Memory/Activity 子页与 Memory 领域语义错位（2026-05-19）

- **表因**：`/memory/activity` 子页位于 Memory 二级导航，但承载的是「平台 Toast 通知历史」（localStorage 数据源、跨模块写入），Memory 上下文用户找不到自己的活动记录而误以为功能丢失；Memory 二级导航 7 个 tab 又显得过载。
- **根因**：
  1. **领域归属错置**：`useActivityLog` / `ActivityEntry` 类型曾通过 `features/memory/index.ts` re-export，让活动日志看起来像 Memory 子领域；但实际 `lib/activity-toast.ts` 在全平台所有 toast 调用处写入，与 Memory 数据无任何耦合，违反 **正交分解** 与 **Single Source of Truth**；
  2. **导航语义错位**：MemoryNav 7 个 tab 中 6 个均围绕 user/semantic memory 操作，唯独 Activity 是平台级日志，认知一致性被打破。
- **处理方式**：
  1. 将 `useActivityLog` 上移至 `apps/negentropy-ui/hooks/useActivityLog.ts`（与 `useSubAgentsList` / `useHeartbeatPoll` 等平台级 hook 同级），末尾 re-export `ActivityEntry`/`ActivityLevel` 类型供单点 import；
  2. 在 `app/(home)/dashboard/_components/` 新建 `ActivityLogPanel.tsx`，复用 `ExecutionTimeline` 卡片视觉范式（`rounded-lg border border-border bg-card shadow-sm` + uppercase tracking-wider 头部 + `max-h-[480px] overflow-auto`），并在 `dashboard/page.tsx` 主网格之后追加整宽嵌入；
  3. **拒绝合并为 Tab 容器**（Executions ⇄ Activity）：后端调度执行流（SSE）与前端 Toast 历史（localStorage）数据源、生命周期、消费者均正交，不应耦合进单一容器；
  4. 删除 `app/memory/activity/page.tsx`、`features/memory/hooks/useActivityLog.ts`，清理 `features/memory/index.ts` barrel 的对应 re-export；
  5. `components/ui/MemoryNav.tsx` 移除 Activity NAV_ITEM；e2e 测试从 `tests/e2e/memory/activity.spec.ts` 迁移到 `tests/e2e/dashboard/dashboard-activity.spec.ts`，通过 `data-testid="activity-log-panel"` 缩域避免与 `ExecutionTimeline` 选择器冲突；
  6. `memory-pages.spec.ts` 中 「7 个页面标签」断言降为 6 个；`docs/concepts/user-guide/memory-basics.md`（迁移后路径，原 `docs/memory/user-guide/basics.md`）同步表格 + 加迁移说明。
- **后续防范**：
  1. **以"数据源 + 写入触发面"判定模块归属**，而非以"看起来像什么"：凡是 `lib/*` 单例存储 + 跨模块写入的状态，hook 应栖息在 `apps/negentropy-ui/hooks/` 顶级，而非任何 `features/<domain>/` 子目录；
  2. **二级导航 tab 列表必须保持单一概念主体**：新增 tab 前先核对其数据源与同级其它 tab 是否同源（同领域 / 同生命周期 / 同写入面）；
  3. **`features/<domain>/index.ts` barrel 不允许 re-export 非领域类型**——本期被 re-export 的 `ActivityEntry`/`ActivityLevel` 直接来自 `lib/activity-store`，从未在 Memory 领域被消费过，纯属语义污染。
- **同类问题影响**：
  - 检视其它 `features/*/index.ts` barrel：凡 `export type { ... } from "@/lib/..."` 形态的 re-export 均需用本期同款判定标准复核（是否真的属于该领域）；
  - 二级导航过载的子页（`/memory` 系 7 → 6、`/interface` 系、`/knowledge` 系）若有类似「平台级面板栖息在领域 tab 下」的错位，应统一上提到 Home / Dashboard 整体快照。

---

## ISSUE-091 `agent_inspection.scheduled_tasks_summary` 自巡检永久失败：SQLAlchemy 重复 `func.coalesce(col, literal)` 触发 PG `GroupingError`（2026-05-19）

- **表因**：服务端日志 `engine.schedulers.registry` 每次心跳都抛 `asyncpg.exceptions.GroupingError: column "scheduled_tasks.last_status" must appear in the GROUP BY clause or be used in an aggregate function`，调用栈定位到 [`engine/schedulers/handlers/agent_inspection.py:_scheduled_tasks_summary`](../../apps/negentropy/src/negentropy/engine/schedulers/handlers/agent_inspection.py)；自巡检 `scheduled_tasks_summary` 任务永久失败，`consecutive_failures` 累积进入退避窗口，Dashboard 顶部「全员失败」系统告警链路自身瘫痪。
  ```
  [SQL: SELECT coalesce(scheduled_tasks.last_status, $1::VARCHAR) AS status,
               count(scheduled_tasks.id) AS count
         FROM scheduled_tasks
         WHERE scheduled_tasks.enabled IS true
         GROUP BY coalesce(scheduled_tasks.last_status, $2::VARCHAR)]
  [parameters: ('none', 'none')]
  ```
- **根因**：原查询在 SELECT 与 GROUP BY 各调用了一次 `func.coalesce(ScheduledTask.last_status, "none")`，SQLAlchemy 为两个相同的 Python 字面量 `"none"` 生成独立 `BindParameter`，编译后变成 `$1` / `$2`。PostgreSQL 在校验 GROUP BY 时按 **AST 等价**（含 BindParameter 序号）判断 SELECT 非聚合表达式是否在 GROUP BY 子句中——`coalesce(col, $1)` 与 `coalesce(col, $2)` 在它眼里不是同一表达式，遂判 `last_status` 列「未分组、又非聚合」并拒绝执行。即便复用同一 Python `func.coalesce(...)` 对象，select() 编译阶段的子句克隆仍可能拆出新 bind，此模式属于 SQLAlchemy + 严格 PG 的经典陷阱。
- **处理方式**：
  1. 把「NULL → `"none"`」归一化**从 SQL 层下沉到 Python 层**——SELECT/GROUP BY 直接用 `ScheduledTask.last_status` 列对象（PG 允许 NULL 作为独立分组键），dict comprehension 一次性归一化键名，下游 `metrics.distribution` 键集合与原行为完全等价；
  2. 在 [`tests/unit_tests/engine/test_scheduler_handlers.py`](../../apps/negentropy/tests/unit_tests/engine/test_scheduler_handlers.py) 新增 `TestScheduledTasksSummary` 6 个用例：全 ok / 含 NULL 行 / failed>50% / 空表 / total<2 防误报，并加 **SQL 回归守门用例**——`compile(literal_binds=True)` 后断言查询不再出现 `coalesce`，防再次踩坑。
- **后续防范**：
  1. **严禁在同一 statement 的 SELECT + GROUP BY 中重复出现 `func.coalesce(col, literal_value)`**（即便复用同一 expression 对象也存在 bind 拆分风险）；同类 SQL 端归一化（`coalesce` / `case when ... then literal`）只能在 GROUP BY **或** SELECT 任一侧出现一次，另一侧用别名 / 序号 / 原列引用；
  2. **优先在 Python 层做 NULL 归一化**——对于结果集行数有限（与 distinct group 数同阶）的聚合查询，Python 端 `if x is not None else default` 比 SQL 层 `coalesce` 更稳健、可读、可测；
  3. **自巡检模块自身必须有单测覆盖**——`agent_inspection.scheduled_tasks_summary` 这类「监控其他任务健康度」的 handler 一旦失败，告警链路就会反向静默；review 中若发现「handler 函数无对应 Test 类」一律打回；
  4. 类似的「SQL 翻译产物与原 Python 表达式不等价」陷阱与 [ISSUE-012](#issue-012)（枚举列上的 `LOWER` 需 `::text` cast）、[ISSUE-089](#issue-089)（ORM Enum 与列类型漂移）同属「SQL 编译期细节悄悄改写语义」家族——核心律：任何含 literal 的复杂表达式跨多个子句出现时，必须用 `compile(literal_binds=True)` 打印实际 SQL 验证。
- **同类问题影响**：
  - 搜索 `func.coalesce` 配合 `group_by` 的全仓库使用，**仅 `_scheduled_tasks_summary` 一处命中**，本次已修复；
  - 类似模式（`func.case` / `cast` 在 SELECT + GROUP BY 重复出现）需 review 时主动核对：本期未发现，但作为未来 review 红线纳入；
  - 调度框架退避窗口策略本身正常：本次失败任务在修复后第一个心跳成功时 `consecutive_failures` 由 Registry 清零，无需手工 reset。

---

## ISSUE-092 Perceives Security Audit 因 PYSEC 数据库增补 21 条新告警致 pip-audit 退出 1（2026-05-20）

- **表因**：[`negentropy-perceives-ci.yml`](../../.github/workflows/negentropy-perceives-ci.yml) 的 `security` job 在 PR #594（仅改动 `.github/actions/setup-python-uv/**`）触发的运行中失败；`uv run pip-audit` 列出 22 条已知漏洞（joblib 1, pyjwt 1, torch 11, transformers 8 + 既有 `CVE-2026-1839`），其中仅 1 条命中现有 `--ignore-vuln`，剩余 21 条令 pip-audit 退出码 1。
- **根因**：PYSEC 数据库自上次成功审计后追加 21 条新条目——
  - **joblib `PYSEC-2024-277`** / **pyjwt `PYSEC-2025-183`**：均为 supplier disputed，upstream 无 fix；
  - **torch 2.10.0 `PYSEC-2025-189..197` / `PYSEC-2025-210` / `PYSEC-2026-139`**：本地内存破坏 / DoS / pt2 反序列化，需攻击者构造恶意 tensor 或 `.pt2`，upstream 暂无 fix；
  - **transformers 4.57.6 `PYSEC-2025-211..218`**：`convert_config` / checkpoint 转换路径 RCE，且 transformers 受 `marker-pdf` / `docling` 兼容交集制约硬锁 `<5.0.0`，4.x 无后向 patch。
  本项目威胁模型为：仅加载第一方已转换模型 artifact，不调用 transformers 转换工具链，亦无加载不可信 `.pt2` / `.joblib` 缓存的路径——21 条全部不适用。
- **处理方式**：
  1. 在 [`negentropy-perceives-ci.yml`](../../.github/workflows/negentropy-perceives-ci.yml) 把扁平 `--ignore-vuln` 链改为 **bash 数组字面量**（`ignore_args=( … )` + `"${ignore_args[@]}"`），每条按包分组、追加中文威胁模型注释，避免反斜杠续行下 inline 注释失效；
  2. 追加 21 条新 PYSEC ID（含 dispute / upstream-无-fix / upstream-fix-但被硬锁三类），保留既有 8 条 CVE/GHSA 条目；
  3. 本地用 Homebrew `python3.13 -m venv` + `pip-audit==2.10.0` 重现：迷你 requirements (joblib/pyjwt/torch/transformers 四列) 命中相同 22 条，套用本次新数组后输出 `No known vulnerabilities found, 22 ignored`，`exit=0`。
- **后续防范**：
  1. **`--ignore-vuln` 是「降噪」而非「免疫」**：每条 ignore 必须随附「包-版本-威胁模型-是否有 upstream fix」四元注释，便于季度 review 时识别可移除项；
  2. **威胁模型门槛优先于「等 upstream fix」**：本项目所有新增 ignore 条目都被压在「需要不可信输入路径」假设上——一旦未来引入用户上传 `.joblib` 缓存 / `.pt2` artifact 的功能，该假设破裂，需立即升级或拆出独立审计；
  3. **bash 数组优于反斜杠续行链**：多元素 CLI 列表场景（pip-audit/ruff/pytest 长 flag 列）一律走数组字面量，原生支持 `#` 注释与空行，无需依赖 `` `# foo` `` 反引号「假注释」trick；
  4. **CI 触发面识别**：`paths` 过滤包含 `.github/actions/setup-python-uv/**` 的 workflow 会被本仓库根级 action 变更牵连——后续修改 composite action 需预判其牵涉的所有 workflow。
- **同类问题影响**：
  - 其它 app（`cognizes` / `negentropy` 主仓）若引入 `pip-audit` 步骤，应直接复用本数组式模板；
  - 周期性的 PYSEC 数据库增补会让任何使用 `pip-audit` 且依赖锁定到老旧 ML 套件（torch / transformers / numpy / scipy 等）的项目出现同类「无 fix 可升、必须 ignore」局面，须按本案的「威胁模型 + 锁版本约束」双轴评估，而非盲目跟随 CVSS 分数升级；
  - 现有 8 条历史 ignore（pygments / fastmcp / litellm）已不在本次失败报告里，下次例行升级时应核对其匹配性，避免 ignore 列表演变为僵化白名单。

---

## ISSUE-093 Studio 左栏 Session 列表新增 Delete 选项与硬删除链路（2026-05-21）

- **表因**：用户希望在 Studio 页（`/studio`，根路径 `/` 重定向至此）左栏 `SessionList` 中提供一个 **Delete** 选项，把已归档或不再需要的会话**永久清理**。现有交互只有 Archive（active 视图归档）/ Unarchive（archived 视图恢复）/ 双击重命名，已归档会话无法在 UI 上彻底清除。
- **根因**：
  1. 后端 `apps/negentropy/src/negentropy/engine/adapters/postgres/session_service.py` 的 `delete_session()` 被有意重写为 `archive_session(archived=True)` 以维持 ADK 基类兼容契约——这是产品级"保护数据"决策，**不能**直接改回硬删除；
  2. 因此后端**缺失**真硬删除入口（无 `DELETE` 路由、无独立 service 方法）；
  3. 前端 `SessionList.tsx` 没有 `onDelete` prop，`useSessionListService` 没有 `deleteSession` 方法，BFF 转发层（`[sessionId]/route.ts`）只有 GET。
- **处理方式**：
  1. **后端**：在 `PostgresSessionService` 新增独立的 `hard_delete_session()`，直接 `DELETE FROM threads`（`Event.thread_id` 已声明 `ondelete="CASCADE"`，关联 events 由 PostgreSQL 级联自动清理）；保留 `delete_session()` 现有的归档行为不变，避免破坏 ADK 兼容契约；在 `sessions_api.py` 新增 **`@router.post("/apps/{app}/users/{user}/sessions/{id}/delete")`** 路由（**实机回归阶段发现 ADK 路由冲突**：初版使用 `@router.delete(...)`，但 ADK Web Server 已在 `DELETE /apps/.../sessions/{id}` 上注册自己的处理器，FastAPI 路由匹配先命中 ADK 版调用被重写为"归档"的 `delete_session`，让我们的硬删除路由形同虚设——curl 验证返回 `200 + null` 而非预期的 `200 + {status: ok}` 或 `404`。改走 `POST .../delete` 路径既绕开冲突，又与同模块 `archive`/`unarchive` 风格一致），调 `hard_delete_session()`，未命中返回 404；**review 补丁**：路由外层显式 `try/except ValueError` 抛 `HTTP_400_BAD_REQUEST`，与同模块 `_update_archive_state` 行为对齐，避免非 UUID 入参回落到 FastAPI 默认 500。新增集成测试覆盖：存在→True / 不存在→False / 已归档也可硬删 / events 级联清理 / 非 UUID 入参 → `ValueError`（5 个用例）。
  2. **前端**：在 `lib/agui/session-schema.ts` 新增 `aguiSessionDeleteResponseSchema`；`_request.ts` 新增 `buildSessionDeleteUpstreamUrl()`（路径含 `/delete` 后缀）；新建独立的 `app/api/agui/sessions/[sessionId]/delete/route.ts` 转发 `POST`（与 archive/unarchive 同构，body 承载 `app_name`/`user_id`）；`useSessionListService.ts` 新增 `deleteSession(id)`，采用与 archiveSession 同构的乐观更新 + 选中切换 + 日志范式；`SessionList.tsx` 新增 `onDelete` prop 与 `Trash2` 红色按钮（active + archived 两个视图都显示），ConfirmDialog 文案明确强调"永久删除……不可恢复"，cancel autoFocus 防误触；`home-body.tsx` 注入 `onDelete={deleteSession}`。
  3. **修复同期发现的 race**：archive/unarchive 现有范式中"在 `setSessions((prev) => { nextActiveId = prev[0]?.id ?? null; ... })` 回调内赋值闭包变量、紧随其后读它"在 React 18+ 的 lazy reducer 调度路径下会读到 `null`（已在 vitest 用例中复现）。`deleteSession` 改用同步预计算：直接读 `sessions` 闭包值 → 过滤 → 算 `nextActiveId` → 再 dispatch `setSessions(remaining)`，把 `sessions` 加入 useCallback 依赖。
  4. **实机回归证据**（cancun-v1 工作区独立栈，后端 3293 + UI 3193）：创建测试 session → DB 写入确认 → 通过 cancun-v1 BFF `POST /api/agui/sessions/{id}/delete` 返回 `HTTP 200 + {"status":"ok"}` → DB 中该行 `remaining=0`，端到端链路（BFF transport → POST /delete 后端路由 → hard_delete_session() → DELETE FROM threads SQL → events 级联清理）全通。删除不存在的 session 通过 BFF 返回 `502 AGUI_UPSTREAM_ERROR`（透传上游 404），与 archive/unarchive 既有错误包装行为一致。
- **后续防范**：
  1. **"破坏性 UI 操作"必须满足三层防御**：(a) destructive 红色按钮 + cancel autoFocus（视觉与默认焦点）；(b) ConfirmDialog 文案明确写"不可恢复"并陈述清理范围；(c) 后端 service 与 ADK 标准接口解耦命名（`hard_delete_session` ≠ `delete_session`），避免后续重构悄然回退；
  2. **`setState((prev) => { 闭包外赋值; return next; })` 是反模式**：若 dispatch 后立即需读取赋值结果，应同步预计算或将相应状态加入 useCallback 依赖。React 18+ reducer 并非紧跟 dispatch 同步执行，存在 lazy 评估路径；archive/unarchive 现有代码同样有此潜在 race，可在未来按本次修复范式重构；
  3. **后端 ADK 兼容接口**（`delete_session` / `update_session` / `list_sessions` 等）若要新增正交语义，须新增独立方法 + 路由，禁止覆盖基类约定；
  4. **events 表级联**：`Event.thread_id` 的 `ondelete="CASCADE"` 是本次硬删除可行的前提；新增涉及 `threads` 表的硬删除调用前必须确认这一前提仍成立；
  5. **ADK 路由抢占检查**：凡是新增 `apps/{app}/users/{user}/sessions/{id}/...` 或 `apps/{app}/users/{user}/sessions` 下的路由，须先确认 ADK Web Server 是否在同路径同 method 上已注册——可通过 `curl` 真实请求验证（200 + 非预期 body 即说明被 ADK 抢占）；若冲突，优先在路径加业务后缀（如 `.../delete`、`.../archive`）改走 POST，而非企图覆盖 ADK 注册。单测无法发现这类冲突（只能在真实 FastAPI app 装配的运行时复现），属于"集成 / 实机回归不可替代"的典型场景。
- **同类问题影响**：
  - 其他模块（Skills、Knowledge Documents、Wiki Publications 等）若已有"软删/归档"语义而后续要新增"永久清理"入口，应直接复用本案范式：独立 Service 方法 + 独立 HTTP 动词路由 + UI 二次确认 + 同测试范式；
  - 全仓库 `setState((prev) => { 闭包赋值 })` 范式可借此机会做一轮 review（grep `let \w+: .*?\| null = null;\s*setSessions`），按需重构。

---

## ISSUE-094 PDF → Markdown 学术论文 1:1 还原：图片宽高丢失 / 公式静默丢弃 / 首页双栏误判（2026-05-25）

- **表因**：Knowledge Base → "Harness Engineering" Corpus → Documents View 渲染学术论文（Context Engineering 2.0 PDF）时三类失真：
  1. ASI / GAIR 小 logo 被放大到接近全宽，Figure 1 也呈现压扁，所有图均无显示尺寸；
  2. 论文「Theoretical Framework」章节有 7 条编号块公式，最终 Markdown 仅含 2 条 `$$..$$`；
  3. 首页 `## Abstract` 标题被错排到 Abstract 正文与 Figure 1 之后，作者署名 / Github / SII Context badges 也散乱于其间。
- **根因**（三处独立根因，碰巧叠加于同一回归现场）：
  1. **图片宽高链路断裂**：`apps/negentropy-perceives/src/.../pipeline/stages/pdf/assembly.py` 的 `_image_to_markdown()` 历史实现只发 `![alt](path)`，丢弃 `ExtractedImage.width`/`height`；`MarkdownFormatter._restore_image_placeholders()` 又仅服务于 HTML→Markdown 链路（依赖 sentinel registry），PDF 链路完全旁路。即使加上宽高，下游 negentropy 主应用 `apps/negentropy/src/.../knowledge/ingestion/extraction.py:_rewrite_markdown_image_links` 又只匹配 Markdown `![]()` 形式，把 HTML `<img>` 的相对路径漏改写，致前端 404。
  2. **MinerU v3.x content_list.json schema 错位**：`apps/negentropy-perceives/src/.../pdf/engines/mineru.py::_extract_formulas` 用 `item.get("latex")` / `page_no` / `format` 取字段，而 MinerU v3.x 实际写入 `text`（已含 `$$..$$` 包裹）/ `text_format`（"latex"）/ `page_idx` / `bbox`。Strategy 1 因此返回空，仅靠 Strategy 2（markdown 正则）兜底；后者无 bbox/page_number，公式被丢给 `_orphan_block_formulas` 做文本匹配，命中率低至 2/7。同时 `formula_extraction.py` 中 MinerU 工具的 `ExtractedFormula(...)` 构造也漏传 `bbox=`，结构化公式失去定位锚点。
  3. **首页双栏误判**：`assembly.py` 几何 gap 检测把页 0 的 18 个元素（两侧装饰 logo + 居中正文）判为双栏：max_gap=94.88pt 略超 max(x_range*0.25, 80)=91pt，split_x≈215。所有 ≥255pt 的正文段落走"全宽"判定到 col 0，而 affiliation / badges / Abstract heading（width 45） / Figure 1 Y 轴标签等**装饰性短元素**被分到 col 1。排序 `(page, col, y0, x0, reading_order)` 把 col 1 整批挪到 col 0 之后，Abstract H2 因此与其 body 段被拆散，错排到 Figure 1 下方。
- **处理方式**：
  1. **图片宽高（Fix #1）**：`assembly.py::_image_to_markdown` 改输出 HTML `<img src alt width height style="max-width:100%;height:auto;" />`，宽高优先取 `image.bbox`（PDF 点坐标，即原版视觉显示尺寸），bbox 缺失时退化到 `image.width/height` 像素分辨率，全空降级 Markdown；同时把 `_dd` 去重逻辑里的 alt 文本提取扩展为同时支持 `![]()` 与 `<img alt="...">`。`extraction.py` 增 `_HTML_IMG_SRC_RE` 与 `_iter_image_src_matches()`，让 `_extract_markdown_image_refs` 与 `_rewrite_markdown_image_links` 两侧同时覆盖两种语法，避免 HTML img 的相对路径漏改写。新增 `tests/unit/test_assembly_helpers.py::TestImageToMarkdown`（6 用例）锁定 bbox 优先 / 像素退化 / 极端降级 / HTML 转义 / 异常 bbox / caption-as-alt 契约；`tests/unit_tests/knowledge/test_extraction_image_assets.py` 增 4 用例覆盖 HTML img 提取与重写。
  2. **MinerU v3.x 公式（Fix #2）**：`mineru.py` 给 `MinerUFormula` 加 `bbox` 字段；`_extract_formulas` Strategy 1 改读 `text` / `text_format` / `page_idx` / `bbox`，并剥离 `text` 字段开头的 `$$..$$` 或 `$..$` 包裹得到纯 LaTeX；同时把剥离后的纯 LaTeX 写入 `seen_latex`，与 Strategy 2 的 markdown 正则提取（同样是纯 LaTeX）实现互通去重。`formula_extraction.py` 的 MinerU wrapper 补 `bbox=getattr(f, "bbox", None)` 透传到 `ExtractedFormula`。`tests/unit/test_mineru_engine.py::TestMinerUStructuredExtraction` 增 2 用例：v3.x text/text_format/page_idx/bbox schema 全字段断言、以及 Strategy 1 与 Strategy 2 互通去重断言。
  3. **首页双栏误判（Fix #3）**：`assembly.py` 双栏检测在原"max_gap > max(0.25*x_range, 80)"几何阈值之上增加稳健性二次校验——要求每列至少含 **3 个宽度 ≥100pt 且非跨栏（width ≤ 0.7*x_range）** 的"实质性元素"，否则强制降级单列。该校验对真正双栏 ACM/IEEE 论文（每列 10+ 段正文）零影响，但能让"首页 / 报告封面"这类"装饰性元素散落 + 中央单栏正文"场景正确归一。
- **可观测验证**：连续 5 次浏览器实机回归（chrome_devtools 接入用户主 Chrome），三次 refresh_markdown：
  - **v3（image fix）**：37/37 张图 HTML `<img>` + width/height；图片显示尺寸符合 PDF 视觉比例（ASI logo 35×27 px、Figure 1 406×199 px）。
  - **v4（column fix）**：开启临时 `NE_DEBUG_ASSEMBLY_P0=1` env 调试日志，确认页 0 全部 18 个元素归到 col=0；markdown 顺序：logos → Title → Authors → Affiliation → Badges → Quote → **Abstract H2 → Abstract body** → Figure 1 → labels → caption → footnote，与 PDF 视觉一致。调试日志在诊断结束后已从代码中移除。
  - **v5（formula fix）**：block formulas 从 2 → 6（与 content_list.json 的 7 条相比 86% 完整，剩 1 条 165 char 长式因 `_sanitize_latex` 或 fingerprint dedup 未入栈，待后续二次抛光）；KaTeX 在 UI 端正常渲染 `Char: E → P(F)\tag{1}` 等公式。
- **后续防范**：
  1. **工具版本 schema 漂移监测**：MinerU / Docling / Marker 等深度学习引擎升大版本时（如 v2.x → v3.x）极可能悄然改 content list 字段名。新增"全字段断言"型单测（同时校验 `text`/`text_format`/`page_idx`/`bbox` 四字段被正确读取），比"length ≥ N"型断言更早暴露字段名错位类回归。
  2. **跨语法重写覆盖**：当一端切换图片输出形式（Markdown ↔ HTML），所有依赖该形式做正则匹配的下游链路（rewriter / dedup / ref extractor）必须同步扩展，并通过"混合语法 doc order 保序"型单测锁定。
  3. **几何启发式必须配上"含义校验"**：纯几何 gap / IoU / 比例阈值在装饰性元素与正文混杂的页面极易误判。增加"列含义校验"（substantial element count）这类语义层兜底，能在不影响真双栏召回的前提下显著降低首页/封面误判。
  4. **临时调试日志的纪律**：env-gated debug 块（如 `NE_DEBUG_ASSEMBLY_P0`）适合一次性根因定位，但**修复落地后必须移除**，避免在生产代码中长期留存"诊断脚手架"；同时把诊断中得到的核心数据（bbox + content preview）转化为回归用例的 fixture，让今后的同类问题不必再依赖临时探针。
  5. **`uv run pytest` 跨包验证**：本次同时改了 `apps/negentropy-perceives/` 与 `apps/negentropy/` 两个包，必须分别在两个包目录下 `uv run pytest` 验证，避免单包验证遗漏。
- **同类问题影响**：
  - 其他 PDF 元素提取（Tables / Code blocks / Footnotes / Captions）若也读取 MinerU content_list 字段，需同步审视 v3.x schema 兼容；
  - `_rewrite_markdown_image_links` / `_extract_markdown_image_refs` 的双语法覆盖思路可推广到任何"前后端约定的 Markdown 扩展语法"（如 footnote、KaTeX block、Mermaid block）的转换链路；
  - 几何分栏判断模式在长报告、产品 deck 类 PDF 上将持续出现误判，substantial-element 校验应作为通用启发式入库。

### 第二轮迭代（2026-05-25 补强）

继续对比 PDF 与 Markdown 后定位 3 处额外根因，承接 ISSUE-094 主条目继续抛光：

- **长公式被 `_deduplicate_approximate_paragraphs` 误删（commit `61f2cf26`）**：``M_l = f_long(c ∈ C : w_importance > θ_l ∧ w_temporal ≤ θ_s)`` 长公式与同章节 ``M_s = f_short(...)`` 共享 ``M``/``f``/``c``/``\theta``/``\in`` 等大量令牌，``_normalize_paragraph_breaks`` 在 ``$$`` 与 LaTeX 之间插入空行后把数学块拆为 3 段，Jaccard 相似度比对致整段被误删。修复：``MarkdownFormatter`` 新增 ``_protect_math_blocks`` / ``_restore_math_blocks`` 范式（与 ``_protect_code_blocks`` 对称），format() 入口把 ``$$\n..\n$$`` 块替换为 ``%%MATHBLOCK_<uuid>%%`` 占位符，整个管线视其为原子单元，末尾 ``_cleanup_math_blocks`` 后统一还原；同步给 ``_deduplicate_approximate_paragraphs`` 内嵌 ``_is_math_block`` 防御性兜底。回归：公式 6/7 → 7/7。
- **公式视觉区"字符流文本"漏过滤（commit `d8c1d2a7`）**：``_block_overlaps_special`` 的几何检测（含 8pt bbox 膨胀）对"公式视觉区垂直之上 / 之下几十 pt 的字符流文本"覆盖不足；同时 ``_formula_eq_nums`` 仅识别 ``(N)`` 形式编号，遗漏 MinerU 输出的 ``\tag{N}`` 大括号形式。修复：``assembly`` 新增 ``_formula_text_signature`` 字符级扁平签名归一化（剥 LaTeX 命令 / 大括号 / 标点 / 空白 / Unicode 数学符号，仅留 ASCII 字母数字小写），以及 ``_text_block_matches_formula`` 语义层兜底；``_formula_eq_nums`` 同时收集 ``\tag{N}`` 编号。回归：``M l = f long (...)`` / ``M l = f short (...)`` / ``f transfer ...`` / ``e ∈E rel Char ( e ) (2)`` 等 4/5 字符流碎片清零，仅余 1 处极短 ``C = [``（5 字符，无 ``(N)``/无 Unicode 数学符号，无明确过滤信号）。
- **二轮防范要点补充**：
  1. **多层防御**：纯几何（bbox 膨胀）+ 字符级签名（跨形式等价）+ 符号锚定（``(N)`` / ``\tag{N}``）三层组合才能高召回过滤公式冗余文本，单一手段都有死角；
  2. **占位符保护范式可复用**：``_protect_*_blocks`` / ``_restore_*_blocks`` 模式可推广到任何"内部内容不应被任何 formatter 步骤修改"的块级元素（数学块、Mermaid 块、ASCII art 等）；
  3. **跨形式签名的最小启用长度**：字符级扁平签名 ≥20 字符是经验阈值，更低易在短公式（如 ``\alpha = 0``）上产生假阳性匹配，更高漏过中等长度公式；
  4. **临时调试 env-gated 探针**：``NE_DEBUG_FORMULA=1`` 可在二轮根因定位中快速暴露 7 公式如何在 ``add → join → format → final`` 各环节流转，确认是 ``format()`` 内部某步骤丢弃，比再加 print 高效得多。该探针修复落地后已移除。

### 第三轮迭代（2026-05-25 端到端质量回归：断字 / 公式漏检 / 标题误判 / TOC 错乱 / 图片孤儿）

第二轮收尾后切到 71 页双栏 LaTeX 论文 `50714_Agent_Harness_Engineerin.pdf` 做端到端基线回归，再次定位 5 类独立根因（与第一/二轮正交、可单独 cherry-pick）：

- **表因**：以 71 页双栏 LaTeX 论文为基准实测发现 5 类高发缺陷：跨行断字 218 处全部残留、`formula_extraction` Stage 被 selector 整段短路（71 页学术论文仅识别 0 个块级公式 / 2 个 inline）、作者署名 + Table N: caption 被 PyMuPDF 文本块识别为 H4 大字号 heading 污染目录、docling 提取的目录页 (TOC) 表格列对齐错乱（首行 `| 1 | 1 | 1 |` 而非 `| 1 | Introduction | … | 4 |`）、矢量图渲染落盘但 markdown 末段被 caption/IoU 去重链路误删导致"图片孤儿"（disk vs markdown_refs 不一致）。
- **根因**：
  1. **断字**：`markdown/formatter.py::_typography_inner` 无 `[a-z]- [a-z]` 合并规则，PyMuPDF 跨行 `word-\nword` 被 assembly 折行为 `word- word` 后无处复合；
  2. **公式漏检**：`pipeline/stages/pdf/quick_scan.py::FitzQuickScanner._run` 固定扫描前 10 页（`scan_pages = min(10, end_page - start_page)`），而该 PDF math font span 集中在 page 16/18/47/62，前 10 页一无所获 → `has_formulas=False` → ProfileAwareSelector 短路 `formula_extraction` 整个 Stage；
  3. **作者署名 / Table caption 误判**：`_is_author_byline` 要求 unicode 标记 `∗†‡` 或 `len < 80`，但本文 15 位作者用 ASCII `*` 且超长；`Table 2:` / `Table S2:` 等被 PyMuPDF 大字号识别为 heading 时无任何降级路径；
  4. **TOC 错乱**：docling 表格结构识别在目录页（章节号 + 点 leader + 页码 4 列）的 cell merge 错乱不可挽救，且学术 PDF 的 Markdown 阅读不需要重建 TOC（H2/H3 自然导航）；
  5. **图片孤儿**：`markdown/image_ref_normalizer.py::normalize_image_references` 只做两阶段（占位符替换 + 路径规范化），无第三阶段"已落盘但 markdown 无引用 → 末尾追加"兜底；
  6. **货币 vs LaTeX 边界**：`pdf/math_formula.py::_MATH_DELIMITERS` 的 inline `$ ... $` 正则跨段贪婪匹配，把 `$0.30/MTok … $2.86M … $200 to $125` 三对货币号当作 math 保护整段，连锁导致区域内 `gener- ator` 等断字逃过 typography 修复（修 hyphenation 时连锁暴露）。
- **处理方式**：
  1. **`formatter._typography_inner`** 增加 `re.sub(r"([a-z])- ([a-z])", r"\1\2", text)`，仅匹配 ASCII 小写两侧，复合词（`state-of-the-art`）、数字范围（`20- 30`）、专有大写边界（`X- Ray`）自然不命中；
  2. **`pdf/math_formula._MATH_DELIMITERS`** inline 段改为 `(?<!\$)\$(?![\$\d])[^$\n]+?\$(?!\d)`：开头不跟数字 + 不跨行 + 结尾不接数字，三层防御 USD 货币误识；
  3. **`quick_scan`** 新增 `_compute_scan_page_indices(start, end, max_scan=15)`：1/3 前段 + 1/3 中段（均匀步长）+ 1/3 末段，覆盖学术论文方法/实验/附录章节的特征信号；
  4. **`assembly`** 扩展 `_is_author_byline` 识别多作者 `Name 1,2,*` ASCII 模式（regex `[A-Z][A-Za-z\-]+(?:\s+[A-Z][A-Za-z\-]+)*\s+\d+(?:,\s*\d+)*(?:,\s*\*)?`），并把作者署名 / Table caption 误判 heading 从"continue 跳过"改为"降级为段落"（保留信息脱离层级）—— 新增 `_byline_to_paragraph`、`_table_caption_to_paragraph`；
  5. **`assembly`** 新增 `_is_toc_table_text(text)`：GFM 表格行 ≥3 + 点 leader 行 ≥2 或章节编号行 ≥3 + 页码列 ≥2 三条件同时满足，文本块和 table_extraction 输出两处都跳过；
  6. **`image_ref_normalizer`** 新增 Phase 3 `_append_orphan_images`：basename 不在 markdown 引用集的图片按列表顺序追加到文档末尾，带显式 HTML 注释标记 `<!-- orphan images appended -->`，可通过 `append_orphans=False` 关闭以保持旧合约；
  7. **测试**：5 个新单测套件覆盖（hyphenation 7、math protection 货币 2、quick_scan sampling 6、assembly byline filter 14、TOC filter 6、image ref orphan 5 + 既有 21）= 共 61 个新单测 + 1 个集成测试套件（7 例）；
  8. **golden 特征签名** 落 `tests/fixtures/pdf/harness-engineering/expected_signature.json`：计数 + 容差 + must_contain / must_not_contain 关键子串，集成测试 `tests/integration/test_pdf_harness_engineering_parity.py` 默认 CI 跳过（`@pytest.mark.slow`），本地手跑；
  9. **端到端实机验证**：accra-v1 启独立 perceives MCP（port 2993）+ 临时切换 corpus extractor route 到新 server，通过 backend `POST /knowledge/base/{corpus_id}/documents/{document_id}/refresh_markdown` 重提取，UI 上 `chrome_devtools` 截图对照 PDF 多页（封面 / 双栏 / Figure 5 / Section 8.6 / References 列表），所有断字 / 误判 / TOC 残留全部消失，13 张图片正确缩放显示（width 属性透传 + `[&_img]:h-auto`）。
- **量化效果**（全本 71 页）：
  - 断字残留 218 → 0；
  - formula_extraction 由 `skipped:profile:no_has_formulas` 改为命中 `mineru` 引擎抽取 3 个块级公式；
  - 误判 H4 由 2 个（作者行 + Table S2）→ 0；
  - TOC 区从 83 行错乱表格 → 干净（仅保留 `## Contents` 标题）；
  - 全本耗时 60s（mineru 漏跑）→ 180-300s（mineru 公式抽取 200s+ 是固有开销，layout_analysis 80s，合计在 ≤320s 范围内可接受）；
  - 切片前 5 页 24s（< 30s 目标）；
  - 既有单测 525 例无回归。
- **三轮防范要点补充**：
  1. **`reverse-dedup` 反向去重一律走"降级而非丢弃"**：assembly 阶段对疑似"作者 / caption / TOC / 元数据"的 heading 识别，默认降级为段落或加粗段落，保留信息；只有完全无信息密度的页眉/页脚（如纯页码、DOI 行）才直接 drop。错误丢弃比错误保留更难诊断；
  2. **`quick_scan` 任何"前 N 页扫描"启发式都是坑**：长文档（论文、书、报告）的特征分布从来不集中在开头；任何选项扫描必须用 first/middle/last 三段策略；
  3. **`$ ... $` inline math 正则跨行禁用 + 货币号 negative lookahead**：`$200 to $125` 是真实学术论文（NLP/Economics）的常见结构，必须设计成不可误匹配；
  4. **图片"落盘 vs markdown 引用"是独立的失败维度**：image_extraction 成功 != markdown 包含；最终 assembly 阶段对所有持久化的图片必须有兜底引用（孤儿追加 + 显式注释，便于审查）；
  5. **学术 PDF 质量回归必须双 PDF 守护**（target + `2603.05344v3.pdf` 之类的相邻样本），每次改 assembly 反向去重前后跑双 PDF 计数签名，diff >10% 触发 review；
  6. **端到端验证不能只靠 CLI**：accra-v1 工作区独立的 perceives MCP + 临时切 corpus extractor route 是低侵入的端到端验证范式，可复用到其他 PDF/Webpage extractor 改动；
  7. **UI 透传 `<img width height>` + `[&_img]:h-auto` 是高保真渲染的关键**：perceives 端为每张图输出尺寸属性后，UI 自适应缩放无需任何额外改动（[DocumentMarkdownRenderer.tsx 现状](../apps/negentropy-ui/features/knowledge/components/DocumentMarkdownRenderer.tsx)），保持这个契约不要回退。
- **三轮同类问题影响补充**：
  - 任何"学术 / 长文档"型 PDF（arXiv、ICLR、NeurIPS 等）经过 `parse_pdf_to_markdown` 都会受益；本期回归基准 `2603.05344v3.pdf` 已确认无退化（14 公式 / 23 图 / 18 代码块 / 9 表全部正常）；
  - `quick_scan` 三段采样、formatter 货币号防误识、TOC 表抑制三个改动**正交独立**，可按需 cherry-pick；
  - `extractor_routes.targets[].timeout_ms` 在 corpus config 中需要为学术论文体量调到 600s+（默认 300s 在 71 页 + mineru 公式抽取下偶发超时）—— 本期已 UPDATE 该 corpus，新建 corpus 时需同步把 `parse_pdf_to_markdown` timeout 默认值上调或暴露 UI 配置项；
  - 端到端实机验证范式：a) 独立工作区起 perceives MCP（不同 port），b) 临时更新 `corpus.config->extractor_routes->file_pdf->targets[].server_id/url` 指到新 MCP，c) `POST .../refresh_markdown` 触发重提取，d) 验证完后回滚 corpus config。

### 第四轮迭代（2026-05-26 unseen 样本 Context Engineering 2.0 驱动）

第三轮收尾后切到 28 页混合双栏 + 大量图表 + 多语言作者名（中文 / 葡萄牙文 / 德文）的 unseen sample `Context Engineering 2.0: The Context of Context Engineering.pdf` 做端到端 1:1 还原验证，再次定位 6 类独立根因（与前三轮正交、可单独 cherry-pick），全部修复后字符数从 131369 → 113979（-13.2%），图片引用从 93 → 11（孤儿重复 + 装饰小图全部清空，仅保留 8 张真实 figure + 3 张真孤儿）：

- **表因**：以 Context Engineering 2.0 论文为驱动样本端到端实测发现 6 类高发缺陷：``\`\`\`algorithm`` 代码块误判（Section 2.1 / 5.3 正文被整段包装为算法代码块，引入数百行重复 PDF 文本）；装饰性小图（SII 章节图标、脚注上标，bbox 20×22 pt）逃过渲染像素 50px 过滤被当作正常图片输出；文档末尾整段重复追加 56 张孤儿图（与正文已渲染的 HTML img 1:1 重叠）；章节复合编号 `3.1.1` → `3. 1.1` 拆裂被 markdown 误识为有序列表；多语言作者名变音字符断裂 `Pok ´ emon` / `Baltru ˇ saitis` / `Westh ¨ außer` / `Perdig ˜ ao`；list formatter 把已合并的复合编号在管线末端再次拆开。
- **根因**：
  1. **algorithm 误判**：`markdown/algorithm_detector.py::detect_algorithm_regions` standalone 路径仅评分 ≥ 7 不够。学术 PDF 段落含 `if/for/then` 英文高频词命中关键字 +5（封顶）、`∈/≤/∧` 数学 Unicode 字符命中特殊字符 +2，恰好凑齐 standalone 阈值 7 分，整段被误包装为 ```algorithm``` 代码块；
  2. **装饰小图过滤穿透**：`pdf/extraction/image.py::extract_images_from_pdf_page` 按渲染像素 `< 50px` 过滤，对原图 ≥ 50px 而 PDF 显示尺寸仅 20×22 pt 的装饰图标无能为力（典型 SII 章节图标在 fitz 中原图分辨率正好 50px 起步）；
  3. **孤儿图重复追加**：`markdown/image_ref_normalizer.py::_append_orphan_images` 仅扫描 markdown 语法 `![alt](path)` 判定引用关系，但 `assembly._image_to_markdown` 为承载 PDF 原始显示尺寸把所有图渲染为 HTML `<img src="..." width="..." height="..." />` 形式，导致主体已用 HTML 引用的 56 张图全部判为孤儿，在末尾整段重复追加；
  4. **复合编号 span 断裂**：PyMuPDF `page.get_text("dict")` 经常把章节编号 `3.1.1` 拆为多个 span（`3.` + `1.1`），`FitzTextExtractor` 块拼接采用 `" ".join` 后输出 `3. 1.1 Foo` 形态；
  5. **变音字符 PDF 拆解**：PyMuPDF 把 `Pokémon` / `Baltrušaitis` 等含组合变音字符（acute / caron / diaeresis / tilde / grave / circumflex）的词在 PDF 中拆为 `base + 独立间隔符号 + 后续字母`，`" ".join` 拼回 `Pok ´ emon` 形态，破坏非英语作者名 / 专有名词 / 参考文献可检索性；
  6. **list formatter 二次拆裂**：`MarkdownFormatter._format_lists` 正则 `^(\d+)[\.\)]\s*(.+)$` 把 `3.1.1 Foo` 解析为 `\1='3', \3='1.1 Foo'`，强行输出 `3. 1.1 Foo`，撕裂 FitzTextExtractor 已合并的复合编号（与根因 #4 是同一缺陷的两个独立触发点）。
- **处理方式**：
  1. **`markdown/algorithm_detector.py`** 新增 `_has_pseudocode_skeleton` 守卫：standalone 路径除评分 ≥ 7 外还要求出现 `Require/Ensure/Input/Output` 结构化头部或 ≥ 3 行 `N: step` 编号步骤。+ 3 个新测试覆盖正负样本；
  2. **`pipeline/stages/pdf/image_extraction.py`** 在 raster 路径上对 `bbox` 维度 ≤ 24pt 的光栅图做二次拦截，与矢量 figure 渲染分支（< 20pt）形成梯度防御。阈值 24pt 而非 20pt 留 ±2pt 栅格化抖动余量。+ 2 个新测试；
  3. **`markdown/image_ref_normalizer.py`** 扩展 `_append_orphan_images` 引用集识别：新增 `_HTML_IMG_SRC_RE` 同时扫描 `<img src="...">` 标签，按 basename 匹配；同时支持 `/api/documents/<id>/assets/<basename>` 后端重写路径。+ 3 个新测试；
  4. **`pipeline/stages/pdf/text_extraction.py`** 在 `_extract_chunk` 块拼接后加入 `re.sub(r"\b(\d+)\.\s+(\d+\.\d+(?:\.\d+)?)\b", r"\1.\2", text)` — 模式在自然语言中极罕见，不会误伤普通有序列表、年份句号、小数表达。+ 11 个新测试；
  5. **`markdown/formatter.py`** 在 `_typography_inner` 前置 `_rejoin_split_diacritics`：识别 `<letter><space>?<spacing-diacritic><space>?<letter>` 模式，把组合字符贴到 **后续字母**（PDF 视觉语义），经 `unicodedata.normalize("NFC", ...)` 收敛为预组合 codepoint。覆盖 6 类常见变音符号（acute / grave / circumflex / diaeresis / tilde / caron）。+ 16 个新测试；
  6. **`markdown/formatter.py::_format_lists`** 在 list-item 识别正则中追加 negative lookahead `(?!\d+\.\d)`，仅当数字 + 点后接的内容**不以** `\d+\.\d` 起手时才视为列表项。+ 8 个新测试。
- **量化效果**（28 页 unseen 论文）：
  - `code_blocks` 误判 2 → 0（algorithm 误判块消失，节省 ~14k 字符的重复文本）；
  - 图片总数 93 → 11（其中 8 张 HTML img 全部是真实 Figure 1-7 + 论文 banner，3 张 markdown img 是真孤儿）— `images.html_img_tag` 37 → 8（装饰小图过滤），`images.markdown_img` 56 → 3（HTML img 已引用识别）；
  - `Pok ´ emon` / `Baltru ˇ saitis` / `Westh ¨ außer` / `Perdig ˜ ao` / `Hervé J ´ egou` 等 8+ 处变音断裂全部还原为预组合形式；
  - `3. 1.1` / `3. 1.2` / `3. 1.3` / `5. 3.1` / `5. 3.2` 等 5 处子章节复合编号还原为紧凑 `3.1.1` 形态；
  - char_count 131369 → 113979（-13.2%），word_count 17484 → 16276；
  - hyphen_residue 持续保持 0；
  - 既有单测 1400 例无回归（仅 `test_config.py` 因用户配置 `concurrent_requests=32` 覆盖默认 16 而失败，与本期修复无关）。
- **四轮防范要点补充**：
  1. **算法块 standalone 路径必须要求真伪代码结构骨架**：仅靠数学符号 + 英文高频词凑分会大量误判学术正文。要求 Require/Ensure 头部或 ≥ 3 行 `N:` 编号步骤是低成本高 ROI 守卫；
  2. **图片过滤必须双层防御**（像素 + bbox 维度）：渲染像素阈值只能挡到原图低分辨率的装饰图，对原图分辨率正好达标但 PDF 显示尺寸极小的装饰图无能为力；要在 ExtractedImage 落入 assembly 前再按 bbox 维度做一次拦截；
  3. **图片引用集判定必须同时识别 markdown 与 HTML 两种语法**：assembly 阶段为承载尺寸优先输出 HTML img，仅扫描 `![alt](path)` 会把全部图判为孤儿，引入数倍重复；
  4. **复合编号 / 多语言变音字符是 PDF span 拆解的两大典型表象**：PyMuPDF 的 `" ".join` span 拼接对所有 PDF 都会触发；用稳定的正则后处理（数字模式 / Unicode combining 字符）可一次性覆盖学术 PDF 整体；
  5. **同一缺陷可能有多个独立触发点**：根因 #4 在上游 `FitzTextExtractor` 修好后又被下游 `MarkdownFormatter._format_lists` 二次撕裂 — 需要管线全程审视每一处 `^\d+\.` 起手的正则修改是否会撕裂复合编号；
  6. **unseen sample 是发现新失真维度的最高 ROI 验证策略**：基线 PDF 跑 1:1 后切换到新 sample（不同领域 / 不同排版 / 不同语言）端到端跑一轮，能在 1-2 小时内暴露 5-10 类独立根因，远超基线 PDF 的二次抛光收益。
- **四轮同类问题影响补充**：
  - 任何包含多语言作者 / 章节复合编号 / Figure 装饰元素的学术 PDF 都会受益本期 6 个修复；
  - 修复全部以独立 commit 串接在 `ThreeFish-AI/pdf-to-markdown-parity` 分支：`a7c97130` (algorithm) / `85beb20d` (image filter) / `60bb4ad6` (orphan dedup) / `67110907` (compound number FitzTextExtractor) / `d48b1baa` (diacritic) / `d198413d` (compound number formatter)，可按需 cherry-pick；
  - **inline 数学公式 `$...$` 包裹缺失** 是已知未修问题（`CE : (C, T) → f_context (3)` 等行内公式在 assembly 阶段被静默丢弃），需要单独的 inline formula 重定位架构改造，留待第五轮；
  - **PDF-specific 噪声文本**（`§ Github` / `SII Context` 等）暂未规则化，建议依靠未来 layout-aware logo 区域识别而非通用正则。

### 第五轮迭代（2026-05-26 Context Engineering 2.0 inline 公式恢复 + 等式编号借入）

第四轮收尾笔记把 **inline `$...$` 公式包裹缺失**作为唯一明确遗留问题留到第五轮。本期以 R4 收尾时的 Context Engineering 2.0 markdown（`013c5ebc-51b8-4a54-8e52-17241fdb67ed`，char_count=113973、inline `$...$` 计数=0）为起点端到端实测，最终在 UI Document View 上把等式 (3) (4) 全部恢复为 KaTeX 可渲染的 inline 公式，等式 (6) 重复 PyMuPDF 字符流文本段被剔除，字符数 113973 → 113917（-56，含两次微调），inline `$...$` 计数 0 → 2，block `$$...$$` 5 块保持稳定，单测 161 → 163 项无回归（test_assembly_inline_formula_orphan.py 新增 29 例），UI 端 7 个 KaTeX 实例零 ParseError：

- **表因**：以 R4 收尾后的同份 PDF 为驱动样本端到端实测发现 3 类正交 + 1 类 KaTeX 语法限制（与前四轮缺陷正交，可独立 cherry-pick）：
  1. **inline 公式被 assembly 静默丢弃**：`assembly.py` 第 241 行 `elif formula.latex and formula.formula_type == "block":` 仅承接块级孤儿，MinerU 对短公式（如 `CE: (C, T) → f_context (3)`）常分类为 `inline` 且缺失 bbox，直接落入丢弃分支；
  2. **公式编号借入失败导致重复 plain text**：docling 抽取 eq (6) 时仅给出 `$$ M_l = f_{long}(...) $$` 主体，编号 `(6)` 留在下方紧邻的 PyMuPDF 字符流文本段（含 `M l = f long ( c ∈ C: w importance ...) (6)`）。`_formula_eq_nums` 集合从公式 LaTeX 末尾扫不到编号 → 该字符流文本未被剔除，公式 + 重复文本并存；
  3. **PDF 抽取层漏抽 inline 公式整段**：MinerU 公式 stage 在 28 页学术论文上跑 ~600s 超时，降级 docling，docling 也不抽出 eq (3) / (4)（短文本型公式落进 paragraph stream）。需要在 assembly 末段对"含数学符号 + 尾部 `(N)` + 短小段"的孤立文本元素做后置识别 + 包裹；
  4. **KaTeX 语法限制**：`\\tag{N}` 仅支持 display equation（`$$...$$`），inline `$...$` 使用 `\\tag` 触发 ParseError `"tag works only in display equations"`。需改用 `\\quad (N)` 编号写法。

- **根因**：
  1. **assembly 公式承接分支硬编码 `formula_type == "block"`**：上下文 [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 第 60-244 行的 `_orphan_block_formulas` 命名与 elif 守卫把 inline 公式排除在兜底链路之外，这是 R3 引入孤儿匹配时的设计遗留（彼时假设所有需兜底公式都是块级）；
  2. **`_formula_eq_nums` 仅从 LaTeX 主体扫描**：`assembly.py` 2.4 段集合构造对应代码 `re.finditer(r"\\(\\s*(\\d+)\\s*\\)", elem.content)` 等只识别 ``elem.content`` 即公式自身的 LaTeX；当公式 LaTeX 缺编号、编号留在相邻 PyMuPDF 文本段时无可借入路径；
  3. **公式 stage 是 best-effort、缺乏 markdown 末端 fallback**：现状管线把"公式抽取"局限在 `formula_extraction` stage（mineru/docling/pymupdf_heuristic），如某段落型短公式三引擎都漏抽，最终 markdown 永远是 plain text。assembly 末段需要补充"语义层"的 inline 公式识别（避免对 `formula_extraction` stage 过度依赖）；
  4. **KaTeX 接入 R4 已锁定但未单测覆盖 inline 语法兼容**：UI 端 [`DocumentMarkdownRenderer.tsx`](../../apps/negentropy-ui/features/knowledge/components/DocumentMarkdownRenderer.tsx) 已挂 `remark-math + rehype-katex`，但 assembly 输出的 inline LaTeX 与 KaTeX 语法 ABI 在 R4 未建立强契约，导致本期使用 `\\tag` 渲染失败被推迟到 UI 实机验证才暴露。

- **处理方式**（5 个独立修改点，集中在 [`pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 一个文件，单测覆盖均落在 [`tests/unit/test_assembly_inline_formula_orphan.py`](../../apps/negentropy-perceives/tests/unit/test_assembly_inline_formula_orphan.py)）：
  1. **`_orphan_block_formulas` → `_orphan_formulas`**，把 elif 守卫从 `formula_type == "block"` 放宽为接收所有无 bbox 的公式（inline + block 共池兜底），`_formula_to_markdown` 内按 `formula_type` 决定 `$` 或 `$$` 包裹；
  2. **新增 `_extract_formula_eq_number()` helper**：用 `_FORMULA_EQ_NUMBER_PATTERNS` 三模式覆盖 `\\tag{N}` / `\\quad (N)` / LaTeX 尾部 `(N)`；2.2 段 orphan 匹配把策略 1（编号匹配）作为第一优先；策略 2（数学符号 + LaTeX 关键词）退化为 block 公式专用；
  3. **2.4.5 段"借入相邻文本段编号"**：扫描每个公式元素其后一个文本元素，若该文本段以编号 `(N)` 收尾、含数学符号、长度短小，则把编号 `N` 借入 `_formula_eq_nums` —— 让 2.4 公式-文本去重规则能命中此文本段并剔除（典型 eq (6) 重复字符流场景）；
  4. **2.5 段"inline 公式 promotion"**：识别"含数学符号 + 尾部 `(N)` + 短小段（5-120 字符）"的孤立文本元素，整段包裹为 `$<core> \\quad (N)$` 并升级为 formula 元素。守卫包括：不以 markdown 元字符起手、不含自然语言句尾标点（限定 `\\.\\s+[A-Z]` 句首字母 + 行末点）、不含 `。? ! ！？`、数学符号集覆盖 `∈ → ⊆ ⊆ ϕ φ` 等多 Unicode 形态；
  5. **`\\tag → \\quad` KaTeX 语法兼容**：inline `$...$` 包裹时编号写法用 `\\quad (N)` 而非 `\\tag{N}`，绕过 KaTeX `tag works only in display equations` ParseError；这把"公式识别"与"UI 渲染"两个端的契约固化在 promotion pass 注释中。

- **量化效果**（28 页 Context Engineering 2.0 论文，DB doc=`013c5ebc-51b8-4a54-8e52-17241fdb67ed`）：
  - **inline `$...$` 计数**：0 → 2（eq 3、eq 4 全部包裹）；
  - **block `$$...$$` 块**：5 块（eq 1, 2, 5, 6, 7）保持不变；
  - **等式 (6) 重复 PyMuPDF 字符流文本段**：消失（被 borrow + dedup 链路命中剔除）；
  - **char_count**：113973 → 113917（-56 字符）；
  - **algorithm 块**、**hyphen residue**、**HTML img (8)**、**markdown img (3)**：与 R4 收尾完全持平，无回归；
  - **KaTeX 渲染**：浏览器实机 7 个 KaTeX 实例（5 display + 2 inline）零 ParseError；
  - **单测**：本期新增 29 例（3 个 Test Class：`TestExtractFormulaEqNumber` 9 例、`TestFormulaToMarkdown` 4 例、`TestInlineFormulaPromotion` 12 例、`TestBorrowTrailingNumber` 4 例），与既有 1538 例无回归（仅 `test_config.py` 因本地用户配置 `concurrent_requests=32` / `llm_model='gpt-5.4-mini'` 覆盖默认值的 2 例预存在失败，与本期无关）。

- **五轮防范要点补充**：
  1. **assembly 兜底承接分支必须 inline + block 共池**：用 `formula_type` 进行细粒度处理（包裹符号选择），而非 elif 守卫直接丢弃。短公式在学术论文中的占比往往高于块级公式；
  2. **公式编号识别必须三模式并行**（`\\tag{N}` / `\\quad (N)` / 尾部 `(N)`）：不同引擎（MinerU / docling / marker）的 LaTeX 编号写法差异巨大，硬编码任一模式都会漏；
  3. **`_formula_eq_nums` 必须支持"邻接文本段借入"**：当公式 LaTeX 无编号但下方相邻文本段以 `(N)` 收尾时，把编号借入集合让公式-文本去重链路能命中。同一公式的"主体"与"编号"在 PDF 抽取层经常被拆到不同元素；
  4. **assembly 必须保留 markdown 末端 inline 公式识别 pass**：当所有公式 stage（mineru / docling / pymupdf_heuristic）都漏抽某段落型短公式时，仅靠"含数学符号 + 尾部 `(N)` + 短小段"的语义守卫能恢复 KaTeX 渲染可能性，是低成本高 ROI 兜底；
  5. **inline `$...$` 公式中严禁使用 `\\tag{}`**：KaTeX 接入面契约。任何 promotion / 升级路径使用 `\\quad (N)` 写法（display & inline 双兼容），并在单测中用 `katex_errors` 数组锁定此契约；
  6. **省略号、复合编号、句号判定需精细化**：PDF 把省略号拆为 `. . .` 三个独立点带空格非常常见；句号特征严格限定为 `. ` 后接大写字母（句首）或行末点，避免误吞含 `. . .` 的公式段；同理小数 `3.14` / 复合编号 `3.1.1` 也通过"点后接数字"模式天然规避。

- **五轮同类问题影响补充**：
  - 任何含"短文本型 inline 公式"的学术论文（NLP / Economics / 偏理论的 CS survey）都会受益本期 5 个修复；
  - 修复全部在一个 commit 内（本轮变化集中、解耦自然），可按需 cherry-pick：`apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py` + `apps/negentropy-perceives/tests/unit/test_assembly_inline_formula_orphan.py`；
  - **inline 公式 KaTeX 渲染契约**（仅 `\\quad (N)`，禁 `\\tag{N}`）已在 promotion pass 注释中固化，未来扩展任何公式升级链路都应遵守此契约；
  - **`_orphan_formulas` 统一命名**让"inline + block 共池"语义更显式，未来扩展 caption 类元素的相似处理（如 Figure caption 与 figure 分离的情况）也可参考此模式；
  - **R5 浮现但不在本期范围**的 `[2]` 引用跳号问题已记录在 `.context/r5-defects.md`：根因在 PDF 提取上游（pymupdf text block 缺失），R4 与 R5 markdown 中均存在，非本期回归，留待后续单独立 issue。

### 第六轮迭代（2026-05-26 Figure 矢量 overlay 标签抑制 + caption 例外保留）

R5 commit `a97171ad` 合入后双 Tab 浏览器对比 R5 markdown 与原 PDF 再次浮现：**Figure 1 的矢量 overlay 标签作为独立段落散落到位图下方**，破坏正文阅读流。PDF 中 Figure 1 是一个矢量 + 位图复合图形（顶部 "More Intelligence. More Context-Processing Ability..."、4 列 "Context 1.0 / 2.0 / 3.0 / 4.0" 标题行、中间机器人位图、底部 "Context Input" 与 "Intelligence Level" 两行分类标签 + 4 个角色名 "Passive Executor / Initiative Agent / Reliable Collaborator / Considerate Master"），但 markdown 中只渲染中间位图，而矢量标签因落在位图 bbox 之外被 PyMuPDF 当作独立 `text block` 抽出并散落到图下方。

- **表因**：[`assembly.py:1117 _block_overlaps_special`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 的"包含检测 + IoU 双策略"用的是 `image_extraction.ExtractedImage.bbox`（即 PyMuPDF 抽取出来的**位图自身 bbox**，约 width=299 / height=199），而**整个 Figure 视觉区域**（含矢量标签）远大于位图本身（layout 给出的 `figure` region 通常完整覆盖标签 + 位图），导致矢量标签 text block 几何上落不进 `special_regions`，作为独立段落被装入正文流。

- **根因**：assembly **没有消费 `input_data.layout.regions`**（`AssemblyInput.layout` 字段早已存在并由 `layout_analysis` stage 填充）—— `special_regions` 仅由 `formula.bbox / table.bbox / image.bbox` 构造，没有用更精确的 `region_type="figure"` 几何信息。这是设计遗漏：layout stage 的核心价值（用 layout-aware bbox 覆盖完整 figure 区域）从未被 assembly 消费。

- **处理方式**（[`apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 单文件聚焦修改）：
  1. **assembly `special_regions` 构造扩展**：把 `input_data.layout.regions` 中 `region_type in ("figure", "picture")` 的 bbox 一并加入 `special_regions`。这样落入完整 figure 视觉框（含矢量标签）的 text block 会被 `_block_overlaps_special` 自然抑制；
  2. **Figure / Table caption 例外保留**：新增 `_is_figure_or_table_caption_text` 守卫 + `_FIGURE_TABLE_CAPTION_RE` 正则（兼容 `Figure 1:` / `Fig. 2:` / `Table 3.` / `Tab 4 -` 等多种学术论文 caption 写法）。文本块即便落入 layout figure region，只要起手匹配 `Figure N:` / `Table N:` 模式即作为段落保留，确保图表语义描述不被一同抑制；
  3. **新增 `_layout_figure_regions` 局部索引**：为后续可能的"按 figure 区域聚类相邻 text block"做铺垫，目前仅用于显式标注 layout 来源（与公式 / 表格 / 图片 bbox 区分）。

- **量化效果**（28 页 Context Engineering 2.0 论文，DB doc=`013c5ebc-51b8-4a54-8e52-17241fdb67ed`）：
  - **Figure 1 矢量 overlay 标签**（`Context Input` / `Intelligence Level` / `Passive Executor` / `Initiative Agent` / `Reliable Collaborator` / `Considerate Master` / `More Intelligence...` 等 7+ 处散落标签）：**全部消失**；
  - **Figure 1 caption** "Figure 1: The Overview of context engineering 1.0 to context engineering 4.0..." **完整保留**（例外守卫生效）；
  - **char_count**：113917 → 113806（-111 字符，等于被抑制的 overlay 标签合计长度）；
  - **inline `$...$` 与 block `$$...$$`**：与 R5 完全持平（2 inline + 5 block），R6 改动不影响公式链路；
  - **既有单测**：本期新增 10 例 `test_assembly_figure_overlay_text.py`（覆盖 7 种 caption 形态正样本 + 7 种 overlay 标签负样本），与 R5 后的 1567 例无回归；
  - **浏览器实机对照**：Markdown view 中 Figure 1 区域显示为「位图 → caption → 1 Introduction」的清洁阅读流，与 PDF 原版阅读体感对齐；唯一权衡是 PDF 矢量绘图层的分类标签信息丢失（属于 PDF→Markdown 转换的**固有损失**：PyMuPDF 把矢量绘图层的标签作为 text 抽走，位图本身不含这些标签）。

- **六轮防范要点补充**：
  1. **assembly `special_regions` 必须消费 layout stage 输出**：image_extraction 给出的位图 bbox 不能等同于"完整 Figure 区域"。Layout-aware 的 `region_type="figure"` 才是 figure 视觉框的权威 bbox；
  2. **Caption 例外保留必须显式守卫**：扩大 `special_regions` 必然把同区域的 caption 也命中。`Figure N:` / `Table N:` 起手的文本块是图表语义价值的核心载体，必须**例外保留为段落**而不是一同抑制；
  3. **正则起手严格定位避免误伤**：`_FIGURE_TABLE_CAPTION_RE` 用 `^\s*(Figure|Fig\.?|Table|Tab\.?)\s+\d+\s*[:.\-]` 模式锚定起手 + 编号 + 分隔符，避免段落中部的 "Figure 1" 引用被误识为 caption；
  4. **PDF 矢量绘图层标签的固有损失要承认**：当 PDF 用矢量绘图层（PDF vector painting ops）渲染 Figure 内部标签时，PyMuPDF 把它们作为独立 `text block` 抽出而非位图的一部分；位图本身不含这些标签。"还原矢量绘图层 + 位图为完整图像" 需要 `fitz.Page.get_pixmap(clip=figure_region)` 重渲染（属于 R7+ 工程），R6 选择"丢弃散落标签换阅读流畅"是合理 trade-off；
  5. **R6 修改面**：仅 `assembly.py` 单文件 + 单一新增单测文件，与 R5 `_orphan_formulas` / `_extract_formula_eq_number` 等链路完全正交，可独立 cherry-pick。

### 第七轮迭代（2026-05-26 layout figure region 整图渲染 + PDF pt → CSS px 比例修复）

R6 合入后双 Tab 实测发现两类正交缺陷：
1. **Figure 矢量信息丢失**：R6 抑制了 figure 内部矢量 overlay 标签（"Context 1.0..4.0" / "Context Input" / "Intelligence Level" 等）的散落，但位图本身只是中间小图（机器人），PDF 原版 Figure 1 顶部 4 列 Context 标题、底部分类标签等矢量内容彻底丢失，markdown 中只剩"光秃秃的中间位图"；
2. **Figure 显示宽度仅占容器 1/3**：`_image_to_markdown` 把 PDF 点（pt）直接当作 CSS 像素（px）输出，导致 A4 全宽 figure（~595pt）在 markdown view 仅显示为 ~595px，而 web 默认 96 DPI 下 595pt 应换算为 ~793px。视觉感受是"图被压缩到容器 1/3 宽"。

- **表因**：用户连续 2 次浏览器截图反馈 — Figure 1 markdown 视觉与 PDF 原版相比严重失真。R6 抑制 overlay 标签后阅读流畅，但 PDF 原版的「演进图视觉信息」（4 列 Context 1.0-4.0 标题 + 中间机器人 + 底部分类标签）在 markdown 中彻底丢失；同时 figure 显示宽度仅占阅读容器约 1/3，视觉与 PDF 严重不一致。

- **根因**：
  1. **`_render_figure_regions` 去重方向反了**：[`image_extraction.py:103`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/image_extraction.py) 早已实现 `page.get_pixmap(clip=region.bbox)` 整图渲染分支，但「figure region 与 raster 重叠 > 50% 时 **跳过 figure 渲染**」的去重逻辑反了。Figure region 通常完整包含 raster 位图，按当前逻辑 figure 整图渲染**总是被跳过**，结果只剩 raster 小位图。正确思路应反转为「figure region 完整包含 raster 时 **以 figure 整图替代 raster**」。`_OVERLAP_THRESHOLD = 0.5`（R7 前）与 `_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8`（R7 后）的语义完全反向。
  2. **PDF 点 → CSS 像素换算缺失**：[`assembly.py:_image_to_markdown`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 把 PDF 点（72pt = 1in）直接当作 CSS 像素（96px = 1in）输出，缺失 4/3 比例换算。这是从 R3 起就存在的隐性 bug，但 R4 时机器人位图本身较小（299pt × 199pt）在 web 容器中显示不算太突兀；R7 整图渲染产物变大（373pt × 215pt 等接近 A4 全宽）后视觉变形被放大暴露。

- **处理方式**（[`image_extraction.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/image_extraction.py) + [`assembly.py`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 双文件聚焦修改）：
  1. **`_render_figure_regions` 反转去重 + 返回签名变更**：`_OVERLAP_THRESHOLD = 0.5` 改为 `_FIGURE_CONTAINS_RASTER_THRESHOLD = 0.8`；计算「raster 被 figure region 包含的比例」（`_compute_overlap_ratio(raster, figure)`），≥ 80% 时把该 raster 列入 `drop_indices` 集合让上层主流程剔除；返回值从 `List[ExtractedImage]` 改为 `Tuple[List[ExtractedImage], Set[int]]`；stage 主流程消费 `raster_drop_indices` 在合并前剔除被替代的 raster；同时把 `region_type` 从 `"figure"` 扩展为 `("figure", "picture")` 以兼容多引擎命名差异。仅在 figure region 渲染成功后才剔除 raster，渲染失败时同时保留 raster 与 layout figure region 信息（双保险防双重信息损失）。
  2. **`_image_to_markdown` 加 PDF pt → CSS px 换算**：新增 `_PDF_PT_TO_CSS_PX = 96.0 / 72.0` 常量，bbox 宽高乘以 4/3 因子后再 round 输出。`image.width` / `image.height` 退化路径（引擎报告的 px 单位）不应用此因子。

- **量化效果**（28 页 Context Engineering 2.0 论文）：
  - **Figure 1**：从 R6 的中间小机器人位图（299×199 pt）→ R7 的完整演进图（含 4 列 "Context 1.0..4.0" 标题 + 中间机器人 + 底部 "Context Input / Intelligence Level" 分类标签 + caption），与 PDF 原版 1:1 等价；
  - **Figure 2-7**：全部从原始嵌入位图（仅部分内容）→ 完整 layout region 渲染产物（含全部矢量绘图层 + 标签 + caption）；
  - **char_count**：113806 → 113108（-698 字符，被 figure region 替代的 raster 引用合计长度）；
  - **markdown img refs**：3 张孤儿图全部消失（被 figure region 替代后不再触发 orphan fallback），仅保留 8 张 HTML `<img>` 引用（全部指向 `fig_p*_*.png` 整图渲染产物）；
  - **图片显示宽度**：Figure 1 从 373px → 497px（PDF 点 373 × 4/3），Figure 5/6/7 接近 A4 全宽 ~588-595px，与 PDF 原版视觉宽度 1:1；
  - **既有单测**：本期新增 8 例 `test_image_extraction_figure_clip.py`（覆盖 `_compute_overlap_ratio` 参数顺序 + `_FIGURE_CONTAINS_RASTER_THRESHOLD` 阈值），修改 1 例 `test_assembly_helpers.py::test_emits_html_img_with_bbox_display_size`（同步 4/3 换算），新增 2 例 full-width + 真实场景断言；与 R6 后的 1577 例无回归（仅 `test_config.py` 预存在的环境覆盖失败 2 例与本期无关）。
  - **浏览器实机对照**：Markdown view 中 Figure 1 显示宽度从「容器 1/3」→ 「~50-60% 容器宽度」（与 PDF 原版比例接近），完整演进图清晰可见。

- **七轮防范要点补充**：
  1. **去重方向必须语义清晰**：`_compute_overlap_ratio(A, B)` 是「A 被 B 覆盖的比例」（非对称）。R7 前误把「figure 被 raster 包含」当作「raster 是 figure 的子组件」判定，是参数顺序导致的逻辑反转。应明确「谁应被替换」：layout figure region（含矢量绘图层）信息密度更高 → raster 应被替代；
  2. **PDF pt 单位换算必须显式**：PDF 标准 72pt = 1in，HTML/CSS 默认 96px = 1in。任何把 PDF 几何信息转 CSS 渲染的代码路径都必须显式应用 `96/72 ≈ 1.333` 系数。R7 在 `_image_to_markdown` 集中应用，未来扩展 table / formula 等几何输出时需注意同理；
  3. **`get_pixmap(clip=region)` 是 PDF 矢量信息保真的标准做法**：PyMuPDF `get_images()` 仅抽嵌入位图，对矢量绘图层无能为力；`page.get_pixmap(matrix=zoom, clip=rect)` 可对任意 layout region 重渲染完整视觉。Zoom 因子建议 ≥ 2.0（150 DPI）以保留高清；
  4. **stage 输出契约变更需双向兼容**：`_render_figure_regions` 返回值从 `List` → `Tuple[List, Set]` 是 breaking change，必须同步修改所有调用方（仅 1 处：`FitzImageExtractor._run`）。新增 stage tool 时务必锁定签名；
  5. **R7 修改面**：`image_extraction.py`（去重反转 + 阈值更名 + 返回签名变更）+ `assembly.py`（pt→px 换算常量与应用）+ 测试加固。所有改动语义独立，可单文件 cherry-pick；
  6. **R6 与 R7 是同一缺陷的两层修复**：R6 用 `_block_overlaps_special` 把 figure overlay 文本抑制掉（避免散落），但牺牲了 figure 视觉信息；R7 用 `page.get_pixmap(clip=figure_region)` 把 overlay 文本重新成像入 figure（恢复视觉），并通过反向去重剔除 raster 避免双轨。两轮结合后 R6 抑制的 caption 例外保留逻辑依然生效（独立段落 caption + alt 同时保留）。

### 第八轮迭代（2026-05-26 Docling 公式 bbox 透传 + PyMuPDF 公式残片清理）

R7 后浏览器对照 Section 2.1 区域发现两类正交缺陷：
1. **公式顺序错乱**：Definition 3 后 PDF 中先 `Char: E → P(F) (1)` 再 `C = ⋃ Char(e) (2)`，markdown 输出却是 (2) 在 (1) 上方；
2. **`C = [` 残片单独成段**：PyMuPDF 在 Definition 3 后跟的公式视觉区抽出 `C = [` 起手残片，与公式 stage 主体共存却互相不命中签名兜底（残片长度 < 20 触发 `_formula_text_signature` 最小长度阈值）。

- **表因**：mineru 公式 stage 在 28 页学术论文 600s 超时降级 docling 后，docling `_extract_formulas` 仅从 markdown 文本里 regex 抽取公式（无 bbox 字段），assembly 五级稳定排序键 `(page, col, y0, x0, reading_order)` 中 y0 维度无信息可用，公式按 enumerate 顺序兜底（≠ 视觉顺序），出现 Section 2.1 中 Eq(1) Eq(2) 顺序倒置等回归。同时 PyMuPDF 在公式视觉区抽取的 `C = [` 残片绕过签名兜底，与公式主体并存。

- **根因**：
  1. **Docling 公式适配器从未输出 bbox**：[`pdf/engines/docling.py::_extract_formulas`](../../apps/negentropy-perceives/src/negentropy/perceives/pdf/engines/docling.py) 历史实现只用 markdown `$$...$$` / `$...$` 正则匹配，完全忽略 `doc.iterate_items()` 中 `label='formula'` 的 item 自带的 `prov[0].bbox`。这是 docling stage 与 mineru/marker 适配器的契约不一致 —— mineru 已通过 `content_list.json::bbox` 字段透传 bbox。
  2. **公式残片签名兜底盲区**：[`assembly.py::_text_block_matches_formula`](../../apps/negentropy-perceives/src/negentropy/perceives/pipeline/stages/pdf/assembly.py) 与 `_formula_text_signature` 的 ≥ 20 字符最小阈值是为避免短 LaTeX 与正文假阳性匹配。但 PyMuPDF 把长公式视觉区拆为「短残片 + 后续字符流」时，残片字符 ≤ 6 完全绕过签名匹配，遗留在 markdown 中。

- **处理方式**：
  1. **`DoclingFormula` 加 `bbox: Optional[Tuple[float, float, float, float]]` 字段**；`_extract_formulas` 优先路径：遍历 `doc.iterate_items()` 拿 `label == "formula"` 的 item，从 `item.text` 抽 latex（剥离 `$$...$$` / `$...$` 包裹），从 `prov[0].bbox` 经 `_to_topleft_bbox` 拿 TopLeft 坐标系 bbox；同 latex 字符串去重；当 iterate_items 为空或不可用时降级到 markdown 正则匹配（保持向后兼容，无 bbox）。
  2. **`formula_extraction.py::DoclingFormulaExtractor`** 透传 `bbox` 字段到 `ExtractedFormula`，与 mineru extractor 适配器对齐。
  3. **`assembly.py` 新增 2.5.5 段公式残片清理**：`_FORMULA_FRAGMENT_RE = re.compile(r"^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$")` 匹配「Identifier = Open-Bracket」短公式残片（≤ 15 字符），且紧邻下一个 element 是公式时剔除（避免误删合法的赋值起手）。

- **量化效果**（28 页 Context Engineering 2.0）：
  - **Section 2.1 阅读顺序**：Definition 1 → Eq(1) → Definition 2 → Definition 3 → Eq(2) → Definition 4 → Eq(3) → Eq(4) → ... 全部按视觉顺序，与 PDF 原版 1:1 等价；
  - **`C = [` 残片**：消失（被 2.5.5 段命中剔除）；
  - **Definition 1 段落**：完整保留（R7 时因 docling 公式无 bbox 导致 element 排序错乱被 dedup 误删；R8 后 docling 给的公式带 bbox，五级排序正确，Definition 1 段落保留）；
  - **block math `$$...$$`**：7 个（Eq 1, 2, 3, 4, 5, 6, 7 全部）；
  - **char_count**：113108 → 114815（+1707，恢复了之前丢失的 Definition 1 + Eq 5/6/7 的 latex 主体）；
  - **既有单测**：本期新增 6 例 `test_docling_formula_bbox.py`（iterate_items 优先路径 + 降级路径 + 去重 + dollar wrapping 剥离 + label 过滤）+ 11 例 `test_assembly_formula_fragment.py`（残片正则边界），既有 1587 例无回归。

- **八轮防范要点补充**：
  1. **stage 适配器必须透传所有可用元信息**：docling adaption 缺 bbox 是历史遗漏，引擎本身在 `iterate_items` 中已有 prov.bbox 字段。任何 stage 引擎切换链路上必须保证「能透传则透传」，缺失元信息会让下游 assembly 排序退化；
  2. **`_extract_*` 优先 doc 结构，降级 markdown 正则**：docling、marker、mineru 等都通过 markdown export 输出公式 / 表格，但 markdown 是「丢失元信息」的扁平表示。优先用 `doc.iterate_items()` 拿结构化项，markdown 正则仅作为降级路径；
  3. **签名兜底必须双向**：公式 LaTeX 字符流签名 + 公式残片正则两层兜底缺一不可。前者拦截"完整公式视觉区字符流"，后者拦截"残片 + 公式主体"组合；
  4. **assembly 五级排序的 y0 维度依赖上游 bbox 完整性**：上游 stage 任何一个公式无 bbox 都会落到同页末尾，破坏视觉顺序。新增 stage tool 必须强制 bbox 透传 + 单测锁定；
  5. **`C = [` / `M_l =` 类残片正则模式**：`^\s*[A-Za-z]\w*\s*=\s*[\[\(\{]\s*$` 兼容多字符 identifier（CE、Var）、下标 (`M_l`)、各种 open bracket（`[ ( {`）；起手限定为字母（避免误命中 `1 = ` 行号）；
  6. **R8 修改面**：`pdf/engines/docling.py` + `pipeline/stages/pdf/formula_extraction.py` + `pipeline/stages/pdf/assembly.py` 三文件 + 2 新增单测文件。改动语义独立，可单文件 cherry-pick。

---

## ISSUE-095 Interface / Tools `Test Connection` 与 Tool 详情读取 500 — `check_plugin_access` 调用缺第 5 参数（2026-05-27）

- **表因**：用户在 [Interface / Tools](http://localhost:3192/interface/tools) 页打开任一 Tool（如 `google_search`）后点击 **Test Connection** 按钮，UI 立即抛出：
  ```json
  { "error": { "code": "PLUGINS_UPSTREAM_ERROR", "message": "Internal Server Error" } }
  ```
  导致用户在保存配置前无法验证 API Key / CX ID 等凭证可用性，「测试连接」前置兜底闭环完全失效。同一类缺陷还命中 `GET /interface/tools/{id}` 详情读取端点。
- **根因**（单点故障 → 三层错误传递链）：
  1. **后端调用方契约漂移**：[`apps/negentropy/src/negentropy/interface/api.py`](../../apps/negentropy/src/negentropy/interface/api.py) 在 `get_builtin_tool` (旧 L1463) 与 `test_builtin_tool` (旧 L1540) 中以 4 参数调用 [`permissions.check_plugin_access`](../../apps/negentropy/src/negentropy/interface/permissions.py)：
     ```python
     has_access, error = await check_plugin_access(db, "builtin_tool", tool_id, user)
     ```
     而函数签名 `async def check_plugin_access(db, plugin_type, plugin_id, user, required_permission: str)` 第 5 参数 `required_permission` 无默认值 → Python 抛 `TypeError: check_plugin_access() missing 1 required positional argument: 'required_permission'`。同 PR (#511) 共 17 处 `check_plugin_access` 调用，**仅 `builtin_tool` 这两处漏传**，`mcp_server / skill / sub_agent` 全部正确，形成「绿叶丛中两片黄」型遗漏。Blame 锁定 commit `39938525`（PR #511, 2026-05-11 «feat(tools): 新增 Tools 管理系统»），缺陷自该 PR 落地起潜伏 16 天。
  2. **Starlette ServerErrorMiddleware 兜底为裸文本 500**：未被 FastAPI 异常处理器捕获的 `TypeError` 由 Starlette 默认 `ServerErrorMiddleware._unexpected_exc` 返回 `PlainTextResponse("Internal Server Error", status_code=500)`，**不是** FastAPI 习用的 `{"detail": "..."}` JSON。
  3. **Next.js UI 代理包装为 PLUGINS_UPSTREAM_ERROR**：[`apps/negentropy-ui/app/api/interface/_proxy.ts`](../../apps/negentropy-ui/app/api/interface/_proxy.ts) 的 `upstreamErrorResponse` 对非 OK 响应尝试 `JSON.parse(text)`，裸文本 `"Internal Server Error"` 解析失败 → fallthrough 到 `errorResponse("PLUGINS_UPSTREAM_ERROR", text, status)` —— 即用户最终看到的题面 JSON。
- **漏网原因**：
  - 项目 CI 未强制 mypy strict-mode（4-arg 调用属于「静态类型可发现」缺陷）；
  - 该端点缺乏对应单元测试，CI 跳过即 OK；
  - `_proxy.ts` 错误包装把上游 500 「升格」为带专用 code 的结构化响应，**反而掩盖了**原始服务端 stacktrace 暴露给观察者的可能性。
- **处理方式**：
  1. **补齐第 5 参数**（最小干预）：[`api.py:1466`](../../apps/negentropy/src/negentropy/interface/api.py) 与 [`api.py:1546`](../../apps/negentropy/src/negentropy/interface/api.py) 改为 `await check_plugin_access(db, "builtin_tool", tool_id, user, "view")`。选 `"view"` 而非 `"edit"` 的依据：
     - 系统内置 `google_search`（`is_system=True`）走 [`permissions._is_plugin_builtin`](../../apps/negentropy/src/negentropy/interface/permissions.py) 分支：`view` 全员通过、`edit` 仅 admin。改 `"edit"` 会让非 admin 用户无法测试系统内置工具，违背设计语义；
     - 测试连通性不写库，与 MCP 同类只读端点（[`list_mcp_tool_runs` 在 api.py:1318](../../apps/negentropy/src/negentropy/interface/api.py)）用 `"view"` 对齐；
     - 用户自有 Tool 经 owner 分支短路通过，与 `view/edit` 取值无关。
  2. **契约测试**（核心防回归）：新增 [`tests/unit_tests/interface/test_builtin_tool_api.py`](../../apps/negentropy/tests/unit_tests/interface/test_builtin_tool_api.py) 12 用例，三层覆盖：
     - **签名锁定**：`inspect.signature(check_plugin_access)` 断言 5 参 + `required_permission` 无默认值。若 `permissions.py` 签名再变更，单测立即失败，强制同步全部调用点；
     - **调用点契约**：`patch.object(api, "check_plugin_access")` 捕获实际 `await_args`，断言 `get_builtin_tool` 与 `test_builtin_tool` 都传 5 个位置参数且末尾 == `"view"`。**这是真正阻断本类回归的关键 —— 不依赖运行时是否 raise**；
     - **业务路径**：mock `httpx.AsyncClient` 覆盖 Google Search 200 / 403 / 缺凭证 / 不支持 tool_type / 404 等 5 条正交分支；额外验证 inline payload 优先于 DB 存储（「未保存即可测试」契约）。
  3. **浏览器实机回归**（chrome_devtools 接入用户主 Chrome 真实登录态）：连续 3 个正交 case 全绿、截图存档 [`docs/.agents/screenshots/issue-095-case-c-invalid-key.png`](./screenshots/issue-095-case-c-invalid-key.png)：
     - **Case B 凭证为空** → HTTP 200 + `{"success":false,"message":"API Key or CX ID is not configured","latency_ms":null}`（不发外网请求）；
     - **Case C 凭证错误** → HTTP 200 + `{"success":false,"message":"API error: API key not valid...","latency_ms":278.1}`（穿透 → Google API → 业务文案）；
     - **Case D 详情读取** → HTTP 200 + 完整 `BuiltinToolResponse`（L1463 同步生效）。
     - 后端日志 `tail` 确认 0 次 `TypeError` / `Exception in ASGI` / 5xx 复现。
- **后续防范**：
  1. **静态防护**：在 [`apps/negentropy/pyproject.toml`](../../apps/negentropy/pyproject.toml) 评估对 `negentropy.interface` 子包 enable mypy strict 模式，或至少加入 `.pre-commit-config.yaml` 的 mypy hook scope；本类「调用方实参数 < 形参数」缺陷属典型 mypy 可发现项；
  2. **Review 红线**：任何 `check_plugin_access` / 同类权限 API 调用必须显式传 `required_permission` —— 新增 plugin 端点时按 [`test_builtin_tool_api.py`](../../apps/negentropy/tests/unit_tests/interface/test_builtin_tool_api.py) 「契约测试模板」复制 2 条断言（5 参 + 末位值）；
  3. **错误包装层的可观测性补强**：`_proxy.ts:upstreamErrorResponse` 当前会把上游 plain-text 500 完全隐藏 stack。考虑在该路径上把 `response.status` 体现在 error.code（如 `PLUGINS_UPSTREAM_500` / `PLUGINS_UPSTREAM_502`），便于运维 / 用户一眼分辨「真正的上游 5xx」与「连接拒绝 / 超时」，但这是后续抛光项，不在本次最小修复范围；
  4. **「签名 + 调用点」对称约束**：本 ISSUE 沿用 [ISSUE-089](#issue-089) 「ORM ↔ 迁移漂移」的思路扩展到 Python 函数签名层。任何 `def f(..., required_*: str)`（必填、无默认值）型参数引入时，必须在 PR review 时 grep 出全部调用点同步更新。
- **同类问题影响**：
  - 与 [ISSUE-089](#issue-089) 同属 `builtin_tool` 端点 500 家族但根因正交：089 是 ORM Enum ↔ Migration VARCHAR 类型漂移，095 是 Python 函数签名 ↔ 调用点参数数量漂移；两者共同提示「跨层契约一致性」是 `builtin_tool` 子系统的主要熵源（因 PR #511 引入时间紧、未对齐 mcp/skill/sub_agent 的成熟模板）。
  - 与 [ISSUE-010](#issue-010)（字段名漂移）、[ISSUE-017](#issue-017)（前后端 + SSG 三源漂移）、[ISSUE-018](#issue-018)（BFF JSON body 强制契约）共同构成「跨层契约漂移」问题谱系；
  - 推广价值：本 ISSUE 新增的「**`patch.object` 捕获 await_args，断言实参数 == N 且末位 == V**」契约测试模式，可推广到任何「必填位置参数 + 团队约定取值范围」的内部 API。比起断言运行时是否抛错，前者能在 IDE 跳转级粒度立刻定位缺陷。

---

## ISSUE-096 Composer @ 唤出框：四 Tab 决策负担过重 + 文字密度挤占视觉（2026-05-27）

- **表因**：Home/Studio 输入框 `@` 唤出框暴露 4 个并列 Tab（Agents / 知识检索 / 输出沉淀 / 图谱模式），用户键入 `@` 后被迫先决策「以什么方式使用 Corpus」再选「用哪个 Corpus」；同一份 Corpus 被拆到 `corpus-retrieve` / `corpus-output` / `graph` 三个 MentionKind，弹层顶部图标 + 中文文字并排挤占宽度，视觉密度低。
- **根因**：早期产品阶段把后端三个不同的语义动作（检索范围 / 输出沉淀 / 强制图谱）直接映射到三个用户可见 Tab。这违反了「用户只表达意图，由系统决定执行路径」的原则——后端 HybridPlanner 本身就能根据 query Intent + effective corpus 数量自主决策是否触发 graph expansion，无需前端额外强制信号；输出沉淀更适合走显式 UI 入口或后续 IntentClassifier，不应作为 mention 默认行为。
- **处理方式**（前后端一并迁移）：
  1. **类型层（packages/agents-chat-core）**：`MentionKind` 收敛为 `agent | corpus`（删除 `corpus-retrieve` / `corpus-output` / `graph`）；`DerivedMentionProps` 改为 `{ preferred_subagent, corpus_ids }`；`buildStateDeltaFromForwardedProps` 删除 `scoped_corpus_ids` / `output_corpus_ids` / `graph_mode_corpus_ids` 三块分支，新增 `corpus_ids` 分支（沿用 sanitize / 空数组显式清空语义）。
  2. **UI 层（apps/negentropy-ui）**：引入 `@radix-ui/react-tooltip`；`MentionPopover` Tab 收敛为 2 项（Agents / Corpus），按钮仅图标 + `aria-label` + Radix Tooltip on hover；`MentionChipList` 颜色映射收敛为 sky（agent）+ emerald（corpus）；Composer 底部提示文案改为「@ 选对象」。
  3. **接入层（home-body.tsx）**：`corpusCandidates.kind` 改为 `"corpus"`；forwardedProps 单字段 `corpus_ids`；移除 RUN_FINISHED 中 ingest 沉淀链路（含 `outputCorpusIdsByRunRef` / `userPromptByRunRef` / `conversationTreeRef` / `extractFinalAssistantText` / `ingestText` 等遗留资产）。
  4. **后端层（apps/negentropy）**：`perception.py` 把 state key 由 `scoped_corpus_ids` / `graph_mode_corpus_ids` 收敛为 `corpus_ids`；`hybrid_planner.py` 移除 `force_graph_mode` 参数与 `_classify_intent(..., force_graph_mode)` 分支，graph expansion 仅由 Intent + effective corpus 数量自主决策。
  5. **测试同步**：`MentionPopover.test.tsx` / `mention-parser.test.ts` / `state-delta.test.ts` / `agui-route-state.test.ts` / `test_hybrid_planner.py` / `test_search_knowledge_base_scope.py` 等 6 处用例同步新字段名与 2 Tab 契约。
- **后续防范**：
  1. **用户语义 vs 系统执行**：UI 入口只承载「想用什么对象」级语义，绝不把「以什么方式使用」的执行决策外溢成 N 个 Tab；任何「检索 vs 沉淀 vs 强制图谱」类二分决策应由后端 IntentClassifier 或独立 UI 入口承载。
  2. **forwardedProps 字段单一事实源**：mention 派生字段命名要与后端 state key 保持 1:1 对齐（前端 `corpus_ids` ↔ ADK state.corpus_ids ↔ tool_context.state.corpus_ids），避免多语义字段并存导致跨 turn 状态污染。
  3. **空数组清空语义**：跨 turn 残留是 BFF→ADK 链路的高频 bug 源。新增 mention 派生字段时，前端必须在每轮 turn 显式发送字段（含空数组），BFF 据空数组写入 state_delta 触发清空。
  4. **Ingest 智能识别闭环（已落地）**：通过 `engine/utils/action_intent.py` 关键词分类器 + `agents/agent.py::_pick_root_model` 写 `state.action_intent_hint` + Root instruction「Ingest 意图分流」段 + `agents/tools/ingest.py::ingest_to_corpus` 工具 + InternalizationFaculty instruction「Ingest 触发协议」段五件套，把「沉淀」语义还给 LLM 自主决策，避免 UI 入口反弹。详见 [docs/concepts/037-federated-kg.md §5.5](../concepts/037-federated-kg.md#55-ingest-智能识别intentclassifier)。
- **同类问题影响**：未来若需引入「@ Tool」「@ Memory」等新类别 mention，必须先评估能否合并到现有 `MentionKind`（如以「对象类别」而非「使用方式」为维度），避免再次发散为多 Tab。

### 后续 PR：Ingest 智能识别（IntentClassifier）实机验证记录（2026-05-27）

- **单测全过**：`test_action_intent.py` 17 例 + `test_ingest_to_corpus.py` 11 例 + `test_paper_tools.py` 既有 11 例 + 其他 25 例 = **64 例全通**（无回归）。
- **浏览器实机（chrome_devtools，主 Chrome 已登录用户）**：
  - 场景 1（retrieve）：用户 `@Harness Engineering` 后追问「查询 davao-v2 是什么项目」→ Root 派 KnowledgeAcquisitionPipeline → PerceptionFaculty 4 次 `search_knowledge_base` + 4 次 `search_web` → InternalizationFaculty 调 `save_to_memory` + `update_knowledge_graph` 收尾。**未触发 `ingest_to_corpus`，符合预期**。forwardedProps 透传 `corpus_ids: ["43bacd7e..."]` 正确。
  - 场景 2（ingest 触发）：用户 `@Harness Engineering 把"HippoRAG ..."沉淀到这个 Corpus` → forwardedProps 含 `corpus_ids`，LLM 已被 `_ROOT_INSTRUCTION` 引导 transfer 到 InternalizationFaculty——但 ADK 框架抛 `'SequentialAgent' object has no attribute 'mode'` 后阻断了 ingest tool call 的实际落地。
- **已知阻塞（独立于本次改动）**：ADK 框架 `SequentialAgent` 缺 `mode` 属性。在 KnowledgeAcquisitionPipeline 之类 SequentialAgent 与具备 `mode` 字段的 LlmAgent（如本次 InternalizationFaculty）混用时会触发 `event_generator` 错误。该错误**不是**本 PR 引入——但本 PR 提供的 `ingest_to_corpus` 端到端验证因此暂时被阻断。
- **应对建议**：
  1. 短期：把 InternalizationFaculty 的 `mode="single_turn"` 暂时改为 `mode=None`（恢复默认行为），让 ingest_to_corpus 链路实机验证完成；或单独使用 `transfer_to_agent("InternalizationFaculty")` 不经 Pipeline 时直跑。
  2. 中期：升级 ADK 框架到修复版本，或为 `SequentialAgent` 注入 `mode` 默认属性的 monkey-patch。
  3. 长期：在 ADK 仓库开 issue 跟踪。
- **不影响合并**：单测覆盖了 ingest_to_corpus 的越权防御 / Approval / 失败降级 / metadata 注入等所有契约语义；前端 corpus_ids 透传、Root callback 写 hint、Faculty 注册、Approval 白名单等都已通过浏览器 NDJSON 流验证。生产侧只待 ADK 框架 fix 即可端到端跑通。

---

## ISSUE-097 negentropy-ui 语义 token 工具类半失效（Tailwind v4 `@theme inline` 映射不全）

- **表因**：`globals.css` 已声明 `--muted` 等 CSS 变量，但组件大量使用的 `text-muted` / `bg-muted` / `text-primary` / `bg-primary` / `bg-accent` / `text-accent-foreground` / `text-muted-foreground` / `text-destructive` / `ring-ring` 等工具类在页面上「静默失效」——颜色回退到继承值或透明，明暗与层级一致性下降。
- **根因**：Tailwind v4 下工具类仅在 `@theme inline` 映射了对应 `--color-*` 时才会生成。`globals.css` 只映射了 `--color-text-*`（产出 `text-text-muted` 等），但**未映射** `--color-muted/-primary/-accent/-secondary/-destructive/-ring/-*-foreground`，因此 shadcn 习惯写法 `text-muted` 等并不存在。全站约 **638 处 / 96 文件** 命中此问题。
- **关键约束（不可调和的重载）**：`text-muted`（弱化**文本**，期望 `#71717a`，**374 处/78 文件**）与 `bg-muted`（浅色**表面**，期望 `#f4f4f5`，**118 处/56 文件**）共用同一 `--color-muted`，取任一值都会让另一方出错。故「全局补全」**必然附带**一次约 500 处类名、跨 ~90 文件的 codemod（如 shadcn 标准：`muted`=surface + 全量 `text-muted`→`text-muted-foreground`），并需全站明暗双主题回归。
- **本次处理（Studio 范围，PR：Home/Studio UI 精修）**：仅在 Studio 涉及文件内把失效类收敛到**已定义等价物**（`text-muted`→`text-text-muted`、`bg-muted`→`bg-border-muted`、`text-accent-foreground`→`text-foreground` 等），并**新增** `--color-primary/-foreground/-hover` 与 `--color-ring`（净增、零值冲突，统一主强调色 indigo）。未触碰其它页面渲染。
- **后续防范 / 待办（独立专项 PR）**：对全站执行 token 规范化 codemod——在 `@theme inline` 补齐 `--color-muted/-foreground`、`--color-accent/-foreground`、`--color-secondary/-foreground`、`--color-destructive/-foreground` 等，并按 shadcn 语义统一改写重载用法；提交前对 Studio / Dashboard / Knowledge / Memory 主路由做明暗双主题回归。
- **同类问题影响**：所有沿用 shadcn 命名（`muted/primary/accent/secondary/destructive`）的组件均受影响；新增组件应优先使用本仓已定义的 `text-text-*` / `bg-card` / `border-border` / `bg-border-muted` / `text-success|warning|error|info` / `bg-primary` 等，避免再次引入未映射工具类。

---

## ISSUE-098 Memory Hybrid 检索长期静默失效（双层缺陷：缺 DB 函数 + SQLAlchemy `::` 绑定 bug）

- **表因**：`PostgresMemoryService.search_memory` 的 Hybrid 策略从未真正生效——每次检索都从 `hybrid` 静默回退到纯向量（`vector`）检索，且因 F1 HippoRAG PPR 仅在 Hybrid 分支做 RRF 融合，PPR 通道被连带架空（即便 `hipporag.enabled=true` + KG 关联越过数据闸也不融合）。
- **根因（两层独立缺陷）**：
  1. **缺 DB 函数**：`_hybrid_search_native` 调用 `negentropy.hybrid_search()`，但该函数仅存在于 `docs/reference/cognizes/engine/schema/perception_schema.sql` 与 cognizes app 的 schema 文件中，**从未移植成 negentropy alembic 迁移**；`memories` 表也缺 `search_vector tsvector` 列与 GIN 索引。线上 `pg_proc` 查无此函数 → `UndefinedFunctionError`。
  2. **SQLAlchemy 绑定 bug**：SQL 用 `:embedding::vector(1536)`。`text()` 把 `::` 误解析为绑定名分隔符，导致 `:embedding` 不被绑定、渲染出裸 `:` 触发 `PostgresSyntaxError: syntax error at or near ":"`。即便函数存在也会失败。
- **处理方式**：
  1. 新增迁移 `0047_memory_hybrid_search_function.py`：为 `memories` 增 `search_vector` 列 + BEFORE INSERT/UPDATE OF content 触发器（`to_tsvector('english', content)`）+ 回填存量行 + GIN 索引；以 perception_schema.sql 权威定义创建 schema 限定的 `negentropy.hybrid_search()`（语义 + BM25 FULL OUTER JOIN 加权融合）。纯新增、不改写既有数据。
  2. 修 `memory_service.py::_hybrid_search_native`：`:embedding::vector(1536)` → `CAST(:embedding AS vector(1536))`，并把 embedding 序列化为 pgvector 字面量 `'[...]'` 后绑定。
- **验证**：新增 `tests/integration_tests/engine/test_ppr_fusion.py`（种入 Corpus + KgEntity×2 + KgRelation + ≥100 entity 关联，断言 PPR 实跑并融合；稀疏 KG 下数据闸自休眠回退 Hybrid）；`test_memory_service.py` 6 例 + RRF/PPR 单测 34 例全绿。日志由 `search_fallback ... to_level=vector` 变为 `hybrid_search_completed`。
- **后续防范**：
  1. **运行时依赖的 DB 函数必须有迁移**：任何 `_native` 路径调用的 SQL 函数都要在 alembic 迁移中 `CREATE OR REPLACE`，并配单测在真实库断言函数存在 + 端到端跑通；`.sql` schema 文件只是参考，不是生效源。
  2. **`text()` 内禁用 `:param::type`**：一律用 `CAST(:param AS type)`，避免 `::` 与绑定名歧义。仓内可加 lint/grep 守卫扫描 `:%w+::`。
  3. **降级要可观测**：Hybrid→vector 这类「静默回退」必须升级日志级别或暴露指标（如 `/memory/metrics` 增 hybrid_fallback_count），否则核心特性失效数月无感。
- **同类问题影响**：`kb_hybrid_search()`（Knowledge 侧）与任何引用 perception_schema.sql 但未迁移的 SQL 函数都应排查是否存在同样「schema 文件有、迁移没有」的断裂；所有 `text()` 拼 `::vector` 的检索/向量路径都应改 `CAST`。

---

## ISSUE-099 F4 Presidio PII 在热路径上是死代码（写侧绕过工厂 + 检索守门员从未接线）

- **表因**：把 `memory.pii.engine` 改成 `presidio` 对生产行为零影响；检索路径对低权限角色也从不脱敏含 PII 的记忆。F4「生产级 PII 治理」实质未生效。
- **根因（两处接线断裂）**：
  1. **写侧绕过工厂**：`memory_service` 的 `_simple_consolidate`（`:157`）与 `add_memory_typed`（`:1493`）硬编码调用 legacy `pii_detector.detect`（固定 `RegexPIIDetector`），从不读 `settings.memory.pii.engine`、从不经 `get_pii_detector()`，使 `PresidioPIIDetector` 成为热路径死代码；且只落 `metadata.pii_flags`（计数），不落 `pii_spans`。
  2. **检索守门员未接线**：`PIIGatekeeper` 定义并导出，但 engine 内**零调用点**（grep `PIIGatekeeper`/`from_settings` 仅命中定义处）。即便启用也因写侧不落 `pii_spans` 而无数据可遮蔽。
- **处理方式**：
  1. 新增 `engine/governance/pii/storage_helper.py::detect_pii_for_storage(content)`：经 `get_pii_detector()`（工厂引擎）检测，返回 `(flags, spans_json)`；异常降级空结果不阻断写入。两处写侧改用之，落 `pii_flags` + `pii_spans`。
  2. 检索侧：`_build_search_response` 增 `viewer_role` 形参，出口处经 `PIIGatekeeper.from_settings()` 按角色 mask/anonymize（受 `gatekeeper_enabled` 控）；`search_memory` 透传 `viewer_role`。
  3. `PIISettings` 增声明字段 `retrieval_policy`（独立于写入 `policy`）。
  4. 依赖默认化：`pyproject.toml` 把 presidio/spacy 从 optional extra 提升为主依赖；新增 CLI `negentropy bootstrap-pii-models` 下载 spaCy NER 模型（`en_core_web_lg` / `zh_core_web_sm`，独立下载产物非 pip 依赖）。
  5. `config.default.yaml` 翻转：`engine: presidio` + `gatekeeper_enabled: true` + `allow_engine_fallback: true`（缺模型降级 regex 并写 ERROR，经 `/memory/health` 可观测，不阻断启动）+ `retrieval_policy: anonymize`。
- **验证**：新增 `tests/integration_tests/engine/test_pii_writepath.py` 7 例（写侧 flags+spans / 低权限 anonymize / 高权限透传 / 守门员关闭透传 / presidio PERSON NER / 缺模型降级 regex / fallback=false 抛错）；既有 `test_pii_phase5.py` 24 例无回归。
- **后续防范**：
  1. **工厂是唯一入口**：凡「可切换引擎」的能力（PII / Memory backend / 检索）都必须经工厂解析，禁止业务代码硬编码具体实现，否则 settings 形同虚设。可加单测断言写路径经 `get_pii_detector()`（如 monkeypatch 工厂验证被调用）。
  2. **定义即接线**：新增 governance 组件（如 Gatekeeper）须同时提供调用点 + 端到端测试，避免「定义了但没人用」的僵尸代码；可用 grep 守卫扫描导出符号的调用点数。
  3. **重模型依赖要可观测 + 可降级**：默认引擎依赖大模型下载时，必须提供 bootstrap 命令 + 缺失降级 + health 暴露实际引擎，兼顾开箱即用与保密性优先。
- **同类问题影响**：Memory backend 工厂（InMemory/VertexAI/Postgres）、检索引擎切换等所有「可插拔」点都应核对业务代码是否真的经工厂；任何 `settings.*.engine` 类开关都要有「翻转后行为确实改变」的测试佐证。

---

## ISSUE-100 测试隔离：test_runner_artifacts 永久污染 sys.modules 致下游测试拿到 MagicMock

- **表因**：全量跑 engine 测试时，`test_full_pipeline` / `test_ppr_fusion` 等真实集成测试报 `object MagicMock can't be used in 'await' expression`（`get_association_service` / `get_fact_service` / `upsert_fact` 等返回 MagicMock）。单独跑各文件均通过，仅在与某些文件同会话时复发。
- **根因**：`tests/integration_tests/engine/test_runner_artifacts.py` 在**模块导入期**调用 `mock_modules()`，用 `sys.modules["negentropy.engine.factories.memory"] = MagicMock()`（及 session 工厂、agents、google.adk.runners）永久替换真实模块且**从不还原**。pytest 单会话内 `sys.modules` 全局共享，导致此文件被收集后，后续任何 `from negentropy.engine.factories.memory import get_*` 都拿到 MagicMock 属性。
- **处理方式**：改为「临时替换 + 立即还原」——`_install_temp_mocks()` 保存原始引用、装上 mock 仅为让 `runner` 工厂可导入；`try/finally` 中 import 完成后 `_restore_modules()` 还原 `sys.modules`（原本不存在的键 pop 掉，存在的还原）。测试自身行为不变（其在用例体内用 `patch` 注入 Runner / artifact_service）。另在受影响集成测试加 autouse `reset_*_service()` 防御性兜底。
- **后续防范**：
  1. **禁止模块级永久改 sys.modules**：测试如需 mock 模块以绕过重导入，必须用 fixture + finalizer 或 `try/finally` 还原；模块级副作用会跨文件泄漏。
  2. **真实集成测试防御工厂污染**：依赖工厂单例的集成测试可在 fixture 里 `reset_*` 兜底。
  3. **CI 应跑全量同会话**：`uv run pytest tests/`（不分目录）才能暴露此类跨文件污染；分目录跑会掩盖。
- **同类问题影响**：任何 `sys.modules[...] =` 或模块级 `patch.dict("sys.modules", ...)` 不还原的测试都应排查；优先 grep `sys.modules\[` 审计。

---

## ISSUE-101 Presidio 中文分析失效：AnalyzerEngine 未装配 zh NLP 引擎致 CN 识别器全失效

- **表因**：实机巩固日志反复出现 `presidio_analyze_failed lang=zh error="'zh'"`；中文文本里的手机号 / 身份证（CN_MOBILE / CN_ID_CARD 自定义识别器，supported_language='zh'）完全不命中，身份证还被英文模型误标成 `date_time`。
- **根因**：`PresidioPIIDetector` 用 `AnalyzerEngine(supported_languages=["en","zh"])` 但**未提供 nlp_engine**。Presidio 默认 NLP 引擎只配了 en（`en_core_web_lg`）；分析 zh 文本时按 `nlp_engine.process_text(text, "zh")` 查不到 zh 模型抛 `KeyError('zh')`，该语言整条分析链（含挂在 zh 上的自定义 PatternRecognizer）被跳过。
- **处理方式**：新增 `PresidioPIIDetector._build_nlp_engine(languages)`：按语言→spaCy 模型候选表（en→lg/sm、zh→`zh_core_web_sm`）探测已安装模型，用 `NlpEngineProvider(nlp_configuration={"nlp_engine_name":"spacy","models":[{lang_code,model_name},...]})` 显式构建多语 NlpEngine 注入 AnalyzerEngine；缺模型的语言被剔除（优雅降级），并只注册 supported_language 在可用集合内的识别器。
- **验证**：新增 `test_presidio_detects_cn_mobile_via_zh_nlp_engine`——`13912345678` 经 CN_MOBILE 命中 `phone`；EN PERSON/email 仍正常；既有 31 例 PII 测试无回归。实机日志 `presidio_analyze_failed lang=zh` 消除。
- **后续防范**：多语 NLP/检索引擎必须显式声明每语言的模型/资源映射，不能依赖库默认（默认通常单语）；新增语言时同步扩 `_build_nlp_engine` 候选表 + bootstrap 模型清单（`_PII_SPACY_MODELS`）。
- **同类问题影响**：任何按 `supported_languages` 跑多语的组件（NER、翻译、检索）都要核对底层引擎是否真的为每种语言装配了资源。

---

## ISSUE-102 裸 `text-[Npx]` 魔法字号全站规范化为语义令牌

- **表因**：`negentropy-ui` 全站约 450+ 处裸 `text-[10px]/[11px]` 等任意小字号散落 113 文件，无语义、无单一事实源、档位混用（8/9/10/11/12/13px）；上一处 `body` 行高改无单位修复（`d3883bdc`）后它们虽能正确缩放，但仍是难维护的魔法数字。
- **根因**：设计令牌标度（`apps/negentropy-ui/app/globals.css` 的 `@theme inline`）止于 `--text-body`(14px)，缺 caption 档语义令牌，开发者只能就地写任意 px。
- **处理方式**：
  1. 新增 `--text-caption`(0.6875rem/11px)、`--text-micro`(0.625rem/10px)，**故意不配对 `--line-height`**——Tailwind v4 仅输出 `font-size`，与裸 `text-[Npx]` 行为逐字节一致，行高沿用 body 无单位 1.375 比值；对 10/11px 主流站点实现像素零变化（含祖先覆写行高），低于 micro 两档下限的原 8/9px 站点随之上调至 10px（见验证项与 review 收口补充）；
  2. 机械替换 `text-[11px]→text-caption`、`text-[10/9/8px]→text-micro`（脚本前置核验：**零** `text-[Npx]` 出现在 `[&_]:`/`sm:` 变体前缀中 → 安全）；
  3. overline 模式（`uppercase`+小字号）：39 个 `tracking-wide/wider`(0.025/0.05em) + 19 个无字距统一为既有 `tracking-overline`(0.06em)，**保留** 13 个故意更宽的 `tracking-widest`(0.1em)/`tracking-[0.16~0.24em]`（折叠会可见收窄，违背最小干预）；
  4. `text-[12/13px]`(3 处) 介于 caption 与 body 之间、两档模型无对应，保持原值豁免。
- **验证**：残留 `text-[8/9/10/11px]`=0；`text-caption`=198、`text-micro`=267、`tracking-overline`=55 与基线精确对账；编译 CSS 确认仅 `font-size`；chrome_devtools computed-style 探针证 **10/11px→caption/micro 逐像素一致**；原 **8/9px(15 处:评分徽标/角标/眼纹标签)上调至 10px micro 下限**(+1~2px、已知可见可接受——10px 较 8px 更易读，与下述 tracking 位移同口径)、overline 字距 +0.1px 子像素；tsc/eslint(`--max-warnings=0`)/727 单测全绿；明暗双模实机抽检 knowledge/base 与 scheduler 渲染正常。
- **后续防范**：①Tailwind v4 字号令牌**仅当被源码用到才生成**工具类/`:root` 变量（tree-shaking），验证须先迁移真实使用点再 grep 编译产物，不能抽象空验；②`@theme` 字号令牌按需决定是否配对 `--line-height`——不配对=继承祖先比值（适合需随上下文缩放的小字），配对=固定（适合标题）；③大规模 className 机械替换前必须确认目标 token 不在变体前缀内（`[&_]:`/响应式/伪类），且替换按 token 字符串而非 `className=` 锚定（因大量 token 散在 `cn()` 片段与抽出的 `const xCls` 中）；④折叠 ad-hoc 间距/字号前先核验目标值与现值差异是否子像素，可见差异（如 0.1em→0.06em）应保留而非强行归一。
- **同类问题影响**：其余 ad-hoc 任意值（`leading-[...]`、`gap-[...]`、`rounded-[...]` 等魔法数字）若后续规范化，可复用本条的「前置安全核验 + token 字符串替换 + 编译/computed-style 双重实证 + 子像素差异保留」范式。
- **后续补充（tracking-[...] 宽标签语义化）**：复用上述范式处理剩余 14 处 `tracking-[0.14~0.24em]`。实测其中 **13 处为 `uppercase` 宽间距标签眼纹**（一致设计模式，众数 0.18em），新增 `--tracking-label: 0.18em` 语义令牌收敛；**剔除** 1 处非 uppercase 的作者名 pill（`MessageBubble.tsx` 的 `tracking-[0.14em]`，语义不符且非该模式）。computed-style 量化收口：众数 0.18em→0.18em 渲染零变化、0.16em→0.18em +1.6px、极端 0.24em→0.18em 短标题 −5.3px（已知可见、可接受，因属短 section 标题且更趋一致）。`rounded-[1.5~2rem]`(6) 与 `gap-[2px]`(1) 为定制一次性值、无对应令牌且 ROI 低，**不纳入**。教训补充：⑤ad-hoc 值语义化前必须先按「是否同一设计模式」分类（此处以 `uppercase` 判别 label vs pill），勿因值相近就盲并；⑥单令牌吸收一段值域时，用 computed-style 量化**最坏值**的累计宽度位移（非单 gap 差），据此判定可接受性而非仅看 em 差。
- **后续补充（review 收口：sub-10px 下限与冗余清理）**：评审指出原 `text-[8/9px]` 并入 `text-micro` 后，`RetrievedChunkCard` 评分徽标 `isCompact` 分支残留冗余 `text-micro`（base 已是 micro），致紧凑态字号不再随密度收缩、仅 padding 收紧。**确认 10px 为 micro 档下限**（8px 近不可读，10px 更佳且与「可接受可见位移」口径自洽），删除该 3 处冗余类（`text-micro` 计数 267→264，渲染零变化）；标准缩档 base `text-caption`→compact `text-micro`(11→10px) 保持不动。教训⑦：单令牌设最小档后，原低于该档的散值会被**静默上调**——机械替换须对「低于令牌最小档」的来源值单独标注，勿令「残留=0」的计数对账掩盖真实像素位移。

---

## ISSUE-104 Wiki 节点描述未同步至站点首页卡片（条目层缺列 + 前端取值错源）

- **表因**：主站点 Knowledge / Wiki 为根节点 Harness Engineering（描述「智能体工程化综述」）、Negentropy（描述「熵减引擎设计概念与使用指引」）填了 `DocCatalogEntry.description`，但 wiki 站点首页「内容主题」卡片只显示标题、描述缺失。
- **根因（两处独立断裂）**：
  1. **后端条目层丢字段**：`CatalogDao.get_subtree` 返回的 node dict 含 `description`，但 `wiki_service._apply_container_mappings` 调 `WikiDao.upsert_container_entry(...)` 时只传 `entry_title` 未传描述；且 `WikiPublicationEntry` 根本无 description 列——描述自同步落库即丢失，导航树（`wiki_tree._entry_to_item`）/ nav-tree API / 前端类型一路皆无该字段。`upsert_container_entry` docstring 早已声明容器条目应承载「title、description、entry_id」，属"文档承诺、实现缺失"。
  2. **前端取值错源**：`apps/negentropy-wiki/src/app/page.tsx` 首页卡片按 nav tree 一级节点逐个生成，却用 Publication 级 `pub.description` 给所有卡片赋值（对同一 Publication 恒相同，且该 Publication 描述为空 → 回退「暂无描述」），而非节点级描述。
- **处理方式**（反规范化，与 `entry_title` 同生命周期）：
  1. 迁移 `0051`：`wiki_publication_entries` 加可空列 `entry_description TEXT`（`ADD COLUMN IF NOT EXISTS`，不回填）；
  2. 模型 `WikiPublicationEntry` 加 `entry_description`；DAO `upsert_container_entry` 加 `entry_description` 参数并写入更新/创建两分支；
  3. Service `_apply_container_mappings` 传 `entry_description=node.get("description")`；`_freeze_snapshot` frozen dict 同步冻结该字段；
  4. `wiki_tree._entry_to_item` 经 `getattr(entry, "entry_description", None)` 输出，合成容器补 `None` 保形；
  5. 前端 `WikiNavTreeItem` 加可选 `entry_description`；`page.tsx` 改为 `item.entry_description || pub.description || "暂无描述"`（节点级优先 → Publication 级回退 → 占位）。
- **后续防范**：
  1. **denormalize 字段须全链同改**：`WikiPublicationEntry` 这类"发布快照"表新增展示字段，必须同步覆盖「DAO upsert 参数 + sync 服务写入 + 快照冻结 + nav tree 输出 + 前端类型 + 渲染取值」六层，漏任一层即断链；
  2. **docstring 承诺即契约**：`upsert_container_entry` docstring 写了 description 却从未实现，属危险的"虚假完备"——新增/审阅时须核对 docstring 声明字段与签名/落库是否一致；
  3. **逐节点卡片禁用聚合级字段兜底**：前端按节点渲染的卡片，描述/图标等须取节点自身字段，`pub.*` 仅作回退，勿对所有同级卡片赋同一聚合级值。
- **生效注意**：与 `entry_title`/`display_name`（ISSUE-040）一致，新列对**既有已发布数据**需用户主动点一次「同步并发布」回填后首页卡片才显示描述（迁移不隐式回填）。
- **同类问题影响**：与 ISSUE-002（`sync_entries_from_catalog` 死代码 + 契约缺口）同域——凡 Catalog → Wiki Publication 的字段映射（未来 icon / cover / order 等节点元数据）都须按"六层全链"核对；其它经 `getattr` 读 ORM 的 duck 调用点新增字段时记得给安全默认。

## ISSUE-103 模型下拉 Default 占位移除 + 默认 gpt-5-nano + test-vendor 残留清理与 fixture 清理加固（2026-05-30）

- **需求触因**：Home/Studio 中栏 Composer 的 LLM 下拉首项为可清除的 "Default" 占位（`value=""` = 不指定模型，后端回退硬编码默认），且下拉里出现一个 `TEST-VENDOR` 分组的 `Test Model`。用户要求：①移除 Default 占位、默认显式选中 `openai/gpt-5-nano`；②清除 TEST-VENDOR。
- **表因**：`Composer.tsx` 给 [`LlmModelSelect`](../apps/negentropy-ui/components/ui/LlmModelSelect.tsx) 传 `allowClear`（默认即 `true`）+ `placeholder="Default"`，渲染出可清空占位；`home-body.tsx` 多处 session 初始化分支在「无选择」时回退 `null`（= Default）。
- **现象（test-vendor 泄漏）**：DB 中残留一行 `vendor=test-vendor / model_name=test-model-9b7f642a / display_name=Test Model`（**随机后缀** = 集成测试 fixture 历史版本生成；当前 `_seed_model_config` 已用固定 `model_name`），并被 `task_model_settings` 2 行（同测试孤儿，FK=RESTRICT）引用。源头为 [`test_task_model_settings_db.py`](../apps/negentropy/tests/integration_tests/interface/test_task_model_settings_db.py) 的 seed-yield-teardown fixture。
- **根因订正（循证复核，⚠️ 初判已证伪）**：初判「teardown 用 `db.delete(mc)` 删跨 session detached 对象 → SQLAlchemy 2.0 async 静默失效（不报错不生效）」**经实测推翻**——用本仓库 `AsyncSessionLocal` 对 `ModelConfig`（无 relationship）与含 `cascade=all,delete-orphan` 的 `Corpus` 各复刻「add→commit→refresh→关闭 session→新 session 内 `db.delete(detached)`→commit」，**两者均无异常且行被真实删除（查回 0 行）**：`session.delete()` 会按 identity key 把 detached 对象重挂当前 session 并于 flush 发 DELETE。逻辑反证亦支持：若每跑必静默失效，随机 `model_name` 后缀将令**每跑泄漏一行**（应见多行），而实际仅残留**一行**，更符合**一次性 teardown 未跑完**（测试中途报错/被中断，或彼时某测试遗留 orphan `task_model_settings` 致 `model_config` 删除触 FK=RESTRICT 而未删成）。历史 granular commit 已被 release squash（`dda324d8`）吞并、旧 fixture 原貌不可回溯，真实触发点无法精确钉死，但可确定**不是 detached-delete 静默失效**。
- **处理方式**（四部分，正交解耦）：
  1. **前端去占位**：`Composer.tsx` 改 `allowClear={false}` 并移除 `placeholder="Default"`，下拉不再出现可清空首项；
  2. **前端默认值**：`home-body.tsx` 新增 `DEFAULT_LLM_MODEL = "openai/gpt-5-nano"` 常量，将 5 处「无选择回退 null」点（`useState` 初值、离开 session、已知 session、pending 转移、首入既有 session 无 persisted）+ **Effect 2 后端 snapshot 未命中点**全部回退默认；`selectedLlmModel` 类型仍 `string|null`（契约不变）但运行时不再为 null；
  3. **后端 fallback 对齐**：[`model_resolver.py`](../apps/negentropy/src/negentropy/config/model_resolver.py) `_DEFAULT_LLM_MODEL` 由 `openai/gpt-5-mini` 改为 `openai/gpt-5-nano`，前后端默认一致；
  4. **清理加固（防复发）**：两处 fixture teardown 改用 `delete(Model).where(id==...)` DELETE 语句替代 `db.delete(detached_obj)`——幂等、不依赖对象/session 状态、不触发 ORM cascade/lazy-load，并顺带删去原 teardown 中**结果被丢弃的 `select()` 死代码**；属稳健性改进，**非**「修复静默失效」（见上「根因订正」）；
  5. **DB 清理（数据非代码）**：单事务按 FK 依赖顺序先删 2 行 `task_model_settings`、再删 test-vendor `model_config` 行（精确按 id + 二次校验 vendor）。
- **验证**：DB 删前后只读计数对照（test-vendor 1→0、引用行 2→0、全表 14 行真实 vendor 无误删）；fixture 清理语义经独立临时脚本证「seed→DELETE teardown→查无残留」（同脚本实测旧 `db.delete(detached)` 在此**亦正常删除**、非泄漏，详见「根因订正」）；后端 grep 确认 fallback；tsc + eslint(`--max-warnings=0`) 双绿；alt-port(3193) dev server + chrome_devtools 复用真实登录态实机：下拉 8 项/3 真实组、`hasDefault:false`、`hasTestVendor:false`、默认 `gpt-5-nano`、双向切换 + localStorage 持久化(`openai/gpt-5-nano`↔`anthropic/claude-opus-4-6`)均正常。
- **同类问题影响 / 跨上下文注意**：①**detached 对象的 `db.delete()` 在 async 下可正常删除**（按 identity key 重挂 session + flush 发 DELETE，已实测），**勿**据此把跨 session detached delete 误判为「静默泄漏」而盲目审计——`test_global_setting_insert_and_read`（line 114-116）即同型写法、实测清理正常。async ORM 下真正危险的是**对 detached 对象触发 lazy-load**（访问未加载的属性/关系 → `DetachedInstanceError`/`MissingGreenlet`，与 312-313 行谱系同源）；seed-yield-teardown 清理仍**推荐** `delete().where()`，理由是幂等、不依赖对象状态、不触发 cascade/lazy-load，而非 `db.delete()` 会失效。②前端「占位/默认」语义变更须穷举**所有** state 初始化分支（本例 home-body 含 6 处，易漏 Effect 2 后端 snapshot 回退点），否则「打开历史会话」等冷路径仍回退旧 null。③`is_default` 字段（DB 层全局唯一默认）与前端默认选中（代码常量）是**两套独立机制**，本期前端默认不读 `is_default`，勿混淆。

## ISSUE-105 Routine 编辑/查看面板五屏割裂统一为单一「Edit Routine」抽屉 + 模板「使用」内联展开被遮挡（2026-05-31）

- **需求触因**：Interface / Routine 模块存在 5 个职责重叠、文案中英混杂的编辑/查看面板（只读详情抽屉 `RoutineDetailDrawer` + 编辑模态 `RoutineFormDialog` + 模板详情抽屉 `TemplateDetailDrawer` + 模板三步向导 `TemplateFormDialog` + 内联创建 `InlineCreateFromTemplate`），体验割裂、字段定义重复。用户要求收敛为单一可直接编辑的「Edit Routine」通用抽屉、宽度 1.5×、文案全英文一致。
- **表因（图 4 遮挡 bug）**：模板库点击「使用此模板」展开的内联填写区被下一行卡片遮住、无法操作。
- **根因（图 4）**：`templates/page.tsx` 把 `TemplateCard` 与 `InlineCreateFromTemplate` 放进同一 grid cell（`<div key={t.id}>`），grid cell 无 `overflow`/定位上下文，卡片 `h-full` + 内联块在 cell 内堆叠 → 内联块底部被相邻 grid item 的卡片视觉覆盖。属「把展开态塞进等高网格单元」的布局误用。
- **处理方式（正交分解：单组件判别式驱动）**：
  1. 新增 `RoutineEditDrawer.tsx`，以判别式联合 `mode`（`routine-create`/`routine-edit`/`template-create`/`template-edit`/`use-template`）驱动 5 种形态——`entity ∈ {routine,template} × op ∈ {create,edit}` + 一个实例化态。页面是「打开哪个 mode」的单一事实源，抽屉只自持表单草稿态；
  2. 图 4 根治：模板「Use」改为**打开抽屉**（非内联展开），删去 grid cell 内联分支，回归「一个卡片一个 grid cell」；
  3. 图 1+2 合并：行点击直接进可编辑抽屉，底部 Edit→**Save**（不再二次弹模态）；图 3：模板卡片进同一抽屉，内置只读仅 Use、用户模板 Save+Use+Delete；
  4. 提交统一走 `createRoutine`/`updateRoutine`（模板 `is_template:true` + 元数据并入 config）；模板「Use」忠实提交用户编辑过的完整字段（`from-preset` 快捷通道与 6 个旧组件 + 死代码 `PresetCard`/`CreateFromTemplateDialog` 一并删除，净减 ~1824 行）；
  5. 宽度 `w-[460px]`→`w-[690px]`（实测 690px）保留 `max-w-[92vw]` 窄屏兜底。
- **UX 加固（ui-ux-pro-max skill 循证）**：①可见 label 替代原 placeholder-only（Goal/Acceptance 等，修原 High-severity a11y 缺陷）；②read-only ≠ disabled——运行中/内置模板只读态附**恢复路径**说明（"Pause to edit"/"Click Use"）；③弃改二次确认（dirty close → "Discard changes?"）防误丢编辑；④字段错误 icon+文案（非仅红框）+ `aria-live`。
- **关键易错点 / 二阶风险**：
  1. **SSE 刷新勿重置草稿**：抽屉表单**仅挂载时** seed 初值，外层按 `key={kind}:{id}` 强制重挂以切实体；同一 routine 的 `selected` prop 更新（SSE 状态翻转）只流向 header 状态徽标/`readOnly`/footer 控制（读实时 prop），不回灌 `form` 草稿；
  2. **脏基线 seed 同源**：`baseline = useState(form)` 复用 `form` 的 `useState(() => buildInitial(mode))` 初值——`use-template` 的 `crypto.randomUUID()` key 只生成一次，避免 form/baseline 双生随机致**恒脏**（误判 + 每次关闭都弹弃改确认）；
  3. **运行中锁定不静默**：SSE 将状态翻 running 时若用户有未保存编辑，字段会即时 disabled + 隐藏 Save——加 `wasRunningRef` 边沿检测 + `toast.warning` 显式告警，避免「字段变灰 + Save 消失」成为无声数据丢失陷阱；
  4. **判别式收窄取 id 勿用 `as` 强转**：`mode.kind === "routine-edit" ? mode.routine.id : mode.template.id`（按 kind 穷尽），保留联合穷尽性，未来新增 mode 由编译器兜底（`as {template}` 强转会让缺 `.template` 的新 mode 编译通过、运行时 throw）；
  5. **React Compiler 规则**：`isDirty` 比较基线用 **state**（非 render 期读 `ref.current`，触 `react-hooks/refs`）；字段错误渲染用普通函数 `renderFieldError()`（非 render 期创建组件，触 `react-hooks/static-components`）。
- **验证**：`pnpm typecheck`（pretypecheck 重建 `@negentropy/agents-chat-core` 消除 stale-dist 噪声）+ eslint(`--max-warnings=0`) 双绿；alt-port 3193 `next dev` + chrome_devtools 复用真实登录态实机走查 **5 条 mode 全链路**：图 4「Use」弹抽屉不再被遮挡、cwd 必填校验 + 实际创建并跳转详情；图 1+2 行点击直接可编辑 + Save（PUT 200 + 列表/详情刷新）；paused 显 Resume/Cancel + Save、failed 显 Delete；内置模板全字段 disabled 仅 Use；New Routine 空表单 + Advanced 折叠；弃改确认；抽屉实测 690px；明暗双主题；console 仅余 font-preload 框架噪声 0 报错。
- **同类问题影响 / 跨上下文注意**：①**展开态/内联块勿塞进等高网格单元**（`h-full` + `grid` cell）——会被相邻 item 遮挡；展开交互优先用抽屉/弹层（脱离文档流 + z-index 分层），或把展开块移出 grid 容器；②多形态面板优先**判别式联合单组件 + keyed remount** 而非 N 个并存组件（消重复字段定义 + 单一事实源）；③React 19 + eslint-plugin-react-hooks v7 的 React Compiler 规则禁止 render 期读 ref / 创建组件，dirty-baseline 用 state、字段助手用普通函数；④抽屉宽度等"任意值"改动后须 computed-style/`getBoundingClientRect` 量化实证（本期实测 690px / 0.54 视口），勿凭截图目测。
- **收尾 chore（2026-05-31）**：ISSUE-105 删 UI 组件时遗留 `from-preset` API 管线孤岛——前端 client（`fetchPresets`/`createRoutineFromPreset`）+ 类型（`RoutinePresetSummary`/`RoutineFromPresetPayload`）+ `index.ts` re-export + 对应单测，及后端 `GET /routines/presets`、`POST /routines/from-preset` + `RoutineFromPresetRequest`（均**无调用方、无测试**，已被 `/templates` + `createRoutine` 取代）。本 chore 一并清除，使上文「`from-preset` 快捷通道…一并删除」端到端为真（彻底熵减）；`agents/routine_presets/`（`load_all` + 4 个 YAML）**保留**——仍由合并端点 `GET /routines/templates` 加载内置预设。同步：user-guide [routine-presets.md](../concepts/user-guide/routine-presets.md)「API 参考」改指 `/templates` 与 `POST /routines`；404 错误处理单测载体改用 `fetchKpis`。另统一两页 Save 体验——`templates` 页 `template-edit` 保存后抽屉保持打开（对齐 `routine` 页 `routine-edit`，草稿基线由抽屉自身 `setBaseline` 重置）。

---

## ISSUE-106 Routine 执行「全过程」动作级审计 + 实时流（事后审计 + 边跑边看）

- **表因**：Routine 单任务页虽名为「全过程」视图，但仅到迭代粒度——每轮只持久化最终摘要（`summary` 截断 2000 字符）+ 成本/轮数/评分。Claude Code 在一轮内真正执行的**所有动作**（读/改/跑命令、中间推理）以及评估阶段的 Judge prompt/原始回复、Gate 完整输出全部被丢弃，无法事后审计与 Review。
- **根因**：
  1. `engine/claude_code/service.py` `_invoke_cli` 逐条解析 stream-json 但只取最终 `result`，丢弃每个 `tool_use`/`tool_result`/中间 `assistant`；且 assistant 分支误读扁平 `event.get("content")`（真实 CLI 嵌套在 `message.content` 块列表）——**实为死代码**；
  2. `engine/routine/evaluator.py` 的 Judge prompt、原始回复、Gate 完整输出本地算出后即弃，只留 score/verdict/reflection/gate_exit_code。
- **处理方式**（全链路，新表 + 捕获 + 持久化 + 实时 + 审计 UI）：
  1. **新表** `routine_iteration_events`（模型 `RoutineIterationEvent` + 迁移 `0052`，schema `negentropy`，双 FK CASCADE + `UniqueConstraint(iteration_id,seq)` + 两索引）——append-only 动作事实流；
  2. **归一化捕获** `service.py::_normalize_stream_event`（防御式解析 system/init、assistant 块列表→text/tool_use/thinking、user tool_result 字符串/块列表、result、未知 type **绝不丢弃**）+ `_cap`/`_coerce_content`/`_cap_json`（16KB/字段）+ `_MAX_EVENTS_PER_ITER=1000` 封顶 + `_truncated` 哨兵；顺手修复 assistant 摘要回退读 `message.content`；
  3. **`invoke(on_event=...)` sink + `events_holder`** 可变容器（仿 `session_holder`），超时/取消/出错路径亦回带已捕获部分事件；
  4. **Runner 持久化**：`_do_write_back` 在 `rowcount==1`（与计数同条件）+ `capture_events` 开关下，`pg_insert(...).on_conflict_do_nothing(["iteration_id","seq"])` 批量插 seq 0..N-1，与状态翻转同事务；`_make_action_sink` 经非阻塞总线（`put_nowait`+丢旧）实时广播 `action` 事件（`suppress` 异常，绝不阻塞 CC 执行）；
  5. **Orchestrator 评估事件**：`_persist_eval_events` 仅在迭代翻转 `evaluated` 时以 DB 侧 `MAX(seq)+1` 追加 gate+evaluation 行（`on_conflict_do_nothing`），**评估失败重试期间 status 停留 executed 不追加**（防每 tick 重复）；`EvaluationResult` 新增 judge_prompt/judge_raw/gate_output；
  6. **API** `GET /routines/{id}/iterations/{iid}/events`（升序 seq 分页，catch-all 代理自动转发，**无需新前端路由**）；events 不内联进迭代详情（保持列表/详情载荷小，抽屉懒加载）；
  7. **审计 UI**：`IterationAuditDrawer`（复用 `BaseDrawer`，宽 ~720px，懒加载 + 实时缓冲按 seq 去重合并 + 终态回查）+ `IterationEventTimeline`（纵向 trace，类型图标**颜色+图标双编码**，分组 执行→结果→门控→评估，折叠展开 input/output/context 用 `JsonViewer`/`pre`，skeleton/空态/LIVE 脉冲/`role=alert`）；`useRoutineDetailLive` 增 `liveActionsByIteration`（仅在途迭代缓冲，**action 事件不触发整 routine 重拉**）。
- **后续防范**：
  1. **签名变更的 cascade**：`invoke`/`_invoke_cli` 新增 kwargs 后，既有用 4-arg mock 替换 `_invoke_cli` 的单测会以「takes 4 args but 6 given」失败被吞为 `error`——替换内部协程的 mock 必须同步新签名（`test_claude_code_service.py::test_invoke_timeout_returns_partial_session_id`）；
  2. **`_cap` 输出须 ≤ limit**：截断标记若**追加在 limit 之外**会使返回值超长，写入定长列（`title` String(255)）触发 `StringDataRightTruncation` 中断评估事务——`_cap` 必须从 head 预扣标记预算；定长列入库再做 `[:255]` 防御性收口（runner 与 orchestrator 两处一致）；
  3. seq 双写者（runner 0..N-1 / orchestrator MAX+1）全程 `ON CONFLICT DO NOTHING` 兜底 reaper/abort/重试竞态；
  4. 实时为 best-effort，**持久化端点为事实源**（队列满丢弃的事件经 refetch 补齐）。
- **验证**：unit（归一化各形态/截断边界/seq 单调/tool_use↔tool_result 配对/sink 异常吞噬）+ integration（写回 seq 幂等/capture 关闭仍翻转/gate+eval 追加于 MAX+1/失败重试零事件/超长 verification_command 不溢出）+ API（升序分页 + 404）共 **66+ 用例全绿**；迁移在隔离库 upgrade/downgrade 往返干净；alt-port 3194 dev server + 路由级 router-only verify 后端（3393，无心跳）+ 13 条种子事件，Playwright 明暗双主题实机走查：4 分组正确、人读标题（`Read src/...`、`Bash: pytest -q`、`Judge: progressing · 72`）、error 徽章、cost、折叠 JsonViewer 展开 `command`/`tool_id`——全部如设计；验证后**删种子事件+手建表恢复 live DB 原状**。
- **同类问题影响 / 跨上下文注意**：**跨工作区 alembic `0052` 撞号（已解决）**——本分支原 `0052_routine_iteration_events`（revises `0051`）与 sibling（`tel-aviv-v1`/`routine-failed-restart`）的 `0052_routine_eval_floor_seq`（同 revises `0051`）撞号。sibling 先合入 `origin/feature/1.x.x` 后，处理方式 = **merge 最新基线 + 将本迁移线性重链为 `0053`（revises `0052`，renumber 文件名/`revision`/`down_revision`/docstring 四处一致）**，`alembic heads` 单 head 收敛。隔离库实测 `0051→0052(eval_floor_seq)→0053(events 表)` upgrade/downgrade 往返干净，两特性运行期共存（**79 用例全绿**：本审计事件 + sibling eval_floor/restart）。**教训**：共享 DB + 多工作区并行时迁移撞号是常态；后合入者须 fetch 最新基线、把自己的迁移重链到对方之后（**严禁 rebase，用 merge**），并验证单 head + 往返；测试文件「文件尾各自追加新用例」也极易触发同段冲突，解析时须**两侧用例都保留**。

## ISSUE-107 Memory Core Memory e2e 在 CI 失败：Playwright route mock 非 hermetic（本地有后端掩盖）（2026-05-31）

> 注：本条原编号 ISSUE-106，因与 `feature/1.x.x` 上先合入的 Routine 审计条目（现 ISSUE-106）合并冲突，按「后合入者顺延」重编为 107。

- **表因**：`ui-quality / UI Playwright Smoke` 仅 `tests/e2e/memory/core-blocks.spec.ts` 两例失败（其余 68 例全过）。「列出 blocks」断言记忆内容 `toBeVisible` 超时（元素未渲染）；「新建 block」点击 `New Block` 按钮 30s 超时（`element is not enabled` —— 按钮始终 disabled）。**本地（含 alt-port dev server）全过**，仅 CI 复现。
- **根因**：测试**非 hermetic**。`New Block` 按钮 `disabled={!activeUserId}`，`activeUserId` 由 `fetchMemories()` → `GET /api/memory?app_name=negentropy` 的用户聚合列表自动选中；`useCoreBlocks` 同样依赖选中的 user。原 `mockUserList` 用 `page.route("**/api/memory", …)`——**glob 无尾通配**，匹配不到带 query 的 `/api/memory?app_name=negentropy`。该请求遂未被拦截，**穿透 Next 代理回退到真实后端**：本地后端（:3292）在跑 → 返回真实 users → `activeUserId` 被设 → 测试假性通过；**CI 无后端**（日志可见 `Error connecting to backend ... fetch failed`）→ 代理 502 → `fetchMemories` throw → `users=[]` → `activeUserId` 恒 null → 按钮 disabled + 列表永不加载。环境差异（本地有后端 / CI 无）掩盖了 mock 缺口。
- **处理方式**：把两例改为**单一 catch-all 始终 fulfill**——`page.route("**/api/memory**", …)`（带尾通配，匹配带 query 的 URL），内部按 `url.includes("/api/memory/core-blocks")` 分支返回 core-blocks，否则返回 `USER_LIST`，**绝不回退网络**。复刻 `memory-pages.spec.ts`「Retrieval Metrics」passing 例的成熟范式。
- **验证**：以 CI 等价**无后端** webServer（`playwright.config.ts` 默认 `pnpm build && pnpm start` on :3210，注释明示「没有 backend」）本地复现——改前必败、改后 `core-blocks.spec.ts` 2/2 过、`tests/e2e/memory/` 全量 21/21 过。
- **后续防范 / 同类问题影响**：①Playwright route glob **务必带尾 `**`**（`**/api/x**`）以匹配 query string——`**/api/x` 不匹配 `/api/x?…`，是静默穿透的高频坑；②**E2E 必须 hermetic**：CI 无后端，凡页面初始化依赖的接口（尤其驱动「默认选中/按钮可用态」的列表类接口）都须 mock 且 catch-all **always-fulfill**，勿留「未匹配 → 穿透代理 → 撞真实后端」的回退路径；③**本地验证须复现 CI 拓扑**：涉及后端代理的 e2e 用默认 config（自带无后端 webServer on :3210）跑一遍，勿只在「本地后端在跑」的 alt-port 环境验证，否则 mock 缺口被真实后端掩盖；④凡「按钮 disabled / 列表空」类 e2e 失败，先查**前置数据接口的 mock 是否命中**（route glob、query、method），而非急改断言或加 `waitFor`。

## ISSUE-108 Routine 交互模式双向 stdin 死锁 + 评估门控在 worktree routine 用错 cwd（全闭环阻断，2026-06-02）

- **表因**：实机走 Routine 全闭环（resume → dispatch → execute → evaluate → decide）时，**没有一个 routine 能跑通**。两个独立缺陷叠加：(1) 任何 routine 启动后迭代恒卡在 `in_flight`、`turn_count=0`、`cost=0`、零审计事件，Claude Code 子进程 CPU 0% 长期 sleep，直到外层超时（默认 3h）或被 kill——卡死的子进程占满 Runner 全局并发槽位（`max_concurrent=2`），导致**后续所有 routine 永远无法 dispatch**（`launched=0`，假性「调度停摆」）；(2) 即使绕过 (1)，worktree routine 的产物完美却始终 `gate_exit≠0`、评分被 Judge 规则压在 ≤60、永远达不到阈值。
- **根因**：
  1. **交互模式双向 stdin 死锁**（`engine/claude_code/service.py::_invoke_cli_interactive`，随 #824 auto-answer 引入）：`--input-format stream-json` 下 claude CLI **忽略** `-p <prompt>` 命令行取值，改从 **stdin** 读首条 `user` 消息作为任务输入；旧实现只在检测到 AskUserQuestion 后才写 stdin，**初始 prompt 从未经 stdin 投喂** → CLI 永久阻塞等待 stdin（既不产事件也不退出）。更隐蔽的第二层：即便投喂了 prompt，CLI 产出 `result` 后**仍不自退**，保持 stdin 打开等待更多输入；而 reader 用 `async for ... in _iter_json_events(stdout)` 等 stdout EOF（依赖进程退出）、writer 等 reader 发 None sentinel（依赖 reader 结束）→ **三方循环死锁**。
  2. **评估门控 cwd 错位**（`engine/routine/evaluator.py::evaluate`）：`_run_gate(verification_command, routine.cwd)` 用的是**原始仓库根 `cwd`**，而 worktree routine 的 Claude Code 实际在引擎备好的隔离 `worktree_path` 内改代码（见 `orchestrator._build_config` 的 `effective_cwd`）。门控在 `cwd` 根目录跑 `python3 hello.py` / `uv run pytest` 找不到 CC 在 worktree 内新建/改的文件（`exit 2/127` file-not-found），与 `_build_config` 的 worktree 寻址逻辑**不一致**。
- **处理方式**：
  1. **死锁修复**（三处）：新增 `_build_stdin_user_prompt(prompt)`（封装 `{"type":"user","message":{"role":"user","content":prompt}}\n`，`ensure_ascii=False` 保中文）；启动 reader/writer 后**立即经 write_queue 投喂初始 prompt**；reader 命中 `result` 事件即先 `_emit_events` 落审计、再 `write_queue.put(None)` 闭合 stdin 并 `break`；`gather` 后加 **10s 优雅退出窗口**（`asyncio.wait_for(proc.wait(), 10)`），让 CLI 因 stdin 闭合自然 rc=0 退出，避免 `finally` 抢先 `terminate()` 误判 SIGTERM(143) 把成功迭代标记 error。
  2. **门控 cwd 修复**：新增静态 `RoutineEvaluator._gate_cwd(routine)`=`worktree_path or cwd`（`getattr` 兜底旧视图），`evaluate` 改用之；`_RoutineLike` 协议补 `worktree_path` 字段。
- **后续防范**：
  1. **stream-json 输入模式的契约**：开 `--input-format stream-json` 后 `-p` 失效、prompt 必须经 stdin；且 result 后须**主动闭合 stdin**触发退出——这是「读 + 写 + 子进程退出」三方依赖，任一环不闭合即死锁。新增交互/双向管道路径务必端到端验证「能产事件 + 能干净退出（rc=0 非 143）」。
  2. **僵尸子进程占满并发槽 = 假性调度停摆**：Runner `max_concurrent` 槽被 hang 死的 CC 占满时，现象是「新 routine 永不 dispatch、inspector `launched=0`」，**极易误判为调度器/数据库锁问题**。排查链路应含：`ps aux | grep 'claude -p'` 看僵尸子进程 + CPU%/STATE（0%/S = 等 stdin 死锁）+ 进程级 RCA（`lsof -p` 看 PIPE fd）。
  3. **「机制（worktree 寻址）」必须在所有消费点一致**：CC 执行 cwd（`_build_config.effective_cwd`）与门控执行 cwd（`evaluator._gate_cwd`）**同源**，否则产物与验收错位、评分恒低、无限迭代直至 `max_iterations` 假性 `failed`。新增任何「在 routine 工作目录跑命令」的代码都须走统一的 worktree 寻址。
  4. **gate 失败的两面性**：`gate_exit≠0` 既可能是「产物未达标」也可能是「门控命令本身环境不匹配」（如 `python` 不存在只有 `python3`、cwd 错位）。Judge 的 reflection 能准确诊断（实测「环境缺少 python 命令」「找不到 hello.py」），是排查 cwd/环境类门控误判的高价值信号。
- **验证**：①隔离单测（`uv run python` 直调 `ClaudeCodeService.invoke` interactive，连跑 3 次稳定 `status=success`/`turns>0`/`session_id` 回带；AskUserQuestion auto-answer 路径 `turns=2`/`error=None`）；②新增单测 `test_routine_evaluator_gate.py`（5 例：`_gate_cwd` worktree 优先/回退 cwd/空串回退/全 None/缺属性兜底）+ `test_claude_code_service.py` 新增 3 例（stdin prompt builder × 2 + `_DuplexFakeProc` 端到端复刻「prompt 经 stdin 投喂 + result 后闭合 stdin 干净退出」）；routine+claude_code 全量 **85 用例全绿**；③**实机全闭环**（Chrome devtools 实操，dest-project `data-la-maps` + baseline `origin/feature/1.x.x`）：修复前 #1-#4 `gate=2` 评分卡 55；门控 cwd 修复后 restart → #5 `gate=0` 评分跃升 95 → IMPLEMENT 自动推进 FINALIZE → #6 执行 git add/commit/push/`gh pr create` → 捕获 `PR_URL`（实建 PR #1）→ routine `succeeded`/`term=success`/score 98 → worktree `on_success` 自动清理（`worktree_status=cleaned`、物理目录删除）；ConvergenceChart/Gantt/PR card/审计抽屉（49 CC 事件 + 2 Negentropy 事件，owner 归属正确）全部正确渲染；原「项目复刻」routine resume 后 #2 正常 dispatch、产 8+ 审计事件（init→thinking→Agent→Bash/Read→task_progress，证明 CC 真实执行不再死锁）；手动 `POST /cleanup-worktree` 对 cancelled/failed routine 的 worktree 回收亦验证通过。
- **同类问题影响 / 跨上下文注意**：缺陷 (1) 自 #824（auto-answer 引入交互模式）起潜伏，凡 `settings.routine.auto_answer_questions=True`（默认 ON）的 routine 全部受害；缺陷 (2) 自 #793（隔离 worktree）起潜伏，凡配 `verification_command` 的 worktree routine 全部受害。二者叠加使 Routine 子系统**整体不可用**，但因 hang 表现为「慢」而非「报错」、低分表现为「还在迭代」而非「失败」，**极具隐蔽性**，必须实机全闭环（非单测）才能暴露。修复均为纯后端 `service.py`/`evaluator.py`，无 schema/迁移变更，无前端改动。
- **收尾 chore（2026-06-02）— PR#831 CI 集成测试因 sibling PR#829 守卫红**：本 PR（#831）CI 的 `backend-quality / Backend Integration Tests` 报 5 例失败（`test_routine_orchestrator.py` 3 个 dispatch + `test_routine_api.py` 2 个 restart），均非本 PR 改动所致——而是 sibling **PR#829「补齐 restart/resume 端点 baseline_branch 守卫 + orchestrator 纵深防御」**先合入基线后，给 `_dispatch_due`（无 baseline 的非模板 routine 直接 `terminate(unrecoverable)` + `launched=0`）与 restart/resume 端点（无 cwd+baseline → 409）加了守卫，**却未同步更新既有集成测试**（这些测试造的 routine 不带 baseline_branch/cwd）。本地跑全绿是因为本工作区基线停在 #829 之前（`30e84fb1`），而 CI 把 PR merge 进**更新的基线**（含 #829）后才暴露。处理方式 = **merge 最新基线 + 修测试满足新守卫**：3 个 dispatch 用例补 `baseline_branch+cwd`，auto-launch 用例 `patch("...workspace.ensure_worktree", AsyncMock(return_value=WorkspaceInfo(...)))` 避免真实 git；2 个 restart 用例接入既有 `git_repo` fixture（真实临时 git 仓库 + `main` 分支）并在 create 时带 `cwd+baseline`。**教训**：①给 API/编排加「拒绝某类输入」的守卫时，**必须同批次更新所有造该类输入的测试**，否则破窗在 sibling PR 的 CI 才爆；②本地集成测试通过 ≠ CI 通过——本地基线可能滞后于 origin，**合 PR 前应 `git fetch && git merge origin/<base>` 把最新基线纳入再跑测试**，复现 CI 的 merge 拓扑；③守卫类 PR 的「纵深防御」（API + orchestrator 双层）会放大测试面，新增守卫点须全量跑 routine 集成测试而非仅单测。

## ISSUE-109 Routine CC 会话上下文窗口耗尽导致死亡螺旋（巨型长任务自迭代夭折，2026-06-03）

- **表因**：实机全闭环验证 Routine `a83d9c94`（"Map 项目复刻"：Go 版 athens-v2 → Python 3.13 一比一复刻到 data-la-maps，巨型任务）时，routine 仅跑 5/50 迭代、$12/$5000 预算即 `failed`/`unrecoverable_error`。迭代序列异常：seq=1 冷启动跑 **157 turns / $10.19** 成功（score=50），seq=2~5 全部 `exec_status=error`、summary 恒为 `"API Error: The model has reached its context window limit."`，seq=4/5 更是一启动即 1 turn 失败、`cost=0`。连续 4 次 exec error 触发 `decision._consecutive_exec_failures≥3` → `unrecoverable_error` 终止。
- **根因（三处协同缺陷）**：
  1. **错误识别只看 exit code**（`engine/claude_code/service.py`）：`_invoke_cli` / `_invoke_cli_interactive` 收尾均 `status = "success" if proc.returncode == 0 else "error"`，**丢弃 result 事件已携带的 `is_error` 信号**——把「可自愈的会话上下文耗尽」与普通失败混为一谈。实测上下文耗尽的 result 事件形态为 `{subtype:"success"（误导！）, is_error:true, result:"API Error: The model has reached its context window limit."}` + exit 1，故识别**必须以 `is_error` + 文本为准，不能依赖 subtype**。
  2. **session 污染**（`engine/routine/runner.py::_do_write_back`）：`if result.session_id: routine.claude_session_id = result.session_id` **无条件回写**，即使 exec error。CC resume 一个已耗尽会话时其 `system/init` 仍报同一 session_id，于是 routine 被**永久钉死在已满会话**，后续每轮 resume 一启动即撞上下文上限——死亡螺旋。
  3. **无条件 resume**（`engine/routine/orchestrator.py::_build_config`）：`config.resume_session_id = routine.claude_session_id` 无「会话已耗尽则冷启动」逃逸路径。
- **修复可行性关键事实**：`prompt_builder.build_prompt` **每轮都注入完整 goal + acceptance_criteria + 最近 N 条 reflections + 隔离 worktree 上下文**；worktree 是持久状态（既往 commit + working tree 全保留）。**故 CC 会话仅是「工作记忆优化」而非「正确性必需」**——重置 session 让下一轮在同一 worktree 冷启动、重读既往产出即可续干。这与 `restart` 端点本质不同：restart 会 `remove_worktree` 销毁既往产出，**不能用于恢复长任务**。
- **处理方式（最小外科手术 + 机制/策略分离，零 DB 迁移）**：
  1. **机制层**（service.py）：新增纯函数 `_classify_result_error(result_event, returncode)` + 常量 `ERROR_KIND_CONTEXT_EXHAUSTED`；双信号 OR 识别（文本 `_CONTEXT_EXHAUSTION_RE` 主据 + subtype `_CONTEXT_SUBTYPES` 辅据），仅 `returncode!=0` 触发不误伤成功路径；`ClaudeCodeResult` 增 `error_kind` 字段（默认 None 向后兼容）；`_invoke_cli` / `_invoke_cli_interactive` 两路径保存原始 result 事件并共用该纯函数分类。
  2. **策略层**（runner.py `_do_write_back` 三态）：上下文耗尽且 `reflections._context_resets < context_reset_max` → 清空 `routine.claude_session_id`（下轮冷启动）+ 计数 +1 + 给 `iteration.metrics` 打 `context_exhausted` 标记；达上限 → 不清、记 `_context_reset_exhausted`（落回 unrecoverable 自然路径防 runaway）；非上下文耗尽 → 维持原 session 续接。**orchestrator dispatch 零改动**（session 已被清空 → 下轮自然冷启动，解耦红利）。
  3. **decision.py 不误判**：`decide` 增显式入参 `max_context_resets`（纯函数边界，不读 settings）；`_consecutive_exec_failures` 在 `max_context_resets>0` 时把标记 `context_exhausted` 的失败**透明跳过**（continue，不计数也不中断），避免可自愈失败被误判 unrecoverable；runaway 由 runner 侧重置计数上限兜底。
  4. **配置**：`RoutineSettings.context_reset_max`（默认 10，`config.default.yaml` 同步）。
- **后续防范 / 跨上下文注意**：
  1. **CLI result 事件的 `subtype` 不可靠**：上下文耗尽时 subtype 竟为 `"success"`，凭它判错会漏判。识别可恢复错误类型须以 `is_error` + result 文本为准，subtype 仅作辅助信号。
  2. **「执行失败」需区分可恢复 vs 不可恢复**：原系统把所有 exit≠0 一律当 error 计入连续失败守卫，对「会话上下文耗尽」这种纯属工作记忆溢出、可经冷启动自愈的错误一刀切终止。新增错误类型时应评估其可恢复性，纳入 `error_kind` 分类与对应自愈策略。
  3. **session 是工作记忆而非事实源，worktree 才是持久状态**：worktree routine 的真相在隔离工作区（含 commit + working tree），CC 会话可丢弃重建。任何依赖「resume 同一会话」的逻辑都应有「会话不可用则冷启动」的退化路径。
  4. **巨型长任务会耗尽 1M 上下文**：本例模型为 `claude-opus-4-7[1m]`，单轮 157 turns 即撑满。长周期 routine 必须具备跨会话的上下文管理（冷启动自愈 + reflections 注入 + worktree 持久），不能假设单一会话能承载整个任务。
- **验证**：①单元（`test_claude_code_service.py` 10 例覆盖 `_classify_result_error` 用 seq=4 真实事件 fixture / 全 marker 大小写容错 / subtype 独立信号 / 负例防误判 / `_invoke_cli` 端到端打标签；`test_routine_decision.py` 5 例覆盖可自愈失败放行 / reset_max=0 退化 / 普通 error 仍 unrecoverable / continue 不隔断链 / success 归零）+ 集成（`test_routine_orchestrator.py` 3 例覆盖 runner 写回清 session+标记 / 成功正常续接 / 达上限封顶）；routine+claude_code 全量 **144 用例全绿**，零回归；ruff clean。②**实机全闭环**（Chrome devtools，复活 `a83d9c94`）：改 DB 复活（`status=running`、`claude_session_id=NULL`、`eval_floor_seq=5` 隔离旧失败窗口、保留 worktree）后，inspector 下一 tick dispatch seq=6——CC 子进程 `claude -p`（**无 `--resume`，确认冷启动**）、`resume_session_id=NULL`、189s 内产 **339 审计事件含 112 tool_use**（对比旧 seq=4/5 仅 ~6 事件 1 turn 即死），routine 持续 `running`、worktree（123.3M seq=1 产出）完整保留。UI 迭代时间线、Evaluator-Optimizer Loop、Reflexion 注入面板全部正确渲染。
- **同类问题影响 / 跨上下文注意**：缺陷自 Routine 子系统引入即潜伏，凡「单会话上下文撑满」的长任务全部受害（短任务因不撑满上下文不触发）。承 ISSUE-108 修复使 Routine 全闭环可跑通后，本缺陷是「跑得足够久」才暴露的下一层失败模式——**只有用巨型真实任务实机长跑才能发现，单测与小任务均无法触发**。修复纯后端（service.py/runner.py/decision.py/config），无 schema/迁移变更，无前端改动；新增字段/参数均默认向后兼容（`error_kind=None`、`max_context_resets=0` 退化原行为）。

## ISSUE-110 Routine worktree 隔离缺失「源目录只读读授权」物理通道——Prompt 声称可读而运行时无法兑现（复刻类长任务硬阻断，2026-06-06）

- **表因**：以「Maps 项目复刻」（`9e90c3c7`，Go `platform-maps/jerusalem-v3`→Python `data-la-maps`）为模板的复刻类 routine，goal 明确要求 CC「通过 `/add-dir` 加载 source-project 全量代码进行源项目全方位分析」，但 CC 在隔离 worktree 中实际**读不到** worktree 之外的 Go 源码（407 文件）；隔离 system prompt（ISSUE 见 commit `002f58dd`）虽声称「goal 显式引用的绝对路径可读」(rule 2)，却无任何物理机制兑现该读权限。复刻因「看不到源」而不可能做好（历史 iter1 仅靠零散探索拿到 92 分，本质是盲人摸象）。
- **根因**：**Prompt 授予了运行时无法兑现的读权限——隔离的物理层与 prompt 层不一致**：
  1. CC 子进程 cwd 被钉在隔离 worktree；Claude Code 对 cwd 之外的路径默认不可读，需经 `--add-dir`（CLI）/`add_dirs`（SDK）显式授予；
  2. goal 让 CC 用 `/add-dir`——但 `/add-dir` 是**交互式 slash 命令**，在 `claude -p` 非交互子进程 / SDK `query()` 中**完全不生效**；
  3. `grep -rniE "add[_-]?dir|additional_director"` 全 `engine/` **零命中**——`ClaudeCodeConfig` 无 `add_dirs` 字段，`_build_cli_args` 不发 `--add-dir`，`_build_config` 也无来源接线。三层皆缺，rule 2 的「可读」沦为空头支票。
- **处理方式**（物理授权 + 只读封锁 + prompt 对齐，最小干预）：
  1. `claude_code/models.py`：`ClaudeCodeConfig` 增 `add_dirs: list[str]|None` + `settings: str|None`（repr 安全）；
  2. `claude_code/service.py`：`_build_cli_args` 逐目录发 `--add-dir <path>`（**非逗号合并**，经 SDK 源码 `subprocess_cli.py::_build_command` 核实）+ `--settings <json>`；`_invoke_sdk` 经 `hasattr` 守卫设 `options.add_dirs`/`options.settings`（SDK 未装时仅告警，CLI 为权威路径）；**两处** config 重建点（`_invoke_cli` + `_invoke_cli_interactive`）均补透传 `add_dirs`/`settings`（同 credential 静默丢弃回归类——Routine 实际走交互式路径）；
  3. `routine/orchestrator.py`：新增 `_normalize_read_dirs`（绝对化+去重+滤杂质）与 `_build_readonly_settings`（对每个 add_dir 生成 `permissions.deny:["Edit(//<abs>/**)"]`，`//` 为文件系统绝对锚点）；`_build_config` 从 `routine.config.read_dirs` 填充 `config.add_dirs` + `config.settings`——`--add-dir` 默认授予**读+写**，故必须以 `Edit` deny 把源码物理锁只读（deny 优先级最高，`acceptEdits/bypassPermissions/--add-dir` 均不可越权；CC 仍可 Read，但 Edit/Write/MultiEdit/识别的 Bash 写命令被封死，worktree/cwd 无 deny 写入正常）；`_build_scope_system_prompt` 改为枚举「worktree + 授予的只读源目录（标 READ-ONLY）」并禁止其余，使 prompt 层与物理层一致（无 read_dirs 时回退旧 rule 2 文案，零回归）；
  4. `interface/routine_api.py`：新增 `_validate_read_dirs`，create/update 校验 `config.read_dirs` 为字符串数组且每项绝对化后是已存在目录（422 早反馈）。
- **后续防范**：
  1. **物理隔离的「授予」与「禁止」必须成对、且都落到运行时**——只声明「禁止读 X」而不提供「允许读 Y」的物理通道，会把本可达成的任务变成不可能；任何「prompt 说可读/可写」的语句都要追问「运行时有无对应的物理机制（`--add-dir`/`permissions.allow`/挂载）兑现」，否则即是 ISSUE-110 式的「空头权限」；
  2. **`--add-dir` 是读+写双授**：凡需「只读引用外部目录」，必须叠加 `settings.permissions.deny(Edit(//dir/**))` 物理锁只读，不能依赖 prompt 自律（Prompt 无强制力）；
  3. **交互式 slash 命令（`/add-dir`/`/model`/`/compact`…）在 `-p` 非交互子进程中全部无效**——凡 goal/prompt 指示 CC 执行 slash 命令的，引擎都须翻译为等价 CLI flag 或 settings，不能寄望 CC 在 headless 下「自己敲」；
  4. **config 重建点是字段静默丢失的高发区**：`service.py` 有 `_invoke_cli` 与 `_invoke_cli_interactive` 两处 `ClaudeCodeConfig(...)` 逐字段重建，新增任何 config 字段都须同步两处 + 加「重建后字段存活」回归（镜像既有 credential 回归）。
- **同类问题影响**：所有「在隔离环境中需读取环境外资源」的 routine（复刻、迁移、跨仓重构、对照基线 diff 等）此前全部受害；`config.read_dirs` 为通用解。审计点：凡 goal 含外部绝对路径引用的 worktree routine，须显式配 `read_dirs` 方能让 CC 物理读到。
- **验证**：①单元（`test_claude_code_service.py` 7 例：`--add-dir` 逐目录非逗号 / `--settings` 注入 / None 时不发 / 非交互+交互**两处**重建存活；`test_routine_phase.py` 4 例：scope prompt 枚举授予目录且标 READ-ONLY+写限 worktree / 无 read_dirs 回退旧契约 / 无 config 属性不抛 / `_normalize_read_dirs` 去重绝对化滤杂 / `_build_readonly_settings` 绝对锚点 deny 无 allow 削弱）；`routine_phase`+`claude_code` 全量 **84 用例全绿**。②**实机**（Chrome 实机跟踪 + ps/DB）：探针 routine（`77efcd8e`，phased）dispatch 后，运行中 `claude -p` 子进程 argv 实测含 `--permission-mode plan`、`--add-dir /Users/.../jerusalem-v3`、`--settings {"permissions":{"deny":["Edit(//Users/.../jerusalem-v3/**)"]}}`；plan 相位 9 分钟内 CC 对 Go 源 `find/ls/Read` **124 次**（README/go.mod/Makefile/Dockerfile…），零 session/compact 重试——源码物理可读、改写被 deny 封锁，复刻首次具备「看得见源」的前提。③**重派发链路**（iter2/implement）：`--resume <iter1 session>`、cwd 恒为隔离 worktree（**非历史 `/tmp/wt/dispatch-auto`**）、`--add-dir` 与只读 deny 跨迭代保持、`--permission-mode` 随相位 plan→acceptEdits 切换——历史 iter2-5 的「cwd 错位 + 会话死亡螺旋」失败链已端到端愈合。

## ISSUE-111 测试套件直连生产库——`test_migrations` 降级摧毁生产数据 + orchestrator 测试污染真实 routine（潜伏数据灾难，2026-06-06）

- **表因**：以模板 routine（`9e90c3c7`）复刻任务实机长跑时，发现其历史 iter2 失败于 `working directory does not exist: '/tmp/wt/dispatch-auto'`——而 `/tmp/wt/dispatch-auto` 是 `test_routine_orchestrator.py` 的测试夹具值，却写进了**生产** routine 的迭代行。顺藤摸瓜发现整个测试套件直连生产 `negentropy` 库。
- **根因**：**测试无独立数据库，与生产共享 `negentropy` 库**：
  1. `tests/conftest.py::db_engine` 直接 `create_async_engine(str(settings.database_url))`——生产库；
  2. `tests/integration_tests/db/test_migrations.py::reset_database`（autouse）执行 `command.downgrade(alembic_config, "base")`——**把生产库降级到 base，DROP 全部表 = 摧毁 routines/knowledge/memory/sessions 全部数据**，违反 [AGENTS.md「严禁删除现有数据」](../../CLAUDE.md)；其 `_sync_database_url()` 亦读 `settings.database_url`（生产）；
  3. `orchestrator._dispatch_due` / `_evaluate_and_decide` 查询条件为 `Routine.status=='running'`（**扫描全部** running routine，不限于测试自建行）；集成测试 patch `ensure_workspace`→`WorkspaceInfo('/tmp/wt/dispatch-auto')` 后调 `_dispatch_due`，会把该假 cwd 派发给当时正在 running 的**真实**模板 routine → CC 报 cwd 不存在 → 该 routine 随后陷入会话死亡螺旋（ISSUE-110 表征的历史 iter2-5 即源于此）。
  - 模板 routine 至今尚存，说明全量 `pytest tests/` 本地近期未跑全——否则 `reset_database` 一次即清空生产库。这是「跑得够全才爆」的潜伏数据灾难。
- **处理方式**（会话级强制隔离到专用测试库，单一改写点）：
  1. `tests/conftest.py` 新增 session 级 autouse fixture `_isolate_test_database`：幂等 `CREATE DATABASE negentropy_test`（asyncpg autocommit 连维护库 `postgres`）→ 覆盖 `Settings` 类的 `database_url` 纯属性返回测试库 DSN → `alembic upgrade head` 迁移测试库 → yield → 还原属性；
  2. 选「覆盖 `database_url` 属性」而非改 `settings.database.url`——后者是 frozen pydantic 模型（`_check_frozen` 拒写）；而 `database_url` 是 `@property`（`str(self.database.url)`），且**同进程** alembic env.py（`configuration["sqlalchemy.url"]=str(settings.database_url)`）、`_sync_database_url`、conftest `db_engine` 全经它读 DSN——改一处即让迁移测试的 down/up、orchestrator 集成测试、全部 DB 访问落到 `negentropy_test`，绝不触碰生产库；
  3. `db_engine` 无需改动（读 `settings.database_url`，已被改写）。
- **后续防范**：
  1. **测试**与**生产**必须物理分库——任何 conftest/fixture 直读 `settings.database_url` 建引擎或跑 DDL 都是红线，CR 必须确认测试落到 `*_test` 库；
  2. **破坏性 DDL 的 autouse fixture（`downgrade base` / `DROP` / `TRUNCATE`）尤其危险**——必须在物理隔离的库上执行，且 fixture 自身应断言所连库名以 `_test` 结尾方可放行；
  3. **扫描全表的编排逻辑（`status=='running'`）在共享库下会跨数据污染**——集成测试 patch workspace/外部副作用时，必须保证库隔离，否则测试副作用外溢到生产行；
  4. 可选加固：在 `_isolate_test_database` 起始 `assert not str(settings.database_url).rstrip('/').endswith('/negentropy')` 之外，再对生产库名做显式黑名单断言，杜绝任何回退路径直连生产。
- **同类问题影响**：所有 `tests/integration_tests/**` 此前都在生产库跑（knowledge/memory/mcp/interface 等）；隔离后一律落 `negentropy_test`。承 [ISSUE-100](#)（test_runner 污染 sys.modules）同源——测试隔离是系统性议题，DB 层是其最危险的一环。
- **验证**：隔离前快照生产库 `routines=30 / iterations=174 / 模板存在`；跑 `test_migrations.py`（含 stairway down→up，历史会清生产库）+ `test_routine_orchestrator.py` + `test_routine_phase.py` 共 **59 例全绿**；跑后生产库快照**完全不变**（30/174/模板在），`negentropy_test` 库建成且 `routines=0`（干净隔离）——数据灾难闸门关闭。

## ISSUE-112 Routine PLAN 相位评估误跑验证门控（pytest），对无实现的方案污染评分（2026-06-06）

- **表因**：phased routine 的 PLAN 相位迭代评估后，迭代行 `gate_exit_code=5`（pytest「no tests collected」）、`verdict=stalled`、`score=50`——方案阶段尚无任何实现，却跑了 `uv run pytest -q`。
- **根因**：`orchestrator._do_evaluate` 构建 `routine_eval_view` 时无条件透传 `verification_command`，`evaluator.evaluate` 凡 `verification_command` 非空即跑门控（`if routine.verification_command:`），**不区分相位**。PLAN 相位无实现，门控必然失败（exit 5/非零），其失败输出喂给 LLM Judge 会错误压低方案评分，且白白消耗 gate 超时延迟。
- **处理方式**（最小干预）：`_do_evaluate` 中 `skip_gate_in_plan = routine.current_phase == PHASE_PLAN`，PLAN 相位把 `routine_eval_view.verification_command` 置 None——`evaluate` 的既有 `if verification_command:` 守卫自然跳过门控，Judge 纯评估方案质量；IMPLEMENT/FINALIZE 相位门控照跑。
- **后续防范**：门控/验证类副作用必须「相位感知」——PLAN（无产物）跳过、IMPLEMENT/FINALIZE（有产物）执行；任何「无条件对当前工作区跑测试」的逻辑都要先问「此相位有无可验证的产物」。
- **同类问题影响**：所有配 `verification_command` 的 phased routine 的 PLAN 相位评分此前都被门控失败拉低；本修复使方案阶段评分回归方案质量本身。
- **验证**：集成测试 `test_plan_phase_skips_verification_gate`（PLAN 相位 eval_view.verification_command 为 None）+ `test_implement_phase_runs_verification_gate`（IMPLEMENT 相位照传）对照锁定，全绿；实机「before」证据：探针 PLAN 迭代 `gate_exit_code=5`（修复前），忠实任务 PLAN 迭代 `gate_exit_code=NULL`（修复后）。

## ISSUE-113 交互式 CC 产出干净成功 result 后被拆解 SIGTERM(143) 误标 error → phased 长任务 ~iter3 夭折（2026-06-06）

- **表因**：phased routine 的 PLAN 迭代 `exec_status=error`、`exec_error="CLI exited with code 143"`，即便该迭代已产出方案（事件流尾部明确有 `result: success`）；Judge 因见 `exec_status=error` 给出 `stalled`/低分（实测忠实任务 plan 评 40/stalled）。
- **根因**：**「我方拆解」的退出码被当作真实失败**。stream-json 输入模式下 CLI 产出 `result` 后**不自退**、保持 stdin 打开等更多输入；`_invoke_cli_interactive` 的 reader 见 `result` 即主动闭合 stdin 触发其退出，并给 10s 优雅窗口；若 CLI 未在窗口内退出，`finally` 强制 `terminate()`（SIGTERM → rc=143/-15）。旧状态判定 `status = "success" if proc.returncode == 0 else "error"` 据该退出码一律标 error，无视已捕获的成功 `result` 事件。
- **二阶严重性（实测校准）**：实机数据显示该误标主要命中 **PLAN 迭代**（plan 模式下 CC 在 ExitPlanMode + plan_review 回环后产出 result 却不自退 → 拆解 SIGTERM → error/143），而 **IMPLEMENT 迭代多干净退出（rc=0/success）**——故并非「每迭代必 error」（忠实任务实测 iter1=plan/error/143、iter2=implement/success）。其危害有二：① PLAN 迭代被误标 error → Judge 见 `exec_status=error` 给 `stalled`/低分（实测忠实 plan 评 40/stalled），污染方案评分与反思；② **潜在**长跑夭折风险——`decision._consecutive_exec_failures` 把连续 `exec_status∈{error,timeout}` 计数达 `_CONSECUTIVE_FAILURE_LIMIT=3` 即判 `unrecoverable`；正常情况下 implement 的 success 会打断该计数，但若个别 implement 迭代亦因 stdin 拆解迟退而 143，连续 3 次即误判不可恢复夭折。修复从源头消除两者。
- **处理方式**：`_invoke_cli` 与 `_invoke_cli_interactive` 的状态判定改为「**干净成功 result 优先于退出码**」：当 `last_result_event.subtype == "success"` 且 `not is_error` 时判 `success`，否则按退出码判定。关键守卫 `not is_error`：上下文耗尽事件的 `subtype` 误导性为 `success` 但 `is_error=True`，必须仍判 error 并由 `_classify_result_error` 归类 `context_exhausted`——否则会破坏 ISSUE-109/`729bfe54` 的死亡螺旋自愈。
- **后续防范**：
  1. **「进程退出码」≠「任务成败」**——当编排方主动 SIGTERM/kill 子进程（超时、拆解、abort）时，退出码反映的是「我方动作」而非「被编排任务的成败」；判定成败应优先采信任务自身的终态信号（此处为 `result` 事件），退出码仅作兜底；
  2. **任何「连续失败计数 → 不可恢复」守卫，其失败判定的准确性是系统能否长跑的命门**——一个把「成功」误标「失败」的上游缺陷，会经此守卫放大为「长任务必在固定轮次夭折」，且只有真正长跑才暴露；新增此类守卫时必须审计「failure 的判定是否会把正常终态误判为失败」；
  3. 交互式子进程「产出 result 后不自退」是 stream-json 模式的既有契约，闭合 stdin 后应给足优雅窗口，且**即使最终 SIGTERM 也不得据此抹掉已捕获的成功终态**。
- **同类问题影响**：所有走交互式路径（`interactive=True`，即全部 Routine）的迭代均受益；非交互路径 `rc` 通常已为 0，该分支为防御性等价、消除两路径漂移。
- **验证**：单测 `test_interactive_clean_result_success_survives_teardown_sigterm`（干净 result + SIGTERM(-15) → success）+ `test_interactive_is_error_result_not_masked_as_success`（`subtype=success` 但 `is_error=True` 仍 error 且归类 context_exhausted，守卫死亡螺旋自愈）；`claude_code_service` 全量 63 例全绿。实机「before」：探针/忠实任务 PLAN 迭代均 `error/143` 含 `result:success` 事件。

## ISSUE-114 长 worktree routine 的 IMPLEMENT 进度仅以未提交工作树形态滞留——进度丢失风险 + PR 留存缺口（2026-06-06）

- **表因**：忠实复刻长跑实机观测——worktree 已写出 `src/`、`tests/`、`pyproject.toml`、`Dockerfile` 等大量实现且 `pytest` 通过（gate exit 0），但 `git rev-list --count origin/feature/1.x.x..HEAD` 为 **0**（工作分支零提交），全部以未提交工作树形态存在。
- **根因**：`prompt_builder.build_prompt` 仅在 **FINALIZE** 相位注入 `git add -A && git commit`，IMPLEMENT 相位（`继续`/`开始`）无任何提交指令。对能走到 FINALIZE 的 常规 phased routine 无碍；但本类**巨型长任务**（阈值 99 → 评分恒 ≤50、几乎不触发 FINALIZE，且会迭代至 max_iterations=100）下，上百轮成果**始终未落 git**：① worktree 一旦被重建/清理（stale 重建、人工删除、`git worktree prune`），未提交成果**全部丢失**；② 工作分支零提交，FINALIZE/人工建 PR 时 `git push` 仅推空分支（提交在 FINALIZE 内补，但长跑不触发 FINALIZE 即无任何 checkpoint）；③ 无跨迭代 git 检查点，单轮误改无法回滚。
- **处理方式**（最小干预、相位感知）：`build_prompt` 在 **worktree routine 的 IMPLEMENT 相位** 追加「迭代检查点」段，指示每轮收尾 `git add -A && git commit` 提交到工作分支——**仅提交不推送**（推送/建 PR 仍属 FINALIZE），无实质改动则跳过。PLAN（只读）与 FINALIZE（自带 commit+push）不重复注入；扁平 routine（无 worktree）不注入。
- **后续防范**：
  1. **长 agentic 任务必须有跨迭代检查点**——不能让上百轮昂贵成果仅以「未提交工作树」单点形态存续；提交（或引擎侧确定性 auto-commit）是抵御 worktree 丢失的基本保险；
  2. **「提交时机」应相位感知**：PLAN 不提交（无产物）、IMPLEMENT 增量提交检查点（仅本地）、FINALIZE 提交+推送+PR；
  3. **进一步加固备选**（未实施，记录备忘）：引擎在每个 IMPLEMENT 迭代成功写回后**确定性 auto-commit** worktree（不依赖 CC 遵循 prompt），对成本极高的长跑更稳妥；本次先以 prompt 指令落地（与既有 FINALIZE 提交风格一致、零引擎热路径改动）。
- **同类问题影响**：所有 worktree routine 的 IMPLEMENT 相位均受益；尤以「高阈值/不触发 FINALIZE 的长任务」获益最大。
- **验证**：单测 `test_build_prompt_worktree_implement_injects_checkpoint_commit`（IMPLEMENT 注入 commit、禁 push）+ `test_build_prompt_worktree_checkpoint_only_in_implement`（PLAN/FINALIZE 不注入）+ `test_build_prompt_flat_implement_no_checkpoint`（扁平不注入）；`test_routine_phase` 全量绿。实机「before」：忠实任务工作分支 0 提交、15 项未跟踪/改动。
- **加固落地（2026-06-06，承上文「进一步加固备选」）**：将「备选」升级为已实施——引擎侧**确定性 auto-commit**，不再仅依赖 CC 遵循 prompt（与 ISSUE-116「硬约束由引擎机制兜底、不托付 LLM 自觉」同源）。新增 `workspace.checkpoint_commit(worktree_path, settings, seq)`：best-effort，`git status --porcelain` 有改动才 `git add -A && git commit --no-verify`（`--no-verify` 跳过 worktree 内 pre-commit 钩子——质量门控由 `verification_command` 负责，钩子失败不应阻断引擎检查点），无改动跳过，异常仅日志绝不冒泡。`runner._do_write_back` 在事务内捕获 `(worktree_path, seq)` 快照（gated：`checkpoint_commit_enabled` + `exec_status==success` + 有 worktree + 非 PLAN 相位），`db.commit()` 后在**事务外**执行 git I/O（不持 DB 事务）。新增 `settings.routine.checkpoint_commit_enabled`（默认 True）。prompt 指令与引擎 auto-commit 并存：双保险（prompt 引导 CC 自己提交得更语义化的 message，引擎兜底确保即便 CC 不提交也有检查点）。验证：`test_checkpoint_commit_commits_changes`（有改动→提交、工作树净、HEAD+1、message 含 seq）+ `test_checkpoint_commit_noop_when_clean`（无改动→False、HEAD 不动）+ `test_checkpoint_commit_missing_path_returns_false`（路径不存在安全返回）；workspace+orchestrator 共 43 例全绿。

## ISSUE-115 门控超时/异常退出码语义重载 + 门控超时不可调，长复刻评分被永久压顶（2026-06-06）

- **表因**（潜伏，随复刻测试套件增长触发）：① 门控（`uv run pytest -q`）超时返回 `gate_exit_code=None`，与「未配置门控」同值；② 全局门控超时固定 120s，大型复刻的测试套件一旦超 120s，每轮门控必超时 → Judge 见门控失败 → 评分被规则 2 永久压顶 ≤60，复刻再好也无法被判高分收敛。
- **根因**：
  1. **`None` 语义重载**：`evaluator._run_gate` 超时/异常均 `return None, ...`；而 `decision.decide` 的成功判据 `latest.gate_exit_code in (None, 0)` 把 `None` 视为「门控通过/无门控」。于是「门控超时」（验证状态**未知**）被误当「门控通过」——若 Judge 给出达标分（如低阈值 routine 或 LLM 未严格执行评分上限规则），会据此误判 SUCCESS，把「未验证」当「已验证通过」。
  2. **门控超时不可 per-routine 调**：`RoutineEvaluator._gate_timeout_seconds` 由 orchestrator 初始化时从全局 `settings.routine.gate_timeout_seconds`（默认 120）一次性设定，无 per-routine 覆盖；大型测试套件无法抬高超时。
- **处理方式**：
  1. `_run_gate` 超时返回 `124`（约定超时码）、异常返回 `1`——**绝不返回 None**，使 `None` **仅**表示「未配置门控」；`decision` 的 `in (None,0)` 遂自动把超时/异常（124/1）排除出「通过」，超时不再被误判成功；
  2. `_run_gate` 增 `timeout` 形参，`evaluate` 从 `getattr(routine,"gate_timeout_seconds",None)`（即 `config.gate_timeout_seconds`）取 per-routine 覆盖、回退实例默认；orchestrator `_do_evaluate` 的 `routine_eval_view` 注入该字段。大型复刻可经 `config.gate_timeout_seconds` 抬高门控超时，避免评分被超时压顶。
- **后续防范**：
  1. **哨兵值语义不可重载**：`None`/`-1`/`0` 等若同时承载「未发生」与「发生但失败」两义，下游布尔判据必踩坑；「未运行」与「运行了但超时/异常」必须可区分（本例以非零退出码区分）；
  2. **「未知 ≠ 通过」**：任何客观门控的「超时/异常/不可达」都应作**保守失败**处理，绝不可等同「通过」——尤其当其结果参与「终止为成功」这类不可逆判定时；
  3. **资源阈值（超时/预算/上限）应 per-task 可调**：固定全局阈值对「重量级长任务」必然失配，须留 per-routine 覆盖通道。
- **同类问题影响**：所有配 `verification_command` 的 routine；尤以测试套件较重、运行时长接近/超过 120s 的复刻/迁移类长任务。审计点：凡下游以 `x in (None, 0)` / `x is None` 兼判「无」与「失败」者，均需复核哨兵语义。
- **验证**：单测 `test_run_gate_timeout_returns_124_not_none`、`test_run_gate_per_routine_timeout_overrides_instance_default`（传 timeout=1 约 1s 超时）、`test_run_gate_passes_through_exit_code`、`test_decide_success_blocked_by_gate_timeout_sentinel`（124 不判成功）；evaluator_gate + decision 共 39 例全绿。

## ISSUE-116 LLM-as-Judge 不遵守 acceptance_criteria 的「未达标即封顶」散文规则，评分越线污染收敛（2026-06-06）

- **表因**：忠实复刻长跑实机观测——任务 `acceptance_criteria` 明文规定「若未达到 Acceptance Criteria，评分一律减半，有效得分永远不高于 50」，但 Judge（`gpt-5-nano`）给 iter8 打 **85**，其自身 reflection 却写明「未完成 Acceptance Criteria 的端到端生产验证」——自相矛盾且越线；相邻 iter 在同等未达标下又打 45-50，评分剧烈震荡（50→50→45→85→48）。
- **根因**：**关键评分约束仅以自然语言写在 acceptance_criteria 散文里，依赖小模型自觉执行**。LLM-as-Judge 对「全局硬约束（未达标即封顶）」的遵循本就不稳定（见 arXiv:2411.15594 偏差综述），小模型尤甚。后果：① `best_score=85` 是越过封顶规则的「幻象高分」，污染 `last/best_score`；② 评分剧烈震荡破坏 `_is_no_progress`/`_is_oscillating` 的停滞/振荡判据可靠性；③ 若震荡到达成阈值，会据幻象分误判 SUCCESS。
- **处理方式**（把散文规则提升为引擎确定性机制）：
  1. Judge JSON 契约新增结构化布尔 `acceptance_met`（prompt 要求：当且仅当**全部**验收项客观达成才 true，含其中声明的端到端/部署/切换硬条件）；`_parse` 解析该字段（缺失→None）；
  2. `RoutineEvaluator` 新增 `acceptance_unmet_score_cap`（实例默认来自 `settings.routine.acceptance_unmet_score_cap`，默认 0=关闭）+ per-routine `config.acceptance_unmet_score_cap` 覆盖；
  3. `evaluate`：当 `acceptance_met is False` 且 `cap>0` 且 `score>cap` 时，**确定性把分数封顶到 cap**，并把越线的 `verdict=pass` 纠正为 `progressing`（验收未达成绝不应判 pass → 防误终止）。`acceptance_met=None`（旧模型未遵循契约）或 `cap=0` 时不封顶，向后兼容、对其它 routine 零影响。
- **后续防范**：
  1. **不可把关键约束只托付给 LLM 自觉**——凡「硬性、可判定的评分/终止约束」（未达标封顶、门控失败上限、预算红线），都应在引擎层以确定性代码兜底，prompt 仅作软引导；LLM 适合「质量打分」，不适合「规则裁决」；
  2. **让 Judge 输出结构化裁决信号**（如 `acceptance_met` 布尔）而非仅一个综合分——把「裁决」与「打分」正交分离，裁决项交确定性逻辑消费，比从单一分数反推更鲁棒；
  3. 复刻类任务的 `acceptance_criteria` 若含「未达标即减半/封顶」语义，应同时设 `config.acceptance_unmet_score_cap`（落地引擎强制），不能仅写散文。
- **同类问题影响**：所有依赖 LLM-as-Judge 评分的 routine；尤以「acceptance 含硬性末态条件（部署/切换/端到端）、主体完成但末态未达」的长任务——主体完成易诱使模型给高分，封顶机制确保「未达末态即不越线」。
- **验证**：单测 5 例（`test_acceptance_unmet_caps_score_and_corrects_pass` 封顶 85→50 且 pass→progressing / `test_acceptance_met_true_not_capped` / `test_acceptance_met_none_not_capped` 向后兼容 / `test_acceptance_cap_disabled_when_zero` / `test_acceptance_cap_per_routine_overrides_instance`）；engine 全量 912 例全绿。实机「before」：忠实 iter8 score=85 而 reflection 自述验收未达成。

## ISSUE-117 6 Agents 的 `invoke_claude_code` 全局默认（mcp_config/allowed_tools）从未注入 session-state——全系统默认 MCP 对 Agent 入口形同虚设（2026-06-06）

- **表因**（潜伏，在"为全系统内置默认浏览器 MCP"时浮现）：把 Playwright 浏览器 MCP 注入 `builtin_tools(claude_code).config.mcp_config` 后，Routine / Scheduler 入口经 `_load_claude_code_defaults` 直读 DB，立即生效；但 6 个 ADK Agent 经 `ActionFaculty.invoke_claude_code` 调 Claude Code 时**拿不到**该默认 MCP。
- **根因**：`agents/tools/claude_code.py` 的 `invoke_claude_code` 从 `tool_context.state.get("claude_code_config")` 读全局默认（`mcp_config` / `allowed_tools` / `permission_mode` …），但该 session-state 键**全仓从未被任何代码写入**——遂恒为空 dict，Agent 侧每次都以 `mcp_config=None`、内置 6 工具默认裸跑。即"全系统默认"对 Agent 入口形同虚设：三条 Claude Code 入口（Routine / Scheduler / Agent）中，唯独 Agent 入口未对齐单一事实源（builtin_tools）。
- **处理方式**（SSOT 收敛，最小干预）：`invoke_claude_code` 在 `tool_context.state["claude_code_config"]` 缺省时**惰性回退** `_load_claude_code_defaults()`（与 Routine/Scheduler 同源），把 cli_path/model/system_prompt/cwd/max_turns/timeout/permission_mode/`allowed_tools`/`mcp_config` 投影为默认；凭证复用其已解析结果（回退路径无原始 credentials dict）。state 已注入时维持原路径不变（向后兼容）。
- **后续防范**：
  1. **"读取点"必有"写入点"**：任何 `state.get(K)` 形态的全局配置消费，都要追问"K 由谁写入"；若无写入方则该配置链路断裂（本例 `claude_code_config` 读而不写，潜伏至今）。新增 state 驱动配置时，读写两端须成对落地或显式回退单一事实源；
  2. **多入口共享配置须收敛到单一事实源**：同一能力的多条入口（此处 3 条 Claude Code 调用路径）应统一经一个 loader 取默认，避免某条入口悄悄走"空配置裸跑"分支；
  3. **"全系统默认"声明须按入口逐一核验**：声称系统级默认时，须枚举所有消费入口分别验证，不能假定一处注入即全域生效。
- **同类问题影响**：所有经 `invoke_claude_code` 触发 Claude Code 的 ADK Agent 行为（不止浏览器 MCP——此前 model/system_prompt/allowed_tools 全局默认对 Agent 入口同样未生效，本次一并修复）。
- **验证**：单测 `test_invoke_claude_code_falls_back_to_global_defaults_when_state_empty`（空 state → 回退默认，携 playwright mcp_config 与 mcp__playwright allowed_tools，复用已解析凭证）+ `test_invoke_claude_code_prefers_session_state_when_present`（state 存在 → 不触发回退、沿用 state 配置）。相关：迁移 0062 端到端注入与 Routine `_build_config` 合并语义见 [浏览器操作 MCP 集成方案](../concepts/design/browser-automation-mcp-integration.md)。

## ISSUE-118 `_evaluate_one` 生产死路径 + 事件持久化集成测试覆盖错路径（单一事实源违背 + 测试保真缺口）（2026-06-07）

- **表因**：实机回归 Routine 闭环时审阅 orchestrator，发现 `_evaluate_one`（同步内联评估）已不被 `inspect_once` 调用——心跳实际走 `_evaluate_and_decide` → `_claim_for_eval` → 后台 `_do_evaluate`（Evaluate 后台化，729bfe54）。但 4 个事件持久化集成测试（`test_routine_event_persistence.py`）仍 `await orch._evaluate_one(rid)`，即测试在验证生产**从不执行**的死路径。
- **根因**：Evaluate 后台化新增 `_do_evaluate` 时，未删除旧 `_evaluate_one`、亦未迁移其测试 → 同一「评估 → 写回 → 追加 gate/eval 事件」逻辑存在两份副本（违 Single Source of Truth），且测试钉在旧副本上（测试保真缺口：两副本一旦漂移，测试无法发现真实生产路径的回归）。
- **处理方式**（最小干预，熵减）：① 测试新增 `_evaluate_latest(orch, rid)` 辅助，驱动真实路径 `_claim_for_eval` → `_do_evaluate`，替换 4 处 `_evaluate_one(rid)` 调用；② 删除 `_evaluate_one`（123 行死代码）。事件持久化 `_persist_eval_events` 本为两副本共享、行为等价，迁移零语义变更、无运行时行为改变。
- **后续防范**：① 重构出「执行下沉/后台化」的新路径时，**必须同步迁移其测试到新路径并删除旧同步副本**，避免测试钉死在死代码上、给出虚假绿；② 同一核心闭环逻辑（评估/写回/决策）严禁双副本，须单点收敛。
- **同类问题影响**：仅 Routine 评估路径；生产早已只走 `_do_evaluate`，本修复纯属代码/测试熵减，无行为变更。
- **验证**：迁移后 `test_routine_event_persistence.py` 6 例全绿（真实路径）；routine 单测 126 + orchestrator/api 集成 44 全绿，零回归。

## ISSUE-119 共享 `negentropy_test` 测试库跨 Conductor workspace 迁移版本污染（test-infra 脆弱性）（2026-06-07）

- **表因**：在 puebla-v3（alembic head=0062）运行集成测试，conftest `_isolate_test_database` 的 `alembic upgrade head` 报 `Can't locate revision identified by '0064'`，全部集成测试 setup 失败。
- **根因**：同一 PostgreSQL 实例被多个 Conductor workspace 共享，而 ISSUE-111 的测试库隔离仅区分「测试 vs 生产」——**测试库名固定为 `<db>_test`（`negentropy_test`），跨 workspace/分支共享同一物理库**。某更高分支的 workspace 跑测试时把 `negentropy_test` 迁到 0064，puebla-v3（本地仅到 0062）无法 upgrade（0064 在本地迁移脚本中不存在）→ setup 失败。生产 `negentropy` 同样已被迁到 0064（加列式增量迁移，故 0062 代码仍能在 0064 schema 上运行，routine 读写未受影响）。
- **处理方式**（当前缓解）：`negentropy_test` 为空（routines=0、无活动连接），`DROP DATABASE ... WITH (FORCE)` 后由 conftest 重建至本地 head 0062，集成测试恢复全绿。
- **提议根因修复**（候选后续轮次）：把测试库名做 **workspace 唯一化**（如以 repo 根路径 hash 派生 `negentropy_test_<hash>`），使多 workspace 并发测试互不污染；CI 在隔离容器内不受影响。另可在 conftest 升级前校验「DB 版本 ≤ 本地 head」，超前时给出明确重建指引而非裸 alembic 报错。
- **后续防范**：① 共享 DB 服务器上的「测试库」命名须计入并发维度（不止 test/prod 二分，还要 workspace/分支隔离），否则迁移版本互相踩踏；② 跨实例共享的 schema 版本须有「本地代码 head 与 DB version 偏差」的可观测校验。
- **同类问题影响**：所有在共享 postgres 上并发跑集成测试的 workspace；环境性问题，非产品代码缺陷。
- **验证**：drop+重建后集成测试全绿（见 ISSUE-118 验证：6+126+44 全绿）。

## ISSUE-120 引擎 venv/uv 激活变量泄漏进 worktree 子进程（gate + CC），物理隔离未覆盖 Python 环境（2026-06-07）

- **表因**：忠实复刻 routine 的 IMPLEMENT 门控 `uv run pytest -q` 输出首行恒为 `warning: VIRTUAL_ENV=.../negentropy/apps/negentropy/.venv does not match the project environment path \`.venv\` and will be ignored`。
- **根因**：worktree 隔离此前只覆盖文件系统（cwd / `--add-dir` / `Edit` deny），但任务子进程**整体继承引擎 `os.environ`**。引擎自身经 `uv run` 启动，注入 `VIRTUAL_ENV`（指向 `negentropy/.venv`）与 `UV_RUN_RECURSION_DEPTH`；二者越界泄漏给在**另一项目** worktree（自有 `.venv`）内运行的 gate 与 CC 子进程——`service._build_subprocess_env` 直接 `os.environ.copy()` 未剥离；`evaluator._run_gate` 的 `create_subprocess_shell` 干脆不传 `env=`。
- **影响**：本任务 gate 是 `uv run pytest`，uv 检测错配后忽略（自愈，仅警告）；但**非 uv 门控（裸 `pytest`/`python`）会落到引擎 venv 找错包 → 假失败污染评分**；`UV_RUN_RECURSION_DEPTH` 把任务独立 `uv run` 误计为嵌套递归、蚕食任务自身的嵌套预算。
- **处理方式**（单一事实源）：新增 `engine/utils/subprocess_env.py::inherited_env_without_engine_venv()`，剥离 `{VIRTUAL_ENV, VIRTUAL_ENV_PROMPT, UV_RUN_RECURSION_DEPTH}`；`_build_subprocess_env`（CC 子进程）与 `_run_gate`（gate 子进程）统一复用，使物理隔离从文件系统延伸到 Python 运行环境。
- **后续防范**：① worktree / 隔离子进程不应整体继承父进程 env；跨项目子进程须净化继承环境中的「venv / 工具激活」变量；② strip 逻辑单点收敛，避免双副本漂移。
- **同类问题影响**：所有 worktree routine 的 gate 与 CC 子进程；尤以非 uv 门控者评分会被假失败污染。
- **验证**：单测 `test_inherited_env_strips_engine_venv_vars` + `test_run_gate_subprocess_does_not_inherit_engine_virtualenv`（端到端 gate 子进程 `$VIRTUAL_ENV` 为空）；evaluator_gate 17 例 + routine 单测 130 + claude_code 164 + 集成 50 全绿。

## ISSUE-121 弱 Judge 误判 acceptance_met=true 触发过早不可逆 SUCCESS+PR（复刻仅骨架即「成功」）（2026-06-07）

- **表因**：忠实复刻 routine 实机跑完整闭环 `PLAN→IMPLEMENT→FINALIZE→succeeded`，建出真实 PR（`data-la-maps#4`），best_score=92。但检视产物：核心业务逻辑（geocoding 11 阶段管线 + 6 模式矩阵 + IP 双源融合——Go 服务存在的根本理由）**未实现**——`domain/geocodes/service.py` 仅 45 行桩，自述「Phase 2：简化实现，仅支持按 postal_code 直接查 PlacesRepo；Phase 4：完整 11 阶段 Pipeline + 6 模式矩阵」。即「成功」过早，复刻实为骨架。
- **根因**：不可逆 SUCCESS（→FINALIZE→PR→succeeded）取决于**单次弱 Judge（`gpt-5-nano`）对 `acceptance_met` 的裁决**。ISSUE-116 的 cap 仅守护 `acceptance_met=False` 方向（未达标封顶），对**误判 `acceptance_met=true`**（假阳性）无任何防护。弱模型见「~21 端点 + 75 测试通过 + 架构清晰」即判 `acceptance_met=true`/92，未核验行为级 Go 对齐（其自身 reflection 反而承认「下一步聚焦 Phase 3 Write API 与规则引擎基线」——自相矛盾）。
- **处理方式**（本轮，引擎层根因杠杆）：新增 per-routine `config.evaluator_model` 覆盖，经 `evaluate → _judge → resolve_model_config` 的 `explicit_model` 注入——高风险复刻类 acceptance 裁决可指定更强 Judge 模型，缓解弱模型假阳性；opt-in，未设时回退实例默认，其它 routine 零影响。配套任务定义将 acceptance 强化为「行为级对齐（管线/融合 faithfully 实现，非简化桩）」并设强 Judge 模型。
- **后续防范**：① 触发**不可逆动作**（建 PR / 终止成功）的判定不应系于单次弱模型意见——高风险裁决须用足够强模型或多信号佐证；② LLM-as-Judge 的**假阳性与假阴性都要防**（ISSUE-116 防假阴性「达标却被压分」，本条防假阳性「未达标却判成功」）；③ acceptance 须可被 Judge **行为级**核验，避免「结构齐备即判达标」。
- **候选后续加固**：当 `acceptance_met=true` 且分 ≥ 阈值（即将触发不可逆成功）时，以更强模型做一次对抗式确认门（confirm-before-commit），未确认则降级继续迭代。
- **同类问题影响**：所有以弱模型 Judge 裁决 acceptance 的高风险 routine；尤以「结构易搭、业务逻辑深」的复刻/迁移类。
- **验证**：单测 `test_evaluator_model_override_flows_to_judge`（per-routine 模型覆盖流经 `_judge`）+ `test_evaluator_model_falls_back_to_instance_default`（未设回退实例默认）；evaluator_gate 17 例全绿。实机 before：seq3 judge raw `acceptance_met:true, score:92` 而 `geocodes/service.py` 为 45 行简化桩。
- **修复补正（端到端正确性）**：ISSUE-121 的 per-routine `evaluator_model` 经 `explicit_model` 注入，而 `resolve_model_config_async` 原对 `explicit_model` **短路返回 `(name, {})`**——丢失 `model_configs`/`vendor_configs` 的 `api_key`/`api_base` 代理凭证，致 Judge 的 litellm 调用必因缺凭证失败（单测因 mock 了 resolver 未暴露）。改为优先 `resolve_llm_config_by_model_name(explicit_model)` 解析以携带凭证 kwargs，DB 未命中再回退 `(name, {})`。实机验证 `anthropic/claude-sonnet-4-6` → kwargs 含 api_base/api_key/temperature/thinking；新增单测 `test_explicit_model_resolves_credentials_via_by_name`。

## ISSUE-122 `--skip-build` 重启时 start-production.mjs `linkRuntimeAsset` 非幂等 → UI 启动失败连锁中止全部服务（2026-06-07）

- **表因**：以 `cli.sh restart --no-pull --skip-build` 做后端 only 快速重启时，UI 启动报 `Error: src and dest cannot be the same .../.next/standalone/apps/negentropy-ui/.next/static`（ERR_FS_CP_EINVAL）；cli.sh 见「ui 启动失败」遂**中止并停掉已起的 backend/perceives**，全栈宕。
- **根因**：`start-production.mjs::linkRuntimeAsset` 先 `symlinkSync(relativeSource, targetPath)`，target 已存在（monorepo 下 Next standalone 自带 `.next/static` 软链，或上次启动已链接）则抛 EEXIST 落入 `catch` 的 `cpSync(source, target)`；而 target 软链回指 source → src/dest 同 inode → `ERR_FS_CP_EINVAL`。即该函数对「重复启动（--skip-build 不重建前端）」非幂等。次生：cli.sh 对单服务启动失败采取「中止 + 停全部」策略，放大为全栈宕。
- **处理方式**：`linkRuntimeAsset` 增幂等保护——`existsSync(targetPath)` 即 return（Next 自带软链 / 上次已链接则跳过），不再走 symlink→cpSync 冲突路径。使 `--skip-build` 快速重启可用（后端 only 改动免全量前端构建）。
- **后续防范**：① 启动期「链接/复制运行时资产」须幂等（重复启动不报错）；② cli.sh 单服务启动失败的「中止全部」策略放大故障半径，可考虑保留已健康服务或更精确的回滚边界。
- **同类问题影响**：所有 `--skip-build` 重启；阻断后端 only 快速迭代（被迫每次全量前端构建）。
- **验证**：修复后 `restart --no-pull --skip-build` UI 正常启动、四服务健康（见下次重启）。

## ISSUE-119 升级 共享 DB 迁移版本超前致 cli.sh **启动期** alembic upgrade 失败（不止测试库）（2026-06-07）

- **表因**：会话中段（数小时后）`cli.sh restart` 在 Phase 3 数据库迁移报 `Can't locate revision identified by '0064'` 而**中止启动**，全栈无法拉起。
- **根因**：ISSUE-119 同源升级——共享 PostgreSQL 的**生产 `negentropy` 库**被另一更高分支 workspace 的 `alembic upgrade head` 迁到 0064，而 puebla-v3 本地 head 仅 0062（0063/0064 不在 `origin/feature/1.x.x`，属未合并分支）。cli.sh 启动无条件 `alembic upgrade head`，current=0064 本地不可解析 → 失败中止。生产 schema 0064 为 0062 的加列式超集，故 0062 代码运行无碍，唯启动迁移步骤踩雷。
- **处理方式**（最小可逆缓解）：迁移前临时 `UPDATE alembic_version SET version_num='0062'`（仅指针、不动 schema）使 `upgrade head` 在 0062=head 处 no-op，迁移阶段过后立即恢复 `'0064'`（真实 schema 态，保护其它 workspace 不被 0063/0064 重放误伤）；窗口约 4s。
- **后续防范**：① 见 ISSUE-119 根因修复（DB 按 workspace 唯一化，dev 库亦然）；② cli.sh 迁移步骤宜容忍「DB 版本超前本地 head」（视为 no-op + 告警）而非裸报错中止——超前是共享 DB 常态，不应阻断启动。
- **同类问题影响**：共享 postgres 上多 workspace 并发开发的启动链路；环境性，非产品代码缺陷。
- **验证**：stamp 0062→启动→恢复 0064 后四服务正常拉起。

## ISSUE-123 交互工具未入白名单致 Plan Review 反馈无法送达 CC，评审闭环 DOA（2026-06-07）

- **表因**（用户实机指认 routine `5ae4af6e` Iteration#1）：CC Turn 9 经 `AskUserQuestion` 提交 Plan、NegentropyEngine 产出 Plan Review，但**该 Review 从未送达 CC**；Turn 10 报错，Turn 12 跳过评审问询自行 `ExitPlanMode`，Turn 18 单方面交付 Plan。预期闭环「CC 提交 Plan → Engine 评审 → 反馈 CC → CC 完善/通过」名存实亡。
- **根因**（事件级实证）：iteration 事件 seq218 `tool_use AskUserQuestion` → seq219 `plan_review`(Engine 算出 refine/38) → **seq220 送达 CC 的 tool_result = `{"output":"Answer questions?","is_error":true}`**（非评审反馈）；seq223/225 `ExitPlanMode` → `{"output":"Exit plan mode?","is_error":true}`。即 CLI 因 `--allowed-tools` 白名单**不含 AskUserQuestion/ExitPlanMode** 而直接拒绝二者（返回许可提示串 + `is_error=true`），Engine 经 stdin 写回的应答根本无法被消费。`_build_config` 启用 `interactive=True`（`auto_answer_questions` 默认开）却从未把这两个交互应答工具并入 `allowed_tools`——per-routine `config.allowed_tools`（模板仅 8 工具）与 `_ROUTINE_DEFAULT_TOOLS` 均不含之。v4 routine 实测同样复现（seq485→487）。
- **处理方式**（最小干预）：`_build_config` 在 `auto_answer_questions` 开启时，强制把 `AskUserQuestion` + `ExitPlanMode` 并入 `config.allowed_tools`（幂等，去重），使 CLI 放行二者、Engine 经 stdin 的 Plan Review/auto-answer 得以送达 CC，评审反馈链路恢复（CC 可据反馈完善或通过）。新增模块常量 `_INTERACTIVE_AUTO_ANSWER_TOOLS`。
- **后续防范**：① 任何「依赖工具被 CLI 放行才能运作」的机制（auto-answer/plan-review），其所需工具必须由引擎强制进白名单，不能假定用户 config 含之；② 交互工具的 tool_result `is_error=true` + 许可提示串（"Answer questions?"/"Exit plan mode?"）是「工具被白名单拒绝」的指纹，排障可据此快速定位；③ 评审反馈这类「写回 stdin 必达」语义，应有送达确认/失败可观测，而非静默被拒。
- **同类问题影响**：所有启用 auto_answer/plan-review 且 `allowed_tools` 未含交互工具的 routine（含全部沿用模板 8 工具者）——即此前**所有** worktree routine 的 Plan Review 反馈均未真正送达 CC，评审形同虚设。
- **验证**：集成测试 `test_build_config_forces_interactive_tools_when_auto_answer` + `test_build_config_per_routine_tools_override`（覆盖工具+强制并入交互工具）；_build_config 7 例、routine 单测 131 全绿。

### ISSUE-123 深层根因（受控实验定性，2026-06-07）
- **allowed_tools 白名单仅是必要前提，非完整修复**：把 AskUserQuestion/ExitPlanMode 并入 allowed_tools 后实机复跑（探针 routine `cf3022c9`），CC 收到的 AskUserQuestion tool_result **仍为 `{"output":"Answer questions?","is_error":true}`**。即白名单放行后问题依旧。
- **受控实验（ground truth）**：直接 `printf '<stream-json user msg>' | claude -p --input-format stream-json --output-format stream-json --permission-mode default --model claude-haiku-4-5`，强制模型调用 AskUserQuestion，观察到 CLI **立即**自emit `user` tool_result `is_error=true out="Answer questions?"`，**根本不读 stdin、不发 control_request**。结论：**claude 2.1.150 headless(`-p`) 下 AskUserQuestion 被 CLI 即时自动报错解析，无法经 stdin tool_result 应答**——引擎「检测 tool_use → 写 stdin tool_result 应答」的交互式 auto-answer 机制对 AskUserQuestion 自始无效（CC 只是吞掉错误继续、自行 ExitPlanMode 单方面交付）。Plan Review 反馈物理无法经此通道送达 CC。
- **可行性勘察**：① `--permission-prompt-tool` 在 homebrew 2.1.150 与 conductor 2.1.156 的 `--help` 均**未暴露**（不可经 CLI flag 启用）；② `claude_code_sdk` / `claude_agent_sdk` **均未安装**（引擎 `_invoke_sdk` 为死路径）。故「同轮答复」两条路径（SDK canUseTool / --permission-prompt-tool stdio）均非现成可用，需较大改造且 canUseTool 能否真正「答复」（而非仅许可）AskUserQuestion 尚待证实。
- **两条修复路线**（待定）：
  1. **跨迭代评审闭环**（headless 鲁棒、可立即落地）：PLAN prompt 不再让 CC 用 AskUserQuestion，改为直接产出方案；引擎迭代后评审，未通过则留在 PLAN 相位 + 反馈注入下一轮（CC 据此完善），通过才推进 IMPLEMENT。实现用户「提交→评审→反馈→完善/通过」意图，只是改为相邻迭代之间。
  2. **同轮答复**（保留单轮内闭环，改动大、可行性待证）：安装 `claude_code_sdk` 并改走 SDK `query()` + `can_use_tool` 回调（或确证 conductor 隐藏 flag 的 stdio 控制协议），由引擎在回调内返回 AskUserQuestion 答复。
- **当前状态**：allowed_tools 前提修复已提交（`2eea8249`）；完整修复路线待与用户确认后实施（用户已倾向路线 2，但其依赖项非现成、需评估投入与可行性）。

### ISSUE-123 同轮闭环可行性已证实（hooks 路径，2026-06-07）
- **SDK can_use_tool 路线否决**：`claude_code_sdk` 0.0.25 与 claude 2.1.150 不兼容（`rate_limit_event` 解析崩溃）；`claude-agent-sdk` 0.2.93 兼容，但 `can_use_tool` 仅许可（`PermissionResultAllow` 字段 `behavior/updated_input/updated_permissions`，**无返回答案字段**），无法「答复」AskUserQuestion。
- **hooks 路线证实可行（受控实验）**：PreToolUse hook 拦截 AskUserQuestion，返回 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":<评审反馈>}}` → CC **同轮收到反馈并据此修订**。SDK 内置 hooks 与 **CLI `--settings` hooks（引擎实际路径，homebrew claude 2.1.150）双双验证通过**（`CLI_HOOK_DELIVERED_FEEDBACK_SAME_TURN=True`，CC 下一 turn 输出「我会补充错误处理…增加单元测试…」）。
- **落地设计（CLI hooks，已实现）**：
  1. `plan_review_hook.py`：PreToolUse hook 入口。从 stdin 读 hook 载荷（AskUserQuestion 的 tool_input 含 CC 提交的完整方案），从命令行参数指向的 per-iteration ctx 文件读 routine 上下文（goal/acceptance/reflections/model/timeout），调 `PlanReviewer.review()`，输出 deny+reason：refine→反馈+要求据此修订重提；approve→告知通过、退出 Plan 模式。
  2. orchestrator `_build_config`：phase=plan 且 plan_review_enabled 时，写 ctx 文件并把 PreToolUse hook 合并进 `config.settings`（与只读 deny 共存），命令 = `<engine_python> plan_review_hook.py <ctx_path>`。
  3. prompt_builder PLAN 相位：指示 CC 把**完整方案写入 AskUserQuestion 的 question** 提交审阅（使 hook 能读到方案全文）。
  4. 保留 ISSUE-123 的 allowed_tools 前提（AskUserQuestion/ExitPlanMode 须放行）。

### ISSUE-123 实机端到端复验：三处真因逐一修复后 ✅ 完全修复（2026-06-07）
首次接入钩子后实机仍复发（CC 仍收 "Answer questions?"），逐层定位并修复三处叠加真因：
1. **stdout 污染**：钩子 stdout 混入引擎 structlog 噪声（`disposer_registered` 等）→ Claude Code 按纯 JSON 解析失败 → 放弃钩子 → CC 落回 CLI 自动报错。修复：`_emit` 经**保存的原始 stdout fd** 写最终 JSON + 进程级 `fd1→fd2` + `sys.stdout→stderr` + `configure_logging(sinks=file)` 四重纯净化。
2. **`-m` 预导入父包**：`python -m negentropy.engine.routine.plan_review_hook` 会让 runpy 先 import 父包 `__init__` 链（在钩子重定向代码执行前触发 lifecycle 日志写 stdout）。修复：改 **脚本路径**执行（`python <hook.py> <ctx>`，不预导入父包），钩子自举把 `src/` 加入 `sys.path`。
3. **钩子超时**：钩子实际耗时（引擎冷启动 + PlanReviewer LLM ≈ 15-20s）超 Claude Code PreToolUse 默认超时（~10s）→ 被放弃。修复：settings hook 项加 `"timeout" = plan_review_timeout_seconds + 30`。
- **实机证据（probe `374b5f36`）**：seq11 CC 调 AskUserQuestion 提交方案 → seq12 tool_result = **「✅ NegentropyEngine 已通过本方案审阅（评分 85/100）。审阅意见：…」**（评审同轮送达）→ seq13 CC「审阅已通过…直接进入实施」→ seq14 ExitPlanMode → seq17 进入实施。`"Answer questions?"` 自动错误消失，闭环按预期工作。
- **残留小问题（低优先）**：ExitPlanMode 同样被 headless CLI 自动报错（seq16 `"Exit plan mode?" is_error=true`），但此处无害——CC 正确理解为「已批准、继续」并进入实施。可后续让同一钩子对 ExitPlanMode 也 allow/无害化，进一步消噪。
- **回归**：plan_review_hook 单测 5 + _build_config 集成 7 + routine 单测全绿；钩子从任意 cwd 输出纯净单行 JSON、exit 0。

## ISSUE-125 `plan_review_model` 无 per-routine 覆盖——重型复刻方案审阅仍由弱模型把关（2026-06-07）

- **表因**：`orchestrator._write_plan_review_ctx` 只读全局 `settings.routine.plan_review_model`（默认 None → 解析到弱模型 gpt-5-nano）；重型复刻类 routine 的**方案审阅**无法指定强模型。
- **根因**：与 ISSUE-121 同源缺口的对偶——评估侧 Judge 已在 ISSUE-121 拿到 per-routine `config.evaluator_model` 覆盖（orchestrator `_do_evaluate`），但**方案审阅侧 Plan Reviewer 漏配**对应的 per-routine 覆盖。审阅意见质量直接决定 CC 修订方向，弱模型审阅不可靠（同 ISSUE-116/121 的「弱模型裁决/审阅不可信」），在 Plan 闸门处仍开放。
- **处理方式**（镜像 ISSUE-121 范式，最小干预）：`_write_plan_review_ctx` 的 `model` 改为 `(routine.config or {}).get("plan_review_model") or settings.routine.plan_review_model`。hook 从 ctx 读 model 无需改。
- **后续防范**：成对能力（评估 Judge / 方案 Reviewer）的「强模型覆盖」配置须对称落地——新增一侧覆盖时同步审计另一侧是否同源缺失。
- **同类问题影响**：所有启用 Plan Review 的 routine；尤以重型复刻/迁移类需强模型审阅者。
- **验证**：单测 `test_write_plan_review_ctx_per_routine_model_override`（config 覆盖）+ `test_write_plan_review_ctx_falls_back_to_global`（回退全局）。

## ISSUE-126 ExitPlanMode 残留 headless 自动报错噪声——同钩子返回「已批准」消噪（2026-06-07）

- **表因**：ISSUE-123 修复 AskUserQuestion 后，ExitPlanMode 仍走 service.py 的 stdin auto-answer（headless 下同样无效）→ 实测 probe4 seq16 `{"output":"Exit plan mode?","is_error":true}`。无害（CC 理解为已批准继续）但属同根残留噪声、污染审计。
- **根因**：headless `claude -p` 下 ExitPlanMode 与 AskUserQuestion 同类——CLI 自动报错、不读 stdin tool_result。受控实验另证 PreToolUse `permissionDecision=allow` **不能**消除（ExitPlanMode 的退出确认非 permission allow 可满足）。
- **处理方式**：ExitPlanMode 同走 `plan_review_hook.py`（按 tool_name 分支），返回 `deny + permissionDecisionReason=「✅ 已批准退出 Plan 模式，进入实施…无需再调用」`。受控实验证实该 reason 同轮回灌 CC（替代 opaque "Exit plan mode?"），CC 据此继续实施。orchestrator settings 追加 ExitPlanMode matcher（瞬时分支、timeout=15）；service.py 在 `plan_review_via_hook` 时跳过失效的 ExitPlanMode stdin auto-answer。
- **后续防范**：headless 交互工具（AskUserQuestion/ExitPlanMode）的「应答」一律经 PreToolUse 钩子 deny+reason 投递，不依赖 stdin auto-answer（其对这两个工具自始无效）。
- **同类问题影响**：所有 PLAN 相位经钩子评审的 worktree routine。
- **验证**：单测 `test_exit_plan_approved_reason_content` + `test_main_exit_plan_emits_approval` + `test_main_unrelated_tool_no_emit`；钩子对 ExitPlanMode 输出批准 JSON。routine 单测 141 + build_config 7 + claude_code 163 全绿。**实机复验通过**（探针 `e49bf962`）：monitor 报 `✅(3) ExitPlanMode=APPROVED(no is_error noise): "✅ NegentropyEngine 已批准退出 Plan 模式…"`，opaque "Exit plan mode?" 消失。

## ISSUE-127 强模型 JSON 围栏致 Judge/PlanReviewer/记忆提取解析全线失败（2026-06-07）

- **表因**：ISSUE-125 接入强模型 `anthropic/claude-sonnet-4-6` 作 Plan Reviewer 后，实机首跑钩子返回「（NegentropyEngine 评审暂不可用）」fail-open——`plan_review_judge_failed: Expecting value: line 1 column 1 (char 0)` 重试 3 次耗尽。
- **根因**：`claude-sonnet-4-6`（经代理）即便指定 `response_format={"type":"json_object"}`，仍把 JSON 包在 markdown 代码围栏里——实测恒返回 ` ```json\n{...}\n``` `。而 `evaluator._parse` / `plan_reviewer._parse` / `memory_extractor._parse_response` 均直接 `json.loads(content)`，见前导反引号即抛。弱模型（gpt-5-nano）返回裸 JSON 故历史未暴露——但凡切到会围栏的强模型（即 ISSUE-121/125 的目标场景），评审/评分/记忆提取**全线静默退化**。受控实验 2× 复现，且证实「无论加不加 `response_format`」sonnet 都围栏。
- **处理方式**（单点收敛）：新增 `engine/utils/json_extract.py::loads_lenient`——先剥 ```fence```（正则 `_FENCE_RE`）再 `json.loads`；仍失败则兜底截取首个平衡 `{...}`/`[...]` 子串；彻底失败返回 default。三处解析器（evaluator/plan_reviewer/memory_extractor）统一复用。
- **后续防范**：① 消费 LLM「JSON 输出」一律经容错解析，不可假定模型严格裸 JSON（即便声明 `response_format`，部分模型/代理仍围栏）；② 新增任何 LLM-JSON 消费点必须走 `loads_lenient`；③ 切换模型档位（弱→强）须回归所有结构化输出解析路径。
- **同类问题影响**：所有以 LLM 结构化 JSON 输出驱动的 Routine 子系统（Judge 评分 / Plan 审阅 / 记忆提取）；尤在启用强模型覆盖（ISSUE-121 evaluator_model / ISSUE-125 plan_review_model）时必触发。
- **验证**：单测 `test_json_extract.py` 8 例（围栏/裸/散文夹带/数组/垃圾兜底）；端到端 `PlanReviewer(explicit_model="anthropic/claude-sonnet-4-6").review(...)` → `ok=True verdict=approve score=92`（修复前 3 重试全败）。routine 单测 149 + build_config/evaluate 集成 14 全绿。

---

## ISSUE-118 Documents 页图片把自动文件名当 figcaption 显示 + 全局技能「卡片可见 ≠ Agent 可用」

- **表因**：Knowledge/Documents 页渲染 perceives 抽取的 PDF 时，无图注的图片（如论文 logo `fig_p1_1.png`）下方显示出无语义的 "fig_p1_1.png" 文本；另：把技能标记 `is_system` 仅令其在 Skills 卡片对全员可见，却未注入任何 Agent 的 Progressive Disclosure。
- **根因**：
  1. **渲染层**：`DocumentMarkdownRenderer.tsx::DocumentImage` 对 `alt` 真值即渲染 `<figcaption>`；而 perceives 对无图注图片输出占位 `alt=<文件名>`，致文件名被当图注。
  2. **机制层**：`skills_injector.resolve_skills` 仅注入 `Agent.skills` 数组中显式列出的技能；6 个内置 Agent 经 `agent_presets._build_payload` 硬编码 `skills=[]` 且会被 "Sync Negentropy" 覆盖——故 `is_system`（可见性）与「被 Agent 调用」是两套正交语义。
- **处理方式**：
  1. 渲染层新增 `isMeaningfulCaption`：以「是否含空格」为关键判别——纯文件名 / 自动命名（`fig_p1_1` / `figure-2` / `image_4`）等无空格 token 不渲染图注，含空格的真实图注（`Figure 1: ...`）照常保留（含空格判别避免误伤 "Figure 1" 这类以图号开头的真实图注）。
  2. 机制层新增正交字段 `Skill.is_global`（迁移 0063）+ `skills_injector.resolve_global_skills`（强制 `warning` 注入，永不阻塞 Agent 启动）+ 在 `model_resolver._load_subagent_row`（DB 路径，合并去重）与 `_dynamic_instruction`（fallback 路径，互斥追加）双路径并入；技能 `pdf-fidelity-restore` 以 `is_system+is_global+PUBLIC` 种子（迁移 0064）+ 模板 YAML + `.agent/skills/SKILL.md` 三处同源物化。
- **后续防范**：
  1. **占位 alt 不得当图注**：凡「文件名兜底 alt」均须在渲染层与真实图注区分；判别用「含空格」比「前缀正则」稳健（前缀正则会误伤 `Figure 1: ...`）。
  2. **「可见」与「可用」分层**：技能/插件的 RBAC 可见性（`is_system`/`visibility`）与「被 Agent 实际调用」是两套正交开关，新增「全员可用」诉求须走注入热路径（`is_global`），而非仅改可见性。
  3. **全局注入恒 warning**：注入到全体 Agent 的技能若 `enforcement_mode=strict` 且缺 `required_tools`，会令缺工具 Agent 退化为无 system prompt；`resolve_global_skills` 强制 `warning` 守住此安全不变量。
- **同类问题影响**：所有走 `DocumentMarkdownRenderer` 的文档渲染（图注抑制对全体文档生效）；所有经 `_load_subagent_row`/`_dynamic_instruction` 装配指令的 Agent（一核五翼 + 未来新增，均自动获得全局技能）。
- **附带发现（perceives auto_batch 图注归属差异）**：对 28 页（< 60 页阈值）PDF 强制分批（threshold=10）实测：分批 + 跨片合并保全全部内容（7 图 / 2 表 / 公式 / 全文，图片 src 零重复，dedup 正常），但 Figure 1 / Figure 4 的图注在分批路径落为**正文文本**而非 `img alt`（docling 单切片 vs 全本的图注归属差异）。结论：内容无丢失，仅图注「位置」差异；28 页默认走单次路径（图注归属更整齐）为正确选择，分批保留给真正大文档（> 60 页）以可靠性优先。
- **验证**：前端 `DocumentMarkdownRenderer.test.tsx` 新增 2 用例（文件名抑制 / 图注保留），7/7 通过；后端 `test_skills_injector.py` 新增全局注入 + 安全不变量用例，34 passed；迁移 0063/0064 实测 `alembic upgrade head` 成功，`resolve_subagent_instruction` 对一核五翼 6 个 Agent 均注入 `pdf-fidelity-restore`（缺工具仅 warning，不阻断）。

---

## ISSUE-119 `backend-unit` CI 作业缺 Postgres 服务——全量单测连库失败（潜伏红，2026-06-07）

- **表因**：`backend-quality / Backend Unit Tests` 作业 2225 个单测全部 `OSError: Connect call failed ('127.0.0.1', 5432)`，作业失败；其 `needs` 的 integration/performance 作业因而连带不执行。多分支（含 `feature/1.x.x` 基线本身）CI 长期常红。
- **根因**：ISSUE-111 在 `tests/conftest.py` 引入会话级 autouse fixture `_isolate_test_database`（数据安全防护），会话开始即**无条件** `CREATE DATABASE <db>_test`（asyncpg 连维护库）+ `alembic upgrade head`，强依赖可达 Postgres。但 `reusable-negentropy-backend-quality.yml` 的 `backend-unit` 作业**无 `services.postgres` 容器**（仅 integration/performance 有），workflow 级 `env.NE_DB_URL` 又指向 `localhost:5432`——单测一启动即在 setup 阶段连库失败。该 workflow 最后一次结构性改动（PR #594）早于 ISSUE-111（PR #877）落地 fixture，故 service 从未为 `backend-unit` 补上；又因 backend-tests 仅在 `apps/negentropy/**` 变更时触发，期间多为 UI-only 改动，缺陷潜伏至首个触及后端的 PR 才显形。
- **处理方式**：为 `backend-unit` 作业补齐与 integration/performance **完全一致**的 `pgvector/pgvector:pg16` 服务块（`CREATE EXTENSION vector` 依赖该镜像，非 vanilla postgres）。fixture 自建并迁移 `test_db_test`，`alembic env.py` 在迁移前自动 `CREATE SCHEMA negentropy` + `CREATE EXTENSION vector`，故**无需**额外 `init_test_db` 步骤（与 integration 路径的差异：integration 跑预置库故显式 init，unit 由 fixture 动态建库）。
- **后续防范**：
  1. **「测试夹具的隐性外部依赖」必须在所有消费该夹具的 CI 作业同步满足**——session/autouse 且无条件副作用（建库 / 迁移 / 连网）的 fixture，等价于对**全部**收集到的测试施加前置依赖；新增此类 fixture 时须同步审计每个运行该测试目录的 CI 作业是否具备其依赖（此处 unit 作业被遗漏）。
  2. **路径过滤触发的 workflow 易掩盖潜伏缺陷**——`paths: apps/negentropy/**` 令后端 CI 仅在后端变更时跑，UI-only 期间的红 = 不可见；评审引入「无条件外部依赖」的测试基建时，应主动手动触发一次目标 workflow 验证，而非等下一个偶然触及该路径的 PR。
  3. **同族作业的服务声明应保持一致或显式注释差异**——同一 reusable workflow 内 unit/integration/performance 三作业若对 DB 依赖一致，其 `services` 块应同构；本次以注释说明「unit 由 fixture 动态建库、无需 init 步骤」的正交差异，避免后人误删。
- **同类问题影响**：所有经 `tests/conftest.py` 会话夹具运行的后端测试作业（本次 unit 已补齐；integration/performance 早已具备 service）；`cognizes` 等其它 app 若引入同形 autouse 建库夹具，须同步核验其 `backend-unit` 服务块。
- **验证**：本地以可达 pgvector（pg16/vector 0.8.x）复现 CI——原报错的 `test_permissions.py`/`test_scheduler_api.py` **27 passed**、本 PR 新增 `test_skills_injector.py` **34 passed**；fixture 仅触碰派生的 `*_test` 库，生产 `negentropy` 库只读零改动（66 表完好，恪守 ISSUE-111 安全不变量）；`pyyaml` 解析校验三作业 `services.postgres` 均为 `pgvector/pgvector:pg16` + `5432:5432`。

## ISSUE-128 approve 后 CC 循环调用 ExitPlanMode 空耗 turns（2026-06-07）

- **表因**：ISSUE-127 修复后强 sonnet 实审通过（探针 `6a43ed9e` seq12 评分 92 实审），但 CC 随后**循环调用 ExitPlanMode 3×**（seq14/23/30），每次 tool_result `is_error=true`，CC 误判失败而重试，空耗 turns（虽最终仍 break 出去写了 6 个文件）。
- **根因**：headless ExitPlanMode 恒被 CLI 标 `is_error`（ISSUE-126 已证 allow 不能消除）；而 prompt/approve-reason 此前指示「批准后调用 ExitPlanMode 进入实施」，CC 见 is_error 即循环重试。但 **PLAN→IMPLEMENT 推进纯由引擎 `_advance_phase_or_terminate` 在下一次评估驱动、根本不依赖 CC 退出 Plan 模式**——ExitPlanMode 在此语境下是无意义的交互残留。
- **处理方式**：approve-reason、`_EXIT_APPROVED_REASON`、PLAN prompt 三处统一改为「批准后**直接结束本轮回复**，不要调用 ExitPlanMode 或任何工具，引擎将自动推进实施阶段」。消除循环与 is_error 噪声。
- **后续防范**：无头自治闭环中，凡「依赖人机交互确认才推进」的工具（ExitPlanMode）若其状态推进实为引擎驱动，应明确指示 Agent 跳过该工具、结束本轮，而非让其与 CLI 的 is_error 反复缠斗。
- **同类问题影响**：所有 PLAN 相位经钩子审阅的 routine。
- **验证**：单测 `test_run_approve_tells_end_turn` + `test_exit_plan_approved_reason_content`（结束本轮、不调工具、引擎推进）；hook 单测 10 例全绿。实机复验见复刻长跑。

## ISSUE-129 强模型 Plan Review 在大型方案上超时（plan_review_timeout=60 过小 + 钩子重试预算错配）（2026-06-07）

- **表因**：复刻长跑 `b378039d` seq1（重型任务，CC 探索 19 turns/666 事件后提交大型方案）的 Plan Review 失败——CC 收到 `"Answer questions?"`（ISSUE-123 老症状复现），评审反馈未送达。但评估侧 sonnet Judge 同轮**成功**（score=18/stalled/acceptance_met=false，反思详实）。
- **根因**（钩子日志实证 `litellm.Timeout ... Timeout passed=60.0, time taken=60.002`）：① `plan_review_timeout_seconds=60`（为弱模型 nano 调的默认）对强模型 sonnet 审阅**大型方案**过小，单次 LLM 调用即超 60s；② 钩子内 PlanReviewer `max_retries=3`，最坏 3×60=180s，而 orchestrator 给钩子的 `hook_timeout=plan_review_timeout+30=90s` **覆盖不了重试总耗时** → Claude Code PreToolUse 超时杀钩子 → CC 落回 `"Answer questions?"`。两处叠加：超时过小 + 重试预算错配。
- **处理方式**：① `plan_review_timeout_seconds` 默认 60→**120**（强模型大方案足够，实测大方案审阅 24.8s）；② 新增 per-routine `config.plan_review_timeout_seconds` 覆盖（写入 ctx）；③ 钩子内 PlanReviewer **`max_retries=1`**——钩子受 PreToolUse 硬超时约束，真正「重试」是 CC 据 refine 反馈重新提交（外层闭环），钩子内多次重试只会撑爆超时预算；④ `hook_timeout = review_timeout + 45`（单次尝试 + 冷启动余量，不再 ×retries）。
- **后续防范**：① 为弱模型调的超时/重试默认，切强模型时必须复核（强模型更慢、输出更长）；② 受外层硬超时约束的子调用（钩子/gate）其内部重试次数 × 单次超时必须 ≤ 外层预算，否则永远在耗尽重试前被杀；③ 「重试边界」应设在正确的层级——评审的重试是 CC 重新提交，而非钩子内空转。
- **同类问题影响**：所有用强模型 plan_review 且方案较大的 routine（即 ISSUE-125 的目标重型复刻场景）。eval Judge 因用独立的 `evaluate_judge_timeout_seconds`（更大）未受影响。
- **验证**：端到端 sonnet 审阅大型方案 `elapsed=24.8s ok=True`（修复前 60s 超时 ×3 全败）；hook 单测 10 + build_config 集成 7 全绿。当前长跑已进 IMPLEMENT（评审失败非致命、引擎照常推进，ISSUE-128/相位机驱动），修复对后续 PLAN 迭代与新 routine 生效。
## ISSUE-130 `plan_review_hook` 模块级全局副作用（stdout 重定向 + 日志改道）经 import 泄漏，污染全套单测（CI backend-unit 3 例红）（2026-06-07）

- **表因**：CI `backend-quality / Backend Unit Tests` 报 3 例失败，全在 `tests/unit_tests/agents/test_skills_injector.py`（`test_resolve_skills_logs_permission_filter_at_warning` 等），断言一律 `AssertionError: assert 'skills_injector_permission_filtered' in ''`——即 `capsys` 捕获的 stdout/stderr 为空。本地复现：3 例单独运行**全绿**，与 `test_routine_plan_review_hook.py` **同批收集即全红**。
- **根因**（二阶涟漪，ISSUE-123 引入的 `plan_review_hook.py` 的副作用）：该钩子为「脚本路径执行」设计，在**模块顶层**（import 即执行）做了三件进程级全局副作用：① `os.dup2(2, 1)` 把进程 stdout(fd1) 重定向到 stderr；② `sys.stdout = sys.stderr`；③ `configure_logging(level="WARNING", sinks="file")` 把全局 structlog 改道到 `/tmp/negentropy-plan-review-hook.log`。而 `test_routine_plan_review_hook.py:9` 以 `from ... import plan_review_hook` **顶层 import**——pytest **收集阶段**即触发上述副作用，全局 structlog 自此只写文件。`skills_injector` 经 `negentropy.logging.get_logger().warning(...)` 打的日志遂全部进文件、`capsys`（stdout/stderr）一无所获 → 断言空串失败。clean session 下 structlog 未被 `configure_logging` 接管、停在内置默认（`PrintLogger` 调用时惰性解析 `sys.stdout` = capsys 缓冲），故单独跑全绿；upstream 无此钩子故历史全绿——确系本分支回归。次生：`orchestrator._plan_review_hook_command` 仅为取 `__file__` 而 `from . import plan_review_hook`，同样会在**引擎进程内**触发该副作用（潜伏生产隐患——长驻引擎 stdout 被永久重定向）。
- **处理方式**（最小干预，根因杠杆）：把模块顶层的 ①②③ 副作用收敛进 `_bootstrap_stdout_purity()` 函数，仅在 `if __name__ == "__main__":` 入口（即生产以**脚本路径** `python <hook_path> <ctx>` 执行时，`orchestrator.py` 实证）调用；import 时**绝不执行**。`_emit` 改用 `_REAL_STDOUT_FD`（默认 `None`）兜底到 fd 1。脚本执行路径行为零变化（bootstrap 顺序不变：先 fd/对象级重定向，再 import `configure_logging`，赶在引擎 import 噪声前生效）；in-process import（单测收集 / orchestrator 取 `__file__`）不再有副作用。
- **后续防范**：① 任何「脚本入口专用」的进程级全局副作用（fd 重定向、`sys.stdout` 替换、全局日志重配、信号处理器等）**必须**置于 `if __name__ == "__main__":` 或显式 bootstrap 函数内，**严禁**写在模块顶层——否则任何 import（含 pytest 收集、仅取 `__file__`）都会泄漏到宿主进程；② 依赖 `capsys` 捕获 structlog 的单测本身脆弱（隐含「全局 structlog 未被接管」前提），后续可迁移到 `structlog.testing.capture_logs()` 彻底解耦全局配置，但本轮按最小干预先断源头。
- **同类问题影响**：任何在进程内 import `plan_review_hook` 的路径（pytest 收集、orchestrator）此前都被静默重定向 stdout + 改道日志；修复后一并消除。排查同类：`rg -n "^(os\.dup2|sys\.stdout =|configure_logging\()" src` 审计模块顶层全局副作用。
- **验证**：复现批（hook 测 + skills_injector 3 例）修复前 3 红 → 修复后 **8 全绿**；`agents/` + `engine/` 全量单测同批收集 **1066 passed**；脚本路径 smoke（`echo '{"tool_name":"ExitPlanMode"}' | python plan_review_hook.py`）输出**纯 JSON**（`permissionDecision=deny`，无日志噪声），证 bootstrap 在 `__main__` 仍正确生效；`ruff check`/`format` 全过。

## ISSUE-131 Plan Review 8000 字符静默截断致大型方案 refine 闭环结构性死循环（Plan 提交未漏斗到 AskUserQuestion）（2026-06-07）

- **表因**：重型复刻 routine（`0b9cec1f`，Go→Python 一比一迁移）的单 Iteration（`ee448c74`）在 PLAN 段陷入 **14+ 轮 refine 死循环**（ExitPlanMode ×13、AskUserQuestion ×3、累计 1453 事件仍未进 IMPLEMENT）；CC 在 Turn 50 留言「审阅引擎持续无法读取完整方案文件（Phase 7-9 在文件中存在但被截断）。让我通过 AskUserQuestion 直接提交方案全文。」后继续空耗。
- **根因**（live DB + 代码逐行实证）：`plan_reviewer.py` `_PLAN_MAX_CHARS = 8000` 在拼装 judge prompt 前把方案**静默截断到 8000 字符且不附标记**。CC 提交的方案 10K~16K 字符（Phase 0-9），judge 只看到前 ~8000 字符（切在 Phase 3~6），于是**审阅反馈本身反复写**「方案被截断 / Phase 7-9 完全缺失」（seq 548/1023/1111/1320/1347/1368…）。CC 不断补内容重提，但截断点恒定在 8000 → **循环结构性无法收敛**。CC 误判为「ExitPlanMode/文件读取截断」，转用 AskUserQuestion 仍走同一 8000 链路；且 **unified PLAN prompt 未要求 `options`** → AskUserQuestion 报 `InputValidationError: questions[0].options is missing`（seq 1115/1372）二次空转。`max_refines=5` 封顶本应在第 5 轮放行，但 live 引擎（主仓旧 checkout）早于封顶代码、sidecar 目录不存在 → 计数恒 0 → 永不触发（当前分支封顶逻辑已逐行核验无 bug，部署即生效）。
- **处理方式**（最小干预，根因杠杆）：① 截断上限 `_PLAN_MAX_CHARS=8000` → `_DEFAULT_PLAN_MAX_CHARS=200_000` 且**可配置**——新增 `settings.routine.plan_review_max_plan_chars`（默认 200000，镜像 ISSUE-129/125 的 settings→ctx→hook→reviewer 线缆 + per-routine 覆盖）；② **截断感知**——真超限时在方案尾部附 `_TRUNCATION_NOTICE` 显式告知 judge「勿据未见尾部判定缺失」，从机制根除复发；③ **提交路径漏斗到 AskUserQuestion**——unified PLAN prompt 改为只引导 AskUserQuestion（`question` 写全文 + **必带 `options`**=[批准方案/需要完善]，显式「不要调用 ExitPlanMode」），消除 `options` 缺失报错；ExitPlanMode 仍由钩子真实评审作**安全网**（CC 反射误调也不绕过评审），零绕过、无需重定向状态机。
- **后续防范**：① 任何「交给 LLM 的长文本」截断上限必须按目标模型上下文设定（现代 judge 200K tokens，8000 字符是过时弱模型遗产），且**截断必须留显式标记**——静默截断会让下游（judge/CC）对「看不到的内容」做出错误归因，制造结构性死循环；② 「评审反馈要求补全 X、而 CC 确认 X 已在方案中」这类**自相矛盾的 refine 信号**是「输入被截断」的强特征，排查应直查 reviewer 侧字符上限而非 CC 侧；③ 无头闭环中工具入参约束（如 AskUserQuestion 必带 `options`）必须在 prompt 显式声明，否则 CLITool 校验报错空耗 turns。
- **同类问题影响**：所有提交大型方案的 worktree routine（重型复刻场景）。排查同类静默截断：`rg -n "\[:[A-Z_]*MAX[A-Z_]*\]|\[:\d{3,}\]" src` 审计交 LLM 前的硬截断。
- **验证**：新增 `test_routine_plan_reviewer.py`（长方案不截断/超限附标记/空方案占位/默认上限 ≥100K）+ hook 透传 `max_plan_chars`（per-routine 覆盖/全局回退/默认兜底）+ phase prompt 漏斗（含 `options`/「不要调用 ExitPlanMode」）；`engine` 全量单测 **924 passed**、`ruff check`/`format` 全过。注：live 卡死 iteration `ee448c74` 不被本代码改动追溯修复（引擎需部署），本修复**防复发**。

## ISSUE-132 Routine 重启每次铸新工作分支，破坏「终生单一工作分支」不变量（2026-06-08）

- **表因**：一个 Routine 任务每经一次 `/restart` 就在仓库新建一个工作分支（`routine/<slug>-<时间戳1>`、`-<时间戳2>`…），同一逻辑任务散落多个分支与潜在多个 PR，违背「无论重启几次都只有一个基于 Baseline 的工作分支、最终单一 PR 回基线」的诉求。
- **根因**（逐行实证）：① `routine_api.py:restart_routine` 复位运行态时**清空 `r.work_branch = None`** 并 `remove_worktree`（注释「从基线重建」），全仓库仅此一处清空该终生句柄；② `workspace.ensure_worktree` 的创建段**永远**按 `routine/<slug>-<时间戳>` 铸新名（`datetime.now()` 后缀），从不复用已存在的 `routine.work_branch`——故崩溃致 worktree 目录丢失（reuse 校验失败落入创建段）时亦会再造新分支。两者叠加：`work_branch` 本应是 `id` 级终生句柄（其余清理点 delete/manual/reaper 均只置空 `worktree_path` 而保 `work_branch`），却被 restart 与时间戳命名双重破坏。
- **处理方式**（机制/策略分离，确定性单一身份）：
  1. **确定性命名**：新增 `_stable_work_branch(routine)=routine/<sanitize(key)>-<id.hex[:8]>`（由不可变 `id` 派生，可复算、自愈）；`ensure_worktree` 创建段改 `work_branch = routine.work_branch or _stable_work_branch(...)`、`worktree_path = routine.worktree_path or <root>/<slug>-<id8>`（复用持久化路径，勿对存量 legacy 活动目录另算新路径而误删）。
  2. **分支存在感知三级阶梯**（始终绑定同一 `work_branch`）：本地分支存在→`worktree add <path> <b>`（直接 checkout，含检查点提交，重启续作）；否则 `origin/<b>` 存在→`worktree add -b <b> <path> origin/<b>`（清理删本地分支后从远端恢复）；否则→`worktree add -b <b> <path> <baseline>`（首次/无可恢复提交）。
  3. **重绑健壮性**：add 前 `prune` → `_purge_sibling_worktrees`（强制移除占用本分支但路径不符的兄弟注册）→ 再 `prune` → 清残目录（防 `already used by worktree`/`already exists` 硬失败，经真实 git 实验确证）。
  4. **`remove_worktree(keep_branch=False)`**：新增开关，True 时仅回收 worktree 目录、保留本地分支与提交。`restart` 改 `keep_branch=True` 且**删去 `work_branch=None`**（从上一检查点续作、不铸新分支）；reaper 对 failed/cancelled 传 `keep_branch=True`（保进度待重启），succeeded 仍删本地分支（PR 已在 origin）。
  5. **FINALIZE PR 复用确定化**：worktree FINALIZE prompt 改「先 `gh pr view <head> --json url -q .url` 查、空才 `gh pr create`」，消除重启后 head 已有 PR 时 `gh pr create` 报错致 `PR_URL=` 丢失的回归（与单一分支配套）。
- **后续防范**：① 「终生唯一资源句柄」（此处 `work_branch`）应由不可变身份（`id`）派生确定性名、首次铸定后**绝不在任何重置路径清空**；带时间戳/随机后缀的命名天然与「单一」诉求冲突；② 复用既有外部资源（git 分支/worktree）的「重建」必须做**存在感知**与**残留清扫**（prune/force-remove/清目录），不能假设目标干净——`git worktree add -b` 在分支/目录已存在时硬失败；③ 跨进程/跨重启的幂等性，须区分「持久身份」（保留）与「运行期句柄」（可重建），restart 只重置后者。
- **同类问题影响**：所有 worktree routine（`baseline_branch` 非空）的重启/崩溃恢复路径。存量已持久化的时间戳 `work_branch` 经 `work_branch or ...` 短路原样保留、不迁移、无需 DB 变更，向后兼容。
- **验证**：`test_routine_workspace.py` 新增 11 例锁定不变量（确定性命名/目录删除后重绑同名/检查点续作/origin 恢复/基线回落/清残目录/legacy 兼容/keep_branch 保分支 vs 默认删分支/**跨重启仓库始终只有一个 `routine/*` 分支**）+ `test_routine_phase.py` 新增 FINALIZE「先 view 后 create」断言；`test_routine_workspace.py`+`test_routine_phase.py` **51 passed**、`test_routine_api.py`+`test_routine_orchestrator.py` 集成 **48 passed**、`ruff check`/`format` 全过。注：live 引擎运行旧 checkout，本修复需部署后对运行中任务生效。

## ISSUE-133 大型 PDF「Ingest from File」因 MCP 同步阻塞调用双重超时而失败（2026-06-08）

- **表因**：Pipeline Run `ingest_file-General_-_浪潮之巅_2019_第四版-a539`（13.5MB / 约 500 页书籍）在 `extract_primary` 阶段失败，错误 `Connection timeout after 300.0s`（tool=`parse_pdf_to_markdown`、adapter=`single_string_source_v1`、source_kind=local_path），耗时 303,927ms；failover 段 `parse_pdfs_to_markdown` 亦被卷入而悬挂。
- **根因**（live DB pipeline payload + 代码逐层实证）：MCP 工具调用是**同步阻塞**模型——backend `session.call_tool()` 直接 await 等待 perceives 返回完整结果，无异步/Task ID/心跳轮询，故必须设超时防连接永悬。两处独立超时叠加致大 PDF 必败：① backend `_DEFAULT_EXTRACTION_TIMEOUT_MS[file_pdf]=300_000`（5 分钟）；② perceives `auto_batch` 在**单次 MCP 调用内**串行处理所有分批（默认 40 页/批，每批 100-200s），500 页≈25 批共 2500-5000s，无论 backend 超时设多大，单次调用都无法覆盖。且 backend 从未将自身超时预算传递给 perceives（perceives 工具声明了顶层 `timeout` 参数却收不到）。
- **处理方式**（保持 perceives auto_batch 架构，参数化控制 + 双层超时 + 断点续传）：
  1. **backend 超时 300s→3600s（1 小时）**（`extraction.py` `_DEFAULT_EXTRACTION_TIMEOUT_MS[file_pdf]`），覆盖大书全程串行分批。
  2. **超时预算注入**：新增 `_maybe_inject_tool_timeout`，当 MCP 工具 schema 声明顶层 `timeout` 属性且 arguments 未含时，注入 `target.timeout_ms//1000`——让 perceives 与 backend 共享同一时间预算（尊重 LLM 规划/用户 tool_options 已设的值，不覆盖）。
  3. **perceives 分批粒度细化 40→20 页/批**（`ops/pdf.py` `DEFAULT_BATCH_PAGE_SIZE`、`tools/pdf.py` 签名默认值），每批 100-200s→50-100s，降低单批超时风险、提升 checkpoint 恢复效率。
  4. **逐批 5 分钟超时**：新增 `DEFAULT_PER_SLICE_TIMEOUT_SECONDS=300`，`_run_batched_pipeline` 用 `asyncio.timeout` 包裹每切片；超时切片标记 partial failure 并继续后续切片（不拖垮整批），仅写 failure marker（不写 markdown checkpoint）。
  5. **断点续传**（复用 perceives 既有机制，无需新开发）：成功切片立即落盘 `slice_{i}.json`+`slice_{i}.markdown.txt`（checkpoint 基于 PDF **内容 SHA-1** 而非文件路径，跨 MCP 调用稳定）；`resume=True`（默认）时 `_load_slice_checkpoint` 见超时切片无 markdown→返回 None 重处理，仅重跑未完成切片。
  6. **工具描述校准**：`tools/pdf.py`+`tools/markdown.py` 的 `timeout` 描述「默认 300s」→「默认 900s」（与 `config.default.yaml` `task_timeout_seconds=900` 对齐，原描述与实际配置不符）。
- **后续防范**：① 同步阻塞的远程调用（MCP）必有超时，调用方与被调方的超时预算应**显式传递并对齐**，避免「双方各自独立超时、谁先到谁杀连接」；② 长耗时串行任务（分批处理）应有**逐项超时 + 失败隔离 + 断点续传**三件套，单项失败不应级联致整体失败；③ 跨调用的进度持久化键应基于**内容指纹**（SHA-1）而非临时路径——backend 每次调用写新临时文件，按路径派生 checkpoint 会永远 miss；④ 对外工具的参数默认值/描述必须与底层配置（YAML）**单一事实源**对齐，避免文档漂移误导调用方。
- **同类问题影响**：所有大型 PDF（>60 页触发 auto_batch）的 ingest_file / ingest_url 提取路径。小 PDF（≤60 页）走原单次路径零影响；URL/通用文件用各自独立默认超时不受波及。
- **验证**：perceives `test_pdf_auto_batch.py` **15 passed**（新增逐批超时切片标记 partial+续传断言、常量改为动态比对工具签名消除魔数脆性）；backend `_maybe_inject_tool_timeout` 4 守卫条件经直接导入验证全过 + 新增 4 例契约单测（注：backend 单测库 alembic 残留版本不一致致 fixture ERROR，为预先存在环境问题，已 stash 对比基线确认与本改动无关）；两仓 `ruff check`/`format` 全过。注：live 引擎运行旧 checkout，本修复需部署后对运行中任务生效；失败的 `a539` run 可经 UI「Resume from checkpoint」或重新触发 ingest（同内容 PDF 命中 checkpoint）续作。

### follow-up: 依旧 300s 超时——配置 SSOT 与 DB 持久化副本 Split-Brain 闭环（2026-06-08）

- **深层根因**（上一轮「处理方式」第 1 点「backend 超时 300s→3600s」的盲区）：上一轮修改的是 `_DEFAULT_EXTRACTION_TIMEOUT_MS[file_pdf]=3_600_000`，但该值**仅在 `if not target.timeout_ms:` 时生效**（`extraction.py:2074`）。标准路径下 `target.timeout_ms` 始终从 corpus 持久化 JSONB 读回 `300_000`（建库时由 `_shared.py:503` 从 YAML/config 默认值固化），条件永假 → 兜底永不触发 = **死代码**。真正的 300s 取值链：`config.default.yaml` 锚点 `timeout_long_ms: 300000` → `KnowledgeSettings.default_extractor_routes.file_pdf.primary.timeout_ms=300000` → 建库时固化进 `corpus.config.extractor_routes.file_pdf.targets[].timeout_ms` → 抽取时实时读回 → 后端 MCP（`extraction.py:2390` `target.timeout_ms/1000.0=300.0`）与 perceives（`extraction.py:2269` 注入 `timeout=300`）双层超时均落在 300s。**一句话：超时值的「定义源(YAML/config)」与「持久化副本(corpus JSONB)」存在 Split-Brain；上一轮只改了永不命中的代码兜底，既未改 YAML 定义源，也未纠正已固化进 DB 的存量副本。**
- **处理方式**（SSOT 对齐 + 数据迁移，最小干预）：
  1. **Part A — 配置 SSOT（修新建库）**：`config.default.yaml` 锚点 `timeout_long_ms` 300000→3600000（1h）/ `timeout_xlong_ms` 600000→7200000（2h）；`config/knowledge.py` Python 默认值同步对齐。仅 file_pdf 路由使用这两个锚点，url 用 short/medium 零外溢。
  2. **Part B — Alembic 迁移 0066（修存量库）**：幂等 SQL UPDATE 重写 `negentropy.corpus.config` JSONB 内 `file_pdf.targets[]` 中**精确等于旧默认值**的 `timeout_ms`（300000→3600000、600000→7200000）。`CASE ... ELSE t` 保留用户显式自定义值（如 `Harness Engineering` 的 `1200000` 不被触碰）、无 `timeout_ms` 元素、`url` 路由一律不动。`WITH ORDINALITY` + `ORDER BY ord` 保序；downgrade 逆向同形。后端超时数据驱动（`extraction.py:2390` 每次运行实时读），迁移落库后存量库重试即取新预算，**无需引擎改码**。
- **后续防范（补充 ISSUE-133 原有 4 点）**：⑤「代码兜底」不等同于「运行期默认值」——当默认值在**另一层**（配置→DB 固化）被消费方缓存后，代码层 fallback 即成死代码。变更必须追溯到**真正的取值源**（YAML/config → 建库逻辑 → DB 固化 → 运行期读取），逐层验证每一层是否已同步更新；⑥ 跨层数据（config→DB JSONB）存在「建时快照」语义——建库固化后，config 源头变更不自动反映到存量库。对此类数据需在**设计阶段**即考虑「配置漂移修正路径」（数据迁移或运行期 floor），而非仅靠修改默认值。
- **验证**：单元 `test_file_pdf_extractor_timeout_defaults`（file_pdf 默认 3600000/7200000 断言）+ 集成 `test_corpus_pdf_extractor_timeout_bump_0066`（升级正确性 + 自定义保留 + 无键不注入 + 幂等 + downgrade）全过。对共享 live 库 `alembic upgrade head` 落迁移，DB 直查确认 `Sinestesia of Cognition`（失败 corpus）300000→3600000 / `Harness Engineering` 自定义 1200000 不受影响。重试《浪潮之巅》失败 run（`resume=true`），新 run 跑至 **323s（>300s）** 不再触发 `Connection timeout after 300.0s`——超时上限彻底解除。

### follow-up 2: 二级问题——PDF 解析产物夹带 NUL 字符致 PostgreSQL 写库失败（2026-06-08）

- **表因**（超时解除后暴露的下一层失败）：300s 上限解除后《浪潮之巅》重试 run 跑满 323s、perceives 返回 `success:true`（PDF 解析成功），却在后端持久化阶段失败：`UPDATE negentropy.mcp_tool_runs SET result_payload=$::jsonb` 抛 `asyncpg.exceptions.UntranslatableCharacterError:   cannot be converted to text`，run 标记 failed（duration 323087ms）。
- **根因**：某些 PDF 解析产物（图层/字体异常）会夹带 NUL 字节（`\x00`），而 PostgreSQL 的 `jsonb` 与 `text` 类型**均无法存储 NUL**——asyncpg 序列化时即抛 `UntranslatableCharacterError`。该 PDF 内容流经**三个写库边界**且均无净化：① `interface/execution.py` MCP tool run 的 `result_payload`(JSONB)+`error_summary`(Text)（**实际失败点**）；② `storage/service.py::save_markdown_content` 的 `markdown_content`(Text)；③ `knowledge/service.py::_ingest_text_with_tracker` 的 chunk content → `Knowledge.content`(Text)。仅修第①处只会把失败下推到 ②③。代码库原 `_json_safe`（`json.dumps/loads`）不剥离 NUL（` ` 是合法 JSON 转义，仅 PG 拒绝）。
- **处理方式**（单一共享净化器 + 三处咽喉点，正交 + 最小干预）：
  1. **共享 helper** `negentropy/serialization.py::strip_nul_chars(value)`：递归剥离 str/dict/list/tuple/set 中的 `\x00`，非字符串标量原样返回（无 NUL 时返回同一对象避免拷贝），仅去 NUL 不改其他结构/JSON 语义。置于 `serialization.py`（已被 `extraction.py`/`agent_presets.py` 引用的序列化 SSOT）。
  2. **三处写库边界应用**：`execution.py` 的 `result_payload`+`error_summary`；`storage/service.py::save_markdown_content`（覆盖全部 save 调用方）；`_ingest_text_with_tracker` 入口 `text`（全摄入路径 file/url/refresh/rebuild 的 chunk 持久化单一咽喉）。
- **后续防范**：⑦ 远程工具（尤其文档/PDF/OCR 解析类）的产物可能含**控制字符/NUL**，凡落 PostgreSQL `text`/`jsonb` 的边界都应在**写库前**净化；净化器应放在被多方复用的 SSOT 层，并在**每个独立写库咽喉**都应用（仅修首个失败点会把同类失败下推到下游列）；⑧ `json.dumps/loads` 的「JSON 合法」不等于「PG 可存」——` ` 是合法 JSON 转义却为 PG text/jsonb 所拒，依赖 JSON 往返做净化是错觉。
- **同类问题影响**：所有经 perceives 解析并落库的内容（PDF/网页 → mcp_tool_runs.result_payload、knowledge_documents.markdown_content、knowledge.content）。无 NUL 的内容零行为变化（返回同一对象）。
- **验证**：`test_serialization.py` 新增 2 例（递归净化嵌套 str/dict/list/tuple/set + 标量/无 NUL 不变且返回同一对象）；对真实 PostgreSQL（test 库临时表）验证「原始 NUL 写 jsonb 必抛 `UntranslatableCharacterError` / `strip_nul_chars` 净化后写 jsonb+text 均成功」；`ruff check`/`format` + 既有 extraction-contract 16 例回归全过。注：本项为**代码改动**（区别于 follow-up 1 数据驱动的超时迁移），需部署 live 引擎后对运行中任务生效。

## ISSUE-134 PDF 重试入口缺失且语义重叠：「断点续传」隐藏 + 「重新开始」能力缺失（2026-06-08）

- **表因**（ISSUE-133 暴露的 UX/语义缺陷，用户实证）：① 失败 PDF run 的「Resume from checkpoint」入口几乎不可见——藏在 Pipeline Run 详情面板（需先展开），叫「Continue →」的**跳转链接**（跳文档页再手动 refresh），非真按钮；② **语义重叠且缺「重新开始」**：`resume` 永远默认 `True` 且 backend 从不控制，导致"重新触发 ingest"也命中同内容 SHA-1 checkpoint **续传**——与续传入口语义重复，反而没有"完全重新开始"的能力。
- **根因**（代码逐层实证）：`extract_source`→`DataExtractorProvider.extract`→`_invoke_target` 整条链路**无 `resume` 参数**，perceives 永远用工具默认 `resume=True`；backend 仅能通过 corpus 级 `tool_options` 间接控制（非 per-request）。UI 侧「Continue」仅是 `<Link>` 跳转，不调任何 retry API，且 pipelines 路由**只有 cancel、无 retry 端点**。
- **处理方式**（端到端「双入口」打通，复用既有模式）：
  1. **新 retry 端点** `POST /pipelines/{run_id}/retry`（body `{app_name, resume}`）：`dao.get_pipeline_run` 加载原 run → 从 `input.document_id/corpus_id` 提取 → `DocumentStorageService` 重取 GCS 原文件（传 corpus_id/app_name 做归属校验）→ `create_pipeline` 创建**新 run**（`input.retried_from` 关联原 run，规避 PipelineTracker 终态 cancel 竞态）→ `execute_ingest_file_pipeline(resume=...)` 后台派发。404（run/文档不存在）、422（非文件 ingest）边界齐备。
  2. **`resume: bool|None` 透传 5 层**：`execute_ingest_file_pipeline`→`_extract_file_document`→`extract_source`→`provider.extract`→`_invoke_target`。单一 `bool|None` 自文档化（None=普通 ingest 不注入沿用默认；True/False=显式重试意图）。
  3. **`_maybe_inject_resume`**（镜像 `_maybe_inject_tool_timeout`）：仅当工具 schema 声明顶层 `resume` 属性且 arguments 未含时注入——perceives `resume` 是顶层参数。`resume=False` 时 perceives `_load_slice_checkpoint` 永不调用、所有切片重处理并覆盖、manifest 重写，等价全新重跑，无需显式删 checkpoint。
  4. **UI 卡片直显双按钮**：`PipelineRunCard` 失败摘要后渲染【断点续传】（amber 实心，resume=true）【重新开始】（描边，resume=false），镜像既有 `onCancel`/`cancelPipelineRun` 模式（`onResume`/`onRestart`/`retryPipelineRun` + `useConfirmDialog` 二次确认）。移除详情面板的「Continue →」跳转块。`extractDocumentRef`/`isRunResumable`/`canRetryRun` 迁移到 `pipeline-helpers.ts` 单一事实源，page 与 panel 共用。
- **后续防范**：① 「续传 vs 重来」是两种不同意图，必须各有显式入口——同一行为复用两个入口而缺另一意图是 UX 反模式；② 工具的"幂等续传/全量重跑"开关（如 perceives `resume`）应可从**调用方 per-request 控制**并端到端透传，而非仅靠被调方默认值或粗粒度 corpus 配置；③ 关键操作入口应**前置到主视图直显真按钮**（卡片），而非埋在详情面板的跳转链接——后者体验上等于不存在；④ 父/子组件双重判定同一可见性条件时，应以一方为**单一权威**（此处 `canRetry`），否则两者分歧会让一方判定形同虚设（code review 实捕：卡片旧 `isRetryableStatus` 门控会误隐藏 run 级非终态但含失败 stage 的可重试 run）。
- **同类问题影响**：所有 KB ingest_file run 的重试路径。KG run（无 document_id 重跑语义）不暴露重试入口；URL/text run 同样不暴露（无 document_id）；普通 ingest（resume=None）零行为变化。
- **验证**：backend `_maybe_inject_resume` 5 守卫条件 + 既有 `_maybe_inject_tool_timeout` 4 条经直接导入验证 **9 全过**（同 alembic fixture 环境问题，纯函数逻辑无碍）；retry 端点导入 + 路由注册 + `get_document` corpus 校验签名核验通过；前端 `tsc --noEmit` + `eslint --max-warnings=0`（含移除 helper 后无 unused-var）**全过**；`ruff check`/`format` 全过；code review 捕获的卡片/helper 判定分歧 bug 已修（卡片信任父组件 `canRetry` 单一权威）。注：live 引擎运行旧 checkout，需部署后生效。

---

## ISSUE-135 新建 Corpus 未消费全局默认 Embedding 模型（model_resolver 忽略 model_configs.is_default）（2026-06-08）

- **表因**（用户实证）：在 Interface/Model 模型卡片将 `openai/text-embedding-3-small` 设为全局默认（Default）Embedding 模型后，新建的、未显式指定 Embedding 模型的 Corpus 在文档构建（ingest）时仍使用硬编码 `gemini/text-embedding-004`，与用户设定不符。
- **根因**（逐层实证）：`build_embedding_fn(None)` 闭包**每次调用**都重解析 `resolve_embedding_config()`→`_resolve("embedding")`（非构造期锁定）；而 `_resolve` 回退链为「缓存→`_resolve_from_vendor_configs`→`_resolve_defaults`」，其中 `_resolve_from_vendor_configs` 直接取硬编码 `_DEFAULT_EMBEDDING_MODEL`，**从未查询 `model_configs.is_default`**——与该模块自身在解析链注释中声明的契约（第 3 层应为 `model_configs.is_default`，第 4 层才是硬编码 fallback）不符，属「契约已声明、实现缺失」。本缺陷与 [ISSUE-028](#issue-028) 互补：028 修好「有 corpus pin」时索引/查询侧的对称解析，但「无 pin」时双方都回退到忽略全局默认的 `resolve_embedding_config()`，单点修复 `_resolve` 即同时修好索引侧与查询侧。补充：向量列固定 `vector(1536)`（`models/base.py` `DEFAULT_EMBEDDING_DIM=1536`，hybrid SQL 硬转 `::vector(1536)`），768 维 gemini 默认根本无法写入 1536 列，故用户所选 1536 维 `text-embedding-3-small` 才是维度正确项；`model_resolver.py` 旧注释「768 维匹配既有索引」系陈旧错误。
- **处理方式**（最小干预 + 复用驱动 + 创建期固化）：
  1. **Fix #1 — `_resolve` 消费 is_default**：抽取 `_build_resolved_config(model_type, mc)`（复用既有 `_get_vendor_config`/`_build_embedding_kwargs`/`_build_llm_kwargs` + LLM `_DEFAULT_LLM_KWARGS` 合并，供「按 id」与「按默认」两路复用，DRY）；新增 `_load_default_model_config_row`（`is_default=True AND enabled=True LIMIT 1`，`enabled` 过滤排除「设为默认后又禁用」的行）与 `_resolve_from_default_model_config`；`_resolve` 在缓存命中后、`_resolve_from_vendor_configs` 之前插入 is_default 分支（**独立 try/except**，DB 异常记 warning 降级不冒泡），对 `llm`/`embedding` 对称生效。
  2. **Fix #2 — 创建期固化绑定**：resolver 新增 `resolve_default_model_config_id`（复用同一行查询，仅返回 id）；`_shared._pin_default_embedding_config` 在 `create_corpus` 序列化前将当前全局默认的 `embedding_config_id` 写入 `corpus.config.models`（已显式指定 / 无默认行 → no-op），使语料创建即绑定具体模型，免疫日后全局默认变更；后续改模型走 `update_corpus` 既有的 `_resolve_embedding_dimension` 维度比对 + `_enqueue_embedding_rebuild` 重建保护。
  3. 订正 `model_resolver.py` 陈旧注释（硬编码值仅为 DB 不可达时末位回退、权威默认来自 `model_configs.is_default`、列维 1536）。未改硬编码默认值（属部署/env 范畴）与前端（默认设置链路本就正确）。
- **后续防范**：① 解析器「文档化契约」须与实现一致——注释声明的回退层若未落地即为隐性缺陷，新增解析层应配套单测钉死；② corpus 级配置应在创建期固化为具体引用（pin），避免运行期跟随全局默认导致索引/查询维度漂移（与 ISSUE-028「索引/查询对称」同源）；③ 凡新增「全局默认 + 可空覆盖」语义，须显式覆盖「设默认后又禁用」等边界（此处 `enabled` 过滤）。
- **同类问题影响**：① **LLM 默认同路修好**（`_resolve` 对称生效）；② **既有「无 pin」历史语料**：Fix #2 不回填（需独立数据迁移），仍由 Fix #1 运行期跟随全局默认；③ **多 worker 缓存陈旧窗口（≤60s，既有非新增）**：`_cache` 单进程模块级，写端点 `invalidate_cache(None)` 仅清处理该请求的 worker，余者至多 TTL 后跟进，Fix #2 对新建语料以具体 id 绕过此窗口。
- **验证**：新增 `tests/unit_tests/config/test_model_resolver_default.py`（7 例：is_default 命中且不触达 vendor_configs / 无默认回退 gemini / `enabled` 过滤入查询 / DB 异常降级不崩 / LLM 对称且合并 `_DEFAULT_LLM_KWARGS` / 缓存命中仅查一次 / 失效后重查）+ `tests/unit_tests/knowledge/test_pin_default_embedding.py`（3 例：固化 / 显式 no-op / 无默认 no-op）；连同既有 `test_model_resolver_by_id`/`_task`/`test_model_names`/`test_embedding`/`test_search_resilience` 共 **140 全过**；三处改动模块导入校验通过。注：live 引擎运行旧 checkout，需部署后生效。
