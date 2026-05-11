import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Tools 集合 API 代理端点
 *
 * GET  /api/interface/tools - 列出工具
 * POST /api/interface/tools - 创建工具
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/tools");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/tools");
}
