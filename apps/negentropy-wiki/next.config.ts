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
 * - `images.unoptimized: true`：保留。markdown 图片经 `WikiExportService` 烘焙为
 *   `public/assets/{doc}/{file}` 静态文件（`bake_assets=true`，默认；由 prebuild/predev
 *   钩子 `scripts/sync-assets.mjs` 把内容根 `assets/` 镜像到 `public/assets/`，next build
 *   再复制进 `out/assets/`）；`bake_assets=false + asset_base_url` 时改走主站 bytea 端点。
 *   静态导出不可用 next/image optimization，故图片直链。
 */
/**
 * 稳定 buildId：默认 Next 每次构建生成随机 buildId（注入 __next.*.txt / 404 等），
 * 致「内容未变也产生差异」，破坏 Pages 发布的幂等（每次 publish 都 noise commit）。
 * 这里把 buildId 绑定到内容包各 publication 的 (slug,id,version) —— 仅当真实内容
 * 重新发布（version 递增）时变化；纯重跑导出/构建保持幂等（不取 generated_at 时间戳）。
 * content 缺失（fixture 兜底）时用固定回退值。
 */
function stableBuildId(): string {
  try {
    const fs = require("node:fs");
    const path = require("node:path");
    const crypto = require("node:crypto");
    const base = process.env.WIKI_CONTENT_DIR
      ? path.resolve(process.env.WIKI_CONTENT_DIR)
      : (() => {
          const real = path.join(process.cwd(), "content");
          return fs.existsSync(path.join(real, "index.json"))
            ? real
            : path.join(process.cwd(), "content.fixture");
        })();
    const idx = JSON.parse(fs.readFileSync(path.join(base, "index.json"), "utf8"));
    // 仅取内容版本标识（剔除 generated_at 等 wall-clock 字段），保证内容不变则 id 不变。
    const pubs = (idx.publications || [])
      .map((p: { slug: string; id: string; version: number }) => `${p.slug}:${p.id}:${p.version}`)
      .sort();
    const hash = crypto.createHash("sha256").update(JSON.stringify(pubs)).digest("hex");
    return `wiki-${hash.slice(0, 16)}`;
  } catch {
    return "wiki-fixture";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // 不设 outputFileTracingRoot：曾尝试收敛到 wiki 包根（process.cwd()），但 CI 的 pnpm
  // hoisting 把 next 提升至 monorepo 根 node_modules，收缩 Turbopack 边界后从 src/app
  // 解析不到 next/package.json 致构建失败（本地 node_modules 布局不同故未暴露）。
  // output:"export" 静态产物不依赖 NFT，「unexpected file in NFT list」为无害诊断，保留默认根即可。
  images: {
    unoptimized: true,
  },
  generateBuildId: stableBuildId,
};

export default nextConfig;
