import type { NextConfig } from "next";

/** 后端 API 基础地址（可通过环境变量覆盖） */
const API_BASE = process.env.WIKI_API_BASE || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  // SSG + ISR 配置
  images: {
    unoptimized: true, // GCS 图片直链，不经过 Next.js Image 优化
  },
  // API 代理：开发模式下将 /api/* 请求转发到后端
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BASE}/knowledge/wiki/:path*`,
      },
    ];
  },
};

export default nextConfig;
