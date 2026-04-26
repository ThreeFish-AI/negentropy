# Negentropy Wiki 运维指引

> **适用对象**: 负责部署、监控和维护 Negentropy Wiki 知识库发布站点的运维工程师
>
> **相关文档**: [架构设计](./framework.md) | [知识库设计](./knowledges.md)

---

## 1. 概述

### 1.1 定位

Negentropy Wiki 是 Negentropy 平台的知识库文档发布站点，负责将后端知识库中已发布的内容以静态网站形式对外展示。

| 组件                | 角色                   | 技术栈           |
| ------------------- | ---------------------- | ---------------- |
| **negentropy**      | 后端引擎（知识库管理） | Python + FastAPI |
| **negentropy-ui**   | 用户交互界面           | Next.js + React  |
| **negentropy-wiki** | 文档发布站点（本组件） | Next.js + SSG    |

### 1.2 核心特性

- **SSG + ISR**: 静态生成 + 增量再验证，兼顾性能与数据新鲜度
- **主题系统**: 3 套预设主题 + 深色模式自动适配
- **零运行时数据库**: 宺全依赖后端 API，- **轻量依赖**: 仅 Next.js + React 核心库

---

## 2. 架构

### 2.1 系统架构

```mermaid
flowchart LR
    subgraph Backend["后端服务"]
        KnowledgeDB[(PostgreSQL<br/>知识库)]
        WikiAPI[Wiki API<br/>/knowledge/wiki]
    end

    subgraph WikiApp["negentropy-wiki"]
        APIClient[API Client<br/>wiki-api.ts]
        SSG[SSG 生成器<br/>generate.ts]
        Pages[页面组件<br/>page.tsx]
        Theme[主题系统<br/>globals.css]
    end

    subgraph Deploy["部署"]
        CDN[CDN 缓存]
        Node[Node.js Server]
    end

    KnowledgeDB -->|数据| WikiAPI
    WikiAPI -->|HTTP/JSON| APIClient
    APIClient -->|SSG| Pages
    SSG -->|HTML| CDN
    CDN -->|静态资源| User
    User -->|访问| Node
    Node -->|ISR触发| APIClient
```

### 2.2 路由结构

| 路由                   | 页面文件                                 | 功能                                |
| ---------------------- | ---------------------------------------- | ----------------------------------- |
| `/`                    | `src/app/page.tsx`                       | 首页：列出所有已发布的 Publication  |
| `/:pubSlug`            | `src/app/[pubSlug]/page.tsx`             | Publication 首页：导航树 + 文档索引 |
| `/:pubSlug/:entrySlug` | `src/app/[pubSlug]/[entrySlug]/page.tsx` | 文档详情页：Markdown 渲染           |

### 2.3 数据流

```
用户访问 → CDN/Node 缓存命中?
    ├─ 是 → 返回静态 HTML
    └─ 否/过期 → 触发 ISR
                    ↓
               调用后端 Wiki API
                    ↓
               重新生成 HTML
                    ↓
               返回新内容（后台异步）
```

---

## 3. 环境配置

### 3.1 环境变量

| 变量名          | 默认值                  | 说明                                                          |
| --------------- | ----------------------- | ------------------------------------------------------------- |
| `WIKI_API_BASE` | `http://localhost:3292` | 后端 negentropy 引擎地址（与 `cli.py` 默认监听端口对齐）      |

### 3.2 依赖版本

| 依赖         | 版本    | 用途            |
| ------------ | ------- | --------------- |
| `next`       | ^15.2.0 | Next.js 框架    |
| `react`      | ^19.0.0 | UI 库           |
| `typescript` | ^5.7.0  | 类型检查        |
| `vitest`     | ^4.1.3  | 单元测试（dev） |

---

## 4. 开发环境

### 4.1 前置条件

- Node.js >= 18.x
- pnpm >= 8.x（项目包管理器规范）

### 4.2 本地启动

```bash
# 1. 进入项目目录
cd apps/negentropy-wiki

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器（默认端口 3092）
pnpm dev
```

### 4.3 后端联调

开发模式下，API 请求通过 `next.config.ts` 中的 `rewrites` 配置自动代理到后端：

```typescript
// next.config.ts
async rewrites() {
  return [{
    source: "/api/:path*",
    destination: `${API_BASE}/knowledge/wiki/:path*`,
  }];
}
```

确保后端服务运行在 `WIKI_API_BASE` 指定的地址（默认 `localhost:3292`，与 `apps/negentropy/src/negentropy/cli.py` 默认监听端口同源）。

---

## 5. 构建与部署

### 5.1 构建

```bash
# SSG 构建（需后端 API 可用）
pnpm build

# 输出：
# .next/           - Next.js 构建产物
# .next/standalone/ - 独立可运行的 Node.js 应用
```

### 5.2 本地预览

```bash
# 启动构建后的应用（由 scripts/start-production.mjs 注入 PORT=3092、HOSTNAME=localhost）
pnpm start

# 访问 http://localhost:3092（可通过 `PORT` 环境变量覆盖，与 `dev` 默认端口保持一致）
```

> `pnpm start` 内部通过 `scripts/start-production.mjs` 包装 Next.js standalone 入口：在临时目录中 symlink 回填 `.next/static/` 与 `public/`（standalone 模式不会自动拷贝这两类静态资产），并注入默认端口，避免裸 `node .next/standalone/server.js` 因 cwd 漂移导致 `/_next/static/*` 被动态路由 `[pubSlug]/[...entrySlug]` 吞并的回归。

### 5.3 Docker 部署

```dockerfile
# Dockerfile 示例
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
# standalone 产物不包含 .next/static 与 public，需显式 COPY 至 server.js 邻近路径
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
ENV PORT=3092 HOSTNAME=0.0.0.0
EXPOSE 3092
CMD ["node", "server.js"]
```

> 容器镜像通过 `COPY` 直接把静态资产放到 standalone 目录下（与宿主机 `scripts/start-production.mjs` 的 symlink 同构），因此容器内可直接运行 `node server.js`，无需额外执行 wrapper 脚本。

### 5.4 生产环境检查清单

- [ ] 设置 `WIKI_API_BASE` 环境变量（后端生产地址）
- [ ] 配置 CDN 缓存策略（ISR 页面建议缓存 300s）
- [ ] 配置健康检查端点（可选）
- [ ] 设置日志收集（stdout/stderr）

---

## 6. ISR 缓存策略

### 6.1 机制说明

- **revalidate: 300** (5 分钟)
- 用户访问页面时，若缓存超过 5 分钟：
  1. 立即返回缓存的 HTML
  2. 后台异步触发重新生成
  3. 下次访问返回新内容

### 6.2 缓存更新场景

| 场景                 | 行为                                    |
| -------------------- | --------------------------------------- |
| 后端新增 Publication | 下次构建时自动收录，或通过 ISR 自然更新 |
| 后端更新内容         | 5 分钟内 ISR 自动刷新                   |
| 需要立即生效         | 重新部署或清除 CDN 缓存                 |

---

## 7. 主题系统

### 7.1 可用主题

| 主题名    | 风格          | 侧边栏宽度 | 内容区宽度 |
| --------- | ------------- | ---------- | ---------- |
| `default` | Notion/Vercel | 280px      | 800px      |
| `book`    | GitBook       | 300px      | 900px      |
| `docs`    | Docusaurus    | 260px      | 1024px     |

### 7.2 主题切换

主题由后端 Publication 数据中的 `theme` 字段决定。当前实现在 `layout.tsx` 中硬编码为 `default`：

```tsx
// src/app/layout.tsx
<html lang="zh-CN" data-theme="default">
```

> **TODO**: 未来应根据 Publication 配置动态切换主题。

### 7.3 深色模式

通过 CSS `prefers-color-scheme` 媒体查询自动适配：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --wiki-bg: #1a1a1a;
    --wiki-text: #e5e5e5;
    /* ... */
  }
}
```

---

## 8. 故障排除

### 8.1 常见问题

| 问题                                      | 可能原因                               | 解决方案                                                                                                                              |
| ----------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 构建期告警 "Failed to fetch publications" | 后端 API 不可达（WARN 级，不阻断构建） | 后端暂不可达时 SSG 渲染空首页，首次请求由 ISR 自动自愈（5 分钟窗口）；若需构建期预渲染真实数据，检查 `WIKI_API_BASE` 配置和网络连通性 |
| 「同步并发布」后首页持续显示「暂无已发布的 Wiki」 | 端口错配 / webhook 未触达 / ISR 残留空缓存（详见 [docs/issue.md ISSUE-020](./issue.md#issue-020)） | (a) `curl http://localhost:3292/knowledge/wiki/publications?status=published` 验后端连通；(b) 检查 `WIKI_API_BASE` 是否被本地 `.env` 错误覆盖；(c) 确认后端 `NE_KNOWLEDGE_WIKI_REVALIDATE__URL` 未被错误覆盖；(d) 若曾混用 `pnpm start` 致 `.temp/` 残留，执行 `rm -rf apps/negentropy-wiki/.next apps/negentropy-wiki/.temp` 后重启 dev |
| 页面显示 "Wiki 未找到"                    | Publication 未发布或 slug 错误         | 检查后端 Publication 状态                                                                                                             |
| 页面内容不更新                            | ISR 缓存未过期                         | 等待 5 分钟或重新部署                                                                                                                 |
| 深色模式样式异常                          | 浏览器未启用深色模式                   | 检查系统深色模式设置                                                                                                                  |
| Markdown 渲染异常                         | 不支持的语法                           | 检查 markdown.ts 支持的语法子集                                                                                                       |

### 8.2 日志查看

```bash
# 查看 Next.js 服务日志
docker logs <container-id>

# 或直接运行时
pnpm start 2>&1 | tee wiki.log
```

### 8.3 健康检查

```bash
# 检查 API 连通性
curl ${WIKI_API_BASE}/knowledge/wiki/publications?status=published

# 预期返回
{"items": [...], "total": N}
```

---

## 9. 安全注意事项

- **XSS 防护**: Markdown 渲染器已内置 HTML 转义，但建议后续升级为 `react-markdown` + `DOMPurify`
- **无认证**: Wiki 站点为公开访问，不实现用户认证
- **API 鉴权**: 当前后端 Wiki API 不需要鉴权，生产环境应评估是否需要 IP 白名单

---

## 10. 关键文件速查

| 文件                                     | 用途                     |
| ---------------------------------------- | ------------------------ |
| `src/app/layout.tsx`                     | 根布局、元数据、主题设置 |
| `src/app/page.tsx`                       | 首页组件                 |
| `src/app/[pubSlug]/page.tsx`             | Publication 页面         |
| `src/app/[pubSlug]/[entrySlug]/page.tsx` | 文档详情页               |
| `src/lib/wiki-api.ts`                    | API 客户端               |
| `src/lib/markdown.ts`                    | Markdown 渲染器          |
| `src/app/globals.css`                    | 全局样式、主题变量       |
| `next.config.ts`                         | Next.js 配置、API 代理   |
| `vitest.config.ts`                       | 测试配置                 |

---

## 11. 相关链接

- [Next.js SSG 文档](https://nextjs.org/docs/app/building-your-application/rendering/static-site-generation)
- [Next.js ISR 文档](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)

---

## 12. 单实例 Catalog 与 Wiki 发布版本管理运维

> **架构依据**：[`knowledges.md` §15 单实例 Catalog 收敛（Phase 4）](./knowledges.md#15-单实例-catalog-收敛phase-4在-nm-之上叠加聚合根不变量)
> **关联 Issue**：[`issue.md` ISSUE-015](./issue.md#issue-015)
> **适用版本**：Phase 4（Migration 0007/0008）落地后

### 12.1 不变量与日常巡检

每个 `app_name` 应当**至多** 1 个 active Catalog、每个 Catalog 应当**至多** 1 个 LIVE WikiPublication。任何破坏该不变量的写入应被 partial unique index 阻断。

**日常巡检 SQL**（建议加入 Grafana 或周报）：

```sql
-- 1. 检查 active Catalog 单例
SELECT app_name, COUNT(*) AS active_count
  FROM doc_catalogs
 WHERE is_archived = false
 GROUP BY app_name
HAVING COUNT(*) > 1;
-- 期望：0 行

-- 2. 检查 LIVE Publication 单例
SELECT catalog_id, COUNT(*) AS live_count
  FROM wiki_publications
 WHERE status = 'LIVE'
 GROUP BY catalog_id
HAVING COUNT(*) > 1;
-- 期望：0 行

-- 3. tombstone 溯源完整性
SELECT id, app_name, slug, merged_into_id
  FROM doc_catalogs
 WHERE is_archived = true
   AND merged_into_id IS NULL;
-- 期望：0 行（所有 tombstone 必须有溯源指针）

-- 4. tombstone 链不应自引用
SELECT id FROM doc_catalogs WHERE merged_into_id = id;
-- 期望：0 行
```

异常告警阈值：以上任一查询返回 > 0 行，应立刻冻结 catalog 写入并人工核查。

### 12.2 Phase B Merge Runbook

> **风险等级**：高（涉及多 Catalog 子树嫁接、WikiPublication 重指向、JSONB rewrite）
> **回退性**：Phase B 声明 `DESTRUCTIVE_DOWNGRADE = true`，downgrade 不会反向拆分子树
> **执行窗口**：低峰窗口（建议工作日 02:00–04:00 UTC+8）

#### 12.2.1 前置检查（执行前）

```bash
# 1. 进入数据库
uv run python -c "from negentropy.db import get_engine; print(get_engine().url)"

# 2. 扫描嫁接后是否会超过 MAX_TREE_DEPTH=6
psql ${DATABASE_URL} -c "
WITH RECURSIVE tree(id, depth) AS (
  SELECT id, 1 FROM doc_catalog_entries WHERE parent_entry_id IS NULL
  UNION ALL
  SELECT c.id, t.depth + 1
    FROM doc_catalog_entries c JOIN tree t ON c.parent_entry_id = t.id
)
SELECT catalog_id, MAX(depth) AS max_depth
  FROM tree JOIN doc_catalog_entries USING (id)
 GROUP BY catalog_id;
"
# 任一 catalog max_depth >= 6 → 嫁接后 ≥ 7 → 中止迁移，人工降阶后再执行

# 3. 当前 active catalog 数量
psql ${DATABASE_URL} -c "
SELECT app_name, COUNT(*) FROM doc_catalogs
 WHERE is_archived = false GROUP BY app_name;
"

# 4. 文档总量基线（守恒断言用）
psql ${DATABASE_URL} -c "
SELECT
  (SELECT COUNT(*) FROM doc_catalog_entries) AS entries,
  (SELECT COUNT(DISTINCT document_id) FROM doc_catalog_documents) AS docs;
"
```

#### 12.2.2 强制备份（**严禁跳过**）

```bash
# 全库快照（与 AGENTS.md「数据迁移严禁删除现有数据」要求一致）
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump ${DATABASE_URL} \
  --format=custom \
  --file=/backup/negentropy_pre_phase_b_${TIMESTAMP}.dump

# 校验快照可读
pg_restore --list /backup/negentropy_pre_phase_b_${TIMESTAMP}.dump | head -20
```

**RPO**: 0（迁移前零数据丢失容忍）
**RTO**: ≤ 30 分钟（按 100k 文档规模估算）

#### 12.2.3 执行迁移

```bash
# Phase A（仅加索引/列，幂等可重试）
uv run alembic upgrade 0007

# Phase B（数据合并，单次执行）
uv run alembic upgrade 0008
```

#### 12.2.4 守恒断言（迁移后立即执行）

```sql
-- 1. entries 总数守恒
SELECT COUNT(*) FROM doc_catalog_entries;
-- 与 12.2.1 步骤 4 entries 数值相等

-- 2. 不重复 document 数守恒
SELECT COUNT(DISTINCT document_id) FROM doc_catalog_documents;
-- 与 12.2.1 步骤 4 docs 数值相等

-- 3. partial unique index 生效
SELECT app_name, COUNT(*) FROM doc_catalogs
 WHERE is_archived = false GROUP BY app_name;
-- 每行 count 必须 = 1

-- 4. tombstone 溯源
SELECT id, app_name, merged_into_id FROM doc_catalogs
 WHERE is_archived = true AND merged_into_id IS NOT NULL;
```

任一断言失败 → **立刻 ROLLBACK 并从 12.2.2 快照恢复**：

```bash
pg_restore --clean --if-exists --dbname=${DATABASE_URL} \
  /backup/negentropy_pre_phase_b_${TIMESTAMP}.dump
```

#### 12.2.5 灰度与监控

| 阶段 | 时间窗 | 观测指标 |
|------|--------|---------|
| Phase A 上线后 | T+0 ~ T+7d | `catalog_create_total` 写入趋势；partial unique index 不应触发 |
| Phase B 执行后 | T+0 ~ T+24h | 守恒断言 4 项；前端 `/knowledge/catalog` 错误率；WikiPublication 渲染成功率 |
| Phase C 前端切换后 | T+0 ~ T+14d | `catalog_create_rejected_total`（防御 409）；`useAppCatalog` SWR 命中率 |
| Phase D 清理（可选） | T+30d 后 | 无新告警则可考虑 drop 6 周宽限期内未触发的 deprecated API |

### 12.3 WikiPublication 多版本与回退

Phase 4 仅约束 `status='LIVE'` 的 WikiPublication 单例化，**`ARCHIVED` 与 `SNAPSHOT` 不受限**——同 catalog 可保留任意多历史版本用于回退。

#### 12.3.1 查询历史版本

```sql
SELECT id, slug, version, status, published_at, archived_at
  FROM wiki_publications
 WHERE catalog_id = '<CATALOG_ID>'
 ORDER BY version DESC;
```

#### 12.3.2 回退操作（业务低峰执行）

```sql
BEGIN;

-- 1. 当前 LIVE 降级为 ARCHIVED
UPDATE wiki_publications
   SET status = 'ARCHIVED', archived_at = NOW()
 WHERE catalog_id = '<CATALOG_ID>' AND status = 'LIVE';

-- 2. 目标历史版本提升为 LIVE
UPDATE wiki_publications
   SET status = 'LIVE', archived_at = NULL
 WHERE id = '<TARGET_VERSION_ID>';

-- 3. 校验仍满足单例
SELECT COUNT(*) FROM wiki_publications
 WHERE catalog_id = '<CATALOG_ID>' AND status = 'LIVE';
-- 必须 = 1，否则 ROLLBACK

COMMIT;
```

回退后需手动触发 Wiki 站点 ISR revalidate（具体方式参考 [§5 部署 / 构建 / 缓存](#5-部署--构建--缓存)）。

### 12.4 故障应对

| 现象 | 排查 | 处置 |
|------|------|------|
| `POST /catalogs` 持续返回 409 | 旧客户端未升级 | 引导调用方迁移至 `POST /catalogs/ensure` 幂等接口；6 周宽限期后下线 |
| 守恒断言失败 | Phase B 中途异常 | 立即从 12.2.2 快照 `pg_restore` 完整恢复 |
| `useAppCatalog` 404 | active catalog 被误归档 | 临时 `UPDATE doc_catalogs SET is_archived=false WHERE id=?` + 复盘 |
| WikiPublication 无 LIVE | 发布操作未提升新版本 | 按 12.3.2 回退到最近 ARCHIVED |

---
