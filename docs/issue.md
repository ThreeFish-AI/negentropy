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
