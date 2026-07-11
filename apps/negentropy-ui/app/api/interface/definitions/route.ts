import { proxyGet, proxyPost } from "@/app/api/interface/_proxy";

/**
 * Definitions 集合 API 代理端点（定义源 SSOT）
 *
 * GET  /api/interface/definitions - 列出定义源（支持 kind / is_enabled / 分页查询参数）
 * POST /api/interface/definitions - 新建定义源（admin）
 */

export async function GET(request: Request) {
  return proxyGet(request, "/interface/definitions");
}

export async function POST(request: Request) {
  return proxyPost(request, "/interface/definitions");
}
