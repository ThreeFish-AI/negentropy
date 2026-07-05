import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Repositories 集合 API 代理端点
 *
 * GET  /api/interface/repositories - 列出可见的 Repository
 * POST /api/interface/repositories - 注册新 Repository
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/repositories");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/repositories");
}
