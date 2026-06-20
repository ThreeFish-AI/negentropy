import type { NextConfig } from "next";

/**
 * 纯静态导出配置（Independent Deployment）
 *
 * 站点完全静态化为 `out/`（HTML/CSS/JS），由任意静态托管（nginx /
 * static-web-server / CDN / GitHub Pages）提供服务，运行时**零后端、零数据库**
 * 依赖。内容来自仓库内 `content/`（主站 publish 经 CI 导出并提交）。
 *
 * - `output: "export"`：禁止 server runtime / API routes / ISR revalidate；
 *   动态内容（评论 / 标注 / Agent 对话 / SSO / 浏览统计）随之移除，搜索改用
 *   Pagefind（构建时索引、浏览器端运行）。
 * - `trailingSlash: true`：为 catch-all 路由 `[...entrySlug]` 产出目录式 HTML
 *   （`/pub/entry/`），对静态托管更友好（避免刷新 404）。
 * - `images.unoptimized: true`：保留。markdown 图片走主站资产端点
 *   （`/knowledge/wiki/documents/{doc}/assets/{file}`，从 PostgreSQL bytea 提供），
 *   导出期由后端 WikiExportService 重写为绝对/相对 URL。
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
