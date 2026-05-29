import type { NextConfig } from "next";

/** 后端 API 基础地址（可通过环境变量覆盖；默认与 negentropy `cli.py` 监听端口 3292 对齐） */
const API_BASE = process.env.WIKI_API_BASE || "http://localhost:3292";

/**
 * ui 端 BFF 基础地址 —— Agents at Wiki 的对话流与 Agent 元数据
 * 统一代理到 ui 端 BFF（复用 ui 的 ADK normalizer / NDJSON 编码 / sso 头转发，
 * 避免在 wiki 端重复实现 ADK→AGUI 事件流转换）。
 *
 * 部署形态：
 * - 开发：ui 端默认端口 3192（与 `pnpm --filter negentropy-ui dev` 一致）
 * - 生产：通常通过反代将 ui 与 wiki 部署到同根域（如 wiki.x.com / app.x.com），
 *   后端配置 `NE_AUTH_COOKIE_DOMAIN=.x.com` 让 ne_sso cookie 自动共享。
 *
 * 环境变量：`WIKI_UI_BFF_BASE`（缺省 `http://localhost:3192`）。
 */
const UI_BFF_BASE =
  process.env.WIKI_UI_BFF_BASE || "http://localhost:3192";

const nextConfig: NextConfig = {
  output: "standalone",
  // SSG + ISR 配置
  images: {
    unoptimized: true, // GCS 图片直链，不经过 Next.js Image 优化
  },
  // API 代理：开发模式下将 /api/* 请求转发到后端
  //
  // 顺序匹配：Next rewrites 按声明顺序匹配，更具体的路径必须前置；
  // /api/:path* 兜底放最后，避免吞掉 /api/interface/* 与 /api/agui/* 等更具体路径。
  async rewrites() {
    return [
      // Agent 元数据 —— Agents at Wiki 的「一主五翼」选择/提及候选源
      // 复用 ui 端 BFF（ui 端已聚合鉴权与字段裁剪），避免 wiki 重复实现
      {
        source: "/api/interface/agents",
        destination: `${UI_BFF_BASE}/api/interface/agents`,
      },
      {
        source: "/api/interface/agents/:path*",
        destination: `${UI_BFF_BASE}/api/interface/agents/:path*`,
      },
      // AGUI 对话流（NDJSON / SSE，POST 与 resume GET 共用）
      // 透明代理到 ui 端 BFF —— 复用 ADK→AGUI normalizer 与 SSO 头转发
      {
        source: "/api/agui",
        destination: `${UI_BFF_BASE}/api/agui`,
      },
      {
        source: "/api/agui/:path*",
        destination: `${UI_BFF_BASE}/api/agui/:path*`,
      },
      // 既有：wiki 内容 API 兜底
      {
        source: "/api/:path*",
        destination: `${API_BASE}/knowledge/wiki/:path*`,
      },
    ];
  },
};

export default nextConfig;
