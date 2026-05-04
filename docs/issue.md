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
- **根因**：**产品形态与 schema 表达力不对称**——Phase 3 Catalog 全局化重构（[`knowledges.md` §13](./knowledges.md#13-catalog--wiki-publication-三层正交架构)）将 Catalog 从 Corpus 解耦为 N:M，schema 层支持「同 app 多 Catalog」（仅 `UNIQUE(app_name, slug)`，无单例约束）；但实际产品语义只需要一个聚合根，「多主题/多菜单/多子菜单」可由 `CatalogNode.parent_entry_id` 自引用 + `MAX_TREE_DEPTH=6` 完整承载。Migration 0004 在 Phase 2 backfill 时按「1 corpus → 1 catalog」1:1 映射，运行时通常存在 ≥3 个 Catalog（negentropy-perceives / negentropy-wiki / negentropy-aurelius-clade），UI 因此被迫暴露 `<CatalogSelector>` 让用户在多 Catalog 之间切换。本质是**缺失的聚合根不变量**，而非组件实现 bug——直接删 selector 会导致前端无法解析当前 catalog。
- **处理方式**（Expand → Backfill → Contract 三段式无破坏迁移）：
  1. **架构沉淀**（本次 PR）：[`knowledges.md` §15 单实例 Catalog 收敛（Phase 4）](./knowledges.md#15-单实例-catalog-收敛phase-4在-nm-之上叠加聚合根不变量) 作为 ADR 等价记录，明确「Phase 4 在 Phase 3 N:M schema 之上叠加聚合根不变量，不是回退」；[`negentropy-wiki-ops.md` §12](./negentropy-wiki-ops.md#12-单实例-catalog-与-wiki-发布版本管理运维) 沉淀 Phase B merge runbook（含 `pg_dump` 强制备份、守恒断言、回退 SQL）；
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
  3. **Wiki 多版本回退**：本次保留 `WikiPublication` 的 ARCHIVED/SNAPSHOT 多版本是有意为之（详见 [`wiki-ops.md` §12.3](./negentropy-wiki-ops.md#123-wikipublication-多版本与回退)），未来若引入 `KnowledgeBase` / `Skill` 类似的「发布版本」语义可参照该模式（active 单例 + 历史多版本归档）；
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
  4. `docs/negentropy-wiki-ops.md` §3.1 表格、§4.3 后端联调、§8.1 故障排除三处文档同步校正端口与排查步骤。
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
- **根因**：`cli.py` 的 `agents_dir` 已在 commit `35204ff` 从 `src/negentropy` 修正为 `src`（通过 `Path(__file__)` 推导绝对路径，免疫 cwd 漂移），但 `README.md`、`docs/zh-CN/README.md`、`docs/development.md`、`docs/user-guide.md` 共 4 个文件 7 处启动命令仍写 `uv run adk web --port 8000 --reload_agents src/negentropy`。用户照文档启动后端复现旧 bug。
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
  | 调用 | 修复前 | 修复后 |
  |------|--------|--------|
  | `_logs.set_logger_provider` | 项目 + ADK 各 1 次（第二次 warn） | **零次** |
  | `metrics.set_meter_provider` | 项目 + ADK 各 1 次（第二次 warn） | **零次** |
  | `trace.set_tracer_provider` | ADK 1 次（含 OTLP traces + ApiServerSpanExporter） | 不变 |
  | `opentelemetry-instrumentation-google-genai` 写 GenAI events | 拿到 NoExporter SDK LoggerProvider（无 processor，丢弃） | 拿到默认 ProxyLoggerProvider（同样 NoOp 丢弃） |
  | LiteLLM `"otel"` callback 上报 traces | → Langfuse `/v1/traces` | 不变 |
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

- **表因**：AI Agent（Claude / Antigravity）在沙箱形态浏览器（Playwright 默认 `chromium.launch()` 启的空白 profile）中打开 [`localhost:3192`](http://localhost:3192) 触发项目自带的 Google OAuth 流（`/auth/google/login` → `accounts.google.com` → `/auth/google/callback`，参见 [docs/sso.md](./sso.md)），跳转到 `accounts.google.com` 后因该浏览器无任何 Google 登录态，被同意屏 / reCAPTCHA / 二步验证拦截，验证链路在此中断；用户被迫多次手动接管或放弃验证。
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
  2. **Phase 3 前端架构重塑（RFC 评审后）**：引入 Codex 风格 Thread → Turn → Item 类型化数据模型；抽象 `utils/dedup/{event-merge,semantic-match,id-resolution}.ts`；阈值集中到 `config/projection-thresholds.ts`；6 层去重金字塔精简到 3 层；投影链 useMemo 缓存。RFC 草稿见 [`docs/rfcs/0001-conversation-architecture-refactor.md`](./rfcs/0001-conversation-architecture-refactor.md)。
  3. **Phase 4 UI 交互能力增强**：Reasoning Panel + Sub-Agent 嵌套卡片 / 工具进度 + 中断/审批门 / Conversation Branching + Timeline 增强。Backlog 见 [`docs/rfcs/0002-ui-interaction-enhancements.md`](./rfcs/0002-ui-interaction-enhancements.md)。
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
